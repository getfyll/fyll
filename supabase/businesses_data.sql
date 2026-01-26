-- Add data column to businesses for synced settings.
-- Run in Supabase SQL editor.

alter table public.businesses
add column if not exists data jsonb default '{}'::jsonb;
