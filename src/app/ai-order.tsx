import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert, Platform, Image } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Sparkles, AlertCircle, ImagePlus, Plus, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { parseOrderFromText, ParsedOrderData } from '@/lib/ai-order-parser';
import { useThemeColors } from '@/lib/theme';
import { useBreakpoint } from '@/lib/useBreakpoint';
import * as Haptics from 'expo-haptics';
import { cn } from '@/lib/cn';
import { FyllAiButton } from '@/components/FyllAiButton';
import useFyllStore from '@/lib/state/fyll-store';
import { normalizeProductType } from '@/lib/product-utils';
import { useImagePicker } from '@/hooks/useImagePicker';

const MAX_ORDER_SCREENSHOTS = 6;

const inferMimeTypeFromUri = (uri: string) => {
  const lowered = uri.toLowerCase();
  if (lowered.endsWith('.jpg') || lowered.endsWith('.jpeg')) return 'image/jpeg';
  if (lowered.endsWith('.png')) return 'image/png';
  if (lowered.endsWith('.webp')) return 'image/webp';
  if (lowered.endsWith('.heic')) return 'image/heic';
  return 'image/jpeg';
};

async function toDataUrlFromImageSource(imageSource: string): Promise<string> {
  if (imageSource.startsWith('data:')) return imageSource;

  if (Platform.OS === 'web') {
    const response = await fetch(imageSource);
    if (!response.ok) throw new Error('Could not read selected screenshot.');
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('Could not convert screenshot to data URL.'));
      reader.readAsDataURL(blob);
    });
  }

  const base64 = await FileSystem.readAsStringAsync(imageSource, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const mimeType = inferMimeTypeFromUri(imageSource);
  return `data:${mimeType};base64,${base64}`;
}

