/*
# Fix RLS Security Issues

## Summary
Resolves all RLS security warnings flagged by the security scanner:
1. Enables RLS on the orphaned `roles` table.
2. Replaces all permissive `USING (true)` / `WITH CHECK (true)` policies with real ownership predicates based on the authenticated user's role in `pos_users`.

## Context
The POS app uses Supabase email/password authentication. Each authenticated user has a matching row in `pos_users` with a `role` column (admin, manager, cashier). This migration links `auth.users` to `pos_users` via a new `auth_user_id` column and writes policies that:

- Allow authenticated users to read all POS data (shared single-tenant POS).
- Restrict writes based on role:
  - Cashiers: can create transactions, customers, and create (but not approve) void/approval requests. Cannot modify products, pos_users, mpesa_settings, or approve requests.
  - Managers + Admins: full CRUD on all tables.

## Changes
1. `pos_users`: added `auth_user_id uuid` column linking to `auth.users.id`.
2. `roles` table: RLS enabled, SELECT-only policy.
3. All tables: old permissive policies dropped and replaced with role-based predicates.
4. Helper functions: `pos_user_role()`, `pos_user_is_manager_or_admin()`, `pos_user_is_staff()`.

## Security
- RLS enabled on `roles`.
- All write policies use role-based predicates — no bare `true` checks.
- Audit log and mpesa_settings are immutable/deletion-proof via RLS.
*/

-- ─── Step 1: Add auth_user_id column to pos_users ───────────────────
ALTER TABLE pos_users ADD COLUMN IF NOT EXISTS auth_user_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS pos_users_auth_user_id_idx
  ON pos_users (auth_user_id) WHERE auth_user_id IS NOT NULL;

-- ─── Step 2: Helper functions ───────────────────────────────────────
-- pos_user_role(): returns the current user's POS role (admin/manager/cashier) or NULL.
CREATE OR REPLACE FUNCTION public.pos_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM pos_users WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.pos_user_is_manager_or_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.pos_user_role() IN ('admin', 'manager');
$$;

CREATE OR REPLACE FUNCTION public.pos_user_is_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.pos_user_role() IN ('admin', 'manager', 'cashier');
$$;

-- ─── Step 3: roles table — enable RLS + SELECT-only ─────────────────
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roles_select" ON roles;
CREATE POLICY "roles_select" ON roles FOR SELECT
  TO authenticated USING (true);

-- ─── Step 4: pos_users policies ─────────────────────────────────────
DROP POLICY IF EXISTS "pos_users_select" ON pos_users;
DROP POLICY IF EXISTS "pos_users_insert" ON pos_users;
DROP POLICY IF EXISTS "pos_users_update" ON pos_users;
DROP POLICY IF EXISTS "pos_users_delete" ON pos_users;

CREATE POLICY "pos_users_select" ON pos_users FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "pos_users_insert" ON pos_users FOR INSERT
  TO authenticated WITH CHECK (public.pos_user_is_manager_or_admin());

CREATE POLICY "pos_users_update" ON pos_users FOR UPDATE
  TO authenticated USING (public.pos_user_is_manager_or_admin())
  WITH CHECK (public.pos_user_is_manager_or_admin());

CREATE POLICY "pos_users_delete" ON pos_users FOR DELETE
  TO authenticated USING (public.pos_user_is_manager_or_admin());

-- ─── products policies ──────────────────────────────────────────────
DROP POLICY IF EXISTS "products_select" ON products;
DROP POLICY IF EXISTS "products_insert" ON products;
DROP POLICY IF EXISTS "products_update" ON products;
DROP POLICY IF EXISTS "products_delete" ON products;

CREATE POLICY "products_select" ON products FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "products_insert" ON products FOR INSERT
  TO authenticated WITH CHECK (public.pos_user_is_manager_or_admin());

CREATE POLICY "products_update" ON products FOR UPDATE
  TO authenticated USING (public.pos_user_is_manager_or_admin())
  WITH CHECK (public.pos_user_is_manager_or_admin());

CREATE POLICY "products_delete" ON products FOR DELETE
  TO authenticated USING (public.pos_user_is_manager_or_admin());

-- ─── customers policies ─────────────────────────────────────────────
DROP POLICY IF EXISTS "customers_select" ON customers;
DROP POLICY IF EXISTS "customers_insert" ON customers;
DROP POLICY IF EXISTS "customers_update" ON customers;
DROP POLICY IF EXISTS "customers_delete" ON customers;

CREATE POLICY "customers_select" ON customers FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "customers_insert" ON customers FOR INSERT
  TO authenticated WITH CHECK (public.pos_user_is_staff());

CREATE POLICY "customers_update" ON customers FOR UPDATE
  TO authenticated USING (public.pos_user_is_staff())
  WITH CHECK (public.pos_user_is_staff());

CREATE POLICY "customers_delete" ON customers FOR DELETE
  TO authenticated USING (public.pos_user_is_manager_or_admin());

-- ─── transactions policies ──────────────────────────────────────────
DROP POLICY IF EXISTS "transactions_select" ON transactions;
DROP POLICY IF EXISTS "transactions_insert" ON transactions;
DROP POLICY IF EXISTS "transactions_update" ON transactions;
DROP POLICY IF EXISTS "transactions_delete" ON transactions;

