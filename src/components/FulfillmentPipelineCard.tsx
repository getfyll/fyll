import React from 'react';
import { Pressable, View, Text } from 'react-native';
import { CheckCircle2, ChevronRight, Package, Truck } from 'lucide-react-native';
import { useThemeColors } from '@/lib/theme';
import { useBreakpoint } from '@/lib/useBreakpoint';

export type FulfillmentStageKey = 'processing' | 'dispatch' | 'delivered';

export type FulfillmentCounts = Record<FulfillmentStageKey, number>;

const STAGE_META: Record<
  FulfillmentStageKey,
  { label: string; color: string; Icon: typeof Package }
> = {
  processing: { label: 'Processing', color: '#3B82F6', Icon: Package },
  dispatch: { label: 'Dispatched', color: '#F59E0B', Icon: Truck },
  delivered: { label: 'Delivered', color: '#22C55E', Icon: CheckCircle2 },
};

const formatCount = (value: number) => String(Math.max(0, value));

export function FulfillmentPipelineCard({
  counts,
  onPress,
  onStagePress,
}: {
  counts: FulfillmentCounts;
  onPress: () => void;
  onStagePress?: (stage: FulfillmentStageKey) => void;
}) {
  const colors = useThemeColors();
  const { isMobile } = useBreakpoint();
  const total = counts.processing + counts.dispatch + counts.delivered;

  return (
    <View
      className="rounded-2xl p-4"
      style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}
    >
      <View className="flex-row items-center">
        <View className="w-10 h-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: colors.bg.secondary }}>
          <Truck size={20} color={colors.text.primary} strokeWidth={2} />
        </View>
        <View className="flex-1">
          <Text style={{ color: colors.text.primary }} className="font-bold text-base">
            Fulfillment
          </Text>
          <Text style={{ color: colors.text.tertiary }} className="text-xs">
            {total} orders in fulfillment
          </Text>
        </View>
        <Pressable
          onPress={onPress}
          className="flex-row items-center px-2 py-1 active:opacity-70"
        >
          <Text style={{ color: colors.text.primary }} className="text-xs font-semibold mr-1">
            View All
          </Text>
          <ChevronRight size={14} color={colors.text.primary} strokeWidth={2} />
        </Pressable>
      </View>

      {isMobile ? (
        <View className="mt-4" style={{ borderTopWidth: 1, borderTopColor: colors.border.light }}>
          {(Object.keys(STAGE_META) as FulfillmentStageKey[]).map((key, index, arr) => {
            const meta = STAGE_META[key];
            const Icon = meta.Icon;
            return (
              <Pressable
                key={key}
                onPress={() => onStagePress?.(key)}
                className="active:opacity-80"
                style={{
                  paddingVertical: 12,
                  borderBottomWidth: index === arr.length - 1 ? 0 : 1,
                  borderBottomColor: colors.border.light,
                }}
              >
                <View className="flex-row items-center">
                  <View
                    className="w-9 h-9 rounded-xl items-center justify-center mr-3"
                    style={{ backgroundColor: `${meta.color}18`, borderWidth: 1, borderColor: `${meta.color}30` }}
                  >
                    <Icon size={18} color={meta.color} strokeWidth={2} />
                  </View>
                  <Text style={{ color: colors.text.primary }} className="text-sm font-semibold flex-1">
                    {meta.label}
                  </Text>
                  <Text style={{ color: colors.text.primary }} className="text-xl font-bold mr-2">
                    {formatCount(counts[key])}
                  </Text>
                  <ChevronRight size={18} color={colors.text.muted} strokeWidth={2} />
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View className="mt-4" style={{ borderTopWidth: 1, borderTopColor: colors.border.light }}>
          <View className="flex-row">
            {(Object.keys(STAGE_META) as FulfillmentStageKey[]).map((key, index) => {
              const meta = STAGE_META[key];
              const Icon = meta.Icon;
              return (
                <Pressable
                  key={key}
                  onPress={() => onStagePress?.(key)}
                  className="flex-1 active:opacity-80"
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 10,
                    borderRightWidth: index === 2 ? 0 : 1,
                    borderRightColor: colors.border.light,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View
                      className="w-8 h-8 rounded-lg items-center justify-center mr-2"
                      style={{ backgroundColor: `${meta.color}18`, borderWidth: 1, borderColor: `${meta.color}30` }}
                    >
                      <Icon size={16} color={meta.color} strokeWidth={2} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold" numberOfLines={1}>
                        {meta.label}
                      </Text>
                      <Text style={{ color: colors.text.primary }} className="text-xl font-bold tracking-tight mt-0.5" numberOfLines={1}>
                        {formatCount(counts[key])}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}
