import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  TrendingDown,
  ShoppingCart,
  BarChart3,
  Scan,
  Plus,
  ArrowUpRight,
  ChevronRight,
  ClipboardList,
  DollarSign,
  Package,
  Users,
  FileText,
  Bell,
  X,
  MessageCircle,
  User as UserIcon,
} from 'lucide-react-native';
import useFyllStore, { formatCurrency, Order, Product } from '@/lib/state/fyll-store';
import { useThemeColors } from '@/lib/theme';
import * as Haptics from 'expo-haptics';
import { getPlatformBreakdown } from '@/lib/analytics-utils';
import useAuthStore from '@/lib/state/auth-store';
import { collaborationData, type CollaborationNotification } from '@/lib/supabase/collaboration';
import { supabase } from '@/lib/supabase';
import { isTeamThreadEntityId, getTeamThreadDisplayNameFromEntityId } from '@/lib/team-threads';
import { FulfillmentPipelineCard, type FulfillmentStageKey } from '@/components/FulfillmentPipelineCard';
import { bucketFulfillmentStatus } from '@/lib/fulfillment';
import { useTabBarHeight } from '@/lib/useTabBarHeight';
import { useBreakpoint } from '@/lib/useBreakpoint';
import { WebContainer } from '@/components/web/WebContainer';
import { WebPageHeader } from '@/components/web/WebPageHeader';
import { WebCard } from '@/components/web/WebCard';
import { InteractiveLineChart } from '@/components/stats/InteractiveLineChart';
import { InteractiveBarChart } from '@/components/stats/InteractiveBarChart';
import { storage } from '@/lib/storage';
import { createOrderStatusColorMap, getOrderStatusColor } from '@/lib/order-status-colors';
import { taskData, type Task } from '@/lib/supabase/tasks';

const ORDER_NOTIFICATIONS_SEEN_KEY_PREFIX = 'dashboard-order-notifications-seen';
const getOrderNotificationsSeenKey = (businessId: string) =>
  `${ORDER_NOTIFICATIONS_SEEN_KEY_PREFIX}:${businessId}`;

