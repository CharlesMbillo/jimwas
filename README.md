# Jimwas POS

A point-of-sale system for a plant nursery business, built with React, Vite, and Supabase. Supports cash/M-Pesa/card checkout, wholesale pricing, role-based void approvals, product inventory with stock tracking, and KCB BUNI M-Pesa Express STK Push integration.

---

## Features

### Sales
- **New Sale checkout** — search products by name or SKU, add to cart, adjust quantities, select customer and payment method (cash, M-Pesa, card)
- **Sale types** — Standard and Wholesale (wholesale uses the product's wholesale price when available)
- **Cash change calculation** — enter amount paid, see change due automatically
- **Automatic stock deduction** — completing a sale decrements product inventory in real time

### Dashboard
- Today's revenue and sales count
- Total revenue and customer count
- Recent transactions table with void action
- Low-stock alerts (products at or below 5 units)

### Products
- Full product catalog with name, SKU, price, wholesale price, stock quantity, and category
- Add and edit products (managers/admins only)
- Low-stock highlighting in red

### Customers
- Customer registry with name, phone, email, and notes
- Walk-in customer supported by default
- Select customer at checkout

### Void Requests (Approval Workflow)
- Any staff member can request a void on a completed transaction
- Void requests require approval from a manager or admin
- On approval: transaction status changes to `voided`, stock is restored, and an audit log entry is created
- On rejection: a rejection reason is recorded
- Full void history with statuses (pending, completed, rejected)

### M-Pesa Settings (STK Push)
- KCB BUNI M-Pesa Express API configuration page
- Fields: business shortcode, passkey, consumer key, consumer secret, callback URL, environment (sandbox/production), initiator name, security credential
- Enable/disable toggle for M-Pesa STK Push
- Show/hide secrets toggle for sensitive fields
- **Settings persist in Supabase** — they survive app restarts because they are stored in the `mpesa_settings` table, not in localStorage or in-memory state

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| Routing | React Router v6 |
| Styling | Tailwind CSS |
| Icons | lucide-react |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password) |
| Edge Functions | Supabase Edge Functions (Deno) |

---

## Project Structure

```
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── main.tsx                    # App entry point
    ├── App.tsx                     # Router + protected routes
    ├── index.css                   # Tailwind directives + global styles
    ├── vite-env.d.ts               # Vite env type declarations
    ├── context/
    │   └── AuthContext.tsx         # Supabase Auth session management
    ├── components/
    │   ├── Layout.tsx              # Sidebar navigation + role-based menu
    │   └── VoidTransactionModal.tsx
    ├── lib/
    │   ├── supabase.ts             # Supabase client singleton
    │   ├── types.ts                # TypeScript interfaces for all tables
    │   ├── db.ts                   # Database CRUD functions
    │   ├── approvals.ts            # Void request + approval workflow logic
    │   └── permissions.ts          # Role-based permission helpers
    └── routes/
        ├── login.tsx               # Sign-in page
        ├── dashboard.tsx           # Stats + recent transactions
        ├── pos.tsx                 # New Sale checkout
        ├── products.tsx            # Product catalog management
        ├── customers.tsx           # Customer registry
        ├── void-requests.tsx       # Void approval queue + history
        └── settings.tsx            # M-Pesa STK Push configuration
└── supabase/
    └── functions/
        └── mpesa-stk-push/
            └── index.ts            # STK Push edge function
```

---

## Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `pos_users` | Staff accounts with role (admin, manager, cashier). Linked to `auth.users` via `auth_user_id`. |
| `products` | Product catalog with price, wholesale price, stock quantity, and category. |
| `customers` | Customer registry with contact info. |
| `transactions` | Sales records with total, payment method, sale type, and status (completed/voided). |
| `transaction_items` | Line items per transaction (product, quantity, unit price, subtotal). |
| `void_requests` | Void request records with reason, status, and approver info. |
| `approval_requests` | Generic approval workflow records (currently used for voids). |
| `audit_log` | Immutable audit trail of actions (void requested, void executed, void rejected). |
| `mpesa_settings` | Singleton row storing KCB BUNI M-Pesa Express API configuration. |
| `roles` | Orphaned table (not used by the app, RLS enabled for security compliance). |

### Key Relationships

