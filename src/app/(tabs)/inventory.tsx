import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Dimensions, Modal, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, Search, Package, ChevronRight, Minus, Tag, Boxes, ClipboardList, Printer, Filter, Check, X, QrCode, PackagePlus, ImageIcon, ArrowUpDown, ArrowDownAZ, ArrowUpAZ, Clock, TrendingUp, AlertTriangle } from 'lucide-react-native';
import useFyllStore, { Product, ProductVariant, formatCurrency } from '@/lib/state/fyll-store';
import { normalizeProductType } from '@/lib/product-utils';
import { cn } from '@/lib/cn';
import { useThemeColors } from '@/lib/theme';
import { useBreakpoint } from '@/lib/useBreakpoint';
import { useTabBarHeight } from '@/lib/useTabBarHeight';
import { SplitViewLayout } from '@/components/SplitViewLayout';
import { ProductDetailPanel } from '@/components/ProductDetailPanel';
import { ProductCardSkeleton } from '@/components/SkeletonLoader';
import * as Haptics from 'expo-haptics';
import useAuthStore from '@/lib/state/auth-store';

const { width } = Dimensions.get('window');

// Hairline separator colors
const SEPARATOR_LIGHT = '#EEEEEE';
const SEPARATOR_DARK = '#333333';

interface VariantRowProps {
  product: Product;
  variant: ProductVariant;
  isOwner: boolean;
  onAdjustStock: (delta: number) => void;
  onPrintLabel: () => void;
  onRestock: () => void;
  separatorColor: string;
  isLast?: boolean;
  effectiveThreshold: number;
}

function VariantRow({ product, variant, isOwner, onAdjustStock, onPrintLabel, onRestock, separatorColor, isLast = false, effectiveThreshold }: VariantRowProps) {
  const colors = useThemeColors();
  const isService = normalizeProductType(product.productType) === 'service';
  const isLowStock = !isService && variant.stock > 0 && variant.stock <= effectiveThreshold;
  const isOutOfStock = !isService && variant.stock === 0;
  const variantName = Object.values(variant.variableValues).join(' / ');
  const statusColor = isService ? '#10B981' : isOutOfStock ? '#EF4444' : isLowStock ? '#F59E0B' : '#10B981';
  const statusText = isService
    ? 'Service'
    : isOutOfStock
      ? 'Out of stock'
      : `${variant.stock} units`;

  const handleAdjust = (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAdjustStock(delta);
  };

  const handlePrint = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPrintLabel();
  };

  const handleRestock = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRestock();
  };

  return (
    <View
      className="flex-row items-center py-3"
      style={isLast ? undefined : { borderBottomWidth: 0.5, borderBottomColor: separatorColor }}
    >
      <View className="flex-1">
        <Text style={{ color: colors.text.primary }} className="font-medium text-sm">{variantName}</Text>
        <Text style={{ color: colors.text.tertiary }} className="text-xs mt-0.5">SKU: {variant.sku}</Text>
      </View>

      {!isService && (
        <Pressable
          onPress={handleRestock}
          className="p-2 mr-1 active:opacity-50"
        >
          <PackagePlus size={16} color="#10B981" strokeWidth={2} />
        </Pressable>
      )}

      <Pressable
        onPress={handlePrint}
        className="p-2 mr-1 active:opacity-50"
      >
        <Printer size={16} color={colors.text.tertiary} strokeWidth={2} />
      </Pressable>

      <View className="items-end mr-3">
        <View
          className="px-2 py-0.5 rounded-md"
          style={{ backgroundColor: `${statusColor}15` }}
        >
          <Text style={{ color: statusColor }} className="text-xs font-semibold">
            {statusText}
          </Text>
        </View>
        {isOwner && (
          <Text style={{ color: colors.text.tertiary }} className="text-xs mt-0.5">
            {formatCurrency(variant.sellingPrice)}
          </Text>
        )}
      </View>

      {!isService && (
        <View
          className="flex-row items-center rounded-xl overflow-hidden"
          style={{ backgroundColor: colors.border.light }}
        >
        <Pressable
          onPress={() => handleAdjust(-1)}
          className="p-2.5 active:opacity-50"
          disabled={variant.stock === 0}
        >
          <Minus size={16} color={variant.stock === 0 ? colors.text.muted : colors.text.primary} strokeWidth={2} />
        </Pressable>
        <View className="w-8 items-center">
          <Text style={{ color: colors.text.primary }} className="font-semibold text-sm">{variant.stock}</Text>
        </View>
        <Pressable
          onPress={() => handleAdjust(1)}
          className="p-2.5 active:opacity-50"
        >
          <Plus size={16} color={colors.text.primary} strokeWidth={2} />
        </Pressable>
      </View>
      )}
    </View>
  );
}