const formatTaskDueDate = (value?: string | null) => {
  if (!value) return 'No date';
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return 'No date';
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const toSentenceCase = (value?: string | null) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) return '';
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1).toLowerCase()}`;
};

const getTaskStatusMeta = (status: Task['status']) => {
  if (status === 'done') return { label: 'Done', color: '#059669', background: 'rgba(5,150,105,0.12)' };
  if (status === 'in_progress') return { label: 'In progress', color: '#2563EB', background: 'rgba(37,99,235,0.12)' };
  return { label: 'Todo', color: '#B45309', background: 'rgba(180,83,9,0.12)' };
};

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

// Audit Banner Component
interface AuditBannerProps {
  onPress: () => void;
  inset?: boolean;
}

function AuditBanner({ onPress, inset = true }: AuditBannerProps) {
  const content = (
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
          <Text style={{ color: '#6B21A8' }} className="font-bold text-base">
            Monthly Audit Due
          </Text>
          <Text style={{ color: '#7C3AED' }} className="text-sm mt-0.5">
            Complete your inventory audit before month-end
          </Text>
        </View>
        <ChevronRight size={20} color="#8B5CF6" strokeWidth={2} />
      </View>
    </Pressable>
  );

  if (!inset) return content;

  return <View className="px-5 pt-4">{content}</View>;
}

// Notification Bell Component
function NotificationBell({ count, onPress }: { count: number; onPress: () => void }) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: colors.bg.card,
        borderWidth: 1,
        borderColor: colors.border.light,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Bell size={20} color={colors.text.primary} strokeWidth={2} />
      {count > 0 && (
        <View
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            backgroundColor: '#DC2626',
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 4,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// Notification Panel Component
function NotificationPanel({
  visible,
  onClose,
  notifications,
  onNotificationPress,
  onMarkAllRead,
  orders: ordersList = [],
  profilesMap = new Map<string, string>(),
}: {
  visible: boolean;
  onClose: () => void;
  notifications: CollaborationNotification[];
  onNotificationPress: (n: CollaborationNotification) => void;
  onMarkAllRead: () => void;
  orders?: Order[];
  profilesMap?: Map<string, string>;
}) {
  const colors = useThemeColors();
  const { isDesktop } = useBreakpoint();
  const isWebDesktop = Platform.OS === 'web' && isDesktop;
  const router = useRouter();

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Build a map of order id → order number for quick lookup
  const orderNumberMap = useMemo(() => {
    if (!visible || !ordersList?.length) {
      return new Map<string, string>();
    }
    const map = new Map<string, string>();
    (ordersList ?? []).forEach((o) => {
      if (o.id && o.orderNumber) map.set(o.id, o.orderNumber);
    });
    return map;
  }, [ordersList, visible]);

  const getNotificationText = useCallback((n: CollaborationNotification) => {
    const payload = n.payload as any;
    // Try profile name from actor_user_id, then payload authorName, then fallback
    const authorName =
      (n.actor_user_id ? profilesMap.get(n.actor_user_id) : null)
      ?? payload?.authorName
      ?? 'A team member';
    const eType = n.entity_type ?? payload?.entityType;
    const eId = n.entity_id ?? payload?.entityId;

    // Build entity label
    let entityLabel = '';
    if (eType === 'order' && eId) {
      const orderNum = orderNumberMap.get(eId);
      entityLabel = orderNum ? `Order #${orderNum}` : 'an order';
    } else if (eType === 'case' && eId) {
      entityLabel = isTeamThreadEntityId(eId)
        ? getTeamThreadDisplayNameFromEntityId(eId)
        : 'a case';
    } else if (eType === 'task') {
      entityLabel = 'a task';
    }

    const context = entityLabel ? ` in ${entityLabel}` : '';

    if (payload?.type === 'task_assigned') {
      return `${authorName} assigned you a task${context}`;
    }
    if (payload?.type === 'task_completed') {
      return `${authorName} completed a task${context}`;
    }
    if (payload?.type === 'task_due_reminder') {
      return `Task reminder${context}`;
    }

    if (n.event_type === 'mention') {
      return `${authorName} mentioned you${context}`;
    }
    return `${authorName} replied${context}`;
  }, [orderNumberMap, profilesMap]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Orders created in the last 24h — shown in a "New Orders" section
  const recentOrders = useMemo(() => {
    if (!visible) return [];
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return [...(ordersList ?? [])]
      .filter((o) => new Date(o.createdAt).getTime() > cutoff)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
  }, [ordersList, visible]);

  const handleOrderPress = (orderId: string) => {
    onClose();
    router.push(`/order/${orderId}` as any);
  };

  const renderNewOrderItem = (order: Order, compact: boolean) => (
    <Pressable
      key={order.id}
      onPress={() => handleOrderPress(order.id)}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: compact ? 18 : 20,
        paddingVertical: compact ? 12 : 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.light,
      }}
    >
      <View
        style={{
          width: compact ? 36 : 40,
          height: compact ? 36 : 40,
          borderRadius: compact ? 10 : 12,
          backgroundColor: 'rgba(59,130,246,0.12)',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: compact ? 12 : 14,
        }}
      >
        <ShoppingCart size={compact ? 15 : 17} color="#3B82F6" strokeWidth={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{ color: colors.text.primary, fontSize: compact ? 13 : 14, fontWeight: '600' }}
          numberOfLines={1}
        >
          New order {order.orderNumber}
        </Text>
        {order.createdBy ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 4 }}>
            <UserIcon size={11} color={colors.text.muted} strokeWidth={2} />
            <Text style={{ color: colors.text.tertiary, fontSize: compact ? 12 : 13 }} numberOfLines={1}>
              Created by {order.createdBy}
            </Text>
          </View>
        ) : null}
        <Text style={{ color: colors.text.muted, fontSize: compact ? 11 : 12, marginTop: 2 }}>
          {order.customerName} • {formatTimeAgo(order.createdAt)}
        </Text>
      </View>
      <View style={{ paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, backgroundColor: '#3B82F6', alignSelf: 'flex-start', marginTop: 2 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 }}>NEW</Text>
      </View>
    </Pressable>
  );

  if (!visible) {
    return null;
  }

  if (isWebDesktop) {
    return (
      <>
        <Pressable
          onPress={onClose}
          style={{ position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}
        />
        <View
          style={{
            position: 'fixed' as any,
            top: 80,
            right: 28,
            width: 400,
            maxHeight: 520,
            backgroundColor: colors.bg.card,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border.light,
            zIndex: 10000,
            overflow: 'hidden',
            ...(Platform.OS === 'web' ? { boxShadow: '0 4px 16px rgba(0,0,0,0.08)' } as any : {}),
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 18,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: colors.border.light,
            }}
          >
            <Text style={{ color: colors.text.primary, fontSize: 16, fontWeight: '700' }}>
              Notifications
            </Text>
            {unreadCount > 0 && (
              <Pressable onPress={onMarkAllRead}>
                <Text style={{ color: colors.accent.primary, fontSize: 13, fontWeight: '600' }}>
                  Mark all read
                </Text>
              </Pressable>
            )}
          </View>
          <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
            {recentOrders.length > 0 && (
              <>
                <View style={{ paddingHorizontal: 18, paddingTop: 10, paddingBottom: 4 }}>
                  <Text style={{ color: colors.text.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>New Orders</Text>
                </View>
                {recentOrders.map((o) => renderNewOrderItem(o, true))}
              </>
            )}
            {notifications.length === 0 && recentOrders.length === 0 ? (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <Bell size={32} color={colors.text.muted} strokeWidth={1.5} />
                <Text style={{ color: colors.text.muted, fontSize: 14, marginTop: 8 }}>
                  No notifications yet
                </Text>
              </View>
            ) : notifications.length > 0 ? (
              <>
                {recentOrders.length > 0 && (
                  <View style={{ paddingHorizontal: 18, paddingTop: 10, paddingBottom: 4 }}>
                    <Text style={{ color: colors.text.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>Thread Activity</Text>
                  </View>
                )}
                {notifications.map((n) => {
                  const notifText = getNotificationText(n);
                  const bodyPreview = (n.payload as any)?.body;
                  const truncatedPreview = typeof bodyPreview === 'string' && bodyPreview.length > 80
                    ? bodyPreview.slice(0, 77) + '...'
                    : bodyPreview;
                  return (
                  <Pressable
                    key={n.id}
                    onPress={() => onNotificationPress(n)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      paddingHorizontal: 18,
                      paddingVertical: 14,
                      backgroundColor: n.is_read ? 'transparent' : `${colors.accent.primary}08`,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border.light,
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: n.is_read ? colors.bg.secondary : `${colors.accent.primary}15`,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12,
                      }}
                    >
                      <MessageCircle
                        size={16}
                        color={n.is_read ? colors.text.muted : colors.accent.primary}
                        strokeWidth={2}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: colors.text.primary,
                          fontSize: 13,
                          fontWeight: n.is_read ? '400' : '600',
                        }}
                        numberOfLines={1}
                      >
                        {notifText}
                      </Text>
                      {truncatedPreview ? (
                        <Text
                          style={{ color: colors.text.tertiary, fontSize: 12, marginTop: 2 }}
                          numberOfLines={1}
                        >
                          "{truncatedPreview}"
                        </Text>
                      ) : null}
                      <Text style={{ color: colors.text.muted, fontSize: 11, marginTop: 2 }}>
                        {formatTimeAgo(n.created_at)}
                      </Text>
                    </View>
                    {!n.is_read && (
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: '#DC2626',
                          marginTop: 4,
                          marginLeft: 8,
                        }}
                      />
                    )}
                  </Pressable>
                  );
                })}
              </>
            ) : null}
          </ScrollView>
        </View>
      </>
    );
  }

  // Mobile: full screen modal
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg.primary }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: colors.border.light,
          }}
        >
          <Text style={{ color: colors.text.primary, fontSize: 18, fontWeight: '700' }}>
            Notifications
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {unreadCount > 0 && (
              <Pressable onPress={onMarkAllRead}>
                <Text style={{ color: colors.accent.primary, fontSize: 14, fontWeight: '600' }}>
                  Mark all read
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={onClose}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: colors.bg.secondary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} color={colors.text.tertiary} strokeWidth={2} />
            </Pressable>
          </View>
        </View>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {recentOrders.length > 0 && (
            <>
              <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 }}>
                <Text style={{ color: colors.text.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>New Orders</Text>
              </View>
              {recentOrders.map((o) => renderNewOrderItem(o, false))}
            </>
          )}
          {notifications.length === 0 && recentOrders.length === 0 ? (
            <View style={{ padding: 48, alignItems: 'center' }}>
              <Bell size={40} color={colors.text.muted} strokeWidth={1.5} />
              <Text style={{ color: colors.text.muted, fontSize: 15, marginTop: 12 }}>
                No notifications yet
              </Text>
            </View>
          ) : notifications.length > 0 ? (
            <>
              {recentOrders.length > 0 && (
                <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 }}>
                  <Text style={{ color: colors.text.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>Thread Activity</Text>
                </View>
              )}
              {notifications.map((n) => {
                const notifText = getNotificationText(n);
                const bodyPreview = (n.payload as any)?.body;
                const truncatedPreview = typeof bodyPreview === 'string' && bodyPreview.length > 80
                  ? bodyPreview.slice(0, 77) + '...'
                  : bodyPreview;
                return (
                <Pressable
                  key={n.id}
                  onPress={() => onNotificationPress(n)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    paddingHorizontal: 20,
                    paddingVertical: 16,
                    backgroundColor: n.is_read ? 'transparent' : `${colors.accent.primary}08`,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border.light,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: n.is_read ? colors.bg.secondary : `${colors.accent.primary}15`,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 14,
                    }}
                  >
                    <MessageCircle
                      size={18}
                      color={n.is_read ? colors.text.muted : colors.accent.primary}
                      strokeWidth={2}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.text.primary,
                        fontSize: 14,
                        fontWeight: n.is_read ? '400' : '600',
                      }}
                      numberOfLines={1}
                    >
                      {notifText}
                    </Text>
                    {truncatedPreview ? (
                      <Text
                        style={{ color: colors.text.tertiary, fontSize: 13, marginTop: 2 }}
                        numberOfLines={1}
                      >
                        "{truncatedPreview}"
                      </Text>
                    ) : null}
                    <Text style={{ color: colors.text.muted, fontSize: 12, marginTop: 2 }}>
                      {formatTimeAgo(n.created_at)}
                    </Text>
                  </View>
                  {!n.is_read && (
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: '#DC2626',
                        marginTop: 6,
                        marginLeft: 8,
                      }}
                    />
                  )}
                </Pressable>
                );
              })}
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// Recent Order Item Component
interface RecentOrderItemProps {
  order: Order;
  productById: Map<string, Product>;
  statusColorMap: Record<string, string>;
  onPress: () => void;
  isLast?: boolean;
}

