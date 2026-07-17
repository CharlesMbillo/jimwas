# KCB Payment Integration - Troubleshooting Guide

## Issue: "Payment initiation failed" Error

### Root Cause
The KCB configuration was reading from environment variables instead of the Supabase database where settings are stored via the Settings form.

### Solution Applied ✓
- Configuration module now fetches settings directly from Supabase `kcb_settings` table
- Credentials are loaded at payment initiation time
- Automatic environment detection (sandbox vs production)

---

## Verification Checklist

### Step 1: Verify KCB Settings are Saved
1. Open Jimwas POS → Settings menu
2. Navigate to **Payments** section
3. Ensure you see "KCB BUNI Configuration"
4. Check that all fields are filled:
   - ✓ Enable KCB BUNI toggle is ON
   - ✓ Consumer Key / Client ID (50+ characters)
   - ✓ Consumer Secret / Client Secret (50+ characters)
   - ✓ Organization Shortcode (e.g., "996955")
   - ✓ Organization Passkey (for production mode)
   - ✓ Environment: "Sandbox" or "Production"

### Step 2: Test Payment Initiation
1. Go to POS
2. Add items to cart (e.g., any product)
3. Click **Checkout** button
4. Select **"KCB STK"** payment method (green button)
5. Should show: "KCB SANDBOX / TESTING MODE" badge (if in sandbox)

### Step 3: Verify Configuration Load
1. Click "Charge KES X via KCB" button
2. Modal opens with phone number input
3. Enter test number: **254708374149** (sandbox test number)
4. Click "Send Payment Request"

**Expected outcome:**
- Payment should process without "Payment initiation failed" error
- Modal should show "Processing..." status
- STK Push prompt should appear on test phone
- Transaction should appear in transaction history

---

## Error Messages and Solutions

### Error: "KCB settings not configured"
**Cause:** Settings not found in Supabase  
**Solution:**
1. Go to Settings → Payments
2. Ensure you have entered all KCB credentials
3. Click "Save" button to persist to database
4. Refresh the page and try again

### Error: "KCB configuration incomplete"
**Cause:** Required fields are missing  
**Solution:**
1. Check all fields in Settings → Payments → KCB section
2. Ensure Client ID and Client Secret are filled
3. Ensure Organization Shortcode is filled
4. Save the form
5. Try payment again

### Error: "Supabase client not initialized"
**Cause:** Database connection issue  
**Solution:**
1. Check browser console (F12 → Console tab)
2. Verify you're logged in
3. Check network tab for failed requests
4. Verify Supabase URL and API key in .env.development.local
5. Restart dev server: `npm run dev`

### Error: "Failed to load KCB settings from database"
**Cause:** Supabase query failed  
**Solution:**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for error details
4. Verify kcb_settings table exists in Supabase
5. Run migration: `supabase db push`

---

## How to Test in Sandbox

### Prerequisites
- KCB Client ID and Secret (from KCB)
- Organization Shortcode (from KCB)
- Environment set to "Sandbox" in settings

### Test Payment Flow
1. **Enter Configuration**
   - Settings → Payments → KCB BUNI
   - Use sandbox credentials
   - Set Environment to "Sandbox"
   - Save

2. **Create Test Transaction**
   - Add items to cart
   - Click Checkout
   - Select KCB STK
   - Enter test phone: 254708374149
   - Click "Send Payment Request"

3. **Simulate Payment on Test Phone**
   - On test device, accept STK Push prompt
   - Enter PIN (any 4 digits in sandbox)
   - Transaction completes

4. **Verify in POS**
   - Check transaction history for completed payment
   - Receipt should show in transaction list
   - Amount should match invoice

---

## Configuration Workflow (Fix Applied)

### Before (Broken)
```
User clicks "Charge via KCB"
  ↓
Modal tries to initialize KCB Client
  ↓
Client reads config from environment variables
  ↓
❌ VITE_KCB_CLIENT_ID not found
  ↓
Payment initiation fails
```

### After (Fixed) ✓
```
User clicks "Charge via KCB"
  ↓
Modal calls initializeKCBConfig()
  ↓
Config fetches from Supabase kcb_settings table
  ↓
Settings loaded from database
  ↓
KCB Client initializes with proper credentials
  ↓
✓ STK Push sent successfully
```

---

## Development Notes

### Configuration Loading
- **File:** `src/lib/modules/payments/kcb/config.ts`
- **Load Method:** Async Supabase query on payment initiation
- **Cache:** Single load, reused within session
- **Reset:** Requires page refresh

### Database Tables
- **kcb_settings:** Main configuration (id = 'kcb-settings')
- **kcb_payment_transactions:** Transaction history
- **kcb_payment_callbacks:** IPN callback audit log

### Key Functions
```typescript
// Initialize config from Supabase (call this first)
await initializeKCBConfig()

// Get loaded config
getKCBConfig() // Returns KCBConfig object

// Check if configured
isKCBConfigured() // Returns boolean
```

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Settings not saving | Clear browser cache, check Supabase connection |
| Config loads but payment fails | Check Client ID/Secret format and validity |
| STK not appearing on phone | Verify phone number format (254XXXXXXXXX) |
| Transaction doesn't complete | Check KCB account balance/credits |
| Payment modal won't open | Clear browser cache, refresh page |

---

## Testing Commands

```bash
# Check build
npm run build

# Run dev server
npm run dev

# Type check
npm run typecheck

# View git changes
git log --oneline -10
```

---

## Support

If issues persist:
1. Check browser console (F12 → Console)
2. Review network requests (F12 → Network)
3. Check Supabase logs
4. Verify all KCB credentials are correct
5. Ensure environment is "Sandbox" for testing
