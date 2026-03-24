import React from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '@/lib/theme';
import { CaseDetailPanel } from '@/components/CaseDetailPanel';

export default function CaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const router = useRouter();

  const handleClose = () => {
    router.back();
  };

  const handleNavigateToOrder = (orderId: string) => {
    router.push(`/orders/${orderId}`);
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.bg.primary }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false, title: '' }} />
      <CaseDetailPanel
        caseId={id}
        onClose={handleClose}
        onNavigateToOrder={handleNavigateToOrder}
        showBackButton
      />
    </SafeAreaView>
  );
}
