// Analytics utility functions for computing real stats from orders

import type { Order } from './state/fyll-store';

export type TimeRange = '7d' | '30d' | 'year';
export type TabKey = 'sales' | 'orders' | 'customers' | 'inventory';

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface TopAddOn {
  name: string;
  revenue: number;
  count: number;
}

export interface StatusBreakdown {
  status: string;
  count: number;
  percentage: number;
  color: string;
}

export interface TopCustomer {
  name: string;
  email: string;
  totalSpent: number;
  orderCount: number;
}

export interface AnalyticsResult {
  // Core metrics
  totalSales: number;
  totalOrders: number;
  totalUnits: number;
  newCustomers: number;
  refundsCount: number;
  refundsAmount: number;
  netRevenue: number;

  // Today's stats
  todaySales: number;
  todayOrders: number;
  todayUnits: number;
  todayCustomers: number;
  todayRefunds: number;
  todayRefundsAmount: number;
  hourlyTrend: number[];

  // Chart data
  salesByPeriod: ChartDataPoint[];

  // Comparison
  previousPeriodSales: number;
  salesChange: number;

  // Breakdown data
  locationBreakdown: { label: string; value: number; percentage: number }[];
  platformBreakdown: { label: string; value: number; percentage: number }[];
  logisticsBreakdown: { label: string; ordersShipped: number; onTimeRate: number }[];

  // KPI metrics with change
  kpiMetrics: {
    sales: { value: number; change: number };
    customers: { value: number; change: number };
    orders: { value: number; change: number };
    refunds: { value: number; change: number };
  };

  // ====== SALES TAB SPECIFIC ======
  averageOrderValue: number;
  topAddOns: TopAddOn[];
  revenueBySource: { label: string; value: number; percentage: number }[];

  // ====== ORDERS TAB SPECIFIC ======
  statusBreakdown: StatusBreakdown[];
  cancellationsCount: number;
  processingOrders: number;
  deliveredOrders: number;
  ordersByPeriod: ChartDataPoint[];

  // ====== CUSTOMERS TAB SPECIFIC ======
  returningCustomers: number;
  returningVsNew: { returning: number; new: number; returningPercentage: number };
  topCustomers: TopCustomer[];
  customersByLocation: { label: string; value: number; percentage: number }[];
  customersByPlatform: { label: string; value: number; percentage: number }[];
}

/**
 * Get the total refunded amount for an order.
 * Handles multiple refund storage patterns safely:
 * - order.refund?.amount (single refund object)
 * - order.refundedAmount (direct field)
 * - order.partialRefunds[] (array of partial refunds)
 * - order.refunds[] (array of refund objects)
 * Returns 0 if no refund data exists or fields are missing.
 */
export function getRefundedAmount(order: Order): number {
  let total = 0;

  // Check for single refund object (primary pattern in this codebase)
  if (order.refund?.amount != null && order.refund.amount > 0) {
    total += order.refund.amount;
  }

  // Check for direct refundedAmount field (alternative pattern)
  const orderAny = order as unknown as Record<string, unknown>;
  if (typeof orderAny.refundedAmount === 'number' && orderAny.refundedAmount > 0) {
    total += orderAny.refundedAmount;
  }

  // Check for partialRefunds array
  if (Array.isArray(orderAny.partialRefunds)) {
    for (const pr of orderAny.partialRefunds) {
      if (typeof pr === 'object' && pr !== null && typeof (pr as Record<string, unknown>).amount === 'number') {
        total += (pr as Record<string, unknown>).amount as number;
      } else if (typeof pr === 'number') {
        total += pr;
      }
    }
  }

  // Check for refunds array (multiple refund transactions)
  if (Array.isArray(orderAny.refunds)) {
    for (const r of orderAny.refunds) {
      if (typeof r === 'object' && r !== null && typeof (r as Record<string, unknown>).amount === 'number') {
        total += (r as Record<string, unknown>).amount as number;
      } else if (typeof r === 'number') {
        total += r;
      }
    }
  }

  return total;
}

/**
 * Check if an order has any refund (partial or full)
 */
export function hasRefund(order: Order): boolean {
  return getRefundedAmount(order) > 0;
}

/**
 * Count orders with any refund and sum total refunded amount
 */
export function getRefundStats(orders: Order[]): { count: number; total: number } {
  let count = 0;
  let total = 0;

  for (const order of orders) {
    const refundAmount = getRefundedAmount(order);
    if (refundAmount > 0) {
      count++;
      total += refundAmount;
    }
  }

  return { count, total };
}

