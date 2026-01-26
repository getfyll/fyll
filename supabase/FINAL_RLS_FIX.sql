-- ==================================================================
-- FINAL RLS FIX - COMPREHENSIVE CLEANUP
-- ==================================================================
-- This script removes ALL old policies and creates clean, optimized ones
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
-- PRODUCTS - Business isolation
-- ==================================================================
CREATE POLICY products_select ON public.products FOR SELECT
  USING (business_id = public.get_user_business_id());

CREATE POLICY products_insert ON public.products FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());

CREATE POLICY products_update ON public.products FOR UPDATE
  USING (business_id = public.get_user_business_id());

CREATE POLICY products_delete ON public.products FOR DELETE
  USING (business_id = public.get_user_business_id());

-- ==================================================================
-- ORDERS - Business isolation
-- ==================================================================
CREATE POLICY orders_select ON public.orders FOR SELECT
  USING (business_id = public.get_user_business_id());

CREATE POLICY orders_insert ON public.orders FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());

CREATE POLICY orders_update ON public.orders FOR UPDATE
  USING (business_id = public.get_user_business_id());

CREATE POLICY orders_delete ON public.orders FOR DELETE
  USING (business_id = public.get_user_business_id());

-- ==================================================================
-- CUSTOMERS - Business isolation
-- ==================================================================
CREATE POLICY customers_select ON public.customers FOR SELECT
  USING (business_id = public.get_user_business_id());

CREATE POLICY customers_insert ON public.customers FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());

CREATE POLICY customers_update ON public.customers FOR UPDATE
  USING (business_id = public.get_user_business_id());

CREATE POLICY customers_delete ON public.customers FOR DELETE
  USING (business_id = public.get_user_business_id());

-- ==================================================================
-- EXPENSES - Business isolation
-- ==================================================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'expenses') THEN
    EXECUTE 'CREATE POLICY expenses_select ON public.expenses FOR SELECT
      USING (business_id = public.get_user_business_id())';
    EXECUTE 'CREATE POLICY expenses_insert ON public.expenses FOR INSERT
      WITH CHECK (business_id = public.get_user_business_id())';
    EXECUTE 'CREATE POLICY expenses_update ON public.expenses FOR UPDATE
      USING (business_id = public.get_user_business_id())';
    EXECUTE 'CREATE POLICY expenses_delete ON public.expenses FOR DELETE
      USING (business_id = public.get_user_business_id())';
  END IF;
END $$;

-- ==================================================================
-- PROCUREMENTS - Business isolation
-- ==================================================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'procurements') THEN
    EXECUTE 'CREATE POLICY procurements_select ON public.procurements FOR SELECT
      USING (business_id = public.get_user_business_id())';
    EXECUTE 'CREATE POLICY procurements_insert ON public.procurements FOR INSERT
      WITH CHECK (business_id = public.get_user_business_id())';
    EXECUTE 'CREATE POLICY procurements_update ON public.procurements FOR UPDATE
      USING (business_id = public.get_user_business_id())';
    EXECUTE 'CREATE POLICY procurements_delete ON public.procurements FOR DELETE
      USING (business_id = public.get_user_business_id())';
  END IF;
END $$;

-- ==================================================================
-- RESTOCK_LOGS - Business isolation
-- ==================================================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'restock_logs') THEN
    EXECUTE 'CREATE POLICY restock_logs_select ON public.restock_logs FOR SELECT
      USING (business_id = public.get_user_business_id())';
    EXECUTE 'CREATE POLICY restock_logs_insert ON public.restock_logs FOR INSERT
      WITH CHECK (business_id = public.get_user_business_id())';
    EXECUTE 'CREATE POLICY restock_logs_update ON public.restock_logs FOR UPDATE
      USING (business_id = public.get_user_business_id())';
    EXECUTE 'CREATE POLICY restock_logs_delete ON public.restock_logs FOR DELETE
      USING (business_id = public.get_user_business_id())';
  END IF;
END $$;

-- ==================================================================
-- CONFIGURATION TABLES - Business isolation
-- ==================================================================
DO $$
DECLARE
  config_table TEXT;
