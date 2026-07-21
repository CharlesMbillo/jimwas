# Quick Start: KCB M-Pesa Payment Integration

## Summary of What Was Fixed

| Issue | Status | Solution |
|-------|--------|----------|
| "Could not find table 'public.kcb_settings'" | ✅ Fixed | Created migration with kcb_settings table in Supabase |
| Missing simulate button for testing | ✅ Added | Added blue "Simulate Payment" button in KCB Payment Modal |
| Settings not persistent | ✅ Already working | Verified Supabase storage is configured |
| API alignment | ✅ Verified | All KCB M-Pesa API fields properly configured |

---

## Test the Payment Flow

### Option 1: Simulate Payment (Recommended for Testing)

1. Click **Pay** button on invoice
2. Select **KCB M-Pesa**
3. Enter phone: `0712345678`
4. Click **Simulate Payment** (blue button)
5. ✅ Payment shows as successful

### Option 2: Real M-Pesa Payment (Requires Setup)

1. Go to **Settings > Payments > KCB BUNI**
2. Enter your KCB credentials:
   - Client ID
   - Client Secret
   - Organization Shortcode
   - Organization Passkey
3. Save settings
4. Click **Pay** button
5. Select **KCB M-Pesa**
6. Click **Send STK Push**
7. Enter M-Pesa PIN on phone

---

## Key Features Added

### Simulate Payment Button
- **Location:** KCB Payment Modal (next to Send STK Push)
- **Color:** Blue (to distinguish from live payment)
- **Use Case:** Testing, demos, training
- **No API Required:** Works without KCB configuration
- **Instant:** Completes in ~2 seconds

### KCB Settings Storage
- **Database:** Supabase table `kcb_settings`
- **Fields:** OAuth credentials, M-Pesa config, environment settings
- **Persistence:** Auto-saved to database
- **Security:** RLS policies enabled

---

## Configuration Steps

### For Development/Testing:
```
Environment: sandbox
Client ID: (leave empty for simulate mode)
Client Secret: (leave empty for simulate mode)
```

### For Production:
```
Environment: production
Client ID: [your_kcb_client_id]
Client Secret: [your_kcb_client_secret]
Organization Shortcode: [your_mpesa_shortcode]
Organization Passkey: [your_mpesa_passkey]
```

---

## Files Changed

1. **Created:** `supabase/migrations/20260721_kcb_settings_table.sql`
   - Database migration for kcb_settings table

2. **Modified:** `src/components/KCBPaymentModal.tsx`
   - Added handleSimulatePayment() function
   - Added Simulate Payment button to UI

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Settings not found" error | Go to Settings > Payments > KCB BUNI and save any field |
| Simulate button disabled | Enter valid phone number (e.g., 0712345678) |
| Payment not showing in history | Refresh the page or wait for IndexedDB sync |
| Real payment fails | Check KCB API credentials in Settings |

---

## Next Steps

1. ✅ Test with **Simulate Payment** button
2. ✅ Verify transaction appears in history
3. ✅ Go to Settings and configure KCB credentials
4. ✅ Switch environment to production
5. ✅ Test with real M-Pesa STK Push

---

## Support Resources

- **Full Documentation:** See `KCB_SETTINGS_TABLE_FIX.md`
- **API Reference:** See `KCB_QUICK_REFERENCE.md`
- **Alignment Details:** See `KCB_MPESA_ALIGNMENT_ANALYSIS.md`
