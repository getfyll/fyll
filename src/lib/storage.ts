import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Cross-platform storage adapter for web and mobile
const isServer = typeof window === 'undefined' || typeof localStorage === 'undefined';
const FYLL_STORAGE_KEY = 'fyll-storage';
const MAX_SAFE_WEB_STORAGE_SIZE = 4_500_000;
const WEB_PREVIEW_LIMIT = 200;

const toPreviewArray = <T>(value: unknown, limit: number): T[] => {
  if (!Array.isArray(value)) return [];
  return value.slice(0, limit) as T[];
};

const isDataUri = (value: unknown): value is string => (
  typeof value === 'string' && value.trim().startsWith('data:')
);

const stripDataUris = (value: unknown): unknown => {
  if (isDataUri(value)) return undefined;
  if (Array.isArray(value)) return value.map((item) => stripDataUris(item));
  if (!value || typeof value !== 'object') return value;

  const next: Record<string, unknown> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, nested]) => {
    const sanitized = stripDataUris(nested);
    if (sanitized !== undefined) {
      next[key] = sanitized;
    }
  });
  return next;
};

const compactFyllStoragePayload = (rawValue: string): string | null => {
  try {
    const parsed = JSON.parse(rawValue) as { state?: Record<string, unknown>; version?: number };
    if (!parsed || typeof parsed !== 'object' || !parsed.state || typeof parsed.state !== 'object') {
      return null;
    }

    const compactState = {
      ...parsed.state,
      products: toPreviewArray(parsed.state.products, WEB_PREVIEW_LIMIT)
        .map((product) => stripDataUris(product)),
      orders: toPreviewArray(parsed.state.orders, WEB_PREVIEW_LIMIT),
      customers: toPreviewArray(parsed.state.customers, WEB_PREVIEW_LIMIT),
      cases: toPreviewArray(parsed.state.cases, WEB_PREVIEW_LIMIT),
      restockLogs: toPreviewArray(parsed.state.restockLogs, 10),
      procurements: toPreviewArray(parsed.state.procurements, 10),
      expenses: toPreviewArray(parsed.state.expenses, 10),
      auditLogs: toPreviewArray(parsed.state.auditLogs, WEB_PREVIEW_LIMIT),
    };

    return JSON.stringify({ ...parsed, state: compactState });
  } catch {
    return null;
  }
};

export const storage = Platform.OS === 'web'
  ? {
      getItem: async (key: string) => {
        try {
          if (isServer) return null;
          const value = localStorage.getItem(key);
          if (key === FYLL_STORAGE_KEY && value && value.length > MAX_SAFE_WEB_STORAGE_SIZE) {
            const compact = compactFyllStoragePayload(value);
            if (compact) {
              localStorage.setItem(key, compact);
              return compact;
            }
            return value;
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
              if (key === FYLL_STORAGE_KEY) {
                const compact = compactFyllStoragePayload(value);
                if (compact) {
                  localStorage.setItem(key, compact);
                  return;
                }
              }
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
