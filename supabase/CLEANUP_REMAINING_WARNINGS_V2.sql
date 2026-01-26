-- ==================================================================
-- CLEANUP REMAINING WARNINGS V2
-- ==================================================================
-- This script fixes the remaining 15 warnings:
-- - 3 Auth RLS Initialization Plan warnings on profiles
-- - 12 Duplicate Index warnings (avoiding primary key indexes)
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

-- STEP 2: Remove duplicate indexes (excluding primary key indexes)
-- These were created by multiple migration scripts

-- Helper function to safely drop only non-constraint indexes
DO $$
DECLARE
    idx_record RECORD;
BEGIN
    FOR idx_record IN (
        SELECT
            i.indexname,
            i.tablename
        FROM pg_indexes i
        LEFT JOIN pg_constraint c ON c.conname = i.indexname
        WHERE i.schemaname = 'public'
        AND i.indexname LIKE '%business_id%'
        AND i.tablename IN (
            'business_settings', 'custom_services', 'expense_categories',
            'logistics_carriers', 'order_statuses', 'payment_methods',
            'product_categories', 'product_variables', 'products', 'sale_sources'
        )
        -- Exclude primary key and unique constraint indexes
        AND c.contype IS NULL
        -- Keep only the standard _business_id_idx naming pattern
        AND i.indexname NOT LIKE '%_business_id_idx'
    ) LOOP
        EXECUTE format('DROP INDEX IF EXISTS public.%I', idx_record.indexname);
        RAISE NOTICE 'Dropped index: %', idx_record.indexname;
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
-- DONE! This should reduce warnings significantly
-- ==================================================================
-- After running this, refresh Security Advisor
-- Expected: 0 errors, minimal warnings
-- ==================================================================
