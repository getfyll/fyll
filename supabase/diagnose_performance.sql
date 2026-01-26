-- ==================================================================
-- DIAGNOSTIC QUERIES TO CHECK RLS AND INDEX STATUS
-- ==================================================================
-- Run these queries to see what's happening

-- 1. Check if helper function exists
SELECT
  proname as function_name,
  prosrc as function_body
FROM pg_proc
WHERE proname = 'get_user_business_id';

-- 2. Check current RLS policies on products table
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('products', 'orders', 'customers')
ORDER BY tablename, policyname;

-- 3. Check indexes on products table
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('products', 'orders', 'customers')
ORDER BY tablename, indexname;

-- 4. Count rows in main tables
SELECT
  'products' as table_name,
  COUNT(*) as row_count
FROM products
UNION ALL
SELECT
  'orders' as table_name,
  COUNT(*) as row_count
FROM orders
UNION ALL
SELECT
  'customers' as table_name,
  COUNT(*) as row_count
FROM customers;

-- 5. Check if RLS is enabled
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('products', 'orders', 'customers');

-- ==================================================================
-- INTERPRETATION:
-- ==================================================================
-- 1. If get_user_business_id doesn't exist, run optimize_rls_policies.sql
-- 2. If policies contain "(SELECT business_id FROM profiles...)", they're not optimized
-- 3. If no indexes on business_id, run add_indexes.sql
-- 4. If row_count is very high (>10000), we may need pagination
-- 5. RLS should be enabled (true) for all tables
