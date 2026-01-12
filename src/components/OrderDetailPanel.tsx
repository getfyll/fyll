import React, { useMemo } from 'react';
import { View, Text, Pressable, Platform, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Package, Edit2, Phone, Mail, MapPin, Calendar, Tag, CreditCard, Truck, RefreshCcw, Printer } from 'lucide-react-native';
import useFyllStore, { formatCurrency } from '@/lib/state/fyll-store';
import { useThemeColors } from '@/lib/theme';
import { DetailSection, DetailKeyValue, DetailActionButton } from './SplitViewLayout';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { printOrderLabel, prepareOrderLabelData } from '@/utils/printOrderLabel';
import * as Haptics from 'expo-haptics';

interface OrderDetailPanelProps {
  orderId: string;
  onClose?: () => void;
}

export function OrderDetailPanel({ orderId, onClose }: OrderDetailPanelProps) {
  const colors = useThemeColors();
  const router = useRouter();
  const isDark = colors.bg.primary === '#111111';

  const orders = useFyllStore((s) => s.orders);
  const products = useFyllStore((s) => s.products);
  const orderStatuses = useFyllStore((s) => s.orderStatuses);
  const updateOrder = useFyllStore((s) => s.updateOrder);

  // Business settings for label printing
  const { businessName, businessLogo, businessPhone, businessWebsite, returnAddress } = useBusinessSettings();

  const order = useMemo(() => orders.find((o) => o.id === orderId), [orders, orderId]);

  const statusColor = useMemo(() => {
    const status = orderStatuses.find((s) => s.name === order?.status);
    return status?.color || '#6B7280';
  }, [orderStatuses, order?.status]);

  if (!order) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <Package size={48} color={colors.text.muted} strokeWidth={1.5} />
        <Text style={{ color: colors.text.muted, fontSize: 16, marginTop: 16 }}>
          Select an order to view details
        </Text>
      </View>
    );
  }

  const orderDate = new Date(order.createdAt).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const getItemDetails = (item: typeof order.items[0]) => {
    const product = products.find((p) => p.id === item.productId);
    const variant = product?.variants.find((v) => v.id === item.variantId);
    const variantName = variant ? Object.values(variant.variableValues).join(' / ') : '';
    return { productName: product?.name || 'Unknown', variantName, sku: variant?.sku || '' };
  };

  const handleEdit = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push(`/order/${order.id}`);
  };

  const handlePrintLabel = async () => {
    const labelData = prepareOrderLabelData(order, {
      businessName,
      businessLogo,
      businessPhone,
      businessWebsite,
      returnAddress,
    });
    await printOrderLabel(labelData);
  };

  const handleUpdateStatus = (newStatus: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    updateOrder(order.id, { status: newStatus, updatedAt: new Date().toISOString() });
  };

  // Determine refund status
  const isRefunded = order.status === 'Refunded' || (order.refund && order.refund.amount > 0);
  const isFullRefund = order.refund && order.refund.amount >= order.totalAmount;
  const isPartialRefund = order.refund && order.refund.amount > 0 && order.refund.amount < order.totalAmount;

  let displayStatus = order.status;
  let badgeBgColor = `${statusColor}20`;
  let badgeTextColor = statusColor;

  if (isFullRefund) {
    displayStatus = 'Full Refund';
    badgeBgColor = 'rgba(239, 68, 68, 0.15)';
    badgeTextColor = '#EF4444';
  } else if (isPartialRefund) {
    displayStatus = 'Partial Refund';
    badgeBgColor = 'rgba(239, 68, 68, 0.15)';
    badgeTextColor = '#EF4444';
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Order Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ color: colors.text.primary, fontSize: 22, fontWeight: '700' }}>
            {order.orderNumber}
          </Text>
          <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: badgeBgColor }}>
            <Text style={{ color: badgeTextColor, fontSize: 13, fontWeight: '600' }}>
              {displayStatus}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Calendar size={14} color={colors.text.muted} strokeWidth={2} />
          <Text style={{ color: colors.text.muted, fontSize: 13, marginLeft: 6 }}>{orderDate}</Text>
        </View>
        {order.websiteOrderReference && (
          <Text style={{ color: colors.text.tertiary, fontSize: 12, marginTop: 4 }}>
            Website Ref: {order.websiteOrderReference}
          </Text>
        )}
      </View>

      {/* Customer Info */}
      <DetailSection title="Customer">
        <Text style={{ color: colors.text.primary, fontSize: 17, fontWeight: '600', marginBottom: 8 }}>
          {order.customerName}
        </Text>

        {order.customerPhone && (
          <Pressable
            onPress={() => Linking.openURL(`tel:${order.customerPhone}`)}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
          >
            <Phone size={14} color={colors.text.tertiary} strokeWidth={2} />
            <Text style={{ color: colors.text.secondary, fontSize: 14, marginLeft: 8 }}>{order.customerPhone}</Text>
          </Pressable>
        )}

        {order.customerEmail && (
          <Pressable
            onPress={() => Linking.openURL(`mailto:${order.customerEmail}`)}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
          >
            <Mail size={14} color={colors.text.tertiary} strokeWidth={2} />
            <Text style={{ color: colors.text.secondary, fontSize: 14, marginLeft: 8 }}>{order.customerEmail}</Text>
          </Pressable>
        )}

        {order.deliveryAddress && (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6 }}>
            <MapPin size={14} color={colors.text.tertiary} strokeWidth={2} style={{ marginTop: 2 }} />
            <Text style={{ color: colors.text.secondary, fontSize: 14, marginLeft: 8, flex: 1 }}>
              {order.deliveryAddress}
              {order.deliveryState && `, ${order.deliveryState}`}
            </Text>
          </View>
        )}
      </DetailSection>

      {/* Order Items */}
      <DetailSection title={`Items (${order.items.length})`}>
        {order.items.map((item, index) => {
          const { productName, variantName, sku } = getItemDetails(item);
          return (
            <View
              key={`${item.productId}-${item.variantId}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 10,
                borderTopWidth: index > 0 ? 1 : 0,
                borderTopColor: colors.border.light,
              }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.bg.secondary, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Package size={20} color={colors.text.tertiary} strokeWidth={1.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '600' }}>{productName}</Text>
                <Text style={{ color: colors.text.muted, fontSize: 12 }}>{variantName}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '700' }}>
                  {formatCurrency(item.unitPrice * item.quantity)}
                </Text>
                <Text style={{ color: colors.text.muted, fontSize: 11 }}>
                  {item.quantity} x {formatCurrency(item.unitPrice)}
                </Text>
              </View>
            </View>
          );
        })}

        {/* Totals */}
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border.light, marginTop: 8, paddingTop: 12 }}>
          <DetailKeyValue label="Subtotal" value={formatCurrency(order.subtotal)} />
          {order.deliveryFee > 0 && (
            <DetailKeyValue label="Delivery Fee" value={formatCurrency(order.deliveryFee)} />
          )}
          {order.discountAmount && order.discountAmount > 0 && (
            <DetailKeyValue
              label={`Discount${order.discountCode ? ` (${order.discountCode})` : ''}`}
              value={`-${formatCurrency(order.discountAmount)}`}
              valueColor="#10B981"
            />
          )}
          {order.refund && order.refund.amount > 0 && (
            <DetailKeyValue
              label="Refund"
              value={`-${formatCurrency(order.refund.amount)}`}
              valueColor="#EF4444"
            />
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, marginTop: 4, borderTopWidth: 1, borderTopColor: colors.border.light }}>
            <Text style={{ color: colors.text.primary, fontSize: 16, fontWeight: '600' }}>Total</Text>
            <Text style={{ color: colors.text.primary, fontSize: 20, fontWeight: '700' }}>
              {formatCurrency(order.refund && order.refund.amount > 0 ? order.totalAmount - order.refund.amount : order.totalAmount)}
            </Text>
          </View>
        </View>
      </DetailSection>

      {/* Payment & Source */}
      <DetailSection title="Payment">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Tag size={14} color={colors.text.tertiary} strokeWidth={2} />
            <Text style={{ color: colors.text.secondary, fontSize: 14, marginLeft: 8 }}>{order.source}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <CreditCard size={14} color={colors.text.tertiary} strokeWidth={2} />
            <Text style={{ color: colors.text.secondary, fontSize: 14, marginLeft: 8 }}>{order.paymentMethod || 'Not set'}</Text>
          </View>
        </View>
      </DetailSection>

      {/* Logistics */}
      {order.logistics && (
        <DetailSection title="Logistics">
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Truck size={16} color={colors.text.primary} strokeWidth={2} />
            <Text style={{ color: colors.text.primary, fontSize: 15, fontWeight: '600', marginLeft: 8 }}>
              {order.logistics.carrierName}
            </Text>
          </View>
          {order.logistics.trackingNumber && (
            <View style={{ backgroundColor: colors.bg.secondary, borderRadius: 10, padding: 12 }}>
              <Text style={{ color: colors.text.muted, fontSize: 11, marginBottom: 4 }}>Tracking Number</Text>
              <Text style={{ color: colors.text.primary, fontSize: 14, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
                {order.logistics.trackingNumber}
              </Text>
            </View>
          )}
        </DetailSection>
      )}

      {/* Update Status */}
      <DetailSection title="Update Status">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {orderStatuses.map((status) => {
            const isSelected = order.status === status.name;
            return (
              <Pressable
                key={status.id}
                onPress={() => handleUpdateStatus(status.name)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: isSelected ? status.color : colors.bg.secondary,
                  borderWidth: isSelected ? 0 : 1,
                  borderColor: colors.border.light,
                }}
              >
                <Text
                  style={{
                    color: isSelected ? '#FFFFFF' : colors.text.secondary,
                    fontSize: 13,
                    fontWeight: '600',
                  }}
                >
                  {status.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </DetailSection>

      {/* Actions */}
      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, gap: 12 }}>
        <Pressable
          onPress={handlePrintLabel}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            height: 48,
            borderRadius: 12,
            backgroundColor: '#111111',
          }}
        >
          <Printer size={18} color="#FFFFFF" strokeWidth={2} />
          <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '600', marginLeft: 8 }}>
            Print Shipping Label
          </Text>
        </Pressable>
        <DetailActionButton
          label="View Full Details"
          icon={<Edit2 size={18} color={isDark ? '#000000' : '#FFFFFF'} strokeWidth={2} />}
          onPress={handleEdit}
        />
      </View>
    </View>
  );
}
