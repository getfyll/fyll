import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Sparkles, ImagePlus, Plus } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '@/lib/theme';
import { useBreakpoint } from '@/lib/useBreakpoint';
import { parseCaseDraft, CaseDraftData } from '@/lib/ai-case-parser';
import useFyllStore, {
  CASE_PRIORITIES,
  CASE_SOURCES,
  CASE_TYPES,
  Case,
  CasePriority,
  CaseSource,
  CaseType,
  generateCaseId,
  generateCaseNumber,
} from '@/lib/state/fyll-store';
import { useImagePicker } from '@/hooks/useImagePicker';
import useAuthStore from '@/lib/state/auth-store';
import * as Haptics from 'expo-haptics';

export default function AICaseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string; orderNumber?: string; customerName?: string }>();
  const colors = useThemeColors();
  const imagePicker = useImagePicker();
  const isDark = colors.bg.primary === '#111111';
  const { isDesktop } = useBreakpoint();
  const isWebDesktop = Platform.OS === 'web' && isDesktop;
  const useDesktopCanvas = isWebDesktop && !isDark;
  const canvasBg = useDesktopCanvas ? '#F3F3F5' : colors.bg.primary;
  const panelBg = useDesktopCanvas ? '#FFFFFF' : colors.bg.primary;

  const prefilledOrderId = typeof params.orderId === 'string' ? params.orderId : '';
  const prefilledOrderNumber = typeof params.orderNumber === 'string' ? params.orderNumber : '';
  const prefilledCustomerName = typeof params.customerName === 'string' ? params.customerName : '';

  const addCase = useFyllStore((s) => s.addCase);
  const caseStatuses = useFyllStore((s) => s.caseStatuses);
  const businessId = useAuthStore((s) => s.businessId ?? s.currentUser?.businessId ?? null);
  const currentUser = useAuthStore((s) => s.currentUser);
  const MAX_CASE_SCREENSHOTS = 6;

  const [customerName, setCustomerName] = useState(prefilledCustomerName);
  const [orderNumber, setOrderNumber] = useState(prefilledOrderNumber);
  const [messageText, setMessageText] = useState('');
  const [imageDataUrls, setImageDataUrls] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [draft, setDraft] = useState<CaseDraftData | null>(null);
  const [issueSummary, setIssueSummary] = useState('');
  const [context, setContext] = useState('');
  const [caseType, setCaseType] = useState<CaseType>('Other');
  const [priority, setPriority] = useState<CasePriority>('Medium');
  const [source, setSource] = useState<CaseSource>('Email');

  const handlePickImage = async () => {
    const picked = await imagePicker.pickImage({
      allowsEditing: false,
      quality: 0.85,
    });
    if (!picked) return;

    let hitLimit = false;
    setImageDataUrls((previous) => {
      if (previous.includes(picked)) return previous;
      if (previous.length >= MAX_CASE_SCREENSHOTS) {
        hitLimit = true;
        return previous;
      }
      return [...previous, picked];
    });

    if (hitLimit) {
      Alert.alert(
        'Upload limit reached',
        `You can attach up to ${MAX_CASE_SCREENSHOTS} screenshots for one Fyll AI draft.`
      );
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setImageDataUrls((previous) => previous.filter((_, index) => index !== indexToRemove));
  };

  const handleGenerateDraft = async () => {
    if (!messageText.trim() && imageDataUrls.length === 0) {
      Alert.alert('Add text or image', 'Paste the customer message or upload a screenshot to generate a draft.');
      return;
    }

    setIsParsing(true);
    setDraft(null);

    try {
      const result = await parseCaseDraft({
        messageText: messageText.trim() || undefined,
        imageDataUrls: imageDataUrls.length ? imageDataUrls : undefined,
      });

      if (!result) {
        Alert.alert('Draft not generated', 'Fyll AI could not summarize this case. Please edit manually.');
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDraft(result);
      setIssueSummary(result.issueSummary);
      setContext(result.context);
      setCaseType(result.caseType);
      setPriority(result.priority);
      setSource(result.source);
    } catch (error: any) {
      Alert.alert('Fyll AI failed', error?.message || 'Please try again.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleCreateCase = async () => {
    if (!customerName.trim()) {
      Alert.alert('Customer name required', 'Add a customer name before creating a case.');
      return;
    }
    if (!issueSummary.trim()) {
      Alert.alert('Heading required', 'Generate a draft or add a heading.');
      return;
    }

    const now = new Date().toISOString();
    const status = caseStatuses[0]?.name ?? 'Open';

    const newCase: Case = {
      id: generateCaseId(),
      caseNumber: generateCaseNumber(),
      orderId: prefilledOrderId || undefined,
      customerName: customerName.trim(),
      orderNumber: orderNumber.trim() || undefined,
      type: caseType,
      status,
      priority,
      source,
      issueSummary: issueSummary.trim(),
      originalCustomerMessage: context.trim() || messageText.trim() || undefined,
      attachments: imageDataUrls.length
        ? imageDataUrls.map((imageDataUrl, index) => ({
          id: Math.random().toString(36).slice(2),
          label: `AI Upload ${index + 1}`,
          uri: imageDataUrl,
          preview: imageDataUrl,
          uploadedAt: now,
        }))
        : undefined,
      createdAt: now,
      updatedAt: now,
      createdBy: currentUser?.name,
      updatedBy: currentUser?.name,
    };

    await addCase(newCase, businessId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const confidenceColor = draft?.confidence === 'high'
    ? '#10B981'
    : draft?.confidence === 'medium'
    ? '#F59E0B'
    : '#EF4444';

  return (
    <View className="flex-1" style={{ backgroundColor: canvasBg }}>
      <View
        style={[
          { flex: 1, backgroundColor: panelBg },
          useDesktopCanvas
            ? {
                width: '100%',
                maxWidth: 840,
                alignSelf: 'center',
                borderWidth: 1,
                borderColor: '#E6E6E6',
                borderRadius: 18,
                overflow: 'hidden',
                marginVertical: 12,
              }
            : null,
        ]}
      >
      <SafeAreaView className="flex-1" edges={['top']} style={{ backgroundColor: panelBg }}>
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
            <Sparkles size={20} color="#7C3AED" strokeWidth={2} />
            <Text style={{ color: colors.text.primary }} className="text-lg font-bold ml-2">
              Fyll AI Case Draft
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
          {/* Info */}
          <View
            className="rounded-xl p-4 mt-4 flex-row"
            style={{ backgroundColor: isDark ? '#2E1065' : '#F3E8FF' }}
          >
            <Sparkles size={20} color="#7C3AED" strokeWidth={2} style={{ marginTop: 2 }} />
            <View className="flex-1 ml-3">
              <Text style={{ color: isDark ? '#DDD6FE' : '#6D28D9' }} className="text-sm font-semibold mb-1">
                Draft a case instantly
              </Text>
              <Text style={{ color: isDark ? '#C4B5FD' : '#7C3AED' }} className="text-xs leading-5">
                Paste a customer message and add one or more screenshots. Fyll AI will read all details and generate a heading and context.
              </Text>
            </View>
          </View>

          {/* Customer Info */}
          <View className="mt-6">
            <Text style={{ color: colors.text.primary }} className="text-sm font-semibold mb-2">
              Customer Name *
            </Text>
            <View
              className="rounded-xl px-4 py-3"
              style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border }}
            >
              <TextInput
                placeholder="Enter customer name"
                placeholderTextColor={colors.input.placeholder}
                value={customerName}
                onChangeText={setCustomerName}
                style={{ color: colors.input.text, fontSize: 14 }}
              />
            </View>
          </View>

          <View className="mt-4">
            <Text style={{ color: colors.text.primary }} className="text-sm font-semibold mb-2">
              Order Number (optional)
            </Text>
            <View
              className="rounded-xl px-4 py-3"
              style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border }}
            >
              <TextInput
                placeholder="ORD-001"
                placeholderTextColor={colors.input.placeholder}
                value={orderNumber}
                onChangeText={setOrderNumber}
                style={{ color: colors.input.text, fontSize: 14 }}
              />
            </View>
          </View>

          {/* Message */}
          <View className="mt-6">
            <Text style={{ color: colors.text.primary }} className="text-sm font-semibold mb-2">
              Customer Message
            </Text>
            <View
              className="rounded-xl p-4"
              style={{
                backgroundColor: colors.input.bg,
                borderWidth: 1,
                borderColor: colors.input.border,
                minHeight: 160,
              }}
            >
              <TextInput
                placeholder="Paste the customer complaint here..."
                placeholderTextColor={colors.input.placeholder}
                value={messageText}
                onChangeText={setMessageText}
                multiline
                textAlignVertical="top"
                style={{ color: colors.input.text, fontSize: 14, minHeight: 140 }}
              />
            </View>
          </View>

          {/* Image Upload */}
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
                        style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
                      >
                        <Text style={{ color: '#FFFFFF', fontSize: 12 }}>✕</Text>
                      </Pressable>
                    </View>
                  ))}

                  {imageDataUrls.length < MAX_CASE_SCREENSHOTS ? (
                    <Pressable
                      onPress={handlePickImage}
                      className="rounded-xl items-center justify-center active:opacity-80"
                      style={{
                        backgroundColor: colors.bg.secondary,
                        borderWidth: 1,
                        borderColor: colors.border.light,
                        borderStyle: 'dashed',
                        width: 140,
                        height: 120,
                      }}
                    >
                      <ImagePlus size={20} color={colors.text.tertiary} strokeWidth={1.5} />
                      <Text style={{ color: colors.text.tertiary }} className="text-xs mt-2">
                        Add more
                      </Text>
                    </Pressable>
                  ) : null}
                </ScrollView>
                <Text style={{ color: colors.text.tertiary }} className="text-xs mt-2">
                  {imageDataUrls.length} attached
                </Text>
              </View>
            ) : (
              <Pressable
                onPress={handlePickImage}
                className="rounded-xl items-center justify-center py-6 active:opacity-80"
                style={{ backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.light, borderStyle: 'dashed' }}
              >
                <ImagePlus size={22} color={colors.text.tertiary} strokeWidth={1.5} />
                <Text style={{ color: colors.text.tertiary }} className="text-sm mt-2">
                  Upload screenshot
                </Text>
              </Pressable>
            )}
          </View>

          {/* Generate Draft */}
          <Pressable
            onPress={handleGenerateDraft}
            disabled={isParsing}
            className="mt-6 rounded-full overflow-hidden active:opacity-80"
            style={{ height: 52 }}
          >
            {isParsing ? (
              <View
                className="h-full flex-row items-center justify-center"
                style={{ backgroundColor: colors.border.light }}
              >
                <ActivityIndicator color="#FFFFFF" />
                <Text className="text-white font-semibold ml-2">Generating Draft...</Text>
              </View>
            ) : (
              <LinearGradient
                colors={['#8B5CF6', '#A855F7', '#C084FC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ height: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
              >
                <Sparkles size={18} color="#FFFFFF" strokeWidth={2} />
                <Text className="text-white font-semibold ml-2">Generate Draft</Text>
              </LinearGradient>
            )}
          </Pressable>

          {/* Draft Review */}
          {(draft || issueSummary || context) && (
            <View className="mt-8">
              <View className="flex-row items-center justify-between mb-3">
                <Text style={{ color: colors.text.primary }} className="text-base font-bold">
                  Draft Review
                </Text>
                {draft && (
                  <View className="px-3 py-1 rounded-full" style={{ backgroundColor: `${confidenceColor}20` }}>
                    <Text style={{ color: confidenceColor }} className="text-xs font-semibold">
                      {draft.confidence.toUpperCase()} CONFIDENCE
                    </Text>
                  </View>
                )}
              </View>

              <Text style={{ color: colors.text.primary }} className="text-sm font-semibold mb-2">
                Heading
              </Text>
              <View
                className="rounded-xl px-4 py-3"
                style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border }}
              >
                <TextInput
                  placeholder="Case heading"
                  placeholderTextColor={colors.input.placeholder}
                  value={issueSummary}
                  onChangeText={setIssueSummary}
                  style={{ color: colors.input.text, fontSize: 14 }}
                />
              </View>

              <Text style={{ color: colors.text.primary }} className="text-sm font-semibold mt-4 mb-2">
                Context
              </Text>
              <View
                className="rounded-xl p-4"
                style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border }}
              >
                <TextInput
                  placeholder="Case context"
                  placeholderTextColor={colors.input.placeholder}
                  value={context}
                  onChangeText={setContext}
                  multiline
                  textAlignVertical="top"
                  style={{ color: colors.input.text, fontSize: 14, minHeight: 120 }}
                />
              </View>

              <Text style={{ color: colors.text.primary }} className="text-sm font-semibold mt-4 mb-2">
                Case Type
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {CASE_TYPES.map((type) => {
                  const active = caseType === type;
                  return (
                    <Pressable
                      key={type}
                      onPress={() => setCaseType(type)}
                      className="px-4 py-2 rounded-full active:opacity-80"
                      style={{
                        backgroundColor: active ? '#111111' : colors.bg.secondary,
                        borderWidth: 1,
                        borderColor: active ? '#111111' : colors.border.light,
                      }}
                    >
                      <Text style={{ color: active ? '#FFFFFF' : colors.text.secondary }} className="text-xs font-semibold">
                        {type}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={{ color: colors.text.primary }} className="text-sm font-semibold mt-4 mb-2">
                Priority
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {CASE_PRIORITIES.map((p) => {
                  const active = priority === p;
                  return (
                    <Pressable
                      key={p}
                      onPress={() => setPriority(p)}
                      className="px-4 py-2 rounded-full active:opacity-80"
                      style={{
                        backgroundColor: active ? '#111111' : colors.bg.secondary,
                        borderWidth: 1,
                        borderColor: active ? '#111111' : colors.border.light,
                      }}
                    >
                      <Text style={{ color: active ? '#FFFFFF' : colors.text.secondary }} className="text-xs font-semibold">
                        {p}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={{ color: colors.text.primary }} className="text-sm font-semibold mt-4 mb-2">
                Source
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {CASE_SOURCES.map((s) => {
                  const active = source === s;
                  return (
                    <Pressable
                      key={s}
                      onPress={() => setSource(s)}
                      className="px-4 py-2 rounded-full active:opacity-80"
                      style={{
                        backgroundColor: active ? '#111111' : colors.bg.secondary,
                        borderWidth: 1,
                        borderColor: active ? '#111111' : colors.border.light,
                      }}
                    >
                      <Text style={{ color: active ? '#FFFFFF' : colors.text.secondary }} className="text-xs font-semibold">
                        {s}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          <Pressable
            onPress={handleCreateCase}
            className="mt-8 mb-10 rounded-full items-center justify-center active:opacity-80 flex-row"
            style={{ backgroundColor: isDark ? '#FFFFFF' : '#111111', height: 52 }}
          >
            <Plus size={16} color={isDark ? '#111111' : '#FFFFFF'} strokeWidth={2.5} />
            <Text style={{ color: isDark ? '#111111' : '#FFFFFF' }} className="font-semibold ml-1.5">
              Create Case
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
      </View>
    </View>
  );
}
