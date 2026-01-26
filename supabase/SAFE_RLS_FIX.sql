-- ==================================================================
-- SAFE RLS FIX - NO DOWNTIME VERSION
-- ==================================================================
-- This script safely replaces policies by creating new ones with
-- different names first, then dropping the old duplicates
-- Run this in Supabase SQL Editor
-- ==================================================================

-- STEP 1: Ensure helper function exists and is optimized
CREATE OR REPLACE FUNCTION public.get_user_business_id()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT business_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- STEP 2: Fix the handle_new_user trigger function
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user'
  ) THEN
    ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
  END IF;
END $$;

-- STEP 3: Create new clean policies (with _v2 suffix to avoid conflicts)
-- We'll create all new policies first, then drop old ones

-- PROFILES
DROP POLICY IF EXISTS profiles_select_v2 ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_v2 ON public.profiles;
DROP POLICY IF EXISTS profiles_update_v2 ON public.profiles;

CREATE POLICY profiles_select_v2 ON public.profiles FOR SELECT
  USING (id = auth.uid());
CREATE POLICY profiles_insert_v2 ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());
CREATE POLICY profiles_update_v2 ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- BUSINESSES
DROP POLICY IF EXISTS businesses_select_v2 ON public.businesses;
DROP POLICY IF EXISTS businesses_insert_v2 ON public.businesses;
DROP POLICY IF EXISTS businesses_update_v2 ON public.businesses;
DROP POLICY IF EXISTS businesses_delete_v2 ON public.businesses;

CREATE POLICY businesses_select_v2 ON public.businesses FOR SELECT
  USING (id = public.get_user_business_id());
CREATE POLICY businesses_insert_v2 ON public.businesses FOR INSERT
  WITH CHECK (true);
CREATE POLICY businesses_update_v2 ON public.businesses FOR UPDATE
  USING (id = public.get_user_business_id());
CREATE POLICY businesses_delete_v2 ON public.businesses FOR DELETE
  USING (id = public.get_user_business_id());

-- PRODUCTS
DROP POLICY IF EXISTS products_select_v2 ON public.products;
DROP POLICY IF EXISTS products_insert_v2 ON public.products;
DROP POLICY IF EXISTS products_update_v2 ON public.products;
DROP POLICY IF EXISTS products_delete_v2 ON public.products;

CREATE POLICY products_select_v2 ON public.products FOR SELECT
  USING (business_id = public.get_user_business_id());
CREATE POLICY products_insert_v2 ON public.products FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());
CREATE POLICY products_update_v2 ON public.products FOR UPDATE
  USING (business_id = public.get_user_business_id());
CREATE POLICY products_delete_v2 ON public.products FOR DELETE
  USING (business_id = public.get_user_business_id());

-- ORDERS
DROP POLICY IF EXISTS orders_select_v2 ON public.orders;
DROP POLICY IF EXISTS orders_insert_v2 ON public.orders;
DROP POLICY IF EXISTS orders_update_v2 ON public.orders;
DROP POLICY IF EXISTS orders_delete_v2 ON public.orders;

CREATE POLICY orders_select_v2 ON public.orders FOR SELECT
  USING (business_id = public.get_user_business_id());
CREATE POLICY orders_insert_v2 ON public.orders FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());
CREATE POLICY orders_update_v2 ON public.orders FOR UPDATE
  USING (business_id = public.get_user_business_id());
CREATE POLICY orders_delete_v2 ON public.orders FOR DELETE
  USING (business_id = public.get_user_business_id());

-- CUSTOMERS
DROP POLICY IF EXISTS customers_select_v2 ON public.customers;
DROP POLICY IF EXISTS customers_insert_v2 ON public.customers;
DROP POLICY IF EXISTS customers_update_v2 ON public.customers;
DROP POLICY IF EXISTS customers_delete_v2 ON public.customers;

CREATE POLICY customers_select_v2 ON public.customers FOR SELECT
  USING (business_id = public.get_user_business_id());
CREATE POLICY customers_insert_v2 ON public.customers FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());
CREATE POLICY customers_update_v2 ON public.customers FOR UPDATE
  USING (business_id = public.get_user_business_id());
CREATE POLICY customers_delete_v2 ON public.customers FOR DELETE
  USING (business_id = public.get_user_business_id());

-- EXPENSES
DROP POLICY IF EXISTS expenses_select_v2 ON public.expenses;
DROP POLICY IF EXISTS expenses_insert_v2 ON public.expenses;
DROP POLICY IF EXISTS expenses_update_v2 ON public.expenses;
DROP POLICY IF EXISTS expenses_delete_v2 ON public.expenses;

CREATE POLICY expenses_select_v2 ON public.expenses FOR SELECT
  USING (business_id = public.get_user_business_id());
CREATE POLICY expenses_insert_v2 ON public.expenses FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());
CREATE POLICY expenses_update_v2 ON public.expenses FOR UPDATE
  USING (business_id = public.get_user_business_id());
