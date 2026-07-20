/*
# Support Tables for POS System

This migration creates supporting tables for a comprehensive POS system:
- branches: Multi-branch support
- users/cashiers: User management
- product_categories: Product organization
- receipts: Digital receipt records
- audit_logs: Transaction auditing
*/

-- 1. Create branches table
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  manager_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create users (cashiers/staff) table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id),
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'cashier', -- 'cashier', 'supervisor', 'manager', 'admin'
  password_hash TEXT, -- If using local auth
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create product_categories table
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  parent_category_id UUID REFERENCES product_categories(id),
  display_order INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Add category_id to products table (if not already present)
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES product_categories(id);

-- 5. Create receipts table for digital receipt tracking
CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  receipt_number TEXT UNIQUE NOT NULL,
  receipt_type TEXT DEFAULT 'standard', -- 'standard', 'refund', 'adjustment', 'replacement'
  print_count INTEGER DEFAULT 0,
  last_printed_at TIMESTAMPTZ,
  email_sent_to TEXT,
  email_sent_at TIMESTAMPTZ,
  qr_code_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create audit_logs table for comprehensive audit trail
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL, -- 'sale', 'refund', 'void', 'price_change', 'stock_adjust', 'user_login', etc.
  entity_type TEXT NOT NULL, -- 'transaction', 'product', 'customer', 'user', etc.
  entity_id UUID,
  old_values JSONB, -- Previous state for updates
  new_values JSONB, -- New state for updates
  changes TEXT, -- Human-readable description of changes
  ip_address INET,
  user_agent TEXT,
  branch_id UUID REFERENCES branches(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Create settings table for global and branch settings
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id), -- NULL = global settings
  setting_key TEXT NOT NULL,
  setting_value JSONB,
  data_type TEXT DEFAULT 'string', -- 'string', 'number', 'boolean', 'json', 'array'
  is_sensitive BOOLEAN DEFAULT false, -- For passwords/keys
  last_modified_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(branch_id, setting_key)
);

-- 8. Create inventory_snapshot table for historical tracking
CREATE TABLE IF NOT EXISTS inventory_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity_on_hand INTEGER,
  reorder_level INTEGER,
  reorder_quantity INTEGER,
  branch_id UUID REFERENCES branches(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Create sales_targets table for business analytics
CREATE TABLE IF NOT EXISTS sales_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period TEXT NOT NULL, -- 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'
  period_start DATE,
  period_end DATE,
  target_amount DECIMAL(12,2),
  target_units INTEGER,
  category_id UUID REFERENCES product_categories(id),
  branch_id UUID REFERENCES branches(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Enable RLS on all new tables
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_targets ENABLE ROW LEVEL SECURITY;

-- 11. RLS Policies for branches
DROP POLICY IF EXISTS "select_branches" ON branches;
CREATE POLICY "select_branches" ON branches FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_branches" ON branches;
CREATE POLICY "insert_branches" ON branches FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- 12. RLS Policies for users
DROP POLICY IF EXISTS "select_users" ON users;
CREATE POLICY "select_users" ON users FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_users" ON users;
CREATE POLICY "insert_users" ON users FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- 13. RLS Policies for product_categories
DROP POLICY IF EXISTS "select_categories" ON product_categories;
CREATE POLICY "select_categories" ON product_categories FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_categories" ON product_categories;
CREATE POLICY "insert_categories" ON product_categories FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- 14. RLS Policies for receipts
DROP POLICY IF EXISTS "select_receipts" ON receipts;
CREATE POLICY "select_receipts" ON receipts FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_receipts" ON receipts;
CREATE POLICY "insert_receipts" ON receipts FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- 15. RLS Policies for audit_logs (append-only)
DROP POLICY IF EXISTS "select_audit_logs" ON audit_logs;
CREATE POLICY "select_audit_logs" ON audit_logs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_audit_logs" ON audit_logs;
CREATE POLICY "insert_audit_logs" ON audit_logs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- 16. RLS Policies for app_settings
DROP POLICY IF EXISTS "select_settings" ON app_settings;
CREATE POLICY "select_settings" ON app_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "update_settings" ON app_settings;
CREATE POLICY "update_settings" ON app_settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- 17. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_branch ON users(branch_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

CREATE INDEX IF NOT EXISTS idx_categories_parent ON product_categories(parent_category_id);
CREATE INDEX IF NOT EXISTS idx_categories_active ON product_categories(is_active);

CREATE INDEX IF NOT EXISTS idx_receipts_transaction ON receipts(transaction_id);
CREATE INDEX IF NOT EXISTS idx_receipts_number ON receipts(receipt_number);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_branch ON audit_logs(branch_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_settings_branch_key ON app_settings(branch_id, setting_key);

CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_product ON inventory_snapshots(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_date ON inventory_snapshots(snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_sales_targets_period ON sales_targets(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_sales_targets_branch ON sales_targets(branch_id);

-- 18. Insert default branch (for single-branch installations)
INSERT INTO branches (name, location, is_active) VALUES
  ('Main Branch', 'Headquarters', true)
ON CONFLICT DO NOTHING;

-- 19. Insert default product categories
INSERT INTO product_categories (name, description, display_order, is_active) VALUES
  ('Beverages', 'Drinks and beverages', 1, true),
  ('Food', 'Food items and snacks', 2, true),
  ('Accessories', 'Accessories and supplies', 3, true),
  ('Electronics', 'Electronic items', 4, true)
ON CONFLICT DO NOTHING;