export default function AIOrderScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const imagePicker = useImagePicker();
  const isDark = colors.bg.primary === '#111111';
  const { isDesktop } = useBreakpoint();
  const isWebDesktop = Platform.OS === 'web' && isDesktop;
  const products = useFyllStore((s) => s.products);
  const customServices = useFyllStore((s) => s.customServices);

  const [messageText, setMessageText] = useState('');
  const [imageDataUrls, setImageDataUrls] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedOrderData | null>(null);

  const productCatalogNames = useMemo(() => {
    return products
      .filter((product) => normalizeProductType(product.productType) !== 'service')
      .map((product) => product.name)
      .filter(Boolean);
  }, [products]);

  const serviceCatalogNames = useMemo(() => {
    const serviceProducts = products
      .filter((product) => normalizeProductType(product.productType) === 'service')
      .map((product) => product.name)
      .filter(Boolean);
    const orderServices = customServices
      .map((service) => service.name)
      .filter(Boolean);
    return Array.from(new Set([...serviceProducts, ...orderServices]));
  }, [products, customServices]);

  const handlePickImage = async () => {
    const picked = await imagePicker.pickImage({
      allowsEditing: false,
      quality: 0.85,
    });
    if (!picked) return;

    try {
      const dataUrl = await toDataUrlFromImageSource(picked);
      let hitLimit = false;
      setImageDataUrls((previous) => {
        if (previous.includes(dataUrl)) return previous;
        if (previous.length >= MAX_ORDER_SCREENSHOTS) {
          hitLimit = true;
          return previous;
        }
        return [...previous, dataUrl];
      });

      if (hitLimit) {
        Alert.alert(
          'Upload limit reached',
          `You can attach up to ${MAX_ORDER_SCREENSHOTS} screenshots for one order parse.`
        );
      }
    } catch (error) {
      console.error('Image conversion failed:', error);
      Alert.alert('Image error', 'Could not process this screenshot. Please try another one.');
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setImageDataUrls((previous) => previous.filter((_, index) => index !== indexToRemove));
  };

  const handleParse = async () => {
    if (!messageText.trim() && imageDataUrls.length === 0) {
      Alert.alert('No input', 'Paste a message or add screenshot(s) first.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsParsing(true);
    setParsedData(null);

    try {
      const result = await parseOrderFromText({
        messageText: messageText.trim() || undefined,
        imageDataUrls: imageDataUrls.length ? imageDataUrls : undefined,
        productCatalogNames,
        serviceCatalogNames,
      });

      if (!result) {
        Alert.alert(
          'Could Not Parse',
          'Unable to extract order information. Please add clearer details or another screenshot.'
        );
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setParsedData(result);
      }
    } catch (error: any) {
      console.error('Parse error:', error);
      Alert.alert(
        'Parsing Failed',
        error?.message || 'An error occurred while parsing the message. Please try again.'
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handleCreateDraft = () => {
    if (!parsedData) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    router.push({
      pathname: '/new-order',
      params: {
        aiParsed: 'true',
        customerName: parsedData.customerName,
        customerPhone: parsedData.customerPhone,
        customerEmail: parsedData.customerEmail,
        deliveryAddress: parsedData.deliveryAddress,
        deliveryState: parsedData.deliveryState,
        deliveryFee: String(parsedData.deliveryFee || ''),
        websiteOrderReference: parsedData.websiteOrderReference || '',
        notes: parsedData.notes,
        items: JSON.stringify(parsedData.items),
        services: JSON.stringify(parsedData.services),
      },
    });
  };

  const confidenceColor = parsedData?.confidence === 'high'
    ? '#10B981'
    : parsedData?.confidence === 'medium'
      ? '#F59E0B'
      : '#EF4444';

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        <View
          className="flex-row items-center justify-between px-5 py-4"
          style={{ borderBottomWidth: 0.5, borderBottomColor: isDark ? '#333' : '#E5E5E5' }}
        >
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 rounded-xl items-center justify-center active:opacity-50"
            style={{ backgroundColor: colors.bg.secondary }}
          >
            <ArrowLeft size={20} color={colors.text.primary} strokeWidth={2} />
          </Pressable>
          <View className="flex-row items-center">
            <Sparkles size={20} color="#8B5CF6" strokeWidth={2} />
            <Text style={{ color: colors.text.primary }} className="text-lg font-bold ml-2">
              ✨ Fyll AI Order Parser
            </Text>
          </View>
          <View className="w-10" />
        </View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: isWebDesktop ? 0 : 20,
            maxWidth: isWebDesktop ? 640 : undefined,
            alignSelf: isWebDesktop ? 'center' : undefined,
            width: isWebDesktop ? '100%' : undefined,
          }}
        >
          <View
            className="rounded-xl p-4 mt-4 flex-row"
            style={{ backgroundColor: isDark ? '#1E1B4B' : '#EDE9FE' }}
          >
            <AlertCircle size={20} color="#8B5CF6" strokeWidth={2} style={{ marginTop: 2 }} />
            <View className="flex-1 ml-3">
              <Text style={{ color: isDark ? '#C4B5FD' : '#6D28D9' }} className="text-sm font-semibold mb-1">
                How it works
              </Text>
              <Text style={{ color: isDark ? '#A78BFA' : '#7C3AED' }} className="text-xs leading-5">
                Paste order text and/or upload screenshots. Fyll AI extracts customers, products, and service lines, then creates a draft order for review.
              </Text>
            </View>
          </View>

          <View className="mt-6">
            <Text style={{ color: colors.text.primary }} className="text-sm font-semibold mb-2">
              Paste WhatsApp Message (optional if screenshot is added)
            </Text>
            <View
              className="rounded-xl p-4"
              style={{
                backgroundColor: colors.input.bg,
                borderWidth: 1,
                borderColor: colors.input.border,
                minHeight: 200,
              }}
            >
              <TextInput
                placeholder="Example:&#10;&#10;Adaeze Okonkwo&#10;+234 803 555 0101&#10;15 Admiralty Way, Lekki, Lagos&#10;&#10;2 Aviator Gold frames&#10;1 Anti-blue lens service"
                placeholderTextColor={colors.input.placeholder}
                value={messageText}
                onChangeText={setMessageText}
                multiline
                textAlignVertical="top"
                style={{
                  color: colors.input.text,
                  fontSize: 14,
                  minHeight: 180,
                }}
              />
            </View>
          </View>

          <View className="mt-6">
            <Text style={{ color: colors.text.primary }} className="text-sm font-semibold mb-2">
              Screenshots (optional)
            </Text>
            {imageDataUrls.length > 0 ? (
              <View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {imageDataUrls.map((imageDataUrl, index) => (
                    <View
                      key={`${imageDataUrl.slice(0, 32)}-${index}`}
                      className="rounded-xl overflow-hidden mr-3"
                      style={{ borderWidth: 1, borderColor: colors.border.light, width: 160, height: 120 }}
                    >
                      <Image source={{ uri: imageDataUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      <Pressable
                        onPress={() => handleRemoveImage(index)}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full items-center justify-center"
                        style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
                      >
                        <X size={14} color="#FFFFFF" strokeWidth={2.4} />
                      </Pressable>
                    </View>
                  ))}
                  {imageDataUrls.length < MAX_ORDER_SCREENSHOTS ? (
                    <Pressable
                      onPress={handlePickImage}
                      className="rounded-xl items-center justify-center"
                      style={{
                        width: 160,
                        height: 120,
                        borderWidth: 1,
                        borderStyle: 'dashed',
                        borderColor: colors.border.light,
                        backgroundColor: colors.bg.secondary,
                      }}
                    >
                      <Plus size={22} color={colors.text.tertiary} strokeWidth={2.4} />
                      <Text style={{ color: colors.text.tertiary }} className="text-xs mt-1">
                        Add
                      </Text>
                    </Pressable>
                  ) : null}
                </ScrollView>
              </View>
            ) : (
              <Pressable
                onPress={handlePickImage}
                className="rounded-xl p-4 flex-row items-center justify-center"
                style={{
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: colors.border.light,
                  backgroundColor: colors.bg.secondary,
                }}
              >
                <ImagePlus size={18} color={colors.text.tertiary} strokeWidth={2.2} />
                <Text style={{ color: colors.text.tertiary }} className="text-sm ml-2 font-medium">
                  Upload screenshot
                </Text>
              </Pressable>
            )}
          </View>

          <Pressable
            onPress={handleParse}
            disabled={isParsing || (!messageText.trim() && imageDataUrls.length === 0)}
            className="mt-4 rounded-full overflow-hidden active:opacity-80"
            style={{ height: 52 }}
          >
            {isParsing ? (
              <View
                className="h-full flex-row items-center justify-center"
                style={{ backgroundColor: colors.border.light }}
              >
                <ActivityIndicator color="#FFFFFF" />
                <Text className="text-white font-semibold ml-2">Parsing with Fyll AI...</Text>
              </View>
            ) : (!messageText.trim() && imageDataUrls.length === 0) ? (
              <View
                className="h-full flex-row items-center justify-center"
                style={{ backgroundColor: colors.border.light }}
              >
                <Sparkles size={18} color="#FFFFFF" strokeWidth={2} />
                <Text className="text-white font-semibold ml-2">Parse Order</Text>
              </View>
            ) : (
              <LinearGradient
                colors={['#8B5CF6', '#A855F7', '#C084FC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ height: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
              >
                <Sparkles size={18} color="#FFFFFF" strokeWidth={2} />
                <Text className="text-white font-semibold ml-2">Parse Order</Text>
              </LinearGradient>
            )}
          </Pressable>

          {parsedData && (
            <View className="mt-6">
              <View className="flex-row items-center justify-between mb-3">
                <Text style={{ color: colors.text.primary }} className="text-base font-bold">
                  Extracted Information
                </Text>
                <View
                  className="px-3 py-1 rounded-full"
                  style={{ backgroundColor: `${confidenceColor}20` }}
                >
                  <Text style={{ color: confidenceColor }} className="text-xs font-semibold">
                    {parsedData.confidence.toUpperCase()} CONFIDENCE
                  </Text>
                </View>
              </View>

              <View
                className="rounded-xl p-4"
                style={{
                  backgroundColor: colors.bg.card,
                  borderWidth: 0.5,
                  borderColor: isDark ? '#333' : '#E5E5E5',
                }}
              >
                <Text style={{ color: colors.text.primary }} className="font-semibold mb-2">
                  Customer Information
                </Text>
                <InfoRow label="Name" value={parsedData.customerName || 'Not found'} colors={colors} />
                <InfoRow label="Phone" value={parsedData.customerPhone || 'Not found'} colors={colors} />
                <InfoRow label="Email" value={parsedData.customerEmail || 'Not found'} colors={colors} />
                <InfoRow label="State" value={parsedData.deliveryState || 'Not found'} colors={colors} />
                <InfoRow
                  label="Address"
                  value={parsedData.deliveryAddress || 'Not found'}
                  colors={colors}
                />
                {parsedData.websiteOrderReference ? (
                  <InfoRow label="Order Ref" value={parsedData.websiteOrderReference} colors={colors} isLast />
                ) : (
                  <InfoRow label="Order Ref" value="Not found" colors={colors} isLast />
                )}

                <Text style={{ color: colors.text.primary }} className="font-semibold mt-4 mb-2">
                  Products
                </Text>
                {parsedData.items.length > 0 ? (
                  parsedData.items.map((item, idx) => (
                    <View
                      key={`item-${idx}`}
                      className="flex-row items-center py-2"
                      style={{
                        borderBottomWidth: idx < parsedData.items.length - 1 ? 0.5 : 0,
                        borderBottomColor: isDark ? '#333' : '#E5E5E5',
                      }}
                    >
                      <View
                        className="w-6 h-6 rounded-full items-center justify-center mr-3"
                        style={{ backgroundColor: '#8B5CF6' }}
                      >
                        <Text className="text-white text-xs font-bold">{item.quantity}</Text>
                      </View>
                      <View className="flex-1">
                        <Text style={{ color: colors.text.primary }} className="text-sm font-medium">
                          {item.productName}
                        </Text>
                        {item.variantInfo ? (
                          <Text style={{ color: colors.text.tertiary }} className="text-xs">
                            {item.variantInfo}
                          </Text>
                        ) : null}
                        {item.unitPrice ? (
                          <Text style={{ color: colors.text.tertiary }} className="text-xs">
                            ₦{item.unitPrice.toLocaleString()} · {item.quantity}x
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={{ color: colors.text.tertiary }} className="text-sm">
                    No products found
                  </Text>
                )}

                <Text style={{ color: colors.text.primary }} className="font-semibold mt-4 mb-2">
                  Services
                </Text>
                {parsedData.services.length > 0 ? (
                  parsedData.services.map((service, idx) => (
                    <View
                      key={`service-${idx}`}
                      className="flex-row items-center py-2"
                      style={{
                        borderBottomWidth: idx < parsedData.services.length - 1 ? 0.5 : 0,
                        borderBottomColor: isDark ? '#333' : '#E5E5E5',
                      }}
                    >
                      <View
                        className="w-6 h-6 rounded-full items-center justify-center mr-3"
                        style={{ backgroundColor: '#14B8A6' }}
                      >
                        <Text className="text-white text-xs font-bold">{service.quantity}</Text>
                      </View>
                      <View className="flex-1">
                        <Text style={{ color: colors.text.primary }} className="text-sm font-medium">
                          {service.serviceName}
                        </Text>
                        {service.notes ? (
                          <Text style={{ color: colors.text.tertiary }} className="text-xs">
                            {service.notes}
                          </Text>
                        ) : null}
                        {service.unitPrice ? (
                          <Text style={{ color: colors.text.tertiary }} className="text-xs">
                            ₦{service.unitPrice.toLocaleString()} · {service.quantity}x
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={{ color: colors.text.tertiary }} className="text-sm">
                    No services found
                  </Text>
                )}

                {(parsedData.deliveryFee || parsedData.orderTotal) ? (
                  <View className="mt-4">
                    {parsedData.deliveryFee ? (
                      <InfoRow
                        label="Delivery Fee"
                        value={`₦${parsedData.deliveryFee.toLocaleString()}`}
                        colors={colors}
                      />
                    ) : null}
                    {parsedData.orderTotal ? (
                      <InfoRow
                        label="Order Total"
                        value={`₦${parsedData.orderTotal.toLocaleString()}`}
                        colors={colors}
                        isLast
                      />
                    ) : null}
                  </View>
                ) : null}

                {parsedData.notes ? (
                  <>
                    <Text style={{ color: colors.text.primary }} className="font-semibold mt-4 mb-2">
                      Special Notes
                    </Text>
                    <Text style={{ color: colors.text.secondary }} className="text-sm">
                      {parsedData.notes}
                    </Text>
                  </>
                ) : null}
              </View>

              <View className="mt-4">
                <FyllAiButton
                  label="Create Draft Order"
                  onPress={handleCreateDraft}
                  height={52}
                  borderRadius={999}
                  iconSize={18}
                  textSize={16}
                />
              </View>
            </View>
          )}

          <View className="h-8" />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function InfoRow({
  label,
  value,
  colors,
  isLast = false,
}: {
  label: string;
  value: string;
  colors: any;
  isLast?: boolean;
}) {
  const isDark = colors.bg.primary === '#111111';
  return (
    <View
      className="flex-row py-2"
      style={{
        borderBottomWidth: isLast ? 0 : 0.5,
        borderBottomColor: isDark ? '#333' : '#E5E5E5',
      }}
    >
      <Text style={{ color: colors.text.tertiary }} className="text-sm w-20">
        {label}:
      </Text>
      <Text
        style={{ color: value === 'Not found' ? colors.text.muted : colors.text.primary }}
        className={cn('text-sm flex-1', value === 'Not found' && 'italic')}
      >
        {value}
      </Text>
    </View>
  );
}
