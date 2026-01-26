-- Invites table and policies for team invite flow.
-- Run in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null,
  invite_code text not null,
  invited_by text not null,
  invited_at timestamptz not null default now(),
  expires_at timestamptz not null,
  business_id text not null
);

create unique index if not exists invites_invite_code_key on public.invites (invite_code);
create index if not exists invites_business_id_idx on public.invites (business_id);
create index if not exists invites_email_idx on public.invites (email);

alter table public.invites enable row level security;

drop policy if exists invites_select_own_business on public.invites;
drop policy if exists invites_insert_own_business on public.invites;
drop policy if exists invites_update_own_business on public.invites;
drop policy if exists invites_delete_own_business on public.invites;

create policy invites_select_own_business
  on public.invites for select
  using (business_id = (select business_id from public.profiles where id = auth.uid()));

create policy invites_insert_own_business
  on public.invites for insert
  with check (business_id = (select business_id from public.profiles where id = auth.uid()));

create policy invites_update_own_business
  on public.invites for update
  using (business_id = (select business_id from public.profiles where id = auth.uid()));

create policy invites_delete_own_business
  on public.invites for delete
  using (business_id = (select business_id from public.profiles where id = auth.uid()));

create or replace function public.get_invite_by_code(invite_code_input text)
returns table (
  id uuid,
  email text,
  role text,
  invite_code text,
  invited_by text,
  invited_at timestamptz,
  expires_at timestamptz,
  business_id text
)
language sql
security definer
set search_path = public
as $$
  select
    i.id,
    i.email,
    i.role,
    i.invite_code,
    i.invited_by,
    i.invited_at,
    i.expires_at,
    i.business_id
  from public.invites i
  where i.invite_code = invite_code_input
    and i.expires_at > now()
  limit 1;
$$;

create or replace function public.delete_invite(invite_id_input uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.invites
  where id = invite_id_input
    and business_id = (
      select business_id
      from public.profiles
      where id = auth.uid()
    );

  get diagnostics deleted_count = row_count;
  return deleted_count > 0;
end;
$$;
