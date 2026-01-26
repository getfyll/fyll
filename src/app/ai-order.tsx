import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Sparkles, ClipboardPaste, AlertCircle } from 'lucide-react-native';
import { parseOrderFromText, formatParsedOrder, ParsedOrderData } from '@/lib/ai-order-parser';
import { useThemeColors } from '@/lib/theme';
import * as Haptics from 'expo-haptics';
import { cn } from '@/lib/cn';

export default function AIOrderScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const isDark = colors.bg.primary === '#111111';

  const [messageText, setMessageText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedOrderData | null>(null);

  const handleParse = async () => {
    if (!messageText.trim()) {
      Alert.alert('Empty Message', 'Please paste a WhatsApp message to parse.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsParsing(true);
    setParsedData(null);

    try {
      const result = await parseOrderFromText(messageText);

      if (!result) {
        Alert.alert(
          'Could Not Parse',
          'Unable to extract order information from the message. Please check the format and try again.'
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

    // Navigate to new-order with pre-filled data
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
        {/* Header */}
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
              ✨ AI Order Parser
            </Text>
          </View>
          <View className="w-10" />
        </View>

        <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
          {/* Info Card */}
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
                Paste a WhatsApp message containing customer details and products. AI will extract the information and create a draft order for you to review.
              </Text>
            </View>
          </View>

          {/* Input Section */}
          <View className="mt-6">
            <Text style={{ color: colors.text.primary }} className="text-sm font-semibold mb-2">
              Paste WhatsApp Message
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
                placeholder="Example:&#10;&#10;Adaeze Okonkwo&#10;+234 803 555 0101&#10;15 Admiralty Way, Lekki, Lagos&#10;&#10;2 Aviator Gold frames&#10;1 Wayfarer Black&#10;Lens coating needed"
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

            {/* Parse Button */}
            <Pressable
              onPress={handleParse}
              disabled={isParsing || !messageText.trim()}
              className="mt-4 rounded-xl items-center justify-center active:opacity-80"
              style={{
                backgroundColor: isParsing || !messageText.trim() ? colors.border.light : '#8B5CF6',
                height: 52,
              }}
            >
              {isParsing ? (
                <View className="flex-row items-center">
                  <ActivityIndicator color="#FFFFFF" />
                  <Text className="text-white font-semibold ml-2">Parsing with AI...</Text>
                </View>
              ) : (
                <View className="flex-row items-center">
                  <Sparkles size={18} color="#FFFFFF" strokeWidth={2} />
                  <Text className="text-white font-semibold ml-2">Parse Order</Text>
                </View>
              )}
            </Pressable>
          </View>

          {/* Parsed Results */}
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
                {/* Customer Info */}
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

                {/* Products */}
                <Text style={{ color: colors.text.primary }} className="font-semibold mt-4 mb-2">
                  Products
                </Text>
                {parsedData.items.length > 0 ? (
                  parsedData.items.map((item, idx) => (
                    <View
                      key={idx}
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
                        {item.variantInfo && (
                          <Text style={{ color: colors.text.tertiary }} className="text-xs">
                            {item.variantInfo}
                          </Text>
                        )}
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

                {/* Notes */}
                {parsedData.notes && (
                  <>
                    <Text style={{ color: colors.text.primary }} className="font-semibold mt-4 mb-2">
                      Special Notes
                    </Text>
                    <Text style={{ color: colors.text.secondary }} className="text-sm">
                      {parsedData.notes}
                    </Text>
                  </>
                )}
              </View>

              {/* Create Draft Button */}
              <Pressable
                onPress={handleCreateDraft}
                className="mt-4 rounded-xl items-center justify-center active:opacity-80"
                style={{ backgroundColor: '#8B5CF6', height: 52 }}
              >
                <Text className="text-white font-semibold text-base">
                  Create Draft Order →
                </Text>
              </Pressable>
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
  isLast = false
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
