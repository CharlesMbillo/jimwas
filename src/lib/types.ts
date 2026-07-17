export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  loyalty_points: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
  sync_status: 'pending' | 'synced';
}

export interface Product {
  id: string;
  name: string;
  sku?: string;
  price: number;
  cost: number;
  stock: number;
  category?: string;
  image_url?: string;
  low_stock_alert?: number;
  barcode?: string;
  tax_category?: 'exempt' | 'standard_16';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  sync_status: 'pending' | 'synced';
  local_id?: string;
}

export interface TransactionItem {
  id: string;
  transaction_id?: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Transaction {
  id: string;
  customer_id?: string;
  total_amount: number;
  amount_paid: number;
  change_amount: number;
  payment_method: string;
  status: string;
  notes?: string;
  created_at: string;
  sync_status: 'pending' | 'synced';
  items: TransactionItem[];
  sale_type?: 'standard' | 'wholesale' | 'lipa_mdogo' | 'kyama';
  deposit_amount?: number;
  balance_amount?: number;
}

export interface InstallmentPlan {
  id: string;
  customer_id: string;
  product_id: string;
  product_name: string;
  total_amount: number;
  amount_paid: number;
  installment_count: number;
  status: 'active' | 'completed' | 'cancelled';
  product_released: boolean;
  release_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  sync_status: 'pending' | 'synced';
}

export interface InstallmentPayment {
  id: string;
  plan_id: string;
  amount: number;
  payment_method: string;
  notes?: string;
  created_at: string;
  sync_status: 'pending' | 'synced';
}

export interface LoyaltyTransaction {
  id: string;
  customer_id: string;
  points: number;
  transaction_type: 'earned' | 'redeemed';
  source: string;
  reference_id?: string;
  created_at: string;
  sync_status: 'pending' | 'synced';
}

export interface CartItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface StockMovement {
  id: string;
  product_id: string;
  qty_delta: number;
  reason: 'sale' | 'return' | 'restock' | 'adjustment' | 'initial' | 'transfer_in' | 'transfer_out';
  note?: string;
  balance_after: number;
  reference_type?: 'sale' | 'delivery' | 'adjustment' | 'transfer';
  reference_id?: string;
  branch_id?: string;
  created_at: string;
  created_by: string;
  sync_status: 'pending' | 'synced';
  local_id?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  sync_status: 'pending' | 'synced';
}

export interface Delivery {
  id: string;
  supplier_id?: string;
  delivery_note_number?: string;
  status: 'pending' | 'received' | 'cancelled';
  total_items: number;
  total_value: number;
  notes?: string;
  received_by?: string;
  received_at?: string;
  created_at: string;
  updated_at: string;
  sync_status: 'pending' | 'synced';
}

export interface DeliveryItem {
  id: string;
  delivery_id: string;
  product_id: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  sync_status: 'pending' | 'synced';
}

export interface StockAdjustment {
  id: string;
  product_id: string;
  previous_stock: number;
  new_stock: number;
  reason: string;
  note?: string;
  created_by: string;
  created_at: string;
  sync_status: 'pending' | 'synced';
  local_id?: string;
}

// Payment system types
export type PaymentMethodCode = 'cash' | 'card' | 'mpesa' | 'kcb';

export interface PaymentMethod {
  id: string;
  code: PaymentMethodCode;
  label: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaymentTransaction {
  id: string;
  transaction_id: string;
  payment_method_code: PaymentMethodCode;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  reference_number?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface KCBTransaction {
  id: string;
  payment_transaction_id?: string;
  checkout_request_id?: string;
  merchant_request_id?: string;
  phone_number: string;
  amount: number;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'cancelled' | 'timeout';
  result_code?: string;
  result_desc?: string;
  kcb_receipt_number?: string;
  transaction_date?: string;
  customer_id?: string;
  cashier_id?: string;
  cashier_name?: string;
  callback_received: boolean;
  callback_payload?: any;
  created_at: string;
  updated_at: string;
}

export interface CashTransaction {
  id: string;
  payment_transaction_id: string;
  amount_paid: number;
  change_amount: number;
  cashier_id?: string;
  cashier_name?: string;
  created_at: string;
}

export interface CardTransaction {
  id: string;
  payment_transaction_id: string;
  card_last_four?: string;
  card_brand?: string;
  auth_code?: string;
  terminal_id?: string;
  cashier_id?: string;
  cashier_name?: string;
  created_at: string;
}

// Support tables
export interface Branch {
  id: string;
  name: string;
  location?: string;
  address?: string;
  phone?: string;
  email?: string;
  manager_name?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  branch_id?: string;
  name: string;
  email?: string;
  phone?: string;
  role: 'cashier' | 'supervisor' | 'manager' | 'admin';
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  parent_category_id?: string;
  display_order?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Receipt {
  id: string;
  transaction_id: string;
  receipt_number: string;
  receipt_type: 'standard' | 'refund' | 'adjustment' | 'replacement';
  print_count: number;
  last_printed_at?: string;
  email_sent_to?: string;
  email_sent_at?: string;
  qr_code_url?: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  old_values?: any;
  new_values?: any;
  changes?: string;
  ip_address?: string;
  user_agent?: string;
  branch_id?: string;
  created_at: string;
}

export interface AppSetting {
  id: string;
  branch_id?: string;
  setting_key: string;
  setting_value?: any;
  data_type: 'string' | 'number' | 'boolean' | 'json' | 'array';
  is_sensitive: boolean;
  last_modified_by?: string;
  created_at: string;
  updated_at: string;
}

export interface InventorySnapshot {
  id: string;
  snapshot_date: string;
  product_id: string;
  quantity_on_hand?: number;
  reorder_level?: number;
  reorder_quantity?: number;
  branch_id?: string;
  created_at: string;
}

export interface SalesTarget {
  id: string;
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  period_start?: string;
  period_end?: string;
  target_amount?: number;
  target_units?: number;
  category_id?: string;
  branch_id?: string;
  created_at: string;
  updated_at: string;
}
