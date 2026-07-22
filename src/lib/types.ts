export type UserRole = 'admin' | 'manager' | 'cashier';

export interface PosUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  wholesale_price: number | null;
  stock_quantity: number;
  category: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
}

export type TransactionStatus = 'completed' | 'voided';
export type PaymentMethod = 'cash' | 'mpesa' | 'card';
export type SaleType = 'standard' | 'wholesale' | 'lipa_mdogo' | 'kyama';

export interface TransactionItem {
  id: string;
  transaction_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
}

export interface Transaction {
  id: string;
  customer_id: string | null;
  cashier_id: string | null;
  total_amount: number;
  amount_paid: number;
  change_due: number;
  payment_method: PaymentMethod;
  sale_type: SaleType;
  status: TransactionStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  transaction_items?: TransactionItem[];
  customer?: Customer | null;
}

export type VoidRequestStatus = 'pending' | 'approved' | 'rejected' | 'completed';

export interface VoidRequest {
  id: string;
  transaction_id: string;
  approval_request_id: string | null;
  requester_id: string | null;
  requester_name: string;
  requester_role: string;
  approver_id: string | null;
  approver_name: string | null;
  reason: string;
  status: VoidRequestStatus;
  transaction_total: number;
  transaction_payment_method: PaymentMethod;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  transaction?: Transaction | null;
}

export type ApprovalRequestStatus = 'pending' | 'approved' | 'rejected';

export interface ApprovalRequest {
  id: string;
  type: string;
  status: ApprovalRequestStatus;
  requester_id: string | null;
  requester_name: string;
  requester_role: string;
  approver_id: string | null;
  approver_name: string | null;
  notes: string | null;
  rejection_reason: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MpesaSettings {
  id: string;
  shortcode: string;
  passkey: string;
  consumer_key: string;
  consumer_secret: string;
  callback_url: string;
  environment: 'sandbox' | 'production';
  enabled: boolean;
  initiator_name: string;
  security_credential: string;
  updated_at: string;
}
