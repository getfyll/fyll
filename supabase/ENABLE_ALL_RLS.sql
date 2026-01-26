-- ==================================================================
-- ENABLE RLS ON ALL TABLES - CRITICAL SECURITY FIX
-- ==================================================================
-- This script enables RLS on all public tables to fix security warnings
-- Run this in Supabase SQL Editor
-- ==================================================================

-- First, ensure the helper function exists
CREATE OR REPLACE FUNCTION public.get_user_business_id()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT business_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ENABLE RLS on all tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_carriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restock_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_business_id ON public.products(business_id);
CREATE INDEX IF NOT EXISTS idx_orders_business_id ON public.orders(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_business_id ON public.customers(business_id);
CREATE INDEX IF NOT EXISTS idx_expenses_business_id ON public.expenses(business_id);
CREATE INDEX IF NOT EXISTS idx_procurements_business_id ON public.procurements(business_id);
CREATE INDEX IF NOT EXISTS idx_restock_logs_business_id ON public.restock_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_settings_business_id ON public.settings(business_id);
CREATE INDEX IF NOT EXISTS idx_business_settings_business_id ON public.business_settings(business_id);

-- PROFILES - users can only see their own profile
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT
  USING (id = auth.uid());
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- BUSINESSES - users can see businesses they're part of
DROP POLICY IF EXISTS businesses_select_own ON public.businesses;
DROP POLICY IF EXISTS businesses_insert_own ON public.businesses;
DROP POLICY IF EXISTS businesses_update_own ON public.businesses;

CREATE POLICY businesses_select_own ON public.businesses FOR SELECT
  USING (
    id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
      UNION
      SELECT business_id FROM public.team_members WHERE user_id = auth.uid()
    )
  );
CREATE POLICY businesses_insert_own ON public.businesses FOR INSERT
  WITH CHECK (true); -- Anyone can create a business
CREATE POLICY businesses_update_own ON public.businesses FOR UPDATE
  USING (
    id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- TEAMS - users can see teams in their business
DROP POLICY IF EXISTS teams_select_own_business ON public.teams;
DROP POLICY IF EXISTS teams_insert_own_business ON public.teams;
DROP POLICY IF EXISTS teams_update_own_business ON public.teams;
DROP POLICY IF EXISTS teams_delete_own_business ON public.teams;

CREATE POLICY teams_select_own_business ON public.teams FOR SELECT
  USING (business_id = public.get_user_business_id());
CREATE POLICY teams_insert_own_business ON public.teams FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());
CREATE POLICY teams_update_own_business ON public.teams FOR UPDATE
  USING (business_id = public.get_user_business_id());
CREATE POLICY teams_delete_own_business ON public.teams FOR DELETE
  USING (business_id = public.get_user_business_id());

-- TEAM_MEMBERS - users can see team members in their business
DROP POLICY IF EXISTS team_members_select_own_business ON public.team_members;
DROP POLICY IF EXISTS team_members_insert_own_business ON public.team_members;
DROP POLICY IF EXISTS team_members_delete_own_business ON public.team_members;

CREATE POLICY team_members_select_own_business ON public.team_members FOR SELECT
  USING (business_id = public.get_user_business_id());
CREATE POLICY team_members_insert_own_business ON public.team_members FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());
CREATE POLICY team_members_delete_own_business ON public.team_members FOR DELETE
  USING (business_id = public.get_user_business_id());

-- BUSINESS CONFIGURATION TABLES (read-only for all users in business)
-- product_categories, product_variables, order_statuses, sale_sources, payment_methods, custom_services, logistics_carriers, expense_categories

DROP POLICY IF EXISTS product_categories_select_own_business ON public.product_categories;
DROP POLICY IF EXISTS product_categories_insert_own_business ON public.product_categories;
DROP POLICY IF EXISTS product_categories_update_own_business ON public.product_categories;
DROP POLICY IF EXISTS product_categories_delete_own_business ON public.product_categories;

CREATE POLICY product_categories_select_own_business ON public.product_categories FOR SELECT
  USING (business_id = public.get_user_business_id());
