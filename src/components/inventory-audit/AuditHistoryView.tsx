import React from 'react';
import { Platform, View, Text, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronDown, ChevronLeft, ChevronRight, History } from 'lucide-react-native';
import type { AuditLog } from '@/lib/state/fyll-store';
import type { ThemeColors } from '@/lib/theme';
import { getAccuracyPercentage } from './utils';

interface AuditHistoryViewProps {
  isDark: boolean;
  colors: ThemeColors;
  sortedAuditLogs: AuditLog[];
  expandedAuditId: string | null;
  onBack: () => void;
  onToggleExpanded: (auditId: string) => void;
}

export function AuditHistoryView({
  isDark,
  colors,
  sortedAuditLogs,
  expandedAuditId,
  onBack,
  onToggleExpanded,
}: AuditHistoryViewProps) {
  const { width } = useWindowDimensions();
  const isLargeLayout = Platform.OS === 'web' || width >= 768;
  const contentMaxWidth = isLargeLayout ? 920 : undefined;
  const horizontalPadding = isLargeLayout ? 16 : 20;

  const pageBg = isDark ? '#0C0C0D' : colors.bg.primary;
  const surfaceBg = isDark ? '#111113' : colors.bg.secondary;
  const cardBg = isDark ? '#1A1A1E' : colors.bg.card;
  const cardBorder = isDark ? '#3A3A40' : colors.border.light;
  const insetBg = isDark ? '#151518' : colors.bg.secondary;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: pageBg }} edges={['top']}>
      <View style={{ borderBottomWidth: 1, borderBottomColor: cardBorder, backgroundColor: pageBg }}>
        <View
          style={{
            width: '100%',
            maxWidth: contentMaxWidth,
            alignSelf: 'center',
            paddingHorizontal: horizontalPadding,
            paddingTop: 16,
            paddingBottom: 12,
          }}
        >
          <View className="flex-row items-center">
            <Pressable
              onPress={onBack}
              className="w-10 h-10 rounded-full items-center justify-center mr-3"
              style={{ backgroundColor: insetBg, borderWidth: 1, borderColor: cardBorder }}
            >
              <ChevronLeft size={20} color={colors.text.primary} strokeWidth={2} />
            </Pressable>
            <Text style={{ color: colors.text.primary }} className="text-xl font-bold">Audit History</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: surfaceBg }}
        contentContainerStyle={{
          width: '100%',
          maxWidth: contentMaxWidth,
          alignSelf: 'center',
          paddingHorizontal: horizontalPadding,
          paddingTop: 16,
          paddingBottom: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {sortedAuditLogs.length === 0 ? (
          <View
            className="rounded-3xl p-6 items-center"
            style={{ backgroundColor: cardBg, borderWidth: 1, borderColor: cardBorder }}
          >
            <History size={28} color={colors.text.muted} strokeWidth={2} />
            <Text style={{ color: colors.text.primary }} className="font-bold mt-3">No audits yet</Text>
            <Text style={{ color: colors.text.tertiary }} className="text-sm text-center mt-1">
              Your completed counts will appear here.
            </Text>
          </View>
        ) : (
          sortedAuditLogs.map((log) => {
            const isExpanded = expandedAuditId === log.id;
            const sortedItems = [...(log.items ?? [])].sort(
              (a, b) => Math.abs(b.discrepancy) - Math.abs(a.discrepancy)
            );
            const accuracy = getAccuracyPercentage(sortedItems);

            return (
              <View key={log.id} className="mb-3">
                <Pressable
                  onPress={() => onToggleExpanded(log.id)}
                  className="rounded-2xl overflow-hidden"
                  style={{ backgroundColor: cardBg, borderWidth: 1, borderColor: cardBorder }}
                >
                  <View className="px-4 py-4 flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1 pr-2">
                      {isExpanded ? (
                        <ChevronDown size={18} color={colors.text.tertiary} strokeWidth={2} />
                      ) : (
                        <ChevronRight size={18} color={colors.text.tertiary} strokeWidth={2} />
                      )}
                      <View className="ml-2">
                        <Text style={{ color: colors.text.primary }} className="font-bold">
                          {new Date(log.completedAt).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </Text>
                        <Text style={{ color: colors.text.muted }} className="text-xs mt-0.5">
                          {log.itemsAudited} items • {accuracy}% accurate
                        </Text>
                      </View>
                    </View>
                    <View
                      className="px-2 py-1 rounded-md"
                      style={{ backgroundColor: log.discrepancies === 0 ? 'rgba(34,197,94,0.14)' : 'rgba(245,158,11,0.14)' }}
                    >
                      <Text
                        className="text-xs font-semibold"
                        style={{ color: log.discrepancies === 0 ? '#15803D' : '#B45309' }}
                      >
                        {log.discrepancies === 0 ? 'Accurate' : `${log.discrepancies} off`}
                      </Text>
                    </View>
                  </View>

                  {isExpanded ? (
                    <View
                      className="px-4 pb-3"
                      style={{ borderTopWidth: 1, borderTopColor: cardBorder, backgroundColor: insetBg }}
                    >
                      {sortedItems.length === 0 ? (
                        <Text style={{ color: colors.text.tertiary }} className="text-sm py-3">No item-level details recorded.</Text>
                      ) : (
                        sortedItems.map((item) => (
                          <View
                            key={`${log.id}-${item.variantId}`}
                            className="py-3 flex-row items-center justify-between"
                            style={{ borderBottomWidth: 1, borderBottomColor: cardBorder }}
                          >
                            <View className="flex-1 pr-3">
                              <Text style={{ color: colors.text.secondary }} className="text-sm font-semibold" numberOfLines={1}>
                                {item.productName}
                              </Text>
                              <Text style={{ color: colors.text.muted }} className="text-xs" numberOfLines={1}>
                                {item.variantName} • SKU {item.sku}
                              </Text>
                            </View>
                            <View className="items-end">
                              <Text style={{ color: colors.text.tertiary }} className="text-xs">{item.actualStock} / {item.expectedStock}</Text>
                              <Text
                                className="text-xs font-semibold mt-1"
                                style={{ color: item.discrepancy >= 0 ? '#15803D' : '#B91C1C' }}
                              >
                                {item.discrepancy >= 0 ? '+' : ''}{item.discrepancy}
                              </Text>
                            </View>
                          </View>
                        ))
                      )}
                    </View>
                  ) : null}
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
