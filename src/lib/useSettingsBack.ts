import { useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

export function useSettingsBack() {
  const router = useRouter();
  const { from, panel } = useLocalSearchParams<{ from?: string | string[]; panel?: string | string[] }>();

  const fromValue = Array.isArray(from) ? from[0] : from;
  const panelValue = Array.isArray(panel) ? panel[0] : panel;

  return useCallback(() => {
    if (fromValue === 'settings' || Boolean(panelValue)) {
      router.replace('/settings');
      return;
    }
    router.back();
  }, [fromValue, panelValue, router]);
}
