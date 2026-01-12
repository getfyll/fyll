-- Add business settings columns to profiles table
-- This enables cross-browser/device sync for business settings
-- Run this in your Supabase SQL Editor

-- Add businessName column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'businessName'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN "businessName" TEXT;
  END IF;
END $$;

-- Add data JSONB column if it doesn't exist (for storing additional settings)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'data'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN data JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Enable realtime for the profiles table (if not already enabled)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION
  WHEN duplicate_object THEN
    NULL; -- Table already in publication, ignore
END $$;

-- Create an index on businessName for faster queries
CREATE INDEX IF NOT EXISTS profiles_business_name_idx ON public.profiles ("businessName");

-- Update the trigger to include business name from businesses table
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  business_name TEXT;
BEGIN
  -- Try to get business name from businesses table
  SELECT name INTO business_name
  FROM public.businesses
  WHERE id = NEW.raw_user_meta_data->>'businessId';

  -- Insert profile with business name if available
  INSERT INTO public.profiles (id, email, role, business_id, "businessName", data)
  VALUES (
    NEW.id,
    NEW.email,
    'admin',
    NEW.raw_user_meta_data->>'businessId',
    business_name,
    '{}'::jsonb
  )
  ON CONFLICT (id) DO UPDATE
  SET
    "businessName" = COALESCE(EXCLUDED."businessName", public.profiles."businessName"),
    data = COALESCE(EXCLUDED.data, public.profiles.data);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migrate existing business names from businesses table to profiles
UPDATE public.profiles p
SET "businessName" = b.name
FROM public.businesses b
WHERE p.business_id = b.id
AND (p."businessName" IS NULL OR p."businessName" = '');

-- Add RLS policies for the new columns (if needed)
-- Users should be able to read and update their own profile
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own
  ON public.profiles FOR UPDATE
  USING (auth.uid()::text = id)
  WITH CHECK (auth.uid()::text = id);

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own
  ON public.profiles FOR SELECT
  USING (auth.uid()::text = id OR business_id = (SELECT business_id FROM public.profiles WHERE id = auth.uid()::text));
