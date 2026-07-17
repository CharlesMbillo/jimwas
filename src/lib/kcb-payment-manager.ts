/**
 * KCB Payment Manager
 * Handles automatic persistence and status tracking of KCB BUNI payments
 */

import { generateId } from './db';
import type { STKPushPayload, PaymentStatus } from './modules/payments/kcb/types';

export interface KCBPaymentRecord {
  id: string;
  merchant_request_id: string;
  checkout_request_id: string;
  phone_number: string;
  amount: number;
  invoice_number: string;
  status: 'initiated' | 'pending' | 'paid' | 'failed' | 'cancelled' | 'timeout' | 'insufficient_funds';
  receipt_number?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

export interface PaymentPollingOptions {
  maxAttempts?: number;
  pollingInterval?: number; // milliseconds
  timeout?: number; // milliseconds
}

// In-memory payment cache for tracking in-progress payments
const paymentCache = new Map<string, KCBPaymentRecord>();

// Storage key for persisting payments to IndexedDB
const PAYMENT_RECORDS_STORE = 'kcb_payment_records';

/**
 * Create a new payment record from STK Push response
 */
export function createPaymentRecord(
  response: STKPushPayload,
  metadata?: Record<string, any>
): KCBPaymentRecord {
  const now = new Date().toISOString();
  const record: KCBPaymentRecord = {
    id: generateId(),
    merchant_request_id: response.merchantRequestId,
    checkout_request_id: response.checkoutRequestId,
    phone_number: response.phoneNumber,
    amount: response.amount,
    invoice_number: response.invoiceNumber,
    status: 'initiated',
    created_at: now,
    updated_at: now,
    metadata,
  };

  // Cache in memory
  paymentCache.set(response.checkoutRequestId, record);

  return record;
}

/**
 * Update payment status from KCB response
 */
export function updatePaymentStatus(
  checkoutRequestId: string,
  status: PaymentStatus,
  receiptNumber?: string
): KCBPaymentRecord | undefined {
  const record = paymentCache.get(checkoutRequestId);
  if (!record) return undefined;

  const updated = {
    ...record,
    status: status.status as any,
    receipt_number: receiptNumber || status.receipt,
    updated_at: new Date().toISOString(),
  };

  paymentCache.set(checkoutRequestId, updated);
  return updated;
}

/**
 * Get payment record from cache
 */
export function getPaymentRecord(
  checkoutRequestId: string
): KCBPaymentRecord | undefined {
  return paymentCache.get(checkoutRequestId);
}

/**
 * Get all in-progress payments
 */
export function getInProgressPayments(): KCBPaymentRecord[] {
  return Array.from(paymentCache.values()).filter(p =>
    ['initiated', 'pending', 'checking'].includes(p.status)
  );
}

/**
 * Clear payment from cache (after final state)
 */
export function clearPaymentRecord(checkoutRequestId: string): void {
  paymentCache.delete(checkoutRequestId);
}

/**
 * Save payment record to IndexedDB for persistence
 */
export async function savePaymentRecord(
  record: KCBPaymentRecord
): Promise<void> {
  try {
    const { getDB } = await import('./db');
    const db = await getDB();

    // Try to save to IndexedDB if store exists
    try {
      await db.put(PAYMENT_RECORDS_STORE, record);
    } catch (e) {
      // Store might not exist yet - that's ok, we have it in memory
      console.debug('[v0] Payment record not persisted to IndexedDB (store may not exist yet)');
    }

    // Try to sync to Supabase
    const { getSupabase } = await import('./sync');
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { error } = await supabase.from('payment_transactions').upsert({
          id: record.id,
          merchant_request_id: record.merchant_request_id,
          checkout_request_id: record.checkout_request_id,
          phone_number: record.phone_number,
          amount: record.amount,
          invoice_number: record.invoice_number,
          status: record.status,
          receipt_number: record.receipt_number || null,
          created_at: record.created_at,
          updated_at: record.updated_at,
          metadata: record.metadata || null,
        });
        if (error) {
          console.warn('[v0] Failed to sync payment to Supabase:', error.message);
        }
      } catch (e) {
        console.warn('[v0] Payment sync error (non-critical):', e instanceof Error ? e.message : String(e));
      }
    }
  } catch (error) {
    console.error('[v0] Failed to save payment record:', error);
    throw error;
  }
}

