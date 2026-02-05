import { Platform } from 'react-native';
import { useBreakpoint } from '@/lib/useBreakpoint';

/**
 * Safe tab-bar height helper.
 *
 * Some builds / platforms can render a screen outside BottomTabs context
 * (or use a tabs implementation that doesn't provide the height context),
 * which makes `useBottomTabBarHeight()` throw at runtime.
 *
 * This hook always returns a number and never throws.
 */
export function useTabBarHeight(): number {
  const { isDesktop } = useBreakpoint();

  // Keep in sync with `src/app/(tabs)/_layout.tsx` tab bar sizing.
  const height = Platform.OS === 'web' ? 80 : Platform.OS === 'ios' ? 88 : 70;

  // Desktop uses a sidebar and hides the bottom tab bar.
  return isDesktop ? 0 : height;
}
