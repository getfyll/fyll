import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, CheckCircle2, XCircle, Wifi, Database } from 'lucide-react-native';
import { useThemeColors } from '@/lib/theme';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';

type CheckState = 'idle' | 'checking' | 'ok' | 'error';

export default function SupabaseCheckScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const [status, setStatus] = useState<CheckState>('idle');
  const [message, setMessage] = useState('');
  const [details, setDetails] = useState('');

  const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

  const runCheck = async () => {
    setStatus('checking');
    setMessage('Contacting Supabase...');
    setDetails('');

    try {
      const { error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        throw sessionError;
      }

      const { error: pingError } = await supabase.from('profiles').select('id').limit(1);
      if (pingError) {
        setStatus('error');
        setMessage('Connected, but access is blocked.');
        setDetails(pingError.message);
        return;
      }

      setStatus('ok');
      setMessage('Supabase connection looks good.');
      setDetails('You can log in and sync data.');
    } catch (error) {
      const errorMessage = (error as { message?: string })?.message ?? 'Unable to reach Supabase.';
      setStatus('error');
      setMessage('Connection failed.');
      setDetails(errorMessage);
    }
  };

  useEffect(() => {
    runCheck();
  }, []);

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="px-5 pt-4 pb-3 flex-row items-center" style={{ borderBottomWidth: 1, borderBottomColor: colors.border.light }}>
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 rounded-xl items-center justify-center mr-3 active:opacity-50"
            style={{ backgroundColor: colors.bg.secondary }}
          >
            <ChevronLeft size={20} color={colors.text.primary} strokeWidth={2} />
          </Pressable>
          <Text style={{ color: colors.text.primary }} className="text-xl font-bold">
            Supabase Check
          </Text>
        </View>

        <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
          <View className="rounded-2xl p-5 mb-6" style={{ backgroundColor: colors.bg.secondary }}>
            <View className="flex-row items-center mb-3">
              <Database size={18} color={colors.text.secondary} />
              <Text style={{ color: colors.text.secondary }} className="ml-2 text-xs font-semibold uppercase tracking-wider">
                Target Project
              </Text>
            </View>
            <Text style={{ color: colors.text.primary }} className="text-sm">
              {supabaseUrl || 'Missing EXPO_PUBLIC_SUPABASE_URL'}
            </Text>
          </View>

          <View className="rounded-2xl p-6 mb-6 items-center" style={{ backgroundColor: colors.bg.secondary }}>
            {status === 'checking' && (
              <>
                <ActivityIndicator size="small" color={colors.text.primary} />
                <Text style={{ color: colors.text.primary }} className="text-base font-semibold mt-3">
                  Checking connection...
                </Text>
              </>
            )}
            {status === 'ok' && (
              <>
                <CheckCircle2 size={40} color="#22C55E" />
                <Text style={{ color: colors.text.primary }} className="text-base font-semibold mt-3">
                  {message}
                </Text>
                <Text style={{ color: colors.text.tertiary }} className="text-sm mt-2 text-center">
                  {details}
                </Text>
              </>
            )}
            {status === 'error' && (
              <>
                <XCircle size={40} color="#EF4444" />
                <Text style={{ color: colors.text.primary }} className="text-base font-semibold mt-3">
                  {message}
                </Text>
                <Text style={{ color: colors.text.tertiary }} className="text-sm mt-2 text-center">
                  {details}
                </Text>
              </>
            )}
            {status === 'idle' && (
              <>
                <Wifi size={40} color={colors.text.tertiary} />
                <Text style={{ color: colors.text.primary }} className="text-base font-semibold mt-3">
                  Ready to test your connection
                </Text>
              </>
            )}
          </View>

          <Pressable
            onPress={runCheck}
            className="rounded-xl items-center justify-center active:opacity-80"
            style={{ backgroundColor: '#111111', height: 56, opacity: status === 'checking' ? 0.7 : 1 }}
            disabled={status === 'checking'}
          >
            <Text className="text-white font-semibold text-base">
              {status === 'checking' ? 'Checking...' : 'Run Check Again'}
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
