/*
# Jimwas POS - Full Schema

## Summary
Creates the complete schema for the Jimwas POS system:

1. New Tables
   - `roles` - System roles (admin, manager, cashier)
   - `users` - POS users with role assignment and auth link
   - `products` - Product catalog with stock tracking
   - `customers` - Customer registry
   - `transactions` - Completed sales records with status (completed/voided)
   - `transaction_items` - Line items per transaction
   - `void_requests` - Requests to void/reverse a completed sale
   - `approval_requests` - Generic approval workflow entries

2. Security
   - RLS enabled on all tables
   - All tables use TO anon, authenticated (single-tenant, no user-scoped isolation)
   - Full CRUD policies for each table

3. Notes
   - `transactions.status` defaults to 'completed'; can be 'voided'
   - `void_requests.status` can be: pending, approved, rejected, completed
   - `approval_requests.status` can be: pending, approved, rejected
   - void_requests links to approval_requests via approval_request_id
*/

-- Roles
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Users / Staff
CREATE TABLE IF NOT EXISTS pos_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'cashier',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  wholesale_price numeric(12,2),
  stock_quantity integer NOT NULL DEFAULT 0,
  category text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  cashier_id uuid REFERENCES pos_users(id) ON DELETE SET NULL,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  change_due numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash',
  sale_type text NOT NULL DEFAULT 'standard',
  status text NOT NULL DEFAULT 'completed',
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transactions_status_idx ON transactions(status);
CREATE INDEX IF NOT EXISTS transactions_created_at_idx ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS transactions_customer_id_idx ON transactions(customer_id);

-- Transaction Items
CREATE TABLE IF NOT EXISTS transaction_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transaction_items_transaction_id_idx ON transaction_items(transaction_id);

-- Approval Requests
CREATE TABLE IF NOT EXISTS approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  requester_id uuid REFERENCES pos_users(id) ON DELETE SET NULL,
  requester_name text NOT NULL,
  requester_role text NOT NULL DEFAULT 'cashier',
  approver_id uuid REFERENCES pos_users(id) ON DELETE SET NULL,
  approver_name text,
  notes text,
  rejection_reason text,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS approval_requests_status_idx ON approval_requests(status);
CREATE INDEX IF NOT EXISTS approval_requests_type_idx ON approval_requests(type);

-- Void Requests
CREATE TABLE IF NOT EXISTS void_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  approval_request_id uuid REFERENCES approval_requests(id) ON DELETE SET NULL,
  requester_id uuid REFERENCES pos_users(id) ON DELETE SET NULL,
  requester_name text NOT NULL,
  requester_role text NOT NULL DEFAULT 'cashier',
  approver_id uuid REFERENCES pos_users(id) ON DELETE SET NULL,
  approver_name text,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  transaction_total numeric(12,2) NOT NULL DEFAULT 0,
  transaction_payment_method text NOT NULL DEFAULT 'cash',
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS void_requests_status_idx ON void_requests(status);
CREATE INDEX IF NOT EXISTS void_requests_transaction_id_idx ON void_requests(transaction_id);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  actor_id uuid REFERENCES pos_users(id) ON DELETE SET NULL,
  actor_name text,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- RLS

ALTER TABLE pos_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE void_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- pos_users policies
DROP POLICY IF EXISTS "pos_users_select" ON pos_users;
CREATE POLICY "pos_users_select" ON pos_users FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "pos_users_insert" ON pos_users;
CREATE POLICY "pos_users_insert" ON pos_users FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "pos_users_update" ON pos_users;
CREATE POLICY "pos_users_update" ON pos_users FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "pos_users_delete" ON pos_users;
CREATE POLICY "pos_users_delete" ON pos_users FOR DELETE TO anon, authenticated USING (true);

-- products policies
DROP POLICY IF EXISTS "products_select" ON products;
CREATE POLICY "products_select" ON products FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "products_insert" ON products;
CREATE POLICY "products_insert" ON products FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "products_update" ON products;
CREATE POLICY "products_update" ON products FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "products_delete" ON products;
CREATE POLICY "products_delete" ON products FOR DELETE TO anon, authenticated USING (true);

-- customers policies
DROP POLICY IF EXISTS "customers_select" ON customers;
CREATE POLICY "customers_select" ON customers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "customers_insert" ON customers;
CREATE POLICY "customers_insert" ON customers FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "customers_update" ON customers;
CREATE POLICY "customers_update" ON customers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "customers_delete" ON customers;
CREATE POLICY "customers_delete" ON customers FOR DELETE TO anon, authenticated USING (true);

