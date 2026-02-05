import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Printer } from 'lucide-react-native';
import useFyllStore from '@/lib/state/fyll-store';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { OrderLabel80x90Preview } from '@/components/labels/OrderLabel80x90';
import { prepareOrderLabelData, printOrderLabel } from '@/utils/printOrderLabel';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '@/lib/theme';

export default function OrderLabelPreviewScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const orders = useFyllStore((s) => s.orders);
  const order = useMemo(() => orders.find((o) => o.id === orderId), [orders, orderId]);
  const {
    businessName,
    businessLogo,
    businessPhone,
    businessWebsite,
    returnAddress,
    isLoading,
  } = useBusinessSettings();
  const colors = useThemeColors();
  const [isPrinting, setIsPrinting] = useState(false);

  const labelData = useMemo(() => {
    if (!order) return null;
    return prepareOrderLabelData(
      {
        orderNumber: order.orderNumber,
        websiteOrderReference: order.websiteOrderReference,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        deliveryAddress: order.deliveryAddress,
        deliveryState: order.deliveryState,
        logistics: order.logistics,
      },
      {
        businessName: businessName || 'FYLL',
        businessLogo,
        businessPhone,
        businessWebsite,
        returnAddress,
      }
    );
  }, [order, businessName, businessLogo, businessPhone, businessWebsite, returnAddress]);

  // Inject print styles for web to hide everything except the label preview
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const styleId = 'order-label-print-styles';
      let styleEl = document.getElementById(styleId);

      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        styleEl.textContent = `
          @media print {
            body * {
              visibility: hidden !important;
            }
            .printable-order-label-container,
            .printable-order-label-container * {
              visibility: visible !important;
            }
            .printable-order-label-container {
              position: absolute !important;
              left: 50% !important;
              top: 50% !important;
              transform: translate(-50%, -50%) !important;
            }
          }
        `;
        document.head.appendChild(styleEl);
      }

      return () => {
        const el = document.getElementById(styleId);
        if (el) el.remove();
      };
    }
  }, []);

  const handlePrint = async () => {
    if (!labelData || isPrinting) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsPrinting(true);
    await printOrderLabel(labelData);
    setIsPrinting(false);
  };

  if (!order) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: colors.bg.primary }}>
        <Text style={{ color: colors.text.tertiary }} className="text-sm font-semibold">
          Order not found
        </Text>
        <Pressable onPress={() => router.back()} className="mt-3">
          <Text style={{ color: colors.accent.primary }} className="text-sm font-semibold">
            Go back
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border.light,
            backgroundColor: colors.bg.secondary,
          }}
        >
          <Pressable onPress={() => router.back()} className="mr-4 active:opacity-50">
            <ArrowLeft size={22} color={colors.text.primary} strokeWidth={2} />
          </Pressable>
          <View className="flex-1">
            <Text style={{ color: colors.text.primary }} className="font-bold text-lg">
              Shipping Label
            </Text>
            <Text style={{ color: colors.text.tertiary }} className="text-xs uppercase tracking-wider">
              Confirm before print • 80mm × 90mm
            </Text>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: 24, paddingHorizontal: 20, paddingBottom: 200 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="printable-order-label-container">
            <View className="items-center mb-6">
              {labelData && !isLoading ? (
                <OrderLabel80x90Preview data={labelData} />
              ) : (
                <View
                  className="rounded-2xl p-6"
                  style={{ backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.light }}
                >
                  <ActivityIndicator color={colors.accent.primary} size="small" />
                </View>
              )}
            </View>
          </View>

          <View
            className="rounded-2xl p-4 mb-4"
            style={{ backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.light }}
          >
            <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold tracking-wider mb-2">
              Recipient
            </Text>
            <Text style={{ color: colors.text.primary }} className="text-base font-semibold">
              {order.customerName}
            </Text>
            <Text style={{ color: colors.text.secondary }} className="text-sm">
              {order.customerPhone}
            </Text>
            <Text style={{ color: colors.text.secondary }} className="text-sm mt-2">
              {order.deliveryAddress}, {order.deliveryState}
            </Text>
          </View>

          <View
            className="rounded-2xl p-4"
            style={{ backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.light }}
          >
            <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold tracking-wider mb-2">
              Order
            </Text>
            <Text style={{ color: colors.text.primary }} className="text-sm">
              FYLL Ref: {order.orderNumber}
            </Text>
            {order.websiteOrderReference && (
              <Text style={{ color: colors.text.secondary }} className="text-sm mt-1">
                Customer Ref: {order.websiteOrderReference}
              </Text>
            )}
            {order.logistics?.carrierName && (
              <Text style={{ color: colors.text.secondary }} className="text-sm mt-1">
                Carrier: {order.logistics.carrierName}
              </Text>
            )}
          </View>
        </ScrollView>

        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: 20,
            paddingBottom: 32,
            paddingTop: 14,
            backgroundColor: colors.bg.primary,
            borderTopWidth: 1,
            borderTopColor: colors.border.light,
          }}
        >
          <Pressable
            onPress={handlePrint}
            className="rounded-full items-center justify-center"
            style={{ height: 56, backgroundColor: '#111111', opacity: isPrinting ? 0.7 : 1 }}
            disabled={isPrinting || !labelData}
          >
            {isPrinting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View className="flex-row items-center">
                <Printer size={18} color="#FFFFFF" strokeWidth={2} />
                <Text className="text-white font-semibold text-sm ml-2">Print Shipping Label</Text>
              </View>
            )}
          </Pressable>
          <Pressable
            onPress={() => router.back()}
            className="mt-3 rounded-full items-center justify-center"
            style={{ height: 52, backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.light }}
          >
            <Text style={{ color: colors.text.primary }} className="text-sm font-semibold">
              Cancel
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
