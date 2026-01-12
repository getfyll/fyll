-- Diagnose RLS (Row Level Security) issues
-- Run this in your Supabase SQL Editor while logged in as a user

-- 1. Check if RLS is enabled on all tables
SELECT
  tablename,
  CASE
    WHEN rowsecurity THEN '✅ ENABLED'
    ELSE '❌ DISABLED'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('products', 'orders', 'customers', 'profiles', 'businesses')
ORDER BY tablename;

-- 2. Check what auth.uid() returns
SELECT
  auth.uid() as current_user_id,
  auth.uid()::text as current_user_id_as_text;

-- 3. Check your profile
SELECT
  id,
  email,
  business_id,
  role
FROM public.profiles
WHERE id = auth.uid()::text;

-- 4. Count products/orders by business_id
SELECT
  'products' as table_name,
  business_id,
  COUNT(*) as count
FROM public.products
GROUP BY business_id
UNION ALL
SELECT
  'orders' as table_name,
  business_id,
  COUNT(*) as count
FROM public.orders
GROUP BY business_id
ORDER BY table_name, business_id;

-- 5. Check if policies exist
SELECT
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE tablename IN ('products', 'orders', 'customers')
GROUP BY tablename
ORDER BY tablename;

-- 6. Test what you can see
SELECT
  'You can see ' || COUNT(*) || ' products' as result
FROM public.products;

SELECT
  'You can see ' || COUNT(*) || ' orders' as result
FROM public.orders;
