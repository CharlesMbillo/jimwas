/**
 * Payment Operations Module
 * Handles payment creation, updates, and queries across different payment methods
 */

import { supabase } from '@/lib/init';
import type {
  PaymentTransaction,
  KCBTransaction,
  CashTransaction,
  CardTransaction,
  PaymentMethodCode,
} from '@/lib/types';

/**
 * Create a payment transaction record
 */
export async function createPaymentTransaction(
  transactionId: string,
  paymentMethodCode: PaymentMethodCode,
  amount: number,
  referenceNumber?: string,
  notes?: string
): Promise<PaymentTransaction | null> {
  try {
    const { data, error } = await supabase
      .from('payment_transactions')
      .insert({
        transaction_id: transactionId,
        payment_method_code: paymentMethodCode,
        amount,
        reference_number: referenceNumber,
        notes,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return data as PaymentTransaction;
  } catch (error) {
    console.error('[v0] Error creating payment transaction:', error);
    return null;
  }
}

/**
 * Update payment transaction status
 */
export async function updatePaymentStatus(
  paymentId: string,
  status: PaymentTransaction['status']
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('payment_transactions')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', paymentId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[v0] Error updating payment status:', error);
    return false;
  }
}

/**
 * Create a KCB STK Push transaction
 */
export async function createKCBTransaction(
  paymentTransactionId: string,
  phoneNumber: string,
  amount: number,
  checkoutRequestId?: string,
  merchantRequestId?: string,
  customerId?: string,
  cashierName?: string
): Promise<KCBTransaction | null> {
  try {
    const { data, error } = await supabase
      .from('kcb_transactions')
      .insert({
        payment_transaction_id: paymentTransactionId,
        phone_number: phoneNumber,
        amount,
        checkout_request_id: checkoutRequestId,
        merchant_request_id: merchantRequestId,
        customer_id: customerId,
        cashier_name: cashierName,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return data as KCBTransaction;
  } catch (error) {
    console.error('[v0] Error creating KCB transaction:', error);
    return null;
  }
}

/**
 * Update KCB transaction status
 */
export async function updateKCBTransactionStatus(
  kcbTransactionId: string,
  status: KCBTransaction['status'],
  resultCode?: string,
  resultDesc?: string,
  receiptNumber?: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('kcb_transactions')
      .update({
        status,
        result_code: resultCode,
        result_desc: resultDesc,
        kcb_receipt_number: receiptNumber,
        updated_at: new Date().toISOString(),
      })
      .eq('id', kcbTransactionId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[v0] Error updating KCB transaction:', error);
    return false;
  }
}

/**
 * Create a cash payment record
 */
export async function createCashTransaction(
  paymentTransactionId: string,
  amountPaid: number,
  changeAmount: number,
  cashierName?: string
): Promise<CashTransaction | null> {
  try {
    const { data, error } = await supabase
      .from('cash_transactions')
      .insert({
        payment_transaction_id: paymentTransactionId,
        amount_paid: amountPaid,
        change_amount: changeAmount,
        cashier_name: cashierName,
      })
      .select()
      .single();

    if (error) throw error;
    return data as CashTransaction;
  } catch (error) {
    console.error('[v0] Error creating cash transaction:', error);
    return null;
  }
}

/**
 * Create a card payment record
 */
export async function createCardTransaction(
  paymentTransactionId: string,
  cardLastFour?: string,
  cardBrand?: string,
  authCode?: string,
  terminalId?: string,
  cashierName?: string
): Promise<CardTransaction | null> {
  try {
    const { data, error } = await supabase
      .from('card_transactions')
      .insert({
        payment_transaction_id: paymentTransactionId,
        card_last_four: cardLastFour,
        card_brand: cardBrand,
        auth_code: authCode,
        terminal_id: terminalId,
        cashier_name: cashierName,
      })
      .select()
      .single();

    if (error) throw error;
    return data as CardTransaction;
  } catch (error) {
    console.error('[v0] Error creating card transaction:', error);
    return null;
  }
}

/**
 * Get payment transaction by ID
 */
export async function getPaymentTransaction(
  paymentId: string
): Promise<PaymentTransaction | null> {
  try {
    const { data, error } = await supabase
      .from('payment_transactions')
      .select()
      .eq('id', paymentId)
      .single();

    if (error) throw error;
    return data as PaymentTransaction;
  } catch (error) {
    console.error('[v0] Error fetching payment transaction:', error);
    return null;
  }
}

/**
 * Get all payment transactions for a sale (transaction)
 */
export async function getTransactionPayments(
  transactionId: string
): Promise<PaymentTransaction[]> {
  try {
    const { data, error } = await supabase
      .from('payment_transactions')
      .select()
      .eq('transaction_id', transactionId);

    if (error) throw error;
    return (data || []) as PaymentTransaction[];
  } catch (error) {
    console.error('[v0] Error fetching transaction payments:', error);
    return [];
  }
}

/**
 * Get KCB transaction by checkout request ID
 */
export async function getKCBTransactionByCheckoutId(
  checkoutRequestId: string
): Promise<KCBTransaction | null> {
  try {
    const { data, error } = await supabase
      .from('kcb_transactions')
      .select()
      .eq('checkout_request_id', checkoutRequestId)
      .single();

    if (error) throw error;
    return data as KCBTransaction;
  } catch (error) {
    console.error('[v0] Error fetching KCB transaction:', error);
    return null;
  }
}

/**
 * Get payment method details
 */
export async function getPaymentMethod(
  code: PaymentMethodCode
): Promise<{ id: string; label: string; description?: string } | null> {
  try {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('id, label, description')
      .eq('code', code)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[v0] Error fetching payment method:', error);
    return null;
  }
}

/**
 * Get all active payment methods
 */
export async function getActivePaymentMethods() {
  try {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('id, code, label, description')
      .eq('is_active', true)
      .order('label');

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[v0] Error fetching payment methods:', error);
    return [];
  }
}
