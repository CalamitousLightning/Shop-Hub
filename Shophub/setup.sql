-- =========================================================
-- LUC Marketplace — Supabase setup script
-- Run this in: Supabase Dashboard -> SQL Editor -> New query
--
-- This ONLY creates new tables (luc_products, luc_orders) and a
-- new storage bucket (luc-product-images). It does NOT touch the
-- existing SwapZone "products" table or bucket.
--
-- BEFORE RUNNING: replace every occurrence of 'YOUR_ADMIN_EMAIL'
-- below with the exact email you set as window.LUC_ADMIN_EMAIL
-- in supabase-config.js.
-- =========================================================

-- 1. Products table
create table if not exists luc_products (
  id uuid primary key default gen_random_uuid(),
  image_url text,
  name text not null,
  description text,
  category text not null,
  price numeric(10,2) not null default 0,
  stock integer not null default 0,
  created_at timestamptz not null default now()
);

alter table luc_products enable row level security;

create policy "Public can view LUC products"
  on luc_products for select
  using (true);

create policy "Admin can insert LUC products"
  on luc_products for insert
  to authenticated
  with check (auth.jwt() ->> 'email' = 'YOUR_ADMIN_EMAIL');

create policy "Admin can update LUC products"
  on luc_products for update
  to authenticated
  using (auth.jwt() ->> 'email' = 'YOUR_ADMIN_EMAIL');

create policy "Admin can delete LUC products"
  on luc_products for delete
  to authenticated
  using (auth.jwt() ->> 'email' = 'YOUR_ADMIN_EMAIL');

-- 2. Orders table
create table if not exists luc_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  delivery_address text not null,
  items jsonb not null,
  total numeric(10,2) not null default 0,
  payment_method text not null check (payment_method in ('paystack', 'whatsapp')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed')),
  paystack_reference text,
  order_status text not null default 'processing'
    check (order_status in ('processing', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  created_at timestamptz not null default now()
);

alter table luc_orders enable row level security;

-- Customers can create their own orders
create policy "Users can insert their own orders"
  on luc_orders for insert
  to authenticated
  with check (user_id = auth.uid());

-- Customers can view only their own orders
create policy "Users can view their own orders"
  on luc_orders for select
  to authenticated
  using (user_id = auth.uid());

-- Admin can view every order
create policy "Admin can view all orders"
  on luc_orders for select
  to authenticated
  using (auth.jwt() ->> 'email' = 'YOUR_ADMIN_EMAIL');

-- Admin can update order status (e.g. mark shipped/delivered)
create policy "Admin can update orders"
  on luc_orders for update
  to authenticated
  using (auth.jwt() ->> 'email' = 'YOUR_ADMIN_EMAIL');

-- =========================================================
-- STORAGE: luc-product-images bucket
-- Create the bucket first from the Dashboard UI:
-- Storage -> New bucket -> name: luc-product-images -> Public bucket: ON
-- Then run the policies below.
-- =========================================================

create policy "Public can view LUC product images"
  on storage.objects for select
  using (bucket_id = 'luc-product-images');

create policy "Admin can upload LUC product images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'luc-product-images' and auth.jwt() ->> 'email' = 'YOUR_ADMIN_EMAIL');

create policy "Admin can delete LUC product images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'luc-product-images' and auth.jwt() ->> 'email' = 'YOUR_ADMIN_EMAIL');
