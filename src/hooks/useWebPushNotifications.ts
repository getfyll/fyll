import { useCallback } from 'react';
import { useOneSignal } from './useOneSignal';

declare global {
  interface Window {
    OneSignal?: any;
  }
}

export function useWebPushNotifications() {
  const { isReady } = useOneSignal();

  const promptForPermission = useCallback(() => {
    if (typeof window === 'undefined' || !isReady || !window.OneSignal) return;
    window.OneSignal.push(() => {
      window.OneSignal.showNativePrompt?.();
    });
  }, [isReady]);

  const setUserTag = useCallback((key: string, value: string) => {
    if (typeof window === 'undefined' || !isReady || !window.OneSignal) return;
    window.OneSignal.push(() => {
      window.OneSignal.sendTag?.(key, value);
    });
  }, [isReady]);

  return { isReady, promptForPermission, setUserTag };
}
