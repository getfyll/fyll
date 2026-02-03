import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, Share, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Printer, Share2 } from 'lucide-react-native';
import useFyllStore, { formatCurrency } from '@/lib/state/fyll-store';
import { useThemeColors } from '@/lib/theme';
import * as Haptics from 'expo-haptics';
import * as Print from 'expo-print';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';
import { generateQrMatrix, generateQrSvg } from '@/lib/qrcode';

export default function LabelPrintScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { productId, variantId } = useLocalSearchParams<{ productId: string; variantId: string }>();

  const products = useFyllStore((s) => s.products);

  const product = useMemo(() => products.find((p) => p.id === productId), [products, productId]);
  const variant = useMemo(() => product?.variants.find((v) => v.id === variantId), [product, variantId]);

  const variantName = variant ? Object.values(variant.variableValues).join(' — ') : '';
  const fullName = product && variant ? `${product.name} — ${variantName}` : '';
  const productCode = variant?.barcode || variant?.sku || 'fyll';
  const qrMatrix = useMemo(() => generateQrMatrix(productCode), [productCode]);

  if (!product || !variant) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: colors.bg.primary }}>
        <Text style={{ color: colors.text.tertiary }} className="text-lg">Product not found</Text>
        <Pressable onPress={() => router.back()} className="mt-4 active:opacity-50">
          <Text style={{ color: colors.text.primary }} className="font-semibold">Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const handlePrint = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const qrSvg = productCode ? generateQrSvg(productCode, 44) : '';

    // Generate HTML for thermal label (50mm x 30mm approximately) - without price
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            @page {
              size: 30mm 50mm;
              margin: 0;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              width: 30mm;
              height: 50mm;
              padding: 1.5mm;
              background: #fff;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .label {
              width: 100%;
              height: 100%;
              border: 1px solid #E5E7EB;
              border-radius: 3px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 1mm;
            }
            .qr {
              width: 24mm;
              height: 24mm;
            }
            .sku {
              font-size: 8pt;
              font-weight: 600;
              letter-spacing: 1px;
              margin-top: 1.5mm;
              color: #111;
            }
            .product-name {
              font-size: 7pt;
              font-weight: 700;
              text-align: center;
              margin-top: 1mm;
              color: #111;
              line-height: 1.2;
              max-height: 12mm;
            }
          </style>
        </head>
        <body>
          <div class="label">
            ${qrSvg.replace('<svg ', '<svg class="qr" ')}
            <div class="sku">${variant.sku}</div>
            <div class="product-name">${fullName}</div>
          </div>
        </body>
      </html>
    `;

    try {
      await Print.printAsync({
        html,
        width: 113, // 30mm in points (1mm ≈ 3.78pt)
        height: 189, // 50mm in points
      });
    } catch (error) {
      console.log('Print error:', error);
    }
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await Share.share({
        message: `Label: ${fullName}\nSKU: ${variant.sku}\nBarcode: ${variant.barcode}\nPrice: ${formatCurrency(variant.sellingPrice)}`,
        title: 'Product Label',
      });
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border.light, backgroundColor: colors.bg.primary }}>
          <Pressable onPress={() => router.back()} className="mr-4 active:opacity-50">
            <ArrowLeft size={24} color={colors.text.primary} strokeWidth={2} />
          </Pressable>
          <View className="flex-1">
            <Text style={{ color: colors.text.primary }} className="font-bold text-lg">Print Label</Text>
            <Text style={{ color: colors.text.tertiary }} className="text-xs">Thermal Label Preview</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1, backgroundColor: colors.bg.secondary }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24 }} showsVerticalScrollIndicator={false}>
          {/* Label Preview Card */}
          <Animated.View entering={FadeInDown.duration(400)}>
            <Text style={{ color: colors.text.tertiary }} className="text-xs font-medium uppercase tracking-wider mb-3">Label Preview (30mm x 50mm)</Text>

            {/* Simulated Label - without price */}
            <View
              className="overflow-hidden mb-6"
              style={{
                alignSelf: 'center',
                backgroundColor: '#FFFFFF',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border.light,
                width: 180,
                height: 300,
                padding: 8,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 6,
                elevation: 5,
              }}
            >
              <View
                style={{
                  flex: 1,
                  backgroundColor: '#FFFFFF',
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#F3F4F6',
                  padding: 6,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Svg
                  width={148}
                  height={148}
                  viewBox={`0 0 ${qrMatrix.length} ${qrMatrix.length}`}
                >
                  {qrMatrix.map((row, rowIndex) =>
                    row.map((filled, colIndex) =>
                      filled ? (
                        <Rect
                          key={`${rowIndex}-${colIndex}`}
                          x={colIndex}
                          y={rowIndex}
                          width={1}
                          height={1}
                          fill="#0F172A"
                        />
                      ) : null
                    )
                  )}
                </Svg>
              </View>
              <View className="items-center mt-4">
                <Text style={{ color: colors.text.secondary }} className="text-[10px] font-bold tracking-[0.3px]">
                  {variant.sku}
                </Text>
                <Text
                  style={{ color: colors.text.primary }}
                  className="text-[11px] font-semibold text-center mt-1"
                  numberOfLines={2}
                >
                  {fullName}
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* Product Details */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <View className="rounded-xl p-4 mb-4" style={{ backgroundColor: colors.bg.primary, borderWidth: 1, borderColor: colors.border.light }}>
              <Text style={{ color: colors.text.tertiary }} className="text-xs font-medium mb-3">LABEL CONTENT</Text>

              <View className="mb-3">
                <Text style={{ color: colors.text.muted }} className="text-xs">Barcode (QR)</Text>
                <Text style={{ color: colors.text.primary }} className="font-semibold">{variant.barcode || variant.sku}</Text>
              </View>

              <View className="mb-3">
                <Text style={{ color: colors.text.muted }} className="text-xs">SKU Number</Text>
                <Text style={{ color: colors.text.primary }} className="font-semibold">{variant.sku}</Text>
              </View>

              <View>
                <Text style={{ color: colors.text.muted }} className="text-xs">Product Name + Variant</Text>
                <Text style={{ color: colors.text.primary }} className="font-semibold">{fullName}</Text>
              </View>
            </View>
          </Animated.View>

          {/* Info Note */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <View className="rounded-xl p-4 mb-6" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.2)' }}>
              <Text style={{ color: '#3B82F6' }} className="text-sm">
                Tap "Print Label" to open your device's print dialog. Connect to any Bluetooth or Wi-Fi thermal printer (30mm x 50mm labels).
              </Text>
            </View>
          </Animated.View>

          <View className="h-32" />
        </ScrollView>

        {/* Bottom Actions */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: 32, paddingTop: 16, backgroundColor: colors.bg.primary, borderTopWidth: 1, borderTopColor: colors.border.light }}>
          <View className="flex-row gap-3">
            <Pressable
              onPress={handleShare}
              className="flex-1 rounded-xl items-center justify-center active:opacity-70 flex-row"
              style={{ height: 56, backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.light }}
            >
              <Share2 size={20} color={colors.text.primary} strokeWidth={2} />
              <Text style={{ color: colors.text.primary }} className="font-semibold ml-2">Share</Text>
            </Pressable>
            <Pressable
              onPress={handlePrint}
              className="flex-[2] rounded-xl items-center justify-center active:opacity-80 flex-row"
              style={{ height: 56, backgroundColor: '#111111' }}
            >
              <Printer size={20} color="#FFFFFF" strokeWidth={2} />
              <Text className="text-white font-bold ml-2">Print Label</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
