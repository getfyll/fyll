-- Comprehensive check for data leakage across accounts
-- Run this in Supabase SQL Editor while logged in

-- Show your identity
SELECT
  '=== YOUR IDENTITY ===' as section,
  auth.uid()::text as your_user_id,
  (SELECT business_id FROM profiles WHERE id = auth.uid()::text) as your_business_id;

-- Show what you can see
SELECT '=== WHAT YOU CAN SEE ===' as section;

SELECT
  'products' as table_name,
  COUNT(*) as visible_count,
  COUNT(DISTINCT business_id) as distinct_businesses
FROM public.products;

SELECT
  'orders' as table_name,
  COUNT(*) as visible_count,
  COUNT(DISTINCT business_id) as distinct_businesses
FROM public.orders;

SELECT
  'customers' as table_name,
  COUNT(*) as visible_count,
  COUNT(DISTINCT business_id) as distinct_businesses
FROM public.customers;

-- Show business_ids you can see in products
SELECT
  '=== PRODUCTS BY BUSINESS ===' as section,
  business_id,
  COUNT(*) as count
FROM public.products
GROUP BY business_id;

-- Show business_ids you can see in orders
SELECT
  '=== ORDERS BY BUSINESS ===' as section,
  business_id,
  COUNT(*) as count
FROM public.orders
GROUP BY business_id;

-- Verify RLS is working
SELECT
  '=== RLS STATUS ===' as section,
  tablename,
  CASE WHEN rowsecurity THEN 'ENABLED ✅' ELSE 'DISABLED ❌' END as status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('products', 'orders', 'customers')
ORDER BY tablename;
