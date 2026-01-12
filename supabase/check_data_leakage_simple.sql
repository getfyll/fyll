-- Simple check for data leakage - one query at a time
-- Run each query separately in Supabase SQL Editor

-- QUERY 1: Your identity
SELECT
  'YOUR IDENTITY' as info,
  auth.uid()::text as your_user_id,
  (SELECT business_id FROM profiles WHERE id = auth.uid()::text) as your_business_id;

-- QUERY 2: Products you can see (CRITICAL - should show distinct_businesses = 1)
SELECT
  'PRODUCTS' as table_name,
  COUNT(*) as visible_count,
  COUNT(DISTINCT business_id) as distinct_businesses,
  string_agg(DISTINCT business_id, ', ') as business_ids_visible
FROM public.products;

-- QUERY 3: Orders you can see (CRITICAL - should show distinct_businesses = 1)
SELECT
  'ORDERS' as table_name,
  COUNT(*) as visible_count,
  COUNT(DISTINCT business_id) as distinct_businesses,
  string_agg(DISTINCT business_id, ', ') as business_ids_visible
FROM public.orders;

-- QUERY 4: List all products with their business_id (to see if you're seeing multiple businesses)
SELECT
  business_id,
  COUNT(*) as product_count
FROM public.products
GROUP BY business_id
ORDER BY business_id;

-- QUERY 5: List all orders with their business_id (to see if you're seeing multiple businesses)
SELECT
  business_id,
  COUNT(*) as order_count
FROM public.orders
GROUP BY business_id
ORDER BY business_id;
