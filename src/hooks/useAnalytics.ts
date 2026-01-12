import { useMemo } from 'react';
import useFyllStore from '@/lib/state/fyll-store';
import {
  TimeRange,
  AnalyticsResult,
  ChartDataPoint,
  getDateRange,
  getPreviousPeriodRange,
  filterOrdersByDateRange,
  groupByDay,
  groupByWeek,
  groupByMonth,
  getHourlyTrend,
  countNewCustomers,
  calculateTotalUnits,
  getLocationBreakdown,
  getPlatformBreakdown,
  getLogisticsBreakdown,
  getTodayStats,
  percentChange,
  countUniqueCustomers,
  // New imports for tab-specific data
  getTopAddOns,
  getRevenueBySource,
  getStatusBreakdown,
  groupOrdersByDay,
  groupOrdersByWeek,
  groupOrdersByMonth,
  getReturningVsNew,
  getTopCustomers,
  getCustomersByLocation,
  getCustomersByPlatform,
  TabKey,
  // New refund helpers
  getRefundStats,
} from '@/lib/analytics-utils';

/**
 * Hook to compute real analytics from orders data
 */
export function useAnalytics(range: TimeRange, _tab: TabKey): AnalyticsResult {
  const orders = useFyllStore((s) => s.orders);

  return useMemo(() => {
    // Get date ranges
    const { start: rangeStart, end: rangeEnd } = getDateRange(range);
    const { start: prevStart, end: prevEnd } = getPreviousPeriodRange(range);

    // Filter orders for current and previous periods
    const currentOrders = filterOrdersByDateRange(orders, rangeStart, rangeEnd, true);
    const previousOrders = filterOrdersByDateRange(orders, prevStart, prevEnd, true);

    // All orders in range (including refunded) for status breakdown
    const allOrdersInRange = filterOrdersByDateRange(orders, rangeStart, rangeEnd, false);

    // Get refund stats using new helper (includes partial refunds)
    const currentRefundStats = getRefundStats(allOrdersInRange);
    const previousRefundStats = getRefundStats(
      filterOrdersByDateRange(orders, prevStart, prevEnd, false)
    );

    // Core metrics
    const totalSales = currentOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalOrders = currentOrders.length;
    const totalUnits = calculateTotalUnits(currentOrders);
    const newCustomers = countNewCustomers(currentOrders, orders, rangeStart);
    const refundsCount = currentRefundStats.count;
    const refundsAmount = currentRefundStats.total;
    const netRevenue = Math.max(0, totalSales - refundsAmount);

    // Previous period metrics
    const previousPeriodSales = previousOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const previousPeriodOrders = previousOrders.length;
    const previousPeriodCustomers = countUniqueCustomers(previousOrders);

    // Sales change
    const salesChange = percentChange(totalSales, previousPeriodSales);

    // Chart data based on range
    let salesByPeriod: ChartDataPoint[];
    let ordersByPeriod: ChartDataPoint[];
    if (range === '7d') {
      salesByPeriod = groupByDay(currentOrders, rangeStart, rangeEnd);
      ordersByPeriod = groupOrdersByDay(allOrdersInRange, rangeStart, rangeEnd);
    } else if (range === '30d') {
      salesByPeriod = groupByWeek(currentOrders, rangeStart, rangeEnd);
      ordersByPeriod = groupOrdersByWeek(allOrdersInRange, rangeStart, rangeEnd);
    } else {
      salesByPeriod = groupByMonth(currentOrders);
      ordersByPeriod = groupOrdersByMonth(allOrdersInRange);
    }

    // Today's stats
    const todayStats = getTodayStats(orders);

    // Hourly trend for sparkline
    const hourlyTrend = getHourlyTrend(orders);

    // Breakdowns
    const locationBreakdown = getLocationBreakdown(currentOrders);
    const platformBreakdown = getPlatformBreakdown(currentOrders);
    const logisticsBreakdown = getLogisticsBreakdown(currentOrders);

    // Current period unique customers
    const currentCustomers = countUniqueCustomers(currentOrders);

    // KPI metrics with comparison
    const kpiMetrics = {
      sales: {
        value: totalSales,
        change: salesChange,
      },
      customers: {
        value: currentCustomers,
        change: percentChange(currentCustomers, previousPeriodCustomers),
      },
      orders: {
        value: totalOrders,
        change: percentChange(totalOrders, previousPeriodOrders),
      },
      refunds: {
        value: refundsCount,
        change: percentChange(refundsCount, previousRefundStats.count),
      },
    };

    // ====== SALES TAB SPECIFIC ======
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
    const topAddOns = getTopAddOns(currentOrders);
    const revenueBySource = getRevenueBySource(currentOrders);

    // ====== ORDERS TAB SPECIFIC ======
    const statusBreakdown = getStatusBreakdown(allOrdersInRange);
    const cancellationsCount = refundsCount;
    const processingOrders = allOrdersInRange.filter(
      (o) => o.status === 'Processing' || o.status === 'Lab Processing' || o.status === 'Quality Check'
    ).length;
    const deliveredOrders = allOrdersInRange.filter((o) => o.status === 'Delivered').length;

    // ====== CUSTOMERS TAB SPECIFIC ======
    const returningVsNew = getReturningVsNew(currentOrders, orders, rangeStart);
    const returningCustomers = returningVsNew.returning;
    const topCustomers = getTopCustomers(currentOrders);
    const customersByLocation = getCustomersByLocation(currentOrders);
    const customersByPlatform = getCustomersByPlatform(currentOrders);

    return {
      // Core metrics
      totalSales,
      totalOrders,
      totalUnits,
      newCustomers,
      refundsCount,
      refundsAmount,
      netRevenue,

      // Today's stats
      todaySales: todayStats.sales,
      todayOrders: todayStats.orders,
      todayUnits: todayStats.units,
      todayCustomers: todayStats.customers,
      todayRefunds: todayStats.refunds,
      todayRefundsAmount: todayStats.refundsAmount,
      hourlyTrend,

      // Chart data
      salesByPeriod,

      // Comparison
      previousPeriodSales,
      salesChange,

      // Breakdowns
      locationBreakdown,
      platformBreakdown,
      logisticsBreakdown,

      // KPI metrics
      kpiMetrics,

      // Sales tab specific
      averageOrderValue,
      topAddOns,
      revenueBySource,

      // Orders tab specific
      statusBreakdown,
      cancellationsCount,
      processingOrders,
      deliveredOrders,
      ordersByPeriod,

      // Customers tab specific
      returningCustomers,
      returningVsNew,
      topCustomers,
      customersByLocation,
      customersByPlatform,
    };
  }, [orders, range]);
}
