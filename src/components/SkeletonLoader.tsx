import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useThemeColors } from '@/lib/theme';

export function SkeletonBox({ width, height, rounded = 'md' }: { width: number | string; height: number; rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full' }) {
  const themeColors = useThemeColors();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const roundedClass = {
    sm: 'rounded',
    md: 'rounded-lg',
    lg: 'rounded-xl',
    xl: 'rounded-2xl',
    full: 'rounded-full',
  }[rounded];

  return (
    <Animated.View
      className={roundedClass}
      style={[
        {
          width: typeof width === 'string' ? undefined : width,
          height,
          backgroundColor: themeColors.border.light,
        },
        typeof width === 'string' && { width: '100%' },
        animatedStyle,
      ]}
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
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 200 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      className="absolute inset-0 items-center justify-center"
      style={[
        {
          backgroundColor: `${themeColors.bg.primary}ee`,
          zIndex: 1000,
        },
        animatedStyle,
      ]}
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
    </Animated.View>
  );
}