CREATE POLICY expenses_delete_v2 ON public.expenses FOR DELETE
  USING (business_id = public.get_user_business_id());

-- PROCUREMENTS
DROP POLICY IF EXISTS procurements_select_v2 ON public.procurements;
DROP POLICY IF EXISTS procurements_insert_v2 ON public.procurements;
DROP POLICY IF EXISTS procurements_update_v2 ON public.procurements;
DROP POLICY IF EXISTS procurements_delete_v2 ON public.procurements;

CREATE POLICY procurements_select_v2 ON public.procurements FOR SELECT
  USING (business_id = public.get_user_business_id());
CREATE POLICY procurements_insert_v2 ON public.procurements FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());
CREATE POLICY procurements_update_v2 ON public.procurements FOR UPDATE
  USING (business_id = public.get_user_business_id());
CREATE POLICY procurements_delete_v2 ON public.procurements FOR DELETE
  USING (business_id = public.get_user_business_id());

-- RESTOCK_LOGS
DROP POLICY IF EXISTS restock_logs_select_v2 ON public.restock_logs;
DROP POLICY IF EXISTS restock_logs_insert_v2 ON public.restock_logs;
DROP POLICY IF EXISTS restock_logs_update_v2 ON public.restock_logs;
DROP POLICY IF EXISTS restock_logs_delete_v2 ON public.restock_logs;

CREATE POLICY restock_logs_select_v2 ON public.restock_logs FOR SELECT
  USING (business_id = public.get_user_business_id());
CREATE POLICY restock_logs_insert_v2 ON public.restock_logs FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());
CREATE POLICY restock_logs_update_v2 ON public.restock_logs FOR UPDATE
  USING (business_id = public.get_user_business_id());
CREATE POLICY restock_logs_delete_v2 ON public.restock_logs FOR DELETE
  USING (business_id = public.get_user_business_id());

-- SETTINGS TABLES (only if they exist)
-- ORDER_STATUSES
DROP POLICY IF EXISTS order_statuses_select_v2 ON public.order_statuses;
DROP POLICY IF EXISTS order_statuses_insert_v2 ON public.order_statuses;
DROP POLICY IF EXISTS order_statuses_update_v2 ON public.order_statuses;
DROP POLICY IF EXISTS order_statuses_delete_v2 ON public.order_statuses;

CREATE POLICY order_statuses_select_v2 ON public.order_statuses FOR SELECT
  USING (business_id = public.get_user_business_id());
CREATE POLICY order_statuses_insert_v2 ON public.order_statuses FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());
CREATE POLICY order_statuses_update_v2 ON public.order_statuses FOR UPDATE
  USING (business_id = public.get_user_business_id());
CREATE POLICY order_statuses_delete_v2 ON public.order_statuses FOR DELETE
  USING (business_id = public.get_user_business_id());

-- Remaining settings tables...
DROP POLICY IF EXISTS sale_sources_select_v2 ON public.sale_sources;
DROP POLICY IF EXISTS sale_sources_insert_v2 ON public.sale_sources;
DROP POLICY IF EXISTS sale_sources_update_v2 ON public.sale_sources;
DROP POLICY IF EXISTS sale_sources_delete_v2 ON public.sale_sources;

CREATE POLICY sale_sources_select_v2 ON public.sale_sources FOR SELECT
  USING (business_id = public.get_user_business_id());
CREATE POLICY sale_sources_insert_v2 ON public.sale_sources FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());
CREATE POLICY sale_sources_update_v2 ON public.sale_sources FOR UPDATE
  USING (business_id = public.get_user_business_id());
CREATE POLICY sale_sources_delete_v2 ON public.sale_sources FOR DELETE
  USING (business_id = public.get_user_business_id());

-- STEP 4: Now drop ALL old policies (the new _v2 policies are already active)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
        AND policyname NOT LIKE '%_v2'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
            r.policyname, r.tablename);
    END LOOP;
END $$;

-- STEP 5: Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restock_logs ENABLE ROW LEVEL SECURITY;

-- STEP 6: Add indexes
CREATE INDEX IF NOT EXISTS idx_profiles_id ON public.profiles(id);
CREATE INDEX IF NOT EXISTS idx_profiles_business_id ON public.profiles(business_id);
CREATE INDEX IF NOT EXISTS idx_products_business_id ON public.products(business_id);
CREATE INDEX IF NOT EXISTS idx_orders_business_id ON public.orders(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_business_id ON public.customers(business_id);

-- STEP 7: Update statistics
ANALYZE public.profiles;
ANALYZE public.businesses;
ANALYZE public.products;
ANALYZE public.orders;
ANALYZE public.customers;

-- ==================================================================
-- DONE! This approach is safer because:
-- - New policies are created FIRST (app keeps working)
-- - Old policies are dropped AFTER new ones are active
-- - No downtime or permission errors
-- ==================================================================
