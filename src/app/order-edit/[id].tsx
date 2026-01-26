import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { OrderEditForm } from '@/components/OrderEditForm';

export default function OrderEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = typeof id === 'string' ? id : '';

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <OrderEditForm
        orderId={orderId}
        showHeader
        onClose={() => router.back()}
      />
    </SafeAreaView>
  );
}
