-- Check and fix businesses table structure
-- Run this in your Supabase SQL Editor

-- First, let's see what columns exist in businesses table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'businesses'
ORDER BY ordinal_position;

-- Add data JSONB column to businesses table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'businesses'
    AND column_name = 'data'
  ) THEN
    ALTER TABLE public.businesses ADD COLUMN data JSONB DEFAULT '{}'::jsonb;
    RAISE NOTICE 'Added data column to businesses table';
  ELSE
    RAISE NOTICE 'data column already exists in businesses table';
  END IF;
END $$;

-- Enable realtime for the businesses table (if not already enabled)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.businesses;
  RAISE NOTICE 'Added businesses table to realtime publication';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'businesses table already in realtime publication';
END $$;

-- Check RLS policies on businesses table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'businesses';

-- Ensure users can read their own business
DROP POLICY IF EXISTS businesses_select_own ON public.businesses;
CREATE POLICY businesses_select_own
  ON public.businesses FOR SELECT
  USING (
    owner_id = auth.uid()::text
    OR id IN (
      SELECT business_id
      FROM public.team_members
      WHERE user_id = auth.uid()::text
    )
  );

-- Ensure users can update their own business
DROP POLICY IF EXISTS businesses_update_own ON public.businesses;
CREATE POLICY businesses_update_own
  ON public.businesses FOR UPDATE
  USING (
    owner_id = auth.uid()::text
    OR id IN (
      SELECT business_id
      FROM public.team_members
      WHERE user_id = auth.uid()::text
      AND role IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    owner_id = auth.uid()::text
    OR id IN (
      SELECT business_id
      FROM public.team_members
      WHERE user_id = auth.uid()::text
      AND role IN ('admin', 'owner')
    )
  );

-- Ensure users can insert their own business (for signup)
DROP POLICY IF EXISTS businesses_insert_own ON public.businesses;
CREATE POLICY businesses_insert_own
  ON public.businesses FOR INSERT
  WITH CHECK (owner_id = auth.uid()::text);

SELECT 'Setup complete! ✅' as status;
