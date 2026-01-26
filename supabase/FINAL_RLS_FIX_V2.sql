-- ==================================================================
-- FINAL RLS FIX V2 - COMPREHENSIVE CLEANUP (CORRECTED)
-- ==================================================================
-- This script removes ALL old policies and creates clean, optimized ones
-- ONLY for tables that actually exist with business_id column
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

-- STEP 2: Drop ALL existing policies on all tables
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
            r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- STEP 3: Create clean, non-conflicting policies

-- ==================================================================
-- PROFILES - Users can only access their own profile
-- ==================================================================
CREATE POLICY profiles_select ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY profiles_insert ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY profiles_update ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- ==================================================================
-- BUSINESSES - Users can access their business
-- ==================================================================
CREATE POLICY businesses_select ON public.businesses FOR SELECT
  USING (id = public.get_user_business_id());

CREATE POLICY businesses_insert ON public.businesses FOR INSERT
  WITH CHECK (true);  -- Allow creation during signup

CREATE POLICY businesses_update ON public.businesses FOR UPDATE
  USING (id = public.get_user_business_id());

CREATE POLICY businesses_delete ON public.businesses FOR DELETE
  USING (id = public.get_user_business_id());

-- ==================================================================
-- DATA TABLES - All have business_id column
-- ==================================================================

-- PRODUCTS
CREATE POLICY products_select ON public.products FOR SELECT
  USING (business_id = public.get_user_business_id());

CREATE POLICY products_insert ON public.products FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());

CREATE POLICY products_update ON public.products FOR UPDATE
  USING (business_id = public.get_user_business_id());

CREATE POLICY products_delete ON public.products FOR DELETE
  USING (business_id = public.get_user_business_id());

-- ORDERS
CREATE POLICY orders_select ON public.orders FOR SELECT
  USING (business_id = public.get_user_business_id());

CREATE POLICY orders_insert ON public.orders FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());

CREATE POLICY orders_update ON public.orders FOR UPDATE
  USING (business_id = public.get_user_business_id());

CREATE POLICY orders_delete ON public.orders FOR DELETE
  USING (business_id = public.get_user_business_id());

-- CUSTOMERS
CREATE POLICY customers_select ON public.customers FOR SELECT
  USING (business_id = public.get_user_business_id());

CREATE POLICY customers_insert ON public.customers FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());

CREATE POLICY customers_update ON public.customers FOR UPDATE
  USING (business_id = public.get_user_business_id());

CREATE POLICY customers_delete ON public.customers FOR DELETE
  USING (business_id = public.get_user_business_id());

-- EXPENSES
CREATE POLICY expenses_select ON public.expenses FOR SELECT
  USING (business_id = public.get_user_business_id());

CREATE POLICY expenses_insert ON public.expenses FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());

CREATE POLICY expenses_update ON public.expenses FOR UPDATE
  USING (business_id = public.get_user_business_id());

CREATE POLICY expenses_delete ON public.expenses FOR DELETE
  USING (business_id = public.get_user_business_id());

-- PROCUREMENTS
CREATE POLICY procurements_select ON public.procurements FOR SELECT
  USING (business_id = public.get_user_business_id());

CREATE POLICY procurements_insert ON public.procurements FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());

CREATE POLICY procurements_update ON public.procurements FOR UPDATE
  USING (business_id = public.get_user_business_id());

CREATE POLICY procurements_delete ON public.procurements FOR DELETE
  USING (business_id = public.get_user_business_id());

-- RESTOCK_LOGS
CREATE POLICY restock_logs_select ON public.restock_logs FOR SELECT
  USING (business_id = public.get_user_business_id());

CREATE POLICY restock_logs_insert ON public.restock_logs FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());

CREATE POLICY restock_logs_update ON public.restock_logs FOR UPDATE
  USING (business_id = public.get_user_business_id());

CREATE POLICY restock_logs_delete ON public.restock_logs FOR DELETE
  USING (business_id = public.get_user_business_id());

-- ==================================================================
-- SETTINGS TABLES - All have business_id column
-- ==================================================================

-- ORDER_STATUSES
CREATE POLICY order_statuses_select ON public.order_statuses FOR SELECT
  USING (business_id = public.get_user_business_id());

CREATE POLICY order_statuses_insert ON public.order_statuses FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());

CREATE POLICY order_statuses_update ON public.order_statuses FOR UPDATE
  USING (business_id = public.get_user_business_id());

CREATE POLICY order_statuses_delete ON public.order_statuses FOR DELETE
  USING (business_id = public.get_user_business_id());

-- SALE_SOURCES
CREATE POLICY sale_sources_select ON public.sale_sources FOR SELECT
  USING (business_id = public.get_user_business_id());

CREATE POLICY sale_sources_insert ON public.sale_sources FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());

CREATE POLICY sale_sources_update ON public.sale_sources FOR UPDATE
  USING (business_id = public.get_user_business_id());

CREATE POLICY sale_sources_delete ON public.sale_sources FOR DELETE
  USING (business_id = public.get_user_business_id());

-- CUSTOM_SERVICES
CREATE POLICY custom_services_select ON public.custom_services FOR SELECT
  USING (business_id = public.get_user_business_id());

CREATE POLICY custom_services_insert ON public.custom_services FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());

