import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, FlatList, Pressable, TextInput, Modal, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, ShoppingCart, ChevronRight, MapPin, Calendar, User as UserIcon, Filter, Check, X, ArrowDownAZ, ArrowUpAZ, DollarSign, Clock, AlertCircle } from 'lucide-react-native';
import useFyllStore, { Order, formatCurrency } from '@/lib/state/fyll-store';
import useAuthStore from '@/lib/state/auth-store';
import { collaborationData } from '@/lib/supabase/collaboration';
import { useThemeColors } from '@/lib/theme';
import { useBreakpoint } from '@/lib/useBreakpoint';
import { useTabBarHeight } from '@/lib/useTabBarHeight';
import { getActiveSplitCardStyle } from '@/lib/selection-style';
import { SplitViewLayout } from '@/components/SplitViewLayout';
import { OrderDetailPanel } from '@/components/OrderDetailPanel';
import { FyllAiButton } from '@/components/FyllAiButton';
import { parseOrderFromText, type ParsedOrderData } from '@/lib/ai-order-parser';
import { DESKTOP_PAGE_HEADER_MIN_HEIGHT, getStandardPageHeadingStyle } from '@/lib/page-heading';
import * as Haptics from 'expo-haptics';

// Hairline separator colors
const SEPARATOR_LIGHT = '#EEEEEE';
const SEPARATOR_DARK = '#333333';
const ORDERS_PAGE_SIZE = 20;

interface OrderCardProps {
  order: Order;
  statusColor: string;
  onPress: () => void;
  isSelected?: boolean;
  showSplitView?: boolean;
  separatorColor: string;
  unreadCount?: number;
}

