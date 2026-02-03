import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Platform, Linking, Modal } from 'react-native';
import { ArrowLeft, User as UserIcon, Phone, Mail, MapPin, Edit2, Trash2, ShoppingCart, Calendar } from 'lucide-react-native';
import useFyllStore, { Customer, formatCurrency } from '@/lib/state/fyll-store';
import useAuthStore from '@/lib/state/auth-store';
import { useThemeColors } from '@/lib/theme';
import { DetailSection, DetailKeyValue, DetailActionButton } from './SplitViewLayout';
import * as Haptics from 'expo-haptics';
import { useBreakpoint } from '@/lib/useBreakpoint';

interface CustomerDetailPanelProps {
  customerId: string;
  onEdit?: (customer: Customer) => void;
  onClose?: () => void;
}

export function CustomerDetailPanel({ customerId, onEdit, onClose }: CustomerDetailPanelProps) {
  const colors = useThemeColors();
  const isDark = colors.bg.primary === '#111111';
  const { isMobile } = useBreakpoint();

  const customers = useFyllStore((s) => s.customers);
  const orders = useFyllStore((s) => s.orders);
  const deleteCustomer = useFyllStore((s) => s.deleteCustomer);
  const businessId = useAuthStore((s) => s.businessId ?? s.currentUser?.businessId ?? null);
  const [showDeletePrompt, setShowDeletePrompt] = useState(false);

  const customer = useMemo(() => customers.find((c) => c.id === customerId), [customers, customerId]);

  // Get orders for this customer
  const customerOrders = useMemo(() => {
    if (!customer) return [];
    return orders.filter((o) =>
      o.customerName.toLowerCase() === customer.fullName.toLowerCase() ||
      (o.customerEmail && customer.email && o.customerEmail.toLowerCase() === customer.email.toLowerCase()) ||
      (o.customerPhone && customer.phone && o.customerPhone === customer.phone)
    ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, customer]);

  // Calculate total spent
  const totalSpent = useMemo(() => {
    return customerOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  }, [customerOrders]);

  if (!customer) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <UserIcon size={48} color={colors.text.muted} strokeWidth={1.5} />
        <Text style={{ color: colors.text.muted, fontSize: 16, marginTop: 16 }}>
          Select a customer to view details
        </Text>
      </View>
    );
  }

  const handleDelete = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    if (Platform.OS === 'web') {
      const active = typeof document !== 'undefined' ? document.activeElement : null;
      if (active instanceof HTMLElement) {
        active.blur();
      }
    }
    setShowDeletePrompt(true);
  };

  const confirmDelete = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    deleteCustomer(customer.id, businessId);
    setShowDeletePrompt(false);
    onClose?.();
  };

  const customerSinceTimestamp = customerOrders.length
    ? Math.min(...customerOrders.map((order) => new Date(order.orderDate ?? order.createdAt).getTime()))
    : new Date(customer.createdAt ?? Date.now()).getTime();
  const createdDate = new Date(customerSinceTimestamp).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <View style={{ flex: 1 }}>
      {isMobile && onClose && (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12 }}>
          <Pressable
            onPress={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: colors.bg.secondary,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <ArrowLeft size={18} color={colors.text.primary} strokeWidth={2} />
          </Pressable>
          <Text
            style={{ color: colors.text.primary, fontSize: 16, fontWeight: '700', flex: 1 }}
            numberOfLines={1}
          >
            {customer.fullName}
          </Text>
        </View>
      )}

      {/* Customer Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, alignItems: 'center' }}>
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <UserIcon size={40} color="#10B981" strokeWidth={1.5} />
        </View>
        <Text style={{ color: colors.text.primary, fontSize: 24, fontWeight: '700', textAlign: 'center' }}>
          {customer.fullName}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
          <Calendar size={12} color={colors.text.muted} strokeWidth={2} />
          <Text style={{ color: colors.text.muted, fontSize: 13, marginLeft: 4 }}>
            Customer since {createdDate}
          </Text>
        </View>
      </View>

      {/* Stats */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingTop: 20, gap: 12 }}>
        <View
          style={{
            flex: 1,
            backgroundColor: colors.bg.card,
            borderRadius: 16,
            padding: 14,
            borderWidth: 1,
            borderColor: colors.border.light,
          }}
        >
          <Text style={{ color: colors.text.tertiary, fontSize: 12, fontWeight: '500' }}>Total Orders</Text>
          <Text style={{ color: colors.text.primary, fontSize: 24, fontWeight: '700', marginTop: 4 }}>
            {customerOrders.length}
          </Text>
        </View>
        <View
          style={{
            flex: 1,
            backgroundColor: colors.bg.card,
            borderRadius: 16,
            padding: 14,
            borderWidth: 1,
            borderColor: colors.border.light,
          }}
        >
          <Text style={{ color: colors.text.tertiary, fontSize: 12, fontWeight: '500' }}>Total Spent</Text>
          <Text style={{ color: '#10B981', fontSize: 24, fontWeight: '700', marginTop: 4 }}>
            {formatCurrency(totalSpent)}
          </Text>
        </View>
      </View>

      {/* Contact Info */}
      <DetailSection title="Contact">
        {customer.phone && (
          <Pressable
            onPress={() => Linking.openURL(`tel:${customer.phone}`)}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: colors.bg.secondary,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <Phone size={16} color={colors.text.tertiary} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text.muted, fontSize: 11 }}>Phone</Text>
              <Text style={{ color: colors.text.primary, fontSize: 15, fontWeight: '500' }}>{customer.phone}</Text>
            </View>
          </Pressable>
        )}

        {customer.email && (
          <Pressable
            onPress={() => Linking.openURL(`mailto:${customer.email}`)}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: customer.phone ? 1 : 0, borderTopColor: colors.border.light }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: colors.bg.secondary,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <Mail size={16} color={colors.text.tertiary} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text.muted, fontSize: 11 }}>Email</Text>
              <Text style={{ color: colors.text.primary, fontSize: 15, fontWeight: '500' }}>{customer.email}</Text>
            </View>
          </Pressable>
        )}

        {!customer.phone && !customer.email && (
          <Text style={{ color: colors.text.muted, fontSize: 14, textAlign: 'center', paddingVertical: 12 }}>
            No contact information
          </Text>
        )}
      </DetailSection>

      {/* Default Address */}
      {(customer.defaultAddress || customer.defaultState) && (
        <DetailSection title="Default Delivery Address">
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <MapPin size={16} color={colors.text.tertiary} strokeWidth={2} style={{ marginTop: 2 }} />
            <Text style={{ color: colors.text.secondary, fontSize: 14, marginLeft: 10, flex: 1, lineHeight: 20 }}>
              {customer.defaultAddress}
              {customer.defaultAddress && customer.defaultState ? ', ' : ''}
              {customer.defaultState}
            </Text>
          </View>
        </DetailSection>
      )}

      {/* Recent Orders */}
      {customerOrders.length > 0 && (
        <DetailSection title={`Recent Orders (${customerOrders.length})`}>
          {customerOrders.slice(0, 5).map((order, index) => {
            const orderDate = new Date(order.orderDate ?? order.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            });
            return (
              <View
                key={order.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 10,
                  borderTopWidth: index > 0 ? 1 : 0,
                  borderTopColor: colors.border.light,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: colors.bg.secondary,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <ShoppingCart size={16} color={colors.text.tertiary} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '600' }}>{order.orderNumber}</Text>
                  <Text style={{ color: colors.text.muted, fontSize: 12 }}>{orderDate} · {order.status}</Text>
                </View>
                <Text style={{ color: colors.text.primary, fontSize: 15, fontWeight: '700' }}>
                  {formatCurrency(order.totalAmount)}
                </Text>
              </View>
            );
          })}
        </DetailSection>
      )}

      {/* Actions */}
      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, gap: 12 }}>
        {onEdit && (
          <DetailActionButton
            label="Edit Customer"
            icon={<Edit2 size={18} color={isDark ? '#000000' : '#FFFFFF'} strokeWidth={2} />}
            onPress={() => onEdit(customer)}
          />
        )}
        <DetailActionButton
          label="Delete Customer"
          icon={<Trash2 size={18} color="#EF4444" strokeWidth={2} />}
          onPress={handleDelete}
          variant="danger"
        />
      </View>

      <Modal
        visible={showDeletePrompt}
        animationType="fade"
        transparent
        onRequestClose={() => setShowDeletePrompt(false)}
      >
        <Pressable
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          onPress={() => setShowDeletePrompt(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="w-[90%] rounded-2xl overflow-hidden"
            style={{ backgroundColor: colors.bg.primary, maxWidth: 360 }}
          >
            <View className="px-5 py-4" style={{ borderBottomWidth: 1, borderBottomColor: colors.border.light }}>
              <Text style={{ color: colors.text.primary }} className="font-bold text-lg">Delete Customer</Text>
              <Text style={{ color: colors.text.tertiary }} className="text-sm mt-1">
                {`Delete ${customer.fullName}?`}
              </Text>
            </View>
            <View className="px-5 py-4 flex-row gap-3">
              <Pressable
                onPress={() => setShowDeletePrompt(false)}
                className="flex-1 rounded-xl items-center"
                style={{ backgroundColor: colors.bg.secondary, height: 48, justifyContent: 'center' }}
              >
                <Text style={{ color: colors.text.tertiary }} className="font-medium">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={confirmDelete}
                className="flex-1 rounded-xl items-center"
                style={{ backgroundColor: '#EF4444', height: 48, justifyContent: 'center' }}
              >
                <Text className="text-white font-semibold">Delete</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
