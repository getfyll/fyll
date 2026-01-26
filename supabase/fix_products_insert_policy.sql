-- Fix products INSERT policy to allow users to create products
-- This fixes the "new row violates row-level security policy" error

-- First, check current policies
SELECT
  policyname,
  cmd as operation
FROM pg_policies
WHERE tablename = 'products'
ORDER BY cmd;

-- Drop and recreate products INSERT policy
DROP POLICY IF EXISTS products_insert_own_business ON public.products;

CREATE POLICY products_insert_own_business
  ON public.products FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT business_id
      FROM public.profiles
      WHERE id = auth.uid()::text
    )
  );

-- Verify it was created
SELECT
  '✅ Products INSERT policy created!' as status;

SELECT
  policyname,
  cmd as operation,
  CASE
    WHEN cmd = 'SELECT' THEN 'Read'
    WHEN cmd = 'INSERT' THEN 'Create ✅'
    WHEN cmd = 'UPDATE' THEN 'Update'
    WHEN cmd = 'DELETE' THEN 'Delete'
  END as action
FROM pg_policies
WHERE tablename = 'products'
ORDER BY cmd;
