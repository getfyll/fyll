import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Copy } from 'lucide-react-native';
import { useThemeColors } from '@/lib/theme';
import useAuthStore from '@/lib/state/auth-store';
import { useEffect } from 'react';
import useFyllStore from '@/lib/state/fyll-store';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import * as Clipboard from 'expo-clipboard';

export default function DebugInfoScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const currentUser = useAuthStore((s) => s.currentUser);
  const businessId = useAuthStore((s) => s.businessId);
  const products = useFyllStore((s) => s.products);
  const orders = useFyllStore((s) => s.orders);
  const { businessName } = useBusinessSettings();
  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    if (!currentUser) return;
    if (!isAdmin) {
      router.replace('/(tabs)');
    }
  }, [currentUser, isAdmin, router]);

  const copyBusinessId = async () => {
    if (businessId) {
      await Clipboard.setStringAsync(businessId);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <View
          className="px-5 pt-4 pb-3 flex-row items-center"
          style={{ borderBottomWidth: 1, borderBottomColor: colors.border.light }}
        >
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 rounded-xl items-center justify-center mr-3 active:opacity-50"
            style={{ backgroundColor: colors.bg.secondary }}
          >
            <ChevronLeft size={20} color={colors.text.primary} strokeWidth={2} />
          </Pressable>
          <Text style={{ color: colors.text.primary }} className="text-xl font-bold">
            Business Debug Info
          </Text>
        </View>

        <ScrollView className="flex-1 px-5 pt-6">
          {/* User Email */}
          <View className="mb-4 p-4 rounded-xl" style={{ backgroundColor: colors.bg.secondary }}>
            <Text style={{ color: colors.text.secondary }} className="text-xs font-medium mb-1">
              USER EMAIL
            </Text>
            <Text style={{ color: colors.text.primary }} className="text-base">
              {currentUser?.email || 'Not logged in'}
            </Text>
          </View>

          {/* Business ID */}
          <Pressable
            onPress={copyBusinessId}
            className="mb-4 p-4 rounded-xl active:opacity-80"
            style={{ backgroundColor: '#FEF3C7' }}
          >
            <View className="flex-row items-center justify-between mb-1">
              <Text style={{ color: '#92400E' }} className="text-xs font-medium">
                BUSINESS ID
              </Text>
              <Copy size={16} color="#92400E" />
            </View>
            <Text style={{ color: '#78350F', fontFamily: 'monospace' }} className="text-sm">
              {businessId || 'Not set'}
            </Text>
          </Pressable>

          {/* Business Name */}
          <View className="mb-4 p-4 rounded-xl" style={{ backgroundColor: colors.bg.secondary }}>
            <Text style={{ color: colors.text.secondary }} className="text-xs font-medium mb-1">
              BUSINESS NAME
            </Text>
            <Text style={{ color: colors.text.primary }} className="text-base">
              {businessName || 'Syncing...'}
            </Text>
          </View>

          {/* Local Products */}
          <View className="mb-4 p-4 rounded-xl" style={{ backgroundColor: colors.bg.secondary }}>
            <Text style={{ color: colors.text.secondary }} className="text-xs font-medium mb-2">
              LOCAL PRODUCTS
            </Text>
            <Text style={{ color: colors.text.primary }} className="text-3xl font-bold mb-2">
              {products.length}
            </Text>
            {products.length > 0 && (
              <View>
                <Text style={{ color: colors.text.secondary }} className="text-xs mb-1">
                  Product Names:
                </Text>
                {products.slice(0, 5).map((p) => (
                  <Text key={p.id} style={{ color: colors.text.secondary }} className="text-xs">
                    • {p.name}
                  </Text>
                ))}
                {products.length > 5 && (
                  <Text style={{ color: colors.text.tertiary }} className="text-xs mt-1">
                    ... and {products.length - 5} more
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Instructions */}
          <View className="mb-6 p-4 rounded-xl" style={{ backgroundColor: '#DBEAFE' }}>
            <Text style={{ color: '#1E40AF' }} className="text-xs font-bold mb-2">
              📋 INSTRUCTIONS
            </Text>
            <Text style={{ color: '#1E3A8A' }} className="text-xs leading-5">
              1. Open this page on BOTH iPhone and laptop{'\n'}
              2. Compare the Business IDs{'\n'}
              3. If they're DIFFERENT, that's why products don't sync{'\n'}
              4. You need to use the SAME business on both devices
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
