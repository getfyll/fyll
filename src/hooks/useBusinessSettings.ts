import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useAuthStore from '@/lib/state/auth-store';

export interface BusinessSettings {
  businessName: string;
  businessLogo: string | null;
  businessPhone: string;
  businessWebsite: string;
  returnAddress: string;
}

interface BusinessSettingsResult {
  businessName: string;
  businessLogo: string | null;
  businessPhone: string;
  businessWebsite: string;
  returnAddress: string;
  isLoading: boolean;
  updateBusinessName: (name: string) => Promise<{ success: boolean; error?: string }>;
  updateBusinessLogo: (logoUri: string | null) => Promise<void>;
  saveSettings: (settings: Partial<BusinessSettings>) => Promise<{ success: boolean; error?: string }>;
}

const BUSINESS_SETTINGS_KEY = 'fyll_business_settings';
const getSettingsKey = (businessId?: string | null) =>
  businessId ? `${BUSINESS_SETTINGS_KEY}:${businessId}` : BUSINESS_SETTINGS_KEY;

const DEFAULT_SETTINGS: BusinessSettings = {
  businessName: '',
  businessLogo: null,
  businessPhone: '',
  businessWebsite: '',
  returnAddress: '',
};

/**
 * Hook for managing business settings
 * Persists settings using AsyncStorage
 */
export function useBusinessSettings(): BusinessSettingsResult {
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const businessId = useAuthStore((s) => s.businessId);

  // Load settings on mount or when business changes
  useEffect(() => {
    loadSettings();
  }, [businessId]);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const key = getSettingsKey(businessId);
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<BusinessSettings>;
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
        return;
      }

      // Only use legacy key when there is no business selected
      if (!businessId) {
        const legacy = await AsyncStorage.getItem(BUSINESS_SETTINGS_KEY);
        if (legacy) {
          const parsed = JSON.parse(legacy) as Partial<BusinessSettings>;
          setSettings({ ...DEFAULT_SETTINGS, ...parsed });
        }
      }
    } catch {
      console.log('Failed to load business settings');
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettingsToStorage = async (newSettings: BusinessSettings): Promise<{ success: boolean; error?: string }> => {
    // Validate business name is not empty
    if (!newSettings.businessName.trim()) {
      return { success: false, error: 'Business name cannot be empty' };
    }

    try {
      const key = getSettingsKey(businessId);
      await AsyncStorage.setItem(key, JSON.stringify(newSettings));
      setSettings(newSettings);
      return { success: true };
    } catch {
      return { success: false, error: 'Failed to save settings' };
    }
  };

  const updateBusinessName = useCallback(async (name: string): Promise<{ success: boolean; error?: string }> => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return { success: false, error: 'Business name cannot be empty' };
    }

    const newSettings: BusinessSettings = {
      ...settings,
      businessName: trimmedName,
    };
    return saveSettingsToStorage(newSettings);
  }, [settings]);

  const updateBusinessLogo = useCallback(async (logoUri: string | null): Promise<void> => {
    const newSettings: BusinessSettings = {
      ...settings,
      businessLogo: logoUri,
    };
    await saveSettingsToStorage(newSettings);
  }, [settings]);

  const saveSettings = useCallback(async (partialSettings: Partial<BusinessSettings>): Promise<{ success: boolean; error?: string }> => {
    const newSettings: BusinessSettings = {
      ...settings,
      ...partialSettings,
    };

    // Validate business name
    if (partialSettings.businessName !== undefined && !partialSettings.businessName.trim()) {
      return { success: false, error: 'Business name cannot be empty' };
    }

    return saveSettingsToStorage(newSettings);
  }, [settings]);

  return {
    businessName: settings.businessName,
    businessLogo: settings.businessLogo,
    businessPhone: settings.businessPhone,
    businessWebsite: settings.businessWebsite,
    returnAddress: settings.returnAddress,
    isLoading,
    updateBusinessName,
    updateBusinessLogo,
    saveSettings,
  };
}
