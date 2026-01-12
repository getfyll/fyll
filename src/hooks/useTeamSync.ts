import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useFyllStore from '@/lib/state/fyll-store';

export type TeamSyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

interface TeamSyncConfig {
  teamId: string;
  teamName: string;
  lastSyncAt: string | null;
  autoSync: boolean;
}

interface TeamSyncResult {
  status: TeamSyncStatus;
  lastSyncAt: string | null;
  teamConfig: TeamSyncConfig | null;
  isConfigured: boolean;
  syncData: () => Promise<void>;
  setupTeam: (teamId: string, teamName: string) => Promise<void>;
  disconnectTeam: () => Promise<void>;
  toggleAutoSync: () => Promise<void>;
}

const TEAM_SYNC_KEY = 'fyll_team_sync_config';

/**
 * Hook for team data synchronization across accounts
 * Allows multiple team members to share and sync data
 */
export function useTeamSync(): TeamSyncResult {
  const [status, setStatus] = useState<TeamSyncStatus>('idle');
  const [teamConfig, setTeamConfig] = useState<TeamSyncConfig | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  // Get store data for syncing
  const orders = useFyllStore((s) => s.orders);
  const products = useFyllStore((s) => s.products);
  const customers = useFyllStore((s) => s.customers);
  const expenses = useFyllStore((s) => s.expenses);

  // Load team config on mount
  useEffect(() => {
    loadTeamConfig();
  }, []);

  const loadTeamConfig = async () => {
    try {
      const stored = await AsyncStorage.getItem(TEAM_SYNC_KEY);
      if (stored) {
        const config = JSON.parse(stored) as TeamSyncConfig;
        setTeamConfig(config);
        setLastSyncAt(config.lastSyncAt);
      }
    } catch {
      console.log('Failed to load team sync config');
    }
  };

  const saveTeamConfig = async (config: TeamSyncConfig) => {
    try {
      await AsyncStorage.setItem(TEAM_SYNC_KEY, JSON.stringify(config));
      setTeamConfig(config);
    } catch {
      console.log('Failed to save team sync config');
    }
  };

  /**
   * Setup team connection
   */
  const setupTeam = useCallback(async (teamId: string, teamName: string) => {
    const config: TeamSyncConfig = {
      teamId,
      teamName,
      lastSyncAt: null,
      autoSync: true,
    };
    await saveTeamConfig(config);
    setStatus('idle');
  }, []);

  /**
   * Disconnect from team
   */
  const disconnectTeam = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(TEAM_SYNC_KEY);
      setTeamConfig(null);
      setLastSyncAt(null);
      setStatus('idle');
    } catch {
      console.log('Failed to disconnect team');
    }
  }, []);

  /**
   * Toggle auto-sync setting
   */
  const toggleAutoSync = useCallback(async () => {
    if (!teamConfig) return;

    const updatedConfig: TeamSyncConfig = {
      ...teamConfig,
      autoSync: !teamConfig.autoSync,
    };
    await saveTeamConfig(updatedConfig);
  }, [teamConfig]);

  /**
   * Sync data with team
   * In a real implementation, this would communicate with a backend service
   */
  const syncData = useCallback(async () => {
    if (!teamConfig) {
      setStatus('error');
      return;
    }

    setStatus('syncing');

    try {
      // Simulate sync operation
      // In production, this would:
      // 1. Upload local changes to cloud
      // 2. Download remote changes
      // 3. Merge conflicts
      // 4. Update local store

      const syncPayload = {
        teamId: teamConfig.teamId,
        timestamp: new Date().toISOString(),
        data: {
          ordersCount: orders.length,
          productsCount: products.length,
          customersCount: customers.length,
          expensesCount: expenses.length,
        },
      };

      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Log sync attempt (in production, send to server)
      console.log('Team sync payload:', syncPayload);

      const now = new Date().toISOString();
      setLastSyncAt(now);

      const updatedConfig: TeamSyncConfig = {
        ...teamConfig,
        lastSyncAt: now,
      };
      await saveTeamConfig(updatedConfig);

      setStatus('synced');

      // Reset status after delay
      setTimeout(() => {
        setStatus('idle');
      }, 2000);
    } catch {
      setStatus('error');
      setTimeout(() => {
        setStatus('idle');
      }, 3000);
    }
  }, [teamConfig, orders, products, customers, expenses]);

  return {
    status,
    lastSyncAt,
    teamConfig,
    isConfigured: teamConfig !== null,
    syncData,
    setupTeam,
    disconnectTeam,
    toggleAutoSync,
  };
}
