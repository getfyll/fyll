import { useEffect, useState } from 'react';
import Constants from 'expo-constants';

const ONESIGNAL_SDK_URL = 'https://cdn.onesignal.com/sdks/OneSignalSDK.js';

declare global {
  interface Window {
    OneSignal?: any;
  }
}

const initOneSignal = (appId: string, safariWebId?: string) => {
  if (typeof window === 'undefined' || !window.OneSignal) return;
  window.OneSignal.push(() => {
    window.OneSignal?.init?.({
      appId,
      safari_web_id: safariWebId,
      allowLocalhostAsSecureOrigin: true,
      notifyButton: {
        enable: true,
      },
    });
  });
};

export function useOneSignal() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const appId = Constants.expoConfig?.extra?.onesignalAppId ?? process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID;
    const safariWebId = Constants.expoConfig?.extra?.onesignalSafariWebId ?? process.env.EXPO_PUBLIC_ONESIGNAL_SAFARI_WEB_ID;
    if (!appId) return;

    const handleReady = () => {
      initOneSignal(appId, safariWebId);
      setIsReady(true);
    };

    if (window.OneSignal) {
      handleReady();
      return;
    }

    const existingScript = document.querySelector('script[data-onesignal-sdk]');
    if (existingScript) {
      existingScript.addEventListener('load', handleReady);
      return () => existingScript.removeEventListener('load', handleReady);
    }

    const script = document.createElement('script');
    script.src = ONESIGNAL_SDK_URL;
    script.async = true;
    script.setAttribute('data-onesignal-sdk', 'true');
    script.onload = handleReady;
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return { isReady };
}
