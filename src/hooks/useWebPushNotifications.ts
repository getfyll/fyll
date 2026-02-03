import { useCallback } from 'react';
import { useOneSignal } from './useOneSignal';

declare global {
  interface Window {
    OneSignal?: any;
  }
}

const ONESIGNAL_APP_ID = process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID ?? '';
const ONESIGNAL_REST_API_KEY = process.env.EXPO_PUBLIC_ONESIGNAL_REST_API_KEY ?? '';

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

  const tagWithBusinessId = useCallback((businessId: string) => {
    if (!businessId) return;
    setUserTag('business_id', businessId);
  }, [setUserTag]);

  return { isReady, promptForPermission, setUserTag, tagWithBusinessId };
}

/**
 * Send a push notification to all users tagged with a specific businessId.
 * This calls the OneSignal REST API to deliver the notification.
 */
export async function sendOrderNotification(options: {
  businessId: string;
  orderNumber: string;
  customerName: string;
  totalAmount: string;
  createdBy?: string;
}): Promise<void> {
  const { businessId, orderNumber, customerName, totalAmount, createdBy } = options;

  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY || !businessId) {
    console.log('OneSignal: Missing config, skipping notification');
    return;
  }

  try {
    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        filters: [
          { field: 'tag', key: 'business_id', relation: '=', value: businessId },
        ],
        headings: { en: `New Order #${orderNumber}` },
        contents: {
          en: `${customerName} — ${totalAmount}${createdBy ? ` (by ${createdBy})` : ''}`,
        },
        url: `https://fyll.app/order/${orderNumber}`,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.log('OneSignal notification failed:', errorData);
    }
  } catch (error) {
    console.log('OneSignal notification error:', error);
  }
}