CREATE POLICY product_categories_insert_own_business ON public.product_categories FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());
CREATE POLICY product_categories_update_own_business ON public.product_categories FOR UPDATE
  USING (business_id = public.get_user_business_id());
CREATE POLICY product_categories_delete_own_business ON public.product_categories FOR DELETE
  USING (business_id = public.get_user_business_id());

-- Repeat for other config tables
DROP POLICY IF EXISTS product_variables_select_own_business ON public.product_variables;
DROP POLICY IF EXISTS product_variables_insert_own_business ON public.product_variables;
DROP POLICY IF EXISTS product_variables_update_own_business ON public.product_variables;
DROP POLICY IF EXISTS product_variables_delete_own_business ON public.product_variables;

CREATE POLICY product_variables_select_own_business ON public.product_variables FOR SELECT
  USING (business_id = public.get_user_business_id());
CREATE POLICY product_variables_insert_own_business ON public.product_variables FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());
CREATE POLICY product_variables_update_own_business ON public.product_variables FOR UPDATE
  USING (business_id = public.get_user_business_id());
CREATE POLICY product_variables_delete_own_business ON public.product_variables FOR DELETE
  USING (business_id = public.get_user_business_id());

DROP POLICY IF EXISTS order_statuses_select_own_business ON public.order_statuses;
DROP POLICY IF EXISTS order_statuses_insert_own_business ON public.order_statuses;
DROP POLICY IF EXISTS order_statuses_update_own_business ON public.order_statuses;
DROP POLICY IF EXISTS order_statuses_delete_own_business ON public.order_statuses;

CREATE POLICY order_statuses_select_own_business ON public.order_statuses FOR SELECT
  USING (business_id = public.get_user_business_id());
CREATE POLICY order_statuses_insert_own_business ON public.order_statuses FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());
CREATE POLICY order_statuses_update_own_business ON public.order_statuses FOR UPDATE
  USING (business_id = public.get_user_business_id());
CREATE POLICY order_statuses_delete_own_business ON public.order_statuses FOR DELETE
  USING (business_id = public.get_user_business_id());

DROP POLICY IF EXISTS sale_sources_select_own_business ON public.sale_sources;
DROP POLICY IF EXISTS sale_sources_insert_own_business ON public.sale_sources;
DROP POLICY IF EXISTS sale_sources_update_own_business ON public.sale_sources;
DROP POLICY IF EXISTS sale_sources_delete_own_business ON public.sale_sources;

CREATE POLICY sale_sources_select_own_business ON public.sale_sources FOR SELECT
  USING (business_id = public.get_user_business_id());
CREATE POLICY sale_sources_insert_own_business ON public.sale_sources FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());
CREATE POLICY sale_sources_update_own_business ON public.sale_sources FOR UPDATE
  USING (business_id = public.get_user_business_id());
CREATE POLICY sale_sources_delete_own_business ON public.sale_sources FOR DELETE
  USING (business_id = public.get_user_business_id());

DROP POLICY IF EXISTS payment_methods_select_own_business ON public.payment_methods;
DROP POLICY IF EXISTS payment_methods_insert_own_business ON public.payment_methods;
DROP POLICY IF EXISTS payment_methods_update_own_business ON public.payment_methods;
DROP POLICY IF EXISTS payment_methods_delete_own_business ON public.payment_methods;

CREATE POLICY payment_methods_select_own_business ON public.payment_methods FOR SELECT
  USING (business_id = public.get_user_business_id());
CREATE POLICY payment_methods_insert_own_business ON public.payment_methods FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());
CREATE POLICY payment_methods_update_own_business ON public.payment_methods FOR UPDATE
  USING (business_id = public.get_user_business_id());
CREATE POLICY payment_methods_delete_own_business ON public.payment_methods FOR DELETE
  USING (business_id = public.get_user_business_id());

DROP POLICY IF EXISTS custom_services_select_own_business ON public.custom_services;
DROP POLICY IF EXISTS custom_services_insert_own_business ON public.custom_services;
DROP POLICY IF EXISTS custom_services_update_own_business ON public.custom_services;
DROP POLICY IF EXISTS custom_services_delete_own_business ON public.custom_services;

CREATE POLICY custom_services_select_own_business ON public.custom_services FOR SELECT
  USING (business_id = public.get_user_business_id());
