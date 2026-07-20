/**
 * Audit Logging Module
 * Tracks all critical POS operations for compliance and troubleshooting
 */

import { supabase } from '@/lib/init';
import type { AuditLog } from '@/lib/types';

export interface AuditLogEntry {
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  old_values?: any;
  new_values?: any;
  changes?: string;
  branch_id?: string;
}

/**
 * Log an audit event to the database
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<AuditLog | null> {
  try {
    // Get IP address and user agent from browser context
    const ipAddress = await getClientIpAddress();
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : undefined;

    const { data, error } = await supabase
      .from('audit_logs')
      .insert({
        ...entry,
        ip_address: ipAddress,
        user_agent: userAgent,
      })
      .select()
      .single();

    if (error) throw error;
    return data as AuditLog;
  } catch (error) {
    console.error('[v0] Error logging audit event:', error);
    return null;
  }
}

/**
 * Log a sale transaction
 */
export async function auditSale(
  transactionId: string,
  customerId: string | undefined,
  amount: number,
  paymentMethod: string,
  userId?: string,
  branchId?: string
): Promise<void> {
  await logAuditEvent({
    user_id: userId,
    action: 'sale',
    entity_type: 'transaction',
    entity_id: transactionId,
    new_values: {
      customer_id: customerId,
      amount,
      payment_method: paymentMethod,
      timestamp: new Date().toISOString(),
    },
    changes: `Sale completed: ${paymentMethod} payment of KES ${amount}`,
    branch_id: branchId,
  });
}

/**
 * Log a refund/return
 */
export async function auditRefund(
  originalTransactionId: string,
  refundAmount: number,
  reason: string,
  userId?: string,
  branchId?: string
): Promise<void> {
  await logAuditEvent({
    user_id: userId,
    action: 'refund',
    entity_type: 'transaction',
    entity_id: originalTransactionId,
    new_values: {
      refund_amount: refundAmount,
      reason,
      timestamp: new Date().toISOString(),
    },
    changes: `Refund processed: KES ${refundAmount} - ${reason}`,
    branch_id: branchId,
  });
}

/**
 * Log a transaction void
 */
export async function auditVoid(
  transactionId: string,
  reason: string,
  userId?: string,
  branchId?: string
): Promise<void> {
  await logAuditEvent({
    user_id: userId,
    action: 'void',
    entity_type: 'transaction',
    entity_id: transactionId,
    new_values: {
      reason,
      voided_at: new Date().toISOString(),
    },
    changes: `Transaction voided - ${reason}`,
    branch_id: branchId,
  });
}

/**
 * Log a price change
 */
export async function auditPriceChange(
  productId: string,
  oldPrice: number,
  newPrice: number,
  reason: string,
  userId?: string,
  branchId?: string
): Promise<void> {
  await logAuditEvent({
    user_id: userId,
    action: 'price_change',
    entity_type: 'product',
    entity_id: productId,
    old_values: { price: oldPrice },
    new_values: { price: newPrice },
    changes: `Price changed from KES ${oldPrice} to KES ${newPrice} - ${reason}`,
    branch_id: branchId,
  });
}

/**
 * Log a stock adjustment
 */
export async function auditStockAdjustment(
  productId: string,
  previousStock: number,
  newStock: number,
  reason: string,
  userId?: string,
  branchId?: string
): Promise<void> {
  await logAuditEvent({
    user_id: userId,
    action: 'stock_adjust',
    entity_type: 'product',
    entity_id: productId,
    old_values: { stock: previousStock },
    new_values: { stock: newStock },
    changes: `Stock adjusted from ${previousStock} to ${newStock} units - ${reason}`,
    branch_id: branchId,
  });
}

/**
 * Log user login
 */
export async function auditUserLogin(userId: string, branchId?: string): Promise<void> {
  await logAuditEvent({
    user_id: userId,
    action: 'user_login',
    entity_type: 'user',
    entity_id: userId,
    changes: `User logged in`,
    branch_id: branchId,
  });
}

/**
 * Log user logout
 */
export async function auditUserLogout(userId: string, sessionDurationSeconds: number, branchId?: string): Promise<void> {
  await logAuditEvent({
    user_id: userId,
    action: 'user_logout',
    entity_type: 'user',
    entity_id: userId,
    new_values: { session_duration_seconds: sessionDurationSeconds },
    changes: `User logged out after ${Math.round(sessionDurationSeconds / 60)} minutes`,
    branch_id: branchId,
  });
}

/**
 * Log KCB payment initiated
 */
export async function auditKCBPaymentInitiated(
  transactionId: string,
  amount: number,
  phoneNumber: string,
  userId?: string,
  branchId?: string
): Promise<void> {
  await logAuditEvent({
    user_id: userId,
    action: 'kcb_payment_initiated',
    entity_type: 'transaction',
    entity_id: transactionId,
    new_values: {
      amount,
      phone_number: phoneNumber,
      initiated_at: new Date().toISOString(),
    },
    changes: `KCB STK Push payment initiated for KES ${amount}`,
    branch_id: branchId,
  });
}

/**
 * Log KCB payment completed
 */
export async function auditKCBPaymentCompleted(
  transactionId: string,
  amount: number,
  receiptNumber: string,
  userId?: string,
  branchId?: string
): Promise<void> {
  await logAuditEvent({
    user_id: userId,
    action: 'kcb_payment_completed',
    entity_type: 'transaction',
    entity_id: transactionId,
    new_values: {
      amount,
      receipt_number: receiptNumber,
      completed_at: new Date().toISOString(),
    },
    changes: `KCB payment completed - Receipt: ${receiptNumber}`,
    branch_id: branchId,
  });
}

/**
 * Log KCB payment failed
 */
export async function auditKCBPaymentFailed(
  transactionId: string,
  amount: number,
  errorReason: string,
  userId?: string,
  branchId?: string
): Promise<void> {
  await logAuditEvent({
    user_id: userId,
    action: 'kcb_payment_failed',
    entity_type: 'transaction',
    entity_id: transactionId,
    new_values: {
      amount,
      error_reason: errorReason,
      failed_at: new Date().toISOString(),
    },
    changes: `KCB payment failed - ${errorReason}`,
    branch_id: branchId,
  });
}

/**
 * Get audit logs for an entity
 */
export async function getAuditLogsForEntity(
  entityType: string,
  entityId: string,
  limit: number = 50
): Promise<AuditLog[]> {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select()
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as AuditLog[];
  } catch (error) {
    console.error('[v0] Error fetching audit logs:', error);
    return [];
  }
}

/**
 * Get audit logs for a user
 */
export async function getAuditLogsForUser(
  userId: string,
  limit: number = 100,
  daysBack: number = 30
): Promise<AuditLog[]> {
  try {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);

    const { data, error } = await supabase
      .from('audit_logs')
      .select()
      .eq('user_id', userId)
      .gte('created_at', fromDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as AuditLog[];
  } catch (error) {
    console.error('[v0] Error fetching user audit logs:', error);
    return [];
  }
}

/**
 * Get client IP address (browser context)
 */
async function getClientIpAddress(): Promise<string | undefined> {
  try {
    // Try to get IP from a public API (fallback method)
    if (typeof window === 'undefined') return undefined;

    const response = await fetch('https://api.ipify.org?format=json', { 
      cache: 'no-store'
    });
    if (!response.ok) throw new Error('Failed to fetch IP');
    const data = await response.json();
    return data.ip;
  } catch {
    // If we can't determine IP, that's okay - it's optional
    return undefined;
  }
}
