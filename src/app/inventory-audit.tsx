import React, { useEffect, useMemo, useState } from 'react';
import { Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import useFyllStore, { AuditLogItem } from '@/lib/state/fyll-store';
import useAuthStore from '@/lib/state/auth-store';
import { useResolvedThemeMode, useThemeColors } from '@/lib/theme';
import { storage } from '@/lib/storage';
import { AuditHomeView } from '@/components/inventory-audit/AuditHomeView';
import { AuditCountView } from '@/components/inventory-audit/AuditCountView';
import { AuditHistoryView } from '@/components/inventory-audit/AuditHistoryView';
import { AuditActionModal } from '@/components/inventory-audit/AuditActionModal';
import type { AuditItem, AuditStatusFilter } from '@/components/inventory-audit/types';
import { buildAuditItems, buildCategorySections, getAuditProgress, parseCount } from '@/components/inventory-audit/utils';

type AuditView = 'home' | 'counting' | 'history';
const AUDIT_DRAFT_STORAGE_KEY = 'inventory-audit-draft-v1';

interface StoredAuditDraft {
  items: AuditItem[];
  savedAt: string;
}

export default function InventoryAuditScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const isDark = useResolvedThemeMode() === 'dark';
  const primaryActionBg = isDark ? '#FFFFFF' : '#111111';
  const primaryActionText = isDark ? '#111111' : '#FFFFFF';

  const products = useFyllStore((state) => state.products);
  const updateProduct = useFyllStore((state) => state.updateProduct);
  const addAuditLog = useFyllStore((state) => state.addAuditLog);
  const storeAuditLogs = useFyllStore((state) => state.auditLogs);
  const businessId = useAuthStore((state) => state.businessId);
  const performedBy = useAuthStore((state) => state.currentUser?.name ?? state.currentUser?.email ?? 'Team');

  const [currentView, setCurrentView] = useState<AuditView>('home');
  const [auditItems, setAuditItems] = useState<AuditItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<AuditStatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('All categories');
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);

  const [showRestartPrompt, setShowRestartPrompt] = useState(false);
  const [showSavedPrompt, setShowSavedPrompt] = useState(false);
  const [savedDiscrepancies, setSavedDiscrepancies] = useState(0);

  useEffect(() => {
    let isCancelled = false;

    const loadDraft = async () => {
      const draftRaw = await storage.getItem(AUDIT_DRAFT_STORAGE_KEY);
      if (!draftRaw || isCancelled) {
        return;
      }

      try {
        const parsedDraft = JSON.parse(draftRaw) as StoredAuditDraft;
        if (!parsedDraft?.items || !Array.isArray(parsedDraft.items) || parsedDraft.items.length === 0) {
          return;
        }

        const validItems = parsedDraft.items.filter((item) => (
          typeof item.productId === 'string' &&
          typeof item.productName === 'string' &&
          typeof item.categoryName === 'string' &&
          typeof item.variantId === 'string' &&
          typeof item.variantName === 'string' &&
          typeof item.combinedName === 'string' &&
          typeof item.expectedStock === 'number' &&
          typeof item.physicalCount === 'string' &&
          typeof item.sku === 'string'
        ));

        if (validItems.length > 0) {
          setAuditItems(validItems);
        }
      } catch (error) {
        console.warn('Failed to load audit draft:', error);
      }
    };

    void loadDraft();

    return () => {
      isCancelled = true;
    };
  }, []);

  const sortedAuditLogs = useMemo(() => {
    return [...storeAuditLogs].sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  }, [storeAuditLogs]);

  const auditProgress = useMemo(() => getAuditProgress(auditItems), [auditItems]);

  const categoryOptions = useMemo(() => {
    const uniqueCategories = Array.from(new Set(auditItems.map((item) => item.categoryName))).sort((a, b) => a.localeCompare(b));
    return ['All categories', ...uniqueCategories];
  }, [auditItems]);

  const filteredAuditItems = useMemo(() => {
    return auditItems.filter((item) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch = !query ||
        item.combinedName.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query) ||
        item.categoryName.toLowerCase().includes(query);

      if (!matchesSearch) {
        return false;
      }

      if (categoryFilter !== 'All categories' && item.categoryName !== categoryFilter) {
        return false;
      }

      const parsedCount = parseCount(item.physicalCount);
      if (statusFilter === 'uncounted') {
        return parsedCount === null;
      }
      if (statusFilter === 'discrepancies') {
        return parsedCount !== null && parsedCount !== item.expectedStock;
      }
      return true;
    });
  }, [auditItems, searchQuery, categoryFilter, statusFilter]);

  const categorySections = useMemo(() => buildCategorySections(filteredAuditItems), [filteredAuditItems]);

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setCategoryFilter('All categories');
  };

  const triggerMediumHaptic = () => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const saveAuditDraft = async (itemsToSave: AuditItem[]) => {
    if (itemsToSave.length === 0) {
      await storage.removeItem(AUDIT_DRAFT_STORAGE_KEY);
      return;
    }

    const payload: StoredAuditDraft = {
      items: itemsToSave,
      savedAt: new Date().toISOString(),
    };
    await storage.setItem(AUDIT_DRAFT_STORAGE_KEY, JSON.stringify(payload));
  };

  const clearAuditDraft = async () => {
    await storage.removeItem(AUDIT_DRAFT_STORAGE_KEY);
  };

  const startAudit = () => {
    triggerMediumHaptic();
    const nextItems = buildAuditItems(products);
    setAuditItems(nextItems);
    resetFilters();
    setCurrentView('counting');
    void clearAuditDraft();
  };

  const handleStartAuditPress = () => {
    if (auditItems.length > 0) {
      setShowRestartPrompt(true);
      return;
    }
    startAudit();
  };

  const resumeAudit = () => {
    if (auditItems.length === 0) {
      startAudit();
      return;
    }
    triggerMediumHaptic();
    setCurrentView('counting');
  };

  const updatePhysicalCount = (variantId: string, count: string) => {
    setAuditItems((previousItems) =>
      previousItems.map((item) => (item.variantId === variantId ? { ...item, physicalCount: count } : item))
    );
  };

  const markCategoryAsExpected = (categoryName: string) => {
    triggerMediumHaptic();
    setAuditItems((previousItems) =>
      previousItems.map((item) => {
        if (item.categoryName !== categoryName) {
          return item;
        }
        return {
          ...item,
          physicalCount: String(item.expectedStock),
        };
      })
    );
  };

  const handleSubmitAudit = () => {
    if (auditProgress.total === 0 || auditProgress.counted !== auditProgress.total) {
      return;
    }
    void processAudit();
  };

  const processAudit = async () => {
    if (Platform.OS !== 'web') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    const logItems: AuditLogItem[] = auditItems
      .map((item) => {
        const actual = parseCount(item.physicalCount);
        if (actual === null) {
          return null;
        }
        return {
          productId: item.productId,
          variantId: item.variantId,
          productName: item.productName,
          variantName: item.variantName,
          sku: item.sku,
          expectedStock: item.expectedStock,
          actualStock: actual,
          discrepancy: actual - item.expectedStock,
        };
      })
      .filter((item): item is AuditLogItem => item !== null);

    const totalDiscrepancy = logItems.reduce((sum, item) => sum + Math.abs(item.discrepancy), 0);
    const now = new Date();

    addAuditLog({
      id: now.getTime().toString(),
      month: now.getMonth(),
      year: now.getFullYear(),
      itemsAudited: logItems.length,
      discrepancies: totalDiscrepancy,
      completedAt: now.toISOString(),
      performedBy,
      items: logItems,
    });

    const productChanges = new Map<string, Map<string, number>>();

    auditItems.forEach((item) => {
      const actual = parseCount(item.physicalCount);
      if (actual === null || actual === item.expectedStock) {
        return;
      }

      if (!productChanges.has(item.productId)) {
        productChanges.set(item.productId, new Map<string, number>());
      }

      productChanges.get(item.productId)?.set(item.variantId, actual);
    });

    if (productChanges.size > 0) {
      await Promise.all(
        products
          .filter((product) => productChanges.has(product.id))
          .map((product) => {
            const variantMap = productChanges.get(product.id);
            if (!variantMap) {
              return Promise.resolve();
            }

            const updatedVariants = product.variants.map((variant) => {
              const actualStock = variantMap.get(variant.id);
              if (actualStock === undefined) {
                return variant;
              }

              return {
                ...variant,
                stock: actualStock,
              };
            });

            return updateProduct(product.id, { variants: updatedVariants }, businessId ?? undefined);
          })
      );
    }

    setSavedDiscrepancies(auditProgress.discrepancyCount);
    setAuditItems([]);
    resetFilters();
    setCurrentView('home');
    await clearAuditDraft();
    setShowSavedPrompt(true);
  };

  const pauseAndExitAudit = async () => {
    triggerMediumHaptic();
    await saveAuditDraft(auditItems);
    router.replace('/(tabs)/inventory');
  };

  const closeSavedPrompt = () => {
    setShowSavedPrompt(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      {currentView === 'home' ? (
        <AuditHomeView
          colors={colors}
          isDark={isDark}
          primaryActionBg={primaryActionBg}
          primaryActionText={primaryActionText}
          skuCount={products.reduce((sum, product) => sum + product.variants.length, 0)}
          hasActiveAudit={auditItems.length > 0}
          countedItems={auditProgress.counted}
          totalItems={auditProgress.total}
          discrepancyCount={auditProgress.discrepancyCount}
          sortedAuditLogs={sortedAuditLogs}
          onBack={() => {
            if (auditItems.length > 0) {
              void pauseAndExitAudit();
              return;
            }
            router.replace('/(tabs)/inventory');
          }}
          onStartAudit={handleStartAuditPress}
          onResumeAudit={resumeAudit}
          onOpenHistory={() => {
            triggerMediumHaptic();
            setCurrentView('history');
          }}
        />
      ) : null}

      {currentView === 'counting' ? (
        <AuditCountView
          isDark={isDark}
          colors={colors}
          primaryActionBg={primaryActionBg}
          primaryActionText={primaryActionText}
          sections={categorySections}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
          categoryOptions={categoryOptions}
          totalItems={auditProgress.total}
          countedItems={auditProgress.counted}
          discrepancyCount={auditProgress.discrepancyCount}
          onBackToHome={() => {
            triggerMediumHaptic();
            setCurrentView('home');
          }}
          onUpdateCount={updatePhysicalCount}
          onMarkCategoryExpected={markCategoryAsExpected}
          onPause={pauseAndExitAudit}
          onSubmit={handleSubmitAudit}
        />
      ) : null}

      {currentView === 'history' ? (
        <AuditHistoryView
          isDark={isDark}
          colors={colors}
          sortedAuditLogs={sortedAuditLogs}
          expandedAuditId={expandedAuditId}
          onBack={() => setCurrentView('home')}
          onToggleExpanded={(auditId) => {
            setExpandedAuditId((previousAuditId) => (previousAuditId === auditId ? null : auditId));
          }}
        />
      ) : null}

      <AuditActionModal
        visible={showRestartPrompt}
        colors={colors}
        title="Restart audit?"
        description="This will clear the current count and start a fresh audit from current stock values."
        cancelLabel="Cancel"
        confirmLabel="Restart"
        onCancel={() => setShowRestartPrompt(false)}
        onConfirm={() => {
          setShowRestartPrompt(false);
          startAudit();
        }}
        confirmBackgroundColor={primaryActionBg}
        confirmTextColor={primaryActionText}
      />

      <AuditActionModal
        visible={showSavedPrompt}
        colors={colors}
        title="Audit saved"
        description={`Stock updated successfully. ${savedDiscrepancies} discrepancy${savedDiscrepancies === 1 ? '' : 'ies'} recorded.`}
        cancelLabel="Close"
        confirmLabel="View Home"
        onCancel={closeSavedPrompt}
        onConfirm={closeSavedPrompt}
        confirmBackgroundColor={primaryActionBg}
        confirmTextColor={primaryActionText}
      />
    </View>
  );
}
