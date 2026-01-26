import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useAuthStore from '@/lib/state/auth-store';
import { supabase } from '@/lib/supabase';

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
 * Syncs business name with businesses table (like Instagram account)
 * Other settings stored in JSONB data column
 */
export function useBusinessSettings(): BusinessSettingsResult {
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const businessId = useAuthStore((s) => s.businessId);
  const isOfflineMode = useAuthStore((s) => s.isOfflineMode);
  const isApplyingRemote = useRef(false);

  // Load settings on mount or when business changes
  useEffect(() => {
    loadSettings();
  }, [businessId]);

  // Set up realtime subscription for cross-browser sync on businesses table
  useEffect(() => {
    if (!businessId || isOfflineMode) return;

    const channel = supabase
      .channel(`business-${businessId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'businesses',
          filter: `id=eq.${businessId}`,
        },
        (payload) => {
          if (isApplyingRemote.current) return;

          console.log('Business updated via realtime:', payload);
          const newData = payload.new as Record<string, unknown>;

          if (newData) {
            const data = newData.data as Record<string, unknown> | null;
            const updatedSettings: BusinessSettings = {
              businessName: (newData.name as string) ?? '',
              businessLogo: (data?.businessLogo as string | null) ?? null,
              businessPhone: (data?.businessPhone as string) ?? '',
              businessWebsite: (data?.businessWebsite as string) ?? '',
              returnAddress: (data?.returnAddress as string) ?? '',
            };

            setSettings(updatedSettings);

            // Update local cache
            const key = getSettingsKey(businessId);
            AsyncStorage.setItem(key, JSON.stringify(updatedSettings)).catch(() => {});
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, isOfflineMode]);

  const loadSettings = async () => {
    try {
      setIsLoading(true);

      // Try loading from Supabase businesses table (for online mode)
      if (businessId && !isOfflineMode) {
        const { data: business, error } = await supabase
          .from('businesses')
          .select('*')
          .eq('id', businessId)
          .maybeSingle();

        if (!error && business) {
          const data = (business as { data?: Record<string, unknown> | null }).data ?? null;
          const remoteSettings: BusinessSettings = {
            businessName: (business.name as string) ?? '',
            businessLogo: (data?.businessLogo as string | null) ?? null,
            businessPhone: (data?.businessPhone as string) ?? '',
            businessWebsite: (data?.businessWebsite as string) ?? '',
            returnAddress: (data?.returnAddress as string) ?? '',
          };

          setSettings(remoteSettings);

          const key = getSettingsKey(businessId);
          await AsyncStorage.setItem(key, JSON.stringify(remoteSettings));
          setIsLoading(false);
          return;
        }
      }

      // Fallback to AsyncStorage (offline or if Supabase fails)
      const key = getSettingsKey(businessId);
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<BusinessSettings>;
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
        setIsLoading(false);
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
    } catch (err) {
      console.log('Failed to load business settings:', err);
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
      isApplyingRemote.current = true;

      // Save to Supabase businesses table (for online mode)
      if (businessId && !isOfflineMode) {
        const { data: businessRow } = await supabase
          .from('businesses')
          .select('data')
          .eq('id', businessId)
          .maybeSingle();

        const existingData = (businessRow?.data as Record<string, unknown> | null) ?? {};
        const mergedData = {
          ...existingData,
          businessLogo: newSettings.businessLogo,
          businessPhone: newSettings.businessPhone,
          businessWebsite: newSettings.businessWebsite,
          returnAddress: newSettings.returnAddress,
        };

        // Try to update with data column first
        let { error: businessError } = await supabase
          .from('businesses')
          .update({
            name: newSettings.businessName,
            data: mergedData,
          })
          .eq('id', businessId);

        // If data column doesn't exist, just update the name
        if (businessError && businessError.message?.includes('column')) {
          const { error: nameOnlyError } = await supabase
            .from('businesses')
            .update({ name: newSettings.businessName })
            .eq('id', businessId);

          if (nameOnlyError) {
            console.warn('Failed to save to Supabase:', nameOnlyError);
            return { success: false, error: 'Failed to sync with server' };
          }
        } else if (businessError) {
          console.warn('Failed to save to Supabase:', businessError);
          return { success: false, error: 'Failed to sync with server' };
        }
      }

      // Save to AsyncStorage (cache)
      const key = getSettingsKey(businessId);
      await AsyncStorage.setItem(key, JSON.stringify(newSettings));
      setSettings(newSettings);

      isApplyingRemote.current = false;
      return { success: true };
    } catch (err) {
      isApplyingRemote.current = false;
      console.error('Failed to save settings:', err);
      return { success: false, error: 'Failed to save settings' };
    }
  };

  const updateBusinessName = useCallback(async (name: string): Promise<{ success: boolean; error?: string }> => {
    if (settings.businessName.trim()) {
      return { success: false, error: 'Business name is locked after setup.' };
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      return { success: false, error: 'Business name cannot be empty' };
    }

    const newSettings: BusinessSettings = {
      ...settings,
      businessName: trimmedName,
    };
    return saveSettingsToStorage(newSettings);
  }, [settings, businessId, isOfflineMode]);

  const updateBusinessLogo = useCallback(async (logoUri: string | null): Promise<void> => {
    const newSettings: BusinessSettings = {
      ...settings,
      businessLogo: logoUri,
    };
    await saveSettingsToStorage(newSettings);
  }, [settings, businessId, isOfflineMode]);

  const saveSettings = useCallback(async (partialSettings: Partial<BusinessSettings>): Promise<{ success: boolean; error?: string }> => {
    const lockedName = settings.businessName.trim();
    const resolvedName = lockedName || partialSettings.businessName?.trim() || settings.businessName;
    const newSettings: BusinessSettings = {
      ...settings,
      ...partialSettings,
      businessName: resolvedName,
    };

    if (!resolvedName) {
      return { success: false, error: 'Business name cannot be empty' };
    }

    return saveSettingsToStorage(newSettings);
  }, [settings, businessId, isOfflineMode]);

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
