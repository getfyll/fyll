-- Fix RLS policies to allow signup (Version 2 - Fixed)
-- This adds the missing INSERT policies that are needed for new account creation
-- Run this in your Supabase SQL Editor

-- First, let's check what columns exist in businesses table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'businesses'
ORDER BY ordinal_position;

-- Add owner_id column to businesses table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'businesses'
    AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE public.businesses ADD COLUMN owner_id TEXT;
    RAISE NOTICE 'Added owner_id column to businesses table';
  ELSE
    RAISE NOTICE 'owner_id column already exists';
  END IF;
END $$;

-- ===================================
-- PROFILES TABLE
-- ===================================

-- Drop existing policies
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;

-- Allow users to insert their own profile (needed for signup)
CREATE POLICY profiles_insert_own
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid()::text = id);

-- Allow users to update their own profile
CREATE POLICY profiles_update_own
  ON public.profiles FOR UPDATE
  USING (auth.uid()::text = id)
  WITH CHECK (auth.uid()::text = id);

-- Allow users to select their own profile
CREATE POLICY profiles_select_own
  ON public.profiles FOR SELECT
  USING (auth.uid()::text = id);


-- ===================================
-- BUSINESSES TABLE
-- ===================================

-- Drop existing policies
DROP POLICY IF EXISTS businesses_insert_own ON public.businesses;
DROP POLICY IF EXISTS businesses_update_own ON public.businesses;
DROP POLICY IF EXISTS businesses_select_own ON public.businesses;

-- Allow users to insert their own business (needed for signup)
CREATE POLICY businesses_insert_own
  ON public.businesses FOR INSERT
  WITH CHECK (owner_id = auth.uid()::text);

-- Allow users to update their own business
CREATE POLICY businesses_update_own
  ON public.businesses FOR UPDATE
  USING (owner_id = auth.uid()::text)
  WITH CHECK (owner_id = auth.uid()::text);

-- Allow users to select their own business
CREATE POLICY businesses_select_own
  ON public.businesses FOR SELECT
  USING (owner_id = auth.uid()::text);


-- ===================================
-- TEAM_MEMBERS TABLE
-- ===================================

-- Drop existing policies
DROP POLICY IF EXISTS team_members_insert_own ON public.team_members;
DROP POLICY IF EXISTS team_members_update_own ON public.team_members;
DROP POLICY IF EXISTS team_members_select_team ON public.team_members;

-- Allow users to insert themselves as team member (needed for signup)
CREATE POLICY team_members_insert_own
  ON public.team_members FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

-- Allow users to update their own team member record
CREATE POLICY team_members_update_own
  ON public.team_members FOR UPDATE
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- Allow users to see team members in their business
CREATE POLICY team_members_select_team
  ON public.team_members FOR SELECT
  USING (
    business_id IN (
      SELECT business_id
      FROM public.team_members
      WHERE user_id = auth.uid()::text
    )
  );


-- ===================================
-- VERIFY SETUP
-- ===================================

SELECT
  'Policies created successfully! ✅' as status,
  'You should now be able to create new accounts.' as message;

-- Show all policies for verification
SELECT
  schemaname,
  tablename,
  policyname,
  cmd as operation,
  CASE
    WHEN cmd = 'SELECT' THEN 'Read'
    WHEN cmd = 'INSERT' THEN 'Create'
    WHEN cmd = 'UPDATE' THEN 'Update'
    WHEN cmd = 'DELETE' THEN 'Delete'
  END as action
FROM pg_policies
WHERE tablename IN ('profiles', 'businesses', 'team_members')
ORDER BY tablename, cmd;
