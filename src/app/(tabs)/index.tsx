import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import {
  TrendingDown,
  Package,
  ShoppingCart,
  AlertTriangle,
  BarChart3,
  Scan,
  Plus,
  ArrowUpRight,
  ChevronRight,
  ClipboardList,
} from 'lucide-react-native';
import useFyllStore, { formatCurrency, Order } from '@/lib/state/fyll-store';
import { useThemeColors } from '@/lib/theme';
import * as Haptics from 'expo-haptics';
import { getPlatformBreakdown } from '@/lib/analytics-utils';
import useAuthStore from '@/lib/state/auth-store';

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: number;
  icon: React.ReactNode;
  onPress?: () => void;
}

function MetricCard({ title, value, subtitle, trend, icon, onPress }: MetricCardProps) {
  const colors = useThemeColors();
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Pressable
        onPress={onPress}
        className="rounded-2xl p-4 active:opacity-80"
        style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}
        disabled={!onPress}
      >
        <View className="flex-row items-center justify-between mb-3">
          <View
            className="w-10 h-10 rounded-xl items-center justify-center"
            style={{ backgroundColor: colors.bg.secondary }}
          >
            {icon}
          </View>
          {trend !== undefined && (
            <View className="flex-row items-center px-2 py-1 rounded-full" style={{ backgroundColor: trend >= 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)' }}>
              {trend >= 0 ? (
                <ArrowUpRight size={12} color="#22C55E" strokeWidth={2.5} />
              ) : (
                <TrendingDown size={12} color="#EF4444" strokeWidth={2.5} />
              )}
              <Text style={{ color: trend >= 0 ? '#22C55E' : '#EF4444' }} className="text-xs font-semibold ml-0.5">
                {Math.abs(trend)}%
              </Text>
            </View>
          )}
          {onPress && !trend && (
            <ChevronRight size={16} color={colors.text.tertiary} strokeWidth={2} />
          )}
        </View>
        <Text style={{ color: colors.text.tertiary }} className="text-xs font-medium tracking-wide uppercase mb-1">{title}</Text>
        <Text style={{ color: colors.text.primary }} className="text-2xl font-bold tracking-tight">{value}</Text>
        {subtitle && <Text style={{ color: colors.text.muted }} className="text-xs mt-1">{subtitle}</Text>}
      </Pressable>
    </View>
  );
}

interface LowStockItemProps {
  name: string;
  variant: string;
  stock: number;
  threshold: number;
  isLast?: boolean;
}

function LowStockItem({ name, variant, stock, threshold, isLast = false }: LowStockItemProps) {
  const colors = useThemeColors();
  const urgency = stock === 0 ? 'Out' : stock <= threshold / 2 ? 'Critical' : 'Low';
  const urgencyColor = stock === 0 ? '#EF4444' : '#F59E0B';

  return (
    <View
      className="flex-row items-center py-3"
      style={isLast ? undefined : { borderBottomWidth: 1, borderBottomColor: colors.border.light }}
    >
      <View className="w-8 h-8 rounded-lg items-center justify-center mr-3" style={{ backgroundColor: `${urgencyColor}15` }}>
        <Package size={16} color={urgencyColor} strokeWidth={2} />
      </View>
      <View className="flex-1">
        <Text style={{ color: colors.text.primary }} className="font-semibold text-sm">{name}</Text>
        <Text style={{ color: colors.text.tertiary }} className="text-xs">{variant}</Text>
      </View>
      <View className="items-end">
        <View className="px-2 py-0.5 rounded-md" style={{ backgroundColor: `${urgencyColor}15` }}>
          <Text style={{ color: urgencyColor }} className="text-xs font-bold">{urgency}</Text>
        </View>
        <Text style={{ color: colors.text.muted }} className="text-xs mt-1">{stock} left</Text>
      </View>
    </View>
  );
}

// Audit Banner Component
interface AuditBannerProps {
  onPress: () => void;
}

