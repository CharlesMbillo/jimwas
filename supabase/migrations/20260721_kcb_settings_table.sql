-- KCB Settings Table
-- Migration: 20260721
-- Purpose: Store KCB BUNI OAuth and M-Pesa configuration for the Jimwas POS system

-- ============================================================================
-- 1. KCB Settings Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS kcb_settings (
  id TEXT PRIMARY KEY,
  
  -- OAuth Configuration
  client_id TEXT,
  client_secret TEXT,
  
  -- M-Pesa Configuration
  org_shortcode TEXT, -- Merchant's M-Pesa shortcode
  org_passkey TEXT,   -- M-Pesa passkey for signing requests
  
  -- Environment Configuration
  environment TEXT DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  
  -- Callback Configuration
  callback_url TEXT,
  timeout_url TEXT,
  public_cert_path TEXT,
  
  -- Phone Configuration
  default_phone_country_code TEXT DEFAULT '254',
  
  -- Status Configuration
  is_enabled BOOLEAN DEFAULT false,
  
  -- Metadata
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  last_updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced'))
);

-- ============================================================================
-- 2. Enable RLS
-- ============================================================================
ALTER TABLE kcb_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. RLS Policies
-- ============================================================================
-- Allow all authenticated users to read settings
CREATE POLICY "kcb_settings_read" ON kcb_settings
  FOR SELECT USING (true);

-- Allow authenticated users to update settings
CREATE POLICY "kcb_settings_update" ON kcb_settings
  FOR UPDATE USING (true);

-- Allow authenticated users to insert settings
CREATE POLICY "kcb_settings_insert" ON kcb_settings
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- 4. Insert default KCB settings
-- ============================================================================
INSERT INTO kcb_settings (
  id,
  is_enabled,
  environment,
  default_phone_country_code,
  created_at,
  updated_at,
  sync_status
) VALUES (
  'kcb-settings',
  false,
  'sandbox',
  '254',
  NOW(),
  NOW(),
  'synced'
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 5. Create index for faster lookups
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_kcb_settings_id ON kcb_settings(id);
CREATE INDEX IF NOT EXISTS idx_kcb_settings_enabled ON kcb_settings(is_enabled);

-- ============================================================================
-- 6. Comments
-- ============================================================================
COMMENT ON TABLE kcb_settings IS 'Stores KCB BUNI M-Pesa OAuth and payment configuration for the Jimwas POS system';
COMMENT ON COLUMN kcb_settings.id IS 'Unique settings identifier (typically kcb-settings)';
COMMENT ON COLUMN kcb_settings.client_id IS 'OAuth client ID from KCB';
COMMENT ON COLUMN kcb_settings.client_secret IS 'OAuth client secret from KCB';
COMMENT ON COLUMN kcb_settings.org_shortcode IS 'Merchant M-Pesa shortcode for collection';
COMMENT ON COLUMN kcb_settings.org_passkey IS 'M-Pesa passkey for signing requests';
COMMENT ON COLUMN kcb_settings.environment IS 'API environment: sandbox or production';
COMMENT ON COLUMN kcb_settings.callback_url IS 'Webhook URL for IPN callbacks';
COMMENT ON COLUMN kcb_settings.is_enabled IS 'Whether KCB payments are enabled';
COMMENT ON COLUMN kcb_settings.sync_status IS 'Sync status: pending or synced';
