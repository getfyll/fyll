import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useThemeColors } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import useAuthStore from '@/lib/state/auth-store';
import { useState } from 'react';

export default function DebugBusinessSyncScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const currentUser = useAuthStore((s) => s.currentUser);
  const businessId = useAuthStore((s) => s.businessId);
  const [result, setResult] = useState<string>('');

  const checkProfileStructure = async () => {
    if (!currentUser?.id) {
      setResult('❌ No user logged in');
      return;
    }

    try {
      setResult('🔍 Checking profile structure...');

      // Check if columns exist
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (error) {
        setResult(`❌ Error: ${error.message}\n\nThis likely means the SQL migration hasn't run yet.`);
        return;
      }

      if (!profile) {
        setResult('❌ Profile not found');
        return;
      }

      const hasBusinessName = 'businessName' in profile;
      const hasData = 'data' in profile;

      let message = '✅ Profile found!\n\n';
      message += `User ID: ${currentUser.id}\n`;
      message += `Business ID: ${businessId}\n\n`;
      message += `Has 'businessName' column: ${hasBusinessName ? '✅ YES' : '❌ NO'}\n`;
      message += `Has 'data' column: ${hasData ? '✅ YES' : '❌ NO'}\n\n`;

      if (hasBusinessName || hasData) {
        message += 'Current values:\n';
        if (hasBusinessName) message += `  businessName: "${profile.businessName || '(empty)'}"\n`;
        if (hasData) message += `  data: ${JSON.stringify(profile.data, null, 2)}\n`;
      } else {
        message += '❌ ISSUE: Missing columns!\n\n';
        message += 'The SQL migration needs to be run in Supabase.\n';
        message += 'Go to: Supabase Dashboard → SQL Editor → Run the migration';
      }

      setResult(message);
    } catch (err) {
      setResult(`❌ Unexpected error: ${err}`);
    }
  };

  const testUpdate = async () => {
    if (!currentUser?.id) {
      setResult('❌ No user logged in');
      return;
    }

    try {
      setResult('🔄 Testing update...');

      const testName = `Test Business ${Date.now()}`;
      const { error } = await supabase
        .from('profiles')
        .update({
          businessName: testName,
          data: {
            businessLogo: null,
            businessPhone: '+234 123 456 789',
            businessWebsite: 'test.com',
            returnAddress: 'Test Address',
          },
        })
        .eq('id', currentUser.id);

      if (error) {
        setResult(`❌ Update failed: ${error.message}\n\nCode: ${error.code}`);
        return;
      }

      setResult(`✅ Update successful!\n\nBusiness Name set to: "${testName}"\n\nNow check the other browser to see if it syncs.`);
    } catch (err) {
      setResult(`❌ Unexpected error: ${err}`);
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
          <Text style={{ color: colors.text.primary }} className="text-xl font-bold">Debug Business Sync</Text>
        </View>

        <ScrollView className="flex-1 px-5 pt-6">
          <Text style={{ color: colors.text.secondary }} className="text-sm mb-4">
            Use this tool to diagnose why Business Name isn't syncing across browsers.
          </Text>

          {/* Check Structure Button */}
          <Pressable
            onPress={checkProfileStructure}
            className="rounded-xl items-center justify-center mb-3 active:opacity-80"
            style={{ backgroundColor: '#3B82F6', height: 54 }}
          >
            <Text className="text-white font-semibold text-base">1. Check Profile Structure</Text>
          </Pressable>

          {/* Test Update Button */}
          <Pressable
            onPress={testUpdate}
            className="rounded-xl items-center justify-center mb-6 active:opacity-80"
            style={{ backgroundColor: '#10B981', height: 54 }}
          >
            <Text className="text-white font-semibold text-base">2. Test Update</Text>
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
