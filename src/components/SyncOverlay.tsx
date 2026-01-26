import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';

type SyncOverlayProps = {
  visible: boolean;
};

export function SyncOverlay({ visible }: SyncOverlayProps) {
  if (!visible) return null;

  return (
    <View
      className="absolute inset-0 items-center justify-center"
      style={{ backgroundColor: 'rgba(247, 247, 247, 0.96)', zIndex: 50 }}
    >
      <View className="w-[88%] max-w-md">
        <View className="bg-white rounded-2xl p-6 border border-gray-200">
          <View className="flex-row items-center mb-4">
            <ActivityIndicator size="small" color="#111111" />
            <Text className="ml-3 text-gray-900 font-semibold text-base">Syncing your data...</Text>
          </View>
          <View className="space-y-3">
            <View className="h-4 rounded-full bg-gray-200" />
            <View className="h-4 rounded-full bg-gray-200 w-5/6" />
            <View className="h-4 rounded-full bg-gray-200 w-2/3" />
            <View className="h-16 rounded-xl bg-gray-100" />
            <View className="h-12 rounded-xl bg-gray-100" />
          </View>
        </View>
      </View>
    </View>
  );
}

export default SyncOverlay;
