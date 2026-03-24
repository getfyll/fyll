import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useResolvedThemeMode, useThemeColors } from '@/lib/theme';

type SyncOverlayProps = {
  visible: boolean;
};

export function SyncOverlay({ visible }: SyncOverlayProps) {
  const colors = useThemeColors();
  const resolvedThemeMode = useResolvedThemeMode();
  const isDark = resolvedThemeMode === 'dark';

  if (!visible) return null;

  return (
    <View
      className="absolute inset-0 items-center justify-center"
      style={{
        backgroundColor: isDark ? 'rgba(0, 0, 0, 0.72)' : 'rgba(247, 247, 247, 0.96)',
        zIndex: 50,
      }}
    >
      <View className="w-[88%] max-w-md">
        <View
          className="rounded-2xl p-6"
          style={{
            backgroundColor: colors.bg.card,
            borderWidth: 1,
            borderColor: colors.border.light,
          }}
        >
          <View className="flex-row items-center mb-4">
            <ActivityIndicator size="small" color={colors.text.primary} />
            <Text
              className="ml-3 font-semibold text-base"
              style={{ color: colors.text.primary }}
            >
              Syncing your data...
            </Text>
          </View>
          <View className="space-y-3">
            <View className="h-4 rounded-full" style={{ backgroundColor: colors.bg.tertiary }} />
            <View className="h-4 rounded-full w-5/6" style={{ backgroundColor: colors.bg.tertiary }} />
            <View className="h-4 rounded-full w-2/3" style={{ backgroundColor: colors.bg.tertiary }} />
            <View className="h-16 rounded-xl" style={{ backgroundColor: colors.bg.secondary }} />
            <View className="h-12 rounded-xl" style={{ backgroundColor: colors.bg.secondary }} />
          </View>
        </View>
      </View>
    </View>
  );
}

export default SyncOverlay;
