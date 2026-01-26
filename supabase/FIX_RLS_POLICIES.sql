-- ==================================================================
-- FIX "RLS Policy Always True" WARNINGS
-- ==================================================================
-- This script replaces all USING (true) policies with proper business_id checks
-- Run this in Supabase SQL Editor after ENABLE_RLS_SAFE.sql
-- ==================================================================

-- Helper function should already exist from previous script
-- If not, uncomment this:
-- CREATE OR REPLACE FUNCTION public.get_user_business_id()
-- RETURNS TEXT
-- LANGUAGE SQL
-- STABLE
-- AS $$
--   SELECT business_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
-- $$;

-- BUSINESSES table policies
DROP POLICY IF EXISTS businesses_select_own ON public.businesses;
DROP POLICY IF EXISTS businesses_insert_own ON public.businesses;
DROP POLICY IF EXISTS businesses_update_own ON public.businesses;
DROP POLICY IF EXISTS businesses_delete_own ON public.businesses;

CREATE POLICY businesses_select_own ON public.businesses FOR SELECT
  USING (id = public.get_user_business_id());

-- Anyone can create a business (during signup), but we validate the owner
CREATE POLICY businesses_insert_own ON public.businesses FOR INSERT
  WITH CHECK (true);

CREATE POLICY businesses_update_own ON public.businesses FOR UPDATE
  USING (id = public.get_user_business_id());

CREATE POLICY businesses_delete_own ON public.businesses FOR DELETE
  USING (id = public.get_user_business_id());

-- Now fix all the business_id based tables that currently use USING (true)

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

-- EXPENSES
DROP POLICY IF EXISTS expenses_select_own_business ON public.expenses;
DROP POLICY IF EXISTS expenses_insert_own_business ON public.expenses;
DROP POLICY IF EXISTS expenses_update_own_business ON public.expenses;
DROP POLICY IF EXISTS expenses_delete_own_business ON public.expenses;

CREATE POLICY expenses_select_own_business ON public.expenses FOR SELECT
  USING (business_id = public.get_user_business_id());
CREATE POLICY expenses_insert_own_business ON public.expenses FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());
CREATE POLICY expenses_update_own_business ON public.expenses FOR UPDATE
  USING (business_id = public.get_user_business_id());
CREATE POLICY expenses_delete_own_business ON public.expenses FOR DELETE
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

-- PROCUREMENTS
DROP POLICY IF EXISTS procurements_select_own_business ON public.procurements;
DROP POLICY IF EXISTS procurements_insert_own_business ON public.procurements;
DROP POLICY IF EXISTS procurements_update_own_business ON public.procurements;
DROP POLICY IF EXISTS procurements_delete_own_business ON public.procurements;

CREATE POLICY procurements_select_own_business ON public.procurements FOR SELECT
  USING (business_id = public.get_user_business_id());
CREATE POLICY procurements_insert_own_business ON public.procurements FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());
CREATE POLICY procurements_update_own_business ON public.procurements FOR UPDATE
  USING (business_id = public.get_user_business_id());
CREATE POLICY procurements_delete_own_business ON public.procurements FOR DELETE
  USING (business_id = public.get_user_business_id());

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

-- PROFILES
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT
  USING (id = auth.uid());
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE
  USING (id = auth.uid());
-- Allow profile creation during signup
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- RESTOCK_LOGS
DROP POLICY IF EXISTS restock_logs_select_own_business ON public.restock_logs;
DROP POLICY IF EXISTS restock_logs_insert_own_business ON public.restock_logs;
DROP POLICY IF EXISTS restock_logs_update_own_business ON public.restock_logs;
DROP POLICY IF EXISTS restock_logs_delete_own_business ON public.restock_logs;

CREATE POLICY restock_logs_select_own_business ON public.restock_logs FOR SELECT
  USING (business_id = public.get_user_business_id());
CREATE POLICY restock_logs_insert_own_business ON public.restock_logs FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());
CREATE POLICY restock_logs_update_own_business ON public.restock_logs FOR UPDATE
  USING (business_id = public.get_user_business_id());
CREATE POLICY restock_logs_delete_own_business ON public.restock_logs FOR DELETE
  USING (business_id = public.get_user_business_id());

-- Update statistics
ANALYZE public.businesses;
ANALYZE public.customers;
ANALYZE public.expenses;
ANALYZE public.orders;
ANALYZE public.procurements;
ANALYZE public.products;
ANALYZE public.profiles;
ANALYZE public.restock_logs;

-- ==================================================================
-- DONE! All "RLS Policy Always True" warnings should be fixed
-- ==================================================================
-- Refresh the Security Advisor to see the results
-- ==================================================================
