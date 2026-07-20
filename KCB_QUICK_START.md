# KCB M-Pesa Integration - Quick Start Guide

## 5-Minute Setup

### 1. Database Migration (1 minute)
```bash
# Run this in Supabase CLI or dashboard
supabase migration up 20260717_kcb_payment_tables

# Verify tables created
SELECT tablename FROM pg_tables WHERE tablename LIKE 'kcb%';
```

### 2. Configure KCB Credentials (2 minutes)
Go to **Settings › Payments › KCB BUNI**

```
Client ID:      [Get from KCB portal]
Client Secret:  [Get from KCB portal]
Short Code:     [Your merchant code]
Passkey:        [Your merchant passkey - production only]
Environment:    sandbox (for testing)
```

### 3. Test Payment (2 minutes)
1. Open **POS Terminal**
2. Add items to cart
3. Select **KCB M-Pesa** payment method
4. Enter phone: `254708374149` (test phone)
5. Click **Charge** button
6. Modal appears → Enter any 4-digit PIN
7. Success! Check **Transaction History**

---

## Key Files

| File | Purpose |
|------|---------|
| `src/components/KCBPaymentModal.tsx` | Payment flow UI |
| `src/components/KCBTransactionHistory.tsx` | Transaction list |
| `src/lib/modules/payments/kcb/` | Core payment logic |
| `src/lib/db.ts` | Database functions |
| `supabase/migrations/20260717_kcb_payment_tables.sql` | Database schema |

---

## API Reference

### Save Transaction
```typescript
const tx = await saveKCBPaymentTransaction({
  message_id: "msg_...",
  correlation_id: "corr_...",
  phone_number: "254712345678",
  amount: 50000,  // in cents
  invoice_number: "INV-001",
  status: 'pending',
  ipn_received: false,
  retry_count: 0,
  should_poll: true,
});
```

### Get Pending Transactions
```typescript
const pending = await getKCBPendingTransactions();
pending.forEach(tx => {
  console.log(`${tx.phone_number}: ${tx.status}`);
});
```

### Update Status
```typescript
await updateKCBTransactionStatus(tx.id, 'success', {
  mpesa_receipt_number: 'LFYD2L8ZJK2',
  ipn_received: true,
});
```

### Get Statistics
```typescript
const stats = await getKCBPaymentStats();
console.log(`Success: ${stats.total_success}`);
console.log(`Failed: ${stats.total_failed}`);
console.log(`Total: KES ${stats.total_amount_success / 100}`);
```

---

## Component Usage

### Payment Modal
```tsx
import { KCBPaymentModal } from '../components/KCBPaymentModal';

function MyComponent() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button onClick={() => setShowModal(true)}>
        Pay with M-Pesa
      </button>
      
      <KCBPaymentModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onPaymentComplete={(tx) => {
          console.log('Payment success:', tx.mpesa_receipt_number);
        }}
        amount={500}
        invoiceNumber="INV-001"
        description="Purchase"
      />
    </>
  );
}
```

### Transaction History
```tsx
import { KCBTransactionHistory } from '../components/KCBTransactionHistory';

export function Dashboard() {
  return (
    <div>
      <h2>Recent Payments</h2>
      <KCBTransactionHistory maxHeight="max-h-96" />
    </div>
  );
}
```

---

## Testing Checklist

- [ ] Database tables created and accessible
- [ ] KCB credentials configured in settings
- [ ] Environment set to "sandbox"
- [ ] Payment modal opens from POS
- [ ] Phone number validation works
- [ ] STK Push request succeeds
- [ ] Polling updates transaction status
- [ ] Success/failure screens display correctly
- [ ] Transaction appears in history
- [ ] Can export CSV from history

---

## Environment Variables

```env
# In Settings › Vars
VITE_KCB_CLIENT_ID=your_client_id
VITE_KCB_CLIENT_SECRET=your_client_secret
VITE_KCB_ORG_SHORTCODE=your_shortcode
VITE_KCB_ENVIRONMENT=sandbox  # or production
```

---

## Debugging

### Check Console Logs
```javascript
// Look for [v0] prefixed messages
[v0] Initiating STK Push...
[v0] Payment status: pending
[v0] IPN callback received
```

### Inspect Database
```sql
-- Latest transactions
SELECT id, phone_number, status, created_at 
FROM kcb_payment_transactions 
ORDER BY created_at DESC 
LIMIT 10;

-- Failed transactions
SELECT id, phone_number, kcb_error_message, created_at
FROM kcb_payment_transactions
WHERE status = 'failed';

-- IPN callbacks
SELECT transaction_id, signature_valid, processed
FROM kcb_payment_callbacks;
```

### Common Errors

**"KCB BUNI not configured"**
- Check Settings › Payments › KCB
- All 4 credentials must be filled
- Environment must be set

**"Invalid phone number"**
- Accept: `0712345678`, `254712345678`, `254 712 345 678`
- Must start with 07 or 254

**"Payment timeout"**
- Check internet connection
- Verify KCB API is accessible
- Try again with a different phone

---

## Production Deployment

1. **Switch to Production Credentials**
   - Settings › Payments › KCB › Environment: `production`
   - Add production passkey

2. **Configure Callback URL**
   - KCB Portal › Settings › Callback URL
   - Set to: `https://yourdomain.com/api/kcb/callback`

3. **Test with Live Transaction**
   - Use real phone number
   - Monitor transaction in database
   - Check IPN callback is received

4. **Monitor**
   - Watch for failed payments
   - Track success rate
   - Review error logs

---

## Support

**Documentation:**
- Full guide: `KCB_BUNI_IMPLEMENTATION_COMPLETE.md`
- Audit report: `KCB_BUNI_AUDIT_REPORT_2026.md`
- Next steps: `KCB_BUNI_NEXT_STEPS_GUIDE.md`

**Code Examples:**
- Modal: `src/components/KCBPaymentModal.tsx`
- History: `src/components/KCBTransactionHistory.tsx`
- Database: `src/lib/db.ts` (search for `KCB`)

**Contact:**
- Check git history for decision context
- Review inline code comments
- Check Supabase logs for API errors

---

**Last Updated:** July 17, 2026  
**Status:** Production Ready
