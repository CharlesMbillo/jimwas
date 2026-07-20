# KCB BUNI Payment Error Fix - "Empty response from M-Pesa service"

## Issue Summary
Users encountered "Empty response from M-Pesa service" error when attempting KCB STK PUSH payments after transaction amount was entered, even though credentials were configured in Settings.

## Root Causes Identified

### 1. **Settings Table Mismatch (Critical)**
- **Edge Functions** (mpesa-stk, mpesa-status) were querying `mpesa_settings` table
- **Application** had migrated to new `kcb_settings` table
- Result: Functions couldn't find configured credentials, returned empty response

### 2. **Field Name Mismatches**
- Functions checked for OLD field names: `consumer_key`, `consumer_secret`, `passkey`, `short_code`
- Settings form saved NEW field names: `client_id`, `client_secret`, `org_passkey`, `org_shortcode`
- Result: Credentials validation always failed due to missing old fields

### 3. **Error Messages**
- Error messages incorrectly referenced "M-Pesa service" instead of "KCB service"
- Caused user confusion about which payment provider was having issues

## Files Modified

### 1. **supabase/functions/mpesa-stk/index.ts**
- Line 108: Changed table from `mpesa_settings` → `kcb_settings`
- Line 110: Changed id from `mpesa-settings` → `kcb-settings`
- Lines 125-142: Updated field name validation (consumer_key → client_id, etc.)
- Line 171: Updated getAccessToken call to use `client_id` and `client_secret`
- Line 177: Updated password generation to use `org_passkey`

### 2. **supabase/functions/mpesa-status/index.ts**
- Line 94: Changed table from `mpesa_settings` → `kcb_settings`
- Line 96: Changed id from `mpesa-settings` → `kcb-settings`
- Line 101: Updated credential validation to check new field names
- Lines 119-120: Updated getAccessToken call
- Line 125: Updated password generation

### 3. **src/lib/mpesa.ts**
- Lines 56, 61, 96, 101: Updated error messages from "M-Pesa service" → "KCB service"

### 4. **src/routes/pos.tsx**
- Line 314: Updated error message from "Insufficient M-Pesa balance" → "Insufficient KCB balance"

### 5. **supabase/functions/mpesa-callback/index.ts**
- Line 48: Updated log message for consistency

## Impact

### Before Fix
```
ERROR: "Empty response from M-Pesa service"
↓
Functions couldn't find credentials in mpesa_settings table
↓
No credentials passed to Safaricom API
↓
Empty/null response returned to client
↓
Payment fails immediately
```

### After Fix
```
Functions query kcb_settings table with correct id
↓
Find credentials with correct field names (client_id, client_secret, org_passkey, org_shortcode)
↓
Successfully authenticate with Safaricom/KCB API
↓
STK Push initiated successfully
↓
Payment flow proceeds to phone input stage
```

## Testing Checklist

- [x] Verified settings are saved in kcb_settings table with correct field names
- [x] Functions now query correct table and id
- [x] Functions validate correct field names
- [x] Error messages reference KCB instead of M-Pesa
- [x] All four required fields needed: client_id, client_secret, org_passkey, org_shortcode
- [x] Application compiles without errors

## Deployment Instructions

1. Deploy Edge Functions with updated code
2. Verify kcb_settings table exists in Supabase with sample record:
   ```sql
   {
     "id": "kcb-settings",
     "is_enabled": true,
     "client_id": "your_client_id",
     "client_secret": "your_client_secret",
     "org_shortcode": "JIMWAS",
     "org_passkey": "your_passkey",
     "environment": "sandbox"
   }
   ```
3. Ensure Settings > Payments form saves to kcb_settings table
4. Test payment flow: Enter phone → Send Payment Request → Should work correctly

## Related Documentation
- See `KCB_BUNI_FIX_SUMMARY.md` for configuration setup
- See `DEPLOYMENT_CHECKLIST.md` for full deployment procedure
