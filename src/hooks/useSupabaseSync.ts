import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import useAuthStore from '@/lib/state/auth-store';
import useFyllStore from '@/lib/state/fyll-store';
import { supabase } from '@/lib/supabase';
import { supabaseData } from '@/lib/supabase/data';
import { supabaseSettings } from '@/lib/supabase/settings';
import type {
  Product,
  Order,
  Customer,
  RestockLog,
  Procurement,
  Expense,
  Case,
  AuditLog,
  OrderStatus,
  SaleSource,
  CustomService,
  PaymentMethod,
  LogisticsCarrier,
  ProductVariable,
  ExpenseCategory,
  CaseStatusOption,
} from '@/lib/state/fyll-store';

const TABLES = {
  products: 'products',
  orders: 'orders',
  customers: 'customers',
  restockLogs: 'restock_logs',
  procurements: 'procurements',
  expenses: 'expenses',
  cases: 'cases',
  auditLogs: 'audit_logs',
};

type GlobalSettingsPayload = {
  categories: string[];
  productVariables: ProductVariable[];
  orderStatuses: OrderStatus[];
  saleSources: SaleSource[];
  customServices: CustomService[];
  paymentMethods: PaymentMethod[];
  logisticsCarriers: LogisticsCarrier[];
  expenseCategories: ExpenseCategory[];
  caseStatuses: CaseStatusOption[];
  useGlobalLowStockThreshold: boolean;
  globalLowStockThreshold: number;
};

const toIdSet = (items: { id: string }[]) => new Set(items.map((item) => item.id));
const mapData = <T>(rows: { data: T }[]) => rows.map((row) => row.data);

const SETTINGS_TABLES = {
  orderStatuses: 'order_statuses',
  saleSources: 'sale_sources',
  customServices: 'custom_services',
  paymentMethods: 'payment_methods',
  logisticsCarriers: 'logistics_carriers',
  productCategories: 'product_categories',
  productVariables: 'product_variables',
  expenseCategories: 'expense_categories',
  caseStatuses: 'case_statuses',
  businessSettings: 'business_settings',
} as const;

const slugify = (value: string) => value
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)+/g, '');

const buildCategoryItems = (categories: string[]) => {
  const items = new Map<string, { id: string; name: string }>();
  categories.forEach((category, index) => {
    const trimmed = category.trim();
    if (!trimmed) return;
    const slug = slugify(trimmed);
    const id = slug || `category-${index + 1}`;
    if (!items.has(id)) {
      items.set(id, { id, name: trimmed });
    }
  });
  return Array.from(items.values());
};

