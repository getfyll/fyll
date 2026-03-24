import { useEffect, useState } from 'react';
import Constants from 'expo-constants';

const ONESIGNAL_SDK_URL = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';

let lastLoggedInUserId: string | null = null;
let loginInFlightUserId: string | null = null;
let oneSignalInitPromise: Promise<void> | null = null;
let oneSignalInitCompleted = false;

const getCurrentExternalId = (oneSignal: any): string | null => {
  const externalId = oneSignal?.User?.externalId;
  return typeof externalId === 'string' && externalId.length > 0 ? externalId : null;
};

const syncUserIdTag = async (oneSignal: any, userId: string) => {
  try {
    await oneSignal.User.addTag('user_id', userId);
  } catch (err) {
    console.warn('[OneSignal] addTag user_id error:', err);
  }
};

const isIdentityConflictError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;

  const status = 'status' in error && typeof error.status === 'number' ? error.status : undefined;
  const code = 'code' in error ? String((error as { code?: unknown }).code ?? '') : '';
  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
  const normalizedMessage = message.toLowerCase();

  return status === 409
    || code === '409'
    || (normalizedMessage.includes('409') && normalizedMessage.includes('conflict'))
    || normalizedMessage.includes('identity');
};

declare global {
  interface Window {
    OneSignalDeferred?: ((os: any) => void)[];
    OneSignal?: any;
  }
}

const getAppId = () =>
  Constants.expoConfig?.extra?.onesignalAppId ?? process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID ?? '';

const getSafariWebId = () =>
  Constants.expoConfig?.extra?.onesignalSafariWebId ?? process.env.EXPO_PUBLIC_ONESIGNAL_SAFARI_WEB_ID ?? '';

const getServiceWorkerUrl = () => {
  if (typeof window === 'undefined') return '/service-worker.js';
  return new URL('/service-worker.js', window.location.origin).toString();
};

const ONESIGNAL_SERVICE_WORKER_PATH = '/onesignal/OneSignalSDKWorker.js';
const ONESIGNAL_SERVICE_WORKER_UPDATER_PATH = '/onesignal/OneSignalSDKUpdaterWorker.js';
const ONESIGNAL_SERVICE_WORKER_SCOPE = '/onesignal/';

/**
 * Set the external user ID on OneSignal so notifications can be targeted
 * to specific Supabase users. This links the browser/device to a user.
 */
const loginOneSignalUser = (userId: string) => {
  if (typeof window === 'undefined' || !userId) return;
  if (lastLoggedInUserId === userId || loginInFlightUserId === userId) return;
  loginInFlightUserId = userId;

  // v16 SDK uses OneSignalDeferred queue
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal: any) => {
    try {
      const existingExternalId = getCurrentExternalId(OneSignal);
      if (existingExternalId === userId) {
        await syncUserIdTag(OneSignal, userId);
        lastLoggedInUserId = userId;
        // Ensure any duplicate root-scope subscriptions are cleaned up
        // even when we were already logged in (handles the first-load case).
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const reg of registrations) {
            const sw = reg.active ?? reg.installing ?? reg.waiting;
            const scriptUrl = sw?.scriptURL ?? '';
            const scope = reg.scope ?? '';
            const isStale =
              (scriptUrl.includes('OneSignalSDKWorker') || scriptUrl.includes('OneSignalSDK.sw')) &&
              !scope.includes('/onesignal');
            if (isStale) {
              console.log('[OneSignal] Removing stale duplicate worker after login:', scope);
              await reg.unregister();
            }
          }
        }
        return;
      }

      if (existingExternalId && existingExternalId !== userId) {
        await OneSignal.logout();
      }

      await OneSignal.login(userId);
      await syncUserIdTag(OneSignal, userId);
      lastLoggedInUserId = userId;
      console.log('[OneSignal] Logged in user:', userId);
    } catch (err) {
      if (isIdentityConflictError(err)) {
        const externalIdAfterConflict = getCurrentExternalId(OneSignal);
        if (externalIdAfterConflict === userId) {
          lastLoggedInUserId = userId;
          return;
        }

        try {
          await OneSignal.logout();
          await OneSignal.login(userId);
          await syncUserIdTag(OneSignal, userId);
          lastLoggedInUserId = userId;
          console.log('[OneSignal] Resolved identity conflict and logged in user:', userId);
          return;
        } catch (retryErr) {
          console.warn('[OneSignal] login retry after identity conflict failed:', retryErr);
        }
      } else {
        console.warn('[OneSignal] login error:', err);
      }
    } finally {
      if (loginInFlightUserId === userId) {
        loginInFlightUserId = null;
      }
    }
  });
};

