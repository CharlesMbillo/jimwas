/**
 * KCB Payment Repository
 * Database operations for KCB payment transactions
 */

import type {
  STKPushPayload,
  IPNPayload,
} from './types';

export interface PaymentTransaction {
  id: string;
  merchant_request_id: string;
  checkout_request_id: string;
  invoice_id: string;
  customer_id?: string;
  phone_number: string;
  amount: number;
  currency: string;
  description?: string;
  status: 'pending' | 'paid' | 'failed' | 'timeout' | 'cancelled' | 'insufficient_funds';
  receipt: string | null;
  result_code: number | null;
  result_desc: string | null;
  transaction_date: string | null;
  raw_payload: Record<string, any>;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentCallback {
  id: string;
  transaction_id: string;
  merchant_request_id: string;
  checkout_request_id: string;
  result_code: number;
  result_desc: string;
  signature: string;
  payload: Record<string, any>;
  verified: boolean;
  processed_at: string | null;
  created_at: string;
}

export interface CreateTransactionRequest {
  stk_response: STKPushPayload;
  invoice_id: string;
  customer_id?: string;
  description?: string;
}

export interface UpdateTransactionRequest {
  status: PaymentTransaction['status'];
  receipt?: string;
  result_code?: number;
  result_desc?: string;
  transaction_date?: string;
}

export interface CreateCallbackRequest {
  transaction_id: string;
  ipn_payload: IPNPayload;
  signature: string;
  verified: boolean;
}

/**
 * Create a new payment transaction record
 */
export async function createPaymentTransaction(
  req: CreateTransactionRequest
): Promise<PaymentTransaction> {
  try {
    const { getSupabase } = await import('../../sync');
    const supabase = getSupabase();

    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

    const transaction: PaymentTransaction = {
      id: crypto.randomUUID(),
      merchant_request_id: req.stk_response.merchantRequestId,
      checkout_request_id: req.stk_response.checkoutRequestId,
      invoice_id: req.invoice_id,
      customer_id: req.customer_id,
      phone_number: req.stk_response.phoneNumber,
      amount: req.stk_response.amount,
      currency: 'KES',
      description: req.description || req.stk_response.description,
      status: 'pending',
      receipt: null,
      result_code: null,
      result_desc: null,
      transaction_date: null,
      raw_payload: req.stk_response,
      expires_at: expiresAt,
      created_at: now,
      updated_at: now,
    };

    const { error } = await supabase
      .from('payment_transactions')
      .insert(transaction);

    if (error) {
      throw new Error(`Failed to create transaction: ${error.message}`);
    }

    return transaction;
  } catch (error) {
    console.error('[v0] Failed to create payment transaction:', error);
    throw error;
  }
}

/**
 * Update payment transaction status
 */
export async function updatePaymentTransaction(
  checkoutRequestId: string,
  req: UpdateTransactionRequest
): Promise<PaymentTransaction | null> {
  try {
    const { getSupabase } = await import('../../sync');
    const supabase = getSupabase();

    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('payment_transactions')
      .update({
        status: req.status,
        receipt: req.receipt || null,
        result_code: req.result_code || null,
        result_desc: req.result_desc || null,
        transaction_date: req.transaction_date || null,
        updated_at: now,
      })
      .eq('checkout_request_id', checkoutRequestId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update transaction: ${error.message}`);
    }

    return data || null;
  } catch (error) {
    console.error('[v0] Failed to update payment transaction:', error);
    throw error;
  }
}

/**
 * Get payment transaction by checkout request ID
 */
export async function getPaymentTransaction(
  checkoutRequestId: string
): Promise<PaymentTransaction | null> {
  try {
    const { getSupabase } = await import('../../sync');
    const supabase = getSupabase();

    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('checkout_request_id', checkoutRequestId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      throw new Error(`Failed to fetch transaction: ${error.message}`);
    }

    return data || null;
  } catch (error) {
    console.error('[v0] Failed to get payment transaction:', error);
    throw error;
  }
}

/**
 * Get payment transactions by status
 */
export async function getPaymentsByStatus(
  status: PaymentTransaction['status'],
  limit: number = 50
): Promise<PaymentTransaction[]> {
  try {
    const { getSupabase } = await import('../../sync');
    const supabase = getSupabase();

    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch payments: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('[v0] Failed to get payments by status:', error);
    return [];
  }
}

/**
 * Get transaction history
 */
export async function getTransactionHistory(
  limit: number = 50,
  offset: number = 0
): Promise<PaymentTransaction[]> {
  try {
    const { getSupabase } = await import('../../sync');
    const supabase = getSupabase();

    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
      .from('payment_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch history: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('[v0] Failed to get transaction history:', error);
    return [];
  }
}

/**
 * Save payment callback
 */
export async function savePaymentCallback(
  req: CreateCallbackRequest
): Promise<PaymentCallback> {
  try {
    const { getSupabase } = await import('../../sync');
    const supabase = getSupabase();

    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    // Get transaction first
    const transData = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('id', req.transaction_id)
      .single();

    if (transData.error) {
      throw new Error(`Transaction not found: ${transData.error.message}`);
    }

    const transaction = transData.data;
    const now = new Date().toISOString();

    const callback: PaymentCallback = {
      id: crypto.randomUUID(),
      transaction_id: req.transaction_id,
      merchant_request_id: transaction.merchant_request_id,
      checkout_request_id: transaction.checkout_request_id,
      result_code: req.ipn_payload.resultCode || 0,
      result_desc: req.ipn_payload.resultDescription || '',
      signature: req.signature,
      payload: req.ipn_payload,
      verified: req.verified,
      processed_at: null,
      created_at: now,
    };

    const { error } = await supabase
      .from('payment_callbacks')
      .insert(callback);

    if (error) {
      throw new Error(`Failed to save callback: ${error.message}`);
    }

    return callback;
  } catch (error) {
    console.error('[v0] Failed to save payment callback:', error);
    throw error;
  }
}

/**
 * Get callbacks for transaction
 */
export async function getPaymentCallbacks(
  transactionId: string
): Promise<PaymentCallback[]> {
  try {
    const { getSupabase } = await import('../../sync');
    const supabase = getSupabase();

    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
      .from('payment_callbacks')
      .select('*')
      .eq('transaction_id', transactionId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch callbacks: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('[v0] Failed to get payment callbacks:', error);
    return [];
  }
}

/**
 * Get pending payments (for retry queue)
 */
export async function getPendingPayments(
  limit: number = 100
): Promise<PaymentTransaction[]> {
  try {
    return await getPaymentsByStatus('pending', limit);
  } catch (error) {
    console.error('[v0] Failed to get pending payments:', error);
    return [];
  }
}

/**
 * Get expired payments (for cleanup)
 */
export async function getExpiredPayments(
  limit: number = 50
): Promise<PaymentTransaction[]> {
  try {
    const { getSupabase } = await import('../../sync');
    const supabase = getSupabase();

    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('payment_transactions')
      .select('*')
      .lt('expires_at', now)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch expired payments: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('[v0] Failed to get expired payments:', error);
    return [];
  }
}

/**
 * Mark callback as processed
 */
export async function markCallbackProcessed(
  callbackId: string
): Promise<void> {
  try {
    const { getSupabase } = await import('../../sync');
    const supabase = getSupabase();

    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const now = new Date().toISOString();

    const { error } = await supabase
      .from('payment_callbacks')
      .update({ processed_at: now })
      .eq('id', callbackId);

    if (error) {
      throw new Error(`Failed to mark callback processed: ${error.message}`);
    }
  } catch (error) {
    console.error('[v0] Failed to mark callback processed:', error);
    throw error;
  }
}