BEGIN
  FOR config_table IN (
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN (
      'product_categories', 'product_variables', 'order_statuses',
      'sale_sources', 'payment_methods', 'custom_services',
      'logistics_carriers', 'expense_categories'
    )
  ) LOOP
    EXECUTE format('CREATE POLICY %I_select ON public.%I FOR SELECT
      USING (business_id = public.get_user_business_id())', config_table || '_policy', config_table);
    EXECUTE format('CREATE POLICY %I_insert ON public.%I FOR INSERT
      WITH CHECK (business_id = public.get_user_business_id())', config_table || '_policy', config_table);
    EXECUTE format('CREATE POLICY %I_update ON public.%I FOR UPDATE
      USING (business_id = public.get_user_business_id())', config_table || '_policy', config_table);
    EXECUTE format('CREATE POLICY %I_delete ON public.%I FOR DELETE
      USING (business_id = public.get_user_business_id())', config_table || '_policy', config_table);
  END LOOP;
END $$;

-- ==================================================================
-- SETTINGS & BUSINESS_SETTINGS - Business isolation
-- ==================================================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'settings') THEN
    EXECUTE 'CREATE POLICY settings_select ON public.settings FOR SELECT
      USING (business_id = public.get_user_business_id())';
    EXECUTE 'CREATE POLICY settings_insert ON public.settings FOR INSERT
      WITH CHECK (business_id = public.get_user_business_id())';
    EXECUTE 'CREATE POLICY settings_update ON public.settings FOR UPDATE
      USING (business_id = public.get_user_business_id())';
    EXECUTE 'CREATE POLICY settings_delete ON public.settings FOR DELETE
      USING (business_id = public.get_user_business_id())';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'business_settings') THEN
    EXECUTE 'CREATE POLICY business_settings_select ON public.business_settings FOR SELECT
      USING (business_id = public.get_user_business_id())';
    EXECUTE 'CREATE POLICY business_settings_insert ON public.business_settings FOR INSERT
      WITH CHECK (business_id = public.get_user_business_id())';
    EXECUTE 'CREATE POLICY business_settings_update ON public.business_settings FOR UPDATE
      USING (business_id = public.get_user_business_id())';
    EXECUTE 'CREATE POLICY business_settings_delete ON public.business_settings FOR DELETE
      USING (business_id = public.get_user_business_id())';
  END IF;
END $$;

-- ==================================================================
-- TEAMS & TEAM_MEMBERS - Business isolation
-- ==================================================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'teams') THEN
    EXECUTE 'CREATE POLICY teams_select ON public.teams FOR SELECT
      USING (business_id = public.get_user_business_id())';
    EXECUTE 'CREATE POLICY teams_insert ON public.teams FOR INSERT
      WITH CHECK (business_id = public.get_user_business_id())';
    EXECUTE 'CREATE POLICY teams_update ON public.teams FOR UPDATE
      USING (business_id = public.get_user_business_id())';
    EXECUTE 'CREATE POLICY teams_delete ON public.teams FOR DELETE
      USING (business_id = public.get_user_business_id())';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'team_members') THEN
    EXECUTE 'CREATE POLICY team_members_select ON public.team_members FOR SELECT
      USING (business_id = public.get_user_business_id())';
    EXECUTE 'CREATE POLICY team_members_insert ON public.team_members FOR INSERT
      WITH CHECK (business_id = public.get_user_business_id())';
    EXECUTE 'CREATE POLICY team_members_delete ON public.team_members FOR DELETE
      USING (business_id = public.get_user_business_id())';
  END IF;
END $$;

-- ==================================================================
-- INVITES - Business isolation
-- ==================================================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invites') THEN
    EXECUTE 'CREATE POLICY invites_select ON public.invites FOR SELECT
      USING (business_id = public.get_user_business_id())';
    EXECUTE 'CREATE POLICY invites_insert ON public.invites FOR INSERT
      WITH CHECK (business_id = public.get_user_business_id())';
    EXECUTE 'CREATE POLICY invites_update ON public.invites FOR UPDATE
      USING (business_id = public.get_user_business_id())';
    EXECUTE 'CREATE POLICY invites_delete ON public.invites FOR DELETE
      USING (business_id = public.get_user_business_id())';
  END IF;
END $$;

-- ==================================================================
-- STEP 4: Ensure all tables have RLS enabled
-- ==================================================================
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename NOT LIKE 'pg_%'
        AND tablename NOT LIKE 'sql_%'
    ) LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
    END LOOP;
END $$;

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

-- ==================================================================
-- STEP 7: Update statistics
-- ==================================================================
ANALYZE public.profiles;
ANALYZE public.businesses;
ANALYZE public.products;
ANALYZE public.orders;
ANALYZE public.customers;

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
