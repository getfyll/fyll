-- ==================================================================
-- CRITICAL FIX FOR RLS PERFORMANCE
-- This creates an index on the helper function result and optimizes RLS
-- ==================================================================

-- First, make sure the helper function exists
CREATE OR REPLACE FUNCTION public.get_user_business_id()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT business_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Add partial indexes for RLS filtering
CREATE INDEX IF NOT EXISTS idx_products_business_id_btree ON public.products USING btree(business_id);
CREATE INDEX IF NOT EXISTS idx_orders_business_id_btree ON public.orders USING btree(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_business_id_btree ON public.customers USING btree(business_id);

-- Disable RLS temporarily to recreate policies
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variables DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_statuses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_sources DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_services DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_carriers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.restock_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses DISABLE ROW LEVEL SECURITY;

-- Wait a moment for connections to release
SELECT pg_sleep(2);

-- Re-enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_carriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restock_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- ==================================================================
-- PRODUCTS TABLE - Simplified RLS
-- ==================================================================
DROP POLICY IF EXISTS products_select_own_business ON public.products;
DROP POLICY IF EXISTS products_insert_own_business ON public.products;
DROP POLICY IF EXISTS products_update_own_business ON public.products;
DROP POLICY IF EXISTS products_delete_own_business ON public.products;

-- Use simpler policies that Postgres can optimize better
CREATE POLICY products_select_own_business
  ON public.products FOR SELECT
  USING (business_id = public.get_user_business_id());

CREATE POLICY products_insert_own_business
  ON public.products FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());

CREATE POLICY products_update_own_business
  ON public.products FOR UPDATE
  USING (business_id = public.get_user_business_id());

CREATE POLICY products_delete_own_business
  ON public.products FOR DELETE
  USING (business_id = public.get_user_business_id());

-- ==================================================================
-- ORDERS TABLE - Simplified RLS
-- ==================================================================
DROP POLICY IF EXISTS orders_select_own_business ON public.orders;
DROP POLICY IF EXISTS orders_insert_own_business ON public.orders;
DROP POLICY IF EXISTS orders_update_own_business ON public.orders;
DROP POLICY IF EXISTS orders_delete_own_business ON public.orders;

CREATE POLICY orders_select_own_business
  ON public.orders FOR SELECT
  USING (business_id = public.get_user_business_id());

CREATE POLICY orders_insert_own_business
  ON public.orders FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());

CREATE POLICY orders_update_own_business
  ON public.orders FOR UPDATE
  USING (business_id = public.get_user_business_id());

CREATE POLICY orders_delete_own_business
  ON public.orders FOR DELETE
  USING (business_id = public.get_user_business_id());

-- ==================================================================
-- CUSTOMERS TABLE - Simplified RLS
-- ==================================================================
DROP POLICY IF EXISTS customers_select_own_business ON public.customers;
DROP POLICY IF EXISTS customers_insert_own_business ON public.customers;
DROP POLICY IF EXISTS customers_update_own_business ON public.customers;
DROP POLICY IF EXISTS customers_delete_own_business ON public.customers;

CREATE POLICY customers_select_own_business
  ON public.customers FOR SELECT
  USING (business_id = public.get_user_business_id());

CREATE POLICY customers_insert_own_business
  ON public.customers FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());

CREATE POLICY customers_update_own_business
  ON public.customers FOR UPDATE
  USING (business_id = public.get_user_business_id());

CREATE POLICY customers_delete_own_business
  ON public.customers FOR DELETE
  USING (business_id = public.get_user_business_id());

-- ==================================================================
-- Update statistics
-- ==================================================================
ANALYZE public.products;
ANALYZE public.orders;
ANALYZE public.customers;

-- ==================================================================
-- DONE! RLS should now work correctly with indexes
-- ==================================================================
