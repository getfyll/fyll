import React from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors, useResolvedThemeMode } from '@/lib/theme';

type BackgroundSyncBannerProps = {
  visible: boolean;
};

export function BackgroundSyncBanner({ visible }: BackgroundSyncBannerProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const resolvedTheme = useResolvedThemeMode();
  const isDark = resolvedTheme === 'dark';

  if (!visible) return null;

  return (
    <View
      style={{
        position: 'absolute',
        top: Math.max(insets.top + 8, 12),
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 40,
        pointerEvents: 'none',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 10,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border.light,
          backgroundColor: isDark ? 'rgba(17, 17, 17, 0.94)' : 'rgba(255, 255, 255, 0.96)',
          ...(Platform.OS === 'web'
            ? ({ boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.45)' : '0 8px 24px rgba(0,0,0,0.12)' } as any)
            : {}),
        }}
      >
        <ActivityIndicator size="small" color={colors.text.primary} style={{ marginTop: 2 }} />
        <View style={{ maxWidth: 360 }}>
          <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '700' }}>
            Showing recent records first
          </Text>
          <Text style={{ color: colors.text.secondary, fontSize: 12, marginTop: 2 }}>
            More orders, customers, and inventory are syncing in the background.
          </Text>
        </View>
      </View>
    </View>
  );
}

export default BackgroundSyncBanner;
