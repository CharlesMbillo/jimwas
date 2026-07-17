# Jimwas POS - Database Schema Documentation

## Overview

The Jimwas POS system uses a normalized relational database structure with clear entity relationships for managing sales, payments, inventory, and business operations.

## Core Tables

### 1. Customers
Stores customer information and loyalty tracking.

```sql
customers (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE,
  email TEXT,
  loyalty_points INTEGER,
  total_spent DECIMAL,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

**Relationships:**
- `1:N` with `transactions` (One customer can have many transactions)
- `1:N` with `installment_plans` (One customer can have many installment plans)
- `1:N` with `loyalty_transactions` (One customer earns many loyalty points)

---

### 2. Products
Stores product/inventory items with pricing and stock information.

```sql
products (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  price DECIMAL NOT NULL,
  cost DECIMAL,
  stock INTEGER,
  category_id UUID REFERENCES product_categories,
  image_url TEXT,
  barcode TEXT,
  tax_category TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

**Relationships:**
- `N:1` with `product_categories` (Many products in one category)
- `1:N` with `transaction_items` (One product sold in many transactions)
- `1:N` with `stock_movements` (One product has many stock movements)
- `1:N` with `deliveries` (One product received in many deliveries)

---

### 3. Product Categories
Hierarchical product categorization.

```sql
product_categories (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  parent_category_id UUID REFERENCES product_categories,
  display_order INTEGER,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ
)
```

**Relationships:**
- `N:1` self-referencing (Child categories linked to parent categories)
- `1:N` with `products` (One category has many products)

---

### 4. Transactions (Sales)
Main sales transaction records.

```sql
transactions (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers,
  total_amount DECIMAL NOT NULL,
  amount_paid DECIMAL NOT NULL,
  change_amount DECIMAL,
  payment_method TEXT,
  status TEXT,
  sale_type TEXT, -- 'standard', 'wholesale', 'lipa_mdogo', 'kyama'
  notes TEXT,
  created_at TIMESTAMPTZ,
  sync_status TEXT
)
```

**Relationships:**
- `N:1` with `customers` (Many transactions from one customer)
- `1:N` with `transaction_items` (One transaction contains many items)
- `1:N` with `payment_transactions` (One transaction can have multiple payment records)
- `1:1` with `receipts` (One transaction generates one receipt)

---

### 5. Transaction Items (Sale Details)
Line items within each transaction.

```sql
transaction_items (
  id UUID PRIMARY KEY,
  transaction_id UUID REFERENCES transactions ON DELETE CASCADE,
  product_id UUID REFERENCES products,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL NOT NULL,
  subtotal DECIMAL NOT NULL,
  created_at TIMESTAMPTZ
)
```

**Relationships:**
- `N:1` with `transactions` (Many items in one transaction)
- `N:1` with `products` (Many transaction items reference one product)

---

## Payment System

### 6. Payment Methods (Reference Table)
Enumeration of available payment methods.

```sql
payment_methods (
  id UUID PRIMARY KEY,
  code TEXT UNIQUE, -- 'cash', 'card', 'mpesa', 'kcb'
  label TEXT,
  description TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ
)
```

**Payment Method Codes:**
- `cash` - Physical cash payment
- `card` - Debit/credit card payment
- `mpesa` - M-Pesa mobile money payment
- `kcb` - KCB STK Push (BUNI) payment

---

### 7. Payment Transactions (Normalized)
Main payment record linking to specific payment methods.

```sql
payment_transactions (
  id UUID PRIMARY KEY,
  transaction_id UUID REFERENCES transactions ON DELETE CASCADE,
  payment_method_code TEXT REFERENCES payment_methods(code),
  amount DECIMAL NOT NULL,
  status TEXT, -- 'pending', 'processing', 'completed', 'failed', 'cancelled'
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

**Relationships:**
- `N:1` with `transactions` (One transaction can have multiple payments)
- `1:1` or `1:N` with specific payment type tables (KCB, Cash, Card)

---

### 8. KCB Transactions (KCB STK Push)
Detailed KCB payment records.

```sql
kcb_transactions (
  id UUID PRIMARY KEY,
  payment_transaction_id UUID REFERENCES payment_transactions ON DELETE CASCADE,
  checkout_request_id TEXT UNIQUE,
  merchant_request_id TEXT,
  phone_number TEXT NOT NULL,
  amount DECIMAL NOT NULL,
  status TEXT, -- 'pending', 'processing', 'success', 'failed', 'cancelled', 'timeout'
  result_code TEXT,
  result_desc TEXT,
  kcb_receipt_number TEXT,
  transaction_date TEXT,
  customer_id UUID REFERENCES customers,
  cashier_id UUID REFERENCES users,
  callback_received BOOLEAN,
  callback_payload JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

**Relationships:**
- `N:1` with `payment_transactions` (Many KCB transactions per payment)
- `N:1` with `customers` (Many KCB transactions from one customer)
- `N:1` with `users` (Many transactions processed by one cashier)

---

### 9. Cash Transactions
Cash payment details.

```sql
cash_transactions (
  id UUID PRIMARY KEY,
  payment_transaction_id UUID REFERENCES payment_transactions ON DELETE CASCADE,
  amount_paid DECIMAL NOT NULL,
  change_amount DECIMAL,
  cashier_id UUID REFERENCES users,
  cashier_name TEXT,
  created_at TIMESTAMPTZ
)
```

---

### 10. Card Transactions
Card payment details.

```sql
card_transactions (
  id UUID PRIMARY KEY,
  payment_transaction_id UUID REFERENCES payment_transactions ON DELETE CASCADE,
  card_last_four TEXT,
  card_brand TEXT,
  auth_code TEXT,
  terminal_id TEXT,
  cashier_id UUID REFERENCES users,
  cashier_name TEXT,
  created_at TIMESTAMPTZ
)
```

---

## Installment System

### 11. Installment Plans
"Lipa Mdogo Mdogo" layaway/installment plans.

```sql
installment_plans (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers NOT NULL,
  product_id UUID REFERENCES products NOT NULL,
  product_name TEXT,
  total_amount DECIMAL NOT NULL,
  amount_paid DECIMAL,
  installment_count INTEGER,
  status TEXT, -- 'active', 'completed', 'cancelled'
  product_released BOOLEAN,
  release_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

**Relationships:**
- `N:1` with `customers` (One customer has many installment plans)
- `N:1` with `products` (Many plans for one product)
- `1:N` with `installment_payments` (One plan has many payments)

---

### 12. Installment Payments
Individual payments towards installment plans.

```sql
installment_payments (
  id UUID PRIMARY KEY,
  plan_id UUID REFERENCES installment_plans ON DELETE CASCADE,
  amount DECIMAL NOT NULL,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ
)
```

---

## Loyalty System

### 13. Loyalty Transactions
Loyalty points tracking.

```sql
loyalty_transactions (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers NOT NULL,
  points INTEGER,
  transaction_type TEXT, -- 'earned', 'redeemed'
  source TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ
)
```

---

## Inventory Management

### 14. Stock Movements
Detailed inventory transaction history.

```sql
stock_movements (
  id UUID PRIMARY KEY,
  product_id UUID REFERENCES products,
  qty_delta INTEGER,
  reason TEXT, -- 'sale', 'return', 'restock', 'adjustment', 'transfer_in', 'transfer_out'
  balance_after INTEGER,
  reference_type TEXT,
  reference_id UUID,
  branch_id UUID REFERENCES branches,
  created_at TIMESTAMPTZ,
  created_by TEXT
)
```

---

### 15. Inventory Snapshots
Historical inventory levels by date.

```sql
inventory_snapshots (
  id UUID PRIMARY KEY,
  snapshot_date DATE,
  product_id UUID REFERENCES products,
  quantity_on_hand INTEGER,
  reorder_level INTEGER,
  branch_id UUID REFERENCES branches,
  created_at TIMESTAMPTZ
)
```

---

## Operational Tables

### 16. Branches
Multi-branch support.

```sql
branches (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  manager_name TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ
)
```

**Relationships:**
- `1:N` with `users` (One branch has many staff)
- `1:N` with `stock_movements` (One branch has many inventory movements)

---

### 17. Users (Staff/Cashiers)
User management and role-based access.

```sql
users (
  id UUID PRIMARY KEY,
  branch_id UUID REFERENCES branches,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  role TEXT, -- 'cashier', 'supervisor', 'manager', 'admin'
  is_active BOOLEAN,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
```

**Relationships:**
- `N:1` with `branches` (Many users work at one branch)
- `1:N` with `audit_logs` (One user creates many audit logs)

---

### 18. Receipts
Digital receipt tracking.

```sql
receipts (
  id UUID PRIMARY KEY,
  transaction_id UUID REFERENCES transactions ON DELETE CASCADE,
  receipt_number TEXT UNIQUE,
  receipt_type TEXT, -- 'standard', 'refund', 'adjustment', 'replacement'
  print_count INTEGER,
  last_printed_at TIMESTAMPTZ,
  email_sent_to TEXT,
  qr_code_url TEXT,
  created_at TIMESTAMPTZ
)
```

---

### 19. Audit Logs
Complete audit trail of all critical operations.

```sql
audit_logs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users,
  action TEXT, -- 'sale', 'refund', 'void', 'price_change', 'stock_adjust', 'login', etc.
  entity_type TEXT, -- 'transaction', 'product', 'user', 'customer'
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  changes TEXT,
  ip_address INET,
  user_agent TEXT,
  branch_id UUID REFERENCES branches,
  created_at TIMESTAMPTZ
)
```

---

## Complete Data Flow Diagram

```
Customer
    ↓
    └─→ Transactions (Sales)
            ↓
            ├─→ Transaction Items (products sold)
            │       ↓
            │       └─→ Products (inventory)
            │               ↓
            │               └─→ Stock Movements (history)
            │
            ├─→ Payment Transactions (payment record)
            │       ↓
            │       ├─→ Cash Transactions (cash details)
            │       ├─→ Card Transactions (card details)
            │       └─→ KCB Transactions (KCB details)
            │
            ├─→ Receipts (digital record)
            │
            └─→ Audit Logs (for compliance)

Installment Plans (Lipa Mdogo Mdogo)
    ↓
    ├─→ Customer
    ├─→ Product
    └─→ Installment Payments

Loyalty System
    ↓
    └─→ Loyalty Transactions (points tracking)
```

## Key Design Principles

1. **Normalization**: Data is structured to eliminate redundancy and maintain data integrity.
2. **Relationships**: Foreign keys establish clear relationships between entities.
3. **Audit Trail**: All critical operations are logged for compliance and troubleshooting.
4. **Payment Flexibility**: Multiple payment methods supported with type-specific detail tables.
5. **Multi-Branch Support**: Tables include branch_id for multi-location operations.
6. **Historical Tracking**: Snapshots and movements tables maintain historical records.
7. **Row-Level Security (RLS)**: All tables have RLS policies enabled for data protection.

## Indexes

Indexes are created on frequently queried columns:
- Foreign key columns
- Status columns
- Date columns
- Unique identifier columns
- Entity type/ID combinations for audit logs

This ensures optimal query performance across all major operations.