function OrderCard({ order, statusColor, onPress, isSelected, showSplitView, separatorColor, unreadCount }: OrderCardProps) {
  const colors = useThemeColors();
  const isDark = colors.bg.primary === '#111111';

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
          backgroundColor: colors.bg.card,
          borderWidth: 0.5,
          borderColor: separatorColor,
          borderLeftWidth: 0.5,
          borderLeftColor: separatorColor,
          ...getActiveSplitCardStyle({ isSelected, showSplitView, isDark, colors }),
        }}
        className="rounded-xl p-3"
      >
        {/* Header */}
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1">
            <View className="flex-row items-center">
              <Text style={{ color: colors.text.primary }} className="font-bold text-base">{order.orderNumber}</Text>
              {Date.now() - new Date(order.createdAt).getTime() < 24 * 60 * 60 * 1000 && (
                <View style={{
                  backgroundColor: '#3B82F6',
                  paddingHorizontal: 5,
                  paddingVertical: 2,
                  borderRadius: 5,
                  marginLeft: 6,
                }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 }}>NEW</Text>
                </View>
              )}
              {(unreadCount ?? 0) > 0 && (
                <View style={{
                  backgroundColor: '#DC2626',
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 5,
                  marginLeft: 6,
                }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>{unreadCount}</Text>
                </View>
              )}
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

function OrderRowWeb({
  order,
  statusColor,
  onPress,
  isSelected,
  baseBackgroundColor,
  separatorColor,
  isLast,
  unreadCount,
}: {
  order: Order;
  statusColor: string;
  onPress: () => void;
  isSelected?: boolean;
  baseBackgroundColor?: string;
  separatorColor: string;
  isLast?: boolean;
  unreadCount?: number;
}) {
  const colors = useThemeColors();
  const isDark = colors.bg.primary === '#111111';

  const orderDateSource = order.orderDate ?? order.createdAt;
  const orderDate = new Date(orderDateSource).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const isRefunded = order.status === 'Refunded';

  return (
    <Pressable
      onPress={onPress}
      className="active:opacity-70"
      style={{
        backgroundColor: isSelected
          ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)')
          : (baseBackgroundColor ?? colors.bg.card),
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: separatorColor,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 14 }}>
        <View style={{ flex: 1.1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: colors.text.primary }} className="text-sm font-semibold" numberOfLines={1}>
            {order.orderNumber}
          </Text>
          {(unreadCount ?? 0) > 0 && (
            <View style={{
              backgroundColor: '#DC2626',
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 5,
            }}>
              <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <Text style={{ color: colors.text.secondary, flex: 1.6 }} className="text-sm" numberOfLines={1}>
          {order.customerName}
        </Text>
        <Text style={{ color: colors.text.tertiary, width: 56, textAlign: 'center' }} className="text-sm" numberOfLines={1}>
          {order.items?.length ?? 0}
        </Text>
        <Text style={{ color: colors.text.primary, flex: 1 }} className="text-sm font-semibold" numberOfLines={1}>
          {formatCurrency(order.totalAmount)}
        </Text>
        <View style={{ flex: 1.2, flexDirection: 'row' }}>
          <View
            className="px-2 py-1 rounded-md"
            style={{ backgroundColor: isRefunded ? 'rgba(239, 68, 68, 0.15)' : `${statusColor}15` }}
          >
            <Text style={{ color: isRefunded ? '#EF4444' : statusColor }} className="text-xs font-semibold" numberOfLines={1}>
              {order.status}
            </Text>
          </View>
        </View>
        <Text style={{ color: colors.text.tertiary, width: 128, textAlign: 'right' }} className="text-sm" numberOfLines={1}>
          {orderDate}
        </Text>
        <View style={{ width: 24, alignItems: 'flex-end' }}>
          <ChevronRight size={16} color={colors.text.muted} strokeWidth={2} />
        </View>
      </View>
    </Pressable>
  );
}

export default function OrdersScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const tabBarHeight = useTabBarHeight();
  const { isMobile, isDesktop } = useBreakpoint();
  const isDark = colors.bg.primary === '#111111';
  const separatorColor = isDark ? SEPARATOR_DARK : SEPARATOR_LIGHT;
  const isWebDesktop = Platform.OS === 'web' && isDesktop;
  const showSplitView = !isMobile && !isWebDesktop;
  const pageHeadingStyle = getStandardPageHeadingStyle(isMobile);
  const desktopHeaderMinHeight = DESKTOP_PAGE_HEADER_MIN_HEIGHT;

  const orders = useFyllStore((s) => s.orders);
  const orderStatuses = useFyllStore((s) => s.orderStatuses);
  const businessId = useAuthStore((s) => s.businessId);

  // Fetch unread notification counts per order (badges clear after viewing thread)
  const threadCountsQuery = useQuery({
    queryKey: ['collaboration-thread-counts', businessId, 'order'],
    enabled: Boolean(businessId),
    queryFn: () => collaborationData.getUnreadNotificationCountsByEntity(businessId!, 'order'),
    refetchInterval: 15000,
  });
  const unreadCounts = threadCountsQuery.data ?? {};

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showFyllAiModal, setShowFyllAiModal] = useState(false);
  const [aiMessageText, setAiMessageText] = useState('');
  const [aiIsParsing, setAiIsParsing] = useState(false);
  const [aiParsedData, setAiParsedData] = useState<ParsedOrderData | null>(null);
  const [aiParseError, setAiParseError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name-asc' | 'name-desc' | 'amount-high' | 'amount-low'>('newest');
  const [visibleOrdersCount, setVisibleOrdersCount] = useState(ORDERS_PAGE_SIZE);

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
          o.customerName?.toLowerCase().includes(query) ||
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

  const visibleOrders = useMemo(
    () => filteredOrders.slice(0, visibleOrdersCount),
    [filteredOrders, visibleOrdersCount]
  );
  const hasMoreOrders = visibleOrders.length < filteredOrders.length;

  useEffect(() => {
    setVisibleOrdersCount(ORDERS_PAGE_SIZE);
  }, [searchQuery, selectedStatus, sortBy, orders.length]);

  const loadMoreOrders = () => {
    if (!hasMoreOrders) return;
    setVisibleOrdersCount((prev) => Math.min(prev + ORDERS_PAGE_SIZE, filteredOrders.length));
  };

  useEffect(() => {
    if (!showSplitView) return;
    if (selectedOrderId && filteredOrders.some((order) => order.id === selectedOrderId)) return;
    if (filteredOrders.length > 0) {
      setSelectedOrderId(filteredOrders[0].id);
    }
  }, [showSplitView, filteredOrders, selectedOrderId]);

  const handleNewOrder = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push('/new-order');
  };

  const openOrderAi = () => {
    if (Platform.OS === 'web') {
      setShowFyllAiModal(true);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/ai-order');
  };

  const handleParseOrderWithAi = async () => {
    if (!aiMessageText.trim()) {
      setAiParseError('Paste the customer message first, then parse.');
      return;
    }

    setAiIsParsing(true);
    setAiParseError(null);
    setAiParsedData(null);

    try {
      const result = await parseOrderFromText(aiMessageText);
      if (!result) {
        setAiParseError('Fyll AI could not extract order details from this message. Please adjust the text and retry.');
        return;
      }
      setAiParsedData(result);
      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error: any) {
      const message = typeof error?.message === 'string' ? error.message : 'Fyll AI parsing failed. Please retry.';
      setAiParseError(message);
    } finally {
      setAiIsParsing(false);
    }
  };

  const handleCreateDraftFromParsedOrder = () => {
    if (!aiParsedData) return;
    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    setShowFyllAiModal(false);
    router.push({
      pathname: '/new-order',
      params: {
        aiParsed: 'true',
        customerName: aiParsedData.customerName,
        customerPhone: aiParsedData.customerPhone,
        customerEmail: aiParsedData.customerEmail,
        deliveryAddress: aiParsedData.deliveryAddress,
        deliveryState: aiParsedData.deliveryState,
        deliveryFee: String(aiParsedData.deliveryFee || ''),
        websiteOrderReference: aiParsedData.websiteOrderReference || '',
        notes: aiParsedData.notes,
        items: JSON.stringify(aiParsedData.items),
        services: JSON.stringify(aiParsedData.services ?? []),
      },
    });
  };

  const handleResetOrderAiModal = () => {
    setAiMessageText('');
    setAiIsParsing(false);
    setAiParsedData(null);
    setAiParseError(null);
  };

  const handleOrderSelect = (orderId: string) => {
    if (isWebDesktop) {
      router.push(`/orders/${orderId}`);
      return;
    }
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
      <View style={{
        backgroundColor: isDark ? 'transparent' : (isWebDesktop ? colors.bg.card : colors.bg.primary),
        borderBottomWidth: isWebDesktop ? 0 : (isDark ? 0 : 0.5),
        borderBottomColor: separatorColor,
      }}>
        {/* Header */}
        <View
          className={isWebDesktop ? 'pb-3' : 'pt-6 pb-3'}
          style={[
            { paddingHorizontal: isWebDesktop ? 28 : 20 },
            isWebDesktop ? { maxWidth: 1456, width: '100%', alignSelf: 'flex-start' } : undefined,
          ]}
        >
          <View
            className={isWebDesktop ? 'flex-row items-center justify-between' : 'flex-row items-center justify-between mb-4'}
            style={isWebDesktop ? {
              minHeight: desktopHeaderMinHeight,
              borderBottomWidth: 1,
              borderBottomColor: separatorColor,
              marginBottom: 12,
              marginHorizontal: -28,
              paddingHorizontal: 28,
            } : undefined}
          >
            <View>
              <Text style={{ color: colors.text.primary, ...pageHeadingStyle }}>Orders</Text>
            </View>
            <View className="flex-row gap-2">
              <FyllAiButton
                label="Fyll AI"
                onPress={openOrderAi}
                height={44}
                borderRadius={22}
                iconSize={16}
                textSize={14}
              />
              <Pressable
                onPress={handleNewOrder}
                className="rounded-full active:opacity-80 px-4 flex-row items-center"
                style={{ backgroundColor: colors.accent.primary, height: 44 }}
              >
                <Plus size={18} color={isDark ? '#000000' : '#FFFFFF'} strokeWidth={2.5} />
                <Text style={{ color: isDark ? '#000000' : '#FFFFFF' }} className="font-semibold ml-1.5 text-sm">New Order</Text>
              </Pressable>
            </View>
          </View>

          {/* Search + Tabs + Filter */}
          {isWebDesktop ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                className="flex-row items-center rounded-full px-4"
                style={{
                  height: 44,
                  width: '30%',
                  maxWidth: 420,
                  minWidth: 320,
                  backgroundColor: colors.input.bg,
                  borderWidth: 1,
                  borderColor: colors.border.light,
                }}
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

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ flex: 1 }}
                contentContainerStyle={{ flexGrow: 0, gap: 8, paddingRight: 4 }}
              >
                <Pressable
                  onPress={() => setSelectedStatus(null)}
                  className="rounded-full active:opacity-70"
                  style={{
                    height: 44,
                    paddingHorizontal: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: selectedStatus === null ? colors.accent.primary : colors.bg.card,
                    borderWidth: selectedStatus === null ? 0 : 1,
                    borderColor: separatorColor,
                  }}
                >
                  <Text
                    className="text-sm font-semibold"
                    style={{
                      color: selectedStatus === null ? (isDark ? '#000000' : '#FFFFFF') : colors.text.primary,
                    }}
                  >
                    All
                  </Text>
                </Pressable>
                {orderStatuses.map((status) => (
                  <Pressable
                    key={status.id}
                    onPress={() => setSelectedStatus(status.name)}
                    className="rounded-full active:opacity-70"
                    style={{
                      height: 44,
                      paddingHorizontal: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: selectedStatus === status.name ? colors.accent.primary : colors.bg.card,
                      borderWidth: selectedStatus === status.name ? 0 : 1,
                      borderColor: separatorColor,
                    }}
                  >
                    <Text
                      className="text-sm font-semibold"
                      style={{
                        color: selectedStatus === status.name ? (isDark ? '#000000' : '#FFFFFF') : colors.text.primary,
                      }}
                    >
                      {status.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Pressable
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  setShowFilterMenu(true);
                }}
                className="rounded-full items-center justify-center active:opacity-70 flex-row px-4"
                style={{
                  height: 44,
                  backgroundColor: (selectedStatus || sortBy !== 'newest') ? colors.accent.primary : colors.bg.card,
                  borderWidth: (selectedStatus || sortBy !== 'newest') ? 0 : 1,
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
          ) : (
            <View className="flex-row gap-2">
              <View
                className="flex-1 flex-row items-center rounded-full px-4"
                style={{ height: 52, backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.border.light }}
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
                className="rounded-full items-center justify-center active:opacity-70 flex-row px-4"
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
          )}
        </View>
      </View>

      {/* Order List */}
        <FlatList
          data={visibleOrders}
          keyExtractor={(item) => item.id}
          style={{
            flex: 1,
            paddingHorizontal: isWebDesktop ? 28 : 20,
            paddingTop: 16,
            backgroundColor: showSplitView ? colors.bg.primary : (isWebDesktop ? colors.bg.primary : colors.bg.secondary),
          }}
          contentContainerStyle={{
            maxWidth: isWebDesktop ? 1400 : isDesktop ? 600 : undefined,
            alignSelf: isWebDesktop ? 'flex-start' : isDesktop && !selectedOrderId ? 'center' : undefined,
            width: '100%',
            paddingBottom: tabBarHeight + 16,
            flexGrow: visibleOrders.length === 0 ? 1 : undefined,
          }}
          showsVerticalScrollIndicator={false}
          onEndReachedThreshold={0.5}
          onEndReached={loadMoreOrders}
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <View className="w-20 h-20 rounded-2xl items-center justify-center mb-4" style={{ backgroundColor: colors.border.light }}>
                <ShoppingCart size={40} color={colors.text.muted} strokeWidth={1.5} />
              </View>
              <Text style={{ color: colors.text.tertiary }} className="text-base mb-1">No orders found</Text>
              <Text style={{ color: colors.text.muted }} className="text-sm mb-4">Create your first order to get started</Text>
              <Pressable
                onPress={handleNewOrder}
                className="rounded-full active:opacity-80 px-6 py-3 flex-row items-center"
                style={{ backgroundColor: colors.accent.primary }}
              >
                <Plus size={16} color={isDark ? '#000000' : '#FFFFFF'} strokeWidth={2.5} />
                <Text style={{ color: isDark ? '#000000' : '#FFFFFF' }} className="font-semibold ml-1.5">Create First Order</Text>
              </Pressable>
            </View>
          }
          ListHeaderComponent={
            isWebDesktop && visibleOrders.length > 0 ? (
              <View
                style={{
                  width: '100%',
                  borderWidth: 1,
                  borderBottomWidth: 0,
                  borderColor: separatorColor,
                  borderTopLeftRadius: 16,
                  borderTopRightRadius: 16,
                  overflow: 'hidden',
                  backgroundColor: colors.bg.card,
                }}
              >
                <View style={{ flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border.light }}>
                  <Text style={{ color: colors.text.muted, flex: 1.1 }} className="text-xs font-semibold">ORDER ID</Text>
                  <Text style={{ color: colors.text.muted, flex: 1.6 }} className="text-xs font-semibold">CUSTOMER</Text>
                  <Text style={{ color: colors.text.muted, width: 56, textAlign: 'center' }} className="text-xs font-semibold">ITEMS</Text>
                  <Text style={{ color: colors.text.muted, flex: 1 }} className="text-xs font-semibold">TOTAL</Text>
                  <Text style={{ color: colors.text.muted, flex: 1.2 }} className="text-xs font-semibold">STATUS</Text>
                  <Text style={{ color: colors.text.muted, width: 128, textAlign: 'right' }} className="text-xs font-semibold">DATE</Text>
                  <View style={{ width: 24 }} />
                </View>
              </View>
            ) : null
          }
          ListFooterComponent={
            <View className="items-center pb-6">
              {hasMoreOrders ? (
                <Pressable
                  onPress={loadMoreOrders}
                  className="rounded-full active:opacity-80 px-4"
                  style={{
                    height: 38,
                    justifyContent: 'center',
                    backgroundColor: colors.bg.card,
                    borderWidth: 1,
                    borderColor: separatorColor,
                  }}
                >
                  <Text style={{ color: colors.text.primary }} className="text-sm font-semibold">
                    Load more orders
                  </Text>
                </Pressable>
              ) : (
                <Text style={{ color: colors.text.muted }} className="text-xs">
                  Showing {visibleOrders.length} of {filteredOrders.length}
                </Text>
              )}
              <View className="h-24" />
            </View>
          }
          renderItem={({ item: order, index }) =>
            isWebDesktop ? (
              <View style={index === visibleOrders.length - 1 ? {
                borderWidth: 1,
                borderTopWidth: 0,
                borderColor: separatorColor,
                borderBottomLeftRadius: 16,
                borderBottomRightRadius: 16,
                overflow: 'hidden',
                backgroundColor: colors.bg.card,
              } : {
                borderLeftWidth: 1,
                borderRightWidth: 1,
                borderColor: separatorColor,
                backgroundColor: colors.bg.card,
              }}>
                <OrderRowWeb
                  order={order}
                  statusColor={statusColorMap[order.status] || '#888888'}
                  isSelected={selectedOrderId === order.id}
                  onPress={() => handleOrderSelect(order.id)}
                  separatorColor={separatorColor}
                  isLast={index === visibleOrders.length - 1}
                  unreadCount={unreadCounts[order.id] ?? 0}
                />
              </View>
            ) : (
              <OrderCard
                order={order}
                statusColor={statusColorMap[order.status] || '#888888'}
                isSelected={selectedOrderId === order.id}
                showSplitView={showSplitView}
                onPress={() => handleOrderSelect(order.id)}
                separatorColor={separatorColor}
                unreadCount={unreadCounts[order.id] ?? 0}
              />
            )
          }
        />
    </>
  );

  return (
    <View className="flex-1" style={{ backgroundColor: showSplitView ? colors.bg.primary : (isWebDesktop ? colors.bg.primary : colors.bg.secondary) }}>
      <SafeAreaView className="flex-1" edges={isWebDesktop ? [] : ['top']}>
        <SplitViewLayout
          detailContent={
            showSplitView && selectedOrderId
              ? <OrderDetailPanel orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
              : null
          }
          detailTitle={showSplitView ? (selectedOrder?.orderNumber || 'Order Details') : undefined}
          onCloseDetail={showSplitView ? () => setSelectedOrderId(null) : undefined}
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
                    className="rounded-full items-center justify-center active:opacity-80"
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

        <Modal
          visible={showFyllAiModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowFyllAiModal(false)}
        >
          <Pressable
            className="flex-1 items-center justify-center"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
            onPress={() => setShowFyllAiModal(false)}
          >
            <Pressable
              onPress={(event) => event.stopPropagation()}
              style={{
                width: '92%',
                maxWidth: 760,
                maxHeight: '88%',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: colors.border.light,
                backgroundColor: colors.bg.card,
                padding: 18,
              }}
            >
              <View className="flex-row items-start justify-between">
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={{ color: colors.text.primary }} className="text-xl font-bold">
                    Fyll AI
                  </Text>
                  <Text style={{ color: colors.text.tertiary }} className="text-sm mt-1">
                    Paste a WhatsApp order message to parse and create a draft without leaving this screen.
                  </Text>
                </View>
                <Pressable
                  onPress={() => setShowFyllAiModal(false)}
                  className="rounded-full items-center justify-center"
                  style={{ backgroundColor: colors.bg.secondary, width: 40, height: 40 }}
                >
                  <X size={20} color={colors.text.tertiary} strokeWidth={2.5} />
                </Pressable>
              </View>

              <ScrollView
                className="mt-4"
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <View
                  className="rounded-xl p-3.5 flex-row"
                  style={{ backgroundColor: isDark ? '#1E1B4B' : '#EDE9FE' }}
                >
                  <AlertCircle size={18} color="#8B5CF6" strokeWidth={2} style={{ marginTop: 1 }} />
                  <Text
                    style={{ color: isDark ? '#C4B5FD' : '#6D28D9', flex: 1, marginLeft: 8, lineHeight: 18 }}
                    className="text-xs font-medium"
                  >
                    Best results come when the message includes customer name, phone, address, items and quantities.
                  </Text>
                </View>

                <View className="mt-4">
                  <Text style={{ color: colors.text.primary }} className="text-sm font-semibold mb-2">
                    Order message
                  </Text>
                  <View
                    className="rounded-xl px-3 py-3"
                    style={{
                      minHeight: 170,
                      borderWidth: 1,
                      borderColor: colors.input.border,
                      backgroundColor: colors.input.bg,
                    }}
                  >
                    <TextInput
                      placeholder={
                        'Adaeze Okonkwo\n+234 803 555 0101\n15 Admiralty Way, Lekki, Lagos\n\n2 Aviator Gold\n1 Wayfarer Black'
                      }
                      placeholderTextColor={colors.input.placeholder}
                      value={aiMessageText}
                      onChangeText={setAiMessageText}
                      multiline
                      textAlignVertical="top"
                      style={{ color: colors.input.text, fontSize: 14, minHeight: 140 }}
                    />
                  </View>
                </View>

                {aiParseError ? (
                  <View
                    className="mt-3 rounded-xl px-3 py-2.5"
                    style={{ borderWidth: 1, borderColor: '#EF4444', backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#FEE2E2' }}
                  >
                    <Text style={{ color: isDark ? '#FCA5A5' : '#B91C1C' }} className="text-xs font-medium">
                      {aiParseError}
                    </Text>
                  </View>
                ) : null}

                <View className="mt-4" style={{ gap: 10 }}>
                  <FyllAiButton
                    label={aiIsParsing ? 'Parsing with Fyll AI...' : 'Parse Order Message'}
                    onPress={handleParseOrderWithAi}
                    disabled={aiIsParsing || !aiMessageText.trim()}
                    height={48}
                    borderRadius={999}
                    textSize={14}
                  />
                  <Pressable
                    onPress={handleResetOrderAiModal}
                    className="rounded-full items-center justify-center active:opacity-80"
                    style={{ height: 42, borderWidth: 1, borderColor: colors.border.light }}
                  >
                    <Text style={{ color: colors.text.secondary }} className="text-sm font-semibold">
                      Clear
                    </Text>
                  </Pressable>
                </View>

                {aiIsParsing ? (
                  <View className="mt-4 flex-row items-center">
                    <ActivityIndicator size="small" color={colors.text.tertiary} />
                    <Text style={{ color: colors.text.tertiary }} className="text-xs ml-2">
                      Parsing customer details...
                    </Text>
                  </View>
                ) : null}

                {aiParsedData ? (
                  <View
                    className="mt-4 rounded-xl p-4"
                    style={{ borderWidth: 1, borderColor: colors.border.light, backgroundColor: colors.bg.secondary }}
                  >
                    <View className="flex-row items-center justify-between">
                      <Text style={{ color: colors.text.primary }} className="text-sm font-bold">
                        Parsed Draft
                      </Text>
                      <View className="px-2 py-1 rounded-full" style={{ backgroundColor: 'rgba(34,197,94,0.15)' }}>
                        <Text style={{ color: '#16A34A' }} className="text-[10px] font-semibold">
                          {aiParsedData.confidence.toUpperCase()} CONFIDENCE
                        </Text>
                      </View>
                    </View>

                    <View className="mt-3" style={{ gap: 6 }}>
                      <Text style={{ color: colors.text.secondary }} className="text-xs">
                        Customer: <Text style={{ color: colors.text.primary }}>{aiParsedData.customerName || 'Not found'}</Text>
                      </Text>
                      <Text style={{ color: colors.text.secondary }} className="text-xs">
                        Phone: <Text style={{ color: colors.text.primary }}>{aiParsedData.customerPhone || 'Not found'}</Text>
                      </Text>
                      <Text style={{ color: colors.text.secondary }} className="text-xs">
                        State: <Text style={{ color: colors.text.primary }}>{aiParsedData.deliveryState || 'Not found'}</Text>
                      </Text>
                      <Text style={{ color: colors.text.secondary }} className="text-xs">
                        Items: <Text style={{ color: colors.text.primary }}>{aiParsedData.items.length}</Text>
                      </Text>
                    </View>

                    {aiParsedData.items.length > 0 ? (
                      <View className="mt-3" style={{ gap: 6 }}>
                        {aiParsedData.items.slice(0, 4).map((item, index) => (
                          <View key={`${item.productName}-${index}`} className="flex-row items-center justify-between">
                            <Text style={{ color: colors.text.secondary, flex: 1 }} className="text-xs" numberOfLines={1}>
                              {item.quantity}x {item.productName}
                            </Text>
                            {item.unitPrice ? (
                              <Text style={{ color: colors.text.primary }} className="text-xs font-semibold ml-3">
                                ₦{item.unitPrice.toLocaleString()}
                              </Text>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    ) : null}

                    <View className="mt-4">
                      <FyllAiButton
                        label="Create Draft Order"
                        onPress={handleCreateDraftFromParsedOrder}
                        height={46}
                        borderRadius={999}
                        textSize={14}
                      />
                    </View>
                  </View>
                ) : null}

                <View className="h-3" />
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </View>
  );
}
