import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, ClipboardCheck, Package, AlertTriangle, History, Eye, Search } from 'lucide-react-native';
import useFyllStore, { formatCurrency } from '@/lib/state/fyll-store';
import Animated, { FadeInDown, FadeInRight, Layout } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

// Force Light Theme Colors
const colors = {
  bg: {
    primary: '#FFFFFF',
    secondary: '#F9F9F9',
    card: '#FFFFFF',
  },
  text: {
    primary: '#111111',
    secondary: '#333333',
    tertiary: '#666666',
    muted: '#999999',
  },
  border: {
    light: '#E5E5E5',
    medium: '#CCCCCC',
  },
  input: {
    bg: '#FFFFFF',
    border: '#444444',
  },
};

interface AuditItem {
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  combinedName: string; // New: "[Product Name] [Variant Name]"
  expectedStock: number;
  physicalCount: string;
  sku: string;
}

// Local display type for audit history view
interface AuditLogDisplay {
  id: string;
  date: string;
  items: {
    productName: string;
    variantName: string;
    expected: number;
    actual: number;
    discrepancy: number;
  }[];
  totalDiscrepancy: number;
}

export default function InventoryAuditScreen() {
  const router = useRouter();
  const products = useFyllStore((s) => s.products);
  const updateVariantStock = useFyllStore((s) => s.updateVariantStock);
  const addAuditLog = useFyllStore((s) => s.addAuditLog);

  const [auditItems, setAuditItems] = useState<AuditItem[]>([]);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogDisplay[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showCurrentInventory, setShowCurrentInventory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter audit items based on search
  const filteredAuditItems = useMemo(() => {
    if (!searchQuery.trim()) return auditItems;
    const query = searchQuery.toLowerCase();
    return auditItems.filter((item) =>
      item.combinedName.toLowerCase().includes(query) ||
      item.sku.toLowerCase().includes(query)
    );
  }, [auditItems, searchQuery]);

  // Initialize audit items from current inventory
  const startAudit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const items: AuditItem[] = [];
    products.forEach((product) => {
      product.variants.forEach((variant) => {
        const variantName = Object.values(variant.variableValues).join(' / ');
        const combinedName = `${product.name} ${variantName}`;
        items.push({
          productId: product.id,
          productName: product.name,
          variantId: variant.id,
          variantName,
          combinedName,
          expectedStock: variant.stock,
          physicalCount: '',
          sku: variant.sku,
        });
      });
    });
    setAuditItems(items);
    setIsAuditing(true);
  };

  const updatePhysicalCount = (variantId: string, count: string) => {
    setAuditItems((prev) =>
      prev.map((item) =>
        item.variantId === variantId ? { ...item, physicalCount: count } : item
      )
    );
  };

  const discrepancies = useMemo(() => {
    return auditItems.filter((item) => {
      const count = parseInt(item.physicalCount, 10);
      return !isNaN(count) && count !== item.expectedStock;
    });
  }, [auditItems]);

  const submitAudit = () => {
    // Check if all items have been counted
    const uncounted = auditItems.filter((item) => item.physicalCount === '');
    if (uncounted.length > 0) {
      Alert.alert(
        'Incomplete Audit',
        `${uncounted.length} items haven't been counted. Do you want to continue anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: processAudit },
        ]
      );
    } else {
      processAudit();
    }
  };

  const processAudit = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Create audit log
    const logItems = auditItems
      .filter((item) => item.physicalCount !== '')
      .map((item) => {
        const actual = parseInt(item.physicalCount, 10);
        return {
          productName: item.productName,
          variantName: item.variantName,
          expected: item.expectedStock,
          actual,
          discrepancy: actual - item.expectedStock,
        };
      });

    const totalDiscrepancy = logItems.reduce((sum, item) => sum + Math.abs(item.discrepancy), 0);

    const newLog: AuditLogDisplay = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      items: logItems,
      totalDiscrepancy,
    };

    setAuditLogs((prev) => [newLog, ...prev]);

    // Also log to global store (for audit banner tracking)
    const now = new Date();
    addAuditLog({
      id: Date.now().toString(),
      month: now.getMonth(),
      year: now.getFullYear(),
      itemsAudited: logItems.length,
      discrepancies: totalDiscrepancy,
      completedAt: now.toISOString(),
    });

    // Update stock levels to match physical count
    auditItems.forEach((item) => {
      if (item.physicalCount !== '') {
        const actual = parseInt(item.physicalCount, 10);
        const delta = actual - item.expectedStock;
        if (delta !== 0) {
          updateVariantStock(item.productId, item.variantId, delta);
        }
      }
    });

    Alert.alert(
      'Audit Complete',
      `Stock levels have been updated. ${discrepancies.length} discrepancies found.`,
      [{ text: 'OK', onPress: () => setIsAuditing(false) }]
    );
  };

  const cancelAudit = () => {
    Alert.alert('Cancel Audit', 'Are you sure you want to cancel this audit?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        style: 'destructive',
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setIsAuditing(false);
          setAuditItems([]);
        },
      },
    ]);
  };

  // Current Inventory View
  if (showCurrentInventory) {
    return (
      <View className="flex-1 bg-white">
        <SafeAreaView className="flex-1" edges={['top']}>
          <View className="px-5 pt-4 pb-3 flex-row items-center bg-white border-b border-gray-200">
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowCurrentInventory(false);
              }}
              className="w-10 h-10 rounded-xl items-center justify-center mr-3 active:opacity-50 bg-gray-100"
            >
              <ChevronLeft size={20} color="#111111" strokeWidth={2} />
            </Pressable>
            <Text className="text-gray-900 text-xl font-bold">Current Inventory</Text>
          </View>

          <ScrollView className="flex-1 px-5 pt-4 bg-gray-50" showsVerticalScrollIndicator={false}>
            {products.length === 0 ? (
              <View className="items-center justify-center py-20">
                <View className="w-20 h-20 rounded-2xl items-center justify-center mb-4 bg-gray-100">
                  <Package size={40} color="#999999" strokeWidth={1.5} />
                </View>
                <Text className="text-gray-600 text-base mb-1">No products yet</Text>
                <Text className="text-gray-400 text-sm">Add products to see inventory</Text>
              </View>
            ) : (
              products.map((product, pIndex) => (
                <Animated.View
                  key={product.id}
                  entering={FadeInDown.delay(pIndex * 50).springify()}
                  className="mb-3"
                >
                  <View className="bg-white rounded-xl border border-gray-200 p-4">
                    <Text className="text-gray-900 font-bold text-base mb-3">{product.name}</Text>
                    {product.variants.map((variant, vIndex) => {
                      const variantName = Object.values(variant.variableValues).join(' / ');
                      const isLow = variant.stock <= product.lowStockThreshold;
                      return (
                        <View
                          key={variant.id}
                          className={`flex-row items-center justify-between py-2 ${vIndex > 0 ? 'border-t border-gray-100' : ''}`}
                        >
                          <View className="flex-1">
                            <Text className="text-gray-700 text-sm font-medium">{variantName}</Text>
                            <Text className="text-gray-400 text-xs">SKU: {variant.sku}</Text>
                          </View>
                          <View
                            className="px-3 py-1.5 rounded-lg"
                            style={{
                              backgroundColor: isLow
                                ? variant.stock === 0
                                  ? 'rgba(239, 68, 68, 0.1)'
                                  : 'rgba(245, 158, 11, 0.1)'
                                : 'rgba(16, 185, 129, 0.1)',
                            }}
                          >
                            <Text
                              className="font-bold"
                              style={{
                                color: isLow
                                  ? variant.stock === 0
                                    ? '#EF4444'
                                    : '#F59E0B'
                                  : '#10B981',
                              }}
                            >
                              {variant.stock}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </Animated.View>
              ))
            )}
            <View className="h-24" />
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  // Audit History View
  if (showHistory) {
    return (
      <View className="flex-1 bg-white">
        <SafeAreaView className="flex-1" edges={['top']}>
          <View className="px-5 pt-4 pb-3 flex-row items-center bg-white border-b border-gray-200">
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowHistory(false);
              }}
              className="w-10 h-10 rounded-xl items-center justify-center mr-3 active:opacity-50 bg-gray-100"
            >
              <ChevronLeft size={20} color="#111111" strokeWidth={2} />
            </Pressable>
            <Text className="text-gray-900 text-xl font-bold">Audit History</Text>
          </View>

          <ScrollView className="flex-1 px-5 pt-4 bg-gray-50" showsVerticalScrollIndicator={false}>
            {auditLogs.length === 0 ? (
              <View className="items-center justify-center py-20">
                <View className="w-20 h-20 rounded-2xl items-center justify-center mb-4 bg-gray-100">
                  <History size={40} color="#999999" strokeWidth={1.5} />
                </View>
                <Text className="text-gray-600 text-base mb-1">No audits yet</Text>
                <Text className="text-gray-400 text-sm">Complete your first audit to see history</Text>
              </View>
            ) : (
              auditLogs.map((log, index) => (
                <Animated.View
                  key={log.id}
                  entering={FadeInDown.delay(index * 50).springify()}
                  className="mb-3"
                >
                  <View className="bg-white rounded-xl border border-gray-200 p-4">
                    <View className="flex-row items-center justify-between mb-3">
                      <Text className="text-gray-900 font-bold">
                        {new Date(log.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Text>
                      <View
                        className="px-2 py-1 rounded-md"
                        style={{
                          backgroundColor:
                            log.totalDiscrepancy === 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        }}
                      >
                        <Text
                          style={{ color: log.totalDiscrepancy === 0 ? '#10B981' : '#F59E0B' }}
                          className="text-xs font-semibold"
                        >
                          {log.totalDiscrepancy === 0 ? 'No Discrepancies' : `${log.totalDiscrepancy} units off`}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-gray-500 text-sm">
                      {log.items.length} items audited
                    </Text>
                    {log.items.filter((i) => i.discrepancy !== 0).slice(0, 3).map((item, i) => (
                      <View key={i} className="flex-row items-center mt-2 pt-2 border-t border-gray-100">
                        <Text className="text-gray-600 text-sm flex-1" numberOfLines={1}>
                          {item.productName} — {item.variantName}
                        </Text>
                        <Text
                          className="text-sm font-semibold"
                          style={{ color: item.discrepancy > 0 ? '#10B981' : '#EF4444' }}
                        >
                          {item.discrepancy > 0 ? '+' : ''}{item.discrepancy}
                        </Text>
                      </View>
                    ))}
                  </View>
                </Animated.View>
              ))
            )}
            <View className="h-24" />
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  // Audit In Progress View
  if (isAuditing) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
        <SafeAreaView className="flex-1" edges={['top']}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1"
          >
            {/* Header */}
            <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, backgroundColor: colors.bg.primary, borderBottomWidth: 1, borderBottomColor: colors.border.light }}>
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center">
                  <Pressable
                    onPress={cancelAudit}
                    className="w-10 h-10 rounded-xl items-center justify-center mr-3 active:opacity-50"
                    style={{ backgroundColor: colors.bg.secondary }}
                  >
                    <ChevronLeft size={20} color={colors.text.primary} strokeWidth={2} />
                  </Pressable>
                  <View>
                    <Text style={{ color: colors.text.primary }} className="text-xl font-bold">Stock Count</Text>
                    <Text style={{ color: colors.text.tertiary }} className="text-xs">{auditItems.length} items to count</Text>
                  </View>
                </View>
                {discrepancies.length > 0 && (
                  <View className="px-3 py-1.5 rounded-full" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)' }}>
                    <Text className="text-amber-600 text-xs font-semibold">
                      {discrepancies.length} discrepancies
                    </Text>
                  </View>
                )}
              </View>

              {/* Search Bar */}
              <View
                className="flex-row items-center rounded-xl px-4"
                style={{ height: 52, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.input.border }}
              >
                <Search size={18} color={colors.text.muted} strokeWidth={2} />
                <TextInput
                  placeholder="Search by name or SKU..."
                  placeholderTextColor={colors.text.muted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  style={{ flex: 1, marginLeft: 8, color: colors.text.primary, fontSize: 14 }}
                  selectionColor={colors.text.primary}
                />
              </View>
            </View>

            <ScrollView style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16, backgroundColor: colors.bg.secondary }} showsVerticalScrollIndicator={false}>
              {filteredAuditItems.map((item, index) => {
                const count = parseInt(item.physicalCount, 10);
                const hasDiscrepancy = !isNaN(count) && count !== item.expectedStock;
                const discrepancy = !isNaN(count) ? count - item.expectedStock : 0;

                return (
                  <Animated.View
                    key={item.variantId}
                    entering={FadeInRight.delay(index * 30).springify()}
                    layout={Layout.springify()}
                    className="mb-3"
                  >
                    <View
                      className="rounded-xl p-4"
                      style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: hasDiscrepancy ? '#F59E0B' : colors.border.light }}
                    >
                      <View className="flex-row items-start justify-between mb-3">
                        <View className="flex-1">
                          {/* Combined Name: "[Product Name] [Variant Name]" */}
                          <Text style={{ color: colors.text.primary }} className="font-bold text-base">{item.combinedName}</Text>
                          <Text style={{ color: colors.text.muted }} className="text-xs mt-1">SKU: {item.sku}</Text>
                        </View>
                        <View className="items-end">
                          <Text style={{ color: colors.text.tertiary }} className="text-xs">Expected</Text>
                          <Text style={{ color: colors.text.primary }} className="text-lg font-bold">{item.expectedStock}</Text>
                        </View>
                      </View>

                      <View className="flex-row items-center gap-3">
                        <View className="flex-1">
                          <Text style={{ color: colors.text.tertiary }} className="text-xs mb-1">Physical Count</Text>
                          <View
                            className="rounded-xl px-4"
                            style={{
                              height: 52,
                              justifyContent: 'center',
                              backgroundColor: colors.bg.card,
                              borderWidth: 1,
                              borderColor: hasDiscrepancy ? '#F59E0B' : colors.input.border,
                            }}
                          >
                            <TextInput
                              value={item.physicalCount}
                              onChangeText={(text) => updatePhysicalCount(item.variantId, text)}
                              placeholder="Enter count"
                              placeholderTextColor="#999999"
                              keyboardType="numeric"
                              style={{ color: '#111111', fontSize: 16, fontWeight: '600' }}
                              selectionColor="#111111"
                            />
                          </View>
                        </View>
                        {hasDiscrepancy && (
                          <View className="items-center pt-4">
                            <View
                              className="px-3 py-2 rounded-lg"
                              style={{ backgroundColor: discrepancy > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)' }}
                            >
                              <Text
                                className="text-sm font-bold"
                                style={{ color: discrepancy > 0 ? '#10B981' : '#EF4444' }}
                              >
                                {discrepancy > 0 ? '+' : ''}{discrepancy}
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>
                    </View>
                  </Animated.View>
                );
              })}
              <View className="h-32" />
            </ScrollView>

            {/* Submit Button */}
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: 32, paddingTop: 16, backgroundColor: colors.bg.primary, borderTopWidth: 1, borderTopColor: colors.border.light }}>
              <Pressable
                onPress={submitAudit}
                className="rounded-xl items-center active:opacity-80"
                style={{ height: 56, justifyContent: 'center', backgroundColor: '#111111' }}
              >
                <View className="flex-row items-center">
                  <ClipboardCheck size={20} color="#FFFFFF" strokeWidth={2} />
                  <Text className="text-white font-bold text-base ml-2">Complete Audit</Text>
                </View>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    );
  }

  // Main Landing Page - 3 Button Layout
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header - positioned at top */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, backgroundColor: colors.bg.primary, borderBottomWidth: 1, borderBottomColor: colors.border.light }}>
          <View className="flex-row items-center">
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.back();
              }}
              className="w-10 h-10 rounded-xl items-center justify-center mr-3 active:opacity-50"
              style={{ backgroundColor: colors.bg.secondary }}
            >
              <ChevronLeft size={20} color={colors.text.primary} strokeWidth={2} />
            </Pressable>
            <Text style={{ color: colors.text.primary }} className="text-xl font-bold">Inventory Audit</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1, paddingHorizontal: 20, paddingTop: 24, backgroundColor: colors.bg.secondary }} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.springify()} className="items-center mb-8">
            <View
              className="w-24 h-24 rounded-3xl items-center justify-center mb-4"
              style={{ backgroundColor: 'rgba(17, 17, 17, 0.1)' }}
            >
              <ClipboardCheck size={48} color={colors.text.primary} strokeWidth={1.5} />
            </View>
            <Text style={{ color: colors.text.primary }} className="text-2xl font-bold text-center">Monthly Stock Audit</Text>
            <Text style={{ color: colors.text.tertiary }} className="text-sm text-center mt-2 px-8">
              Count your physical inventory and reconcile any discrepancies with the system
            </Text>
          </Animated.View>

          {/* 3 Button Layout */}
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <Pressable
              onPress={startAudit}
              className="rounded-xl items-center active:opacity-80 mb-4"
              style={{ height: 56, justifyContent: 'center', backgroundColor: '#111111' }}
            >
              <View className="flex-row items-center">
                <ClipboardCheck size={20} color="#FFFFFF" strokeWidth={2} />
                <Text className="text-white font-bold text-base ml-2">Start New Audit</Text>
              </View>
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).springify()}>
            <Pressable
              onPress={() => setShowHistory(true)}
              className="rounded-xl items-center active:opacity-70 mb-4"
              style={{ height: 56, justifyContent: 'center', backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}
            >
              <View className="flex-row items-center">
                <History size={20} color={colors.text.primary} strokeWidth={2} />
                <Text style={{ color: colors.text.primary }} className="font-bold text-base ml-2">View Audit History</Text>
              </View>
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300).springify()}>
            <Pressable
              onPress={() => setShowCurrentInventory(true)}
              className="rounded-xl items-center active:opacity-70 mb-4"
              style={{ height: 56, justifyContent: 'center', backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}
            >
              <View className="flex-row items-center">
                <Eye size={20} color={colors.text.primary} strokeWidth={2} />
                <Text style={{ color: colors.text.primary }} className="font-bold text-base ml-2">Current Inventory</Text>
              </View>
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(400).springify()}>
            <View style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }} className="rounded-xl p-4">
              <View className="flex-row items-center mb-3">
                <AlertTriangle size={20} color="#F59E0B" strokeWidth={2} />
                <Text style={{ color: colors.text.primary }} className="font-bold ml-2">How It Works</Text>
              </View>
              <View className="gap-2">
                <View className="flex-row items-start">
                  <View className="w-6 h-6 rounded-full items-center justify-center mr-3" style={{ backgroundColor: colors.bg.secondary }}>
                    <Text style={{ color: colors.text.primary }} className="text-xs font-bold">1</Text>
                  </View>
                  <Text style={{ color: colors.text.tertiary }} className="text-sm flex-1">
                    Count each product variant physically
                  </Text>
                </View>
                <View className="flex-row items-start">
                  <View className="w-6 h-6 rounded-full items-center justify-center mr-3" style={{ backgroundColor: colors.bg.secondary }}>
                    <Text style={{ color: colors.text.primary }} className="text-xs font-bold">2</Text>
                  </View>
                  <Text style={{ color: colors.text.tertiary }} className="text-sm flex-1">
                    Enter the actual count for each item
                  </Text>
                </View>
                <View className="flex-row items-start">
                  <View className="w-6 h-6 rounded-full items-center justify-center mr-3" style={{ backgroundColor: colors.bg.secondary }}>
                    <Text style={{ color: colors.text.primary }} className="text-xs font-bold">3</Text>
                  </View>
                  <Text style={{ color: colors.text.tertiary }} className="text-sm flex-1">
                    Review discrepancies and submit to update stock
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>

          <View className="h-24" />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
