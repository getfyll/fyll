import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Sparkles, Package, ShoppingCart, BarChart3, ShieldCheck } from 'lucide-react-native';
import { useThemeColors } from '@/lib/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FyllLogo } from '@/components/FyllLogo';
import useAuthStore from '@/lib/state/auth-store';

const features = [
  {
    icon: Package,
    title: 'Inventory in one place',
    description: 'Track products, variants, and stock levels across your team.',
  },
  {
    icon: ShoppingCart,
    title: 'Orders without chaos',
    description: 'Centralize orders and keep fulfillment moving fast.',
  },
  {
    icon: BarChart3,
    title: 'Insights that matter',
    description: 'See what sells, what stalls, and what to reorder next.',
  },
  {
    icon: ShieldCheck,
    title: 'Invite your team',
    description: 'Create invite codes and control access by role.',
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const userName = useAuthStore((s) => s.currentUser?.name ?? '');

  const handleGetStarted = async () => {
    await AsyncStorage.setItem('fyll_onboarding_complete', 'true');
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg.primary }} edges={['top', 'bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 px-6 pt-6">
          <View className="items-center mb-10">
            <View
              className="w-20 h-20 rounded-3xl items-center justify-center"
              style={{ backgroundColor: colors.bg.secondary }}
            >
              <Sparkles size={36} color={colors.text.primary} strokeWidth={1.5} />
            </View>
            <View className="mt-6 items-center">
              <FyllLogo width={65} color={colors.text.primary} />
              <Text style={{ color: colors.text.primary }} className="text-3xl font-bold text-center mt-4">
                {userName ? `Welcome, ${userName}` : 'Welcome to Fyll'}
              </Text>
              <Text style={{ color: colors.text.secondary }} className="text-base text-center mt-2">
                Set up your workspace and start running your store in minutes.
              </Text>
            </View>
          </View>

          <View className="mb-10">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <View
                  key={feature.title}                  className="flex-row items-start mb-5 rounded-2xl p-4"
                  style={{ backgroundColor: colors.bg.secondary }}
                >
                  <View
                    className="w-12 h-12 rounded-xl items-center justify-center mr-4"
                    style={{ backgroundColor: 'rgba(0, 0, 0, 0.06)' }}
                  >
                    <Icon size={22} color={colors.text.primary} strokeWidth={1.5} />
                  </View>
                  <View className="flex-1">
                    <Text style={{ color: colors.text.primary }} className="text-base font-semibold mb-1">
                      {feature.title}
                    </Text>
                    <Text style={{ color: colors.text.tertiary }} className="text-sm leading-5">
                      {feature.description}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          <View>
            <Pressable
              onPress={handleGetStarted}
              className="rounded-xl items-center justify-center active:opacity-80"
              style={{ backgroundColor: '#111111', height: 56 }}
            >
              <Text className="text-white font-semibold text-base">Get Started</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
