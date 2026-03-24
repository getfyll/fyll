import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Printer, Share2 } from 'lucide-react-native';
import useFyllStore, { ProductVariant } from '@/lib/state/fyll-store';
import { useThemeColors } from '@/lib/theme';
import * as Haptics from 'expo-haptics';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import Svg, { Rect } from 'react-native-svg';
import { generateQrMatrix, generateQrSvg } from '@/lib/qrcode';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const PRODUCT_LABEL_SIZE_PRESETS: {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
}[] = [
  { id: '30x50', label: '30x50mm', widthMm: 30, heightMm: 50 },
  { id: '40x30', label: '40x30mm', widthMm: 40, heightMm: 30 },
  { id: '50x30', label: '50x30mm', widthMm: 50, heightMm: 30 },
];

export default function LabelPrintScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { productId, variantId, bulk } = useLocalSearchParams<{ productId: string; variantId?: string; bulk?: string }>();
  const isBulk = bulk === '1';
  const [selectedLabelSizeId, setSelectedLabelSizeId] = useState<string>('30x50');

  const products = useFyllStore((s) => s.products);
  const selectedLabelSize = useMemo(
    () => PRODUCT_LABEL_SIZE_PRESETS.find((preset) => preset.id === selectedLabelSizeId) ?? PRODUCT_LABEL_SIZE_PRESETS[0],
    [selectedLabelSizeId]
  );

  const product = useMemo(() => products.find((p) => p.id === productId), [products, productId]);
  const variantsToPrint = useMemo(() => {
    if (!product) return [] as ProductVariant[];
    if (isBulk) return product.variants;
    const selected = product.variants.find((v) => v.id === variantId);
    return selected ? [selected] : [];
  }, [product, isBulk, variantId]);

  const getVariantName = (variant: ProductVariant) => Object.values(variant.variableValues).join(' — ');
  const getFullName = (variant: ProductVariant) => `${product?.name ?? ''} — ${getVariantName(variant)}`;
  const getProductCode = (variant: ProductVariant) => variant.barcode || variant.sku || 'fyll';

  // Inject print styles for web to hide everything except the label preview
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const styleId = 'label-print-styles';
      let styleEl = document.getElementById(styleId);

      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        styleEl.textContent = `
          @media print {
            body * {
              visibility: hidden !important;
            }
            .printable-label-container,
            .printable-label-container * {
              visibility: visible !important;
            }
            .printable-label-container {
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

  if (!product || variantsToPrint.length === 0) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: colors.bg.primary }}>
        <Text style={{ color: colors.text.tertiary }} className="text-lg">Product not found</Text>
        <Pressable onPress={() => router.back()} className="mt-4 active:opacity-50">
          <Text style={{ color: colors.text.primary }} className="font-semibold">Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const buildLabelHtml = (
    targets: ProductVariant[],
    size: { widthMm: number; heightMm: number },
  ) => {
    const targetWidthMm = Number.isFinite(size.widthMm) && size.widthMm > 0 ? size.widthMm : 30;
    const targetHeightMm = Number.isFinite(size.heightMm) && size.heightMm > 0 ? size.heightMm : 50;
    const qrSizeMm = Math.max(16, Math.min(targetWidthMm - 6, targetHeightMm - 20, 24));

    const labels = targets
      .map((item, index) => {
        const productCode = getProductCode(item);
        const qrSvg = productCode ? generateQrSvg(productCode, Math.round(qrSizeMm * 1.8)) : '';
        const safeSku = escapeHtml(item.sku ?? '');
        const safeName = escapeHtml(getFullName(item));
        const pageBreak = index < targets.length - 1 ? 'page-break-after: always;' : '';

        return `
          <div class="label-page" style="${pageBreak}">
            <div class="label">
              ${qrSvg.replace('<svg ', '<svg class="qr" ')}
              <div class="sku">${safeSku}</div>
              <div class="product-name">${safeName}</div>
            </div>
          </div>
        `;
      })
      .join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            @page {
              size: ${targetWidthMm}mm ${targetHeightMm}mm;
              margin: 0;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              width: ${targetWidthMm}mm;
              height: ${targetHeightMm}mm;
              padding: 0;
              background: #fff;
            }
            .label-page {
              width: ${targetWidthMm}mm;
              height: ${targetHeightMm}mm;
              padding: 1.5mm;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .label-page:last-child {
              page-break-after: auto;
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
              width: ${qrSizeMm}mm;
              height: ${qrSizeMm}mm;
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
          ${labels}
        </body>
      </html>
    `;
  };

  const labelSizePoints = {
    width: Math.round(selectedLabelSize.widthMm * 2.83465),
    height: Math.round(selectedLabelSize.heightMm * 2.83465),
  };

  const handlePrint = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await Print.printAsync({
        html: buildLabelHtml(variantsToPrint, selectedLabelSize),
        width: labelSizePoints.width,
        height: labelSizePoints.height,
      });
    } catch (error) {
      console.log('Print error:', error);
    }
  };

  const handleSavePdf = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      if (Platform.OS === 'web') {
        // Web already provides "Save as PDF" in the browser print dialog.
        await handlePrint();
        return;
      }

      const file = await Print.printToFileAsync({
        html: buildLabelHtml(variantsToPrint, selectedLabelSize),
        width: labelSizePoints.width,
        height: labelSizePoints.height,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) return;

      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Product Label PDF',
        UTI: 'com.adobe.pdf',
      });
    } catch (error) {
      console.log('Save PDF error:', error);
    }
  };

  const tipsText =
    Platform.OS === 'web'
      ? 'Mobile browser limitation: iPhone/iPad web printing supports AirPrint printers only. Most Bluetooth-only thermal printers will not appear. For reliable team printing, use Wi-Fi/Ethernet thermal printers (AirPrint/Mopria) or print from desktop with drivers.'
      : 'Printing uses your device’s system print dialog. Make sure the printer is paired/connected to this device (and on the same Wi‑Fi if needed) so it appears in the printer list.';
  const previewAspectRatio = selectedLabelSize.widthMm / selectedLabelSize.heightMm;
  const previewWidth = previewAspectRatio >= 1 ? 260 : 180;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border.light, backgroundColor: colors.bg.primary }}>
          <Pressable onPress={() => router.back()} className="mr-4 active:opacity-50">
            <ArrowLeft size={24} color={colors.text.primary} strokeWidth={2} />
          </Pressable>
          <View className="flex-1">
            <Text style={{ color: colors.text.primary }} className="font-bold text-lg">
              {isBulk ? 'Bulk Labels' : 'Print Label'}
            </Text>
            <Text style={{ color: colors.text.tertiary }} className="text-xs">
              {isBulk ? `${variantsToPrint.length} label${variantsToPrint.length === 1 ? '' : 's'} ready` : 'Thermal Label Preview'}
            </Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1, backgroundColor: colors.bg.secondary }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24 }} showsVerticalScrollIndicator={false}>
          <View className="rounded-xl p-4 mb-4" style={{ backgroundColor: colors.bg.primary, borderWidth: 1, borderColor: colors.border.light }}>
            <Text style={{ color: colors.text.tertiary }} className="text-xs font-medium uppercase tracking-wider mb-3">Label Size</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {PRODUCT_LABEL_SIZE_PRESETS.map((preset) => {
                const active = preset.id === selectedLabelSize.id;
                return (
                  <Pressable
                    key={preset.id}
                    onPress={() => setSelectedLabelSizeId(preset.id)}
                    style={{
                      borderWidth: 1,
                      borderColor: active ? '#111111' : colors.border.light,
                      backgroundColor: active ? '#111111' : colors.bg.secondary,
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

          {/* Label Preview Card */}
          <View className="printable-label-container">
            <View>
              <Text style={{ color: colors.text.tertiary }} className="text-xs font-medium uppercase tracking-wider mb-3 print:hidden">
                Label Preview ({selectedLabelSize.widthMm}mm x {selectedLabelSize.heightMm}mm)
              </Text>

              {/* Simulated Label - without price */}
              <View className="gap-4 mb-6">
                {variantsToPrint.map((item) => {
                  const productCode = getProductCode(item);
                  const qrMatrix = generateQrMatrix(productCode);
                  return (
                    <View
                      key={item.id}
                      className="overflow-hidden"
                      style={{
                        alignSelf: 'center',
                        backgroundColor: '#FFFFFF',
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.border.light,
                        width: previewWidth,
                        aspectRatio: previewAspectRatio,
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
                          width={selectedLabelSize.widthMm >= 50 ? 156 : 148}
                          height={selectedLabelSize.widthMm >= 50 ? 156 : 148}
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
                          {item.sku}
                        </Text>
                        <Text
                          style={{ color: colors.text.primary }}
                          className="text-[11px] font-semibold text-center mt-1"
                          numberOfLines={2}
                        >
                          {getFullName(item)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Product Details */}
          <View>
            <View className="rounded-xl p-4 mb-4" style={{ backgroundColor: colors.bg.primary, borderWidth: 1, borderColor: colors.border.light }}>
              <Text style={{ color: colors.text.tertiary }} className="text-xs font-medium mb-3">LABEL CONTENT</Text>

              {isBulk ? (
                <View className="gap-3">
                  <View>
                    <Text style={{ color: colors.text.muted }} className="text-xs">Total Labels</Text>
                    <Text style={{ color: colors.text.primary }} className="font-semibold">{variantsToPrint.length}</Text>
                  </View>
                  <View>
                    <Text style={{ color: colors.text.muted }} className="text-xs">Variants</Text>
                    {variantsToPrint.map((item) => (
                      <Text key={item.id} style={{ color: colors.text.primary }} className="text-sm font-medium">
                        {getVariantName(item)}
                      </Text>
                    ))}
                  </View>
                </View>
              ) : (
                <>
                  <View className="mb-3">
                    <Text style={{ color: colors.text.muted }} className="text-xs">Barcode (QR)</Text>
                    <Text style={{ color: colors.text.primary }} className="font-semibold">{variantsToPrint[0]?.barcode || variantsToPrint[0]?.sku}</Text>
                  </View>

                  <View className="mb-3">
                    <Text style={{ color: colors.text.muted }} className="text-xs">SKU Number</Text>
                    <Text style={{ color: colors.text.primary }} className="font-semibold">{variantsToPrint[0]?.sku}</Text>
                  </View>

                  <View>
                    <Text style={{ color: colors.text.muted }} className="text-xs">Product Name + Variant</Text>
                    <Text style={{ color: colors.text.primary }} className="font-semibold">{variantsToPrint[0] ? getFullName(variantsToPrint[0]) : ''}</Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* Info Note */}
          <View>
            <View className="rounded-xl p-4 mb-6" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.2)' }}>
              <Text style={{ color: '#3B82F6' }} className="text-sm">
                {tipsText}
              </Text>
            </View>
          </View>

          <View className="h-32" />
        </ScrollView>

        {/* Bottom Actions */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: 32, paddingTop: 16, backgroundColor: colors.bg.primary, borderTopWidth: 1, borderTopColor: colors.border.light }}>
          <View className="flex-row gap-3">
            <Pressable
              onPress={handleSavePdf}
              className="flex-1 rounded-xl items-center justify-center active:opacity-70 flex-row"
              style={{ height: 56, backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.light }}
            >
              <Share2 size={20} color={colors.text.primary} strokeWidth={2} />
              <Text style={{ color: colors.text.primary }} className="font-semibold ml-2">
                {Platform.OS === 'web' ? 'Save / Print' : 'Save PDF'}
              </Text>
            </Pressable>
            <Pressable
              onPress={handlePrint}
              className="flex-[2] rounded-xl items-center justify-center active:opacity-80 flex-row"
              style={{ height: 56, backgroundColor: '#111111' }}
            >
              <Printer size={20} color="#FFFFFF" strokeWidth={2} />
              <Text className="text-white font-bold ml-2">{isBulk ? 'Print All Labels' : 'Print Label'}</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