CREATE POLICY custom_services_update ON public.custom_services FOR UPDATE
  USING (business_id = public.get_user_business_id());

CREATE POLICY custom_services_delete ON public.custom_services FOR DELETE
  USING (business_id = public.get_user_business_id());

-- PAYMENT_METHODS
CREATE POLICY payment_methods_select ON public.payment_methods FOR SELECT
  USING (business_id = public.get_user_business_id());

CREATE POLICY payment_methods_insert ON public.payment_methods FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());

CREATE POLICY payment_methods_update ON public.payment_methods FOR UPDATE
  USING (business_id = public.get_user_business_id());

CREATE POLICY payment_methods_delete ON public.payment_methods FOR DELETE
  USING (business_id = public.get_user_business_id());

-- LOGISTICS_CARRIERS
CREATE POLICY logistics_carriers_select ON public.logistics_carriers FOR SELECT
  USING (business_id = public.get_user_business_id());

CREATE POLICY logistics_carriers_insert ON public.logistics_carriers FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());

CREATE POLICY logistics_carriers_update ON public.logistics_carriers FOR UPDATE
  USING (business_id = public.get_user_business_id());

CREATE POLICY logistics_carriers_delete ON public.logistics_carriers FOR DELETE
  USING (business_id = public.get_user_business_id());

-- PRODUCT_VARIABLES
CREATE POLICY product_variables_select ON public.product_variables FOR SELECT
  USING (business_id = public.get_user_business_id());

CREATE POLICY product_variables_insert ON public.product_variables FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());

CREATE POLICY product_variables_update ON public.product_variables FOR UPDATE
  USING (business_id = public.get_user_business_id());

CREATE POLICY product_variables_delete ON public.product_variables FOR DELETE
  USING (business_id = public.get_user_business_id());

-- EXPENSE_CATEGORIES
CREATE POLICY expense_categories_select ON public.expense_categories FOR SELECT
  USING (business_id = public.get_user_business_id());

CREATE POLICY expense_categories_insert ON public.expense_categories FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());

CREATE POLICY expense_categories_update ON public.expense_categories FOR UPDATE
  USING (business_id = public.get_user_business_id());

CREATE POLICY expense_categories_delete ON public.expense_categories FOR DELETE
  USING (business_id = public.get_user_business_id());

-- PRODUCT_CATEGORIES
CREATE POLICY product_categories_select ON public.product_categories FOR SELECT
  USING (business_id = public.get_user_business_id());

CREATE POLICY product_categories_insert ON public.product_categories FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());

CREATE POLICY product_categories_update ON public.product_categories FOR UPDATE
  USING (business_id = public.get_user_business_id());

CREATE POLICY product_categories_delete ON public.product_categories FOR DELETE
  USING (business_id = public.get_user_business_id());

-- BUSINESS_SETTINGS
CREATE POLICY business_settings_select ON public.business_settings FOR SELECT
  USING (business_id = public.get_user_business_id());

CREATE POLICY business_settings_insert ON public.business_settings FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());

CREATE POLICY business_settings_update ON public.business_settings FOR UPDATE
  USING (business_id = public.get_user_business_id());

CREATE POLICY business_settings_delete ON public.business_settings FOR DELETE
  USING (business_id = public.get_user_business_id());

-- ==================================================================
-- STEP 4: Ensure all tables have RLS enabled
-- ==================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restock_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_carriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

-- ==================================================================
-- STEP 5: Fix the handle_new_user trigger function
-- ==================================================================
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;

-- ==================================================================
-- STEP 6: Add critical indexes for performance
-- ==================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_id ON public.profiles(id);
CREATE INDEX IF NOT EXISTS idx_profiles_business_id ON public.profiles(business_id);
CREATE INDEX IF NOT EXISTS idx_products_business_id ON public.products(business_id);
CREATE INDEX IF NOT EXISTS idx_orders_business_id ON public.orders(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_business_id ON public.customers(business_id);
CREATE INDEX IF NOT EXISTS idx_expenses_business_id ON public.expenses(business_id);
CREATE INDEX IF NOT EXISTS idx_procurements_business_id ON public.procurements(business_id);
CREATE INDEX IF NOT EXISTS idx_restock_logs_business_id ON public.restock_logs(business_id);

-- ==================================================================
-- STEP 7: Update statistics
-- ==================================================================
ANALYZE public.profiles;
ANALYZE public.businesses;
ANALYZE public.products;
ANALYZE public.orders;
ANALYZE public.customers;
ANALYZE public.expenses;
ANALYZE public.procurements;
ANALYZE public.restock_logs;
ANALYZE public.order_statuses;
ANALYZE public.sale_sources;
ANALYZE public.custom_services;
ANALYZE public.payment_methods;
ANALYZE public.logistics_carriers;
ANALYZE public.product_variables;
ANALYZE public.expense_categories;
ANALYZE public.product_categories;
ANALYZE public.business_settings;

-- ==================================================================
-- DONE! All RLS policies cleaned up and optimized
-- ==================================================================
-- Refresh the Security Advisor to see the results
-- You should now have:
-- - 0 errors
-- - Minimal warnings (only the intentional businesses_insert policy)
-- - No duplicate policies
-- - Optimized performance with STABLE SECURITY DEFINER function
-- ==================================================================
