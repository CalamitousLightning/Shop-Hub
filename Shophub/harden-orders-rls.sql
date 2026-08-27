-- =========================================================
-- LUC Marketplace — RLS hardening patch
-- Run in Supabase SQL Editor. Safe to run any time after setup.sql.
--
-- Problem: the original "Users can insert their own orders" policy only
-- checked user_id = auth.uid() — it did NOT restrict what a customer
-- could put in payment_status or order_status. A user who bypassed the
-- website and called Supabase directly could insert an order with
-- payment_status = 'paid' without ever paying.
--
-- Fix: every new order must start as pending/processing. Only the
-- Netlify functions (service role key) or the admin dashboard (matching
-- admin email) can move it to 'paid' afterwards.
-- =========================================================

drop policy if exists "Users can insert their own orders" on luc_orders;

create policy "Users can insert their own orders"
  on luc_orders for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and payment_status = 'pending'
    and order_status = 'processing'
  );
