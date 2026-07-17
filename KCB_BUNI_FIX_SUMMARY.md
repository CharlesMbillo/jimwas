# KCB BUNI Configuration Fix - Summary

## Issue Resolved
**"KCB BUNI not ready - Add Client ID & Secret in Settings › Payments"** error now clears properly when credentials are configured.

---

## Root Cause
Field name mismatch between the database schema and the validation logic:
- **Settings form** was saving credentials with new field names: `client_id`, `client_secret`, `org_shortcode`, `org_passkey`
- **POS validation** was checking for OLD field names: `consumer_key`, `consumer_secret` (which don't exist)
- Result: Configuration was saved but validation always failed, showing "not ready" error

---

## Changes Made

### 1. Fixed pos.tsx Validation Logic (Lines 106-114)
**Before:**
```typescript
const hasCredentials = !!(mpesa?.is_enabled &&
  mpesa.consumer_key &&           // ❌ WRONG - field doesn't exist
  mpesa.consumer_secret);         // ❌ WRONG - field doesn't exist
```

**After:**
```typescript
const hasCredentials = !!(mpesa?.is_enabled &&
  mpesa.client_id &&              // ✅ CORRECT
  mpesa.client_secret &&          // ✅ CORRECT
  mpesa.org_shortcode &&          // ✅ NOW REQUIRED
  mpesa.org_passkey);             // ✅ NOW REQUIRED
```

### 2. Fixed Settings Query ID (Line 101)
**Before:**
```typescript
.eq('id', 'mpesa-settings')      // ❌ Wrong table record ID
```

**After:**
```typescript
.eq('id', 'kcb-settings')         // ✅ Correct ID matching DEFAULT_KCB_SETTINGS
```

### 3. Enhanced Error Message (Lines 893-905)
Now clearly states what's required:
- "Complete KCB configuration in Settings › Payments"
- Lists: "Required: Client ID, Client Secret, Org Shortcode, and Org Passkey"

### 4. Improved UX - Hide Phone Input When Unconfigured (Lines 909-944)
Phone number input now only shows when `kcbConfigured` is true, preventing user confusion.

---

## Validation Fields Required

### Required Fields (All must be present):
1. **Client ID** (App Key) - From KCB Developer Portal
2. **Client Secret** (App Secret) - From KCB Developer Portal
3. **Organization Shortcode** - Your KCB organization identifier
4. **Organization Passkey** - KCB Pass Key for BUNI (STK Push authentication)

### Optional Fields:
- Environment: Sandbox (default) or Production
- Default Country Code: 254 (Kenya, default)
- Callback URL for IPN notifications

---

## Testing

After applying this fix:

1. ✅ Navigate to Settings › Payments › KCB MpesaExpressAPI STK Push Settings
2. ✅ Enable KCB BUNI (toggle on)
3. ✅ Fill in: Client ID, Client Secret, Pass Key, Organization Shortcode
4. ✅ Click "Save & Sync to Cloud"
5. ✅ Return to POS page
6. ✅ The "KCB BUNI not ready" error disappears
7. ✅ Phone number input becomes visible and enabled
8. ✅ "Send Payment Request" button is now clickable

---

## Files Modified

1. `/src/routes/pos.tsx`
   - Updated validation logic for KCB credentials
   - Fixed Supabase query ID
   - Enhanced error messages
   - Improved UX with conditional rendering

---

## Related Configuration

The KCBSettings interface in `src/lib/settings-types.ts` defines the correct field names:
```typescript
export interface KCBSettings {
  id: string;
  is_enabled: boolean;
  environment: 'sandbox' | 'production';
  client_id: string;              // ✅ Correct field name
  client_secret: string;          // ✅ Correct field name
  org_shortcode: string;          // ✅ Correct field name
  org_passkey: string;            // ✅ Correct field name
  // ... other fields
}
```

---

## Notes

- The fix is backward compatible with existing configurations
- All four fields are now required for full STK Push functionality
- Settings are stored in both IndexedDB (local) and Supabase (cloud)
- Debug logging has been removed from production code
