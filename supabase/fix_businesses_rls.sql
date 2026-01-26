-- Fix businesses RLS with text-safe auth uid comparison.
-- Run in Supabase SQL editor.

alter table public.businesses enable row level security;

drop policy if exists businesses_select_own on public.businesses;
drop policy if exists businesses_update_own on public.businesses;

create policy businesses_select_own
  on public.businesses for select
  using (
    id::text = (
      select business_id::text
      from public.profiles
      where id::text = auth.uid()::text
    )
  );

create policy businesses_update_own
  on public.businesses for update
  using (
    id::text = (
      select business_id::text
      from public.profiles
      where id::text = auth.uid()::text
    )
  );
