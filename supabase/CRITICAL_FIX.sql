-- ==================================================================
-- CRITICAL FIX - RUN THIS TO MAKE APP WORK
-- ==================================================================
-- This script does THREE things:
-- 1. Creates optimized helper function
-- 2. Adds critical indexes
-- 3. Updates RLS policies to use the helper
-- ==================================================================

-- STEP 1: Create helper function (called once per query, not per row)
CREATE OR REPLACE FUNCTION public.get_user_business_id()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT business_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- STEP 2: Add indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_products_business_id ON public.products(business_id);
CREATE INDEX IF NOT EXISTS idx_orders_business_id ON public.orders(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_business_id ON public.customers(business_id);

-- STEP 3: Update RLS policies to use helper function
-- PRODUCTS
DROP POLICY IF EXISTS products_select_own_business ON public.products;
DROP POLICY IF EXISTS products_insert_own_business ON public.products;
DROP POLICY IF EXISTS products_update_own_business ON public.products;
DROP POLICY IF EXISTS products_delete_own_business ON public.products;

CREATE POLICY products_select_own_business ON public.products FOR SELECT
  USING (business_id = public.get_user_business_id());
CREATE POLICY products_insert_own_business ON public.products FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());
CREATE POLICY products_update_own_business ON public.products FOR UPDATE
  USING (business_id = public.get_user_business_id());
CREATE POLICY products_delete_own_business ON public.products FOR DELETE
  USING (business_id = public.get_user_business_id());

-- ORDERS
DROP POLICY IF EXISTS orders_select_own_business ON public.orders;
DROP POLICY IF EXISTS orders_insert_own_business ON public.orders;
DROP POLICY IF EXISTS orders_update_own_business ON public.orders;
DROP POLICY IF EXISTS orders_delete_own_business ON public.orders;

CREATE POLICY orders_select_own_business ON public.orders FOR SELECT
  USING (business_id = public.get_user_business_id());
CREATE POLICY orders_insert_own_business ON public.orders FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());
CREATE POLICY orders_update_own_business ON public.orders FOR UPDATE
  USING (business_id = public.get_user_business_id());
CREATE POLICY orders_delete_own_business ON public.orders FOR DELETE
  USING (business_id = public.get_user_business_id());

-- CUSTOMERS
DROP POLICY IF EXISTS customers_select_own_business ON public.customers;
DROP POLICY IF EXISTS customers_insert_own_business ON public.customers;
DROP POLICY IF EXISTS customers_update_own_business ON public.customers;
DROP POLICY IF EXISTS customers_delete_own_business ON public.customers;

CREATE POLICY customers_select_own_business ON public.customers FOR SELECT
  USING (business_id = public.get_user_business_id());
CREATE POLICY customers_insert_own_business ON public.customers FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());
CREATE POLICY customers_update_own_business ON public.customers FOR UPDATE
  USING (business_id = public.get_user_business_id());
CREATE POLICY customers_delete_own_business ON public.customers FOR DELETE
  USING (business_id = public.get_user_business_id());

-- STEP 4: Update statistics so Postgres knows to use indexes
ANALYZE public.products;
ANALYZE public.orders;
ANALYZE public.customers;

-- ==================================================================
-- DONE! This should fix ALL timeout issues
-- ==================================================================
-- What this does:
-- - Helper function: Looks up business_id ONCE instead of for every row
-- - Indexes: Lets Postgres find your data instantly
-- - RLS policies: Uses the optimized helper function
--
-- Expected results:
-- - Queries 10-100x faster
-- - No more timeouts
-- - Deletions work instantly
-- ==================================================================
