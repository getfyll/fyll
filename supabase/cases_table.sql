-- ==================================================================
-- FYLL CASES TABLE
-- ==================================================================
-- Cases track post-order issues: repairs, replacements, refunds, etc.
-- Each case is linked to an order (no orphan cases)
-- Run this in Supabase SQL Editor
-- ==================================================================

-- Create cases table (following data_tables.sql pattern)
create table if not exists public.cases (
  id text not null,
  business_id text not null,
  data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add composite primary key
alter table public.cases drop constraint if exists cases_pkey;
alter table public.cases add primary key (id, business_id);

-- Add index for fast business filtering
create index if not exists cases_business_id_idx on public.cases (business_id);

-- Enable Row Level Security
alter table public.cases enable row level security;

-- Drop existing policies if any
drop policy if exists cases_select_v2 on public.cases;
drop policy if exists cases_insert_v2 on public.cases;
drop policy if exists cases_update_v2 on public.cases;
drop policy if exists cases_delete_v2 on public.cases;

-- RLS policies using optimized helper function
create policy cases_select_v2
  on public.cases for select
  using (business_id = public.get_user_business_id());

create policy cases_insert_v2
  on public.cases for insert
  with check (business_id = public.get_user_business_id());

create policy cases_update_v2
  on public.cases for update
  using (business_id = public.get_user_business_id());

create policy cases_delete_v2
  on public.cases for delete
  using (business_id = public.get_user_business_id());

-- Update statistics
analyze public.cases;

-- ==================================================================
-- DONE! Cases table is ready
-- ==================================================================
