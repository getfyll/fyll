import React from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SectionList,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, Check, CheckCircle2, ChevronLeft, Circle, Filter, Pause, Search, X } from 'lucide-react-native';
import type { ThemeColors } from '@/lib/theme';
import type { AuditStatusFilter, CategoryAuditSection, ProductAuditGroup } from './types';
import { parseCount } from './utils';

interface AuditCountViewProps {
  isDark: boolean;
  colors: ThemeColors;
  primaryActionBg: string;
  primaryActionText: string;
  sections: CategoryAuditSection[];
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  statusFilter: AuditStatusFilter;
  onStatusFilterChange: (value: AuditStatusFilter) => void;
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  categoryOptions: string[];
  totalItems: number;
  countedItems: number;
  discrepancyCount: number;
  onBackToHome: () => void;
  onUpdateCount: (variantId: string, count: string) => void;
  onMarkCategoryExpected: (categoryName: string) => void;
  onPause: () => Promise<void> | void;
  onSubmit: () => void;
}

const statusFilterOptions: { value: AuditStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'uncounted', label: 'Uncounted' },
  { value: 'discrepancies', label: 'Discrepancies' },
];

const completionPercent = (countedItems: number, totalItems: number): number => {
  if (totalItems === 0) return 0;
  return Math.min(100, Math.round((countedItems / totalItems) * 100));
};

