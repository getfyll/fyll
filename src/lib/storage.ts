import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Cross-platform storage adapter for web and mobile
export const storage = Platform.OS === 'web'
  ? {
      getItem: async (key: string) => {
        try {
          if (typeof window === 'undefined') return null;
          return localStorage.getItem(key);
        } catch (e) {
          console.error('localStorage getItem error:', e);
          return null;
        }
      },
      setItem: async (key: string, value: string) => {
        try {
          if (typeof window === 'undefined') return;
          localStorage.setItem(key, value);
        } catch (e) {
          console.error('localStorage setItem error:', e);
        }
      },
      removeItem: async (key: string) => {
        try {
          if (typeof window === 'undefined') return;
          localStorage.removeItem(key);
        } catch (e) {
          console.error('localStorage removeItem error:', e);
        }
      },
    }
  : AsyncStorage;
