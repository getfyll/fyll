import React from 'react';
import { View, Text } from 'react-native';
import { useThemeColors } from '@/lib/theme';

export function SkeletonBox({ width, height, rounded = 'md' }: { width: number | string; height: number; rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full' }) {
  const themeColors = useThemeColors();

  const roundedClass = {
    sm: 'rounded',
    md: 'rounded-lg',
    lg: 'rounded-xl',
    xl: 'rounded-2xl',
    full: 'rounded-full',
  }[rounded];

  return (
    <View
      className={roundedClass}
      style={{
        width: typeof width === 'string' ? '100%' : width,
        height,
        backgroundColor: themeColors.border.light,
        opacity: 0.5,
      }}
    />
  );
}

export function ProductCardSkeleton() {
  const themeColors = useThemeColors();

  return (
    <View
      className="rounded-xl p-4 mb-3"
      style={{ backgroundColor: themeColors.bg.card, borderWidth: 1, borderColor: themeColors.border.light }}
    >
      <View className="flex-row items-center mb-3">
        <SkeletonBox width={48} height={48} rounded="lg" />
        <View className="flex-1 ml-3">
          <SkeletonBox width="70%" height={16} rounded="md" />
          <View className="h-2" />
          <SkeletonBox width="40%" height={12} rounded="md" />
        </View>
        <SkeletonBox width={48} height={24} rounded="full" />
      </View>

      <View className="flex-row items-center justify-between">
        <SkeletonBox width={80} height={14} rounded="md" />
        <SkeletonBox width={100} height={32} rounded="lg" />
      </View>
    </View>
  );
}

export function OrderCardSkeleton() {
  const themeColors = useThemeColors();

  return (
    <View
      className="rounded-xl p-4 mb-3"
      style={{ backgroundColor: themeColors.bg.card, borderWidth: 1, borderColor: themeColors.border.light }}
    >
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-1">
          <SkeletonBox width="50%" height={16} rounded="md" />
          <View className="h-2" />
          <SkeletonBox width="30%" height={12} rounded="md" />
        </View>
        <SkeletonBox width={80} height={24} rounded="full" />
      </View>

      <View className="flex-row items-center justify-between">
        <SkeletonBox width="40%" height={14} rounded="md" />
        <SkeletonBox width={100} height={20} rounded="md" />
      </View>
    </View>
  );
}

export function SyncingOverlay({ message = 'Syncing data...' }: { message?: string }) {
  const themeColors = useThemeColors();

  return (
    <View
      className="absolute inset-0 items-center justify-center"
      style={{
        backgroundColor: `${themeColors.bg.primary}ee`,
        zIndex: 1000,
      }}
    >
      <View className="items-center">
        <View className="mb-4">
          <SkeletonBox width={48} height={48} rounded="full" />
        </View>
        <Text style={{ color: themeColors.text.primary }} className="text-base font-semibold">
          {message}
        </Text>
        <Text style={{ color: themeColors.text.tertiary }} className="text-sm mt-1">
          Please wait...
        </Text>
      </View>
    </View>
  );
}