/**
 * Load payment records from Supabase
 */
export async function loadPaymentRecords(
  limit: number = 50
): Promise<KCBPaymentRecord[]> {
  try {
    const { getSupabase } = await import('./sync');
    const supabase = getSupabase();

    if (!supabase) {
      console.warn('[v0] Supabase not configured, cannot load payment records');
      return [];
    }

    const { data, error } = await supabase
      .from('payment_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[v0] Failed to load payment records:', error.message);
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      merchant_request_id: row.merchant_request_id,
      checkout_request_id: row.checkout_request_id,
      phone_number: row.phone_number,
      amount: row.amount,
      invoice_number: row.invoice_number,
      status: row.status,
      receipt_number: row.receipt_number,
      created_at: row.created_at,
      updated_at: row.updated_at,
      metadata: row.metadata,
    }));
  } catch (error) {
    console.error('[v0] Error loading payment records:', error);
    return [];
  }
}

/**
 * Auto-save payment after STK Push
 */
export async function autoSavePayment(
  response: STKPushPayload,
  metadata?: Record<string, any>
): Promise<KCBPaymentRecord> {
  const record = createPaymentRecord(response, metadata);
  await savePaymentRecord(record);
  return record;
}

/**
 * Poll for payment completion with exponential backoff
 * @param merchantRequestId
 * @param checkoutRequestId
 * @param queryFn Async function to query payment status
 * @param options Polling options
 * @returns Final payment status or undefined if timed out
 */
export async function pollPaymentStatus(
  merchantRequestId: string,
  checkoutRequestId: string,
  queryFn: (merchantId: string, checkoutId: string) => Promise<PaymentStatus>,
  options: PaymentPollingOptions = {}
): Promise<PaymentStatus | undefined> {
  const {
    maxAttempts = 30, // 30 polls
    pollingInterval = 2000, // 2 seconds
    timeout = 120000, // 2 minutes total
  } = options;

  const startTime = Date.now();
  let attempt = 0;

  while (attempt < maxAttempts) {
    // Check timeout
    if (Date.now() - startTime > timeout) {
      console.warn('[v0] Payment polling timeout exceeded');
      return undefined;
    }

    try {
      const status = await queryFn(merchantRequestId, checkoutRequestId);

      // Update in-memory cache
      if (status) {
        updatePaymentStatus(checkoutRequestId, status);
        
        // Auto-save on state change
        const record = getPaymentRecord(checkoutRequestId);
        if (record) {
          await savePaymentRecord(record);
        }
      }

      // Return on final states
      if (status?.status && ['paid', 'failed', 'cancelled', 'timeout'].includes(status.status)) {
        return status;
      }

      // Wait before next poll (exponential backoff)
      const waitTime = Math.min(
        pollingInterval * Math.pow(1.1, attempt),
        10000 // Max 10 seconds between polls
      );
      await new Promise(resolve => setTimeout(resolve, waitTime));
    } catch (error) {
      console.error(`[v0] Payment status check failed (attempt ${attempt + 1}):`, error);
      // Continue polling on transient errors
      await new Promise(resolve => setTimeout(resolve, pollingInterval));
    }

    attempt++;
  }

  console.warn('[v0] Payment polling max attempts exceeded');
  return undefined;
}

/**
 * Get payment history for display/audit
 */
export async function getPaymentHistory(
  limit: number = 20
): Promise<KCBPaymentRecord[]> {
  try {
    return await loadPaymentRecords(limit);
  } catch (error) {
    console.error('[v0] Failed to get payment history:', error);
    return [];
  }
}

/**
 * Clear all cached payments (e.g., on logout)
 */
export function clearAllPayments(): void {
  paymentCache.clear();
}