-- transactions policies
DROP POLICY IF EXISTS "transactions_select" ON transactions;
CREATE POLICY "transactions_select" ON transactions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "transactions_insert" ON transactions;
CREATE POLICY "transactions_insert" ON transactions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "transactions_update" ON transactions;
CREATE POLICY "transactions_update" ON transactions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "transactions_delete" ON transactions;
CREATE POLICY "transactions_delete" ON transactions FOR DELETE TO anon, authenticated USING (true);

-- transaction_items policies
DROP POLICY IF EXISTS "transaction_items_select" ON transaction_items;
CREATE POLICY "transaction_items_select" ON transaction_items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "transaction_items_insert" ON transaction_items;
CREATE POLICY "transaction_items_insert" ON transaction_items FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "transaction_items_update" ON transaction_items;
CREATE POLICY "transaction_items_update" ON transaction_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "transaction_items_delete" ON transaction_items;
CREATE POLICY "transaction_items_delete" ON transaction_items FOR DELETE TO anon, authenticated USING (true);

-- approval_requests policies
DROP POLICY IF EXISTS "approval_requests_select" ON approval_requests;
CREATE POLICY "approval_requests_select" ON approval_requests FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "approval_requests_insert" ON approval_requests;
CREATE POLICY "approval_requests_insert" ON approval_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "approval_requests_update" ON approval_requests;
CREATE POLICY "approval_requests_update" ON approval_requests FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "approval_requests_delete" ON approval_requests;
CREATE POLICY "approval_requests_delete" ON approval_requests FOR DELETE TO anon, authenticated USING (true);

-- void_requests policies
DROP POLICY IF EXISTS "void_requests_select" ON void_requests;
CREATE POLICY "void_requests_select" ON void_requests FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "void_requests_insert" ON void_requests;
CREATE POLICY "void_requests_insert" ON void_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "void_requests_update" ON void_requests;
CREATE POLICY "void_requests_update" ON void_requests FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "void_requests_delete" ON void_requests;
CREATE POLICY "void_requests_delete" ON void_requests FOR DELETE TO anon, authenticated USING (true);

-- audit_log policies
DROP POLICY IF EXISTS "audit_log_select" ON audit_log;
CREATE POLICY "audit_log_select" ON audit_log FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "audit_log_insert" ON audit_log;
CREATE POLICY "audit_log_insert" ON audit_log FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "audit_log_update" ON audit_log;
CREATE POLICY "audit_log_update" ON audit_log FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "audit_log_delete" ON audit_log;
CREATE POLICY "audit_log_delete" ON audit_log FOR DELETE TO anon, authenticated USING (true);

-- Seed default staff
INSERT INTO pos_users (id, name, email, role) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Admin User', 'admin@jimwas.co.ke', 'admin'),
  ('00000000-0000-0000-0000-000000000002', 'Manager Jane', 'manager@jimwas.co.ke', 'manager'),
  ('00000000-0000-0000-0000-000000000003', 'Cashier John', 'cashier@jimwas.co.ke', 'cashier')
ON CONFLICT (id) DO NOTHING;

-- Seed sample products
INSERT INTO products (name, sku, price, wholesale_price, stock_quantity, category) VALUES
  ('Nduma Zebra BIG Plant 1.5m', 'NZP-150', 5000, 3500, 4, 'Plants'),
  ('Fiddle Leaf Fig 1m', 'FLF-100', 3500, 2500, 8, 'Plants'),
  ('Snake Plant Medium', 'SNK-MD', 1800, 1200, 15, 'Plants'),
  ('Monstera Deliciosa', 'MON-DEL', 4500, 3200, 6, 'Plants'),
  ('Potting Mix 10L', 'POT-10L', 800, 550, 30, 'Supplies'),
  ('Ceramic Pot 25cm', 'CER-25', 1200, 900, 20, 'Pots')
ON CONFLICT DO NOTHING;

-- Seed sample customers
INSERT INTO customers (name, phone, email) VALUES
  ('Walk-in Customer', NULL, NULL),
  ('Alice Njeri', '0712345678', 'alice@example.com'),
  ('Bob Kamau', '0723456789', NULL)
ON CONFLICT DO NOTHING;