interface ProductCardProps {
  product: Product;
  isOwner: boolean;
  onPress: () => void;
  onSelect?: () => void;
  isSelected?: boolean;
  onAdjustStock: (variantId: string, delta: number) => void;
  onPrintLabel: (variantId: string) => void;
  onRestock: (variantId: string) => void;
  effectiveThreshold: number;
  showSplitView?: boolean;
}

function ProductCard({ product, isOwner, onPress, onSelect, isSelected, onAdjustStock, onPrintLabel, onRestock, effectiveThreshold, showSplitView }: ProductCardProps) {
  const colors = useThemeColors();
  const isDark = colors.bg.primary === '#111111';
  const separatorColor = isDark ? SEPARATOR_DARK : SEPARATOR_LIGHT;

  const [expanded, setExpanded] = useState(false);
  const isService = normalizeProductType(product.productType) === 'service';
  const totalStock = isService ? 0 : product.variants.reduce((sum, v) => sum + v.stock, 0);
  const totalValue = product.variants.reduce((sum, v) => sum + v.stock * v.sellingPrice, 0);
  const lowStockCount = isService
    ? 0
    : product.variants.filter((v) => v.stock > 0 && v.stock <= effectiveThreshold).length;
  const isOutOfStock = !isService && product.variants.every((v) => v.stock === 0);
  const stockText = isService
    ? 'Service'
    : isOutOfStock
      ? 'Out of stock'
      : `${totalStock} in stock`;
  const stockTextColor = isService ? '#10B981' : (isOutOfStock ? '#EF4444' : '#10B981');
  const chipColor = isService ? '#10B981' : isOutOfStock ? '#EF4444' : '#10B981';
  const servicePrice = product.variants[0]?.sellingPrice ?? 0;

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    // In split view mode, select the product instead of expanding
    if (showSplitView && onSelect) {
      onSelect();
      return;
    }
    if (!showSplitView && onPress) {
      onPress();
      return;
    }
    setExpanded(!expanded);
  };

  return (
    <View className="mb-3">
          <View
            style={{
              backgroundColor: isSelected && showSplitView ? colors.bg.tertiary : colors.bg.card,
              borderWidth: isSelected && showSplitView ? 2 : 0.5,
              borderColor: isSelected && showSplitView ? colors.accent.primary : separatorColor,
              borderLeftWidth: isSelected && showSplitView ? 3 : 0.5,
              borderLeftColor: isSelected && showSplitView ? colors.accent.primary : separatorColor,
            }}
            className="rounded-2xl overflow-hidden"
          >
            <Pressable
              onPress={handlePress}
              className="p-3 flex-row items-center active:opacity-70"
            >
              <View className="flex-row items-center flex-1">
                {product.imageUrl ? (
                  <View className="w-12 h-12 rounded-lg overflow-hidden" style={{ borderWidth: 0.5, borderColor: separatorColor }}>
                    <Image
                      source={{ uri: product.imageUrl }}
                      style={{ width: 48, height: 48 }}
                      resizeMode="cover"
                    />
                  </View>
                ) : (
                  <View
                    className="w-12 h-12 rounded-xl items-center justify-center"
                    style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)' }}
                  >
                    <Package size={24} color="#10B981" strokeWidth={1.5} />
                  </View>
                )}
                <View className="ml-3 flex-1">
                  <Text style={{ color: colors.text.primary }} className="font-bold text-base">{product.name}</Text>
                  <Text style={{ color: stockTextColor }} className="text-xs mt-0.5">
                    {stockText}
                  </Text>
                </View>
              </View>
              <View className="flex-row items-center">
                <View
                  className="rounded-full px-3 py-1 flex-row items-center mr-2"
                  style={{ backgroundColor: `${chipColor}20` }}
                >
                  <Text style={{ color: chipColor }} className="text-xs font-semibold">
                    {isOutOfStock ? 'Out of stock' : isService ? 'Service' : `${totalStock} in stock`}
                  </Text>
                </View>
                <ChevronRight size={20} color={colors.text.tertiary} strokeWidth={2} />
              </View>
            </Pressable>

            {expanded && (
          <View className="px-4 pb-4" style={{ borderTopWidth: 0.5, borderTopColor: separatorColor }}>
            {product.variants.map((variant, index) => (
              <VariantRow
                key={variant.id}
                product={product}
                variant={variant}
                isOwner={isOwner}
                onAdjustStock={(delta) => onAdjustStock(variant.id, delta)}
                onPrintLabel={() => onPrintLabel(variant.id)}
                onRestock={() => onRestock(variant.id)}
                separatorColor={separatorColor}
                isLast={index === product.variants.length - 1}
                effectiveThreshold={effectiveThreshold}
              />
            ))}

            {isOwner && (
              <View className="flex-row items-center justify-between mt-3 py-3" style={{ borderTopWidth: 0.5, borderTopColor: separatorColor }}>
                <View>
                  <Text style={{ color: colors.text.tertiary }} className="text-sm">
                    {isService ? 'Service Price' : 'Total Inventory Value'}
                  </Text>
                  <Text style={{ color: colors.text.muted }} className="text-xs">
                    {isService ? 'default charge' : 'at retail price'}
                  </Text>
                </View>
                <Text className="text-emerald-500 font-bold text-lg">
                  {formatCurrency(isService ? servicePrice : totalValue)}
                </Text>
              </View>
            )}

            <View className="flex-row gap-2 mt-3">
              <Pressable
                onPress={onPress}
                className="flex-1 rounded-xl items-center active:opacity-80"
                style={{ height: 50, justifyContent: 'center', backgroundColor: colors.accent.primary }}
              >
                <Text style={{ color: colors.bg.primary === '#111111' ? '#000000' : '#FFFFFF' }} className="font-semibold text-sm">Edit Product</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

export default function InventoryScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const tabBarHeight = useTabBarHeight();
  const { isMobile, isTablet, isDesktop } = useBreakpoint();
  const isDark = colors.bg.primary === '#111111';
  const separatorColor = isDark ? SEPARATOR_DARK : SEPARATOR_LIGHT;
  const showSplitView = !isMobile;

  const products = useFyllStore((s) => s.products);
  const updateVariantStock = useFyllStore((s) => s.updateVariantStock);
  const userRole = useFyllStore((s) => s.userRole);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Global low stock threshold settings
  const useGlobalLowStockThreshold = useFyllStore((s) => s.useGlobalLowStockThreshold);
  const globalLowStockThreshold = useFyllStore((s) => s.globalLowStockThreshold);

  const isOwner = userRole === 'owner';

  // Show skeleton loader on first load when authenticated but no products yet
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const isInitialLoading = isAuthenticated && products.length === 0 && !hasLoadedOnce;

  useEffect(() => {
    if (products.length > 0) {
      setHasLoadedOnce(true);
    }
  }, [products.length]);
  const [searchQuery, setSearchQuery] = useState('');
  const [inventoryFilter, setInventoryFilter] = useState<'all' | 'low-stock' | 'in-stock' | 'out-of-stock'>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc' | 'newest' | 'oldest' | 'stock-low' | 'stock-high'>('name-asc');
  const activeFilterCount = (inventoryFilter !== 'all' ? 1 : 0) + (sortBy !== 'name-asc' ? 1 : 0);

  // Split view state
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  // Helper to get effective threshold for a product
  const getEffectiveThreshold = (product: typeof products[0]) => {
    return useGlobalLowStockThreshold ? globalLowStockThreshold : product.lowStockThreshold;
  };

  // Get selected product
  const selectedProduct = useMemo(() => {
    if (!selectedProductId) return null;
    return products.find((p) => p.id === selectedProductId);
  }, [products, selectedProductId]);

  const filteredProducts = useMemo(() => {
    let result = products;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((p) =>
        p.name.toLowerCase().includes(query) ||
        p.variants.some((v) => v.sku.toLowerCase().includes(query))
      );
    }

    if (inventoryFilter === 'low-stock') {
      result = result.filter((p) => {
        const threshold = useGlobalLowStockThreshold ? globalLowStockThreshold : p.lowStockThreshold;
        return p.variants.some((v) => v.stock <= threshold);
      });
    } else if (inventoryFilter === 'in-stock') {
      result = result.filter((p) => p.variants.some((v) => v.stock > 0));
    } else if (inventoryFilter === 'out-of-stock') {
      result = result.filter((p) => p.variants.every((v) => v.stock === 0));
    }

    // Apply sorting
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'stock-low':
          const aStock = a.variants.reduce((sum, v) => sum + v.stock, 0);
          const bStock = b.variants.reduce((sum, v) => sum + v.stock, 0);
          return aStock - bStock;
        case 'stock-high':
          const aStockH = a.variants.reduce((sum, v) => sum + v.stock, 0);
          const bStockH = b.variants.reduce((sum, v) => sum + v.stock, 0);
          return bStockH - aStockH;
        default:
          return 0;
      }
    });

    return result;
  }, [products, searchQuery, inventoryFilter, useGlobalLowStockThreshold, globalLowStockThreshold, sortBy]);

  useEffect(() => {
    if (!showSplitView) return;
    if (selectedProductId && filteredProducts.some((product) => product.id === selectedProductId)) return;
    if (filteredProducts.length > 0) {
      setSelectedProductId(filteredProducts[0].id);
    }
  }, [showSplitView, filteredProducts, selectedProductId]);

  const stats = useMemo(() => {
    const totalProducts = products.length;
    const totalVariants = products.reduce((sum, p) => sum + p.variants.length, 0);
    const lowStockItems = products.reduce((sum, p) => {
      const threshold = useGlobalLowStockThreshold ? globalLowStockThreshold : p.lowStockThreshold;
      return sum + p.variants.filter((v) => v.stock <= threshold).length;
    }, 0);
    const totalStock = products.reduce((sum, p) =>
      sum + p.variants.reduce((vSum, v) => vSum + v.stock, 0), 0
    );
    return { totalProducts, totalVariants, lowStockItems, totalStock };
  }, [products, useGlobalLowStockThreshold, globalLowStockThreshold]);

  const handleAdjustStock = (productId: string, variantId: string, delta: number) => {
    updateVariantStock(productId, variantId, delta);
  };

  const handleAddProduct = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push('/new-product');
  };

  const handleProductSelect = (productId: string) => {
    if (showSplitView) {
      setSelectedProductId(productId);
    } else {
      router.push(`/product/${productId}`);
    }
  };

  // Master pane content
  const masterContent = (
    <>
      {/* Header - positioned at very top with proper spacing */}
      <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12, backgroundColor: colors.bg.primary, borderBottomWidth: 0.5, borderBottomColor: separatorColor }}>
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text style={{ color: colors.text.tertiary }} className="text-xs font-medium uppercase tracking-wider">Catalog</Text>
            <Text style={{ color: colors.text.primary }} className="text-2xl font-bold">Inventory</Text>
          </View>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }
                router.replace('/inventory-audit');
              }}
              className="rounded-full overflow-hidden active:opacity-80"
              style={{ paddingHorizontal: 14, height: 42, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(168, 85, 247, 0.08)' }}
            >
              <ClipboardList size={16} color="#A856F6" strokeWidth={2} />
              <Text style={{ color: '#A856F6' }} className="font-semibold ml-1.5 text-sm">Audit</Text>
            </Pressable>
            <Pressable
              onPress={handleAddProduct}
              className="rounded-full overflow-hidden active:opacity-80"
              style={{ paddingHorizontal: 14, height: 42, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg.secondary }}
            >
              <Plus size={18} color={colors.text.primary} strokeWidth={2.5} />
              <Text style={{ color: colors.text.primary }} className="font-semibold ml-1.5 text-sm">Add</Text>
            </Pressable>
          </View>
        </View>

        {/* Search + Filter Row */}
        <View className="flex-row gap-2">
          <View
            className="flex-1 flex-row items-center rounded-xl px-4"
            style={{ height: 52, backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border }}
          >
            <Search size={18} color={colors.text.muted} strokeWidth={2} />
            <TextInput
              placeholder="Search products or SKUs..."
              placeholderTextColor={colors.input.placeholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={{ flex: 1, marginLeft: 8, color: colors.input.text, fontSize: 14 }}
              selectionColor={colors.text.primary}
            />
          </View>
            <Pressable
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                setShowFilterMenu(true);
              }}
              className="rounded-xl items-center justify-center active:opacity-70 flex-row px-4"
              style={{
                height: 52,
                backgroundColor: activeFilterCount > 0 ? colors.accent.primary : colors.bg.secondary,
                borderWidth: activeFilterCount > 0 ? 0 : 0.5,
                borderColor: separatorColor,
              }}
            >
            <Filter size={18} color={activeFilterCount > 0 ? (isDark ? '#000000' : '#FFFFFF') : colors.text.tertiary} strokeWidth={2} />
            {(activeFilterCount > 0) && (
              <Text style={{ color: isDark ? '#000000' : '#FFFFFF' }} className="font-semibold text-sm ml-1.5">
                {activeFilterCount}
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={{
          flex: 1,
          paddingHorizontal: 20,
          paddingTop: 16,
          backgroundColor: colors.bg.secondary,
          maxWidth: showSplitView ? undefined : 600,
        }}
        contentContainerStyle={{
          maxWidth: isDesktop ? 600 : undefined,
          alignSelf: isDesktop && !selectedProductId ? 'center' : undefined,
          paddingBottom: tabBarHeight + 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        {isInitialLoading ? (
          // Show skeleton loaders while data is syncing on first load
          <View>
            <ProductCardSkeleton />
            <ProductCardSkeleton />
            <ProductCardSkeleton />
            <ProductCardSkeleton />
            <ProductCardSkeleton />
          </View>
        ) : filteredProducts.length === 0 ? (
          <View className="items-center justify-center py-20">
            <View
              className="w-20 h-20 rounded-2xl items-center justify-center mb-4"
              style={{ backgroundColor: colors.border.light }}
            >
              <Package size={40} color={colors.text.muted} strokeWidth={1.5} />
            </View>
            <Text style={{ color: colors.text.tertiary }} className="text-base mb-1">No products found</Text>
            <Text style={{ color: colors.text.muted }} className="text-sm mb-4">Add your first product to get started</Text>
            <Pressable
              onPress={handleAddProduct}
              className="rounded-xl overflow-hidden active:opacity-80"
              style={{ paddingHorizontal: 24, paddingVertical: 14, backgroundColor: colors.accent.primary }}
            >
              <Text style={{ color: isDark ? '#000000' : '#FFFFFF' }} className="font-semibold">Add First Product</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isOwner={isOwner}
                isSelected={selectedProductId === product.id}
                showSplitView={showSplitView}
                onSelect={() => handleProductSelect(product.id)}
                onPress={() => router.push(`/product/${product.id}`)}
                onAdjustStock={(variantId, delta) => handleAdjustStock(product.id, variantId, delta)}
                onPrintLabel={(variantId) =>
                  router.push({
                    pathname: '/label-print',
                    params: { productId: product.id, variantId },
                  })
                }
                onRestock={(variantId) =>
                  router.push({
                    pathname: '/restock',
                    params: { productId: product.id, variantId },
                  })
                }
                effectiveThreshold={getEffectiveThreshold(product)}
              />
            ))}
            <View className="h-24" />
          </>
        )}
      </ScrollView>

      {/* Floating Scan Button */}
      <Pressable
        onPress={() => {
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          router.push('/scan');
        }}
        className="absolute bottom-6 right-5 rounded-full overflow-hidden active:opacity-80"
        style={{
          width: 56,
          height: 56,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.accent.primary,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <QrCode size={24} color={isDark ? '#000000' : '#FFFFFF'} strokeWidth={2} />
      </Pressable>
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        <SplitViewLayout
          detailContent={selectedProductId ? <ProductDetailPanel productId={selectedProductId} onClose={() => setSelectedProductId(null)} /> : null}
          detailTitle={selectedProduct?.name || 'Product Details'}
          onCloseDetail={() => setSelectedProductId(null)}
        >
          {masterContent}
        </SplitViewLayout>

        {/* Filter Menu Modal */}
        <Modal
          visible={showFilterMenu}
          animationType="fade"
          transparent
          onRequestClose={() => setShowFilterMenu(false)}
        >
          <Pressable
            className="flex-1 justify-end"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            onPress={() => setShowFilterMenu(false)}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              className="rounded-t-3xl"
              style={{ backgroundColor: colors.bg.primary, maxHeight: '70%' }}
            >
              {/* Handle */}
              <View className="items-center py-3">
                <View className="w-10 h-1 rounded-full" style={{ backgroundColor: colors.border.light }} />
              </View>

              {/* Header */}
              <View className="flex-row items-center justify-between px-5 pb-4" style={{ borderBottomWidth: 0.5, borderBottomColor: separatorColor }}>
                <Text style={{ color: colors.text.primary }} className="font-bold text-lg">Filter & Sort</Text>
                <Pressable
                  onPress={() => setShowFilterMenu(false)}
                  className="w-8 h-8 rounded-full items-center justify-center active:opacity-50"
                  style={{ backgroundColor: colors.bg.secondary }}
                >
                  <X size={18} color={colors.text.tertiary} strokeWidth={2} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Filter Section */}
                <View className="px-5 pt-4">
                  <Text style={{ color: colors.text.muted }} className="text-xs font-semibold uppercase tracking-wider mb-3">Filter</Text>

                  {[
                    {
                      key: 'all',
                      label: 'All products',
                      description: 'Every item in your catalog',
                      icon: Boxes,
                      helperColor: '#10B981',
                    },
                    {
                      key: 'low-stock',
                      label: 'Low stock only',
                      description: 'Variants at or below threshold',
                      icon: Tag,
                      helperColor: '#F59E0B',
                    },
                    {
                      key: 'in-stock',
                      label: 'In stock',
                      description: 'Variants that are available',
                      icon: Check,
                      helperColor: '#10B981',
                    },
                    {
                      key: 'out-of-stock',
                      label: 'Out of stock',
                      description: 'Variants with zero stock',
                      icon: AlertTriangle,
                      helperColor: '#EF4444',
                    },
                  ].map((option) => {
                    const Icon = option.icon;
                    return (
                      <Pressable
                        key={option.key}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setInventoryFilter(option.key as typeof inventoryFilter);
                        }}
                        className="flex-row items-center py-3 active:opacity-70"
                      >
                        <Icon size={18} color={inventoryFilter === option.key ? option.helperColor : colors.text.muted} strokeWidth={2} />
                        <View className="flex-1 ml-3">
                          <Text style={{ color: colors.text.primary }} className="font-medium text-sm">{option.label}</Text>
                          <Text style={{ color: colors.text.muted }} className="text-xs mt-0.5">{option.description}</Text>
                        </View>
                        {inventoryFilter === option.key && (
                          <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: colors.accent.primary }}>
                            <Check size={12} color={isDark ? '#000000' : '#FFFFFF'} strokeWidth={3} />
                          </View>
                        )}
                      </Pressable>
                    );
                  })}

                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setInventoryFilter('all');
                      setSortBy('name-asc');
                    }}
                    className="mt-3 rounded-xl items-center justify-center"
                    style={{ height: 42, backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.light }}
                  >
                    <Text style={{ color: colors.text.primary }} className="text-sm font-semibold">Clear filters</Text>
                  </Pressable>
                </View>

                {/* Sort Section */}
                <View className="px-5 pt-4 pb-2" style={{ borderTopWidth: 0.5, borderTopColor: separatorColor, marginTop: 8 }}>
                  <Text style={{ color: colors.text.muted }} className="text-xs font-semibold uppercase tracking-wider mb-3">Sort By</Text>

                  {/* Name A-Z */}
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSortBy('name-asc');
                    }}
                    className="flex-row items-center py-3 active:opacity-70"
                  >
                    <ArrowDownAZ size={18} color={sortBy === 'name-asc' ? colors.accent.primary : colors.text.muted} strokeWidth={2} />
                    <View className="flex-1 ml-3">
                      <Text style={{ color: colors.text.primary }} className="font-medium text-sm">Name (A-Z)</Text>
                    </View>
                    {sortBy === 'name-asc' && (
                      <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: colors.accent.primary }}>
                        <Check size={12} color={isDark ? '#000000' : '#FFFFFF'} strokeWidth={3} />
                      </View>
                    )}
                  </Pressable>

                  {/* Name Z-A */}
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSortBy('name-desc');
                    }}
                    className="flex-row items-center py-3 active:opacity-70"
                  >
                    <ArrowUpAZ size={18} color={sortBy === 'name-desc' ? colors.accent.primary : colors.text.muted} strokeWidth={2} />
                    <View className="flex-1 ml-3">
                      <Text style={{ color: colors.text.primary }} className="font-medium text-sm">Name (Z-A)</Text>
                    </View>
                    {sortBy === 'name-desc' && (
                      <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: colors.accent.primary }}>
                        <Check size={12} color={isDark ? '#000000' : '#FFFFFF'} strokeWidth={3} />
                      </View>
                    )}
                  </Pressable>

                  {/* Newest First */}
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSortBy('newest');
                    }}
                    className="flex-row items-center py-3 active:opacity-70"
                  >
                    <Clock size={18} color={sortBy === 'newest' ? colors.accent.primary : colors.text.muted} strokeWidth={2} />
                    <View className="flex-1 ml-3">
                      <Text style={{ color: colors.text.primary }} className="font-medium text-sm">Newest First</Text>
                    </View>
                    {sortBy === 'newest' && (
                      <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: colors.accent.primary }}>
                        <Check size={12} color={isDark ? '#000000' : '#FFFFFF'} strokeWidth={3} />
                      </View>
                    )}
                  </Pressable>

                  {/* Oldest First */}
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSortBy('oldest');
                    }}
                    className="flex-row items-center py-3 active:opacity-70"
                  >
                    <Clock size={18} color={sortBy === 'oldest' ? colors.accent.primary : colors.text.muted} strokeWidth={2} />
                    <View className="flex-1 ml-3">
                      <Text style={{ color: colors.text.primary }} className="font-medium text-sm">Oldest First</Text>
                    </View>
                    {sortBy === 'oldest' && (
                      <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: colors.accent.primary }}>
                        <Check size={12} color={isDark ? '#000000' : '#FFFFFF'} strokeWidth={3} />
                      </View>
                    )}
                  </Pressable>

                  {/* Stock: Low to High */}
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSortBy('stock-low');
                    }}
                    className="flex-row items-center py-3 active:opacity-70"
                  >
                    <TrendingUp size={18} color={sortBy === 'stock-low' ? colors.accent.primary : colors.text.muted} strokeWidth={2} style={{ transform: [{ rotate: '180deg' }] }} />
                    <View className="flex-1 ml-3">
                      <Text style={{ color: colors.text.primary }} className="font-medium text-sm">Stock: Low to High</Text>
                    </View>
                    {sortBy === 'stock-low' && (
                      <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: colors.accent.primary }}>
                        <Check size={12} color={isDark ? '#000000' : '#FFFFFF'} strokeWidth={3} />
                      </View>
                    )}
                  </Pressable>

                  {/* Stock: High to Low */}
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSortBy('stock-high');
                    }}
                    className="flex-row items-center py-3 active:opacity-70"
                  >
                    <TrendingUp size={18} color={sortBy === 'stock-high' ? colors.accent.primary : colors.text.muted} strokeWidth={2} />
                    <View className="flex-1 ml-3">
                      <Text style={{ color: colors.text.primary }} className="font-medium text-sm">Stock: High to Low</Text>
                    </View>
                    {sortBy === 'stock-high' && (
                      <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: colors.accent.primary }}>
                        <Check size={12} color={isDark ? '#000000' : '#FFFFFF'} strokeWidth={3} />
                      </View>
                    )}
                  </Pressable>
                </View>

                {/* Apply Button */}
                <View className="px-5 py-4">
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setShowFilterMenu(false);
                    }}
                    className="rounded-xl items-center justify-center active:opacity-80"
                    style={{ height: 50, backgroundColor: colors.accent.primary }}
                  >
                    <Text style={{ color: isDark ? '#000000' : '#FFFFFF' }} className="font-semibold">Apply</Text>
                  </Pressable>
                </View>

                <View className="h-8" />
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </View>
  );
}
