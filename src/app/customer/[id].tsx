import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CustomerDetailPanel } from '@/components/CustomerDetailPanel';
import { useThemeColors } from '@/lib/theme';
import useFyllStore, { Customer } from '@/lib/state/fyll-store';

export default function CustomerDetailScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const customers = useFyllStore((s) => s.customers);
  const customer = customers.find((c) => c.id === id);

  const handleEdit = (customer: Customer) => {
    // Navigate back and open edit modal
    // The customers screen will handle the edit modal
    router.back();
  };

  const handleClose = () => {
    router.back();
  };

  if (!customer) {
    // Customer not found, go back
    router.back();
    return null;
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        >
          <CustomerDetailPanel
            customerId={id!}
            onEdit={handleEdit}
            onClose={handleClose}
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
