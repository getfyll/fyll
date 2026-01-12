-- Data tables for Supabase sync (JSON payload per row).
-- Run in Supabase SQL editor.

create table if not exists public.products (
  id text not null,
  business_id text not null,
  data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.orders (
  id text not null,
  business_id text not null,
  data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.customers (
  id text not null,
  business_id text not null,
  data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.restock_logs (
  id text not null,
  business_id text not null,
  data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.procurements (
  id text not null,
  business_id text not null,
  data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.expenses (
  id text not null,
  business_id text not null,
  data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.products drop constraint if exists products_pkey;
alter table public.orders drop constraint if exists orders_pkey;
alter table public.customers drop constraint if exists customers_pkey;
alter table public.restock_logs drop constraint if exists restock_logs_pkey;
alter table public.procurements drop constraint if exists procurements_pkey;
alter table public.expenses drop constraint if exists expenses_pkey;

alter table public.products add primary key (id, business_id);
alter table public.orders add primary key (id, business_id);
alter table public.customers add primary key (id, business_id);
alter table public.restock_logs add primary key (id, business_id);
alter table public.procurements add primary key (id, business_id);
alter table public.expenses add primary key (id, business_id);

create index if not exists products_business_id_idx on public.products (business_id);
create index if not exists orders_business_id_idx on public.orders (business_id);
create index if not exists customers_business_id_idx on public.customers (business_id);
create index if not exists restock_logs_business_id_idx on public.restock_logs (business_id);
create index if not exists procurements_business_id_idx on public.procurements (business_id);
create index if not exists expenses_business_id_idx on public.expenses (business_id);

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.customers enable row level security;
alter table public.restock_logs enable row level security;
alter table public.procurements enable row level security;
alter table public.expenses enable row level security;

drop policy if exists products_select_own_business on public.products;
drop policy if exists products_insert_own_business on public.products;
drop policy if exists products_update_own_business on public.products;
drop policy if exists products_delete_own_business on public.products;

create policy products_select_own_business
  on public.products for select
  using (business_id = (select business_id from public.profiles where id = auth.uid()));

create policy products_insert_own_business
  on public.products for insert
  with check (business_id = (select business_id from public.profiles where id = auth.uid()));

create policy products_update_own_business
  on public.products for update
  using (business_id = (select business_id from public.profiles where id = auth.uid()));

create policy products_delete_own_business
  on public.products for delete
  using (business_id = (select business_id from public.profiles where id = auth.uid()));

drop policy if exists orders_select_own_business on public.orders;
drop policy if exists orders_insert_own_business on public.orders;
drop policy if exists orders_update_own_business on public.orders;
drop policy if exists orders_delete_own_business on public.orders;

create policy orders_select_own_business
  on public.orders for select
  using (business_id = (select business_id from public.profiles where id = auth.uid()));

create policy orders_insert_own_business
  on public.orders for insert
  with check (business_id = (select business_id from public.profiles where id = auth.uid()));

create policy orders_update_own_business
  on public.orders for update
  using (business_id = (select business_id from public.profiles where id = auth.uid()));

create policy orders_delete_own_business
  on public.orders for delete
  using (business_id = (select business_id from public.profiles where id = auth.uid()));

drop policy if exists customers_select_own_business on public.customers;
drop policy if exists customers_insert_own_business on public.customers;
drop policy if exists customers_update_own_business on public.customers;
drop policy if exists customers_delete_own_business on public.customers;

create policy customers_select_own_business
  on public.customers for select
  using (business_id = (select business_id from public.profiles where id = auth.uid()));

create policy customers_insert_own_business
  on public.customers for insert
  with check (business_id = (select business_id from public.profiles where id = auth.uid()));

create policy customers_update_own_business
  on public.customers for update
  using (business_id = (select business_id from public.profiles where id = auth.uid()));

create policy customers_delete_own_business
  on public.customers for delete
  using (business_id = (select business_id from public.profiles where id = auth.uid()));

drop policy if exists restock_select_own_business on public.restock_logs;
drop policy if exists restock_insert_own_business on public.restock_logs;
drop policy if exists restock_update_own_business on public.restock_logs;
drop policy if exists restock_delete_own_business on public.restock_logs;

create policy restock_select_own_business
  on public.restock_logs for select
  using (business_id = (select business_id from public.profiles where id = auth.uid()));

create policy restock_insert_own_business
  on public.restock_logs for insert
  with check (business_id = (select business_id from public.profiles where id = auth.uid()));

create policy restock_update_own_business
  on public.restock_logs for update
  using (business_id = (select business_id from public.profiles where id = auth.uid()));

create policy restock_delete_own_business
  on public.restock_logs for delete
  using (business_id = (select business_id from public.profiles where id = auth.uid()));

drop policy if exists procurements_select_own_business on public.procurements;
drop policy if exists procurements_insert_own_business on public.procurements;
drop policy if exists procurements_update_own_business on public.procurements;
drop policy if exists procurements_delete_own_business on public.procurements;

create policy procurements_select_own_business
  on public.procurements for select
  using (business_id = (select business_id from public.profiles where id = auth.uid()));

create policy procurements_insert_own_business
  on public.procurements for insert
  with check (business_id = (select business_id from public.profiles where id = auth.uid()));

create policy procurements_update_own_business
  on public.procurements for update
  using (business_id = (select business_id from public.profiles where id = auth.uid()));

create policy procurements_delete_own_business
  on public.procurements for delete
  using (business_id = (select business_id from public.profiles where id = auth.uid()));

drop policy if exists expenses_select_own_business on public.expenses;
drop policy if exists expenses_insert_own_business on public.expenses;
drop policy if exists expenses_update_own_business on public.expenses;
drop policy if exists expenses_delete_own_business on public.expenses;

create policy expenses_select_own_business
  on public.expenses for select
  using (business_id = (select business_id from public.profiles where id = auth.uid()));

create policy expenses_insert_own_business
  on public.expenses for insert
  with check (business_id = (select business_id from public.profiles where id = auth.uid()));

create policy expenses_update_own_business
  on public.expenses for update
  using (business_id = (select business_id from public.profiles where id = auth.uid()));

create policy expenses_delete_own_business
  on public.expenses for delete
  using (business_id = (select business_id from public.profiles where id = auth.uid()));
