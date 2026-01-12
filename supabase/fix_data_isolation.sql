-- Fix data isolation issues - ensure RLS policies work correctly
-- Run this in your Supabase SQL Editor

-- First, let's check if RLS is enabled on all tables
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('products', 'orders', 'customers', 'profiles', 'businesses', 'team_members')
ORDER BY tablename;

-- Check current policies
SELECT
  schemaname,
  tablename,
  policyname,
  cmd as operation,
  qual as using_expression,
  with_check as check_expression
FROM pg_policies
WHERE tablename IN ('products', 'orders', 'customers')
ORDER BY tablename, cmd;

-- ===================================
-- FIX: Ensure auth.uid() comparisons work correctly
-- ===================================

-- The issue is that auth.uid() returns UUID but our id columns are TEXT
-- We need to cast properly in all policies

-- PROFILES: Must allow subquery access for other policies
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own
  ON public.profiles FOR SELECT
  USING (auth.uid()::text = id);

-- PRODUCTS
DROP POLICY IF EXISTS products_select_own_business ON public.products;
CREATE POLICY products_select_own_business
  ON public.products FOR SELECT
  USING (
    business_id IN (
      SELECT business_id
      FROM public.profiles
      WHERE id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS products_insert_own_business ON public.products;
CREATE POLICY products_insert_own_business
  ON public.products FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT business_id
      FROM public.profiles
      WHERE id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS products_update_own_business ON public.products;
CREATE POLICY products_update_own_business
  ON public.products FOR UPDATE
  USING (
    business_id IN (
      SELECT business_id
      FROM public.profiles
      WHERE id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS products_delete_own_business ON public.products;
CREATE POLICY products_delete_own_business
  ON public.products FOR DELETE
  USING (
    business_id IN (
      SELECT business_id
      FROM public.profiles
      WHERE id = auth.uid()::text
    )
  );

-- ORDERS
DROP POLICY IF EXISTS orders_select_own_business ON public.orders;
CREATE POLICY orders_select_own_business
  ON public.orders FOR SELECT
  USING (
    business_id IN (
      SELECT business_id
      FROM public.profiles
      WHERE id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS orders_insert_own_business ON public.orders;
CREATE POLICY orders_insert_own_business
  ON public.orders FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT business_id
      FROM public.profiles
      WHERE id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS orders_update_own_business ON public.orders;
CREATE POLICY orders_update_own_business
  ON public.orders FOR UPDATE
  USING (
    business_id IN (
      SELECT business_id
      FROM public.profiles
      WHERE id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS orders_delete_own_business ON public.orders;
CREATE POLICY orders_delete_own_business
  ON public.orders FOR DELETE
  USING (
    business_id IN (
      SELECT business_id
      FROM public.profiles
      WHERE id = auth.uid()::text
    )
  );

-- CUSTOMERS
DROP POLICY IF EXISTS customers_select_own_business ON public.customers;
CREATE POLICY customers_select_own_business
  ON public.customers FOR SELECT
  USING (
    business_id IN (
      SELECT business_id
      FROM public.profiles
      WHERE id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS customers_insert_own_business ON public.customers;
CREATE POLICY customers_insert_own_business
  ON public.customers FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT business_id
      FROM public.profiles
      WHERE id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS customers_update_own_business ON public.customers;
CREATE POLICY customers_update_own_business
  ON public.customers FOR UPDATE
  USING (
    business_id IN (
      SELECT business_id
      FROM public.profiles
      WHERE id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS customers_delete_own_business ON public.customers;
CREATE POLICY customers_delete_own_business
  ON public.customers FOR DELETE
  USING (
    business_id IN (
      SELECT business_id
      FROM public.profiles
      WHERE id = auth.uid()::text
    )
  );

-- RESTOCK LOGS
DROP POLICY IF EXISTS restock_select_own_business ON public.restock_logs;
CREATE POLICY restock_select_own_business
  ON public.restock_logs FOR SELECT
  USING (
    business_id IN (
      SELECT business_id
      FROM public.profiles
      WHERE id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS restock_insert_own_business ON public.restock_logs;
CREATE POLICY restock_insert_own_business
  ON public.restock_logs FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT business_id
      FROM public.profiles
      WHERE id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS restock_update_own_business ON public.restock_logs;
CREATE POLICY restock_update_own_business
  ON public.restock_logs FOR UPDATE
  USING (
    business_id IN (
      SELECT business_id
      FROM public.profiles
      WHERE id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS restock_delete_own_business ON public.restock_logs;
CREATE POLICY restock_delete_own_business
  ON public.restock_logs FOR DELETE
  USING (
    business_id IN (
      SELECT business_id
      FROM public.profiles
      WHERE id = auth.uid()::text
    )
  );

-- PROCUREMENTS
DROP POLICY IF EXISTS procurements_select_own_business ON public.procurements;
CREATE POLICY procurements_select_own_business
  ON public.procurements FOR SELECT
  USING (
    business_id IN (
      SELECT business_id
      FROM public.profiles
      WHERE id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS procurements_insert_own_business ON public.procurements;
CREATE POLICY procurements_insert_own_business
  ON public.procurements FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT business_id
      FROM public.profiles
      WHERE id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS procurements_update_own_business ON public.procurements;
CREATE POLICY procurements_update_own_business
  ON public.procurements FOR UPDATE
  USING (
    business_id IN (
      SELECT business_id
      FROM public.profiles
      WHERE id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS procurements_delete_own_business ON public.procurements;
CREATE POLICY procurements_delete_own_business
  ON public.procurements FOR DELETE
  USING (
    business_id IN (
      SELECT business_id
      FROM public.profiles
      WHERE id = auth.uid()::text
    )
  );

-- EXPENSES
DROP POLICY IF EXISTS expenses_select_own_business ON public.expenses;
CREATE POLICY expenses_select_own_business
  ON public.expenses FOR SELECT
  USING (
    business_id IN (
      SELECT business_id
      FROM public.profiles
      WHERE id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS expenses_insert_own_business ON public.expenses;
CREATE POLICY expenses_insert_own_business
  ON public.expenses FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT business_id
      FROM public.profiles
      WHERE id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS expenses_update_own_business ON public.expenses;
CREATE POLICY expenses_update_own_business
  ON public.expenses FOR UPDATE
  USING (
    business_id IN (
      SELECT business_id
      FROM public.profiles
      WHERE id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS expenses_delete_own_business ON public.expenses;
CREATE POLICY expenses_delete_own_business
  ON public.expenses FOR DELETE
  USING (
    business_id IN (
      SELECT business_id
      FROM public.profiles
      WHERE id = auth.uid()::text
    )
  );

-- ===================================
-- VERIFY
-- ===================================

SELECT
  '✅ Data isolation policies updated!' as status,
  'Each user should now only see their own business data.' as message;

-- Show updated policies
SELECT
  tablename,
  policyname,
  cmd as operation
FROM pg_policies
WHERE tablename IN ('products', 'orders', 'customers', 'expenses', 'procurements', 'restock_logs')
ORDER BY tablename, cmd;
