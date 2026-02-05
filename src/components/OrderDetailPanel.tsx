import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Platform,
  Linking,
  Modal,
  KeyboardAvoidingView,
  ScrollView,
  TextInput,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Package, Edit2, Phone, Mail, MapPin, Calendar, Tag, CreditCard, Truck, RefreshCcw, Printer, Trash2, FileText, Camera, ChevronRight, X, User as UserIcon } from 'lucide-react-native';
import useFyllStore, { Case, formatCurrency, Refund } from '@/lib/state/fyll-store';
import useAuthStore from '@/lib/state/auth-store';
import { useThemeColors } from '@/lib/theme';
import { DetailSection, DetailKeyValue, DetailActionButton } from './SplitViewLayout';
import { Button } from '@/components/Button';
import * as Haptics from 'expo-haptics';
import { CaseForm } from '@/components/CaseForm';
import * as ImagePicker from 'expo-image-picker';
import { compressImage } from '@/lib/image-compression';
import DateTimePicker from '@react-native-community/datetimepicker';

interface OrderDetailPanelProps {
  orderId: string;
  onClose?: () => void;
}

const formatLogisticsDate = (dateString?: string) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export function OrderDetailPanel({ orderId, onClose }: OrderDetailPanelProps) {
  const colors = useThemeColors();
  const isDark = colors.bg.primary === '#111111';
  const router = useRouter();

  const orders = useFyllStore((s) => s.orders);
  const products = useFyllStore((s) => s.products);
  const orderStatuses = useFyllStore((s) => s.orderStatuses);
  const cases = useFyllStore((s) => s.cases);
  const addCase = useFyllStore((s) => s.addCase);
  const updateCase = useFyllStore((s) => s.updateCase);
  const updateOrder = useFyllStore((s) => s.updateOrder);
  const deleteOrder = useFyllStore((s) => s.deleteOrder);
  const currentUser = useAuthStore((s) => s.currentUser);
  const businessId = useAuthStore((s) => s.businessId ?? s.currentUser?.businessId ?? null);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [editingCase, setEditingCase] = useState<Case | null>(null);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundDate, setRefundDate] = useState(new Date());
  const [refundReason, setRefundReason] = useState('');
  const [refundProofUri, setRefundProofUri] = useState('');
  const [showRefundDatePicker, setShowRefundDatePicker] = useState(false);

  // Business settings for label printing

  const order = useMemo(() => orders.find((o) => o.id === orderId), [orders, orderId]);

  const statusColor = useMemo(() => {
    const status = orderStatuses.find((s) => s.name === order?.status);
    return status?.color || '#6B7280';
  }, [orderStatuses, order?.status]);

  const orderCases = useMemo(() => {
    return cases.filter((caseItem) => caseItem.orderId === order?.id);
  }, [cases, order?.id]);

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

  const orderDateSource = order.orderDate ?? order.createdAt;
  const orderDate = new Date(orderDateSource).toLocaleDateString('en-US', {
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
    router.push(`/order-edit/${order.id}`);
  };

  const handleCreateCase = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setEditingCase(null);
    setShowCaseForm(true);
  };

  const handleSaveCase = async (caseData: Case) => {
    if (editingCase) {
      await updateCase(caseData.id, caseData, businessId);
    } else {
      await addCase(caseData, businessId);
    }
  };

  const handleDelete = () => {
    if (Platform.OS === 'web') {
      const active = document.activeElement as HTMLElement | null;
      active?.blur();
    }
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setPendingDelete(true);
  };

  const confirmDelete = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    deleteOrder(order.id, businessId);
    setPendingDelete(false);
    onClose?.();
  };

  const hasRefund = order.refund?.amount != null && order.refund.amount > 0;

  const handleOpenRefund = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (hasRefund) {
      setRefundAmount(String(order.refund?.amount ?? ''));
      if (order.refund?.date) {
        setRefundDate(new Date(order.refund.date));
      }
      setRefundReason(order.refund?.reason || '');
      setRefundProofUri(order.refund?.proofImageUri || '');
    } else {
      setRefundAmount(String(order.totalAmount));
      setRefundDate(new Date());
      setRefundReason('');
      setRefundProofUri('');
    }
    setShowRefundModal(true);
  };

  const handlePickRefundProof = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const compressedUri = await compressImage(result.assets[0].uri);
      setRefundProofUri(compressedUri);
    }
  };

  const handleSaveRefund = () => {
    if (!refundAmount || parseFloat(refundAmount) <= 0) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const refund: Refund = {
      id: order.refund?.id || Math.random().toString(36).substring(2, 15),
      orderId: order.id,
      amount: parseFloat(refundAmount),
      date: refundDate.toISOString(),
      reason: refundReason.trim(),
      proofImageUri: refundProofUri || undefined,
      createdAt: order.refund?.createdAt || new Date().toISOString(),
    };
    updateOrder(
      order.id,
      { refund, status: 'Refunded', updatedBy: currentUser?.name, updatedAt: new Date().toISOString() },
      businessId
    );
    setShowRefundModal(false);
  };

  const handlePrintLabel = () => {
    router.push(`/order-label-preview?orderId=${order.id}`);
  };

  const handleUpdateStatus = (newStatus: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    updateOrder(order.id, { status: newStatus, updatedAt: new Date().toISOString() }, businessId);
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
          <Pressable
            onPress={() => setShowStatusModal(true)}
            className="active:opacity-80"
            style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: badgeBgColor }}
          >
            <Text style={{ color: badgeTextColor, fontSize: 13, fontWeight: '600' }}>
              {displayStatus}
            </Text>
          </Pressable>
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
      <DetailSection title="Logistics">
        <View className="flex-row items-center justify-end mb-3">
          <Pressable
            onPress={handleEdit}
            className="px-4 py-1.5 rounded-full active:opacity-70"
            style={{ backgroundColor: '#111111' }}
          >
            <Text style={{ color: '#FFFFFF' }} className="text-sm font-medium">
              {order.logistics ? 'Edit' : 'Add'}
            </Text>
          </Pressable>
        </View>
        {order.logistics ? (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Truck size={16} color={colors.text.primary} strokeWidth={2} />
              <Text style={{ color: colors.text.primary, fontSize: 15, fontWeight: '600', marginLeft: 8 }}>
                {order.logistics.carrierName}
              </Text>
            </View>
            {order.logistics.trackingNumber && (
              <View style={{ backgroundColor: colors.bg.secondary, borderRadius: 10, padding: 12, marginBottom: 10 }}>
                <Text style={{ color: colors.text.muted, fontSize: 11, marginBottom: 4 }}>Tracking Number</Text>
                <Text style={{ color: colors.text.primary, fontSize: 14, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
                  {order.logistics.trackingNumber}
                </Text>
              </View>
            )}
            {(() => {
              const logisticsDate = order.logistics?.datePickedUp ?? order.logistics?.dispatchDate;
              if (!logisticsDate) return null;
              const logisticsLabel = order.logistics?.datePickedUp ? 'Picked up' : 'Dispatched';
              return (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Calendar size={14} color={colors.text.tertiary} strokeWidth={2} />
                  <Text style={{ color: colors.text.secondary, fontSize: 13, marginLeft: 8 }}>
                    {logisticsLabel} {formatLogisticsDate(logisticsDate)}
                  </Text>
                </View>
              );
            })()}
          </View>
        ) : (
          <View className="items-center py-3">
            <Truck size={20} color={colors.text.muted} strokeWidth={1.5} />
            <Text style={{ color: colors.text.muted }} className="text-sm mt-2">No logistics info yet</Text>
          </View>
        )}
      </DetailSection>

      {/* Prescription */}
      <DetailSection title="Prescription">
        <View className="flex-row items-center justify-end mb-3">
          <Pressable
            onPress={handleEdit}
            className="px-4 py-1.5 rounded-full active:opacity-70"
            style={{ backgroundColor: '#111111' }}
          >
            <Text style={{ color: '#FFFFFF' }} className="text-sm font-medium">
              {order.prescription ? 'Edit' : 'Add'}
            </Text>
          </Pressable>
        </View>
        {order.prescription?.fileUrl || order.prescription?.text ? (
          <View>
            {order.prescription?.fileUrl && (
              <View style={{ backgroundColor: colors.bg.secondary, borderRadius: 10, padding: 12, marginBottom: 10 }}>
                <Text style={{ color: colors.text.muted, fontSize: 11, marginBottom: 4 }}>File</Text>
                <Text style={{ color: colors.text.primary, fontSize: 13 }} numberOfLines={1}>
                  Prescription file attached
                </Text>
              </View>
            )}
            {order.prescription?.text && (
              <View style={{ backgroundColor: colors.bg.secondary, borderRadius: 10, padding: 12 }}>
                <Text style={{ color: colors.text.muted, fontSize: 11, marginBottom: 6 }}>Notes</Text>
                <Text style={{ color: colors.text.primary, fontSize: 13 }} numberOfLines={4}>
                  {order.prescription.text}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View className="items-center py-3">
            <FileText size={20} color={colors.text.muted} strokeWidth={1.5} />
            <Text style={{ color: colors.text.muted }} className="text-sm mt-2">No prescription added</Text>
          </View>
        )}
      </DetailSection>

      {/* Refund */}
      <DetailSection title="Refund">
        <View className="flex-row items-center justify-end mb-3">
          <Pressable
            onPress={handleOpenRefund}
            className="px-4 py-1.5 rounded-full active:opacity-80"
            style={{
              backgroundColor: hasRefund ? 'rgba(239, 68, 68, 0.12)' : '#111111',
            }}
          >
            <Text style={{ color: hasRefund ? '#EF4444' : '#FFFFFF' }} className="text-sm font-medium">
              {hasRefund ? 'View Refund' : 'Process Refund'}
            </Text>
          </Pressable>
        </View>
        {hasRefund ? (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
              <Text style={{ color: colors.text.tertiary }} className="text-sm">Amount Refunded</Text>
              <Text className="text-red-500 font-bold text-base">{formatCurrency(order.refund?.amount ?? 0)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
              <Calendar size={14} color={colors.text.tertiary} strokeWidth={2} />
              <Text style={{ color: colors.text.secondary, fontSize: 13, marginLeft: 8 }}>
                {order.refund?.date
                  ? new Date(order.refund.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : ''}
              </Text>
            </View>
            {order.refund?.reason && (
              <View style={{ backgroundColor: colors.bg.secondary, borderRadius: 10, padding: 10, marginTop: 8 }}>
                <Text style={{ color: colors.text.muted, fontSize: 11, marginBottom: 4 }}>Reason</Text>
                <Text style={{ color: colors.text.primary, fontSize: 13 }}>{order.refund.reason}</Text>
              </View>
            )}
          </View>
        ) : (
          <View className="items-center py-3">
            <RefreshCcw size={20} color={colors.text.muted} strokeWidth={1.5} />
            <Text style={{ color: colors.text.muted }} className="text-sm mt-2">No refund processed</Text>
          </View>
        )}
      </DetailSection>

      {/* Refund Modal */}
      <Modal
        visible={showRefundModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowRefundModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <Pressable
            className="flex-1 items-center justify-center"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
            onPress={() => setShowRefundModal(false)}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              className="w-[90%] rounded-2xl overflow-hidden"
              style={{ backgroundColor: colors.bg.primary, maxHeight: '85%', maxWidth: 400 }}
            >
              <View className="flex-row items-center justify-between px-5 py-4" style={{ borderBottomWidth: 1, borderBottomColor: colors.border.light }}>
                <Text style={{ color: colors.text.primary }} className="font-bold text-lg">Process Refund</Text>
                <Pressable
                  onPress={() => setShowRefundModal(false)}
                  className="w-8 h-8 rounded-full items-center justify-center active:opacity-50"
                  style={{ backgroundColor: colors.bg.secondary }}
                >
                  <X size={18} color={colors.text.tertiary} strokeWidth={2} />
                </Pressable>
              </View>

              <ScrollView className="px-5 py-4" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View className="mb-4">
                  <Text style={{ color: colors.text.primary }} className="text-sm font-medium mb-2">Refund Amount *</Text>
                  <View className="rounded-xl px-4 flex-row items-center" style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 52 }}>
                    <Text style={{ color: colors.input.placeholder, fontSize: 14, marginRight: 4 }}>₦</Text>
                    <TextInput
                      placeholder="0"
                      placeholderTextColor={colors.input.placeholder}
                      value={refundAmount}
                      onChangeText={setRefundAmount}
                      keyboardType="decimal-pad"
                      style={{ color: colors.input.text, fontSize: 14, flex: 1 }}
                      selectionColor={colors.text.primary}
                    />
                  </View>
                  <Text style={{ color: colors.text.muted }} className="text-xs mt-1">Order total: {formatCurrency(order.totalAmount)}</Text>
                </View>

                <View className="mb-4">
                  <Text style={{ color: colors.text.primary }} className="text-sm font-medium mb-2">Refund Date *</Text>
                  {Platform.OS === 'web' ? (
                    <View
                      className="rounded-xl px-4 flex-row items-center"
                      style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 52 }}
                    >
                      <input
                        type="date"
                        value={refundDate.toISOString().split('T')[0]}
                        onChange={(e) => {
                          const dateValue = e.target.value;
                          if (dateValue) {
                            const [year, month, day] = dateValue.split('-').map(Number);
                            const newDate = new Date(year, month - 1, day, 12, 0, 0);
                            setRefundDate(newDate);
                          }
                        }}
                        style={{
                          width: '100%',
                          height: '100%',
                          fontSize: 14,
                          color: colors.input.text,
                          backgroundColor: 'transparent',
                          border: 'none',
                          outline: 'none',
                        }}
                      />
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => setShowRefundDatePicker(true)}
                      className="rounded-xl px-4 flex-row items-center justify-between"
                      style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 52 }}
                    >
                      <Text style={{ color: colors.input.text }}>
                        {refundDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                      <Calendar size={18} color={colors.text.tertiary} strokeWidth={2} />
                    </Pressable>
                  )}
                </View>

                <View className="mb-4">
                  <Text style={{ color: colors.text.primary }} className="text-sm font-medium mb-2">Reason</Text>
                  <View className="rounded-xl px-4 py-3" style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, minHeight: 80 }}>
                    <TextInput
                      placeholder="Enter refund reason"
                      placeholderTextColor={colors.input.placeholder}
                      value={refundReason}
                      onChangeText={setRefundReason}
                      multiline
                      numberOfLines={3}
                      style={{ color: colors.input.text, fontSize: 14, textAlignVertical: 'top' }}
                      selectionColor={colors.text.primary}
                    />
                  </View>
                </View>

                <View className="mb-4">
                  <Text style={{ color: colors.text.primary }} className="text-sm font-medium mb-2">Proof (Screenshot of Transfer)</Text>
                  {refundProofUri ? (
                    <View className="rounded-xl overflow-hidden relative" style={{ borderWidth: 1, borderColor: colors.border.light }}>
                      <Image source={{ uri: refundProofUri }} style={{ width: '100%', height: 150 }} resizeMode="cover" />
                      <Pressable
                        onPress={() => setRefundProofUri('')}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full items-center justify-center active:opacity-70"
                        style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
                      >
                        <X size={16} color="#FFFFFF" strokeWidth={2} />
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      onPress={handlePickRefundProof}
                      className="rounded-xl items-center justify-center py-6 active:opacity-70"
                      style={{ backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.light, borderStyle: 'dashed' }}
                    >
                      <Camera size={24} color={colors.text.tertiary} strokeWidth={1.5} />
                      <Text style={{ color: colors.text.tertiary }} className="text-sm mt-2">Upload proof image</Text>
                    </Pressable>
                  )}
                </View>

                <Button
                  onPress={handleSaveRefund}
                  disabled={!refundAmount || parseFloat(refundAmount) <= 0}
                  variant="danger"
                  className="mb-4"
                >
                  Process Refund
                </Button>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {Platform.OS !== 'web' && showRefundDatePicker && (
        <Modal
          visible={showRefundDatePicker}
          animationType="fade"
          transparent
          onRequestClose={() => setShowRefundDatePicker(false)}
        >
          <Pressable
            className="flex-1 items-center justify-center"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
            onPress={() => setShowRefundDatePicker(false)}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              className="w-[90%] rounded-2xl overflow-hidden"
              style={{ backgroundColor: '#FFFFFF', maxWidth: 400 }}
            >
              <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-200">
                <Text className="text-gray-900 font-bold text-lg">Select Refund Date</Text>
                <Pressable
                  onPress={() => setShowRefundDatePicker(false)}
                  className="w-8 h-8 rounded-full items-center justify-center active:opacity-50 bg-gray-100"
                >
                  <X size={18} color="#666666" strokeWidth={2} />
                </Pressable>
              </View>
              <View className="p-4 items-center">
                <DateTimePicker
                  value={refundDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, date) => {
                    if (Platform.OS === 'android') {
                      setShowRefundDatePicker(false);
                    }
                    if (date) {
                      setRefundDate(date);
                    }
                  }}
                  style={{ width: '100%' }}
                  themeVariant="light"
                />
                {Platform.OS === 'ios' && (
                  <View className="flex-row w-full gap-3 mt-4">
                    <Pressable
                      onPress={() => {
                        setRefundDate(new Date());
                        setShowRefundDatePicker(false);
                      }}
                      className="flex-1 py-3 rounded-full items-center"
                      style={{ backgroundColor: '#F1F5F9' }}
                    >
                      <Text className="font-semibold" style={{ color: '#1F2937' }}>Today</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setShowRefundDatePicker(false)}
                      className="flex-1 py-3 rounded-full items-center"
                      style={{ backgroundColor: '#111111' }}
                    >
                      <Text className="font-semibold" style={{ color: '#FFFFFF' }}>Done</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* Cases */}
      <DetailSection title="Cases">
        <View className="flex-row items-center justify-between mb-3">
          <Text style={{ color: colors.text.primary }} className="text-sm font-semibold">
            Linked Cases
          </Text>
          <Pressable
            onPress={handleCreateCase}
            className="px-4 py-1.5 rounded-full active:opacity-70"
            style={{ backgroundColor: '#111111' }}
          >
            <Text style={{ color: '#FFFFFF' }} className="text-sm font-medium">Create Case</Text>
          </Pressable>
        </View>

        {orderCases.length > 0 ? (
          <View className="gap-2">
            {orderCases.map((caseItem) => (
              <Pressable
                key={caseItem.id}
                onPress={() => router.push(`/case/${caseItem.id}`)}
                className="flex-row items-center justify-between rounded-2xl px-4 py-3"
                style={{ backgroundColor: colors.bg.secondary }}
              >
                <Text style={{ color: colors.text.primary, fontWeight: '600' }}>{caseItem.caseNumber}</Text>
                <ChevronRight size={18} color={colors.text.tertiary} strokeWidth={2} />
              </Pressable>
            ))}
          </View>
        ) : (
          <View className="items-center py-4">
            <FileText size={22} color={colors.text.muted} strokeWidth={1.5} />
            <Text style={{ color: colors.text.muted }} className="text-sm mt-2">No cases yet</Text>
          </View>
        )}
      </DetailSection>

      {/* Staff Activity */}
      {(order.createdBy || order.updatedBy || (order.activityLog && order.activityLog.length > 0)) && (
        <DetailSection title="Staff Activity">
          {/* Created by entry */}
          {order.createdBy && (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border.light }}>
              <UserIcon size={14} color={colors.text.tertiary} strokeWidth={2} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '500' }}>{order.createdBy}</Text>
                <Text style={{ color: colors.text.muted, fontSize: 11 }}>Created order</Text>
                <Text style={{ color: colors.text.tertiary, fontSize: 10, marginTop: 1 }}>
                  {new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(order.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          )}
          {/* Activity log entries */}
          {order.activityLog?.map((entry, index) => (
            <View
              key={`${entry.date}-${index}`}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                paddingVertical: 6,
                borderBottomWidth: index < (order.activityLog?.length ?? 0) - 1 ? 1 : 0,
                borderBottomColor: colors.border.light,
              }}
            >
              <UserIcon size={14} color={colors.text.tertiary} strokeWidth={2} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '500' }}>{entry.staffName}</Text>
                <Text style={{ color: colors.text.muted, fontSize: 11 }}>{entry.action}</Text>
                <Text style={{ color: colors.text.tertiary, fontSize: 10, marginTop: 1 }}>
                  {new Date(entry.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(entry.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          ))}
          {/* Fallback: show updatedBy if no activity log yet */}
          {!order.activityLog?.length && order.updatedBy && (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6 }}>
              <UserIcon size={14} color={colors.text.tertiary} strokeWidth={2} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '500' }}>{order.updatedBy}</Text>
                <Text style={{ color: colors.text.muted, fontSize: 11 }}>Last updated</Text>
                {order.updatedAt && (
                  <Text style={{ color: colors.text.tertiary, fontSize: 10, marginTop: 1 }}>
                    {new Date(order.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(order.updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                )}
              </View>
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
            borderRadius: 999,
            backgroundColor: '#111111',
          }}
        >
          <Printer size={18} color="#FFFFFF" strokeWidth={2} />
          <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '600', marginLeft: 8 }}>
            Print Shipping Label
          </Text>
        </Pressable>
        <DetailActionButton
          label="Edit Order"
          icon={<Edit2 size={18} color={isDark ? '#000000' : '#FFFFFF'} strokeWidth={2} />}
          onPress={handleEdit}
        />
        <Pressable
          onPress={handleDelete}
          className="rounded-full items-center justify-center active:opacity-80"
          style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', height: 48 }}
        >
          <View className="flex-row items-center">
            <Trash2 size={18} color="#EF4444" strokeWidth={2} />
            <Text style={{ color: '#EF4444', fontSize: 15, fontWeight: '600', marginLeft: 8 }}>
              Delete Order
            </Text>
          </View>
        </Pressable>
      </View>

      <Modal
        visible={showStatusModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowStatusModal(false)}
      >
        <Pressable
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          onPress={() => setShowStatusModal(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="w-[90%] rounded-2xl overflow-hidden"
            style={{ backgroundColor: colors.bg.primary, maxWidth: 360 }}
          >
            <View className="px-5 py-4" style={{ borderBottomWidth: 1, borderBottomColor: colors.border.light }}>
              <Text style={{ color: colors.text.primary }} className="font-bold text-lg">Update Status</Text>
              <Text style={{ color: colors.text.tertiary }} className="text-sm mt-1">
                Tap a status to update this order.
              </Text>
            </View>
            <View className="px-5 py-4" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {orderStatuses.map((status) => {
                const isSelected = order.status === status.name;
                return (
                  <Pressable
                    key={status.id}
                    onPress={() => {
                      handleUpdateStatus(status.name);
                      setShowStatusModal(false);
                    }}
                    className="rounded-full px-3 py-2 active:opacity-80"
                    style={isSelected ? { backgroundColor: status.color } : { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.light }}
                  >
                    <Text style={{ color: isSelected ? '#FFFFFF' : colors.text.secondary }} className="text-sm font-semibold">
                      {status.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={pendingDelete}
        animationType="fade"
        transparent
        onRequestClose={() => setPendingDelete(false)}
      >
        <Pressable
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          onPress={() => setPendingDelete(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="w-[90%] rounded-2xl overflow-hidden"
            style={{ backgroundColor: colors.bg.primary, maxWidth: 360 }}
          >
            <View className="px-5 py-4" style={{ borderBottomWidth: 1, borderBottomColor: colors.border.light }}>
              <Text style={{ color: colors.text.primary }} className="font-bold text-lg">Delete Order</Text>
              <Text style={{ color: colors.text.tertiary }} className="text-sm mt-1">
                {order.orderNumber ? `Delete ${order.orderNumber}?` : 'Delete this order?'}
              </Text>
            </View>
            <View className="px-5 py-4 flex-row gap-3">
              <Pressable
                onPress={() => setPendingDelete(false)}
                className="flex-1 rounded-full items-center"
                style={{ backgroundColor: colors.bg.secondary, height: 48, justifyContent: 'center' }}
              >
                <Text style={{ color: colors.text.tertiary }} className="font-medium">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={confirmDelete}
                className="flex-1 rounded-full items-center"
                style={{ backgroundColor: '#EF4444', height: 48, justifyContent: 'center' }}
              >
                <Text className="text-white font-semibold">Delete</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <CaseForm
        visible={showCaseForm}
        onClose={() => setShowCaseForm(false)}
        onSave={handleSaveCase}
        orderId={order.id}
        orderNumber={order.orderNumber}
        customerId={order.customerId}
        customerName={order.customerName}
        existingCase={editingCase ?? undefined}
        createdBy={currentUser?.name}
      />
    </View>
  );
}
