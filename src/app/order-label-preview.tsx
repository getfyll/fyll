import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Printer } from 'lucide-react-native';
import useFyllStore from '@/lib/state/fyll-store';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { OrderLabel80x90Preview } from '@/components/labels/OrderLabel80x90';
import {
  prepareOrderLabelData,
  printOrderLabel,
  SHIPPING_LABEL_SIZE_PRESETS,
} from '@/utils/printOrderLabel';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '@/lib/theme';

export default function OrderLabelPreviewScreen() {
  const router = useRouter();
  const { orderId, carrierName } = useLocalSearchParams<{ orderId: string; carrierName?: string }>();
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
  const isDark = colors.bg.primary === '#111111';
  const [isPrinting, setIsPrinting] = useState(false);
  const [selectedLabelSizeId, setSelectedLabelSizeId] = useState<string>('4x6');
  const selectedLabelSizePreset = useMemo(
    () => SHIPPING_LABEL_SIZE_PRESETS.find((preset) => preset.id === selectedLabelSizeId) ?? SHIPPING_LABEL_SIZE_PRESETS[0],
    [selectedLabelSizeId]
  );

  const carrierNameOverride =
    typeof carrierName === 'string' && carrierName.trim().length > 0 ? carrierName.trim() : '';

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
        logistics: {
          ...order.logistics,
          carrierName: carrierNameOverride || order.logistics?.carrierName,
        },
      },
      {
        businessName: businessName || 'FYLL',
        businessLogo,
        businessPhone,
        businessWebsite,
        returnAddress,
      }
    );
  }, [order, businessName, businessLogo, businessPhone, businessWebsite, returnAddress, carrierNameOverride]);

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
    await printOrderLabel(labelData, selectedLabelSizePreset.size);
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
              Confirm before print • {selectedLabelSizePreset.label}
            </Text>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: 24, paddingHorizontal: 20, paddingBottom: 200 }}
          showsVerticalScrollIndicator={false}
        >
          <View
            className="rounded-2xl p-4 mb-4"
            style={{ backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.light }}
          >
            <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold tracking-wider mb-2">
              Label Size
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {SHIPPING_LABEL_SIZE_PRESETS.map((preset) => {
                const active = preset.id === selectedLabelSizePreset.id;
                return (
                  <Pressable
                    key={preset.id}
                    onPress={() => setSelectedLabelSizeId(preset.id)}
                    style={{
                      borderWidth: 1,
                      borderColor: active ? '#111111' : colors.border.light,
                      backgroundColor: active ? '#111111' : colors.bg.primary,
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      height: 34,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: active ? '#FFFFFF' : colors.text.primary, fontSize: 12, fontWeight: '700' }}>
                      {preset.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View className="printable-order-label-container">
            <View className="items-center mb-6">
              {labelData && !isLoading ? (
                <OrderLabel80x90Preview
                  data={labelData}
                  widthMm={selectedLabelSizePreset.size.widthMm}
                  heightMm={selectedLabelSizePreset.size.heightMm}
                />
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
            {(carrierNameOverride || order.logistics?.carrierName) && (
              <Text style={{ color: colors.text.secondary }} className="text-sm mt-1">
                Carrier: {carrierNameOverride || order.logistics?.carrierName}
              </Text>
            )}
          </View>

          <View
            className="rounded-2xl p-4 mt-4"
            style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.2)' }}
          >
            <Text style={{ color: '#1D4ED8', fontSize: 13, lineHeight: 18 }}>
              Mobile browser limitation: iPhone/iPad web printing supports AirPrint printers only. Most Bluetooth-only thermal printers will not appear in Safari/Chrome print lists.
            </Text>
            <Text style={{ color: '#1D4ED8', fontSize: 13, lineHeight: 18, marginTop: 8 }}>
              For consistent team printing, use a Wi-Fi/Ethernet thermal printer (AirPrint/Mopria) or print from a desktop with the printer driver installed.
            </Text>
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
            style={{
              height: 56,
              backgroundColor: isDark ? '#FFFFFF' : '#111111',
              opacity: isPrinting ? 0.7 : 1,
            }}
            disabled={isPrinting || !labelData}
          >
            {isPrinting ? (
              <ActivityIndicator color={isDark ? '#111111' : '#FFFFFF'} />
            ) : (
              <View className="flex-row items-center">
                <Printer size={18} color={isDark ? '#111111' : '#FFFFFF'} strokeWidth={2} />
                <Text
                  className="font-semibold text-sm ml-2"
                  style={{ color: isDark ? '#111111' : '#FFFFFF' }}
                >
                  Print Shipping Label
                </Text>
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