const logoutOneSignalUser = () => {
  if (typeof window === 'undefined') return;
  loginInFlightUserId = null;
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal: any) => {
    try {
      await OneSignal.logout();
      lastLoggedInUserId = null;
      console.log('[OneSignal] Logged out');
    } catch (err) {
      console.warn('[OneSignal] logout error:', err);
    }
  });
};

export function useOneSignal() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const appId = getAppId();
    if (!appId) {
      console.warn('[OneSignal] No app ID found, skipping init');
      return;
    }

    const queueOneSignalInit = () => {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async (OneSignal: any) => {
        try {
          if (!oneSignalInitPromise) {
            oneSignalInitPromise = (async () => {
              await OneSignal.init({
                appId,
                safari_web_id: getSafariWebId(),
                allowLocalhostAsSecureOrigin: true,
                notifyButton: { enable: true },
                serviceWorkerPath: ONESIGNAL_SERVICE_WORKER_PATH,
                serviceWorkerUpdaterPath: ONESIGNAL_SERVICE_WORKER_UPDATER_PATH,
                serviceWorkerParam: { scope: ONESIGNAL_SERVICE_WORKER_SCOPE },
              });
              oneSignalInitCompleted = true;
              console.log('[OneSignal] Initialized with app ID:', appId);
            })().catch((err) => {
              oneSignalInitPromise = null;
              oneSignalInitCompleted = false;
              throw err;
            });
          }

          await oneSignalInitPromise;
          setIsReady(true);
        } catch (err) {
          console.warn('[OneSignal] init error:', err);
        }
      });
    };

    const bootstrap = async () => {
      if ('serviceWorker' in navigator) {
        try {
          // Unregister any stale root-scope OneSignal service workers from older SDK
          // versions. These create duplicate push subscriptions alongside the current
          // /onesignal/ scoped worker, causing multiple notifications per message.
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(
            registrations
              .filter((reg) => {
                const scope = reg.scope ?? '';
                // Target root-scope workers that are OneSignal-related (not our app SW)
                const isRootScope = scope.endsWith('/') && !scope.includes('/onesignal');
                const sw = reg.active ?? reg.installing ?? reg.waiting;
                const scriptUrl = sw?.scriptURL ?? '';
                const isLegacyOneSignal =
                  scriptUrl.includes('OneSignalSDKWorker') ||
                  scriptUrl.includes('OneSignalSDK.sw');
                return isRootScope && isLegacyOneSignal;
              })
              .map((reg) => {
                console.log('[OneSignal] Removing stale root-scope worker:', reg.scope);
                return reg.unregister();
              })
          );

          await navigator.serviceWorker.register(getServiceWorkerUrl());
          await navigator.serviceWorker.ready;
        } catch (err) {
          console.warn('[OneSignal] service worker pre-registration failed:', err);
        }
      }
      if (oneSignalInitCompleted) {
        setIsReady(true);
      }
      queueOneSignalInit();
    };

    // Don't load script twice.
    if (document.querySelector('script[data-onesignal-sdk]')) {
      void bootstrap();
      return;
    }

    const script = document.createElement('script');
    script.src = ONESIGNAL_SDK_URL;
    script.async = true;
    script.defer = true;
    script.setAttribute('data-onesignal-sdk', 'true');
    document.head.appendChild(script);

    void bootstrap();
  }, []);

  return { isReady, loginOneSignalUser, logoutOneSignalUser };
}
