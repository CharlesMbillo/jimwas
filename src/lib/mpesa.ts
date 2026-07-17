// M-Pesa STK Push Integration
import { generateId } from './db';
import type { KCBPaymentRecord } from './db';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export interface STKPushResponse {
  success: boolean;
  checkoutRequestId?: string;
  merchantRequestId?: string;
  mpesaTransactionId?: string;
  error?: string;
}

export interface STKPushStatusResponse {
  success: boolean;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'cancelled' | 'timeout' | 'insufficient_balance';
  mpesaReceiptNumber?: string;
  resultDesc?: string;
  error?: string;
}

// Initiate STK Push
export async function initiateSTKPush(
  phone: string,
  amount: number,
  options?: {
    transactionId?: string;
    customerId?: string;
    cashierId?: string;
    cashierName?: string;
    accountReference?: string;
    transactionDesc?: string;
  }
): Promise<STKPushResponse> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/mpesa-stk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        phone,
        amount,
        ...options,
      }),
    });

    // Safely parse JSON response
    let data;
    try {
      const text = await response.text();
      if (!text) {
        return { success: false, error: 'Empty response from KCB service' };
      }
      data = JSON.parse(text);
    } catch (parseError) {
      console.error('[v0] JSON parse error in initiateSTKPush:', parseError);
      return { success: false, error: 'Invalid response from KCB service' };
    }

    if (!response.ok) {
      return { success: false, error: data?.error || 'Failed to initiate payment' };
    }

    return {
      success: true,
      checkoutRequestId: data.checkoutRequestId,
      merchantRequestId: data.merchantRequestId,
      mpesaTransactionId: data.mpesaTransactionId,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Network error' };
  }
}

// Check STK Push Status
export async function checkSTKPushStatus(checkoutRequestId: string): Promise<STKPushStatusResponse> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/mpesa-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ checkoutRequestId }),
    });

    // Safely parse JSON response
    let data;
    try {
      const text = await response.text();
      if (!text) {
        return { success: false, status: 'failed', error: 'Empty response from KCB service' };
      }
      data = JSON.parse(text);
    } catch (parseError) {
      console.error('[v0] JSON parse error in checkSTKPushStatus:', parseError);
      return { success: false, status: 'failed', error: 'Invalid response from KCB service' };
    }

    if (!response.ok) {
      return { success: false, status: 'failed', error: data?.error || 'Failed to check status' };
    }

    return {
      success: true,
      status: data.status,
      mpesaReceiptNumber: data.mpesaReceiptNumber,
      resultDesc: data.resultDesc,
    };
  } catch (error) {
    return { success: false, status: 'failed', error: error instanceof Error ? error.message : 'Network error' };
  }
}

// Poll for payment completion with exponential backoff
export async function pollForPaymentCompletion(
  checkoutRequestId: string,
  options?: {
    maxAttempts?: number;
    intervalMs?: number;
    onStatusChange?: (status: STKPushStatusResponse) => void;
  }
): Promise<STKPushStatusResponse> {
  const maxAttempts = options?.maxAttempts || 36; // 36 attempts with exponential backoff = ~5 minutes
  const initialIntervalMs = options?.intervalMs || 5000; // Start at 5 seconds

  let consecutiveProcessing = 0; // Track how many "processing" responses in a row
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await checkSTKPushStatus(checkoutRequestId);

    options?.onStatusChange?.(status);

    if (status.status === 'success') {
      return status;
    }

    // Terminal failure states - return immediately
    if (
      status.status === 'failed' ||
      status.status === 'cancelled' ||
      status.status === 'invalid_pin' ||
      status.status === 'insufficient_balance'
    ) {
      return status;
    }

    // Processing/waiting states - continue polling with exponential backoff
    if (status.status === 'processing') {
      consecutiveProcessing++;
    } else {
      consecutiveProcessing = 0;
    }

    // Calculate wait time with exponential backoff
    // First 3 attempts: 3s each (quick checks for fast responses)
    // Next 6 attempts: 5s each
    // Next 12 attempts: 10s each (every ~2 minutes)
    // Rest: 20s each (slow polling for long-running transactions)
    let waitMs: number;
    if (attempt < 3) {
      waitMs = 3000; // First 3: 3 sec
    } else if (attempt < 9) {
      waitMs = 5000; // Next 6: 5 sec
    } else if (attempt < 21) {
      waitMs = 10000; // Next 12: 10 sec
    } else {
      waitMs = 20000; // Rest: 20 sec
    }

    // Wait before next check
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }

  return { success: false, status: 'timeout', error: 'Payment verification timed out after 5 minutes' };
}

// Format phone number for display
export function formatPhoneDisplay(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('254') && cleaned.length === 12) {
    return `+${cleaned.substring(0, 3)} ${cleaned.substring(3, 6)} ${cleaned.substring(6, 9)} ${cleaned.substring(9)}`;
  }
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return `${cleaned.substring(0, 4)} ${cleaned.substring(4, 7)} ${cleaned.substring(7)}`;
  }
  return phone;
}

// Create and track M-Pesa payment record
export async function createKCBPaymentRecord(
  phone: string,
  amount: number,
  options?: {
    transactionId?: string;
    cashierId?: string;
    checkoutRequestId?: string;
    merchantRequestId?: string;
  }
): Promise<KCBPaymentRecord> {
  const { saveMpesaPayment } = await import('./db');
  
  const payment: KCBPaymentRecord = {
    id: `mpesa_${generateId()}`,
    phone,
    amount,
    status: 'pending',
    attempts: 0,
    created_at: new Date().toISOString(),
    created_by: options?.cashierId,
    transaction_id: options?.transactionId,
    checkout_request_id: options?.checkoutRequestId,
    merchant_request_id: options?.merchantRequestId,
    sync_status: 'pending',
  };
  
  await saveMpesaPayment(payment);
  return payment;
}

// Update payment after STK Push initiation
export async function recordMpesaInitiation(
  paymentId: string,
  checkoutRequestId: string,
  merchantRequestId: string
) {
  const { updateMpesaPaymentStatus } = await import('./db');
  
  await updateMpesaPaymentStatus(paymentId, 'processing', {
    checkout_request_id: checkoutRequestId,
    merchant_request_id: merchantRequestId,
    attempts: 1,
  });
}

// Update payment after successful completion
export async function recordMpesaSuccess(
  paymentId: string,
  mpesaReceiptNumber: string,
  resultDesc: string
) {
  const { updateMpesaPaymentStatus } = await import('./db');
  
  await updateMpesaPaymentStatus(paymentId, 'success', {
    mpesa_receipt_number: mpesaReceiptNumber,
    result_desc: resultDesc,
    completed_at: new Date().toISOString(),
  });
}

// Update payment on failure
export async function recordMpesaFailure(
  paymentId: string,
  status: 'failed' | 'cancelled' | 'timeout' | 'insufficient_balance',
  errorMessage: string
) {
  const { getMpesaPayment, updateMpesaPaymentStatus } = await import('./db');
  const payment = await getMpesaPayment(paymentId);
  
  await updateMpesaPaymentStatus(paymentId, status, {
    error_message: errorMessage,
    attempts: (payment?.attempts || 0) + 1,
  });
}
