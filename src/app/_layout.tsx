import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/lib/useColorScheme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import useAuthStore from '@/lib/state/auth-store';
import useFyllStore from '@/lib/state/fyll-store';
import { useEffect, useRef, useState } from 'react';
import { useSupabaseSync } from '@/hooks/useSupabaseSync';
import { SyncOverlay } from '@/components/SyncOverlay';
import { BackgroundSyncBanner } from '@/components/BackgroundSyncBanner';
import { Image, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { useWebPushNotifications } from '@/hooks/useWebPushNotifications';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();
WebBrowser.maybeCompleteAuthSession();

const queryClient = new QueryClient();
const webInitialMetrics = {
  frame: { x: 0, y: 0, width: 0, height: 0 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};
const SYNC_OVERLAY_MAX_BLOCK_MS = 6000;
const MIN_APP_LAUNCH_SCREEN_MS = Platform.OS === 'web' ? 2200 : 1500;
const launchLogoLight = require('../../assets/branding/launch-logo-light.png');

function AppLaunchScreen({ colorScheme }: { colorScheme: 'light' | 'dark' | null | undefined }) {
  const logoSource = launchLogoLight;
  const progressWidth = useSharedValue(58);
  const progressOpacity = useSharedValue(0.86);

  useEffect(() => {
    progressWidth.value = withRepeat(
      withSequence(
        withTiming(196, { duration: 950, easing: Easing.out(Easing.cubic) }),
        withTiming(72, { duration: 780, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
    progressOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.82, { duration: 620, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );

    return () => {
      progressWidth.value = 58;
      progressOpacity.value = 0.86;
    };
  }, [progressOpacity, progressWidth]);

  const progressStyle = useAnimatedStyle(() => ({
    width: progressWidth.value,
    opacity: progressOpacity.value,
  }));

  return (
    <LinearGradient
      colors={['#000000', '#050505', '#0A0A0A']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
    >
      <View
        style={{
          width: 320,
          maxWidth: '86%',
          paddingHorizontal: 8,
          paddingVertical: 8,
          alignItems: 'center',
        }}
      >
        <Image
          source={logoSource}
          resizeMode="contain"
          style={{ width: 252, height: 90 }}
        />

        <View
          style={{
            width: 202,
            height: 6,
            borderRadius: 999,
            marginTop: 18,
            overflow: 'hidden',
            backgroundColor: 'rgba(255,255,255,0.18)',
          }}
        >
          <Animated.View
            style={[
              {
                height: 6,
                borderRadius: 999,
                backgroundColor: '#F3F4F6',
              },
              progressStyle,
            ]}
          />
        </View>

        <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 13, marginTop: 12, fontWeight: '500' }}>
          Preparing your workspace...
        </Text>
      </View>
    </LinearGradient>
  );
}

function RootLayoutNav({ colorScheme }: { colorScheme: 'light' | 'dark' | null | undefined }) {
  const router = useRouter();
  const segments = useSegments();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isOfflineMode = useAuthStore((s) => s.isOfflineMode);
  const syncWithSupabaseSession = useAuthStore((s) => s.syncWithSupabaseSession);
  const refreshTeamData = useAuthStore((s) => s.refreshTeamData);
  const currentUserId = useAuthStore((s) => s.currentUser?.id ?? null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [hasHiddenNativeSplash, setHasHiddenNativeSplash] = useState(false);
  const [isBootstrappingApp, setIsBootstrappingApp] = useState(true);
  const bootstrapStartedRef = useRef(false);
  const isNavigationReady = isHydrated && !isBootstrappingApp;

  useEffect(() => {
    const checkHydration = () => {
      const authHydrated = useAuthStore.persist.hasHydrated();
      const fyllHydrated = useFyllStore.persist.hasHydrated();
      if (authHydrated && fyllHydrated) {
        setIsHydrated(true);
        return true;
      }
      return false;
    };

    if (checkHydration()) {
      return;
    }

    const unsubAuth = useAuthStore.persist.onFinishHydration(() => {
      if (checkHydration()) {
        unsubAuth();
        unsubFyll();
      }
    });

    const unsubFyll = useFyllStore.persist.onFinishHydration(() => {
      if (checkHydration()) {
        unsubAuth();
        unsubFyll();
      }
    });

    return () => {
      unsubAuth();
      unsubFyll();
    };
  }, []);

  useEffect(() => {
    if (!isHydrated || hasHiddenNativeSplash) return;
    SplashScreen.hideAsync()
      .catch(() => undefined)
      .finally(() => {
        setHasHiddenNativeSplash(true);
      });
  }, [hasHiddenNativeSplash, isHydrated]);

  useEffect(() => {
    if (!isHydrated || bootstrapStartedRef.current) return;
    bootstrapStartedRef.current = true;

    let cancelled = false;
    const bootstrap = async () => {
      const startedAt = Date.now();
      if (!isOfflineMode) {
        await syncWithSupabaseSession().catch((error) => {
          console.warn('Session restore failed:', error);
        });
      }

      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, MIN_APP_LAUNCH_SCREEN_MS - elapsed);
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      if (!cancelled) {
        setIsBootstrappingApp(false);
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [isHydrated, isOfflineMode, syncWithSupabaseSession]);

  useEffect(() => {
    if (!isHydrated || !isAuthenticated || !currentUserId) return;

    const channel = supabase
      .channel(`auth-role-sync-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${currentUserId}` },
        () => {
          syncWithSupabaseSession().catch((error) => {
            console.warn('Profile role sync failed:', error);
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'team_members', filter: `user_id=eq.${currentUserId}` },
        () => {
          syncWithSupabaseSession().catch((error) => {
            console.warn('Team member role sync failed:', error);
          });
          refreshTeamData().catch((error) => {
            console.warn('Team refresh after role update failed:', error);
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, isAuthenticated, isHydrated, refreshTeamData, syncWithSupabaseSession]);

  useEffect(() => {
    // Wait for the navigation to be ready before attempting navigation
    if (!isNavigationReady) return;

    const inAuthGroup = segments[0] === 'login';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to home if authenticated and on login page
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, segments, isNavigationReady, router]);

  if (!isHydrated || !hasHiddenNativeSplash) {
    return null;
  }

  if (isBootstrappingApp) {
    return <AppLaunchScreen colorScheme={colorScheme} />;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          animation: 'none',
        }}
      >
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        <Stack.Screen name="new-order" options={{ headerShown: false }} />
        <Stack.Screen name="new-product" options={{ headerShown: false }} />
        <Stack.Screen name="new-service" options={{ headerShown: false }} />
        <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', headerShown: false }} />
        <Stack.Screen name="order/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="order-edit/[id]" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="case/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="cases" options={{ headerShown: false }} />
        <Stack.Screen name="product/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="customer/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="expense/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="procurement/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="product-variables" options={{ headerShown: false }} />
        <Stack.Screen name="inventory-audit" options={{ headerShown: false }} />
        <Stack.Screen name="category-manager" options={{ headerShown: false }} />
        <Stack.Screen name="label-print" options={{ headerShown: false }} />
        <Stack.Screen name="fulfillment-pipeline" options={{ headerShown: false }} />
        <Stack.Screen name="order-label-preview" options={{ headerShown: false }} />
        <Stack.Screen name="ai-order" options={{ headerShown: false }} />
        <Stack.Screen name="ai-case" options={{ headerShown: false }} />
        <Stack.Screen name="team" options={{ headerShown: false }} />
        <Stack.Screen name="task/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="restock" options={{ headerShown: false }} />
        <Stack.Screen name="add-team-member" options={{ headerShown: false }} />
        <Stack.Screen name="import-products" options={{ headerShown: false }} />
        <Stack.Screen name="import-customers" options={{ headerShown: false }} />
        <Stack.Screen name="import-orders" options={{ headerShown: false }} />
        <Stack.Screen name="import-ai" options={{ headerShown: false }} />
        <Stack.Screen name="insights/today" options={{ headerShown: false }} />
        <Stack.Screen name="insights/sales" options={{ headerShown: false }} />
        <Stack.Screen name="insights/orders" options={{ headerShown: false }} />
        <Stack.Screen name="insights/customers" options={{ headerShown: false }} />
        <Stack.Screen name="insights/refunds" options={{ headerShown: false }} />
        <Stack.Screen name="insights/locations" options={{ headerShown: false }} />
        <Stack.Screen name="insights/platforms" options={{ headerShown: false }} />
        <Stack.Screen name="insights/logistics" options={{ headerShown: false }} />
        <Stack.Screen name="insights/addons" options={{ headerShown: false }} />
        <Stack.Screen name="insights/services" options={{ headerShown: false }} />
        <Stack.Screen name="business-settings" options={{ headerShown: false }} />
        <Stack.Screen name="order-automation" options={{ headerShown: false }} />
        <Stack.Screen name="account-settings" options={{ headerShown: false }} />
        <Stack.Screen name="pdf-viewer" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="debug-env" options={{ headerShown: false }} />
        <Stack.Screen name="debug-info" options={{ headerShown: false }} />
        <Stack.Screen name="debug-business" options={{ headerShown: false }} />
        <Stack.Screen name="supabase-check" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}



export default function RootLayout() {
  const colorScheme = useColorScheme();

  const { isInitialized, isSyncing } = useSupabaseSync();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const businessId = useAuthStore((s) => s.businessId);
  const currentUserId = useAuthStore((s) => s.currentUser?.id ?? null);
  const productCount = useFyllStore((s) => s.products.length);
  const orderCount = useFyllStore((s) => s.orders.length);
  const customerCount = useFyllStore((s) => s.customers.length);
  const caseCount = useFyllStore((s) => s.cases.length);
  const isBackgroundSyncing = useFyllStore((s) => s.isBackgroundSyncing);
  const [showSyncOverlay, setShowSyncOverlay] = useState(false);
  const syncBlockStartedAtRef = useRef<number | null>(null);
  const { isReady, promptForPermission, setUserTag, tagWithBusinessId, loginUser, logoutUser } = useWebPushNotifications();
  useEffect(() => {
    const hasBootData = productCount > 0 || orderCount > 0 || customerCount > 0 || caseCount > 0;
    const shouldBlock = isAuthenticated && !isInitialized && isSyncing && !hasBootData;

    if (!shouldBlock) {
      syncBlockStartedAtRef.current = null;
      setShowSyncOverlay(false);
      return;
    }

    const startedAt = syncBlockStartedAtRef.current ?? Date.now();
    syncBlockStartedAtRef.current = startedAt;
    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs >= SYNC_OVERLAY_MAX_BLOCK_MS) {
      setShowSyncOverlay(false);
      return;
    }

    const showDelayMs = 700;
    const timeout = setTimeout(() => {
      setShowSyncOverlay(true);
    }, showDelayMs);

    const forceHide = setTimeout(() => {
      setShowSyncOverlay(false);
    }, Math.max(0, SYNC_OVERLAY_MAX_BLOCK_MS - elapsedMs));

    return () => {
      clearTimeout(timeout);
      clearTimeout(forceHide);
    };
  }, [isAuthenticated, isInitialized, isSyncing, productCount, orderCount, customerCount, caseCount]);

  useEffect(() => {
    if (!isReady) return;

    if (!isAuthenticated) {
      logoutUser();
      return;
    }
    // Link this device/browser to the Supabase user ID in OneSignal
    // so push notifications can be delivered to specific users
    if (currentUserId) {
      loginUser(currentUserId);
      setUserTag('user_id', currentUserId);
    }
    if (businessId) {
      tagWithBusinessId(businessId);
    }
    // Request push permission — no-op if already granted/denied
    promptForPermission();
  }, [isReady, isAuthenticated, businessId, currentUserId, promptForPermission, setUserTag, tagWithBusinessId, loginUser, logoutUser]);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider initialMetrics={Platform.OS === 'web' ? webInitialMetrics : initialWindowMetrics}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
            <RootLayoutNav colorScheme={colorScheme} />
            <SyncOverlay visible={showSyncOverlay} />
            <BackgroundSyncBanner visible={isAuthenticated && isInitialized && isBackgroundSyncing} />
          </KeyboardProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
