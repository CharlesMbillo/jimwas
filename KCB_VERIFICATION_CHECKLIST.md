# KCB BUNI Integration - Verification Checklist

## System Setup Verification

### 1. Environment Variables
Before payment initiation works, ensure these are set in your project:

```bash
# Check .env.development.local (local development)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Verify:**
- [ ] Both variables are set and not empty
- [ ] VITE_SUPABASE_URL points to your actual Supabase project
- [ ] VITE_SUPABASE_ANON_KEY is the anonymous/public key (not service role key)

**If failing:**
- Check Vercel project settings > Environment Variables
- Verify in Settings > Vars in v0
- Restart dev server after adding env vars

### 2. Supabase Connection
The system attempts to connect to Supabase when payment is initiated.

**Verify in browser console** (F12 → Console):
```
[v0] Attempting to load KCB settings from Supabase...
[v0] Supabase client initialized. Querying kcb_settings table...
[v0] KCB settings loaded successfully from Supabase
```

**If you see:**
- `Supabase client not initialized` → Check environment variables (step 1)
- `kcb_settings table does not exist` → Run database migration
- `No rows returned` → KCB not configured in Settings

## KCB Configuration Verification

### 3. Database Migration
The `kcb_settings` table must exist in Supabase.

**Verify:**
- [ ] Run migration: `supabase db push` (if using local Supabase)
- [ ] Or manually in Supabase dashboard: Copy SQL from `supabase/migrations/20260717_kcb_payment_tables.sql`
- [ ] Table `kcb_settings` exists with columns: id, client_id, client_secret, org_shortcode, org_passkey, etc.

**Check in Supabase:**
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run: `SELECT * FROM kcb_settings LIMIT 1;`
4. Should return one row with id = 'kcb-settings'

### 4. KCB Settings in Database
Even if the table exists, the settings row must be configured.

**Expected data in kcb_settings table:**
```sql
{
  id: 'kcb-settings',
  is_enabled: true,
  environment: 'sandbox', -- or 'production'
  client_id: 'your-kcb-client-id',
  client_secret: 'your-kcb-client-secret',
  org_shortcode: '123456',
  org_passkey: 'your-passkey',
  environment: 'sandbox'
}
```

**Verify:**
- [ ] All required fields are filled (not NULL)
- [ ] client_id and client_secret are valid KCB credentials
- [ ] org_shortcode is set (from KCB dashboard)
- [ ] org_passkey is set (from KCB dashboard)

### 5. Settings UI Configuration
Users can configure KCB in Settings > Payments > KCB BUNI.

**Verify in Jimwas UI:**
1. Open Settings (top navigation)
2. Go to Payments section
3. Look for "KCB BUNI" configuration
4. Check:
   - [ ] "Enable KCB BUNI" is toggled ON
   - [ ] "Environment Mode" set to Sandbox (or Production)
   - [ ] "Consumer Key" (Client ID) filled
   - [ ] "Consumer Secret" filled
   - [ ] "Organization Short Code" filled
   - [ ] "Organization Pass Key" filled
   - [ ] For Production: "Initiator Passkey" filled

**If missing:**
- Settings form may not be wired to database
- Check `src/routes/settings.tsx` for KCB settings section

## Payment Flow Verification

### 6. Payment Method Display
The payment checkout should show "KCB STK" button (not "M-Pesa").

**Verify:**
- [ ] Go to POS
- [ ] Add items to cart
- [ ] Click "Checkout"
- [ ] Payment method shows: Cash | Card | **KCB STK**
- [ ] Not: Cash | Card | M-Pesa

**If incorrect:**
- Check `src/routes/pos.tsx` line ~918
- Payment method label should be 'KCB STK'

### 7. Configuration Status Check
When KCB STK is selected, should show status (not error).

**Expected UI:**
- [ ] Green checkmark or status showing "All required fields configured"
- [ ] Payment button shows: "Charge KES X,XXX via KCB"

**If error instead:**
- "KCB BUNI not ready" → Settings not saved or incomplete
- "Missing required fields" → Check step 5 (Settings UI)
- Check browser console for specific errors

### 8. Payment Initiation
Click the charge button to initiate payment.

**Expected flow:**
1. Payment modal opens
2. Modal title: "KCB M-Pesa Payment"
3. Shows amount and invoice number
4. Phone number input field
5. "Send STK Push" button

**Browser console should show:**
```
[v0] Payment initiation error: (if error occurs)
[v0] Attempting to load KCB settings from Supabase...
[v0] Supabase client initialized...
[v0] KCB settings loaded successfully from Supabase
[v0] STK Push initiated... (if successful)
```

### 9. Error Messages and Guidance
If payment fails, error messages should be helpful.

**Error message patterns:**
- Contains action items like "Go to Settings > Payments"
- Identifies the specific problem (Supabase, KCB config, missing fields)
- Suggests next steps

**Common errors:**
- "KCB not configured" → Go to Settings > Payments > KCB BUNI
- "System error: Supabase not configured" → Check environment variables
- "Missing required fields" → Fill all fields in Settings

## Database Verification

### 10. Transaction Recording
When payment is initiated, a transaction should be recorded in database.

**Check in Supabase:**
1. Go to SQL Editor
2. Run: `SELECT * FROM kcb_payment_transactions ORDER BY created_at DESC LIMIT 5;`
3. Should see your test transactions

**Expected columns:**
- id: unique transaction ID
- phone_number: 254XXXXXXXXX format
- amount: in cents (e.g., 100000 for KES 1000)
- status: 'pending', 'processing', 'success', 'failed'
- created_at: timestamp

## Deployment Checklist

### 11. Production Deployment
Before deploying to production:

- [ ] All environment variables set in Vercel project
- [ ] Database migrations applied to production Supabase
- [ ] KCB settings configured with PRODUCTION credentials
- [ ] Passkey field filled for production mode
- [ ] Environment mode set to "production" (not sandbox)
- [ ] Test payment in sandbox first
- [ ] Verify callback URL is correct

### 12. Sandbox Testing
For sandbox/testing:

- [ ] Environment mode set to "sandbox"
- [ ] Use sandbox credentials from KCB
- [ ] Test phone: 254708374149 (common sandbox test number)
- [ ] PIN: any 4 digits (e.g., 1234)

## Support and Debugging

### Console Logging
The application logs detailed information for debugging:

```javascript
// Look for these in browser console (F12 → Console tab)
[v0] Attempting to load KCB settings from Supabase...
[v0] Supabase client initialized. Querying kcb_settings table...
[v0] Payment initiation error: ...
[v0] KCB settings loaded successfully from Supabase
```

### Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Supabase client not initialized | Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env |
| KCB settings not found | Create kcb-settings record in database OR fill Settings UI form |
| Configuration validation failed | Ensure all fields (Client ID, Secret, Shortcode, Passkey) are filled |
| Payment modal won't open | Check payment method is set to 'kcb' and amount is valid |
| STK Push not sent | Check KCB credentials are correct for sandbox/production |
| Transaction not recorded | Verify Supabase connection and table exists |

## Final Verification

Run through this complete flow:

1. [ ] Open Settings > Payments > KCB BUNI
2. [ ] Verify all fields are filled (enable toggle, all credentials)
3. [ ] Go to POS
4. [ ] Add items to cart
5. [ ] Click Checkout
6. [ ] Select "KCB STK" payment method
7. [ ] Verify status shows green (configured)
8. [ ] Click "Charge KES X via KCB"
9. [ ] Payment modal opens
10. [ ] Enter test phone: 0708374149
11. [ ] Click "Send STK Push"
12. [ ] Check browser console for success logs
13. [ ] Verify transaction in Supabase: `SELECT * FROM kcb_payment_transactions`

If all steps pass, KCB integration is fully functional!

---

**Still having issues?** Check the console logs at each step. They will show exactly where the failure occurred and what to fix.
