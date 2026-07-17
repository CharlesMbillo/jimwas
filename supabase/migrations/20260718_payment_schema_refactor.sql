/*
# Payment Schema Refactor

This migration implements a normalized payment structure with proper relationships:

Customer → Sales (transactions) → SaleItems (transaction_items)
                              ↓
                        Payment (new table)
                              ↓
                    Payment Type (cash, card, mpesa, kcb)

Tables:
1. payment_methods - Enum reference table for payment types
2. payment_transactions - Normalized payment records linked to sales
3. kcb_transactions - KCB STK Push transactions (replaces/mirrors mpesa_transactions for KCB)
4. cash_transactions - Cash payment details
5. card_transactions - Card payment details
6. mpesa_transactions - M-Pesa payment details (existing, kept for backward compatibility)

This ensures clear relationships and supports the desired schema structure.
*/

-- 1. Create payment_methods enum reference table
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- 'cash', 'card', 'mpesa', 'kcb'
  label TEXT NOT NULL, -- 'Cash', 'Card', 'M-Pesa', 'KCB STK Push'
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create payment_transactions table (main payment record)
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  payment_method_code TEXT NOT NULL, -- Reference to payment_methods.code
  amount DECIMAL(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  reference_number TEXT, -- Receipt/transaction number
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (payment_method_code) REFERENCES payment_methods(code)
);

-- 3. Create KCB transactions table (specific to KCB STK Push)
CREATE TABLE IF NOT EXISTS kcb_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_transaction_id UUID REFERENCES payment_transactions(id) ON DELETE CASCADE,
  checkout_request_id TEXT UNIQUE,
  merchant_request_id TEXT,
  phone_number TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'failed', 'cancelled', 'timeout')),
  result_code TEXT,
  result_desc TEXT,
  kcb_receipt_number TEXT,
  transaction_date TEXT,
  customer_id UUID REFERENCES customers(id),
  cashier_id UUID,
  cashier_name TEXT,
  callback_received BOOLEAN DEFAULT false,
  callback_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create cash_transactions table
CREATE TABLE IF NOT EXISTS cash_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_transaction_id UUID REFERENCES payment_transactions(id) ON DELETE CASCADE,
  amount_paid DECIMAL(12,2) NOT NULL,
  change_amount DECIMAL(12,2) DEFAULT 0,
  cashier_id UUID,
  cashier_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create card_transactions table
CREATE TABLE IF NOT EXISTS card_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_transaction_id UUID REFERENCES payment_transactions(id) ON DELETE CASCADE,
  card_last_four TEXT,
  card_brand TEXT, -- Visa, Mastercard, etc.
  auth_code TEXT,
  terminal_id TEXT,
  cashier_id UUID,
  cashier_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Enable RLS on all new tables
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kcb_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_transactions ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for payment_methods (read-only for anon/authenticated)
DROP POLICY IF EXISTS "select_payment_methods" ON payment_methods;
CREATE POLICY "select_payment_methods" ON payment_methods FOR SELECT
  TO anon, authenticated USING (true);

-- 8. RLS Policies for payment_transactions
DROP POLICY IF EXISTS "select_payment_transactions" ON payment_transactions;
CREATE POLICY "select_payment_transactions" ON payment_transactions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_payment_transactions" ON payment_transactions;
CREATE POLICY "insert_payment_transactions" ON payment_transactions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_payment_transactions" ON payment_transactions;
CREATE POLICY "update_payment_transactions" ON payment_transactions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- 9. RLS Policies for kcb_transactions
DROP POLICY IF EXISTS "select_kcb_transactions" ON kcb_transactions;
CREATE POLICY "select_kcb_transactions" ON kcb_transactions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_kcb_transactions" ON kcb_transactions;
CREATE POLICY "insert_kcb_transactions" ON kcb_transactions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_kcb_transactions" ON kcb_transactions;
CREATE POLICY "update_kcb_transactions" ON kcb_transactions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- 10. RLS Policies for cash_transactions
DROP POLICY IF EXISTS "select_cash_transactions" ON cash_transactions;
CREATE POLICY "select_cash_transactions" ON cash_transactions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_cash_transactions" ON cash_transactions;
CREATE POLICY "insert_cash_transactions" ON cash_transactions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- 11. RLS Policies for card_transactions
DROP POLICY IF EXISTS "select_card_transactions" ON card_transactions;
CREATE POLICY "select_card_transactions" ON card_transactions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_card_transactions" ON card_transactions;
CREATE POLICY "insert_card_transactions" ON card_transactions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- 12. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_transactions_transaction_id ON payment_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created ON payment_transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_kcb_transactions_checkout_request ON kcb_transactions(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_kcb_transactions_status ON kcb_transactions(status);
CREATE INDEX IF NOT EXISTS idx_kcb_transactions_created ON kcb_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kcb_transactions_payment_id ON kcb_transactions(payment_transaction_id);

CREATE INDEX IF NOT EXISTS idx_cash_transactions_payment_id ON cash_transactions(payment_transaction_id);
CREATE INDEX IF NOT EXISTS idx_card_transactions_payment_id ON card_transactions(payment_transaction_id);

-- 13. Insert default payment methods
INSERT INTO payment_methods (code, label, description) VALUES
  ('cash', 'Cash', 'Payment received in cash'),
  ('card', 'Card', 'Payment via debit or credit card'),
  ('mpesa', 'M-Pesa', 'Payment via M-Pesa mobile money'),
  ('kcb', 'KCB STK Push', 'Payment via KCB STK Push (BUNI)')
ON CONFLICT (code) DO NOTHING;

-- 14. Add column to transactions table for explicit payment method tracking (optional, for backward compatibility)
-- This keeps the existing payment_method column while we transition to the new schema
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_method_id UUID REFERENCES payment_methods(code);
