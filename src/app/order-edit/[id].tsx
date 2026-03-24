import React from 'react';
import { View, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { OrderEditForm } from '@/components/OrderEditForm';
import { useBreakpoint } from '@/lib/useBreakpoint';
import { useThemeColors } from '@/lib/theme';

export default function OrderEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = typeof id === 'string' ? id : '';
  const { isDesktop } = useBreakpoint();
  const colors = useThemeColors();
  const isWebDesktop = Platform.OS === 'web' && isDesktop;

  if (isWebDesktop) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg.primary,
          alignItems: 'center',
          paddingVertical: 24,
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 640,
            flex: 1,
            borderRadius: 20,
            overflow: 'hidden',
            backgroundColor: colors.bg.secondary,
            borderWidth: 1,
            borderColor: colors.border.light,
          }}
        >
          <OrderEditForm
            orderId={orderId}
            showHeader
            onClose={() => router.back()}
          />
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.bg.secondary }}>
      <OrderEditForm
        orderId={orderId}
        showHeader
        onClose={() => router.back()}
      />
    </SafeAreaView>
  );
}
