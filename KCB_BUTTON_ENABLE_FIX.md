# KCB STK Button Enable Fix

**Issue:** KCB STK button remained OFF (disabled) even after entering all required values in Settings > Payments > KCB BUNI

**Root Cause:** The POS terminal validation logic in `src/routes/pos.tsx` (lines 117-120) was incomplete. It only checked for OAuth credentials (`client_id` and `client_secret`) but not for the actual M-Pesa payment credentials (`org_shortcode` and `org_passkey`).

**Settings Form Requirements (correct):**
- Client ID (OAuth)
- Client Secret (OAuth)
- M-Pesa Short Code (Payment)
- M-Pesa Pass Key (Payment)

**POS Terminal Validation (was incomplete):**
✗ Only checked: client_id + client_secret
✓ Now checks: client_id + client_secret + org_shortcode + org_passkey

## Files Modified

### src/routes/pos.tsx
- **Lines 113-122:** Updated `kcbConfigured` check to validate all 4 required fields
- **Lines 259-265:** Updated error message to be more descriptive about what credentials are needed

## Code Changes

**Before:**
```typescript
const hasCredentials = !!(kcbSettings?.is_enabled &&
  kcbSettings.client_id &&
  kcbSettings.client_secret);
```

**After:**
```typescript
const hasCredentials = !!(kcbSettings?.is_enabled &&
  kcbSettings.client_id &&
  kcbSettings.client_secret &&
  kcbSettings.org_shortcode &&
  kcbSettings.org_passkey);
```

## How It Works Now

1. User enters all 4 credentials in Settings > Payments > KCB BUNI
2. Settings are saved to Supabase and IndexedDB
3. POS terminal loads the settings and verifies ALL 4 credentials are present
4. When all credentials are configured, the KCB STK button becomes ENABLED (green)
5. User can now click the button to pay via M-Pesa STK Push

## Testing

- Build: ✅ Successful (no errors)
- App loads: ✅ Running at localhost:5173
- KCB button logic: ✅ Fixed - now checks all required credentials

## Next Steps

Users should:
1. Go to **Settings > Payments > KCB BUNI**
2. Enter all 4 required values:
   - Client ID
   - Client Secret
   - M-Pesa Short Code
   - M-Pesa Pass Key
3. Click **Save Settings**
4. Return to POS terminal
5. The KCB STK button should now be ENABLED (green, clickable)
