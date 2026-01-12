import React, { useMemo, useRef } from 'react';
import { View, Text, Pressable, ScrollView, Share, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Printer, Share2 } from 'lucide-react-native';
import useFyllStore, { formatCurrency } from '@/lib/state/fyll-store';
import * as Haptics from 'expo-haptics';
import * as Print from 'expo-print';
import Animated, { FadeInDown } from 'react-native-reanimated';

// Force Light Theme Colors
const colors = {
  bg: {
    primary: '#FFFFFF',
    secondary: '#F9F9F9',
  },
  text: {
    primary: '#111111',
    secondary: '#333333',
    tertiary: '#666666',
    muted: '#999999',
  },
  border: {
    light: '#E5E5E5',
  },
};

// Generate CODE128 barcode SVG path
function generateCode128Barcode(data: string): string {
  // CODE128 character set B start code, data, checksum, stop code
  const CODE128_START_B = 104;
  const CODE128_STOP = 106;

  // CODE128B encoding patterns (bars: 1=black, 0=white)
  const CODE128_PATTERNS: Record<number, string> = {
    0: '11011001100', 1: '11001101100', 2: '11001100110', 3: '10010011000',
    4: '10010001100', 5: '10001001100', 6: '10011001000', 7: '10011000100',
    8: '10001100100', 9: '11001001000', 10: '11001000100', 11: '11000100100',
    12: '10110011100', 13: '10011011100', 14: '10011001110', 15: '10111001100',
    16: '10011101100', 17: '10011100110', 18: '11001110010', 19: '11001011100',
    20: '11001001110', 21: '11011100100', 22: '11001110100', 23: '11101101110',
    24: '11101001100', 25: '11100101100', 26: '11100100110', 27: '11101100100',
    28: '11100110100', 29: '11100110010', 30: '11011011000', 31: '11011000110',
    32: '11000110110', 33: '10100011000', 34: '10001011000', 35: '10001000110',
    36: '10110001000', 37: '10001101000', 38: '10001100010', 39: '11010001000',
    40: '11000101000', 41: '11000100010', 42: '10110111000', 43: '10110001110',
    44: '10001101110', 45: '10111011000', 46: '10111000110', 47: '10001110110',
    48: '11101110110', 49: '11010001110', 50: '11000101110', 51: '11011101000',
    52: '11011100010', 53: '11011101110', 54: '11101011000', 55: '11101000110',
    56: '11100010110', 57: '11101101000', 58: '11101100010', 59: '11100011010',
    60: '11101111010', 61: '11001000010', 62: '11110001010', 63: '10100110000',
    64: '10100001100', 65: '10010110000', 66: '10010000110', 67: '10000101100',
    68: '10000100110', 69: '10110010000', 70: '10110000100', 71: '10011010000',
    72: '10011000010', 73: '10000110100', 74: '10000110010', 75: '11000010010',
    76: '11001010000', 77: '11110111010', 78: '11000010100', 79: '10001111010',
    80: '10100111100', 81: '10010111100', 82: '10010011110', 83: '10111100100',
    84: '10011110100', 85: '10011110010', 86: '11110100100', 87: '11110010100',
    88: '11110010010', 89: '11011011110', 90: '11011110110', 91: '11110110110',
    92: '10101111000', 93: '10100011110', 94: '10001011110', 95: '10111101000',
    96: '10111100010', 97: '11110101000', 98: '11110100010', 99: '10111011110',
    100: '10111101110', 101: '11101011110', 102: '11110101110', 103: '11010000100',
    104: '11010010000', 105: '11010011100', 106: '11000111010',
  };

  // Build barcode
  let barcodePattern = CODE128_PATTERNS[CODE128_START_B];
  let checksum = CODE128_START_B;

  // Encode each character
  for (let i = 0; i < data.length; i++) {
    const charCode = data.charCodeAt(i) - 32; // ASCII to CODE128B value
    if (charCode >= 0 && charCode <= 95) {
      barcodePattern += CODE128_PATTERNS[charCode];
      checksum += charCode * (i + 1);
    }
  }

  // Add checksum
  const checksumValue = checksum % 103;
  barcodePattern += CODE128_PATTERNS[checksumValue];

  // Add stop code
  barcodePattern += CODE128_PATTERNS[CODE128_STOP];

  // Add termination bar
  barcodePattern += '11';

  return barcodePattern;
}

