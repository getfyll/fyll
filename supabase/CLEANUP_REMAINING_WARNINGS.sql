-- ==================================================================
-- CLEANUP REMAINING WARNINGS
-- ==================================================================
-- This script fixes the remaining 15 warnings:
-- - 3 Auth RLS Initialization Plan warnings on profiles
-- - 12 Duplicate Index warnings
-- Run this in Supabase SQL Editor
-- ==================================================================

-- STEP 1: Fix profiles policies to use a helper function for auth.uid()
-- This eliminates the "Auth RLS Initialization Plan" warnings

CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid();
$$;

-- Drop and recreate profiles policies with the helper
DROP POLICY IF EXISTS profiles_select_v2 ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_v2 ON public.profiles;
DROP POLICY IF EXISTS profiles_update_v2 ON public.profiles;

CREATE POLICY profiles_select_v2 ON public.profiles FOR SELECT
  USING (id = public.get_current_user_id());

CREATE POLICY profiles_insert_v2 ON public.profiles FOR INSERT
  WITH CHECK (id = public.get_current_user_id());

CREATE POLICY profiles_update_v2 ON public.profiles FOR UPDATE
  USING (id = public.get_current_user_id());

-- STEP 2: Remove duplicate indexes
-- These were created by multiple migration scripts

-- Find and drop duplicate indexes on business_settings
DO $$
DECLARE
    idx_name TEXT;
BEGIN
    -- Keep only one index, drop duplicates
    FOR idx_name IN (
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'business_settings'
        AND indexname LIKE '%business_id%'
        AND indexname != 'business_settings_business_id_idx'
    ) LOOP
        EXECUTE format('DROP INDEX IF EXISTS public.%I', idx_name);
    END LOOP;
END $$;

-- Find and drop duplicate indexes on custom_services
DO $$
DECLARE
    idx_name TEXT;
BEGIN
    FOR idx_name IN (
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'custom_services'
        AND indexname LIKE '%business_id%'
        AND indexname != 'custom_services_business_id_idx'
    ) LOOP
        EXECUTE format('DROP INDEX IF EXISTS public.%I', idx_name);
    END LOOP;
END $$;

-- Find and drop duplicate indexes on expense_categories
DO $$
DECLARE
    idx_name TEXT;
BEGIN
    FOR idx_name IN (
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'expense_categories'
        AND indexname LIKE '%business_id%'
        AND indexname != 'expense_categories_business_id_idx'
    ) LOOP
        EXECUTE format('DROP INDEX IF EXISTS public.%I', idx_name);
    END LOOP;
END $$;

-- Find and drop duplicate indexes on logistics_carriers
DO $$
DECLARE
    idx_name TEXT;
BEGIN
    FOR idx_name IN (
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'logistics_carriers'
        AND indexname LIKE '%business_id%'
        AND indexname != 'logistics_carriers_business_id_idx'
    ) LOOP
        EXECUTE format('DROP INDEX IF EXISTS public.%I', idx_name);
    END LOOP;
END $$;

-- Find and drop duplicate indexes on order_statuses
DO $$
DECLARE
    idx_name TEXT;
BEGIN
    FOR idx_name IN (
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'order_statuses'
        AND indexname LIKE '%business_id%'
        AND indexname != 'order_statuses_business_id_idx'
    ) LOOP
        EXECUTE format('DROP INDEX IF EXISTS public.%I', idx_name);
    END LOOP;
END $$;

-- Find and drop duplicate indexes on payment_methods
DO $$
DECLARE
    idx_name TEXT;
BEGIN
    FOR idx_name IN (
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'payment_methods'
        AND indexname LIKE '%business_id%'
        AND indexname != 'payment_methods_business_id_idx'
    ) LOOP
        EXECUTE format('DROP INDEX IF EXISTS public.%I', idx_name);
    END LOOP;
END $$;

-- Find and drop duplicate indexes on product_categories
DO $$
DECLARE
    idx_name TEXT;
BEGIN
    FOR idx_name IN (
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'product_categories'
        AND indexname LIKE '%business_id%'
        AND indexname != 'product_categories_business_id_idx'
    ) LOOP
        EXECUTE format('DROP INDEX IF EXISTS public.%I', idx_name);
    END LOOP;
END $$;

-- Find and drop duplicate indexes on product_variables
DO $$
DECLARE
    idx_name TEXT;
BEGIN
    FOR idx_name IN (
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'product_variables'
        AND indexname LIKE '%business_id%'
        AND indexname != 'product_variables_business_id_idx'
    ) LOOP
        EXECUTE format('DROP INDEX IF EXISTS public.%I', idx_name);
    END LOOP;
END $$;

-- Find and drop duplicate indexes on products (keep products_business_id_idx)
DO $$
DECLARE
    idx_name TEXT;
BEGIN
    FOR idx_name IN (
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'products'
        AND indexname LIKE '%business_id%'
        AND indexname NOT IN ('products_business_id_idx', 'idx_products_business_id')
    ) LOOP
        EXECUTE format('DROP INDEX IF EXISTS public.%I', idx_name);
    END LOOP;
END $$;

-- Find and drop duplicate indexes on sale_sources
DO $$
DECLARE
    idx_name TEXT;
BEGIN
    FOR idx_name IN (
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'sale_sources'
        AND indexname LIKE '%business_id%'
        AND indexname != 'sale_sources_business_id_idx'
    ) LOOP
        EXECUTE format('DROP INDEX IF EXISTS public.%I', idx_name);
    END LOOP;
END $$;

-- STEP 3: Update statistics
ANALYZE public.profiles;
ANALYZE public.business_settings;
ANALYZE public.custom_services;
ANALYZE public.expense_categories;
ANALYZE public.logistics_carriers;
ANALYZE public.order_statuses;
ANALYZE public.payment_methods;
ANALYZE public.product_categories;
ANALYZE public.product_variables;
ANALYZE public.products;
ANALYZE public.sale_sources;

-- ==================================================================
-- DONE! This should reduce warnings to near zero
-- ==================================================================
-- After running this, refresh Security Advisor
-- Expected: 0 errors, 1-2 warnings (only businesses_insert_v2)
-- ==================================================================
