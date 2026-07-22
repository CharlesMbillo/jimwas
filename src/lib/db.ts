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
