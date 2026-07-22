/*
# Jimwas POS - Full Schema with M-Pesa Settings Persistence

## Summary
Creates the complete schema for the Jimwas POS system including a dedicated
`mpesa_settings` table so KCB M-Pesa Express API STK Push settings persist
across app restarts (stored in Supabase, not localStorage).

1. New Tables
   - `pos_users` - Staff with role assignment
   - `products` - Product catalog with stock tracking
   - `customers` - Customer registry
   - `transactions` - Sales records with status (completed/voided)
   - `transaction_items` - Line items per transaction
   - `void_requests` - Void/reversal requests
   - `approval_requests` - Generic approval workflow
   - `audit_log` - Audit trail
   - `mpesa_settings` - KCB BUNI M-Pesa Express API configuration (singleton row)

2. Security
   - RLS enabled on all tables
   - All tables use TO anon, authenticated (single-tenant, no user-scoped isolation)
   - Full CRUD policies for each table

3. Notes
   - `mpesa_settings` uses a singleton pattern (id = '00000000-0000-0000-0000-000000000001')
   - Settings include: shortcode, passkey, consumer_key, consumer_secret,
     callback_url, environment (sandbox/production), enabled flag
   - When the app loads, it reads from this table. When settings are updated,
     the row is upserted. Settings survive app restarts because they live in Supabase.
*/

-- pos_users
CREATE TABLE IF NOT EXISTS pos_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'cashier',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- products
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

-- customers
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- transactions
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
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transactions_status_idx ON transactions(status);
CREATE INDEX IF NOT EXISTS transactions_created_at_idx ON transactions(created_at DESC);

-- transaction_items
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

-- approval_requests
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

-- void_requests
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

-- audit_log
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

-- mpesa_settings (singleton row pattern)
CREATE TABLE IF NOT EXISTS mpesa_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shortcode text NOT NULL DEFAULT '',
  passkey text NOT NULL DEFAULT '',
  consumer_key text NOT NULL DEFAULT '',
  consumer_secret text NOT NULL DEFAULT '',
  callback_url text NOT NULL DEFAULT '',
  environment text NOT NULL DEFAULT 'sandbox',
  enabled boolean NOT NULL DEFAULT false,
  initiator_name text NOT NULL DEFAULT '',
  security_credential text NOT NULL DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

-- Seed singleton mpesa_settings row so it always exists
INSERT INTO mpesa_settings (id, shortcode, passkey, consumer_key, consumer_secret, callback_url, environment, enabled)
VALUES ('00000000-0000-0000-0000-000000000001', '', '', '', '', '', 'sandbox', false)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on all tables
ALTER TABLE pos_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE void_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE mpesa_settings ENABLE ROW LEVEL SECURITY;

-- Helper to generate CRUD policies idempotently
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['pos_users','products','customers','transactions','transaction_items','approval_requests','void_requests','audit_log','mpesa_settings'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', t || '_select', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO anon, authenticated USING (true);', t || '_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', t || '_insert', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO anon, authenticated WITH CHECK (true);', t || '_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', t || '_update', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);', t || '_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', t || '_delete', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO anon, authenticated USING (true);', t || '_delete', t);
  END LOOP;
END $$;

-- Seed users
INSERT INTO pos_users (id, name, email, role) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Admin User', 'admin@jimwas.co.ke', 'admin'),
  ('00000000-0000-0000-0000-000000000002', 'Manager Jane', 'manager@jimwas.co.ke', 'manager'),
  ('00000000-0000-0000-0000-000000000003', 'Cashier John', 'cashier@jimwas.co.ke', 'cashier')
ON CONFLICT (id) DO NOTHING;

-- Seed products
INSERT INTO products (name, sku, price, wholesale_price, stock_quantity, category) VALUES
  ('Nduma Zebra BIG Plant 1.5m', 'NZP-150', 5000, 3500, 4, 'Plants'),
  ('Fiddle Leaf Fig 1m', 'FLF-100', 3500, 2500, 8, 'Plants'),
  ('Snake Plant Medium', 'SNK-MD', 1800, 1200, 15, 'Plants'),
  ('Monstera Deliciosa', 'MON-DEL', 4500, 3200, 6, 'Plants'),
  ('Potting Mix 10L', 'POT-10L', 800, 550, 30, 'Supplies'),
  ('Ceramic Pot 25cm', 'CER-25', 1200, 900, 20, 'Pots')
ON CONFLICT DO NOTHING;

-- Seed customers
INSERT INTO customers (name, phone, email) VALUES
  ('Walk-in Customer', NULL, NULL),
  ('Alice Njeri', '0712345678', 'alice@example.com'),
  ('Bob Kamau', '0723456789', NULL)
ON CONFLICT DO NOTHING;
