import React from 'react';
import { View, Text } from 'react-native';
import { Sparkles, TrendingDown, TrendingUp } from 'lucide-react-native';
import type { StatsColors } from '@/lib/theme';

export type FyllAiMetricTone = 'positive' | 'negative' | 'neutral';

export type FyllAiMetric = {
  label: string;
  value: string;
  tone?: FyllAiMetricTone;
};

type Recommendation = {
  id: string;
  text: string;
};

export function FyllAiAnalyticsCard({
  title = 'Fyll AI Analytics',
  subtitle,
  score,
  statusLabel,
  headline,
  keyMetrics,
  recommendations,
  colors,
}: {
  title?: string;
  subtitle?: string;
  score: number;
  statusLabel: string;
  headline: string;
  keyMetrics: FyllAiMetric[];
  recommendations: Recommendation[];
  colors: StatsColors;
}) {
  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));
  const scoreTone: FyllAiMetricTone = normalizedScore >= 70 ? 'positive' : normalizedScore >= 50 ? 'neutral' : 'negative';

  const getToneColor = (tone?: FyllAiMetricTone) => {
    if (tone === 'positive') return colors.success;
    if (tone === 'negative') return colors.danger;
    return colors.text.tertiary;
  };

  const ScoreIcon = scoreTone === 'negative' ? TrendingDown : TrendingUp;

  return (
    <View className="mt-4 rounded-2xl p-5" style={colors.getCardStyle()}>
      <View className="flex-row items-center justify-between" style={{ gap: 12 }}>
        <View style={{ flex: 1 }}>
          <View className="flex-row items-center">
            <Sparkles size={16} color={colors.text.tertiary} strokeWidth={2} />
            <Text style={{ color: colors.text.primary }} className="text-base font-bold ml-2">
              {title}
            </Text>
          </View>
          {subtitle ? (
            <Text style={{ color: colors.text.tertiary }} className="text-xs mt-1">
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View
          className="rounded-xl px-3 py-2"
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.bg.input,
            minWidth: 110,
          }}
        >
          <View className="flex-row items-center justify-end">
            <ScoreIcon size={12} color={getToneColor(scoreTone)} strokeWidth={2.5} />
            <Text style={{ color: getToneColor(scoreTone) }} className="text-xs font-semibold ml-1">
              {statusLabel}
            </Text>
          </View>
          <Text style={{ color: colors.text.primary, textAlign: 'right' }} className="text-xl font-bold mt-1">
            {normalizedScore}
          </Text>
          <Text style={{ color: colors.text.tertiary, textAlign: 'right' }} className="text-[10px]">
            health score
          </Text>
        </View>
      </View>

      <Text style={{ color: colors.text.secondary, lineHeight: 20 }} className="text-sm mt-4">
        {headline}
      </Text>

      {keyMetrics.length > 0 ? (
        <View className="flex-row mt-4" style={{ gap: 10 }}>
          {keyMetrics.slice(0, 3).map((metric) => (
            <View
              key={metric.label}
              className="flex-1 rounded-xl px-3 py-3"
              style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg.input }}
            >
              <Text style={{ color: colors.text.tertiary }} className="text-[11px] font-medium">
                {metric.label}
              </Text>
              <Text style={{ color: getToneColor(metric.tone) }} className="text-sm font-bold mt-1">
                {metric.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {recommendations.length > 0 ? (
        <View className="mt-4" style={{ gap: 8 }}>
          {recommendations.slice(0, 3).map((recommendation) => (
            <View key={recommendation.id} className="flex-row" style={{ gap: 8 }}>
              <Text style={{ color: colors.text.tertiary }} className="text-sm mt-[1px]">
                •
              </Text>
              <Text style={{ color: colors.text.secondary, flex: 1, lineHeight: 19 }} className="text-sm">
                {recommendation.text}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
