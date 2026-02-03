import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Plus, Search, ShoppingCart, ChevronRight, MapPin, Calendar, User as UserIcon, Filter, Check, X, ArrowDownAZ, ArrowUpAZ, DollarSign, Sparkles, Clock } from 'lucide-react-native';
import useFyllStore, { Order, formatCurrency } from '@/lib/state/fyll-store';
import { useThemeColors } from '@/lib/theme';
import { useBreakpoint } from '@/lib/useBreakpoint';
import { SplitViewLayout } from '@/components/SplitViewLayout';
import { OrderDetailPanel } from '@/components/OrderDetailPanel';
import { cn } from '@/lib/cn';
import * as Haptics from 'expo-haptics';

// Hairline separator colors
const SEPARATOR_LIGHT = '#EEEEEE';
const SEPARATOR_DARK = '#333333';

interface OrderCardProps {
  order: Order;
  statusColor: string;
  onPress: () => void;
  isSelected?: boolean;
  showSplitView?: boolean;
  separatorColor: string;
}

function OrderCard({ order, statusColor, onPress, isSelected, showSplitView, separatorColor }: OrderCardProps) {
  const colors = useThemeColors();

  const orderDateSource = order.orderDate ?? order.createdAt;
  const orderDate = new Date(orderDateSource).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  // Determine if status is Refunded for red color
  const isRefunded = order.status === 'Refunded';

  return (
    <Pressable
      onPress={() => {
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPress();
      }}
      className="mb-2 active:opacity-80"
    >
      <View
        style={{
          backgroundColor: isSelected && showSplitView ? colors.bg.tertiary : colors.bg.card,
          borderWidth: isSelected && showSplitView ? 2 : 0.5,
          borderColor: isSelected && showSplitView ? colors.accent.primary : separatorColor,
          borderLeftWidth: isSelected && showSplitView ? 3 : 0.5,
          borderLeftColor: isSelected && showSplitView ? colors.accent.primary : separatorColor,
        }}
        className="rounded-xl p-3"
      >
        {/* Header */}
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1">
            <View className="flex-row items-center">
              <Text style={{ color: colors.text.primary }} className="font-bold text-base">{order.orderNumber}</Text>
              <View
                className="ml-2 px-2 py-0.5 rounded-md"
                style={{ backgroundColor: isRefunded ? 'rgba(239, 68, 68, 0.15)' : `${statusColor}15` }}
              >
                <Text style={{ color: isRefunded ? '#EF4444' : statusColor }} className="text-xs font-semibold">
                  {order.status}
                </Text>
              </View>
            </View>
            <View className="flex-row items-center mt-1">
              <UserIcon size={12} color={colors.text.tertiary} strokeWidth={2} />
              <Text style={{ color: colors.text.tertiary }} className="text-sm ml-1">{order.customerName}</Text>
            </View>
          </View>
          <View className="items-end">
            <Text style={{ color: colors.text.primary, fontSize: 16 }} className="font-bold">{formatCurrency(order.totalAmount)}</Text>
            <View className="flex-row items-center mt-0.5">
              <View className="px-1.5 py-0.5 rounded" style={{ backgroundColor: colors.bg.secondary }}>
                <Text style={{ color: colors.text.muted }} className="text-xs">{order.source}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View className="flex-row items-center pt-2" style={{ borderTopWidth: 0.5, borderTopColor: separatorColor }}>
          <View className="flex-row items-center mr-4">
            <Calendar size={12} color={colors.text.muted} strokeWidth={2} />
            <Text style={{ color: colors.text.muted }} className="text-xs ml-1">{orderDate}</Text>
          </View>
          <View className="flex-row items-center">
            <MapPin size={12} color={colors.text.muted} strokeWidth={2} />
            <Text style={{ color: colors.text.muted }} className="text-xs ml-1">{order.deliveryState || 'N/A'}</Text>
          </View>
          <View className="flex-1" />
          <ChevronRight size={16} color={colors.text.muted} strokeWidth={2} />
        </View>
      </View>
    </Pressable>
  );
}