// Convert barcode pattern to SVG
function barcodeSVG(pattern: string, width: number, height: number): string {
  const barWidth = width / pattern.length;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;

  let x = 0;
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '1') {
      svg += `<rect x="${x}" y="0" width="${barWidth}" height="${height}" fill="black"/>`;
    }
    x += barWidth;
  }

  svg += '</svg>';
  return svg;
}

export default function LabelPrintScreen() {
  const router = useRouter();
  const { productId, variantId } = useLocalSearchParams<{ productId: string; variantId: string }>();

  const products = useFyllStore((s) => s.products);

  const product = useMemo(() => products.find((p) => p.id === productId), [products, productId]);
  const variant = useMemo(() => product?.variants.find((v) => v.id === variantId), [product, variantId]);

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

  const variantName = Object.values(variant.variableValues).join(' — ');
  const fullName = `${product.name} — ${variantName}`;

  // Generate barcode pattern
  const barcodePattern = generateCode128Barcode(variant.barcode || variant.sku);
  const barcodeSvg = barcodeSVG(barcodePattern, 200, 50);

  const handlePrint = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Generate HTML for thermal label (50mm x 30mm approximately) - without price
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            @page {
              size: 50mm 30mm;
              margin: 0;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              width: 50mm;
              height: 30mm;
              padding: 2mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
            }
            .barcode-container {
              text-align: center;
              width: 100%;
            }
            .barcode-svg {
              width: 44mm;
              height: 12mm;
            }
            .sku {
              font-size: 7pt;
              font-weight: 600;
              letter-spacing: 1px;
              margin-top: 1mm;
              color: #333;
            }
            .product-name {
              font-size: 9pt;
              font-weight: 700;
              text-align: center;
              margin-top: 2mm;
              color: #000;
              max-width: 46mm;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
          </style>
        </head>
        <body>
          <div class="barcode-container">
            ${barcodeSvg.replace('width="200"', 'class="barcode-svg"').replace('height="50"', '')}
            <div class="sku">${variant.sku}</div>
          </div>
          <div class="product-name">${fullName}</div>
        </body>
      </html>
    `;

    try {
      await Print.printAsync({
        html,
        width: 189, // 50mm in points (1mm = 3.78pt)
        height: 113, // 30mm in points
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
            <Text style={{ color: colors.text.tertiary }} className="text-xs font-medium uppercase tracking-wider mb-3">Label Preview (50mm x 30mm)</Text>

            {/* Simulated Label - without price */}
            <View
              className="rounded-xl overflow-hidden mb-6"
              style={{
                backgroundColor: '#FFFFFF',
                borderWidth: 2,
                borderColor: colors.border.light,
                aspectRatio: 50/30,
                maxWidth: 300,
                alignSelf: 'center',
                padding: 12,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              {/* Barcode Visual Representation */}
              <View className="items-center mb-2">
                <View style={{ flexDirection: 'row', height: 40, alignItems: 'flex-end' }}>
                  {barcodePattern.split('').map((bit, index) => (
                    <View
                      key={index}
                      style={{
                        width: 1.5,
                        height: bit === '1' ? 40 : 0,
                        backgroundColor: bit === '1' ? '#000000' : 'transparent',
                      }}
                    />
                  ))}
                </View>
                <Text style={{ color: colors.text.secondary }} className="text-xs font-semibold mt-1 tracking-widest">
                  {variant.sku}
                </Text>
              </View>

              {/* Product Name */}
              <Text
                style={{ color: colors.text.primary }}
                className="text-sm font-bold text-center"
                numberOfLines={2}
              >
                {fullName}
              </Text>
            </View>
          </Animated.View>

          {/* Product Details */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <View className="rounded-xl p-4 mb-4" style={{ backgroundColor: colors.bg.primary, borderWidth: 1, borderColor: colors.border.light }}>
              <Text style={{ color: colors.text.tertiary }} className="text-xs font-medium mb-3">LABEL CONTENT</Text>

              <View className="mb-3">
                <Text style={{ color: colors.text.muted }} className="text-xs">Barcode (CODE128)</Text>
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
                Tap "Print Label" to open your device's print dialog. Connect to any Bluetooth or Wi-Fi thermal printer (e.g., 50mm x 30mm labels).
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