export function AuditCountView({
  isDark,
  colors,
  primaryActionBg,
  primaryActionText,
  sections,
  searchQuery,
  onSearchQueryChange,
  statusFilter,
  onStatusFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  categoryOptions,
  totalItems,
  countedItems,
  discrepancyCount,
  onBackToHome,
  onUpdateCount,
  onMarkCategoryExpected,
  onPause,
  onSubmit,
}: AuditCountViewProps) {
  const [showFilterMenu, setShowFilterMenu] = React.useState(false);
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isLargeLayout = Platform.OS === 'web' || width >= 768;
  const isDesktopWeb = Platform.OS === 'web' && width >= 1024;
  const contentMaxWidth = isLargeLayout ? 980 : undefined;
  const horizontalPadding = isLargeLayout ? 16 : 20;

  const pageBg = isDark ? '#0C0C0D' : colors.bg.primary;
  const canvasBg = !isDark && isDesktopWeb ? '#F3F3F5' : pageBg;
  const mainBg = !isDark && isDesktopWeb ? '#FFFFFF' : pageBg;
  const onPrimaryBg = isDark ? '#0C0C0D' : '#FFFFFF';
  const surfaceBg = isDark ? '#111113' : isDesktopWeb ? '#FFFFFF' : colors.bg.secondary;
  const cardBg = isDark ? '#1A1A1E' : colors.bg.card;
  const cardBorder = isDark ? '#3A3A40' : colors.border.light;
  const panelBorder = !isDark && isDesktopWeb ? '#E6E6E6' : cardBorder;
  const insetBg = isDark ? '#151518' : colors.bg.secondary;
  const searchBorder = colors.border.light;
  const searchBg = colors.input.bg;

  const canSubmit = totalItems > 0 && countedItems === totalItems;
  const progressPercent = completionPercent(countedItems, totalItems);
  const activeFilterCount = (statusFilter !== 'all' ? 1 : 0) + (categoryFilter !== 'All categories' ? 1 : 0);
  const pauseButtonBg = isDark ? 'rgba(245, 158, 11, 0.14)' : '#FEF3C7';
  const pauseButtonBorder = isDark ? 'rgba(245, 158, 11, 0.42)' : '#F59E0B';
  const pauseButtonText = isDark ? '#FBBF24' : '#B45309';

  return (
    <View style={{ flex: 1, backgroundColor: canvasBg }}>
      <SafeAreaView className="flex-1" edges={['top']} style={{ backgroundColor: canvasBg }}>
        <View
          style={{
            flex: 1,
            width: '100%',
            maxWidth: contentMaxWidth,
            alignSelf: 'center',
            backgroundColor: mainBg,
            borderWidth: !isDark && isDesktopWeb ? 1 : 0,
            borderColor: panelBorder,
            borderRadius: !isDark && isDesktopWeb ? 18 : 0,
            overflow: 'hidden',
            marginVertical: !isDark && isDesktopWeb ? 12 : 0,
          }}
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
            <View style={{ borderBottomWidth: 1, borderBottomColor: cardBorder, backgroundColor: mainBg }}>
              <View
                style={{
                  paddingHorizontal: horizontalPadding,
                  paddingTop: 30,
                  paddingBottom: 22,
                }}
              >
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center">
                    <Pressable
                      onPress={onBackToHome}
                      className="w-10 h-10 rounded-full items-center justify-center mr-3"
                      style={{ backgroundColor: insetBg, borderWidth: 1, borderColor: cardBorder }}
                    >
                      <ChevronLeft size={20} color={colors.text.primary} strokeWidth={2} />
                    </Pressable>
                    <View>
                      <Text style={{ color: colors.text.primary }} className="text-xl font-bold">Stock Count</Text>
                      <Text style={{ color: colors.text.tertiary }} className="text-xs mt-0.5">
                        {countedItems} of {totalItems} counted
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => {
                      void onPause();
                    }}
                    className="h-10 rounded-full items-center justify-center flex-row px-3.5"
                    style={{ backgroundColor: pauseButtonBg, borderWidth: 1, borderColor: pauseButtonBorder }}
                  >
                    <Pause size={14} color={pauseButtonText} strokeWidth={2.25} />
                    <Text className="ml-1.5 text-xs font-semibold" style={{ color: pauseButtonText }}>
                      Pause Audit
                    </Text>
                  </Pressable>
                </View>

                <View className="flex-row items-center gap-2">
                  <View
                    className="flex-row items-center rounded-full px-4"
                    style={{ flex: 1, height: 52, backgroundColor: searchBg, borderWidth: 1, borderColor: searchBorder }}
                  >
                    <Search size={18} color={colors.text.muted} strokeWidth={2} />
                    <TextInput
                      value={searchQuery}
                      onChangeText={onSearchQueryChange}
                      placeholder="Search by product, variant, or SKU"
                      placeholderTextColor={colors.input.placeholder}
                      style={{ flex: 1, marginLeft: 8, color: colors.input.text, fontSize: 14 }}
                      selectionColor={colors.text.primary}
                    />
                  </View>
                  <Pressable
                    onPress={() => setShowFilterMenu(true)}
                    className="w-[52px] h-[52px] rounded-full items-center justify-center"
                    style={{
                      backgroundColor: activeFilterCount > 0 ? colors.accent.primary : colors.bg.secondary,
                      borderWidth: activeFilterCount > 0 ? 0 : 1,
                      borderColor: searchBorder,
                    }}
                  >
                    <Filter
                      size={18}
                      color={activeFilterCount > 0 ? (isDark ? '#000000' : '#FFFFFF') : colors.text.tertiary}
                      strokeWidth={2}
                    />
                    {activeFilterCount > 0 ? (
                      <View
                        className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full items-center justify-center px-1"
                        style={{ backgroundColor: '#F59E0B' }}
                      >
                        <Text className="text-[10px] font-bold text-white">{activeFilterCount}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                </View>
              </View>
            </View>

            <SectionList
              sections={sections}
              keyExtractor={(item) => item.productId}
              stickySectionHeadersEnabled
              keyboardShouldPersistTaps="handled"
              style={{ flex: 1, backgroundColor: surfaceBg }}
              contentContainerStyle={{ paddingHorizontal: horizontalPadding, paddingTop: 14, paddingBottom: 150 }}
              showsVerticalScrollIndicator={false}
              renderSectionHeader={({ section }) => (
                <View
                  className="mb-3 rounded-2xl px-3 py-2 flex-row items-center justify-between"
                  style={{ backgroundColor: surfaceBg }}
                >
                  <View>
                    <Text style={{ color: colors.text.primary }} className="text-sm font-bold uppercase tracking-widest">
                      {section.categoryName}
                    </Text>
                    <Text style={{ color: colors.text.tertiary }} className="text-xs mt-0.5">
                      {section.countedItems}/{section.totalItems} counted
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => onMarkCategoryExpected(section.categoryName)}
                    className="rounded-full px-3 py-2"
                    style={{ backgroundColor: cardBg, borderWidth: 1, borderColor: cardBorder }}
                  >
                    <Text style={{ color: colors.text.secondary }} className="text-xs font-semibold">Mark section expected</Text>
                  </Pressable>
                </View>
              )}
              renderItem={({ item }) => (
                <ProductCard
                  product={item}
                  colors={colors}
                  isDark={isDark}
                  cardBg={cardBg}
                  cardBorder={cardBorder}
                  insetBg={insetBg}
                  onUpdateCount={onUpdateCount}
                />
              )}
              ListEmptyComponent={
                <View
                  className="rounded-3xl p-6 items-center mt-4"
                  style={{ backgroundColor: cardBg, borderWidth: 1, borderColor: cardBorder }}
                >
                  <AlertTriangle size={24} color={colors.text.muted} strokeWidth={2} />
                  <Text style={{ color: colors.text.primary }} className="font-semibold mt-3">No matching items</Text>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs mt-1 text-center">
                    Adjust search or filters to see more inventory items.
                  </Text>
                </View>
              }
            />

            <View
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                paddingHorizontal: horizontalPadding,
                paddingTop: 14,
                paddingBottom: 30,
                borderTopWidth: 1,
                borderTopColor: cardBorder,
                backgroundColor: mainBg,
              }}
            >
              <View className="flex-row items-center justify-between mb-1">
                <Text style={{ color: colors.text.secondary }} className="text-sm font-semibold">
                  {countedItems} of {totalItems} counted
                </Text>
                <Text style={{ color: colors.text.tertiary }} className="text-xs">{progressPercent}%</Text>
              </View>
              <Text
                className="text-xs mb-3"
                style={{ color: discrepancyCount > 0 ? '#B45309' : '#15803D' }}
              >
                {discrepancyCount > 0
                  ? `${discrepancyCount} discrepancy${discrepancyCount > 1 ? 'ies' : ''} found`
                  : 'All matched so far'}
              </Text>
              <View className="h-2 rounded-full mb-4" style={{ backgroundColor: insetBg }}>
                <View
                  className="h-2 rounded-full"
                  style={{
                    width: `${progressPercent}%`,
                    backgroundColor: discrepancyCount > 0 ? '#F59E0B' : '#16A34A',
                  }}
                />
              </View>
              <Pressable
                onPress={onSubmit}
                disabled={!canSubmit}
                className="rounded-full items-center justify-center"
                style={{
                  height: 54,
                  backgroundColor: canSubmit ? primaryActionBg : isDark ? '#222227' : colors.bg.tertiary,
                  opacity: canSubmit ? 1 : 0.6,
                }}
              >
                <Text style={{ color: canSubmit ? primaryActionText : colors.text.muted }} className="font-bold text-base">
                  Complete Audit
                </Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </SafeAreaView>

      <Modal
        visible={showFilterMenu}
        animationType="fade"
        transparent
        onRequestClose={() => setShowFilterMenu(false)}
      >
        <Pressable
          className="flex-1"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: isWeb ? 'center' : 'flex-end',
            alignItems: 'center',
          }}
          onPress={() => setShowFilterMenu(false)}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            className="overflow-hidden"
            style={{
              backgroundColor: mainBg,
              width: isWeb ? Math.min(520, width - 24) : '100%',
              maxHeight: isWeb ? '80%' : '75%',
              borderRadius: isWeb ? 20 : 24,
              borderWidth: isWeb ? 1 : 0,
              borderColor: isWeb ? cardBorder : 'transparent',
            }}
          >
            {!isWeb ? (
              <View className="items-center py-3">
                <View className="w-10 h-1 rounded-full" style={{ backgroundColor: cardBorder }} />
              </View>
            ) : null}

            <View
              className="flex-row items-center justify-between px-5"
              style={{
                paddingTop: isWeb ? 18 : 0,
                paddingBottom: 14,
                borderBottomWidth: 0.5,
                borderBottomColor: cardBorder,
              }}
            >
              <Text style={{ color: colors.text.primary }} className="font-bold text-lg">Filters</Text>
              <Pressable
                onPress={() => setShowFilterMenu(false)}
                className="w-8 h-8 rounded-full items-center justify-center"
                style={{ backgroundColor: insetBg }}
              >
                <X size={18} color={colors.text.tertiary} strokeWidth={2} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="px-5 pt-4">
                <Text style={{ color: colors.text.muted }} className="text-xs font-semibold uppercase tracking-wider mb-3">Status</Text>
                {statusFilterOptions.map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() => onStatusFilterChange(option.value)}
                    className="flex-row items-center py-3"
                  >
                    <View className="flex-1">
                      <Text style={{ color: colors.text.primary }} className="font-medium text-sm">{option.label}</Text>
                    </View>
                    {statusFilter === option.value ? (
                      <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: colors.text.primary }}>
                        <Check size={12} color={onPrimaryBg} strokeWidth={3} />
                      </View>
                    ) : null}
                  </Pressable>
                ))}
              </View>

              <View className="px-5 pt-4 pb-2" style={{ borderTopWidth: 0.5, borderTopColor: cardBorder, marginTop: 8 }}>
                <Text style={{ color: colors.text.muted }} className="text-xs font-semibold uppercase tracking-wider mb-3">Category</Text>
                {categoryOptions.map((categoryName) => (
                  <Pressable
                    key={categoryName}
                    onPress={() => onCategoryFilterChange(categoryName)}
                    className="flex-row items-center py-3"
                  >
                    <View className="flex-1">
                      <Text style={{ color: colors.text.primary }} className="font-medium text-sm">{categoryName}</Text>
                    </View>
                    {categoryFilter === categoryName ? (
                      <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: colors.text.primary }}>
                        <Check size={12} color={onPrimaryBg} strokeWidth={3} />
                      </View>
                    ) : null}
                  </Pressable>
                ))}
              </View>

              <View className="px-5 py-4 gap-2">
                <Pressable
                  onPress={() => {
                    onStatusFilterChange('all');
                    onCategoryFilterChange('All categories');
                  }}
                  className="rounded-full items-center justify-center"
                  style={{ height: 44, backgroundColor: insetBg, borderWidth: 1, borderColor: cardBorder }}
                >
                  <Text style={{ color: colors.text.secondary }} className="font-semibold text-sm">Clear filters</Text>
                </Pressable>

                <Pressable
                  onPress={() => setShowFilterMenu(false)}
                  className="rounded-full items-center justify-center"
                  style={{ height: 50, backgroundColor: colors.text.primary }}
                >
                  <Text style={{ color: onPrimaryBg }} className="font-semibold">Apply</Text>
                </Pressable>
              </View>

              <View className="h-6" />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function ProductCard({
  product,
  colors,
  isDark,
  cardBg,
  cardBorder,
  insetBg,
  onUpdateCount,
}: {
  product: ProductAuditGroup;
  colors: ThemeColors;
  isDark: boolean;
  cardBg: string;
  cardBorder: string;
  insetBg: string;
  onUpdateCount: (variantId: string, count: string) => void;
}) {
  return (
    <View
      className="mb-3 rounded-2xl overflow-hidden"
      style={{ backgroundColor: cardBg, borderWidth: 1, borderColor: cardBorder }}
    >
      <View className="px-4 py-3" style={{ borderBottomWidth: 1, borderBottomColor: cardBorder }}>
        <Text style={{ color: colors.text.primary }} className="font-bold">{product.productName}</Text>
        <Text style={{ color: colors.text.muted }} className="text-xs mt-0.5">{product.items.length} variant{product.items.length > 1 ? 's' : ''}</Text>
      </View>

      {product.items.map((item, index) => {
        const parsedCount = parseCount(item.physicalCount);
        const isCounted = parsedCount !== null;
        const isMatch = parsedCount === item.expectedStock && parsedCount !== null;
        const hasDiscrepancy = parsedCount !== null && parsedCount !== item.expectedStock;
        const delta = parsedCount !== null ? parsedCount - item.expectedStock : 0;

        return (
          <View
            key={item.variantId}
            className="px-4 py-3"
            style={index > 0 ? { borderTopWidth: 1, borderTopColor: cardBorder } : undefined}
          >
            <View className="flex-row items-start justify-between mb-2">
              <View className="flex-1 pr-3">
                <Text style={{ color: colors.text.secondary }} className="text-sm font-semibold">{item.variantName}</Text>
                <Text style={{ color: colors.text.muted }} className="text-xs mt-1">SKU: {item.sku}</Text>
              </View>
              <View className="items-end">
                <Text style={{ color: colors.text.tertiary }} className="text-xs">Expected</Text>
                <Text style={{ color: colors.text.primary }} className="text-sm font-bold">{item.expectedStock}</Text>
              </View>
            </View>

            <View className="flex-row items-center">
              <View
                className="rounded-xl px-3 mr-3"
                style={{
                  height: 44,
                  width: 92,
                  justifyContent: 'center',
                  backgroundColor: insetBg,
                  borderWidth: 1,
                  borderColor: hasDiscrepancy ? '#F59E0B' : isDark ? '#4A4A52' : cardBorder,
                }}
              >
                <TextInput
                  keyboardType="number-pad"
                  value={item.physicalCount}
                  onChangeText={(text) => onUpdateCount(item.variantId, text.replace(/[^0-9]/g, ''))}
                  placeholder="Count"
                  placeholderTextColor={colors.text.muted}
                  style={{ color: colors.text.primary, fontWeight: '700', fontSize: 16 }}
                  selectionColor={colors.text.primary}
                />
              </View>

              <View className="flex-1 flex-row items-center justify-end">
                {isMatch ? (
                  <View className="flex-row items-center">
                    <CheckCircle2 size={16} color="#16A34A" strokeWidth={2.25} />
                    <Text className="text-xs font-semibold ml-1" style={{ color: '#15803D' }}>Match</Text>
                  </View>
                ) : null}

                {hasDiscrepancy ? (
                  <View
                    className="rounded-full px-2 py-1"
                    style={{ backgroundColor: delta >= 0 ? 'rgba(34,197,94,0.14)' : 'rgba(239,68,68,0.14)' }}
                  >
                    <Text
                      className="text-xs font-semibold"
                      style={{ color: delta >= 0 ? '#15803D' : '#B91C1C' }}
                    >
                      {delta >= 0 ? '+' : ''}{delta}
                    </Text>
                  </View>
                ) : null}

                {!isCounted ? (
                  <View className="flex-row items-center">
                    <Circle size={14} color={colors.text.muted} strokeWidth={2} />
                    <Text style={{ color: colors.text.muted }} className="text-xs ml-1">Pending</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}