export default function OrdersScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const tabBarHeight = useBottomTabBarHeight();
  const { isMobile, isDesktop } = useBreakpoint();
  const isDark = colors.bg.primary === '#111111';
  const separatorColor = isDark ? SEPARATOR_DARK : SEPARATOR_LIGHT;
  const showSplitView = !isMobile;

  const orders = useFyllStore((s) => s.orders);
  const orderStatuses = useFyllStore((s) => s.orderStatuses);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name-asc' | 'name-desc' | 'amount-high' | 'amount-low'>('newest');

  // Split view state
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const statusColorMap = useMemo(() => {
    return orderStatuses.reduce((acc, status) => {
      acc[status.name] = status.color;
      return acc;
    }, {} as Record<string, string>);
  }, [orderStatuses]);

  // Get selected order
  const selectedOrder = useMemo(() => {
    if (!selectedOrderId) return null;
    return orders.find((o) => o.id === selectedOrderId);
  }, [orders, selectedOrderId]);

  const filteredOrders = useMemo(() => {
    let result = [...orders];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(query) ||
          o.customerName.toLowerCase().includes(query) ||
          (o.customerEmail && o.customerEmail.toLowerCase().includes(query))
      );
    }

    if (selectedStatus) {
      result = result.filter((o) => o.status === selectedStatus);
    }

    // Apply sorting
    result = result.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'name-asc':
          return a.customerName.localeCompare(b.customerName);
        case 'name-desc':
          return b.customerName.localeCompare(a.customerName);
        case 'amount-high':
          return b.totalAmount - a.totalAmount;
        case 'amount-low':
          return a.totalAmount - b.totalAmount;
        default:
          return 0;
      }
    });

    return result;
  }, [orders, searchQuery, selectedStatus, sortBy]);

  useEffect(() => {
    if (!showSplitView) return;
    if (selectedOrderId && filteredOrders.some((order) => order.id === selectedOrderId)) return;
    if (filteredOrders.length > 0) {
      setSelectedOrderId(filteredOrders[0].id);
    }
  }, [showSplitView, filteredOrders, selectedOrderId]);

  const stats = useMemo(() => {
    const total = orders.length;
    return { total };
  }, [orders]);

  const handleNewOrder = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push('/new-order');
  };

  const handleOrderSelect = (orderId: string) => {
    if (showSplitView) {
      setSelectedOrderId(orderId);
    } else {
      router.push(`/order/${orderId}`);
    }
  };

  // Master pane content
  const masterContent = (
    <>
      {/* Sticky Header + Search */}
      <View style={{ backgroundColor: colors.bg.primary, borderBottomWidth: 0.5, borderBottomColor: separatorColor }}>
        {/* Header */}
        <View className="px-5 pt-6 pb-3">
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text style={{ color: colors.text.tertiary }} className="text-xs font-medium uppercase tracking-wider">Sales</Text>
              <Text style={{ color: colors.text.primary }} className="text-2xl font-bold">Orders</Text>
            </View>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  }
                  router.push('/ai-order');
                }}
                className="rounded-xl active:opacity-80 px-3 flex-row items-center"
                style={{ backgroundColor: '#8B5CF6', height: 42 }}
              >
                <Sparkles size={16} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={{ color: '#FFFFFF' }} className="font-semibold ml-1.5 text-sm">AI</Text>
              </Pressable>
              <Pressable
                onPress={handleNewOrder}
                className="rounded-xl active:opacity-80 px-4 flex-row items-center"
                style={{ backgroundColor: '#111111', height: 42 }}
              >
                <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={{ color: '#FFFFFF' }} className="font-semibold ml-1.5 text-sm">New Order</Text>
              </Pressable>
            </View>
          </View>

          {/* Search + Filter Row */}
          <View className="flex-row gap-2">
            <View
              className="flex-1 flex-row items-center rounded-xl px-4"
              style={{ height: 52, backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border }}
            >
              <Search size={18} color={colors.text.muted} strokeWidth={2} />
              <TextInput
                placeholder="Search orders..."
                placeholderTextColor={colors.input.placeholder}
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={{ flex: 1, marginLeft: 8, color: colors.input.text, fontSize: 14 }}
                selectionColor={colors.text.primary}
              />
            </View>
            <Pressable
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                setShowFilterMenu(true);
              }}
              className="rounded-xl items-center justify-center active:opacity-70 flex-row px-4"
              style={{
                height: 52,
                backgroundColor: (selectedStatus || sortBy !== 'newest') ? colors.accent.primary : colors.bg.secondary,
                borderWidth: (selectedStatus || sortBy !== 'newest') ? 0 : 0.5,
                borderColor: separatorColor,
              }}
            >
              <Filter size={18} color={(selectedStatus || sortBy !== 'newest') ? (isDark ? '#000000' : '#FFFFFF') : colors.text.tertiary} strokeWidth={2} />
              {(selectedStatus || sortBy !== 'newest') && (
                <Text style={{ color: isDark ? '#000000' : '#FFFFFF' }} className="font-semibold text-sm ml-1.5">
                  {(selectedStatus ? 1 : 0) + (sortBy !== 'newest' ? 1 : 0)}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>

      {/* Order List */}
      <ScrollView
        style={{
          flex: 1,
          paddingHorizontal: 20,
          paddingTop: 16,
          backgroundColor: colors.bg.secondary,
        }}
        contentContainerStyle={{
          maxWidth: isDesktop ? 600 : undefined,
          alignSelf: isDesktop && !selectedOrderId ? 'center' : undefined,
          paddingBottom: tabBarHeight + 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        {filteredOrders.length === 0 ? (
          <View className="items-center justify-center py-20">
            <View className="w-20 h-20 rounded-2xl items-center justify-center mb-4" style={{ backgroundColor: colors.border.light }}>
              <ShoppingCart size={40} color={colors.text.muted} strokeWidth={1.5} />
            </View>
            <Text style={{ color: colors.text.tertiary }} className="text-base mb-1">No orders found</Text>
            <Text style={{ color: colors.text.muted }} className="text-sm mb-4">Create your first order to get started</Text>
            <Pressable
              onPress={handleNewOrder}
              className="rounded-xl active:opacity-80 px-6 py-3"
              style={{ backgroundColor: colors.accent.primary }}
            >
              <Text style={{ color: isDark ? '#000000' : '#FFFFFF' }} className="font-semibold">Create First Order</Text>
            </Pressable>
          </View>
          ) : (
            <>
              {filteredOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  statusColor={statusColorMap[order.status] || '#888888'}
                  isSelected={selectedOrderId === order.id}
                  showSplitView={showSplitView}
                  onPress={() => handleOrderSelect(order.id)}
                  separatorColor={separatorColor}
                />
              ))}
              <View className="h-24" />
            </>
          )}
        </ScrollView>
      </>
    );

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        <SplitViewLayout
          detailContent={selectedOrderId ? <OrderDetailPanel orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} /> : null}
          detailTitle={selectedOrder?.orderNumber || 'Order Details'}
          onCloseDetail={() => setSelectedOrderId(null)}
        >
          {masterContent}
        </SplitViewLayout>

        {/* Filter Menu Modal */}
        <Modal
          visible={showFilterMenu}
          animationType="fade"
          transparent
          onRequestClose={() => setShowFilterMenu(false)}
        >
          <Pressable
            className="flex-1 justify-end"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            onPress={() => setShowFilterMenu(false)}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              className="rounded-t-3xl"
              style={{ backgroundColor: colors.bg.primary, maxHeight: '75%' }}
            >
              {/* Handle */}
              <View className="items-center py-3">
                <View className="w-10 h-1 rounded-full" style={{ backgroundColor: colors.border.light }} />
              </View>

              {/* Header */}
              <View className="flex-row items-center justify-between px-5 pb-4" style={{ borderBottomWidth: 0.5, borderBottomColor: separatorColor }}>
                <Text style={{ color: colors.text.primary }} className="font-bold text-lg">Filter & Sort</Text>
                <Pressable
                  onPress={() => setShowFilterMenu(false)}
                  className="w-8 h-8 rounded-full items-center justify-center active:opacity-50"
                  style={{ backgroundColor: colors.bg.secondary }}
                >
                  <X size={18} color={colors.text.tertiary} strokeWidth={2} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Filter by Status Section */}
                <View className="px-5 pt-4">
                  <Text style={{ color: colors.text.muted }} className="text-xs font-semibold uppercase tracking-wider mb-3">Filter by Status</Text>

                  {/* All option */}
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedStatus(null);
                    }}
                    className="flex-row items-center py-3 active:opacity-70"
                  >
                    <View className="flex-1">
                      <Text style={{ color: colors.text.primary }} className="font-medium text-sm">All Orders</Text>
                    </View>
                    {selectedStatus === null && (
                      <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: colors.accent.primary }}>
                        <Check size={12} color={isDark ? '#000000' : '#FFFFFF'} strokeWidth={3} />
                      </View>
                    )}
                  </Pressable>

                  {/* Status options */}
                  {orderStatuses.map((status) => (
                    <Pressable
                      key={status.id}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedStatus(status.name);
                      }}
                      className="flex-row items-center py-3 active:opacity-70"
                    >
                      <View
                        className="w-3 h-3 rounded-full mr-3"
                        style={{ backgroundColor: status.color }}
                      />
                      <View className="flex-1">
                        <Text style={{ color: colors.text.primary }} className="font-medium text-sm">{status.name}</Text>
                      </View>
                      {selectedStatus === status.name && (
                        <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: colors.accent.primary }}>
                          <Check size={12} color={isDark ? '#000000' : '#FFFFFF'} strokeWidth={3} />
                        </View>
                      )}
                    </Pressable>
                  ))}
                </View>

                {/* Sort Section */}
                <View className="px-5 pt-4 pb-2" style={{ borderTopWidth: 0.5, borderTopColor: separatorColor, marginTop: 8 }}>
                  <Text style={{ color: colors.text.muted }} className="text-xs font-semibold uppercase tracking-wider mb-3">Sort By</Text>

                  {/* Newest First */}
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSortBy('newest');
                    }}
                    className="flex-row items-center py-3 active:opacity-70"
                  >
                    <Clock size={18} color={sortBy === 'newest' ? colors.accent.primary : colors.text.muted} strokeWidth={2} />
                    <View className="flex-1 ml-3">
                      <Text style={{ color: colors.text.primary }} className="font-medium text-sm">Newest First</Text>
                    </View>
                    {sortBy === 'newest' && (
                      <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: colors.accent.primary }}>
                        <Check size={12} color={isDark ? '#000000' : '#FFFFFF'} strokeWidth={3} />
                      </View>
                    )}
                  </Pressable>

                  {/* Oldest First */}
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSortBy('oldest');
                    }}
                    className="flex-row items-center py-3 active:opacity-70"
                  >
                    <Clock size={18} color={sortBy === 'oldest' ? colors.accent.primary : colors.text.muted} strokeWidth={2} />
                    <View className="flex-1 ml-3">
                      <Text style={{ color: colors.text.primary }} className="font-medium text-sm">Oldest First</Text>
                    </View>
                    {sortBy === 'oldest' && (
                      <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: colors.accent.primary }}>
                        <Check size={12} color={isDark ? '#000000' : '#FFFFFF'} strokeWidth={3} />
                      </View>
                    )}
                  </Pressable>

                  {/* Customer Name A-Z */}
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSortBy('name-asc');
                    }}
                    className="flex-row items-center py-3 active:opacity-70"
                  >
                    <ArrowDownAZ size={18} color={sortBy === 'name-asc' ? colors.accent.primary : colors.text.muted} strokeWidth={2} />
                    <View className="flex-1 ml-3">
                      <Text style={{ color: colors.text.primary }} className="font-medium text-sm">Customer (A-Z)</Text>
                    </View>
                    {sortBy === 'name-asc' && (
                      <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: colors.accent.primary }}>
                        <Check size={12} color={isDark ? '#000000' : '#FFFFFF'} strokeWidth={3} />
                      </View>
                    )}
                  </Pressable>

                  {/* Customer Name Z-A */}
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSortBy('name-desc');
                    }}
                    className="flex-row items-center py-3 active:opacity-70"
                  >
                    <ArrowUpAZ size={18} color={sortBy === 'name-desc' ? colors.accent.primary : colors.text.muted} strokeWidth={2} />
                    <View className="flex-1 ml-3">
                      <Text style={{ color: colors.text.primary }} className="font-medium text-sm">Customer (Z-A)</Text>
                    </View>
                    {sortBy === 'name-desc' && (
                      <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: colors.accent.primary }}>
                        <Check size={12} color={isDark ? '#000000' : '#FFFFFF'} strokeWidth={3} />
                      </View>
                    )}
                  </Pressable>

                  {/* Amount: High to Low */}
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSortBy('amount-high');
                    }}
                    className="flex-row items-center py-3 active:opacity-70"
                  >
                    <DollarSign size={18} color={sortBy === 'amount-high' ? colors.accent.primary : colors.text.muted} strokeWidth={2} />
                    <View className="flex-1 ml-3">
                      <Text style={{ color: colors.text.primary }} className="font-medium text-sm">Amount: High to Low</Text>
                    </View>
                    {sortBy === 'amount-high' && (
                      <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: colors.accent.primary }}>
                        <Check size={12} color={isDark ? '#000000' : '#FFFFFF'} strokeWidth={3} />
                      </View>
                    )}
                  </Pressable>

                  {/* Amount: Low to High */}
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSortBy('amount-low');
                    }}
                    className="flex-row items-center py-3 active:opacity-70"
                  >
                    <DollarSign size={18} color={sortBy === 'amount-low' ? colors.accent.primary : colors.text.muted} strokeWidth={2} />
                    <View className="flex-1 ml-3">
                      <Text style={{ color: colors.text.primary }} className="font-medium text-sm">Amount: Low to High</Text>
                    </View>
                    {sortBy === 'amount-low' && (
                      <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: colors.accent.primary }}>
                        <Check size={12} color={isDark ? '#000000' : '#FFFFFF'} strokeWidth={3} />
                      </View>
                    )}
                  </Pressable>
                </View>

                {/* Apply Button */}
                <View className="px-5 py-4">
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setShowFilterMenu(false);
                    }}
                    className="rounded-xl items-center justify-center active:opacity-80"
                    style={{ height: 50, backgroundColor: colors.accent.primary }}
                  >
                    <Text style={{ color: isDark ? '#000000' : '#FFFFFF' }} className="font-semibold">Apply</Text>
                  </Pressable>
                </View>

                <View className="h-8" />
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </View>
  );
}
