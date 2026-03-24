import React from 'react';
import { Platform, View, Text, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ClipboardCheck, History, Play } from 'lucide-react-native';
import type { AuditLog } from '@/lib/state/fyll-store';
import type { ThemeColors } from '@/lib/theme';
import { getAuditSummary } from './utils';
import { ProgressRing } from './ProgressRing';

interface AuditHomeViewProps {
  colors: ThemeColors;
  isDark: boolean;
  primaryActionBg: string;
  primaryActionText: string;
  skuCount: number;
  hasActiveAudit: boolean;
  countedItems: number;
  totalItems: number;
  discrepancyCount: number;
  sortedAuditLogs: AuditLog[];
  onBack: () => void;
  onStartAudit: () => void;
  onResumeAudit: () => void;
  onOpenHistory: () => void;
}

const formatLastAuditDateTime = (isoDate: string): string => {
  const parsedDate = new Date(isoDate);
  return parsedDate.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export function AuditHomeView({
  colors,
  isDark,
  primaryActionBg,
  primaryActionText,
  skuCount,
  hasActiveAudit,
  countedItems,
  totalItems,
  discrepancyCount,
  sortedAuditLogs,
  onBack,
  onStartAudit,
  onResumeAudit,
  onOpenHistory,
}: AuditHomeViewProps) {
  const { width } = useWindowDimensions();
  const isLargeLayout = Platform.OS === 'web' || width >= 768;
  const contentMaxWidth = isLargeLayout ? 920 : undefined;
  const horizontalPadding = isLargeLayout ? 16 : 20;

  const pageBg = isDark ? '#0C0C0D' : colors.bg.primary;
  const surfaceBg = isDark ? '#111113' : colors.bg.secondary;
  const cardBg = isDark ? '#1A1A1E' : colors.bg.card;
  const cardBorder = isDark ? '#3A3A40' : colors.border.light;
  const insetBg = isDark ? '#151518' : colors.bg.secondary;
  const progressRatio = totalItems > 0 ? countedItems / totalItems : 0;
  const progressColor = discrepancyCount > 0 ? '#F59E0B' : '#16A34A';

  const lastAudit = sortedAuditLogs.length > 0 ? getAuditSummary(sortedAuditLogs[0]) : null;
  const recentAudits = sortedAuditLogs.slice(0, 6).map(getAuditSummary);

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
            <View>
              <Text style={{ color: colors.text.primary }} className="text-xl font-bold">Inventory Audit</Text>
              <Text style={{ color: colors.text.tertiary }} className="text-xs mt-0.5">{skuCount} SKUs ready</Text>
            </View>
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
          paddingBottom: 36,
        }}
        showsVerticalScrollIndicator={false}
      >
        {lastAudit ? (
          <View
            className="rounded-3xl p-5 mb-4"
            style={{
              backgroundColor: cardBg,
              borderWidth: 1,
              borderColor: cardBorder,
              shadowColor: '#000000',
              shadowOpacity: isDark ? 0.25 : 0.06,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 6 },
            }}
          >
            <Text style={{ color: colors.text.tertiary }} className="text-xs uppercase tracking-widest">Last audit</Text>
            <View className="flex-row items-end justify-between mt-2">
              <View>
                <Text style={{ color: colors.text.primary }} className="text-lg font-bold">{lastAudit.accuracy}% accuracy</Text>
                <Text style={{ color: colors.text.tertiary }} className="text-xs mt-1">{formatLastAuditDateTime(lastAudit.completedAt)}</Text>
              </View>
              <View
                className="rounded-2xl px-3 py-2"
                style={{ backgroundColor: lastAudit.discrepancies === 0 ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)' }}
              >
                <Text
                  className="text-xs font-semibold"
                  style={{ color: lastAudit.discrepancies === 0 ? '#15803D' : '#B45309' }}
                >
                  {lastAudit.discrepancies === 0 ? 'No variance' : `${lastAudit.discrepancies} variance`}
                </Text>
              </View>
            </View>
            <Text style={{ color: colors.text.muted }} className="text-xs mt-3">
              {lastAudit.itemsAudited} items counted by {lastAudit.performedBy}
            </Text>
          </View>
        ) : (
          <View
            className="rounded-3xl p-5 mb-4"
            style={{ backgroundColor: cardBg, borderWidth: 1, borderColor: cardBorder }}
          >
            <Text style={{ color: colors.text.primary }} className="text-lg font-bold">No audits yet</Text>
            <Text style={{ color: colors.text.tertiary }} className="text-sm mt-1">Start your first stock count to create a baseline.</Text>
          </View>
        )}

        {hasActiveAudit && (
          <View
            className="rounded-3xl p-5 mb-4"
            style={{ backgroundColor: cardBg, borderWidth: 1, borderColor: cardBorder }}
          >
            <View className="flex-row items-center justify-between">
              <View>
                <Text style={{ color: colors.text.primary }} className="text-base font-bold">Audit in progress</Text>
                <Text style={{ color: colors.text.tertiary }} className="text-xs mt-1">{countedItems} of {totalItems} counted</Text>
              </View>
              <ProgressRing
                progress={progressRatio}
                progressColor={progressColor}
                trackColor={cardBorder}
                label={`${Math.round(progressRatio * 100)}%`}
                labelColor={colors.text.primary}
              />
            </View>
            <View className="h-2 rounded-full mt-4" style={{ backgroundColor: insetBg }}>
              <View
                className="h-2 rounded-full"
                style={{
                  width: `${totalItems > 0 ? Math.min(100, Math.round((countedItems / totalItems) * 100)) : 0}%`,
                  backgroundColor: discrepancyCount > 0 ? '#F59E0B' : '#16A34A',
                }}
              />
            </View>
            <Pressable
              onPress={onResumeAudit}
              className="rounded-full items-center justify-center mt-4"
              style={{ height: 48, backgroundColor: insetBg, borderWidth: 1, borderColor: cardBorder }}
            >
              <View className="flex-row items-center">
                <Play size={16} color={colors.text.primary} strokeWidth={2} />
                <Text style={{ color: colors.text.primary }} className="font-semibold ml-2">Resume counting</Text>
              </View>
            </Pressable>
          </View>
        )}

        <Pressable
          onPress={onStartAudit}
          className="rounded-full items-center justify-center mb-6"
          style={{ height: 58, backgroundColor: primaryActionBg }}
        >
          <View className="flex-row items-center">
            <ClipboardCheck size={20} color={primaryActionText} strokeWidth={2} />
            <Text style={{ color: primaryActionText }} className="font-bold text-base ml-2">
              {hasActiveAudit ? 'Restart Audit' : 'Start Audit'}
            </Text>
          </View>
        </Pressable>

        <View className="flex-row items-center justify-between mb-3">
          <Text style={{ color: colors.text.primary }} className="text-base font-bold">Recent audits</Text>
          <Pressable onPress={onOpenHistory}>
            <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold">View all</Text>
          </Pressable>
        </View>

        {recentAudits.length > 0 ? (
          <ScrollView
            horizontal
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ gap: 12, paddingRight: 12 }}
            showsHorizontalScrollIndicator={false}
          >
            {recentAudits.map((log) => (
              <Pressable
                key={log.id}
                onPress={onOpenHistory}
                className="rounded-2xl p-4"
                style={{
                  width: 208,
                  backgroundColor: cardBg,
                  borderWidth: 1,
                  borderColor: cardBorder,
                }}
              >
                <Text style={{ color: colors.text.primary }} className="font-semibold">{log.dateLabel}</Text>
                <Text style={{ color: colors.text.muted }} className="text-xs mt-1">{log.itemsAudited} items</Text>
                <View className="flex-row items-center justify-between mt-4">
                  <Text style={{ color: colors.text.secondary }} className="text-sm font-bold">{log.accuracy}%</Text>
                  <View
                    className="px-2 py-1 rounded-lg"
                    style={{ backgroundColor: log.discrepancies === 0 ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)' }}
                  >
                    <Text
                      className="text-xs font-semibold"
                      style={{ color: log.discrepancies === 0 ? '#15803D' : '#B45309' }}
                    >
                      {log.discrepancies === 0 ? 'Accurate' : `${log.discrepancies} off`}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View
            className="rounded-2xl p-4 flex-row items-center"
            style={{ backgroundColor: cardBg, borderWidth: 1, borderColor: cardBorder }}
          >
            <History size={18} color={colors.text.muted} strokeWidth={2} />
            <Text style={{ color: colors.text.tertiary }} className="text-sm ml-2">Audit history appears here after first count.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
