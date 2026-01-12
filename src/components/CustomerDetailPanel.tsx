import React, { useMemo } from 'react';
import { View, Text, Pressable, Platform, Linking, Alert } from 'react-native';
import { User, Phone, Mail, MapPin, Edit2, Trash2, ShoppingCart, Calendar } from 'lucide-react-native';
import useFyllStore, { Customer, formatCurrency } from '@/lib/state/fyll-store';
import { useThemeColors } from '@/lib/theme';
import { DetailSection, DetailKeyValue, DetailActionButton } from './SplitViewLayout';
import * as Haptics from 'expo-haptics';

interface CustomerDetailPanelProps {
  customerId: string;
  onEdit?: (customer: Customer) => void;
  onClose?: () => void;
}

export function CustomerDetailPanel({ customerId, onEdit, onClose }: CustomerDetailPanelProps) {
  const colors = useThemeColors();
  const isDark = colors.bg.primary === '#111111';

  const customers = useFyllStore((s) => s.customers);
  const orders = useFyllStore((s) => s.orders);
  const deleteCustomer = useFyllStore((s) => s.deleteCustomer);

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
        <User size={48} color={colors.text.muted} strokeWidth={1.5} />
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
    Alert.alert(
      'Delete Customer',
      `Are you sure you want to delete "${customer.fullName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }
            deleteCustomer(customer.id);
            onClose?.();
          },
        },
      ]
    );
  };

  const createdDate = new Date(customer.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <View style={{ flex: 1 }}>
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
          <User size={40} color="#10B981" strokeWidth={1.5} />
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
            const orderDate = new Date(order.createdAt).toLocaleDateString('en-US', {
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
    </View>
  );
}
