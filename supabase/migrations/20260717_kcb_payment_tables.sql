-- KCB BUNI Payment Integration - Core Tables
-- Created: 2026-07-17
-- Purpose: Store KCB payment transactions, callbacks, and tokens for the Jimwas POS system

-- ============================================================================
-- 1. KCB Payment Transactions Table
-- ============================================================================
-- Stores all KCB payment requests and their status through the lifecycle
CREATE TABLE IF NOT EXISTS kcb_payment_transactions (
  -- Identifiers
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  message_id TEXT UNIQUE NOT NULL, -- KCB's unique message identifier
  correlation_id TEXT UNIQUE NOT NULL, -- Jimwas correlation ID for tracking
  
  -- Payment Details
  phone_number TEXT NOT NULL, -- Customer phone in 254XXXXXXXXX format
  amount INTEGER NOT NULL, -- Amount in cents (e.g., 50000 = KES 500.00)
  invoice_number TEXT NOT NULL, -- Merchant invoice reference
  description TEXT, -- Payment description shown on M-Pesa prompt
  merchant_name TEXT DEFAULT 'Jimwas POS', -- Business name shown to customer
  
  -- Status Tracking
  status TEXT NOT NULL DEFAULT 'pending', -- pending|processing|success|failed|cancelled|timeout|insufficient_balance
  kcb_status_code TEXT, -- KCB API status code (e.g., '00000' for success)
  kcb_error_code TEXT, -- KCB API error code if failed
  kcb_error_message TEXT, -- KCB error description
  
  -- M-Pesa/KCB Response
  mpesa_receipt_number TEXT UNIQUE, -- M-Pesa receipt (e.g., LFYD2L8ZJK2)
  mpesa_request_id TEXT UNIQUE, -- KCB RequestID for tracking
  mpesa_response_code TEXT, -- M-Pesa response code (0 = success)
  mpesa_response_description TEXT, -- M-Pesa response message
  mpesa_transaction_timestamp TIMESTAMP WITH TIME ZONE, -- When M-Pesa processed it
  
  -- Callback/IPN Data
  ipn_received BOOLEAN DEFAULT FALSE, -- Whether we got the IPN callback
  ipn_payload JSONB, -- Full IPN payload for debugging
  ipn_signature_valid BOOLEAN, -- Whether IPN signature verified
  ipn_received_at TIMESTAMP WITH TIME ZONE, -- When IPN arrived
  
  -- Operational
  request_payload JSONB, -- Original STK Push request payload
  retry_count INTEGER DEFAULT 0, -- How many times we retried
  last_retry_at TIMESTAMP WITH TIME ZONE, -- Last retry timestamp
  should_poll BOOLEAN DEFAULT TRUE, -- Whether to keep polling for status
  
  -- Metadata
  store_id TEXT, -- Which store processed this
  cashier_id TEXT, -- Which cashier initiated payment
  sale_id TEXT, -- Link to sale/transaction if any
  notes TEXT, -- Internal notes
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'success', 'failed', 'cancelled', 'timeout', 'insufficient_balance')),
  CONSTRAINT valid_amount CHECK (amount > 0),
  CONSTRAINT valid_phone CHECK (phone_number ~ '^254[0-9]{9}$')
);

-- Indexes for performance
CREATE INDEX idx_kcb_transactions_message_id ON kcb_payment_transactions(message_id);
CREATE INDEX idx_kcb_transactions_correlation_id ON kcb_payment_transactions(correlation_id);
CREATE INDEX idx_kcb_transactions_phone_number ON kcb_payment_transactions(phone_number);
CREATE INDEX idx_kcb_transactions_status ON kcb_payment_transactions(status);
CREATE INDEX idx_kcb_transactions_invoice ON kcb_payment_transactions(invoice_number);
CREATE INDEX idx_kcb_transactions_mpesa_receipt ON kcb_payment_transactions(mpesa_receipt_number);
CREATE INDEX idx_kcb_transactions_created_at ON kcb_payment_transactions(created_at DESC);
CREATE INDEX idx_kcb_transactions_should_poll ON kcb_payment_transactions(should_poll) WHERE should_poll = TRUE;

-- ============================================================================
-- 2. KCB Callback Records Table
-- ============================================================================
-- Stores IPN callbacks from KCB for audit and debugging
CREATE TABLE IF NOT EXISTS kcb_payment_callbacks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  -- Link to transaction
  transaction_id TEXT NOT NULL REFERENCES kcb_payment_transactions(id) ON DELETE CASCADE,
  message_id TEXT REFERENCES kcb_payment_transactions(message_id),
  
  -- Callback details
  callback_type TEXT NOT NULL DEFAULT 'ipn', -- ipn|status_query|other
  payload JSONB NOT NULL, -- Full callback payload
  headers JSONB, -- HTTP headers received
  source_ip TEXT, -- IP address that sent callback
  
  -- Verification
  signature TEXT, -- Signature from callback
  signature_valid BOOLEAN, -- Whether signature verified
  verification_error TEXT, -- If signature verification failed
  
  -- Processing
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP WITH TIME ZONE,
  processing_result TEXT, -- success|failed|error
  processing_error TEXT, -- Error message if processing failed
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_callback_type CHECK (callback_type IN ('ipn', 'status_query', 'other'))
);