export function useSupabaseSync() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const applyingRemote = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncingRef = useRef(false);
  const lastRealtimeAt = useRef(0);

  const businessId = useAuthStore((s) => s.businessId);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isOfflineMode = useAuthStore((s) => s.isOfflineMode);

  const products = useFyllStore((s) => s.products);
  const orders = useFyllStore((s) => s.orders);
  const customers = useFyllStore((s) => s.customers);
  const restockLogs = useFyllStore((s) => s.restockLogs);
  const procurements = useFyllStore((s) => s.procurements);
  const expenses = useFyllStore((s) => s.expenses);
  const cases = useFyllStore((s) => s.cases);
  const auditLogs = useFyllStore((s) => s.auditLogs);
  const categories = useFyllStore((s) => s.categories);
  const productVariables = useFyllStore((s) => s.productVariables);
  const orderStatuses = useFyllStore((s) => s.orderStatuses);
  const saleSources = useFyllStore((s) => s.saleSources);
  const customServices = useFyllStore((s) => s.customServices);
  const paymentMethods = useFyllStore((s) => s.paymentMethods);
  const logisticsCarriers = useFyllStore((s) => s.logisticsCarriers);
  const expenseCategories = useFyllStore((s) => s.expenseCategories);
  const useGlobalLowStockThreshold = useFyllStore((s) => s.useGlobalLowStockThreshold);
  const globalLowStockThreshold = useFyllStore((s) => s.globalLowStockThreshold);

  const prevProductIds = useRef<Set<string>>(new Set());
  const prevOrderIds = useRef<Set<string>>(new Set());
  const prevCustomerIds = useRef<Set<string>>(new Set());
  const prevRestockIds = useRef<Set<string>>(new Set());
  const prevProcurementIds = useRef<Set<string>>(new Set());
  const prevExpenseIds = useRef<Set<string>>(new Set());
  const prevCaseIds = useRef<Set<string>>(new Set());
  const prevAuditLogIds = useRef<Set<string>>(new Set());
  const prevOrderStatusIds = useRef<Set<string>>(new Set());
  const prevSaleSourceIds = useRef<Set<string>>(new Set());
  const prevCustomServiceIds = useRef<Set<string>>(new Set());
  const prevPaymentMethodIds = useRef<Set<string>>(new Set());
  const prevLogisticsCarrierIds = useRef<Set<string>>(new Set());
  const prevProductVariableIds = useRef<Set<string>>(new Set());
  const prevExpenseCategoryIds = useRef<Set<string>>(new Set());
  const prevCategoryIds = useRef<Set<string>>(new Set());
  const prevCaseStatusIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isAuthenticated || !businessId || isOfflineMode) {
      return;
    }

    let cancelled = false;

    const applyRemoteState = (next: {
      products: Product[];
      orders: Order[];
      customers: Customer[];
      restockLogs: RestockLog[];
      procurements: Procurement[];
      expenses: Expense[];
      cases: Case[];
      auditLogs: AuditLog[];
      settings?: GlobalSettingsPayload | null;
    }) => {
      applyingRemote.current = true;
      if (next.settings) {
        useFyllStore.setState({
          products: next.products,
          orders: next.orders,
          customers: next.customers,
          restockLogs: next.restockLogs,
          procurements: next.procurements,
          expenses: next.expenses,
          cases: next.cases,
          auditLogs: next.auditLogs,
          categories: next.settings.categories,
          productVariables: next.settings.productVariables,
          orderStatuses: next.settings.orderStatuses,
          saleSources: next.settings.saleSources,
          customServices: next.settings.customServices,
          paymentMethods: next.settings.paymentMethods,
          logisticsCarriers: next.settings.logisticsCarriers,
          expenseCategories: next.settings.expenseCategories,
          caseStatuses: next.settings.caseStatuses,
          useGlobalLowStockThreshold: next.settings.useGlobalLowStockThreshold,
          globalLowStockThreshold: next.settings.globalLowStockThreshold,
        });
      } else {
        useFyllStore.setState({
          products: next.products,
          orders: next.orders,
          customers: next.customers,
          restockLogs: next.restockLogs,
          procurements: next.procurements,
          expenses: next.expenses,
          cases: next.cases,
          auditLogs: next.auditLogs,
        });
      }
      prevProductIds.current = toIdSet(next.products);
      prevOrderIds.current = toIdSet(next.orders);
      prevCustomerIds.current = toIdSet(next.customers);
      prevRestockIds.current = toIdSet(next.restockLogs);
      prevProcurementIds.current = toIdSet(next.procurements);
      prevExpenseIds.current = toIdSet(next.expenses);
        prevCaseIds.current = toIdSet(next.cases);
        prevAuditLogIds.current = toIdSet(next.auditLogs);
        if (next.settings) {
        prevOrderStatusIds.current = toIdSet(next.settings.orderStatuses);
        prevSaleSourceIds.current = toIdSet(next.settings.saleSources);
        prevCustomServiceIds.current = toIdSet(next.settings.customServices);
        prevPaymentMethodIds.current = toIdSet(next.settings.paymentMethods);
        prevLogisticsCarrierIds.current = toIdSet(next.settings.logisticsCarriers);
        prevProductVariableIds.current = toIdSet(next.settings.productVariables);
        prevExpenseCategoryIds.current = toIdSet(next.settings.expenseCategories);
        prevCategoryIds.current = toIdSet(buildCategoryItems(next.settings.categories));
        prevCaseStatusIds.current = toIdSet(next.settings.caseStatuses);
      }
      applyingRemote.current = false;
    };

    const applyDataSlice = <T extends { id: string }>(
      key: 'products' | 'orders' | 'customers' | 'restockLogs' | 'procurements' | 'expenses' | 'cases' | 'auditLogs',
      rows: { data: T }[],
    ) => {
      const items = rows.map((row) => row.data);
      useFyllStore.setState({ [key]: items } as Partial<ReturnType<typeof useFyllStore.getState>>);
      if (key === 'products') prevProductIds.current = toIdSet(items);
      if (key === 'orders') prevOrderIds.current = toIdSet(items);
      if (key === 'customers') prevCustomerIds.current = toIdSet(items);
      if (key === 'restockLogs') prevRestockIds.current = toIdSet(items);
      if (key === 'procurements') prevProcurementIds.current = toIdSet(items);
      if (key === 'expenses') prevExpenseIds.current = toIdSet(items);
      if (key === 'cases') prevCaseIds.current = toIdSet(items);
      if (key === 'auditLogs') prevAuditLogIds.current = toIdSet(items);
    };

    const applySettingsSlice = (table: string, rows: { data: any }[]) => {
      const items = mapData(rows);
      switch (table) {
        case SETTINGS_TABLES.orderStatuses:
          useFyllStore.setState({ orderStatuses: items });
          prevOrderStatusIds.current = toIdSet(items);
          break;
        case SETTINGS_TABLES.saleSources:
          useFyllStore.setState({ saleSources: items });
          prevSaleSourceIds.current = toIdSet(items);
          break;
        case SETTINGS_TABLES.customServices:
          useFyllStore.setState({ customServices: items });
          prevCustomServiceIds.current = toIdSet(items);
          break;
        case SETTINGS_TABLES.paymentMethods:
          useFyllStore.setState({ paymentMethods: items });
          prevPaymentMethodIds.current = toIdSet(items);
          break;
        case SETTINGS_TABLES.logisticsCarriers:
          useFyllStore.setState({ logisticsCarriers: items });
          prevLogisticsCarrierIds.current = toIdSet(items);
          break;
        case SETTINGS_TABLES.productVariables:
          useFyllStore.setState({ productVariables: items });
          prevProductVariableIds.current = toIdSet(items);
          break;
        case SETTINGS_TABLES.expenseCategories:
          useFyllStore.setState({ expenseCategories: items });
          prevExpenseCategoryIds.current = toIdSet(items);
          break;
        case SETTINGS_TABLES.productCategories: {
          const names = rows
            .map((row) => row.data?.name)
            .filter((name): name is string => typeof name === 'string');
          useFyllStore.setState({ categories: names });
          prevCategoryIds.current = toIdSet(buildCategoryItems(names));
          break;
        }
        case SETTINGS_TABLES.caseStatuses:
          useFyllStore.setState({ caseStatuses: items });
          prevCaseStatusIds.current = toIdSet(items);
          break;
        case SETTINGS_TABLES.businessSettings: {
          const businessSettings = rows[0]?.data;
          useFyllStore.setState({
            useGlobalLowStockThreshold: businessSettings?.useGlobalLowStockThreshold
              ?? useFyllStore.getState().useGlobalLowStockThreshold
              ?? false,
            globalLowStockThreshold: businessSettings?.globalLowStockThreshold
              ?? useFyllStore.getState().globalLowStockThreshold
              ?? 0,
          });
          break;
        }
        default:
          break;
      }
    };

    const syncTable = async (table: string) => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      try {
        if (Object.values(TABLES).includes(table as (typeof TABLES)[keyof typeof TABLES])) {
          switch (table) {
            case TABLES.products:
              applyDataSlice('products', await supabaseData.fetchCollection<Product>(TABLES.products, businessId));
              break;
            case TABLES.orders:
              applyDataSlice('orders', await supabaseData.fetchCollection<Order>(TABLES.orders, businessId));
              break;
            case TABLES.customers:
              applyDataSlice('customers', await supabaseData.fetchCollection<Customer>(TABLES.customers, businessId));
              break;
            case TABLES.restockLogs:
              applyDataSlice('restockLogs', await supabaseData.fetchCollection<RestockLog>(TABLES.restockLogs, businessId));
              break;
            case TABLES.procurements:
              applyDataSlice('procurements', await supabaseData.fetchCollection<Procurement>(TABLES.procurements, businessId));
              break;
            case TABLES.expenses:
              applyDataSlice('expenses', await supabaseData.fetchCollection<Expense>(TABLES.expenses, businessId));
              break;
            case TABLES.cases:
              applyDataSlice('cases', await supabaseData.fetchCollection<Case>(TABLES.cases, businessId));
              break;
            case TABLES.auditLogs:
              applyDataSlice('auditLogs', await supabaseData.fetchCollection<AuditLog>(TABLES.auditLogs, businessId));
              break;
            default:
              break;
          }
          return;
        }

        if (Object.values(SETTINGS_TABLES).includes(table as (typeof SETTINGS_TABLES)[keyof typeof SETTINGS_TABLES])) {
          const rows = await supabaseSettings.fetchSettings<any>(table, businessId);
          applySettingsSlice(table, rows);
        }
      } catch (error) {
        console.warn('Supabase table sync failed:', error);
      } finally {
        syncingRef.current = false;
      }
    };

    const syncAll = async () => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      if (!cancelled) {
        setIsSyncing(true);
      }
      try {
        const localProducts = useFyllStore.getState().products;

        // Fetch everything including products
        const [
          productRows,
          orderRows,
          customerRows,
          restockRows,
          procurementRows,
          expenseRows,
          caseRows,
          auditLogRows,
          orderStatusRows,
          saleSourceRows,
          customServiceRows,
          paymentMethodRows,
          logisticsCarrierRows,
          productVariableRows,
          expenseCategoryRows,
          caseStatusRows,
          categoryRows,
          businessSettingsRows,
        ] = await Promise.all([
          supabaseData.fetchCollection<Product>(TABLES.products, businessId),
          supabaseData.fetchCollection<Order>(TABLES.orders, businessId),
          supabaseData.fetchCollection<Customer>(TABLES.customers, businessId),
          supabaseData.fetchCollection<RestockLog>(TABLES.restockLogs, businessId),
          supabaseData.fetchCollection<Procurement>(TABLES.procurements, businessId),
          supabaseData.fetchCollection<Expense>(TABLES.expenses, businessId),
          supabaseData.fetchCollection<Case>(TABLES.cases, businessId),
          supabaseData.fetchCollection<AuditLog>(TABLES.auditLogs, businessId),
          supabaseSettings.fetchSettings<OrderStatus>(SETTINGS_TABLES.orderStatuses, businessId),
          supabaseSettings.fetchSettings<SaleSource>(SETTINGS_TABLES.saleSources, businessId),
          supabaseSettings.fetchSettings<CustomService>(SETTINGS_TABLES.customServices, businessId),
          supabaseSettings.fetchSettings<PaymentMethod>(SETTINGS_TABLES.paymentMethods, businessId),
          supabaseSettings.fetchSettings<LogisticsCarrier>(SETTINGS_TABLES.logisticsCarriers, businessId),
          supabaseSettings.fetchSettings<ProductVariable>(SETTINGS_TABLES.productVariables, businessId),
          supabaseSettings.fetchSettings<ExpenseCategory>(SETTINGS_TABLES.expenseCategories, businessId),
          supabaseSettings.fetchSettings<CaseStatusOption>(SETTINGS_TABLES.caseStatuses, businessId),
          supabaseSettings.fetchSettings<{ id: string; name: string }>(SETTINGS_TABLES.productCategories, businessId),
          supabaseSettings.fetchSettings<{ id: string; useGlobalLowStockThreshold?: boolean; globalLowStockThreshold?: number }>(
            SETTINGS_TABLES.businessSettings,
            businessId
          ),
        ]);

        const remoteProducts = productRows.map((row) => row.data);
        const businessSettings = businessSettingsRows[0]?.data;
        const remoteSettings: GlobalSettingsPayload = {
          categories: categoryRows
            .map((row) => row.data?.name)
            .filter((name): name is string => typeof name === 'string'),
          productVariables: mapData(productVariableRows),
          orderStatuses: mapData(orderStatusRows),
          saleSources: mapData(saleSourceRows),
          customServices: mapData(customServiceRows),
          paymentMethods: mapData(paymentMethodRows),
          logisticsCarriers: mapData(logisticsCarrierRows),
          expenseCategories: mapData(expenseCategoryRows),
          caseStatuses: mapData(caseStatusRows),
          useGlobalLowStockThreshold: businessSettings?.useGlobalLowStockThreshold
            ?? useFyllStore.getState().useGlobalLowStockThreshold
            ?? false,
          globalLowStockThreshold: businessSettings?.globalLowStockThreshold
            ?? useFyllStore.getState().globalLowStockThreshold
            ?? 0,
        };

        if (!cancelled) {
          if (remoteProducts.length === 0 && localProducts.length > 0) {
            await supabaseData.upsertCollection(TABLES.products, businessId, localProducts);
            applyRemoteState({
              products: localProducts,
              orders: orderRows.map((row) => row.data),
              customers: customerRows.map((row) => row.data),
              restockLogs: restockRows.map((row) => row.data),
              procurements: procurementRows.map((row) => row.data),
              expenses: expenseRows.map((row) => row.data),
              cases: caseRows.map((row) => row.data),
              auditLogs: auditLogRows.map((row) => row.data),
              settings: remoteSettings,
            });
          } else {
            applyRemoteState({
              products: remoteProducts,
              orders: orderRows.map((row) => row.data),
              customers: customerRows.map((row) => row.data),
              restockLogs: restockRows.map((row) => row.data),
              procurements: procurementRows.map((row) => row.data),
              expenses: expenseRows.map((row) => row.data),
              cases: caseRows.map((row) => row.data),
              auditLogs: auditLogRows.map((row) => row.data),
              settings: remoteSettings,
            });
          }
        }
      } catch (error) {
        console.warn('Supabase sync failed:', error);
      } finally {
        syncingRef.current = false;
        if (!cancelled) {
          setIsInitialized(true);
          setIsSyncing(false);
        }
      }
    };

    syncAll();

    // Fallback sync (only if realtime is quiet) to reduce egress.
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      if (now - lastRealtimeAt.current < 10 * 60 * 1000) return;
      syncAll();
    }, 5 * 60 * 1000);

    const dataChannel = supabase.channel(`data-${businessId}`);
    Object.values(TABLES).forEach((table) => {
      dataChannel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `business_id=eq.${businessId}`,
        },
        (payload) => {
          lastRealtimeAt.current = Date.now();
          syncTable(payload.table);
        }
      );
    });
    dataChannel.subscribe();

    const settingsChannel = supabase.channel(`settings-${businessId}`);
    Object.values(SETTINGS_TABLES).forEach((table) => {
      settingsChannel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `business_id=eq.${businessId}`,
        },
        (payload) => {
          lastRealtimeAt.current = Date.now();
          syncTable(payload.table);
        }
      );
    });
    settingsChannel.subscribe();

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      supabase.removeChannel(dataChannel);
      supabase.removeChannel(settingsChannel);
    };
  }, [businessId, isAuthenticated, isOfflineMode]);

  // Pause/resume sync based on app state to reduce egress
  useEffect(() => {
    if (!isAuthenticated || !businessId || isOfflineMode) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App going to background - clear the fallback interval to stop polling
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        console.log('🛑 Sync paused: app in background');
      } else if (nextAppState === 'active') {
        // App coming to foreground - realtime channels stay active, just note it
        console.log('✅ App active: realtime channels still active, fallback sync not needed');
        // Note: We don't need to restart the interval here because:
        // 1. Realtime channels remain active and will trigger syncs
        // 2. The main useEffect will handle setting up intervals
        // 3. This prevents duplicate intervals
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [businessId, isAuthenticated, isOfflineMode]);

  // SAFETY: Never bulk-delete ALL items from Supabase. If the local list goes
  // from N items to 0 that is always a store reset / logout, never a legitimate
  // user action. Skipping prevents accidental data wipe.
  const safeSyncDeletions = (
    table: string,
    nextIds: Set<string>,
    prevIds: React.RefObject<Set<string>>,
    label: string,
  ) => {
    const removed = [...prevIds.current].filter((id) => !nextIds.has(id));
    prevIds.current = nextIds;

    // If EVERYTHING was removed (going to 0) and there were items before,
    // this is a store reset — NOT legitimate deletions. Block it.
    if (nextIds.size === 0 && removed.length > 0) {
      console.warn(`🛡️ Blocked bulk deletion of ALL ${removed.length} ${label} — likely a store reset`);
      return;
    }

    if (removed.length > 0) {
      supabaseData
        .deleteByIds(table, businessId!, removed)
        .catch((error) => console.warn(`Supabase ${label} delete error:`, error));
    }
  };

  useEffect(() => {
    if (!isInitialized || !businessId || isOfflineMode || applyingRemote.current) return;
    safeSyncDeletions(TABLES.products, toIdSet(products), prevProductIds, 'products');
  }, [products, businessId, isInitialized, isOfflineMode]);

  useEffect(() => {
    if (!isInitialized || !businessId || isOfflineMode || applyingRemote.current) return;
    safeSyncDeletions(TABLES.orders, toIdSet(orders), prevOrderIds, 'orders');
  }, [orders, businessId, isInitialized, isOfflineMode]);

  useEffect(() => {
    if (!isInitialized || !businessId || isOfflineMode || applyingRemote.current) return;
    safeSyncDeletions(TABLES.customers, toIdSet(customers), prevCustomerIds, 'customers');
  }, [customers, businessId, isInitialized, isOfflineMode]);

  useEffect(() => {
    if (!isInitialized || !businessId || isOfflineMode || applyingRemote.current) return;
    safeSyncDeletions(TABLES.restockLogs, toIdSet(restockLogs), prevRestockIds, 'restock logs');
  }, [restockLogs, businessId, isInitialized, isOfflineMode]);

  useEffect(() => {
    if (!isInitialized || !businessId || isOfflineMode || applyingRemote.current) return;
    safeSyncDeletions(TABLES.procurements, toIdSet(procurements), prevProcurementIds, 'procurements');
  }, [procurements, businessId, isInitialized, isOfflineMode]);

  useEffect(() => {
    if (!isInitialized || !businessId || isOfflineMode || applyingRemote.current) return;
    safeSyncDeletions(TABLES.expenses, toIdSet(expenses), prevExpenseIds, 'expenses');
  }, [expenses, businessId, isInitialized, isOfflineMode]);

  useEffect(() => {
    if (!isInitialized || !businessId || isOfflineMode || applyingRemote.current) return;
    safeSyncDeletions(TABLES.cases, toIdSet(cases), prevCaseIds, 'cases');
  }, [cases, businessId, isInitialized, isOfflineMode]);

  useEffect(() => {
    if (!isInitialized || !businessId || isOfflineMode || applyingRemote.current) return;

    const nextIds = toIdSet(auditLogs);
    const removed = [...prevAuditLogIds.current].filter((id) => !nextIds.has(id));
    const added = auditLogs.filter((log) => !prevAuditLogIds.current.has(log.id));

    // Block bulk wipe (same safety as above)
    if (nextIds.size === 0 && removed.length > 0) {
      console.warn(`🛡️ Blocked bulk deletion of ALL ${removed.length} audit logs — likely a store reset`);
      prevAuditLogIds.current = nextIds;
      return;
    }
    prevAuditLogIds.current = nextIds;

    if (added.length > 0) {
      supabaseData
        .upsertCollection(TABLES.auditLogs, businessId, added)
        .catch((error) => console.warn('Supabase audit log upsert error:', error));
    }

    if (removed.length > 0) {
      supabaseData
        .deleteByIds(TABLES.auditLogs, businessId, removed)
        .catch((error) => console.warn('Supabase audit log delete error:', error));
    }
  }, [auditLogs, businessId, isInitialized, isOfflineMode]);

  useEffect(() => {
    if (!isInitialized || !businessId || isOfflineMode || applyingRemote.current) return;

    const nextOrderStatusIds = toIdSet(orderStatuses);
    const removedOrderStatuses = [...prevOrderStatusIds.current].filter((id) => !nextOrderStatusIds.has(id));
    prevOrderStatusIds.current = nextOrderStatusIds;

    const nextSaleSourceIds = toIdSet(saleSources);
    const removedSaleSources = [...prevSaleSourceIds.current].filter((id) => !nextSaleSourceIds.has(id));
    prevSaleSourceIds.current = nextSaleSourceIds;

    const nextCustomServiceIds = toIdSet(customServices);
    const removedCustomServices = [...prevCustomServiceIds.current].filter((id) => !nextCustomServiceIds.has(id));
    prevCustomServiceIds.current = nextCustomServiceIds;

    const nextPaymentMethodIds = toIdSet(paymentMethods);
    const removedPaymentMethods = [...prevPaymentMethodIds.current].filter((id) => !nextPaymentMethodIds.has(id));
    prevPaymentMethodIds.current = nextPaymentMethodIds;

    const nextLogisticsCarrierIds = toIdSet(logisticsCarriers);
    const removedLogisticsCarriers = [...prevLogisticsCarrierIds.current].filter((id) => !nextLogisticsCarrierIds.has(id));
    prevLogisticsCarrierIds.current = nextLogisticsCarrierIds;

    const nextProductVariableIds = toIdSet(productVariables);
    const removedProductVariables = [...prevProductVariableIds.current].filter((id) => !nextProductVariableIds.has(id));
    prevProductVariableIds.current = nextProductVariableIds;

    const nextExpenseCategoryIds = toIdSet(expenseCategories);
    const removedExpenseCategories = [...prevExpenseCategoryIds.current].filter((id) => !nextExpenseCategoryIds.has(id));
    prevExpenseCategoryIds.current = nextExpenseCategoryIds;

    const categoryItems = buildCategoryItems(categories);
    const nextCategoryIds = toIdSet(categoryItems);
    const removedCategories = [...prevCategoryIds.current].filter((id) => !nextCategoryIds.has(id));
    prevCategoryIds.current = nextCategoryIds;

    const businessSettings = [{
      id: 'global',
      useGlobalLowStockThreshold,
      globalLowStockThreshold,
    }];

    Promise.all([
      supabaseSettings.upsertSettings(SETTINGS_TABLES.orderStatuses, businessId, orderStatuses),
      supabaseSettings.deleteSettings(SETTINGS_TABLES.orderStatuses, businessId, removedOrderStatuses),
      supabaseSettings.upsertSettings(SETTINGS_TABLES.saleSources, businessId, saleSources),
      supabaseSettings.deleteSettings(SETTINGS_TABLES.saleSources, businessId, removedSaleSources),
      supabaseSettings.upsertSettings(SETTINGS_TABLES.customServices, businessId, customServices),
      supabaseSettings.deleteSettings(SETTINGS_TABLES.customServices, businessId, removedCustomServices),
      supabaseSettings.upsertSettings(SETTINGS_TABLES.paymentMethods, businessId, paymentMethods),
      supabaseSettings.deleteSettings(SETTINGS_TABLES.paymentMethods, businessId, removedPaymentMethods),
      supabaseSettings.upsertSettings(SETTINGS_TABLES.logisticsCarriers, businessId, logisticsCarriers),
      supabaseSettings.deleteSettings(SETTINGS_TABLES.logisticsCarriers, businessId, removedLogisticsCarriers),
      supabaseSettings.upsertSettings(SETTINGS_TABLES.productVariables, businessId, productVariables),
      supabaseSettings.deleteSettings(SETTINGS_TABLES.productVariables, businessId, removedProductVariables),
      supabaseSettings.upsertSettings(SETTINGS_TABLES.expenseCategories, businessId, expenseCategories),
      supabaseSettings.deleteSettings(SETTINGS_TABLES.expenseCategories, businessId, removedExpenseCategories),
      supabaseSettings.upsertSettings(SETTINGS_TABLES.productCategories, businessId, categoryItems),
      supabaseSettings.deleteSettings(SETTINGS_TABLES.productCategories, businessId, removedCategories),
      supabaseSettings.upsertSettings(SETTINGS_TABLES.businessSettings, businessId, businessSettings),
    ]).catch((error) => {
      console.warn('Supabase settings sync error:', error);
    });
  }, [
    categories,
    productVariables,
    orderStatuses,
    saleSources,
    customServices,
    paymentMethods,
    logisticsCarriers,
    expenseCategories,
    useGlobalLowStockThreshold,
    globalLowStockThreshold,
    businessId,
    isInitialized,
    isOfflineMode,
  ]);

  return { isInitialized, isSyncing };
}
