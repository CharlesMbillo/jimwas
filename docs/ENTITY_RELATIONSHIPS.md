# Jimwas POS - Entity Relationship Diagram & Reference

## Complete ER Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     JIMWAS POS SYSTEM                              │
│                  Entity Relationship Model                          │
└─────────────────────────────────────────────────────────────────────┘

                          ┌────────────────┐
                          │   BRANCHES     │ (Multi-location support)
                          └────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
            ┌──────────────┐          ┌──────────────────┐
            │   USERS      │          │  APP_SETTINGS    │
            │ (Cashiers)   │          │  (Branch config) │
            └──────────────┘          └──────────────────┘
                    │
                    │ (logs actions)
                    ▼
            ┌──────────────────┐
            │  AUDIT_LOGS      │ ◄───── Tracks all operations
            │ (Compliance)     │
            └──────────────────┘
                    ▲
                    │ (records)
                    │
        ┌───────────┴─────────────────────────┐
        │                                     │
        ▼                                     ▼
┌──────────────────┐                ┌──────────────────┐
│  CUSTOMERS       │                │  INVENTORY       │
│                  │                │  SNAPSHOTS       │
└──────────────────┘                └──────────────────┘
        │                                     ▲
        │ (places)                            │ (tracks)
        ▼                                     │
┌──────────────────────────────────────────────────────┐
│           TRANSACTIONS (SALES)                       │
│ ┌────────────────────────────────────────────────┐  │
│ │ • total_amount                                 │  │
│ │ • amount_paid                                  │  │
│ │ • change_amount                                │  │
│ │ • sale_type (standard, wholesale, lipa_mdogo) │  │
│ └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
        │
        ├─────────────────────┬──────────────────┬──────────────┐
        │                     │                  │              │
        ▼                     ▼                  ▼              ▼
┌────────────────┐   ┌──────────────────┐ ┌──────────┐ ┌──────────────┐
│ TRANS. ITEMS   │   │ PAYMENT TRANS.   │ │ RECEIPTS │ │ STOCK MOVE.  │
│ (Sale details) │   │ (Payment record) │ │          │ │ (Inventory)  │
└────────────────┘   └──────────────────┘ └──────────┘ └──────────────┘
        │                     │
        │                     ├─────────┬──────────┬─────────────┐
        │                     │         │          │             │
        │                     ▼         ▼          ▼             ▼
        │            ┌──────────────┐ ┌─────────┐ ┌──────┐ ┌────────────┐
        │            │ KCB_TRANS.   │ │ CASH    │ │ CARD │ │ MPESA_TRANS│
        │            │(KCB STK Push)│ │ (Cash)  │ │(Card)│ │(Legacy)    │
        │            └──────────────┘ └─────────┘ └──────┘ └────────────┘
        │
        └────────────────┐
                         ▼
             ┌─────────────────────────┐
             │  PRODUCT_CATEGORIES     │
             │ (Hierarchical)          │
             │  (parent_category_id)   │
             └─────────────────────────┘
                         │
                         ▼
             ┌─────────────────────────┐
             │     PRODUCTS            │
             │ • name                  │
             │ • sku                   │
             │ • price                 │
             │ • cost                  │
             │ • stock                 │
             │ • barcode               │
             └─────────────────────────┘
                         │
                         ├──────────────────┬─────────────────┐
                         │                  │                 │
                         ▼                  ▼                 ▼
            ┌──────────────────────┐  ┌──────────────┐  ┌─────────────┐
            │  INSTALLMENT_PLANS   │  │ SALES_TARGETS│  │   STOCK_    │
            │  (Lipa Mdogo)        │  │              │  │ MOVEMENTS   │
            └──────────────────────┘  └──────────────┘  └─────────────┘
                     │
                     ▼
            ┌──────────────────────┐
            │  INSTALLMENT_        │
            │  PAYMENTS            │
            └──────────────────────┘
                     │
                     │ (reference)
                     ▼
            ┌──────────────────────┐
            │  LOYALTY_TRANS.      │
            │  (Points tracking)   │
            └──────────────────────┘
