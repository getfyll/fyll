import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useThemeColors } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import useAuthStore from '@/lib/state/auth-store';
import useFyllStore from '@/lib/state/fyll-store';
import { useState } from 'react';

export default function DebugSyncScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const currentUser = useAuthStore((s) => s.currentUser);
  const businessId = useAuthStore((s) => s.businessId);
  const products = useFyllStore((s) => s.products);
  const orders = useFyllStore((s) => s.orders);
  const [result, setResult] = useState<string>('');

  const checkSync = async () => {
    if (!currentUser?.id) {
      setResult('❌ No user logged in');
      return;
    }

    try {
      setResult('🔍 Checking sync status...\n');

      // Check profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (profileError) {
        setResult((prev) => prev + `\n❌ Profile error: ${profileError.message}`);
        return;
      }

      let info = '✅ YOUR INFO:\n';
      info += `User ID: ${currentUser.id}\n`;
      info += `Email: ${currentUser.email}\n`;
      info += `Business ID (app): ${businessId}\n`;
      info += `Business ID (profile): ${profile?.business_id}\n\n`;

      if (businessId !== profile?.business_id) {
        info += '⚠️ MISMATCH! App business_id != Profile business_id\n\n';
      }

      // Check products in Supabase
      const { data: remoteProducts, error: productsError } = await supabase
        .from('products')
        .select('id, business_id')
        .eq('business_id', businessId || '');

      if (productsError) {
        info += `\n❌ Products error: ${productsError.message}\n`;
      } else {
        info += `📦 PRODUCTS:\n`;
        info += `Local products: ${products.length}\n`;
        info += `Remote products: ${remoteProducts?.length || 0}\n`;
        if (remoteProducts && remoteProducts.length > 0) {
          info += `Remote business_ids: ${[...new Set(remoteProducts.map((p) => p.business_id))].join(', ')}\n`;
        }
        info += '\n';
      }

      // Check orders in Supabase
      const { data: remoteOrders, error: ordersError } = await supabase
        .from('orders')
        .select('id, business_id')
        .eq('business_id', businessId || '');

      if (ordersError) {
        info += `\n❌ Orders error: ${ordersError.message}\n`;
      } else {
        info += `📋 ORDERS:\n`;
        info += `Local orders: ${orders.length}\n`;
        info += `Remote orders: ${remoteOrders?.length || 0}\n`;
        if (remoteOrders && remoteOrders.length > 0) {
          info += `Remote business_ids: ${[...new Set(remoteOrders.map((o) => o.business_id))].join(', ')}\n`;
        }
        info += '\n';
      }

      // Test if we can insert
      info += `\n🧪 TESTING RLS POLICIES:\n`;
      const testProduct = {
        id: `test-${Date.now()}`,
        business_id: businessId,
        data: { name: 'Test Product', price: 100 },
        updated_at: new Date().toISOString(),
      };

      const { error: insertError } = await supabase
        .from('products')
        .insert(testProduct);

      if (insertError) {
        info += `❌ Cannot insert products: ${insertError.message}\n`;
        info += `Code: ${insertError.code}\n\n`;
        info += `This means RLS is blocking you!\n`;
      } else {
        info += `✅ Can insert products!\n`;
        // Clean up test product
        await supabase.from('products').delete().eq('id', testProduct.id);
      }

      setResult(info);
    } catch (err) {
      setResult(`❌ Unexpected error: ${err}`);
    }
  };

  const forceSync = async () => {
    if (!businessId) {
      setResult('❌ No business ID');
      return;
    }

    try {
      setResult('🔄 Force syncing from Supabase...');

      const { data: remoteProducts } = await supabase
        .from('products')
        .select('id, business_id, data, updated_at')
        .eq('business_id', businessId);

      const { data: remoteOrders } = await supabase
        .from('orders')
        .select('id, business_id, data, updated_at')
        .eq('business_id', businessId);

      useFyllStore.setState({
        products: remoteProducts?.map((r) => r.data) || [],
        orders: remoteOrders?.map((r) => r.data) || [],
      });

      setResult(`✅ Synced!\nProducts: ${remoteProducts?.length || 0}\nOrders: ${remoteOrders?.length || 0}`);
    } catch (err) {
      setResult(`❌ Sync failed: ${err}`);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <View className="px-5 pt-4 pb-3 flex-row items-center" style={{ borderBottomWidth: 1, borderBottomColor: colors.border.light }}>
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 rounded-xl items-center justify-center mr-3 active:opacity-50"
            style={{ backgroundColor: colors.bg.secondary }}
          >
            <ChevronLeft size={20} color={colors.text.primary} strokeWidth={2} />
          </Pressable>
          <Text style={{ color: colors.text.primary }} className="text-xl font-bold">Debug Sync</Text>
        </View>

        <ScrollView className="flex-1 px-5 pt-6">
          <Text style={{ color: colors.text.secondary }} className="text-sm mb-4">
            Diagnose why products aren't syncing across devices.
          </Text>

          {/* Check Button */}
          <Pressable
            onPress={checkSync}
            className="rounded-xl items-center justify-center mb-3 active:opacity-80"
            style={{ backgroundColor: '#3B82F6', height: 54 }}
          >
            <Text className="text-white font-semibold text-base">1. Check Sync Status</Text>
          </Pressable>

          {/* Force Sync Button */}
          <Pressable
            onPress={forceSync}
            className="rounded-xl items-center justify-center mb-6 active:opacity-80"
            style={{ backgroundColor: '#10B981', height: 54 }}
          >
            <Text className="text-white font-semibold text-base">2. Force Sync from Supabase</Text>
          </Pressable>

          {/* Result */}
          {result ? (
            <View className="rounded-xl p-4" style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
              <Text style={{ color: colors.text.primary, fontFamily: 'monospace', fontSize: 13, lineHeight: 20 }}>
                {result}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
