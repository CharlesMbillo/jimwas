import { supabase } from './supabase';
import type {
  Product,
  Customer,
  Transaction,
  TransactionItem,
  VoidRequest,
  ApprovalRequest,
  PosUser,
  MpesaSettings,
} from './types';
import type { PaymentMethod, SaleType } from './types';

const MPESA_SETTINGS_ID = '00000000-0000-0000-0000-000000000001';

export async function getMpesaSettings(): Promise<MpesaSettings> {
  const { data, error } = await supabase
    .from('mpesa_settings')
    .select('*')
    .eq('id', MPESA_SETTINGS_ID)
    .maybeSingle();

  if (error) throw error;

  if (data) return data as MpesaSettings;

  const defaults = {
    id: MPESA_SETTINGS_ID,
    shortcode: '',
    passkey: '',
    consumer_key: '',
    consumer_secret: '',
    callback_url: '',
    environment: 'sandbox' as const,
    enabled: false,
    initiator_name: '',
    security_credential: '',
  };
  const { data: created, error: createError } = await supabase
    .from('mpesa_settings')
    .insert(defaults)
    .select()
    .single();

  if (createError) throw createError;
  return created as MpesaSettings;
}

export async function saveMpesaSettings(
  settings: Omit<MpesaSettings, 'id' | 'updated_at'>
): Promise<MpesaSettings> {
  const { data, error } = await supabase
    .from('mpesa_settings')
    .upsert({
      id: MPESA_SETTINGS_ID,
      ...settings,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data as MpesaSettings;
}

export async function getAllProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('active', true)
    .order('name');
  if (error) throw error;
  return data as Product[];
}

export async function createProduct(p: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> {
  const { data, error } = await supabase.from('products').insert(p).select().single();
  if (error) throw error;
  return data as Product;
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function getAllCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase.from('customers').select('*').order('name');
  if (error) throw error;
  return data as Customer[];
}

export async function createCustomer(c: Omit<Customer, 'id' | 'created_at'>): Promise<Customer> {
  const { data, error } = await supabase.from('customers').insert(c).select().single();
  if (error) throw error;
  return data as Customer;
}

export async function getAllTransactions(): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select(`*, transaction_items (*), customer:customers (*)`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as unknown as Transaction[];
}

export async function getTransactionById(id: string): Promise<Transaction | null> {
  const { data, error } = await supabase
    .from('transactions')
    .select(`*, transaction_items (*), customer:customers (*)`)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as Transaction | null;
}

export async function createTransaction(
  tx: {
    customer_id: string | null;
    cashier_id: string | null;
    total_amount: number;
    amount_paid: number;
    change_due: number;
    payment_method: PaymentMethod;
    sale_type: SaleType;
    status: string;
    notes?: string | null;
  },
  items: Omit<TransactionItem, 'id' | 'transaction_id' | 'created_at'>[]
): Promise<Transaction> {
  const { data: txData, error: txError } = await supabase
    .from('transactions')
    .insert(tx)
    .select()
    .single();
  if (txError) throw txError;

  const created = txData as Transaction;
  const itemsWithTx = items.map((item) => ({ ...item, transaction_id: created.id }));
  const { error: itemsError } = await supabase.from('transaction_items').insert(itemsWithTx);
  if (itemsError) throw itemsError;

  for (const item of items) {
    if (!item.product_id) continue;
    const { data: prod } = await supabase
      .from('products')
      .select('stock_quantity')
      .eq('id', item.product_id)
      .maybeSingle();
    if (prod) {
      const newQty = Math.max(0, (prod as Product).stock_quantity - item.quantity);
      await supabase
        .from('products')
        .update({ stock_quantity: newQty, updated_at: new Date().toISOString() })
        .eq('id', item.product_id);
    }
  }

  return created;
}

export async function voidTransactionRecord(transactionId: string): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({ status: 'voided', updated_at: new Date().toISOString() })
    .eq('id', transactionId);
  if (error) throw error;
}

export async function restoreStockForTransaction(transactionId: string): Promise<void> {
  const { data: items, error } = await supabase
    .from('transaction_items')
    .select('product_id, quantity')
    .eq('transaction_id', transactionId);
  if (error) throw error;

  for (const item of items as { product_id: string | null; quantity: number }[]) {
    if (!item.product_id) continue;
    const { data: prod } = await supabase
      .from('products')
      .select('stock_quantity')
      .eq('id', item.product_id)
      .maybeSingle();
    if (prod) {
      const newQty = (prod as Product).stock_quantity + item.quantity;
      await supabase
        .from('products')
        .update({ stock_quantity: newQty, updated_at: new Date().toISOString() })
        .eq('id', item.product_id);
    }
  }
}

export async function getAllVoidRequests(): Promise<VoidRequest[]> {
  const { data, error } = await supabase
    .from('void_requests')
    .select(`*, transaction:transactions (*, transaction_items (*))`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as unknown as VoidRequest[];
}

export async function getVoidRequestByTransaction(transactionId: string): Promise<VoidRequest | null> {
  const { data, error } = await supabase
    .from('void_requests')
    .select('*')
    .eq('transaction_id', transactionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as VoidRequest | null;
}

export async function getAllApprovalRequests(): Promise<ApprovalRequest[]> {
  const { data, error } = await supabase
    .from('approval_requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as ApprovalRequest[];
}

export async function saveVoidRequest(vr: Omit<VoidRequest, 'id' | 'created_at' | 'updated_at'>): Promise<VoidRequest> {
  const { data, error } = await supabase.from('void_requests').insert(vr).select().single();
  if (error) throw error;
  return data as VoidRequest;
}

export async function updateVoidRequest(id: string, updates: Partial<VoidRequest>): Promise<void> {
  const { error } = await supabase
    .from('void_requests')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function saveApprovalRequest(
  ar: Omit<ApprovalRequest, 'id' | 'created_at' | 'updated_at'>
): Promise<ApprovalRequest> {
  const { data, error } = await supabase.from('approval_requests').insert(ar).select().single();
  if (error) throw error;
  return data as ApprovalRequest;
}

export async function updateApprovalRequest(id: string, updates: Partial<ApprovalRequest>): Promise<void> {
  const { error } = await supabase
    .from('approval_requests')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function insertAuditLog(entry: {
  action: string;
  entity_type: string;
  entity_id?: string | null;
  actor_id?: string | null;
  actor_name?: string;
  details?: Record<string, unknown> | null;
}): Promise<void> {
  const { error } = await supabase.from('audit_log').insert({
    action: entry.action,
    entity_type: entry.entity_type,
    entity_id: entry.entity_id ?? null,
    actor_id: entry.actor_id ?? null,
    actor_name: entry.actor_name ?? null,
    details: entry.details ?? null,
  });
  if (error) throw error;
}

export async function getAllPosUsers(): Promise<PosUser[]> {
  const { data, error } = await supabase.from('pos_users').select('*').order('name');
  if (error) throw error;
  return data as PosUser[];
}

// KCB Payment Functions
export interface KCBPaymentTransaction {
  id?: string;
  checkout_request_id?: string;
  merchant_request_id?: string;
  phone_number: string;
  amount: number;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'cancelled' | 'timeout';
  customer_id?: string | null;
  cashier_id?: string | null;
  cashier_name?: string | null;
  receipt_number?: string | null;
  mpesa_receipt_number?: string | null;
  invoice_number?: string | null;
  message_id?: string | null;
  correlation_id?: string | null;
  kcb_error_code?: string | null;
  kcb_error_message?: string | null;
  kcb_status_code?: string | null;
  mpesa_response_description?: string | null;
  mpesa_request_id?: string | null;
  ipn_received?: boolean | null;
  description?: string | null;
  merchant_name?: string | null;
  retry_count?: number;
  should_poll?: boolean;
  request_payload?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

export interface KCBPaymentRecord {
  id: string;
  checkout_request_id: string;
  merchant_request_id: string;
  phone_number: string;
  amount: number;
  status: string;
  customer_id?: string | null;
  cashier_id?: string | null;
  cashier_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface KCBStatistics {
  total_transactions: number;
  total_amount: number;
  successful_transactions: number;
  failed_transactions: number;
  pending_transactions: number;
  average_transaction_amount: number;
  total_success?: number;
  total_amount_success?: number;
  total_failed?: number;
  totalTransactions?: number;
  totalRevenue?: number;
  successRate?: number;
}

export interface ExpenseCategoryRecord {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BackupData {
  products: Product[];
  customers: Customer[];
  transactions: Transaction[];
  users: PosUser[];
}

export interface LoginHistory {
  id: string;
  user_id: string;
  username: string;
  login_time: string;
  logout_time?: string | null;
  ip_address?: string | null;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  actor_id?: string | null;
  actor_name?: string | null;
  details?: Record<string, unknown> | null;
  created_at: string;
}

export interface PriceChangeHistory {
  id: string;
  product_id: string;
  old_price: number;
  new_price: number;
  changed_by: string;
  created_at: string;
}

// Utility Functions
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// KCB Payment Management
export async function saveKCBPaymentTransaction(
  tx: Omit<KCBPaymentTransaction, 'id' | 'created_at' | 'updated_at'>
): Promise<KCBPaymentTransaction> {
  const { data, error } = await supabase
    .from('kcb_transactions')
    .insert(tx)
    .select()
    .single();
  if (error) throw error;
  return data as KCBPaymentTransaction;
}

export async function updateKCBTransactionStatus(
  id: string,
  status: KCBPaymentTransaction['status'],
  updates?: Partial<KCBPaymentTransaction>
): Promise<void> {
  const { error } = await supabase
    .from('kcb_transactions')
    .update({ 
      status, 
      ...updates,
      updated_at: new Date().toISOString() 
    })
    .eq('id', id);
  if (error) throw error;
}

export async function getKCBPaymentTransaction(id: string): Promise<KCBPaymentTransaction | null> {
  const { data, error } = await supabase
    .from('kcb_transactions')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as KCBPaymentTransaction | null;
}

export async function markKCBTransactionComplete(id: string, receiptNumber: string): Promise<void> {
  const { error } = await supabase
    .from('kcb_transactions')
    .update({
      status: 'success',
      receipt_number: receiptNumber,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
}

export async function getAllKCBTransactions(limit?: number): Promise<KCBPaymentTransaction[]> {
  let query = supabase
    .from('kcb_transactions')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (limit) {
    query = query.limit(limit);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data as KCBPaymentTransaction[];
}

export async function getAllKCBPayments(): Promise<KCBPaymentRecord[]> {
  const { data, error } = await supabase
    .from('kcb_transactions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as KCBPaymentRecord[];
}

export async function getKCBPaymentsByStatus(status: string): Promise<KCBPaymentRecord[]> {
  const { data, error } = await supabase
    .from('kcb_transactions')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as KCBPaymentRecord[];
}

export async function getKCBPaymentStats(): Promise<KCBStatistics> {
  const { data, error } = await supabase.from('kcb_transactions').select('*');
  if (error) throw error;

  const transactions = data as KCBPaymentTransaction[];
  const successful = transactions.filter((t) => t.status === 'success').length;
  const failed = transactions.filter((t) => t.status === 'failed').length;
  const pending = transactions.filter((t) => t.status === 'pending').length;
  const total = transactions.length;
  const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);

  return {
    total_transactions: total,
    total_amount: totalAmount,
    successful_transactions: successful,
    failed_transactions: failed,
    pending_transactions: pending,
    average_transaction_amount: total > 0 ? totalAmount / total : 0,
  };
}

export async function getKCBStatistics(sinceDate?: Date): Promise<KCBStatistics> {
  let query = supabase.from('kcb_transactions').select('*');
  
  if (sinceDate) {
    query = query.gte('created_at', sinceDate.toISOString());
  }
  
  const { data, error } = await query;
  if (error) throw error;

  const transactions = data as KCBPaymentTransaction[];
  const successful = transactions.filter((t) => t.status === 'success').length;
  const failed = transactions.filter((t) => t.status === 'failed').length;
  const pending = transactions.filter((t) => t.status === 'pending').length;
  const total = transactions.length;
  const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);

  return {
    total_transactions: total,
    total_amount: totalAmount,
    successful_transactions: successful,
    failed_transactions: failed,
    pending_transactions: pending,
    average_transaction_amount: total > 0 ? totalAmount / total : 0,
  };
}

// Audit Log Functions
export async function saveAuditLog(entry: Omit<AuditLogEntry, 'id' | 'created_at'>): Promise<AuditLogEntry> {
  const { data, error } = await supabase
    .from('audit_log')
    .insert(entry)
    .select()
    .single();
  if (error) throw error;
  return data as AuditLogEntry;
}

export async function getAllAuditLogs(): Promise<AuditLogEntry[]> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as AuditLogEntry[];
}

export async function getAuditLogsByActor(actorId: string): Promise<AuditLogEntry[]> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('actor_id', actorId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as AuditLogEntry[];
}

// User Management
export async function saveUser(user: Omit<PosUser, 'id' | 'created_at'>): Promise<PosUser> {
  const { data, error } = await supabase
    .from('pos_users')
    .insert(user)
    .select()
    .single();
  if (error) throw error;
  return data as PosUser;
}

export async function getUserByUsername(name: string): Promise<PosUser | null> {
  const { data, error } = await supabase
    .from('pos_users')
    .select('*')
    .eq('name', name)
    .maybeSingle();
  if (error) throw error;
  return data as PosUser | null;
}

export async function getUser(id: string): Promise<PosUser | null> {
  const { data, error } = await supabase
    .from('pos_users')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as PosUser | null;
}

// Price History
export async function savePriceChangeHistory(
  change: Omit<PriceChangeHistory, 'id' | 'created_at'>
): Promise<PriceChangeHistory> {
  const { data, error } = await supabase
    .from('price_change_history')
    .insert(change)
    .select()
    .single();
  if (error) throw error;
  return data as PriceChangeHistory;
}

export async function getPriceChangeHistory(productId: string): Promise<PriceChangeHistory[]> {
  const { data, error } = await supabase
    .from('price_change_history')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as PriceChangeHistory[];
}

// Login History
export async function saveLoginHistory(entry: Omit<LoginHistory, 'id'>): Promise<LoginHistory> {
  const { data, error } = await supabase
    .from('login_history')
    .insert(entry)
    .select()
    .single();
  if (error) throw error;
  return data as LoginHistory;
}

export async function getLoginHistoryByUser(userId: string): Promise<LoginHistory[]> {
  const { data, error } = await supabase
    .from('login_history')
    .select('*')
    .eq('user_id', userId)
    .order('login_time', { ascending: false });
  if (error) throw error;
  return data as LoginHistory[];
}

export async function getAllLoginHistory(): Promise<LoginHistory[]> {
  const { data, error } = await supabase
    .from('login_history')
    .select('*')
    .order('login_time', { ascending: false });
  if (error) throw error;
  return data as LoginHistory[];
}

// Backup/Restore Functions
export async function backupDatabase(): Promise<BackupData> {
  const [products, customers, transactions, users] = await Promise.all([
    getAllProducts(),
    getAllCustomers(),
    getAllTransactions(),
    getAllPosUsers(),
  ]);

  return { products, customers, transactions, users };
}

export async function restoreFromBackup(backup: BackupData): Promise<void> {
  // Implementation would restore from backup data
  console.log('Restore from backup:', backup);
}

// Expense Category Functions
export async function getAllExpenseCategories(): Promise<ExpenseCategoryRecord[]> {
  const { data, error } = await supabase
    .from('expense_categories')
    .select('*')
    .order('name');
  if (error) throw error;
  return data as ExpenseCategoryRecord[];
}

export async function createExpenseCategory(
  category: Omit<ExpenseCategoryRecord, 'id' | 'created_at' | 'updated_at'>
): Promise<ExpenseCategoryRecord> {
  const { data, error } = await supabase
    .from('expense_categories')
    .insert(category)
    .select()
    .single();
  if (error) throw error;
  return data as ExpenseCategoryRecord;
}