```

## Key Relationships

### 1. Core Sales Flow
```
Customer → Transaction → Transaction Items → Products
                ↓
         Payment → KCB/Cash/Card
                ↓
            Receipt
```

### 2. Payment Method Hierarchy
```
Payment Transaction (parent)
    ├── KCB Transaction (KCB STK Push details)
    ├── Cash Transaction (cash details)
    ├── Card Transaction (card details)
    └── M-Pesa Transaction (legacy support)
```

### 3. Inventory Management
```
Product ← Stock Movements → Transaction Items
      ↓
  Inventory Snapshots (daily)
      ↓
  Sales Targets (reporting)
```

### 4. Installment (Lipa Mdogo) Flow
```
Customer → Installment Plan → Product
              ↓
        Installment Payments
              ↓
        Loyalty Points (rewards)
```

### 5. Audit & Compliance
```
All Operations → Audit Logs ← User
                      ↓
              (Entity, Action, Changes)
                      ↓
              Compliance Reports
```

## Table Relationships Matrix

| From | To | Type | Description |
|------|-------|------|-------------|
| customers | transactions | 1:N | One customer has many transactions |
| transactions | transaction_items | 1:N | One transaction has many items |
| transaction_items | products | N:1 | Many items reference one product |
| transactions | payment_transactions | 1:N | One transaction can have multiple payment records |
| payment_transactions | kcb_transactions | 1:N | One payment links to KCB details |
| payment_transactions | cash_transactions | 1:N | One payment links to cash details |
| payment_transactions | card_transactions | 1:N | One payment links to card details |
| transactions | receipts | 1:1 | One transaction generates one receipt |
| transactions | stock_movements | 1:N | One transaction creates many stock movements |
| products | product_categories | N:1 | Many products in one category |
| product_categories | product_categories | N:1 | Hierarchical category structure |
| customers | installment_plans | 1:N | One customer has many plans |
| installment_plans | installment_payments | 1:N | One plan has many payments |
| installment_plans | products | N:1 | Many plans reference one product |
| customers | loyalty_transactions | 1:N | One customer has many loyalty records |
| users | transactions | 1:N | One cashier processes many transactions |
| branches | users | 1:N | One branch has many staff |
| branches | transactions | 1:N | One branch has many sales |
| all_tables | audit_logs | 1:N | All operations create audit logs |

## Field Definitions

### Payment Transaction Fields
```
payment_transactions {
  id: UUID                          (PK)
  transaction_id: UUID              (FK → transactions)
  payment_method_code: TEXT         (FK → payment_methods.code)
  amount: DECIMAL(12,2)             (Amount paid)
  status: TEXT                      (pending|processing|completed|failed|cancelled)
  reference_number: TEXT            (Receipt/transaction #)
  notes: TEXT                       (Optional notes)
  created_at: TIMESTAMPTZ           (Timestamp)
  updated_at: TIMESTAMPTZ           (Last update)
}
```

### KCB Transaction Fields
```
kcb_transactions {
  id: UUID                          (PK)
  payment_transaction_id: UUID      (FK → payment_transactions)
  checkout_request_id: TEXT UNIQUE  (KCB request ID)
  merchant_request_id: TEXT         (KCB merchant ID)
  phone_number: TEXT                (Customer phone for STK Push)
  amount: DECIMAL(12,2)             (Payment amount)
  status: TEXT                      (pending|processing|success|failed|cancelled|timeout)
  result_code: TEXT                 (KCB result code)
  result_desc: TEXT                 (KCB result description)
  kcb_receipt_number: TEXT          (KCB receipt/ref number)
  customer_id: UUID                 (FK → customers, optional)
  cashier_id: UUID                  (FK → users, optional)
  cashier_name: TEXT                (Cashier name snapshot)
  callback_received: BOOLEAN        (Whether callback was received)
  callback_payload: JSONB           (KCB callback data)
  created_at: TIMESTAMPTZ           (Timestamp)
  updated_at: TIMESTAMPTZ           (Last update)
}
```

### Audit Log Fields
```
audit_logs {
  id: UUID                          (PK)
  user_id: UUID                     (FK → users, nullable)
  action: TEXT                      (sale|refund|void|price_change|stock_adjust|login)
  entity_type: TEXT                 (transaction|product|user|customer)
  entity_id: UUID                   (ID of entity being tracked)
  old_values: JSONB                 (Previous state for updates)
  new_values: JSONB                 (New state for updates)
  changes: TEXT                     (Human-readable description)
  ip_address: INET                  (Client IP)
  user_agent: TEXT                  (Browser/app info)
  branch_id: UUID                   (FK → branches, optional)
  created_at: TIMESTAMPTZ           (Timestamp)
}
```

## Query Examples

### Get All Payments for a Transaction
```sql
SELECT pt.*, kcb.kcb_receipt_number, cash.change_amount, card.card_brand
FROM payment_transactions pt
LEFT JOIN kcb_transactions kcb ON pt.id = kcb.payment_transaction_id
LEFT JOIN cash_transactions cash ON pt.id = cash.payment_transaction_id
LEFT JOIN card_transactions card ON pt.id = card.payment_transaction_id
WHERE pt.transaction_id = $1
ORDER BY pt.created_at;
```

### Get Complete Transaction with All Details
```sql
SELECT 
  t.*, 
  c.name as customer_name,
  json_agg(json_build_object(
    'product_name', ti.product_name,
    'quantity', ti.quantity,
    'unit_price', ti.unit_price
  )) as items,
  pt.payment_method_code,
  kcb.kcb_receipt_number,
  r.receipt_number
FROM transactions t
LEFT JOIN customers c ON t.customer_id = c.id
LEFT JOIN transaction_items ti ON t.id = ti.transaction_id
LEFT JOIN payment_transactions pt ON t.id = pt.transaction_id
LEFT JOIN kcb_transactions kcb ON pt.id = kcb.payment_transaction_id
LEFT JOIN receipts r ON t.id = r.transaction_id
WHERE t.id = $1
GROUP BY t.id, c.id, pt.id, kcb.id, r.id;
```

### Track Audit Trail for a Transaction
```sql
SELECT 
  al.*,
  u.name as user_name
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
WHERE al.entity_type = 'transaction'
  AND al.entity_id = $1
ORDER BY al.created_at DESC;
```

### Get Daily Inventory by Product
```sql
SELECT 
  p.name,
  p.sku,
  isnapshot.quantity_on_hand,
  isnapshot.snapshot_date
FROM inventory_snapshots isnapshot
JOIN products p ON isnapshot.product_id = p.id
WHERE isnapshot.snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY isnapshot.snapshot_date DESC, p.name;
```

## Performance Considerations

### Indexes Created
- `payment_transactions(transaction_id)`
- `payment_transactions(status)`
- `payment_transactions(created_at DESC)`
- `kcb_transactions(checkout_request_id)` UNIQUE
- `kcb_transactions(status)`
- `kcb_transactions(created_at DESC)`
- `kcb_transactions(payment_transaction_id)`
- `audit_logs(entity_type, entity_id)`
- `audit_logs(user_id)`
- `audit_logs(branch_id)`
- `audit_logs(created_at DESC)`

### Query Optimization Tips
1. Always filter by `created_at` or `status` when querying large tables
2. Use pagination for audit logs and historical queries
3. Join to audit_logs only when necessary
4. Consider materializing common queries as views
5. Archive old audit logs periodically

## Data Integrity

### Cascade Deletes
- Deleting a transaction cascades to: transaction_items, payment_transactions, receipts
- Deleting payment_transactions cascades to: kcb_transactions, cash_transactions, card_transactions
- Deleting installment_plans cascades to: installment_payments

### Foreign Key Constraints
- All payment records must reference valid transactions
- All transaction items must reference valid products
- All KCB transactions must reference valid payment_transactions
- Audit logs create soft links (no cascade) to allow historical tracking

### Data Validation
- Payment amount cannot be negative
- Payment status follows state machine (pending → processing → completed/failed)
- Installment amount_paid cannot exceed total_amount
- Stock movements update product.stock atomically