function RecentOrderItem({ order, productById, statusColorMap, onPress, isLast = false }: RecentOrderItemProps) {
  const colors = useThemeColors();

  // Get first item info
  const firstItem = order.items[0];
  const product = firstItem?.productId ? productById.get(firstItem.productId) : undefined;
  const variant = product?.variants.find((v) => v.id === firstItem?.variantId);
  const itemName = product?.name ?? 'Unknown Product';
  const itemSku = variant?.sku ?? 'N/A';

  const statusColor = getOrderStatusColor(order.status, statusColorMap, '#F59E0B');

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
  const tabBarHeight = useTabBarHeight();
  const { isDesktop } = useBreakpoint();
  const isWebDesktop = Platform.OS === 'web' && isDesktop;
  const products = useFyllStore((s) => s.products);
  const orders = useFyllStore((s) => s.orders);
  const cases = useFyllStore((s) => s.cases);
  const orderStatuses = useFyllStore((s) => s.orderStatuses);
  const expenseRequests = useFyllStore((s) => s.expenseRequests);
  const customers = useFyllStore((s) => s.customers);
  const hasAuditForMonth = useFyllStore((s) => s.hasAuditForMonth);

  const userName = useAuthStore((s) => s.currentUser?.name ?? '');
  const currentUserId = useAuthStore((s) => s.currentUser?.id ?? '');
  const businessId = useAuthStore((s) => s.businessId ?? s.currentUser?.businessId ?? null);
  const userRole = useAuthStore((s) => s.currentUser?.role ?? 'staff');
  const queryClient = useQueryClient();
  const [showNotifications, setShowNotifications] = useState(false);
  const [orderNotificationsSeenAt, setOrderNotificationsSeenAt] = useState(0);
  const shouldShowMobileTaskTable = !isWebDesktop && (userRole === 'admin' || userRole === 'manager');

  useEffect(() => {
    let isCancelled = false;

    if (!businessId) {
      setOrderNotificationsSeenAt(0);
      return;
    }

    void storage.getItem(getOrderNotificationsSeenKey(businessId)).then((value) => {
      if (isCancelled) return;
      const parsed = Number(value ?? '0');
      setOrderNotificationsSeenAt(Number.isFinite(parsed) ? parsed : 0);
    }).catch(() => {
      if (isCancelled) return;
      setOrderNotificationsSeenAt(0);
    });

    return () => {
      isCancelled = true;
    };
  }, [businessId]);

  useEffect(() => {
    if (!showNotifications || !businessId) return;

    const seenAt = Date.now();
    setOrderNotificationsSeenAt((previous) => Math.max(previous, seenAt));
    void storage.setItem(getOrderNotificationsSeenKey(businessId), String(seenAt));
  }, [showNotifications, businessId]);

  // Notification queries
  const notificationsQuery = useQuery({
    queryKey: ['collaboration-notifications', businessId],
    enabled: Boolean(businessId),
    queryFn: () => collaborationData.listMyNotifications(businessId!, { limit: 30 }),
    refetchInterval: 15000,
  });

  // Realtime: refetch notifications immediately when a new one arrives
  useEffect(() => {
    if (!businessId || !currentUserId) return;
    const channel = supabase
      .channel(`notifications:${businessId}:${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'collaboration_notifications',
          filter: `user_id=eq.${currentUserId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['collaboration-notifications', businessId] });
        }
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [businessId, currentUserId, queryClient]);

  const mobileHomeTasksQuery = useQuery({
    queryKey: ['dashboard-mobile-tasks', businessId, userRole, currentUserId],
    enabled: Boolean(businessId) && shouldShowMobileTaskTable,
    queryFn: () => taskData.listTasks(businessId!),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  // Fetch profiles for author name display in notifications
  const profilesQuery = useQuery({
    queryKey: ['collaboration-profiles', businessId],
    enabled: Boolean(businessId),
    queryFn: () => collaborationData.fetchProfilesForBusiness(businessId!),
    staleTime: 5 * 60 * 1000,
  });
  const profilesMap = useMemo(() => {
    const map = new Map<string, string>();
    (profilesQuery.data ?? []).forEach((p) => {
      if (p.id && p.name) map.set(p.id, p.name);
    });
    return map;
  }, [profilesQuery.data]);

  const notifications = useMemo(
    () => notificationsQuery.data ?? [],
    [notificationsQuery.data]
  );
  const mobileHomeScopedTasks = useMemo(() => {
    if (!shouldShowMobileTaskTable) return [] as Task[];
    const rawTasks = mobileHomeTasksQuery.data ?? [];
    const filtered = rawTasks.filter((task) => task.status !== 'done');
    return [...filtered].sort((left, right) => {
      const leftDue = left.due_date ? new Date(`${left.due_date}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER;
      const rightDue = right.due_date ? new Date(`${right.due_date}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER;
      if (leftDue !== rightDue) return leftDue - rightDue;
      return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
    });
  }, [shouldShowMobileTaskTable, mobileHomeTasksQuery.data]);
  const mobileHomeTaskRows = useMemo(
    () => mobileHomeScopedTasks.slice(0, 5),
    [mobileHomeScopedTasks]
  );
  const unreadNotificationCount = useMemo(() => {
    const now = Date.now();
    const threadUnread = notifications.filter((n) => !n.is_read).length;
    const newOrdersCount = orders.filter(
      (o) => {
        const createdAtMs = new Date(o.createdAt).getTime();
        if (!Number.isFinite(createdAtMs)) return false;
        return (now - createdAtMs) < 24 * 60 * 60 * 1000 && createdAtMs > orderNotificationsSeenAt;
      }
    ).length;
    return threadUnread + newOrdersCount;
  }, [notifications, orders, orderNotificationsSeenAt]);

  const handleNotificationPress = useCallback((n: CollaborationNotification) => {
    // Mark as read
    if (!n.is_read) {
      collaborationData.markNotificationAsRead(n.id).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['collaboration-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['collaboration-thread-counts'] });
    }
    setShowNotifications(false);
    // Navigate using joined thread entity info, or fall back to payload
    const eType = n.entity_type ?? (n.payload as any)?.entityType;
    const eId = n.entity_id ?? (n.payload as any)?.entityId;
    if (eType === 'order' && eId) {
      router.push(`/threads?orderId=${encodeURIComponent(eId)}` as any);
    } else if (eType === 'case' && eId) {
      if (isTeamThreadEntityId(eId)) {
        router.push(`/threads?teamEntityId=${encodeURIComponent(eId)}` as any);
      } else {
        router.push(`/threads?caseEntityId=${encodeURIComponent(eId)}` as any);
      }
    }
  }, [queryClient, router]);

  const handleMarkAllRead = useCallback(() => {
    if (businessId) {
      collaborationData.markAllNotificationsAsRead(businessId).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['collaboration-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['collaboration-thread-counts'] });
    }
  }, [businessId, queryClient]);

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

  const sortedOrdersByDate = useMemo(() => {
    return [...orders].sort(
      (a, b) =>
        new Date(b.orderDate ?? b.createdAt).getTime() - new Date(a.orderDate ?? a.createdAt).getTime()
    );
  }, [orders]);

  const recentOrdersMobile = useMemo(() => sortedOrdersByDate.slice(0, 5), [sortedOrdersByDate]);

  const recentOrdersWeb = useMemo(() => sortedOrdersByDate.slice(0, 10), [sortedOrdersByDate]);

  const productById = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((product) => {
      map.set(product.id, product);
    });
    return map;
  }, [products]);
  const orderStatusColorMap = useMemo(
    () => createOrderStatusColorMap(orderStatuses),
    [orderStatuses]
  );
  const financeCardBadgeCount = useMemo(() => {
    if (userRole === 'admin') {
      return expenseRequests.filter((request) => request.status === 'submitted').length;
    }
    if (userRole === 'manager') {
      return expenseRequests.filter(
        (request) => request.submittedByUserId === currentUserId && request.status === 'submitted'
      ).length;
    }
    return 0;
  }, [currentUserId, expenseRequests, userRole]);

  const openCasesCount = useMemo(
    () => cases.filter((caseItem) => caseItem.status !== 'Closed' && caseItem.status !== 'Resolved').length,
    [cases]
  );

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    let totalRevenue = 0;
    let lastMonthRevenue = 0;
    let productSales = 0;
    let deliveryFees = 0;
    let servicesRevenue = 0;
    let pendingOrders = 0;

    orders.forEach((order) => {
      const status = order.status;
      if (status !== 'Delivered' && status !== 'Refunded') {
        pendingOrders += 1;
      }
      if (status === 'Refunded') return;

      const orderDate = new Date(order.orderDate ?? order.createdAt);
      const month = orderDate.getMonth();
      const year = orderDate.getFullYear();

      if (month === currentMonth && year === currentYear) {
        totalRevenue += order.totalAmount;
        productSales += order.subtotal || order.totalAmount;
        deliveryFees += order.deliveryFee || 0;
        servicesRevenue += order.services?.reduce((sSum, service) => sSum + service.price, 0) || 0;
        return;
      }

      if (month === lastMonth && year === lastMonthYear) {
        lastMonthRevenue += order.totalAmount;
      }
    });

    const revenueChange = lastMonthRevenue > 0
      ? Math.round(((totalRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
      : 0;

    return {
      productSales,
      deliveryFees,
      servicesRevenue,
      totalRevenue,
      revenueChange,
      pendingOrders,
      totalOrders: orders.length,
    };
  }, [orders]);

  const fulfillment = useMemo(() => {
    const counts: Record<FulfillmentStageKey, number> = {
      processing: 0,
      dispatch: 0,
      delivered: 0,
    };

    orders.forEach((o) => {
      const key = bucketFulfillmentStatus(o.status);
      if (!key) return;
      counts[key] += 1;
    });

    return counts;
  }, [orders]);

  const handleQuickAction = (route: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push(route as any);
  };

  const handleCardPress = (route: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push(route as any);
  };

  const goToFulfillment = (tab?: FulfillmentStageKey) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const pathname = isWebDesktop ? '/fulfillment' : '/fulfillment-pipeline';
    router.push(
      tab
        ? ({ pathname, params: { tab } } as any)
        : (pathname as any)
    );
  };

  const inventoryVariantCount = useMemo(() => {
    return products.reduce((sum, p) => sum + (p.variants?.length ?? 0), 0);
  }, [products]);

  const mostSoldProducts = useMemo(() => {
    const qtyByProductId = new Map<string, number>();

    orders.forEach((order) => {
      const status = (order.status || '').toLowerCase();
      if (status.includes('refund')) return;

      order.items.forEach((item) => {
        const productId = item.productId;
        if (!productId) return;
        qtyByProductId.set(productId, (qtyByProductId.get(productId) ?? 0) + (item.quantity ?? 0));
      });
    });

    const rows = Array.from(qtyByProductId.entries()).map(([productId, quantity]) => {
      const product = productById.get(productId);
      return {
        productId,
        name: product?.name ?? 'Unknown product',
        sku: product?.variants?.[0]?.sku ?? '—',
        quantity,
      };
    });

    rows.sort((a, b) => b.quantity - a.quantity);
    return rows;
  }, [orders, productById]);

  const revenueTrend7d = useMemo(() => {
    const trendDays = 7;
    const toDayId = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const today = new Date();
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (trendDays - 1));

    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - trendDays);

    let prevTotal = 0;
    let prevOrdersTotal = 0;

    const revenueByDay = new Map<string, number>();
    const ordersByDay = new Map<string, number>();
    orders.forEach((order) => {
      const status = (order.status || '').toLowerCase();
      if (status.includes('refund')) return;

      const date = new Date(order.orderDate ?? order.createdAt);
      if (date < prevStart || date > end) return;

      if (date < start) {
        prevTotal += order.totalAmount;
        prevOrdersTotal += 1;
        return;
      }

      const key = toDayId(date);
      revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + order.totalAmount);
      ordersByDay.set(key, (ordersByDay.get(key) ?? 0) + 1);
    });

    const days = Array.from({ length: trendDays }, (_, idx) => {
      const date = new Date(start);
      date.setDate(start.getDate() + idx);
      const key = toDayId(date);
      return {
        key,
        label: date.toLocaleDateString('en-US', { weekday: 'short' }),
        value: revenueByDay.get(key) ?? 0,
        orders: ordersByDay.get(key) ?? 0,
      };
    });

    const total = days.reduce((sum, day) => sum + day.value, 0);
    const ordersTotal = days.reduce((sum, day) => sum + day.orders, 0);
    const change =
      prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;
    const ordersChange =
      prevOrdersTotal > 0 ? Math.round(((ordersTotal - prevOrdersTotal) / prevOrdersTotal) * 100) : null;

    return { days, total, ordersTotal, change, ordersChange };
  }, [orders]);

  const formatShortDate = (isoLike: string) => {
    const [yearRaw, monthRaw, dayRaw] = isoLike.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    const day = Number(dayRaw);
    const date = Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)
      ? new Date(year, month - 1, day)
      : new Date(isoLike);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Processing':
        return '#3B82F6';
      case 'Lab Processing':
        return '#8B5CF6';
      case 'Quality Check':
        return '#111111';
      case 'Ready for Pickup':
        return '#10B981';
      case 'Delivered':
        return '#059669';
      case 'Refunded':
        return '#EF4444';
      default:
        return '#F59E0B';
    }
  };

  const [selectedTrendIndex, setSelectedTrendIndex] = useState<number | null>(null);

  const selectedTrendDay =
    typeof selectedTrendIndex === 'number' ? revenueTrend7d.days[selectedTrendIndex] : null;

  const revenueLineData = useMemo(
    () => revenueTrend7d.days.map((day) => ({ key: day.key, label: day.label, value: day.value })),
    [revenueTrend7d.days]
  );

  const orderVolumeData = useMemo(
    () => revenueTrend7d.days.map((day) => ({ key: day.key, label: day.label, value: day.orders })),
    [revenueTrend7d.days]
  );

  const platformData = useMemo(() => getPlatformBreakdown(orders), [orders]);

  const formatCompactCurrencyTick = (value: number) => {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `₦${Math.round(value / 1_000_000)}m`;
    if (abs >= 1_000) return `₦${Math.round(value / 1_000)}k`;
    return `₦${Math.round(value)}`;
  };

  const WebRecentOrders = (
    <WebCard style={{ padding: 0, flex: 1 }}>
      <View style={{ padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: colors.text.primary }} className="text-base font-bold">
          Recent Orders
        </Text>
        <Pressable
          onPress={() => router.push('/orders')}
          className="flex-row items-center px-2 py-1 active:opacity-70"
        >
          <Text style={{ color: colors.text.primary }} className="text-xs font-semibold mr-1">
            View All
          </Text>
          <ChevronRight size={14} color={colors.text.primary} strokeWidth={2} />
        </Pressable>
      </View>

      {recentOrdersWeb.length === 0 ? (
        <View style={{ paddingHorizontal: 18, paddingBottom: 18 }}>
          <Text style={{ color: colors.text.muted }} className="text-sm">
            No orders yet.
          </Text>
        </View>
      ) : (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border.light }}>
          {recentOrdersWeb.map((order, idx) => {
            const statusColor = getStatusColor(order.status);
            const dateSource = order.orderDate ?? order.createdAt;
            return (
              <Pressable
                key={order.id}
                onPress={() => router.push(`/orders/${order.id}`)}
                className="active:opacity-70"
                style={{
                  borderBottomWidth: idx === recentOrdersWeb.length - 1 ? 0 : 1,
                  borderBottomColor: colors.border.light,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14 }}>
                  <Text style={{ color: colors.text.primary, flex: 1.1 }} className="text-sm font-semibold" numberOfLines={1}>
                    {order.orderNumber}
                  </Text>
                  <Text style={{ color: colors.text.secondary, flex: 1.6 }} className="text-sm" numberOfLines={1}>
                    {order.customerName}
                  </Text>
                  <Text style={{ color: colors.text.primary, flex: 1 }} className="text-sm font-semibold" numberOfLines={1}>
                    {formatCurrency(order.totalAmount)}
                  </Text>
                  <View style={{ flex: 1.2, flexDirection: 'row' }}>
                    <View className="px-2 py-1 rounded-md" style={{ backgroundColor: `${statusColor}15` }}>
                      <Text style={{ color: statusColor }} className="text-xs font-semibold" numberOfLines={1}>
                        {order.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ color: colors.text.tertiary, width: 72, textAlign: 'right' }} className="text-sm">
                    {formatShortDate(dateSource)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </WebCard>
  );

  const WebMostSoldProducts = (
    <WebCard style={{ padding: 0, flex: 1 }}>
      <View style={{ padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
          <View
            className="w-10 h-10 rounded-xl items-center justify-center mr-3"
            style={{ backgroundColor: colors.bg.secondary }}
          >
            <Package size={20} color={colors.text.primary} strokeWidth={2} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.text.primary }} className="font-bold text-base" numberOfLines={1}>
              Most Sold
            </Text>
            <Text style={{ color: colors.text.tertiary }} className="text-xs" numberOfLines={1}>
              {mostSoldProducts.length === 0
                ? 'No sales yet'
                : `Top ${Math.min(mostSoldProducts.length, 8)} products by quantity`}
            </Text>
          </View>
        </View>

        <Pressable onPress={() => router.push('/insights/best-sellers')} className="flex-row items-center px-2 py-1 active:opacity-70">
          <Text style={{ color: colors.text.primary }} className="text-xs font-semibold mr-1">
            View All
          </Text>
          <ChevronRight size={14} color={colors.text.primary} strokeWidth={2} />
        </Pressable>
      </View>

      {mostSoldProducts.length === 0 ? (
        <View style={{ paddingHorizontal: 18, paddingBottom: 18 }}>
          <Text style={{ color: colors.text.muted }} className="text-sm">
            No sales yet.
          </Text>
        </View>
      ) : (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border.light }}>
          {mostSoldProducts.slice(0, 8).map((row, idx, arr) => (
            <Pressable
              key={row.productId}
              onPress={() => router.push(`/inventory/${row.productId}`)}
              className="active:opacity-70"
              style={{
                borderBottomWidth: idx === arr.length - 1 ? 0 : 1,
                borderBottomColor: colors.border.light,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: colors.text.primary }} className="text-sm font-semibold" numberOfLines={1}>
                    {row.name}
                  </Text>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs mt-0.5" numberOfLines={1}>
                    {row.sku}
                  </Text>
                </View>
                <Text style={{ color: colors.text.primary, width: 90, textAlign: 'right' }} className="text-sm font-semibold">
                  {row.quantity}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </WebCard>
  );

  const WebRevenueTrend = (
    <WebCard style={{ padding: 18, flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
          <View
            className="w-10 h-10 rounded-xl items-center justify-center mr-3"
            style={{ backgroundColor: colors.bg.secondary }}
          >
            <DollarSign size={20} color={colors.text.primary} strokeWidth={2} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.text.primary }} className="font-bold text-base" numberOfLines={1}>
              Revenue Trend
            </Text>
            <Text style={{ color: colors.text.tertiary }} className="text-xs" numberOfLines={1}>
              {selectedTrendDay
                ? `${formatShortDate(selectedTrendDay.key)} • ${formatCurrency(selectedTrendDay.value)}`
                : `Last 7 days • ${formatCurrency(revenueTrend7d.total)} • ${revenueTrend7d.ordersTotal} orders`}
            </Text>
          </View>
        </View>
        {revenueTrend7d.change !== null ? (
          <View
            className="flex-row items-center px-2 py-1 rounded-full"
            style={{ backgroundColor: revenueTrend7d.change >= 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)' }}
          >
            {revenueTrend7d.change >= 0 ? (
              <ArrowUpRight size={12} color="#22C55E" strokeWidth={2.5} />
            ) : (
              <TrendingDown size={12} color="#EF4444" strokeWidth={2.5} />
            )}
            <Text style={{ color: revenueTrend7d.change >= 0 ? '#22C55E' : '#EF4444' }} className="text-xs font-semibold ml-0.5">
              {Math.abs(revenueTrend7d.change)}%
            </Text>
          </View>
        ) : null}
      </View>

      <InteractiveLineChart
        data={revenueLineData}
        height={220}
        lineColor={colors.text.primary}
        gridColor={colors.border.light}
        textColor={colors.text.muted}
        selectedIndex={selectedTrendIndex}
        onSelectIndex={setSelectedTrendIndex}
        formatYLabel={formatCompactCurrencyTick}
      />
    </WebCard>
  );

  const WebOrderVolume = (
    <WebCard style={{ padding: 18, flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
          <View
            className="w-10 h-10 rounded-xl items-center justify-center mr-3"
            style={{ backgroundColor: colors.bg.secondary }}
          >
            <ShoppingCart size={20} color={colors.text.primary} strokeWidth={2} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.text.primary }} className="font-bold text-base" numberOfLines={1}>
              Order Volume
            </Text>
            <Text style={{ color: colors.text.tertiary }} className="text-xs" numberOfLines={1}>
              {selectedTrendDay
                ? `${formatShortDate(selectedTrendDay.key)} • ${selectedTrendDay.orders} orders`
                : `Last 7 days • ${revenueTrend7d.ordersTotal} orders`}
            </Text>
          </View>
        </View>
        {revenueTrend7d.ordersChange !== null ? (
          <View
            className="flex-row items-center px-2 py-1 rounded-full"
            style={{ backgroundColor: revenueTrend7d.ordersChange >= 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)' }}
          >
            {revenueTrend7d.ordersChange >= 0 ? (
              <ArrowUpRight size={12} color="#22C55E" strokeWidth={2.5} />
            ) : (
              <TrendingDown size={12} color="#EF4444" strokeWidth={2.5} />
            )}
            <Text style={{ color: revenueTrend7d.ordersChange >= 0 ? '#22C55E' : '#EF4444' }} className="text-xs font-semibold ml-0.5">
              {Math.abs(revenueTrend7d.ordersChange)}%
            </Text>
          </View>
        ) : null}
      </View>

      <InteractiveBarChart
        data={orderVolumeData}
        height={220}
        barColor={colors.text.primary}
        gridColor={colors.border.light}
        textColor={colors.text.muted}
        selectedIndex={selectedTrendIndex}
        onSelectIndex={setSelectedTrendIndex}
        formatYLabel={(value) => String(Math.round(value))}
      />
    </WebCard>
  );

  if (isWebDesktop) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
        <NotificationPanel
          visible={showNotifications}
          onClose={() => setShowNotifications(false)}
          notifications={notifications}
          onNotificationPress={handleNotificationPress}
          onMarkAllRead={handleMarkAllRead}
          orders={orders}
          profilesMap={profilesMap}
        />
        <SafeAreaView className="flex-1" edges={['top']}>
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: 28, paddingBottom: 40 }}
          >
            <WebContainer>
              <WebPageHeader
                title="Dashboard"
                subtitle={userName ? `Welcome back, ${userName}` : 'Welcome back'}
                actions={
                  <>
                    <NotificationBell
                      count={unreadNotificationCount}
                      onPress={() => setShowNotifications((prev) => !prev)}
                    />
                    <Pressable
                      onPress={() => router.push('/new-order')}
                      className="rounded-full px-4 flex-row items-center active:opacity-80"
                      style={{ backgroundColor: colors.accent.primary, height: 44 }}
                    >
                      <Plus size={18} color={colors.bg.primary === '#111111' ? '#000000' : '#FFFFFF'} strokeWidth={2.5} />
                      <Text
                        style={{ color: colors.bg.primary === '#111111' ? '#000000' : '#FFFFFF' }}
                        className="font-semibold ml-2 text-sm"
                      >
                        New Order
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => router.push('/scan')}
                      className="rounded-full px-4 flex-row items-center active:opacity-80"
                      style={{ backgroundColor: colors.bg.card, height: 44, borderWidth: 1, borderColor: colors.border.light }}
                    >
                      <Scan size={18} color={colors.text.primary} strokeWidth={2.5} />
                      <Text style={{ color: colors.text.primary }} className="font-semibold ml-2 text-sm">
                        Scan
                      </Text>
                    </Pressable>
                  </>
                }
              />

              {showAuditBanner ? (
                <View style={{ marginTop: 16 }}>
                  <AuditBanner onPress={() => handleQuickAction('/inventory-audit')} inset={false} />
                </View>
              ) : null}

              <View style={{ marginTop: 16 }}>
                <FulfillmentPipelineCard
                  counts={fulfillment}
                  onPress={() => goToFulfillment()}
                  onStagePress={(stage) => goToFulfillment(stage)}
                />
              </View>

              <View style={{ marginTop: 18, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {(userRole === 'admin' || userRole === 'manager') && (
                  <MetricCard
                    title="Total Revenue"
                    value={formatCurrency(stats.totalRevenue)}
                    subtitle="This month"
                    trend={stats.revenueChange}
                    icon={<DollarSign size={18} color={colors.text.primary} strokeWidth={2.5} />}
                    onPress={() => handleCardPress('/insights')}
                  />
                )}
                <MetricCard
                  title="Orders"
                  value={String(stats.totalOrders)}
                  subtitle={`${stats.pendingOrders} active`}
                  icon={<ShoppingCart size={18} color={colors.text.primary} strokeWidth={2.5} />}
                  onPress={() => handleCardPress('/orders')}
                />
                <MetricCard
                  title="Inventory Items"
                  value={String(inventoryVariantCount)}
                  subtitle={`${products.length} products`}
                  icon={<Package size={18} color={colors.text.primary} strokeWidth={2.5} />}
                  onPress={() => handleCardPress('/inventory')}
                />
                <MetricCard
                  title="Customers"
                  value={String(customers.length)}
                  subtitle="Total customers"
                  icon={<Users size={18} color={colors.text.primary} strokeWidth={2.5} />}
                  onPress={() => handleCardPress('/customers')}
                />
                <MetricCard
                  title="Cases"
                  value={String(openCasesCount)}
                  subtitle={`${cases.length} total`}
                  icon={<FileText size={18} color={colors.text.primary} strokeWidth={2.5} />}
                  onPress={() => handleCardPress('/cases')}
                />
              </View>

              <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'stretch', gap: 16 }}>
                {(userRole === 'admin' || userRole === 'manager') && (
                  <View style={{ flex: 1.4, minWidth: 0 }}>{WebRevenueTrend}</View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>{WebOrderVolume}</View>
              </View>

              <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'stretch', gap: 16 }}>
                <View style={{ flex: 1.4, minWidth: 0 }}>{WebRecentOrders}</View>
                <View style={{ flex: 1, minWidth: 0 }}>{WebMostSoldProducts}</View>
              </View>
            </WebContainer>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

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
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text.tertiary }} className="text-sm font-medium">Welcome back</Text>
                {userName ? (
                  <Text style={{ color: colors.text.primary }} className="text-3xl font-bold tracking-tight">{userName}</Text>
                ) : null}
              </View>
              <NotificationBell
                count={unreadNotificationCount}
                onPress={() => setShowNotifications(true)}
              />
            </View>
          </View>
          <NotificationPanel
            visible={showNotifications}
            onClose={() => setShowNotifications(false)}
            notifications={notifications}
            onNotificationPress={handleNotificationPress}
            onMarkAllRead={handleMarkAllRead}
            orders={orders}
            profilesMap={profilesMap}
          />

          {/* Audit Banner - Shows between 25th-31st if no audit logged */}
          {showAuditBanner && (
            <AuditBanner onPress={() => handleQuickAction('/inventory-audit')} />
          )}

          {/* Hero Revenue Card — admin & manager only */}
          {(userRole === 'admin' || userRole === 'manager') && (
          <View className="px-5 pt-4">
            <View
              className="rounded-3xl overflow-hidden p-6"
              style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}
            >
              <View className="flex-row items-center justify-between mb-4">
                <Text style={{ color: colors.text.muted }} className="text-sm font-medium">Total Revenue</Text>
                {stats.revenueChange !== 0 && (
                  <View style={{ backgroundColor: stats.revenueChange >= 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 }}>
                    {stats.revenueChange >= 0 ? (
                      <ArrowUpRight size={12} color="#22C55E" strokeWidth={2.5} />
                    ) : (
                      <TrendingDown size={12} color="#EF4444" strokeWidth={2.5} />
                    )}
                    <Text style={{ color: stats.revenueChange >= 0 ? '#22C55E' : '#EF4444', fontSize: 12, fontWeight: '700', marginLeft: 2 }}>
                      {Math.abs(stats.revenueChange)}%
                    </Text>
                  </View>
                )}
              </View>
              <Text style={{ color: colors.text.primary }} className="text-4xl font-bold tracking-tight mb-1">
                {formatCurrency(stats.totalRevenue)}
              </Text>
              <Text style={{ color: colors.text.muted }} className="text-sm">This month</Text>

              <View className="flex-row mt-4 pt-4" style={{ borderTopWidth: 1, borderTopColor: colors.border.light }}>
                <View className="flex-1">
                  <Text style={{ color: colors.text.muted }} className="text-xs">Products</Text>
                  <Text style={{ color: colors.text.primary }} className="font-semibold">{formatCurrency(stats.productSales)}</Text>
                </View>
                <View className="flex-1">
                  <Text style={{ color: colors.text.muted }} className="text-xs">Delivery</Text>
                  <Text style={{ color: colors.text.primary }} className="font-semibold">{formatCurrency(stats.deliveryFees)}</Text>
                </View>
                <View className="flex-1">
                  <Text style={{ color: colors.text.muted }} className="text-xs">Services</Text>
                  <Text style={{ color: colors.text.primary }} className="font-semibold">{formatCurrency(stats.servicesRevenue)}</Text>
                </View>
              </View>
            </View>
          </View>
          )}

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

          <View className="px-5 pt-6">
            <Pressable
              onPress={() => handleCardPress('/cases')}
              className="rounded-2xl p-4 active:opacity-80"
              style={{
                backgroundColor: colors.bg.card,
                borderWidth: 1,
                borderColor: colors.border.light,
              }}
            >
              <View className="flex-row items-center">
                <View
                  className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                  style={{ backgroundColor: 'rgba(245,158,11,0.14)' }}
                >
                  <FileText size={20} color="#F59E0B" strokeWidth={2.5} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: colors.text.primary }} className="font-bold text-sm">Cases</Text>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs mt-0.5">
                    {openCasesCount > 0
                      ? `${openCasesCount} open case${openCasesCount === 1 ? '' : 's'} needing attention`
                      : 'View all customer cases'}
                  </Text>
                </View>
                <View className="flex-row items-center" style={{ columnGap: 10 }}>
                  {openCasesCount > 0 ? (
                    <View
                      className="rounded-full items-center justify-center"
                      style={{
                        minWidth: 22,
                        height: 22,
                        paddingHorizontal: 6,
                        backgroundColor: '#F59E0B',
                      }}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
                        {openCasesCount > 99 ? '99+' : openCasesCount}
                      </Text>
                    </View>
                  ) : null}
                  <ChevronRight size={16} color={colors.text.tertiary} strokeWidth={2} />
                </View>
              </View>
            </Pressable>
          </View>

          {/* Finance & Insights navigation cards */}
          {(userRole === 'admin' || userRole === 'manager') && (
            <View className="px-5 pt-6">
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => router.push('/(tabs)/finance' as any)}
                  className="flex-1 rounded-2xl p-4 active:opacity-80"
                  style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light, position: 'relative' }}
                >
                  {financeCardBadgeCount > 0 ? (
                    <View
                      className="rounded-full items-center justify-center"
                      style={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        minWidth: 22,
                        height: 22,
                        paddingHorizontal: 6,
                        backgroundColor: '#2563EB',
                      }}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
                        {financeCardBadgeCount > 99 ? '99+' : financeCardBadgeCount}
                      </Text>
                    </View>
                  ) : null}
                  <View className="w-9 h-9 rounded-xl items-center justify-center mb-2" style={{ backgroundColor: 'rgba(16,185,129,0.12)' }}>
                    <DollarSign size={18} color="#10B981" strokeWidth={2.5} />
                  </View>
                  <Text style={{ color: colors.text.primary }} className="font-bold text-sm">Finance</Text>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs mt-0.5">
                    {userRole === 'admin'
                      ? `${financeCardBadgeCount} requests pending`
                      : 'Expenses & procurement'}
                  </Text>
                </Pressable>
                {userRole === 'admin' && (
                  <Pressable
                    onPress={() => router.push('/(tabs)/insights' as any)}
                    className="flex-1 rounded-2xl p-4 active:opacity-80"
                    style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}
                  >
                    <View className="w-9 h-9 rounded-xl items-center justify-center mb-2" style={{ backgroundColor: 'rgba(59,130,246,0.12)' }}>
                      <BarChart3 size={18} color="#3B82F6" strokeWidth={2.5} />
                    </View>
                    <Text style={{ color: colors.text.primary }} className="font-bold text-sm">Insights</Text>
                    <Text style={{ color: colors.text.tertiary }} className="text-xs mt-0.5">Sales & trends</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {/* Fulfillment Pipeline */}
          <View className="px-5 pt-6">
            <FulfillmentPipelineCard
              counts={fulfillment}
              onPress={() => goToFulfillment()}
              onStagePress={(stage) => goToFulfillment(stage)}
            />
          </View>

          {shouldShowMobileTaskTable ? (
            <View className="px-5 pt-6">
              <View
                className="rounded-2xl overflow-hidden"
                style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}
              >
                <View className="flex-row items-center p-4">
                  <View className="w-10 h-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: colors.bg.secondary }}>
                    <ClipboardList size={20} color={colors.text.primary} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text.primary }} className="font-bold text-base">
                      Tasks
                    </Text>
                    <Text style={{ color: colors.text.tertiary }} className="text-xs">
                      {mobileHomeScopedTasks.length} active
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => router.push('/(tabs)/tasks' as any)}
                    className="flex-row items-center px-3 py-1.5 rounded-full active:opacity-70"
                    style={{ backgroundColor: colors.bg.secondary }}
                  >
                    <Text style={{ color: colors.text.primary }} className="text-xs font-semibold mr-1">View All</Text>
                    <ChevronRight size={14} color={colors.text.primary} strokeWidth={2} />
                  </Pressable>
                </View>

                <View style={{ borderTopWidth: 1, borderTopColor: colors.border.light }}>
                  {mobileHomeTasksQuery.isPending
                    ? Array.from({ length: 5 }).map((_, index) => (
                      <View
                        key={`task-loading-${index}`}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingHorizontal: 16,
                          paddingVertical: 12,
                          borderBottomWidth: index === 4 ? 0 : 1,
                          borderBottomColor: colors.border.light,
                        }}
                      >
                        <Text style={{ flex: 1.6, color: colors.text.tertiary, fontSize: 13, fontWeight: '500' }}>Loading...</Text>
                        <Text style={{ width: 70, textAlign: 'right', color: colors.text.muted, fontSize: 12 }}>--</Text>
                        <Text style={{ width: 94, textAlign: 'right', color: colors.text.muted, fontSize: 12 }}>--</Text>
                      </View>
                    ))
                    : null}

                  {!mobileHomeTasksQuery.isPending
                    ? mobileHomeTaskRows.map((task, index) => {
                      const status = getTaskStatusMeta(task.status);
                      return (
                        <Pressable
                          key={task.id}
                          onPress={() => router.push(`/task/${task.id}` as any)}
                          className="active:opacity-70"
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            borderBottomWidth: index === mobileHomeTaskRows.length - 1 ? 0 : 1,
                            borderBottomColor: colors.border.light,
                          }}
                        >
                          <Text style={{ flex: 1.6, color: colors.text.primary, fontSize: 13, fontWeight: '500' }} numberOfLines={1}>
                            {toSentenceCase(task.title)}
                          </Text>
                          <Text style={{ width: 70, textAlign: 'right', color: colors.text.tertiary, fontSize: 12, fontWeight: '500' }}>
                            {formatTaskDueDate(task.due_date)}
                          </Text>
                          <View style={{ width: 94, alignItems: 'flex-end' }}>
                            <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: status.background }}>
                              <Text style={{ color: status.color, fontSize: 11, fontWeight: '700' }}>
                                {status.label}
                              </Text>
                            </View>
                          </View>
                        </Pressable>
                      );
                    })
                    : null}
                </View>
              </View>
            </View>
          ) : null}

          {/* Recent Orders Feed */}
          {recentOrdersMobile.length > 0 && (
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
                    <Text style={{ color: colors.text.tertiary }} className="text-xs">Last {recentOrdersMobile.length} orders</Text>
                  </View>
                  <Pressable
                    onPress={() => router.push('/(tabs)/orders')}
                    className="flex-row items-center px-3 py-1.5 rounded-full active:opacity-70"
                    style={{ backgroundColor: colors.bg.secondary }}
                  >
                    <Text style={{ color: colors.text.primary }} className="text-xs font-semibold mr-1">View All</Text>
                    <ChevronRight size={14} color={colors.text.primary} strokeWidth={2} />
                  </Pressable>
                </View>
                {recentOrdersMobile.map((order, index) => (
                  <RecentOrderItem
                    key={order.id}
                    order={order}
                    productById={productById}
                    statusColorMap={orderStatusColorMap}
                    onPress={() => router.push(`/order/${order.id}`)}
                    isLast={index === recentOrdersMobile.length - 1}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Most Sold Products - Mobile */}
          {mostSoldProducts.length > 0 && (
            <View className="px-5 pt-6">
              <View
                className="rounded-2xl overflow-hidden"
                style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}
              >
                <View className="flex-row items-center p-4">
                  <View className="w-10 h-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: colors.bg.secondary }}>
                    <Package size={20} color={colors.text.primary} strokeWidth={2} />
                  </View>
                  <View className="flex-1">
                    <Text style={{ color: colors.text.primary }} className="font-bold text-base">Most Sold</Text>
                    <Text style={{ color: colors.text.tertiary }} className="text-xs">Top {Math.min(mostSoldProducts.length, 5)} products by quantity</Text>
                  </View>
                  <Pressable
                    onPress={() => router.push('/insights/best-sellers')}
                    className="flex-row items-center px-3 py-1.5 rounded-full active:opacity-70"
                    style={{ backgroundColor: colors.bg.secondary }}
                  >
                    <Text style={{ color: colors.text.primary }} className="text-xs font-semibold mr-1">View All</Text>
                    <ChevronRight size={14} color={colors.text.primary} strokeWidth={2} />
                  </Pressable>
                </View>
                <View style={{ borderTopWidth: 1, borderTopColor: colors.border.light }}>
                  {mostSoldProducts.slice(0, 5).map((row, idx, arr) => (
                    <Pressable
                      key={row.productId}
                      onPress={() => router.push(`/product/${row.productId}`)}
                      className="active:opacity-70"
                      style={{
                        borderBottomWidth: idx === arr.length - 1 ? 0 : 1,
                        borderBottomColor: colors.border.light,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 }}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ color: colors.text.primary }} className="text-sm font-semibold" numberOfLines={1}>
                            {row.name}
                          </Text>
                          <Text style={{ color: colors.text.tertiary }} className="text-xs mt-0.5" numberOfLines={1}>
                            {row.sku}
                          </Text>
                        </View>
                        <Text style={{ color: colors.text.primary }} className="text-base font-bold">
                          {row.quantity}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
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
                  className="flex-row items-center px-3 py-1.5 rounded-full active:opacity-70"
                  style={{ backgroundColor: colors.bg.secondary }}
                >
                  <Text style={{ color: colors.text.primary }} className="text-xs font-semibold mr-1">View All</Text>
                  <ChevronRight size={14} color={colors.text.primary} strokeWidth={2} />
                </Pressable>
              </View>
              {platformData.length === 0 ? (
                <Text style={{ color: colors.text.muted }} className="text-sm text-center py-4">No orders yet</Text>
              ) : (
                platformData.slice(0, 4).map((item) => (
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
                ))
              )}
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