-- Indexes
CREATE INDEX idx_kcb_callbacks_transaction ON kcb_payment_callbacks(transaction_id);
CREATE INDEX idx_kcb_callbacks_message_id ON kcb_payment_callbacks(message_id);
CREATE INDEX idx_kcb_callbacks_created_at ON kcb_payment_callbacks(created_at DESC);
CREATE INDEX idx_kcb_callbacks_processed ON kcb_payment_callbacks(processed) WHERE processed = FALSE;

-- ============================================================================
-- 3. KCB OAuth Token Cache Table
-- ============================================================================
-- Stores cached OAuth tokens to minimize API calls
CREATE TABLE IF NOT EXISTS kcb_oauth_tokens (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  -- Token details
  access_token TEXT NOT NULL,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  refreshed_at TIMESTAMP WITH TIME ZONE,
  
  -- Only keep the latest token
  is_active BOOLEAN DEFAULT TRUE
);

-- Ensure only one active token
CREATE INDEX idx_kcb_oauth_active ON kcb_oauth_tokens(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- 4. Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE kcb_payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kcb_payment_callbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE kcb_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read transactions from their organization
CREATE POLICY kcb_transactions_read ON kcb_payment_transactions
  FOR SELECT USING (
    auth.role() = 'authenticated'
  );

-- Policy: Only service role can insert/update transactions (from backend)
CREATE POLICY kcb_transactions_insert ON kcb_payment_transactions
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY kcb_transactions_update ON kcb_payment_transactions
  FOR UPDATE USING (auth.role() = 'service_role');

-- Policy: Read callbacks
CREATE POLICY kcb_callbacks_read ON kcb_payment_callbacks
  FOR SELECT USING (
    auth.role() = 'authenticated'
  );

-- Policy: Only service role can manage callbacks
CREATE POLICY kcb_callbacks_insert ON kcb_payment_callbacks
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY kcb_callbacks_update ON kcb_payment_callbacks
  FOR UPDATE USING (auth.role() = 'service_role');

-- Policy: OAuth tokens only accessible to service role
CREATE POLICY kcb_oauth_tokens_all ON kcb_oauth_tokens
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 5. Update Trigger for kcb_payment_transactions
-- ============================================================================
CREATE OR REPLACE FUNCTION update_kcb_transactions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER kcb_transactions_update_timestamp
  BEFORE UPDATE ON kcb_payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_kcb_transactions_timestamp();

-- ============================================================================
-- 6. Helper Functions
-- ============================================================================

-- Get active payment transactions that need polling
CREATE OR REPLACE FUNCTION get_kcb_pending_transactions()
RETURNS TABLE (
  id TEXT,
  message_id TEXT,
  phone_number TEXT,
  amount INTEGER,
  status TEXT,
  retry_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
  SELECT
    id,
    message_id,
    phone_number,
    amount,
    status,
    retry_count,
    created_at
  FROM kcb_payment_transactions
  WHERE
    should_poll = TRUE
    AND status IN ('pending', 'processing')
    AND created_at > NOW() - INTERVAL '5 minutes'
  ORDER BY created_at DESC;
$$ LANGUAGE sql;

-- Get payment transaction history for a phone number
CREATE OR REPLACE FUNCTION get_kcb_phone_history(phone TEXT, limit_count INT DEFAULT 50)
RETURNS TABLE (
  id TEXT,
  message_id TEXT,
  amount INTEGER,
  status TEXT,
  mpesa_receipt_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
  SELECT
    id,
    message_id,
    amount,
    status,
    mpesa_receipt_number,
    created_at
  FROM kcb_payment_transactions
  WHERE phone_number = phone
  ORDER BY created_at DESC
  LIMIT limit_count;
$$ LANGUAGE sql;

-- Mark transaction as completed (stop polling)
CREATE OR REPLACE FUNCTION mark_kcb_transaction_complete(tx_id TEXT)
RETURNS void AS $$
  UPDATE kcb_payment_transactions
  SET should_poll = FALSE
  WHERE id = tx_id;
$$ LANGUAGE sql;

-- Add callback to transaction
CREATE OR REPLACE FUNCTION add_kcb_callback(
  tx_id TEXT,
  callback_type TEXT,
  payload JSONB,
  sig TEXT,
  sig_valid BOOLEAN
)
RETURNS TEXT AS $$
DECLARE
  callback_id TEXT;
BEGIN
  INSERT INTO kcb_payment_callbacks (transaction_id, callback_type, payload, signature, signature_valid)
  VALUES (tx_id, callback_type, payload, sig, sig_valid)
  RETURNING id INTO callback_id;
  
  RETURN callback_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. Comments for documentation
-- ============================================================================
COMMENT ON TABLE kcb_payment_transactions IS 'Stores all KCB BUNI STK Push payment requests and their status throughout the payment lifecycle';
COMMENT ON TABLE kcb_payment_callbacks IS 'Stores IPN callbacks received from KCB for audit trail and signature verification';
COMMENT ON TABLE kcb_oauth_tokens IS 'Caches OAuth tokens to minimize API calls to KCB';

COMMENT ON COLUMN kcb_payment_transactions.message_id IS 'Unique message identifier from KCB API';
COMMENT ON COLUMN kcb_payment_transactions.correlation_id IS 'Jimwas unique identifier for tracing the request';
COMMENT ON COLUMN kcb_payment_transactions.should_poll IS 'Whether to continue polling KCB for status updates';
COMMENT ON COLUMN kcb_payment_transactions.ipn_received IS 'Whether the IPN callback has been received from KCB';
