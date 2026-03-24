import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Sparkles, X, Send } from 'lucide-react-native';
import type { StatsColors } from '@/lib/theme';
import type { FyllAssistantCard, FyllAssistantResponse } from '@/lib/fyll-ai-assistant';

type DrawerMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  cards?: FyllAssistantCard[];
};

function normalizeAssistantReply(reply: FyllAssistantResponse | string): FyllAssistantResponse {
  if (typeof reply === 'string') {
    return { text: reply, cards: [] };
  }
  return {
    text: String(reply.text ?? '').trim(),
    cards: Array.isArray(reply.cards) ? reply.cards : [],
  };
}

async function streamAssistantText(
  messageId: string,
  fullText: string,
  setMessages: React.Dispatch<React.SetStateAction<DrawerMessage[]>>
): Promise<void> {
  const text = fullText.trim();
  if (!text) return;
  const step = text.length > 300 ? 8 : text.length > 180 ? 5 : 3;
  for (let index = step; index < text.length; index += step) {
    const nextSlice = text.slice(0, index);
    setMessages((previous) => previous.map((message) => (
      message.id === messageId ? { ...message, text: nextSlice } : message
    )));
    await delay(16);
  }
  // Always commit the full text so streamed responses never end mid-word.
  setMessages((previous) => previous.map((message) => (
    message.id === messageId ? { ...message, text } : message
  )));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function FyllAiAssistantDrawer({
  visible,
  onClose,
  title,
  subtitle,
  openingMessage,
  contextBadges = [],
  quickPrompts = [],
  recommendations = [],
  placeholder = 'Ask Fyll AI...',
  colors,
  onAsk,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  openingMessage: string;
  contextBadges?: { label: string; value: string }[];
  quickPrompts?: string[];
  recommendations?: string[];
  placeholder?: string;
  colors: StatsColors;
  onAsk: (question: string, history: { role: 'assistant' | 'user'; text: string }[]) => Promise<FyllAssistantResponse | string> | FyllAssistantResponse | string;
}) {
  const isMobileSurface = Platform.OS !== 'web';
  const [messages, setMessages] = useState<DrawerMessage[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    if (!visible) return;
    setInput('');
    setIsThinking(false);
    setMessages([
      {
        id: `assistant-${Date.now().toString(36)}`,
        role: 'assistant',
        text: openingMessage,
      },
    ]);
  }, [openingMessage, visible]);

  const canSend = useMemo(() => input.trim().length > 0 && !isThinking, [input, isThinking]);

  const handleSend = async (rawMessage?: string) => {
    const message = (rawMessage ?? input).trim();
    if (!message || isThinking) return;

    const userMessage: DrawerMessage = {
      id: `user-${Date.now().toString(36)}`,
      role: 'user',
      text: message,
    };
    setMessages((previous) => [...previous, userMessage]);
    setInput('');
    setIsThinking(true);

    try {
      const reply = await onAsk(message, [...messages, userMessage].map((item) => ({
        role: item.role,
        text: item.text,
      })));
      const normalized = normalizeAssistantReply(reply);
      const assistantMessageId = `assistant-${(Date.now() + 1).toString(36)}`;

      setMessages((previous) => [
        ...previous,
        {
          id: assistantMessageId,
          role: 'assistant',
          text: '',
          cards: normalized.cards,
        },
      ]);

      await streamAssistantText(assistantMessageId, normalized.text, setMessages);
    } catch {
      setMessages((previous) => [
        ...previous,
        {
          id: `assistant-${(Date.now() + 2).toString(36)}`,
          role: 'assistant',
          text: 'I could not process that just now. Please ask again.',
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Pressable
          onPress={onClose}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' }}
        />
        <View
          style={{
            flex: 1,
            width: '100%',
            maxWidth: isMobileSurface ? undefined : 480,
            alignSelf: isMobileSurface ? 'stretch' : 'flex-end',
            backgroundColor: colors.bg.card,
            borderLeftWidth: isMobileSurface ? 0 : 1,
            borderLeftColor: colors.border,
          }}
        >
          <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
            <View style={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Sparkles size={16} color={colors.text.tertiary} strokeWidth={2.25} />
                    <Text style={{ color: colors.text.primary, marginLeft: 6 }} className="text-base font-bold" numberOfLines={1}>
                      {title}
                    </Text>
                  </View>
                  {subtitle ? (
                    <Text style={{ color: colors.text.tertiary }} className="text-xs mt-1" numberOfLines={2}>
                      {subtitle}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={onClose}
                  style={{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.input }}
                >
                  <X size={18} color={colors.text.tertiary} strokeWidth={2.5} />
                </Pressable>
              </View>

              {contextBadges.length > 0 ? (
                <View className="flex-row mt-3" style={{ gap: 8, flexWrap: 'wrap' }}>
                  {contextBadges.slice(0, 4).map((badge) => (
                    <View key={badge.label} className="rounded-full px-3 py-1.5" style={{ backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.divider }}>
                      <Text style={{ color: colors.text.tertiary }} className="text-[10px] font-medium">
                        {badge.label}: <Text style={{ color: colors.text.primary }} className="font-semibold">{badge.value}</Text>
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {quickPrompts.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3" contentContainerStyle={{ gap: 8 }}>
                  {quickPrompts.map((prompt) => (
                    <Pressable
                      key={prompt}
                      onPress={() => handleSend(prompt)}
                      style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.input }}
                    >
                      <Text style={{ color: colors.text.secondary }} className="text-xs font-medium">
                        {prompt}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}
            </View>

            <ScrollView
              ref={scrollRef}
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 14, gap: 10 }}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
              keyboardShouldPersistTaps="handled"
            >
              {messages.map((message) => {
                const isUser = message.role === 'user';
                const cardToneColor = (tone?: FyllAssistantCard['tone']) => {
                  if (tone === 'positive') return colors.success;
                  if (tone === 'negative') return colors.danger;
                  return colors.text.tertiary;
                };
                return (
                  <View
                    key={message.id}
                    style={{
                      alignSelf: isUser ? 'flex-end' : 'flex-start',
                      maxWidth: '90%',
                      borderRadius: 14,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      backgroundColor: isUser ? colors.bar : colors.bg.input,
                      borderWidth: isUser ? 0 : 1,
                      borderColor: isUser ? 'transparent' : colors.divider,
                    }}
                  >
                    <Text style={{ color: isUser ? colors.bg.screen : colors.text.secondary, lineHeight: 20 }} className="text-sm">
                      {message.text}
                    </Text>
                    {!isUser && message.cards && message.cards.length > 0 ? (
                      <View className="mt-3" style={{ gap: 8 }}>
                        {message.cards.map((card, index) => (
                          <View
                            key={`${message.id}-card-${index}`}
                            className="rounded-xl p-3"
                            style={{ borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card }}
                          >
                            <View className="flex-row items-center justify-between">
                              <Text style={{ color: colors.text.tertiary }} className="text-[11px] font-medium">
                                {card.title}
                              </Text>
                              <View className="w-2 h-2 rounded-full" style={{ backgroundColor: cardToneColor(card.tone) }} />
                            </View>
                            <Text style={{ color: colors.text.primary }} className="text-sm font-bold mt-1">
                              {card.value}
                            </Text>
                            {card.hint ? (
                              <Text style={{ color: colors.text.tertiary, lineHeight: 16 }} className="text-[11px] mt-1">
                                {card.hint}
                              </Text>
                            ) : null}
                            {card.action ? (
                              <Text style={{ color: colors.text.secondary, lineHeight: 16 }} className="text-[11px] mt-1.5 font-medium">
                                Next: {card.action}
                              </Text>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })}

              {isThinking ? (
                <View
                  style={{
                    alignSelf: 'flex-start',
                    borderRadius: 14,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    backgroundColor: colors.bg.input,
                    borderWidth: 1,
                    borderColor: colors.divider,
                  }}
                >
                  <Text style={{ color: colors.text.tertiary }} className="text-sm">
                    Fyll AI is thinking...
                  </Text>
                </View>
              ) : null}
            </ScrollView>

            {recommendations.length > 0 ? (
              <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
                <View className="rounded-xl p-3" style={{ borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.input }}>
                  {recommendations.slice(0, 2).map((recommendation, index) => (
                    <Text key={`${recommendation}-${index}`} style={{ color: colors.text.tertiary, lineHeight: 17 }} className="text-xs">
                      • {recommendation}
                    </Text>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={{ paddingHorizontal: 14, paddingBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1, borderWidth: 1, borderColor: colors.divider, borderRadius: 14, backgroundColor: colors.bg.input, paddingHorizontal: 12, paddingVertical: 8 }}>
                  <TextInput
                    value={input}
                    onChangeText={setInput}
                    placeholder={placeholder}
                    placeholderTextColor={colors.text.muted}
                    onKeyPress={(event: any) => {
                      if (Platform.OS !== 'web') return;
                      const key = event?.nativeEvent?.key;
                      const shiftKey = Boolean(event?.nativeEvent?.shiftKey);
                      if (key === 'Enter' && !shiftKey) {
                        event?.preventDefault?.();
                        void handleSend();
                      }
                    }}
                    multiline
                    style={{ color: colors.text.primary, maxHeight: 110, fontSize: 14 }}
                  />
                </View>
                <Pressable
                  onPress={() => handleSend()}
                  disabled={!canSend}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: canSend ? colors.bar : colors.bg.input,
                    borderWidth: canSend ? 0 : 1,
                    borderColor: colors.divider,
                  }}
                >
                  <Send size={16} color={canSend ? colors.bg.screen : colors.text.muted} strokeWidth={2.3} />
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}
