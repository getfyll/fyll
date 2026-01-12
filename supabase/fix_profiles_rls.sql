-- Fix the infinite recursion in profiles RLS policies
-- Run this in your Supabase SQL Editor

-- Drop the problematic policies
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;

-- Create simpler, non-recursive policies
CREATE POLICY profiles_update_own
  ON public.profiles FOR UPDATE
  USING (auth.uid()::text = id)
  WITH CHECK (auth.uid()::text = id);

CREATE POLICY profiles_select_own
  ON public.profiles FOR SELECT
  USING (auth.uid()::text = id);

-- If you need team members to see each other's profiles, add this:
-- CREATE POLICY profiles_select_team
--   ON public.profiles FOR SELECT
--   USING (
--     business_id IN (
--       SELECT business_id
--       FROM public.team_members
--       WHERE user_id = auth.uid()::text
--     )
--   );
