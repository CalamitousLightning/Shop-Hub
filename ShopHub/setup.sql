-- =========================================================
-- ShopHub Marketplace — Supabase setup script
-- Run this in: Supabase Dashboard -> SQL Editor -> New query
-- Safe to re-run: every policy is dropped (if it exists) before
-- being recreated, so running this script twice will not error.
--
-- This ONLY creates the shophub_products and shophub_orders tables and a
-- new storage bucket (shophub-product-images). Safe to run on a fresh
-- Supabase project.
--
-- BEFORE RUNNING: replace every occurrence of 'YOUR_ADMIN_EMAIL'
-- below with the exact email you set as window.SHOPHUB_ADMIN_EMAIL
-- in supabase-config.js.
-- =========================================================

-- 1. Products table
create table if not exists shophub_products (
  id uuid primary key default gen_random_uuid(),
  image_url text,
  name text not null,
  description text,
  category text not null,
  price numeric(10,2) not null default 0,
  stock integer not null default 0,
  created_at timestamptz not null default now()
);

alter table shophub_products enable row level security;

drop policy if exists "Public can view ShopHub products" on shophub_products;
create policy "Public can view ShopHub products"
  on shophub_products for select
  using (true);

drop policy if exists "Admin can insert ShopHub products" on shophub_products;
create policy "Admin can insert ShopHub products"
  on shophub_products for insert
  to authenticated
  with check (auth.jwt() ->> 'email' = 'YOUR_ADMIN_EMAIL');

drop policy if exists "Admin can update ShopHub products" on shophub_products;
create policy "Admin can update ShopHub products"
  on shophub_products for update
  to authenticated
  using (auth.jwt() ->> 'email' = 'YOUR_ADMIN_EMAIL');

drop policy if exists "Admin can delete ShopHub products" on shophub_products;
create policy "Admin can delete ShopHub products"
  on shophub_products for delete
  to authenticated
  using (auth.jwt() ->> 'email' = 'YOUR_ADMIN_EMAIL');

-- 2. Orders table
create table if not exists shophub_orders (
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

alter table shophub_orders enable row level security;

-- Customers can create their own orders
drop policy if exists "Users can insert their own orders" on shophub_orders;
create policy "Users can insert their own orders"
  on shophub_orders for insert
  to authenticated
  with check (user_id = auth.uid());

-- Customers can view only their own orders
drop policy if exists "Users can view their own orders" on shophub_orders;
create policy "Users can view their own orders"
  on shophub_orders for select
  to authenticated
  using (user_id = auth.uid());

-- Admin can view every order
drop policy if exists "Admin can view all orders" on shophub_orders;
create policy "Admin can view all orders"
  on shophub_orders for select
  to authenticated
  using (auth.jwt() ->> 'email' = 'YOUR_ADMIN_EMAIL');

-- Admin can update order status (e.g. mark shipped/delivered)
drop policy if exists "Admin can update orders" on shophub_orders;
create policy "Admin can update orders"
  on shophub_orders for update
  to authenticated
  using (auth.jwt() ->> 'email' = 'YOUR_ADMIN_EMAIL');

-- =========================================================
-- STORAGE: shophub-product-images bucket
-- Create the bucket first from the Dashboard UI:
-- Storage -> New bucket -> name: shophub-product-images -> Public bucket: ON
-- Then run the policies below.
-- =========================================================

drop policy if exists "Public can view ShopHub product images" on storage.objects;
create policy "Public can view ShopHub product images"
  on storage.objects for select
  using (bucket_id = 'shophub-product-images');

drop policy if exists "Admin can upload ShopHub product images" on storage.objects;
create policy "Admin can upload ShopHub product images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'shophub-product-images' and auth.jwt() ->> 'email' = 'YOUR_ADMIN_EMAIL');

drop policy if exists "Admin can delete ShopHub product images" on storage.objects;
create policy "Admin can delete ShopHub product images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'shophub-product-images' and auth.jwt() ->> 'email' = 'YOUR_ADMIN_EMAIL');