CREATE POLICY custom_services_insert_own_business ON public.custom_services FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());
CREATE POLICY custom_services_update_own_business ON public.custom_services FOR UPDATE
  USING (business_id = public.get_user_business_id());
CREATE POLICY custom_services_delete_own_business ON public.custom_services FOR DELETE
  USING (business_id = public.get_user_business_id());

DROP POLICY IF EXISTS logistics_carriers_select_own_business ON public.logistics_carriers;
DROP POLICY IF EXISTS logistics_carriers_insert_own_business ON public.logistics_carriers;
DROP POLICY IF EXISTS logistics_carriers_update_own_business ON public.logistics_carriers;
DROP POLICY IF EXISTS logistics_carriers_delete_own_business ON public.logistics_carriers;

CREATE POLICY logistics_carriers_select_own_business ON public.logistics_carriers FOR SELECT
  USING (business_id = public.get_user_business_id());
CREATE POLICY logistics_carriers_insert_own_business ON public.logistics_carriers FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());
CREATE POLICY logistics_carriers_update_own_business ON public.logistics_carriers FOR UPDATE
  USING (business_id = public.get_user_business_id());
CREATE POLICY logistics_carriers_delete_own_business ON public.logistics_carriers FOR DELETE
  USING (business_id = public.get_user_business_id());

DROP POLICY IF EXISTS expense_categories_select_own_business ON public.expense_categories;
DROP POLICY IF EXISTS expense_categories_insert_own_business ON public.expense_categories;
DROP POLICY IF EXISTS expense_categories_update_own_business ON public.expense_categories;
DROP POLICY IF EXISTS expense_categories_delete_own_business ON public.expense_categories;

CREATE POLICY expense_categories_select_own_business ON public.expense_categories FOR SELECT
  USING (business_id = public.get_user_business_id());
CREATE POLICY expense_categories_insert_own_business ON public.expense_categories FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());
CREATE POLICY expense_categories_update_own_business ON public.expense_categories FOR UPDATE
  USING (business_id = public.get_user_business_id());
CREATE POLICY expense_categories_delete_own_business ON public.expense_categories FOR DELETE
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

-- SETTINGS
DROP POLICY IF EXISTS settings_select_own_business ON public.settings;
DROP POLICY IF EXISTS settings_insert_own_business ON public.settings;
DROP POLICY IF EXISTS settings_update_own_business ON public.settings;
DROP POLICY IF EXISTS settings_delete_own_business ON public.settings;

CREATE POLICY settings_select_own_business ON public.settings FOR SELECT
  USING (business_id = public.get_user_business_id());
CREATE POLICY settings_insert_own_business ON public.settings FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());
CREATE POLICY settings_update_own_business ON public.settings FOR UPDATE
  USING (business_id = public.get_user_business_id());
CREATE POLICY settings_delete_own_business ON public.settings FOR DELETE
  USING (business_id = public.get_user_business_id());

-- BUSINESS_SETTINGS
DROP POLICY IF EXISTS business_settings_select_own_business ON public.business_settings;
DROP POLICY IF EXISTS business_settings_insert_own_business ON public.business_settings;
DROP POLICY IF EXISTS business_settings_update_own_business ON public.business_settings;
DROP POLICY IF EXISTS business_settings_delete_own_business ON public.business_settings;

CREATE POLICY business_settings_select_own_business ON public.business_settings FOR SELECT
  USING (business_id = public.get_user_business_id());
CREATE POLICY business_settings_insert_own_business ON public.business_settings FOR INSERT
  WITH CHECK (business_id = public.get_user_business_id());
CREATE POLICY business_settings_update_own_business ON public.business_settings FOR UPDATE
  USING (business_id = public.get_user_business_id());
CREATE POLICY business_settings_delete_own_business ON public.business_settings FOR DELETE
  USING (business_id = public.get_user_business_id());

-- Update statistics
ANALYZE public.products;
ANALYZE public.orders;
ANALYZE public.customers;
ANALYZE public.expenses;
ANALYZE public.procurements;
ANALYZE public.restock_logs;

-- ==================================================================
-- DONE! All RLS policies enabled
-- ==================================================================
