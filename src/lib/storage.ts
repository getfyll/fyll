import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Cross-platform storage adapter for web and mobile
const isServer = typeof window === 'undefined' || typeof localStorage === 'undefined';

export const storage = Platform.OS === 'web'
  ? {
      getItem: async (key: string) => {
        try {
          if (isServer) return null;
          const value = localStorage.getItem(key);
          if (key === 'fyll-storage' && value && value.length > 1000000) {
            localStorage.removeItem(key);
            return null;
          }
          return value;
        } catch (e) {
          console.error('localStorage getItem error:', e);
          return null;
        }
      },
      setItem: async (key: string, value: string) => {
        try {
          if (isServer) return;
          localStorage.setItem(key, value);
        } catch (e) {
          console.error('localStorage setItem error:', e);
          try {
            if (isServer) return;
            const message = String((e as Error)?.message ?? '');
            if (message.includes('QuotaExceeded')) {
              localStorage.removeItem(key);
              localStorage.setItem(key, value);
            }
          } catch (cleanupError) {
            console.error('localStorage cleanup error:', cleanupError);
          }
        }
      },
      removeItem: async (key: string) => {
        try {
          if (isServer) return;
          localStorage.removeItem(key);
        } catch (e) {
          console.error('localStorage removeItem error:', e);
        }
      },
    }
  : AsyncStorage;