CREATE POLICY "transactions_select" ON transactions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "transactions_insert" ON transactions FOR INSERT
  TO authenticated WITH CHECK (public.pos_user_is_staff());

CREATE POLICY "transactions_update" ON transactions FOR UPDATE
  TO authenticated USING (public.pos_user_is_manager_or_admin())
  WITH CHECK (public.pos_user_is_manager_or_admin());

CREATE POLICY "transactions_delete" ON transactions FOR DELETE
  TO authenticated USING (public.pos_user_is_manager_or_admin());

-- ─── transaction_items policies ─────────────────────────────────────
DROP POLICY IF EXISTS "transaction_items_select" ON transaction_items;
DROP POLICY IF EXISTS "transaction_items_insert" ON transaction_items;
DROP POLICY IF EXISTS "transaction_items_update" ON transaction_items;
DROP POLICY IF EXISTS "transaction_items_delete" ON transaction_items;

CREATE POLICY "transaction_items_select" ON transaction_items FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "transaction_items_insert" ON transaction_items FOR INSERT
  TO authenticated WITH CHECK (public.pos_user_is_staff());

CREATE POLICY "transaction_items_update" ON transaction_items FOR UPDATE
  TO authenticated USING (public.pos_user_is_manager_or_admin())
  WITH CHECK (public.pos_user_is_manager_or_admin());

CREATE POLICY "transaction_items_delete" ON transaction_items FOR DELETE
  TO authenticated USING (public.pos_user_is_manager_or_admin());

-- ─── approval_requests policies ─────────────────────────────────────
DROP POLICY IF EXISTS "approval_requests_select" ON approval_requests;
DROP POLICY IF EXISTS "approval_requests_insert" ON approval_requests;
DROP POLICY IF EXISTS "approval_requests_update" ON approval_requests;
DROP POLICY IF EXISTS "approval_requests_delete" ON approval_requests;

CREATE POLICY "approval_requests_select" ON approval_requests FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "approval_requests_insert" ON approval_requests FOR INSERT
  TO authenticated WITH CHECK (public.pos_user_is_staff());

CREATE POLICY "approval_requests_update" ON approval_requests FOR UPDATE
  TO authenticated USING (public.pos_user_is_manager_or_admin())
  WITH CHECK (public.pos_user_is_manager_or_admin());

CREATE POLICY "approval_requests_delete" ON approval_requests FOR DELETE
  TO authenticated USING (public.pos_user_is_manager_or_admin());

-- ─── void_requests policies ─────────────────────────────────────────
DROP POLICY IF EXISTS "void_requests_select" ON void_requests;
DROP POLICY IF EXISTS "void_requests_insert" ON void_requests;
DROP POLICY IF EXISTS "void_requests_update" ON void_requests;
DROP POLICY IF EXISTS "void_requests_delete" ON void_requests;

CREATE POLICY "void_requests_select" ON void_requests FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "void_requests_insert" ON void_requests FOR INSERT
  TO authenticated WITH CHECK (public.pos_user_is_staff());

CREATE POLICY "void_requests_update" ON void_requests FOR UPDATE
  TO authenticated USING (public.pos_user_is_manager_or_admin())
  WITH CHECK (public.pos_user_is_manager_or_admin());

CREATE POLICY "void_requests_delete" ON void_requests FOR DELETE
  TO authenticated USING (public.pos_user_is_manager_or_admin());

-- ─── audit_log policies ─────────────────────────────────────────────
DROP POLICY IF EXISTS "audit_log_select" ON audit_log;
DROP POLICY IF EXISTS "audit_log_insert" ON audit_log;
DROP POLICY IF EXISTS "audit_log_update" ON audit_log;
DROP POLICY IF EXISTS "audit_log_delete" ON audit_log;

CREATE POLICY "audit_log_select" ON audit_log FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "audit_log_insert" ON audit_log FOR INSERT
  TO authenticated WITH CHECK (public.pos_user_is_staff());

-- Audit log is immutable — no updates or deletes
CREATE POLICY "audit_log_update" ON audit_log FOR UPDATE
  TO authenticated USING (false);

CREATE POLICY "audit_log_delete" ON audit_log FOR DELETE
  TO authenticated USING (false);

-- ─── mpesa_settings policies ────────────────────────────────────────
DROP POLICY IF EXISTS "mpesa_settings_select" ON mpesa_settings;
DROP POLICY IF EXISTS "mpesa_settings_insert" ON mpesa_settings;
DROP POLICY IF EXISTS "mpesa_settings_update" ON mpesa_settings;
DROP POLICY IF EXISTS "mpesa_settings_delete" ON mpesa_settings;

CREATE POLICY "mpesa_settings_select" ON mpesa_settings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "mpesa_settings_insert" ON mpesa_settings FOR INSERT
  TO authenticated WITH CHECK (public.pos_user_is_manager_or_admin());

CREATE POLICY "mpesa_settings_update" ON mpesa_settings FOR UPDATE
  TO authenticated USING (public.pos_user_is_manager_or_admin())
  WITH CHECK (public.pos_user_is_manager_or_admin());

-- M-Pesa settings should never be deleted
CREATE POLICY "mpesa_settings_delete" ON mpesa_settings FOR DELETE
  TO authenticated USING (false);
