import { useEffect, useRef, useState } from 'react';
import useAuthStore from '@/lib/state/auth-store';
import useFyllStore from '@/lib/state/fyll-store';
import { supabaseData } from '@/lib/supabase/data';
import type { Product, Order, Customer, RestockLog, Procurement, Expense } from '@/lib/state/fyll-store';

const TABLES = {
  products: 'products',
  orders: 'orders',
  customers: 'customers',
  restockLogs: 'restock_logs',
  procurements: 'procurements',
  expenses: 'expenses',
};

const toIdSet = (items: { id: string }[]) => new Set(items.map((item) => item.id));

export function useSupabaseSync() {
  const [isInitialized, setIsInitialized] = useState(false);
  const applyingRemote = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const businessId = useAuthStore((s) => s.businessId);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isOfflineMode = useAuthStore((s) => s.isOfflineMode);

  const products = useFyllStore((s) => s.products);
  const orders = useFyllStore((s) => s.orders);
  const customers = useFyllStore((s) => s.customers);
  const restockLogs = useFyllStore((s) => s.restockLogs);
  const procurements = useFyllStore((s) => s.procurements);
  const expenses = useFyllStore((s) => s.expenses);

  const prevProductIds = useRef<Set<string>>(new Set());
  const prevOrderIds = useRef<Set<string>>(new Set());
  const prevCustomerIds = useRef<Set<string>>(new Set());
  const prevRestockIds = useRef<Set<string>>(new Set());
  const prevProcurementIds = useRef<Set<string>>(new Set());
  const prevExpenseIds = useRef<Set<string>>(new Set());

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
    }) => {
      applyingRemote.current = true;
      useFyllStore.setState(next);
      prevProductIds.current = toIdSet(next.products);
      prevOrderIds.current = toIdSet(next.orders);
      prevCustomerIds.current = toIdSet(next.customers);
      prevRestockIds.current = toIdSet(next.restockLogs);
      prevProcurementIds.current = toIdSet(next.procurements);
      prevExpenseIds.current = toIdSet(next.expenses);
      applyingRemote.current = false;
    };

    const syncAll = async () => {
      try {
        const [
          productRows,
          orderRows,
          customerRows,
          restockRows,
          procurementRows,
          expenseRows,
        ] = await Promise.all([
          supabaseData.fetchCollection<Product>(TABLES.products, businessId),
          supabaseData.fetchCollection<Order>(TABLES.orders, businessId),
          supabaseData.fetchCollection<Customer>(TABLES.customers, businessId),
          supabaseData.fetchCollection<RestockLog>(TABLES.restockLogs, businessId),
          supabaseData.fetchCollection<Procurement>(TABLES.procurements, businessId),
          supabaseData.fetchCollection<Expense>(TABLES.expenses, businessId),
        ]);

        const remoteProducts = productRows.map((row) => row.data);
        const localProducts = useFyllStore.getState().products;

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
            });
          } else {
            applyRemoteState({
              products: remoteProducts,
              orders: orderRows.map((row) => row.data),
              customers: customerRows.map((row) => row.data),
              restockLogs: restockRows.map((row) => row.data),
              procurements: procurementRows.map((row) => row.data),
              expenses: expenseRows.map((row) => row.data),
            });
          }
        }
      } catch (error) {
        console.warn('Supabase sync failed:', error);
      } finally {
        if (!cancelled) {
          setIsInitialized(true);
        }
      }
    };

    syncAll();

    intervalRef.current = setInterval(syncAll, 15000);

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [businessId, isAuthenticated, isOfflineMode]);

  useEffect(() => {
    if (!isInitialized || !businessId || isOfflineMode || applyingRemote.current) return;

    const nextIds = toIdSet(products);
    const removed = [...prevProductIds.current].filter((id) => !nextIds.has(id));
    prevProductIds.current = nextIds;

    supabaseData
      .upsertCollection(TABLES.products, businessId, products)
      .then(() => supabaseData.deleteByIds(TABLES.products, businessId, removed))
      .catch((error) => console.warn('Supabase product sync error:', error));
  }, [products, businessId, isInitialized, isOfflineMode]);

  useEffect(() => {
    if (!isInitialized || !businessId || isOfflineMode || applyingRemote.current) return;

    const nextIds = toIdSet(orders);
    const removed = [...prevOrderIds.current].filter((id) => !nextIds.has(id));
    prevOrderIds.current = nextIds;

    supabaseData
      .upsertCollection(TABLES.orders, businessId, orders)
      .then(() => supabaseData.deleteByIds(TABLES.orders, businessId, removed))
      .catch((error) => console.warn('Supabase order sync error:', error));
  }, [orders, businessId, isInitialized, isOfflineMode]);

  useEffect(() => {
    if (!isInitialized || !businessId || isOfflineMode || applyingRemote.current) return;

    const nextIds = toIdSet(customers);
    const removed = [...prevCustomerIds.current].filter((id) => !nextIds.has(id));
    prevCustomerIds.current = nextIds;

    supabaseData
      .upsertCollection(TABLES.customers, businessId, customers)
      .then(() => supabaseData.deleteByIds(TABLES.customers, businessId, removed))
      .catch((error) => console.warn('Supabase customer sync error:', error));
  }, [customers, businessId, isInitialized, isOfflineMode]);

  useEffect(() => {
    if (!isInitialized || !businessId || isOfflineMode || applyingRemote.current) return;

    const nextIds = toIdSet(restockLogs);
    const removed = [...prevRestockIds.current].filter((id) => !nextIds.has(id));
    prevRestockIds.current = nextIds;

    supabaseData
      .upsertCollection(TABLES.restockLogs, businessId, restockLogs)
      .then(() => supabaseData.deleteByIds(TABLES.restockLogs, businessId, removed))
      .catch((error) => console.warn('Supabase restock log sync error:', error));
  }, [restockLogs, businessId, isInitialized, isOfflineMode]);

  useEffect(() => {
    if (!isInitialized || !businessId || isOfflineMode || applyingRemote.current) return;

    const nextIds = toIdSet(procurements);
    const removed = [...prevProcurementIds.current].filter((id) => !nextIds.has(id));
    prevProcurementIds.current = nextIds;

    supabaseData
      .upsertCollection(TABLES.procurements, businessId, procurements)
      .then(() => supabaseData.deleteByIds(TABLES.procurements, businessId, removed))
      .catch((error) => console.warn('Supabase procurement sync error:', error));
  }, [procurements, businessId, isInitialized, isOfflineMode]);

  useEffect(() => {
    if (!isInitialized || !businessId || isOfflineMode || applyingRemote.current) return;

    const nextIds = toIdSet(expenses);
    const removed = [...prevExpenseIds.current].filter((id) => !nextIds.has(id));
    prevExpenseIds.current = nextIds;

    supabaseData
      .upsertCollection(TABLES.expenses, businessId, expenses)
      .then(() => supabaseData.deleteByIds(TABLES.expenses, businessId, removed))
      .catch((error) => console.warn('Supabase expense sync error:', error));
  }, [expenses, businessId, isInitialized, isOfflineMode]);

  return { isInitialized };
}