function AuditBanner({ onPress }: AuditBannerProps) {
  return (
    <View className="px-5 pt-4">
      <Pressable
        onPress={onPress}
        className="rounded-2xl p-4 active:opacity-90"
        style={{ backgroundColor: '#F3E8FF', borderWidth: 1, borderColor: '#E9D5FF' }}
      >
        <View className="flex-row items-center">
          <View
            className="w-12 h-12 rounded-xl items-center justify-center mr-4"
            style={{ backgroundColor: '#FAF5FF' }}
          >
            <ClipboardList size={24} color="#8B5CF6" strokeWidth={2} />
          </View>
          <View className="flex-1">
            <Text style={{ color: '#6B21A8' }} className="font-bold text-base">Monthly Audit Due</Text>
            <Text style={{ color: '#7C3AED' }} className="text-sm mt-0.5">
              Complete your inventory audit before month-end
            </Text>
          </View>
          <ChevronRight size={20} color="#8B5CF6" strokeWidth={2} />
        </View>
      </Pressable>
    </View>
  );
}

// Recent Order Item Component
interface RecentOrderItemProps {
  order: Order;
  products: Array<{ id: string; name: string; variants: Array<{ id: string; sku: string }> }>;
  onPress: () => void;
  isLast?: boolean;
}

function RecentOrderItem({ order, products, onPress, isLast = false }: RecentOrderItemProps) {
  const colors = useThemeColors();

  // Get first item info
  const firstItem = order.items[0];
  const product = products.find((p) => p.id === firstItem?.productId);
  const variant = product?.variants.find((v) => v.id === firstItem?.variantId);
  const itemName = product?.name ?? 'Unknown Product';
  const itemSku = variant?.sku ?? 'N/A';

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Processing': return '#3B82F6';
      case 'Lab Processing': return '#8B5CF6';
      case 'Quality Check': return '#111111';
      case 'Ready for Pickup': return '#10B981';
      case 'Delivered': return '#059669';
      case 'Refunded': return '#EF4444';
      default: return '#F59E0B';
    }
  };

  const statusColor = getStatusColor(order.status);

  return (
    <View>
      <Pressable
        onPress={onPress}
        className="flex-row items-center py-3 active:opacity-70"
        style={isLast ? undefined : { borderBottomWidth: 1, borderBottomColor: colors.border.light }}
      >
        <View className="flex-1">
          <Text style={{ color: colors.text.primary }} className="font-semibold text-sm" numberOfLines={1}>
            {order.customerName}
          </Text>
          <Text style={{ color: colors.text.tertiary }} className="text-xs mt-0.5">
            {itemName} • {itemSku}
          </Text>
        </View>
        <View className="items-end">
          <View className="px-2 py-1 rounded-md" style={{ backgroundColor: `${statusColor}15` }}>
            <Text style={{ color: statusColor }} className="text-xs font-semibold">{order.status}</Text>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const tabBarHeight = useBottomTabBarHeight();
  const products = useFyllStore((s) => s.products);
  const orders = useFyllStore((s) => s.orders);
  const hasAuditForMonth = useFyllStore((s) => s.hasAuditForMonth);

  // Global low stock threshold settings
  const useGlobalLowStockThreshold = useFyllStore((s) => s.useGlobalLowStockThreshold);
  const globalLowStockThreshold = useFyllStore((s) => s.globalLowStockThreshold);

  const userName = useAuthStore((s) => s.currentUser?.name ?? '');

  // Check if audit banner should show (25th-31st of month, and no audit logged this month)
  const showAuditBanner = useMemo(() => {
    const today = new Date();
    const dayOfMonth = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Only show between 25th and 31st
    if (dayOfMonth < 25) return false;

    // Check if audit already done this month
    return !hasAuditForMonth(currentMonth, currentYear);
  }, [hasAuditForMonth]);

  // Recent orders (last 5, sorted by date)
  const recentOrders = useMemo(() => {
    return [...orders]
      .sort((a, b) => new Date(b.orderDate ?? b.createdAt).getTime() - new Date(a.orderDate ?? a.createdAt).getTime())
      .slice(0, 5);
  }, [orders]);

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    // Calculate current month revenue (excluding refunded)
    const totalRevenue = orders
      .filter((o) => {
        const orderDate = new Date(o.orderDate ?? o.createdAt);
        return o.status !== 'Refunded' &&
               orderDate.getMonth() === currentMonth &&
               orderDate.getFullYear() === currentYear;
      })
      .reduce((sum, order) => sum + order.totalAmount, 0);

    // Calculate last month revenue for comparison
    const lastMonthRevenue = orders
      .filter((o) => {
        const orderDate = new Date(o.orderDate ?? o.createdAt);
        return o.status !== 'Refunded' &&
               orderDate.getMonth() === lastMonth &&
               orderDate.getFullYear() === lastMonthYear;
      })
      .reduce((sum, order) => sum + order.totalAmount, 0);

    // Calculate percentage change
    const revenueChange = lastMonthRevenue > 0
      ? Math.round(((totalRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
      : 0;

    // Calculate product sales (subtotal only) - current month
    const productSales = orders
      .filter((o) => {
        const orderDate = new Date(o.orderDate ?? o.createdAt);
        return o.status !== 'Refunded' &&
               orderDate.getMonth() === currentMonth &&
               orderDate.getFullYear() === currentYear;
      })
      .reduce((sum, order) => sum + (order.subtotal || order.totalAmount), 0);

    // Calculate delivery fees - current month
    const deliveryFees = orders
      .filter((o) => {
        const orderDate = new Date(o.orderDate ?? o.createdAt);
        return o.status !== 'Refunded' &&
               orderDate.getMonth() === currentMonth &&
               orderDate.getFullYear() === currentYear;
      })
      .reduce((sum, order) => sum + (order.deliveryFee || 0), 0);

    // Calculate services revenue - current month
    const servicesRevenue = orders
      .filter((o) => {
        const orderDate = new Date(o.orderDate ?? o.createdAt);
        return o.status !== 'Refunded' &&
               orderDate.getMonth() === currentMonth &&
               orderDate.getFullYear() === currentYear;
      })
      .reduce((sum, order) => {
        return sum + (order.services?.reduce((sSum, s) => sSum + s.price, 0) || 0);
      }, 0);

    const totalStock = products.reduce((sum, product) =>
      sum + product.variants.reduce((vSum, variant) => vSum + variant.stock, 0), 0
    );

    const lowStockItems: { name: string; variant: string; stock: number; threshold: number }[] = [];
    products.forEach((product) => {
      // Use global threshold if enabled, otherwise use per-product threshold
      const threshold = useGlobalLowStockThreshold ? globalLowStockThreshold : product.lowStockThreshold;
      product.variants.forEach((variant) => {
        if (variant.stock <= threshold) {
          const variantName = Object.values(variant.variableValues).join(' / ');
          lowStockItems.push({
            name: product.name,
            variant: variantName,
            stock: variant.stock,
            threshold: threshold,
          });
        }
      });
    });
    lowStockItems.sort((a, b) => a.stock - b.stock);

    const pendingOrders = orders.filter((o) => o.status !== 'Delivered' && o.status !== 'Refunded').length;

    return {
      productSales,
      deliveryFees,
      servicesRevenue,
      totalRevenue,
      revenueChange,
      totalStock,
      lowStockItems,
      pendingOrders,
      totalOrders: orders.length,
    };
  }, [products, orders, useGlobalLowStockThreshold, globalLowStockThreshold]);

  const handleQuickAction = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(route as any);
  };

  const handleCardPress = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(route as any);
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
        >
          {/* Header */}
          <View className="px-5 pt-6 pb-2">
            <View className="flex-row items-center justify-between">
              <View>
                <Text style={{ color: colors.text.tertiary }} className="text-sm font-medium">Welcome back</Text>
                {userName ? (
                  <Text style={{ color: colors.text.primary }} className="text-3xl font-bold tracking-tight">{userName}</Text>
                ) : null}
              </View>
            </View>
          </View>

          {/* Audit Banner - Shows between 25th-31st if no audit logged */}
          {showAuditBanner && (
            <AuditBanner onPress={() => handleQuickAction('/inventory-audit')} />
          )}

          {/* Hero Revenue Card */}
          <View className="px-5 pt-4">
            <View
              className="rounded-3xl overflow-hidden p-6"
              style={{ backgroundColor: '#111111' }}
            >
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-gray-400 text-sm font-medium">Total Revenue</Text>
                {stats.revenueChange !== 0 && (
                  <View className={`flex-row items-center px-2 py-1 rounded-full ${stats.revenueChange >= 0 ? 'bg-white/10' : 'bg-red-500/20'}`}>
                    {stats.revenueChange >= 0 ? (
                      <ArrowUpRight size={12} color="#FFFFFF" strokeWidth={2.5} />
                    ) : (
                      <TrendingDown size={12} color="#FCA5A5" strokeWidth={2.5} />
                    )}
                    <Text className={`text-xs font-bold ml-0.5 ${stats.revenueChange >= 0 ? 'text-white' : 'text-red-300'}`}>
                      {Math.abs(stats.revenueChange)}%
                    </Text>
                  </View>
                )}
              </View>
              <Text className="text-white text-4xl font-bold tracking-tight mb-1">
                {formatCurrency(stats.totalRevenue)}
              </Text>
              <Text className="text-gray-500 text-sm">This month</Text>

              <View className="flex-row mt-4 pt-4 border-t border-gray-700">
                <View className="flex-1">
                  <Text className="text-gray-500 text-xs">Products</Text>
                  <Text className="text-white font-semibold">{formatCurrency(stats.productSales)}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-gray-500 text-xs">Delivery</Text>
                  <Text className="text-white font-semibold">{formatCurrency(stats.deliveryFees)}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-gray-500 text-xs">Services</Text>
                  <Text className="text-white font-semibold">{formatCurrency(stats.servicesRevenue)}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Stats Grid - Clickable */}
          <View className="px-5 pt-4">
            <View className="flex-row flex-wrap gap-3">
              <MetricCard
                title="Active Orders"
                value={String(stats.pendingOrders)}
                subtitle={`${stats.totalOrders} total`}
                icon={<ShoppingCart size={20} color={colors.text.primary} strokeWidth={2} />}
                onPress={() => handleCardPress('/(tabs)/orders')}
              />
              <MetricCard
                title="Products"
                value={String(products.length)}
                subtitle="in catalog"
                icon={<BarChart3 size={20} color={colors.text.primary} strokeWidth={2} />}
                onPress={() => handleCardPress('/(tabs)/inventory')}
              />
            </View>
          </View>

          {/* Low Stock Alert */}
          {stats.lowStockItems.length > 0 && (
            <View className="px-5 pt-6">
              <View
                className="rounded-2xl p-4"
                style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}
              >
                <View className="flex-row items-center mb-4">
                  <View className="w-10 h-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)' }}>
                    <AlertTriangle size={20} color="#F59E0B" strokeWidth={2} />
                  </View>
                  <View className="flex-1">
                    <Text style={{ color: colors.text.primary }} className="font-bold text-base">Low Stock Alert</Text>
                    <Text style={{ color: colors.text.tertiary }} className="text-xs">{stats.lowStockItems.length} items need attention</Text>
                  </View>
                  <Pressable
                    onPress={() => router.push('/(tabs)/inventory')}
                    className="flex-row items-center px-3 py-1.5 rounded-lg active:opacity-70"
                    style={{ backgroundColor: colors.bg.secondary }}
                  >
                    <Text style={{ color: colors.text.primary }} className="text-xs font-semibold mr-1">View All</Text>
                    <ChevronRight size={14} color={colors.text.primary} strokeWidth={2} />
                  </Pressable>
                </View>
                {stats.lowStockItems.slice(0, 3).map((item, index, arr) => (
                  <LowStockItem
                    key={`${item.name}-${item.variant}-${index}`}
                    {...item}
                    isLast={index === arr.length - 1}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Recent Orders Feed */}
          {recentOrders.length > 0 && (
            <View className="px-5 pt-6">
              <View
                className="rounded-2xl p-4"
                style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}
              >
                <View className="flex-row items-center mb-2">
                  <View className="w-10 h-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: colors.bg.secondary }}>
                    <ShoppingCart size={20} color={colors.text.primary} strokeWidth={2} />
                  </View>
                  <View className="flex-1">
                    <Text style={{ color: colors.text.primary }} className="font-bold text-base">Recent Orders</Text>
                    <Text style={{ color: colors.text.tertiary }} className="text-xs">Last {recentOrders.length} orders</Text>
                  </View>
                  <Pressable
                    onPress={() => router.push('/(tabs)/orders')}
                    className="flex-row items-center px-3 py-1.5 rounded-lg active:opacity-70"
                    style={{ backgroundColor: colors.bg.secondary }}
                  >
                    <Text style={{ color: colors.text.primary }} className="text-xs font-semibold mr-1">View All</Text>
                    <ChevronRight size={14} color={colors.text.primary} strokeWidth={2} />
                  </Pressable>
                </View>
                {recentOrders.map((order, index) => (
                  <RecentOrderItem
                    key={order.id}
                    order={order}
                    products={products}
                    onPress={() => router.push(`/order/${order.id}`)}
                    isLast={index === recentOrders.length - 1}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Sales by Source */}
          <View className="px-5 pt-6">
            <View
              className="rounded-2xl p-4"
              style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}
            >
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center">
                  <View
                    className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                    style={{ backgroundColor: colors.bg.secondary }}
                  >
                    <BarChart3 size={20} color={colors.text.primary} strokeWidth={2} />
                  </View>
                  <Text style={{ color: colors.text.primary }} className="font-bold text-base">Sales by Source</Text>
                </View>
                <Pressable
                  onPress={() => router.push('/insights/platforms')}
                  className="flex-row items-center px-3 py-1.5 rounded-lg active:opacity-70"
                  style={{ backgroundColor: colors.bg.secondary }}
                >
                  <Text style={{ color: colors.text.primary }} className="text-xs font-semibold mr-1">View All</Text>
                  <ChevronRight size={14} color={colors.text.primary} strokeWidth={2} />
                </Pressable>
              </View>
              {(() => {
                const platformData = getPlatformBreakdown(orders);
                if (platformData.length === 0) {
                  return (
                    <Text style={{ color: colors.text.muted }} className="text-sm text-center py-4">No orders yet</Text>
                  );
                }
                return platformData.slice(0, 4).map((item) => (
                  <View key={item.label} className="mb-3">
                    <View className="flex-row items-center justify-between mb-1.5">
                      <Text style={{ color: colors.text.secondary }} className="text-sm font-medium">
                        {item.label}
                      </Text>
                      <View className="flex-row items-center">
                        <Text style={{ color: colors.text.primary }} className="text-sm font-semibold">
                          {item.value}
                        </Text>
                        <Text style={{ color: colors.text.muted }} className="text-xs ml-2">
                          {item.percentage}%
                        </Text>
                      </View>
                    </View>
                    <View
                      className="h-3 rounded-full overflow-hidden"
                      style={{ backgroundColor: colors.bg.secondary }}
                    >
                      <View
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(item.percentage, 100)}%`,
                          backgroundColor: colors.text.primary,
                        }}
                      />
                    </View>
                  </View>
                ));
              })()}
            </View>
          </View>

          {/* Quick Actions */}
          <View className="px-5 pt-6 pb-8">
            <Text style={{ color: colors.text.primary }} className="font-bold text-base mb-4">Quick Actions</Text>
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => handleQuickAction('/new-order')}
                className="flex-1 rounded-2xl overflow-hidden active:opacity-80 p-4"
                style={{ backgroundColor: '#111111' }}
              >
                <Plus size={24} color="#FFFFFF" strokeWidth={2} />
                <Text className="text-white font-semibold mt-2">New Order</Text>
              </Pressable>
              <Pressable
                onPress={() => handleQuickAction('/scan')}
                className="flex-1 active:opacity-70"
              >
                <View
                  className="rounded-2xl p-4"
                  style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}
                >
                  <Scan size={24} color={colors.text.primary} strokeWidth={2} />
                  <Text style={{ color: colors.text.primary }} className="font-semibold mt-2">Scan Item</Text>
                </View>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
