import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import useAuthStore from '@/lib/state/auth-store';
import useFyllStore from '@/lib/state/fyll-store';
import { Copy, ArrowLeft } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';

export default function DebugBusinessScreen() {
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.currentUser);
  const businessId = useAuthStore((s) => s.businessId);
  const products = useFyllStore((s) => s.products);
  const businessName = useFyllStore((s) => s.businessName);

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: '#EEEEEE' }}>
          <Pressable
            onPress={() => router.back()}
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}
          >
            <ArrowLeft size={20} color="#000000" />
            <Text style={{ marginLeft: 8, fontSize: 16 }}>Back</Text>
          </Pressable>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#000000' }}>
            Business Debug Info
          </Text>
        </View>

        <ScrollView style={{ flex: 1, padding: 20 }}>
          {/* User Info */}
          <View style={{ marginBottom: 24, padding: 16, backgroundColor: '#F5F5F5', borderRadius: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#666', marginBottom: 8 }}>
              USER EMAIL
            </Text>
            <Text style={{ fontSize: 16, color: '#000', fontFamily: 'monospace', marginBottom: 4 }}>
              {currentUser?.email || 'Not logged in'}
            </Text>
          </View>

          {/* Business ID */}
          <View style={{ marginBottom: 24, padding: 16, backgroundColor: '#FEF3C7', borderRadius: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#92400E' }}>
                BUSINESS ID
              </Text>
              <Pressable
                onPress={() => businessId && copyToClipboard(businessId)}
                style={{ padding: 8 }}
              >
                <Copy size={16} color="#92400E" />
              </Pressable>
            </View>
            <Text style={{ fontSize: 14, color: '#92400E', fontFamily: 'monospace', lineHeight: 20 }}>
              {businessId || '❌ NO BUSINESS ID'}
            </Text>
          </View>

          {/* Business Name */}
          <View style={{ marginBottom: 24, padding: 16, backgroundColor: '#F5F5F5', borderRadius: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#666', marginBottom: 8 }}>
              BUSINESS NAME
            </Text>
            <Text style={{ fontSize: 16, color: '#000', marginBottom: 4 }}>
              {businessName || 'Not set'}
            </Text>
          </View>

          {/* Products Count */}
          <View style={{ marginBottom: 24, padding: 16, backgroundColor: '#F5F5F5', borderRadius: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#666', marginBottom: 8 }}>
              LOCAL PRODUCTS
            </Text>
            <Text style={{ fontSize: 32, color: '#000', fontWeight: 'bold', marginBottom: 8 }}>
              {products.length}
            </Text>
            {products.length > 0 && (
              <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E5E5' }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 8 }}>
                  Product Names:
                </Text>
                {products.map((p) => (
                  <Text key={p.id} style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                    • {p.name}
                  </Text>
                ))}
              </View>
            )}
          </View>

          {/* Instructions */}
          <View style={{ padding: 16, backgroundColor: '#DBEAFE', borderRadius: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#1E40AF', marginBottom: 8 }}>
              📋 INSTRUCTIONS
            </Text>
            <Text style={{ fontSize: 12, color: '#1E40AF', lineHeight: 18 }}>
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