- `transactions.customer_id` → `customers.id`
- `transactions.cashier_id` → `pos_users.id`
- `transaction_items.transaction_id` → `transactions.id` (CASCADE)
- `transaction_items.product_id` → `products.id`
- `void_requests.transaction_id` → `transactions.id` (CASCADE)
- `void_requests.approval_request_id` → `approval_requests.id`
- `pos_users.auth_user_id` → `auth.users.id`

---

## Authentication & Roles

### Login

The app uses Supabase Auth (email/password). Three seeded accounts are available:

| Role | Email | Password | Access |
|------|-------|----------|--------|
| Admin | admin@jimwas.co.ke | jimwas123 | Full access to all features |
| Manager | manager@jimwas.co.ke | jimwas123 | Products, void approvals, settings, sales |
| Cashier | cashier@jimwas.co.ke | jimwas123 | Sales, customers, request voids (no approvals) |

Use the quick-login buttons on the login page to auto-fill credentials.

### Role Permissions

| Action | Admin | Manager | Cashier |
|--------|-------|---------|---------|
| View dashboard | Yes | Yes | Yes |
| Create sales | Yes | Yes | Yes |
| Manage products | Yes | Yes | No |
| Manage customers | Yes | Yes | Yes |
| Request void | Yes | Yes | Yes |
| Approve/reject void | Yes | Yes | No |
| View void requests | Yes | Yes | No |
| Manage M-Pesa settings | Yes | Yes | No |

---

## Row Level Security (RLS)

RLS is enabled on every table. Policies use SQL helper functions that resolve the authenticated user's role from `pos_users.auth_user_id`:

- `pos_user_role()` — returns the current user's role (admin/manager/cashier) or NULL
- `pos_user_is_manager_or_admin()` — returns true if the user is a manager or admin
- `pos_user_is_staff()` — returns true if the user is any role (admin/manager/cashier)

**Policy structure:**

- **SELECT** — all authenticated users can read all POS data (shared single-tenant model)
- **INSERT** — staff can create transactions, customers, and void/approval requests; only managers/admins can create products and pos_users
- **UPDATE** — managers/admins only for products, transactions (voiding), approval requests, void requests, and M-Pesa settings
- **DELETE** — managers/admins for most tables; `audit_log` and `mpesa_settings` use `USING (false)` making them undeletable via RLS

---

## M-Pesa STK Push Integration

### Edge Function: `mpesa-stk-push`

Deployed at `supabase/functions/mpesa-stk-push/index.ts`. Handles STK Push payment initiation:

1. Reads M-Pesa settings from the `mpesa_settings` table
2. Checks if M-Pesa is enabled (returns error if disabled)
3. Gets an OAuth access token from Safaricom (sandbox or production)
4. Generates the password (base64 of shortcode + passkey + timestamp)
5. Sends the STK Push request to the Safaricom API
6. Returns the response to the frontend

**Request body:**

```json
{
  "phone": "0712345678",
  "amount": 5000,
  "accountReference": "Jimwas POS",
  "transactionDesc": "Payment for goods"
}
```

**Settings persistence:** M-Pesa settings are stored in the `mpesa_settings` table as a singleton row. When the Settings page loads, it reads from the database. When the user clicks "Save Settings", it upserts to the database. Settings survive app restarts because they live in Supabase, not in browser storage.

---

## Getting Started

The dev server runs automatically. To verify the build locally:

```bash
npm install
npm run build
```

Environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are pre-populated by the platform and injected at runtime.

---

## Seeded Data

On first load, the database contains:

- **3 staff users** (admin, manager, cashier) — linked to Supabase Auth accounts
- **6 products** — plants (Nduma Zebra, Fiddle Leaf Fig, Snake Plant, Monstera), supplies (Potting Mix), and pots (Ceramic Pot)
- **3 customers** — Walk-in Customer, Alice Njeri, Bob Kamau
- **3 sample transactions** — with line items, spanning cash/M-Pesa/card payments

---

## Edge Functions

| Function | Purpose | JWT |
|----------|---------|-----|
| `mpesa-stk-push` | Initiates M-Pesa STK Push payment via Safaricom API | Not required |

All edge functions include mandatory CORS headers on every response (preflight, success, and error).