/**
 * Format currency with Nigerian Naira symbol and commas
 */
export function formatAnalyticsCurrency(amount: number): string {
  return `₦${amount.toLocaleString()}`;
}

/**
 * Format large numbers compactly (e.g., 1.2M, 45k)
 */
export function formatCompactNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(0)}k`;
  }
  return num.toString();
}

/**
 * Calculate percentage change between two values
 */
export function percentChange(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
}

/**
 * Get the start and end dates for a given time range
 */
export function getDateRange(range: TimeRange): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  switch (range) {
    case '7d':
      start.setDate(start.getDate() - 6);
      break;
    case '30d':
      start.setDate(start.getDate() - 29);
      break;
    case 'year':
      start.setMonth(0, 1); // January 1st of current year
      break;
  }

  return { start, end };
}

/**
 * Get the previous period date range (for comparison)
 */
export function getPreviousPeriodRange(range: TimeRange): { start: Date; end: Date } {
  const { start: currentStart, end: currentEnd } = getDateRange(range);
  const duration = currentEnd.getTime() - currentStart.getTime();

  const previousEnd = new Date(currentStart.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - duration);

  return { start: previousStart, end: previousEnd };
}

/**
 * Filter orders by date range and paid status
 */
export function filterOrdersByDateRange(
  orders: Order[],
  start: Date,
  end: Date,
  excludeRefunded: boolean = true
): Order[] {
  return orders.filter((order) => {
    const orderDate = new Date(order.createdAt);
    const inRange = orderDate >= start && orderDate <= end;
    const notRefunded = excludeRefunded ? order.status !== 'Refunded' : true;
    return inRange && notRefunded;
  });
}

/**
 * Group orders by day and sum sales
 */
export function groupByDay(orders: Order[], start: Date, end: Date): ChartDataPoint[] {
  const dayMap = new Map<string, number>();
  const dayLabels: string[] = [];

  // Initialize all days in range
  const current = new Date(start);
  while (current <= end) {
    const dateKey = current.toISOString().split('T')[0];
    const label = current.toLocaleDateString('en-US', { weekday: 'short' });
    dayMap.set(dateKey, 0);
    dayLabels.push(label);
    current.setDate(current.getDate() + 1);
  }

  // Sum orders by day
  orders.forEach((order) => {
    const dateKey = new Date(order.createdAt).toISOString().split('T')[0];
    if (dayMap.has(dateKey)) {
      dayMap.set(dateKey, (dayMap.get(dateKey) || 0) + order.totalAmount);
    }
  });

  // Convert to array
  const result: ChartDataPoint[] = [];
  let i = 0;
  dayMap.forEach((value) => {
    result.push({ label: dayLabels[i] || '', value });
    i++;
  });

  return result;
}

/**
 * Group orders by week and sum sales
 */
export function groupByWeek(orders: Order[], start: Date, end: Date): ChartDataPoint[] {
  const weekMap = new Map<number, number>();

  // Calculate number of weeks
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const numWeeks = Math.ceil(totalDays / 7);

  // Initialize weeks
  for (let i = 1; i <= numWeeks; i++) {
    weekMap.set(i, 0);
  }

  // Sum orders by week
  orders.forEach((order) => {
    const orderDate = new Date(order.createdAt);
    const daysSinceStart = Math.floor(
      (orderDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    const weekNum = Math.min(Math.floor(daysSinceStart / 7) + 1, numWeeks);
    weekMap.set(weekNum, (weekMap.get(weekNum) || 0) + order.totalAmount);
  });

  return Array.from(weekMap.entries()).map(([week, value]) => ({
    label: `W${week}`,
    value,
  }));
}

/**
 * Group orders by month and sum sales
 */
export function groupByMonth(orders: Order[]): ChartDataPoint[] {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthSales = new Array(12).fill(0);

  orders.forEach((order) => {
    const orderDate = new Date(order.createdAt);
    const month = orderDate.getMonth();
    monthSales[month] += order.totalAmount;
  });

  return months.map((label, index) => ({
    label,
    value: monthSales[index],
  }));
}

/**
 * Get hourly breakdown of today's sales (for sparkline)
 */
export function getHourlyTrend(orders: Order[]): number[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const hourlyData = new Array(12).fill(0); // 12 data points (every 2 hours)

  const todayOrders = orders.filter((order) => {
    const orderDate = new Date(order.createdAt);
    return orderDate >= today && order.status !== 'Refunded';
  });

  todayOrders.forEach((order) => {
    const orderDate = new Date(order.createdAt);
    const hour = orderDate.getHours();
    const bucket = Math.min(Math.floor(hour / 2), 11);
    hourlyData[bucket] += order.totalAmount;
  });

  return hourlyData;
}

/**
 * Count unique customers (by name or email) in orders
 */
export function countUniqueCustomers(orders: Order[]): number {
  const customers = new Set<string>();
  orders.forEach((order) => {
    const key = order.customerEmail || order.customerName.toLowerCase();
    customers.add(key);
  });
  return customers.size;
}

/**
 * Count new customers (first order in range)
 */
export function countNewCustomers(
  ordersInRange: Order[],
  allOrders: Order[],
  rangeStart: Date
): number {
  const customerFirstOrders = new Map<string, Date>();

  // Build map of first order date for each customer
  allOrders.forEach((order) => {
    const key = order.customerEmail || order.customerName.toLowerCase();
    const orderDate = new Date(order.createdAt);
    const existing = customerFirstOrders.get(key);
    if (!existing || orderDate < existing) {
      customerFirstOrders.set(key, orderDate);
    }
  });

  // Count customers whose first order is in range
  let newCount = 0;
  customerFirstOrders.forEach((firstOrderDate) => {
    if (firstOrderDate >= rangeStart) {
      newCount++;
    }
  });

  return newCount;
}

/**
 * Calculate total units sold from order items
 */
export function calculateTotalUnits(orders: Order[]): number {
  return orders.reduce((total, order) => {
    return total + order.items.reduce((itemTotal, item) => itemTotal + item.quantity, 0);
  }, 0);
}

/**
 * Get location breakdown from orders
 */
export function getLocationBreakdown(
  orders: Order[]
): { label: string; value: number; percentage: number }[] {
  const locationMap = new Map<string, number>();

  orders.forEach((order) => {
    const location = order.deliveryState || 'Unknown';
    locationMap.set(location, (locationMap.get(location) || 0) + 1);
  });

  const total = orders.length || 1;
  const sorted = Array.from(locationMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Group remaining as "Others"
  const topTotal = sorted.reduce((sum, [, count]) => sum + count, 0);
  const othersCount = orders.length - topTotal;

  const result = sorted.map(([label, value]) => ({
    label,
    value,
    percentage: Math.round((value / total) * 100),
  }));

  if (othersCount > 0) {
    result.push({
      label: 'Others',
      value: othersCount,
      percentage: Math.round((othersCount / total) * 100),
    });
  }

  return result;
}

/**
 * Get platform/source breakdown from orders
 */
export function getPlatformBreakdown(
  orders: Order[]
): { label: string; value: number; percentage: number }[] {
  const platformMap = new Map<string, number>();

  orders.forEach((order) => {
    const platform = order.source || 'Unknown';
    platformMap.set(platform, (platformMap.get(platform) || 0) + 1);
  });

  const total = orders.length || 1;

  return Array.from(platformMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({
      label,
      value,
      percentage: Math.round((value / total) * 100),
    }));
}

/**
 * Get logistics breakdown from orders
 */
export function getLogisticsBreakdown(
  orders: Order[]
): { label: string; ordersShipped: number; onTimeRate: number }[] {
  const logisticsMap = new Map<string, { shipped: number; delivered: number }>();

  orders.forEach((order) => {
    if (order.logistics?.carrierName) {
      const carrier = order.logistics.carrierName;
      const existing = logisticsMap.get(carrier) || { shipped: 0, delivered: 0 };
      existing.shipped++;
      if (order.status === 'Delivered') {
        existing.delivered++;
      }
      logisticsMap.set(carrier, existing);
    }
  });

  return Array.from(logisticsMap.entries())
    .sort((a, b) => b[1].shipped - a[1].shipped)
    .map(([label, data]) => ({
      label,
      ordersShipped: data.shipped,
      onTimeRate: data.shipped > 0 ? Math.round((data.delivered / data.shipped) * 100) : 0,
    }));
}

/**
 * Get today's statistics
 */
export function getTodayStats(orders: Order[]): {
  sales: number;
  orders: number;
  units: number;
  customers: number;
  refunds: number;
  refundsAmount: number;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayOrders = orders.filter((order) => {
    const orderDate = new Date(order.createdAt);
    return orderDate >= today;
  });

  const paidOrders = todayOrders.filter((o) => o.status !== 'Refunded');

  // Use getRefundStats to properly count refunds (including partial)
  const refundStats = getRefundStats(todayOrders);

  return {
    sales: paidOrders.reduce((sum, o) => sum + o.totalAmount, 0),
    orders: paidOrders.length,
    units: calculateTotalUnits(paidOrders),
    customers: countUniqueCustomers(paidOrders),
    refunds: refundStats.count,
    refundsAmount: refundStats.total,
  };
}

// ====== SALES TAB HELPERS ======

/**
 * Get top add-ons/services by revenue
 */
export function getTopAddOns(orders: Order[]): TopAddOn[] {
  const addOnMap = new Map<string, { revenue: number; count: number }>();

  orders.forEach((order) => {
    order.services?.forEach((service) => {
      const existing = addOnMap.get(service.name) || { revenue: 0, count: 0 };
      existing.revenue += service.price;
      existing.count += 1;
      addOnMap.set(service.name, existing);
    });
  });

  return Array.from(addOnMap.entries())
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5)
    .map(([name, data]) => ({
      name,
      revenue: data.revenue,
      count: data.count,
    }));
}

/**
 * Get revenue breakdown by source/platform
 */
export function getRevenueBySource(
  orders: Order[]
): { label: string; value: number; percentage: number }[] {
  const revenueMap = new Map<string, number>();

  orders.forEach((order) => {
    const source = order.source || 'Unknown';
    revenueMap.set(source, (revenueMap.get(source) || 0) + order.totalAmount);
  });

  const total = orders.reduce((sum, o) => sum + o.totalAmount, 0) || 1;

  return Array.from(revenueMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({
      label,
      value,
      percentage: Math.round((value / total) * 100),
    }));
}

// ====== ORDERS TAB HELPERS ======

const STATUS_COLORS: Record<string, string> = {
  'Processing': '#3B82F6',
  'Lab Processing': '#8B5CF6',
  'Quality Check': '#6366F1',
  'Ready for Pickup': '#10B981',
  'Delivered': '#059669',
  'Refunded': '#EF4444',
  'Pending': '#F59E0B',
};

/**
 * Get order status breakdown
 */
export function getStatusBreakdown(orders: Order[]): StatusBreakdown[] {
  const statusMap = new Map<string, number>();

  orders.forEach((order) => {
    const status = order.status || 'Pending';
    statusMap.set(status, (statusMap.get(status) || 0) + 1);
  });

  const total = orders.length || 1;

  return Array.from(statusMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([status, count]) => ({
      status,
      count,
      percentage: Math.round((count / total) * 100),
      color: STATUS_COLORS[status] || '#888888',
    }));
}

/**
 * Group orders by period (count, not revenue)
 */
export function groupOrdersByDay(orders: Order[], start: Date, end: Date): ChartDataPoint[] {
  const dayMap = new Map<string, number>();
  const dayLabels: string[] = [];

  const current = new Date(start);
  while (current <= end) {
    const dateKey = current.toISOString().split('T')[0];
    const label = current.toLocaleDateString('en-US', { weekday: 'short' });
    dayMap.set(dateKey, 0);
    dayLabels.push(label);
    current.setDate(current.getDate() + 1);
  }

  orders.forEach((order) => {
    const dateKey = new Date(order.createdAt).toISOString().split('T')[0];
    if (dayMap.has(dateKey)) {
      dayMap.set(dateKey, (dayMap.get(dateKey) || 0) + 1);
    }
  });

  const result: ChartDataPoint[] = [];
  let i = 0;
  dayMap.forEach((value) => {
    result.push({ label: dayLabels[i] || '', value });
    i++;
  });

  return result;
}

export function groupOrdersByWeek(orders: Order[], start: Date, end: Date): ChartDataPoint[] {
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const numWeeks = Math.ceil(totalDays / 7);
  const weekMap = new Map<number, number>();

  for (let i = 1; i <= numWeeks; i++) {
    weekMap.set(i, 0);
  }

  orders.forEach((order) => {
    const orderDate = new Date(order.createdAt);
    const daysSinceStart = Math.floor(
      (orderDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    const weekNum = Math.min(Math.floor(daysSinceStart / 7) + 1, numWeeks);
    weekMap.set(weekNum, (weekMap.get(weekNum) || 0) + 1);
  });

  return Array.from(weekMap.entries()).map(([week, value]) => ({
    label: `W${week}`,
    value,
  }));
}

export function groupOrdersByMonth(orders: Order[]): ChartDataPoint[] {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthCounts = new Array(12).fill(0);

  orders.forEach((order) => {
    const orderDate = new Date(order.createdAt);
    const month = orderDate.getMonth();
    monthCounts[month] += 1;
  });

  return months.map((label, index) => ({
    label,
    value: monthCounts[index],
  }));
}

// ====== CUSTOMERS TAB HELPERS ======

/**
 * Get returning vs new customers breakdown
 */
export function getReturningVsNew(
  ordersInRange: Order[],
  allOrders: Order[],
  rangeStart: Date
): { returning: number; new: number; returningPercentage: number } {
  const customerFirstOrders = new Map<string, Date>();
  const customersInRange = new Set<string>();

  // Build map of first order date for each customer
  allOrders.forEach((order) => {
    const key = order.customerEmail || order.customerName.toLowerCase();
    const orderDate = new Date(order.createdAt);
    const existing = customerFirstOrders.get(key);
    if (!existing || orderDate < existing) {
      customerFirstOrders.set(key, orderDate);
    }
  });

  // Get unique customers in range
  ordersInRange.forEach((order) => {
    const key = order.customerEmail || order.customerName.toLowerCase();
    customersInRange.add(key);
  });

  let newCount = 0;
  let returningCount = 0;

  customersInRange.forEach((key) => {
    const firstOrder = customerFirstOrders.get(key);
    if (firstOrder && firstOrder >= rangeStart) {
      newCount++;
    } else {
      returningCount++;
    }
  });

  const total = newCount + returningCount || 1;

  return {
    returning: returningCount,
    new: newCount,
    returningPercentage: Math.round((returningCount / total) * 100),
  };
}

/**
 * Get top customers by total spend
 */
export function getTopCustomers(orders: Order[]): TopCustomer[] {
  const customerMap = new Map<string, { name: string; email: string; totalSpent: number; orderCount: number }>();

  orders.forEach((order) => {
    const key = order.customerEmail || order.customerName.toLowerCase();
    const existing = customerMap.get(key) || {
      name: order.customerName,
      email: order.customerEmail,
      totalSpent: 0,
      orderCount: 0,
    };
    existing.totalSpent += order.totalAmount;
    existing.orderCount += 1;
    // Update name/email if we have better data
    if (order.customerEmail && !existing.email) {
      existing.email = order.customerEmail;
    }
    if (order.customerName && existing.name.toLowerCase() === key) {
      existing.name = order.customerName;
    }
    customerMap.set(key, existing);
  });

  return Array.from(customerMap.values())
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 5);
}

/**
 * Get unique customers by location
 */
export function getCustomersByLocation(
  orders: Order[]
): { label: string; value: number; percentage: number }[] {
  const customerLocations = new Map<string, Set<string>>();

  orders.forEach((order) => {
    const location = order.deliveryState || 'Unknown';
    const customerKey = order.customerEmail || order.customerName.toLowerCase();

    if (!customerLocations.has(location)) {
      customerLocations.set(location, new Set());
    }
    customerLocations.get(location)!.add(customerKey);
  });

  const totalCustomers = countUniqueCustomers(orders) || 1;

  return Array.from(customerLocations.entries())
    .map(([label, customers]) => ({
      label,
      value: customers.size,
      percentage: Math.round((customers.size / totalCustomers) * 100),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}

/**
 * Get unique customers by platform
 */
export function getCustomersByPlatform(
  orders: Order[]
): { label: string; value: number; percentage: number }[] {
  const customerPlatforms = new Map<string, Set<string>>();

  orders.forEach((order) => {
    const platform = order.source || 'Unknown';
    const customerKey = order.customerEmail || order.customerName.toLowerCase();

    if (!customerPlatforms.has(platform)) {
      customerPlatforms.set(platform, new Set());
    }
    customerPlatforms.get(platform)!.add(customerKey);
  });

  const totalCustomers = countUniqueCustomers(orders) || 1;

  return Array.from(customerPlatforms.entries())
    .map(([label, customers]) => ({
      label,
      value: customers.size,
      percentage: Math.round((customers.size / totalCustomers) * 100),
    }))
    .sort((a, b) => b.value - a.value);
}
