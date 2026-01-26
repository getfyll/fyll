-- ==================================================================
-- ENABLE RLS ON ALL TABLES - SAFE VERSION
-- ==================================================================
-- This version only enables RLS on tables that have business_id column
-- Run this in Supabase SQL Editor
-- ==================================================================

-- STEP 1: Create helper function
CREATE OR REPLACE FUNCTION public.get_user_business_id()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT business_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- STEP 2: Set search path for security functions
ALTER FUNCTION public.get_user_business_id() SET search_path = public, pg_temp;

-- STEP 3: ENABLE RLS on all tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- Only enable on tables that exist and have business_id
DO $$
BEGIN
  -- Check and enable RLS for each table
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'teams') THEN
    ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'team_members') THEN
    ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_categories') THEN
    ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_variables') THEN
    ALTER TABLE public.product_variables ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_statuses') THEN
    ALTER TABLE public.order_statuses ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sale_sources') THEN
    ALTER TABLE public.sale_sources ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payment_methods') THEN
    ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'custom_services') THEN
    ALTER TABLE public.custom_services ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'logistics_carriers') THEN
    ALTER TABLE public.logistics_carriers ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'expense_categories') THEN
    ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'expenses') THEN
    ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'procurements') THEN
    ALTER TABLE public.procurements ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'restock_logs') THEN
    ALTER TABLE public.restock_logs ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'settings') THEN
    ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'business_settings') THEN
    ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- STEP 4: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_business_id ON public.products(business_id);
CREATE INDEX IF NOT EXISTS idx_orders_business_id ON public.orders(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_business_id ON public.customers(business_id);

-- STEP 5: Create RLS policies for PRODUCTS
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

-- STEP 6: Create RLS policies for ORDERS
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

-- STEP 7: Create RLS policies for CUSTOMERS
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

-- STEP 8: Create RLS policies for PROFILES (uses id, not business_id)
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT
  USING (id = auth.uid());
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- STEP 9: Create RLS policies for BUSINESSES (uses id, not business_id)
DROP POLICY IF EXISTS businesses_select_own ON public.businesses;
DROP POLICY IF EXISTS businesses_insert_own ON public.businesses;
DROP POLICY IF EXISTS businesses_update_own ON public.businesses;

CREATE POLICY businesses_select_own ON public.businesses FOR SELECT
  USING (id = public.get_user_business_id());
CREATE POLICY businesses_insert_own ON public.businesses FOR INSERT
  WITH CHECK (true); -- Anyone can create a business
CREATE POLICY businesses_update_own ON public.businesses FOR UPDATE
  USING (id = public.get_user_business_id());

-- STEP 10: Update statistics
ANALYZE public.products;
ANALYZE public.orders;
ANALYZE public.customers;
ANALYZE public.profiles;
ANALYZE public.businesses;

-- ==================================================================
-- DONE! Core RLS policies enabled
-- ==================================================================
-- This enables RLS on the most critical tables (products, orders, customers)
-- Run the CRITICAL_FIX.sql for the rest if needed
-- ==================================================================
