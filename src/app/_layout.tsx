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
import { useEffect, useState } from 'react';
import { useSupabaseSync } from '@/hooks/useSupabaseSync';
import { Platform } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();
const webInitialMetrics = {
  frame: { x: 0, y: 0, width: 0, height: 0 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function RootLayoutNav({ colorScheme }: { colorScheme: 'light' | 'dark' | null | undefined }) {
  const router = useRouter();
  const segments = useSegments();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [isNavigationReady, setIsNavigationReady] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

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
    if (!isHydrated) return;

    const timeout = setTimeout(() => {
      setIsNavigationReady(true);
      SplashScreen.hideAsync();
    }, 0);
    return () => clearTimeout(timeout);
  }, [isHydrated]);

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
  }, [isAuthenticated, segments, isNavigationReady]);

  if (!isHydrated) {
    return null;
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
        <Stack.Screen name="new-expense" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="new-procurement" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', headerShown: false }} />
        <Stack.Screen name="order/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="product/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="customers" options={{ headerShown: false }} />
        <Stack.Screen name="product-variables" options={{ headerShown: false }} />
        <Stack.Screen name="inventory-audit" options={{ headerShown: false }} />
        <Stack.Screen name="category-manager" options={{ headerShown: false }} />
        <Stack.Screen name="label-print" options={{ headerShown: false }} />
        <Stack.Screen name="team" options={{ headerShown: false }} />
        <Stack.Screen name="restock" options={{ headerShown: false }} />
        <Stack.Screen name="add-team-member" options={{ headerShown: false }} />
        <Stack.Screen name="insights/today" options={{ headerShown: false }} />
        <Stack.Screen name="insights/sales" options={{ headerShown: false }} />
        <Stack.Screen name="insights/orders" options={{ headerShown: false }} />
        <Stack.Screen name="insights/customers" options={{ headerShown: false }} />
        <Stack.Screen name="insights/refunds" options={{ headerShown: false }} />
        <Stack.Screen name="insights/locations" options={{ headerShown: false }} />
        <Stack.Screen name="insights/platforms" options={{ headerShown: false }} />
        <Stack.Screen name="insights/logistics" options={{ headerShown: false }} />
        <Stack.Screen name="insights/addons" options={{ headerShown: false }} />
        <Stack.Screen name="business-settings" options={{ headerShown: false }} />
        <Stack.Screen name="account-settings" options={{ headerShown: false }} />
        <Stack.Screen name="pdf-viewer" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="debug-env" options={{ headerShown: false }} />
        <Stack.Screen name="supabase-check" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}



export default function RootLayout() {
  const colorScheme = useColorScheme();

  useSupabaseSync();

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider initialMetrics={Platform.OS === 'web' ? webInitialMetrics : initialWindowMetrics}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
            <RootLayoutNav colorScheme={colorScheme} />
          </KeyboardProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
