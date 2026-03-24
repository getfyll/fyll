import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, Search, Package, ChevronRight, ChevronDown, ChevronUp, Minus, Tag, Boxes, ClipboardList, Printer, Filter, Check, X, QrCode, PackagePlus, ArrowDownAZ, ArrowUpAZ, Clock, TrendingUp, TrendingDown, AlertTriangle, Briefcase } from 'lucide-react-native';
import useFyllStore, { Product, ProductVariant, formatCurrency } from '@/lib/state/fyll-store';
import { normalizeProductType } from '@/lib/product-utils';
import { useThemeColors } from '@/lib/theme';
import { useBreakpoint } from '@/lib/useBreakpoint';
import { useTabBarHeight } from '@/lib/useTabBarHeight';
import { getActiveSplitCardStyle } from '@/lib/selection-style';
import { SplitViewLayout } from '@/components/SplitViewLayout';
import { ProductDetailPanel } from '@/components/ProductDetailPanel';
import { ServiceDetailPanel } from '@/components/ServiceDetailPanel';
import { ProductCardSkeleton } from '@/components/SkeletonLoader';
import { DESKTOP_PAGE_HEADER_MIN_HEIGHT, getStandardPageHeadingStyle } from '@/lib/page-heading';
import * as Haptics from 'expo-haptics';
import useAuthStore from '@/lib/state/auth-store';

// Hairline separator colors
const SEPARATOR_LIGHT = '#EEEEEE';
const SEPARATOR_DARK = '#333333';
const INVENTORY_PAGE_SIZE = 24;

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
              backgroundColor: colors.bg.card,
              borderWidth: 0.5,
              borderColor: separatorColor,
              borderLeftWidth: 0.5,
              borderLeftColor: separatorColor,
              ...getActiveSplitCardStyle({ isSelected, showSplitView, isDark, colors }),
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
  const { isMobile, isDesktop } = useBreakpoint();
  const isDark = colors.bg.primary === '#111111';
  const separatorColor = isDark ? SEPARATOR_DARK : SEPARATOR_LIGHT;
  const isWebDesktop = Platform.OS === 'web' && isDesktop;
  const showSplitView = !isMobile && !isWebDesktop;
  const pageHeadingStyle = getStandardPageHeadingStyle(isMobile);
  const desktopHeaderMinHeight = DESKTOP_PAGE_HEADER_MIN_HEIGHT;

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

  // Fallback: stop showing skeletons after 4s even if no products loaded (new account)
  useEffect(() => {
    if (hasLoadedOnce) return;
    const timer = setTimeout(() => setHasLoadedOnce(true), 4000);
    return () => clearTimeout(timer);
  }, [hasLoadedOnce]);
  const [searchQuery, setSearchQuery] = useState('');
  const [inventoryTab, setInventoryTab] = useState<'products' | 'services'>('products');
  const [inventoryFilter, setInventoryFilter] = useState<'all' | 'low-stock' | 'in-stock' | 'out-of-stock'>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc' | 'newest' | 'oldest' | 'stock-low' | 'stock-high'>('name-asc');
  const [visibleProductsCount, setVisibleProductsCount] = useState(INVENTORY_PAGE_SIZE);
  const [visibleServicesCount, setVisibleServicesCount] = useState(INVENTORY_PAGE_SIZE);
  const activeFilterCount = (inventoryFilter !== 'all' ? 1 : 0) + (sortBy !== 'name-asc' ? 1 : 0);
  const isPaginatingRef = useRef(false);

  // Split view state
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [expandedByProductId, setExpandedByProductId] = useState<Record<string, boolean>>({});

  // Helper to get effective threshold for a product
  const getEffectiveThreshold = (product: typeof products[0]) => {
    return useGlobalLowStockThreshold ? globalLowStockThreshold : product.lowStockThreshold;
  };

  // Get selected product
  const selectedProduct = useMemo(() => {
    if (!selectedProductId) return null;
    return products.find((p) => p.id === selectedProductId);
  }, [products, selectedProductId]);

  const isServiceProduct = (product: Product) => {
    if (normalizeProductType(product.productType) === 'service') return true;
    return Boolean(
      product.serviceTags?.length ||
      product.serviceVariables?.length ||
      product.serviceFields?.length
    );
  };

  const filteredProducts = useMemo(() => {
    let result = products.filter((p) => !isServiceProduct(p));

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

  const filteredServices = useMemo(() => {
    let result = products.filter((p) => isServiceProduct(p));
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((service) =>
        service.name.toLowerCase().includes(query) ||
        (service.serviceTags ?? []).some((tag) => tag.toLowerCase().includes(query))
      );
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [products, searchQuery]);

  const selectedService = useMemo(() => {
    if (!selectedServiceId) return null;
    return filteredServices.find((service) => service.id === selectedServiceId) ?? null;
  }, [filteredServices, selectedServiceId]);

  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, visibleProductsCount),
    [filteredProducts, visibleProductsCount]
  );
  const visibleServices = useMemo(
    () => filteredServices.slice(0, visibleServicesCount),
    [filteredServices, visibleServicesCount]
  );
  const hasMoreProducts = visibleProducts.length < filteredProducts.length;
  const hasMoreServices = visibleServices.length < filteredServices.length;
  const hasMoreForCurrentTab = inventoryTab === 'services' ? hasMoreServices : hasMoreProducts;

  useEffect(() => {
    setVisibleProductsCount(INVENTORY_PAGE_SIZE);
  }, [searchQuery, inventoryFilter, sortBy, products.length]);

  useEffect(() => {
    setVisibleServicesCount(INVENTORY_PAGE_SIZE);
  }, [searchQuery, products.length]);

  const loadMoreInventoryItems = () => {
    if (isPaginatingRef.current) return;
    if (!hasMoreForCurrentTab) return;
    isPaginatingRef.current = true;
    if (inventoryTab === 'services') {
      setVisibleServicesCount((prev) => Math.min(prev + INVENTORY_PAGE_SIZE, filteredServices.length));
    } else {
      setVisibleProductsCount((prev) => Math.min(prev + INVENTORY_PAGE_SIZE, filteredProducts.length));
    }
    setTimeout(() => {
      isPaginatingRef.current = false;
    }, 150);
  };

  const handleInventoryScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isNearBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 220;
    if (isNearBottom) {
      loadMoreInventoryItems();
    }
  };

  useEffect(() => {
    if (!showSplitView) return;
    if (inventoryTab !== 'products') return;
    if (selectedProductId && filteredProducts.some((product) => product.id === selectedProductId)) return;
    if (filteredProducts.length > 0) {
      setSelectedProductId(filteredProducts[0].id);
      return;
    }
    setSelectedProductId(null);
  }, [showSplitView, inventoryTab, filteredProducts, selectedProductId]);

  useEffect(() => {
    if (!showSplitView) return;
    if (inventoryTab !== 'services') return;
    if (selectedServiceId && filteredServices.some((service) => service.id === selectedServiceId)) return;
    if (filteredServices.length > 0) {
      setSelectedServiceId(filteredServices[0].id);
      return;
    }
    setSelectedServiceId(null);
  }, [showSplitView, inventoryTab, filteredServices, selectedServiceId]);

  const handleAdjustStock = (productId: string, variantId: string, delta: number) => {
    updateVariantStock(productId, variantId, delta);
  };

  const handleAddProduct = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push('/new-product');
  };

  const handleAddService = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push('/new-service');
  };

  const handleProductSelect = (productId: string) => {
    const selected = products.find((p) => p.id === productId);
    const isService = normalizeProductType(selected?.productType) === 'service';
    if (isWebDesktop) {
      router.push(isService ? `/services/${productId}?from=inventory` : `/inventory/${productId}`);
      return;
    }
    if (showSplitView) {
      if (isService) {
        setSelectedServiceId(productId);
      } else {
        setSelectedProductId(productId);
      }
    } else {
      router.push(isService ? `/services/${productId}?from=inventory` : `/product/${productId}`);
    }
  };

  const serviceDetailContent = showSplitView && inventoryTab === 'services' && selectedServiceId
    ? <ServiceDetailPanel serviceId={selectedServiceId} from="inventory" />
    : null;

  const toggleExpanded = (productId: string) => {
    setExpandedByProductId((prev) => ({ ...prev, [productId]: !prev[productId] }));
  };

  const getProductSummary = (product: Product) => {
    const isService = normalizeProductType(product.productType) === 'service';
    const totalStock = isService ? 0 : product.variants.reduce((sum, v) => sum + v.stock, 0);
    const effectiveThreshold = useGlobalLowStockThreshold ? globalLowStockThreshold : product.lowStockThreshold;
    const lowStockCount = isService
      ? 0
      : product.variants.filter((v) => v.stock > 0 && v.stock <= effectiveThreshold).length;
    const isOutOfStock = !isService && product.variants.every((v) => v.stock === 0);

    const status = isService
      ? { label: 'Service', color: '#10B981' }
      : isOutOfStock
        ? { label: 'Out of stock', color: '#EF4444' }
        : lowStockCount > 0
          ? { label: 'Low stock', color: '#F59E0B' }
          : { label: 'In stock', color: '#10B981' };

    const primarySku = product.variants[0]?.sku ?? '—';
    const category = product.categories?.[0] ?? '—';
    const displayPrice = product.variants[0]?.sellingPrice ?? 0;

    return {
      isService,
      totalStock,
      effectiveThreshold,
      primarySku,
      category,
      displayPrice,
      status,
    };
  };

  // Master pane content
  const masterContent = (
    <>
      {/* Header - positioned at very top with proper spacing */}
      <View
        style={[
          {
            paddingHorizontal: isWebDesktop ? 28 : 20,
            paddingTop: isWebDesktop ? 0 : 24,
            paddingBottom: 12,
            backgroundColor: isDark ? 'transparent' : (isWebDesktop ? colors.bg.card : colors.bg.primary),
            borderBottomWidth: isWebDesktop ? 0 : 0.5,
            borderBottomColor: separatorColor,
          },
          isWebDesktop ? { maxWidth: 1456, width: '100%', alignSelf: 'flex-start' } : undefined,
        ]}
      >
          <View
            className={isWebDesktop ? 'flex-row items-center justify-between' : 'flex-row items-center justify-between mb-4'}
            style={isWebDesktop ? {
              minHeight: desktopHeaderMinHeight,
              borderBottomWidth: 1,
              borderBottomColor: separatorColor,
              marginBottom: 12,
              marginHorizontal: -28,
              paddingHorizontal: 28,
            } : undefined}
          >
            <View>
            <Text style={{ color: colors.text.primary, ...pageHeadingStyle }}>Inventory</Text>
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
	              style={{ paddingHorizontal: 14, height: 44, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(168, 85, 247, 0.08)' }}
	            >
	              <ClipboardList size={16} color="#A856F6" strokeWidth={2} />
	              <Text style={{ color: '#A856F6' }} className="font-semibold ml-1.5 text-sm">Audit</Text>
	            </Pressable>
            <Pressable
              onPress={isMobile && inventoryTab === 'services' ? handleAddService : handleAddProduct}
              className="rounded-full overflow-hidden active:opacity-80"
              style={{
                paddingHorizontal: 14,
                height: 44,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.accent.primary,
              }}
            >
              <Plus size={18} color={isDark ? '#111111' : '#FFFFFF'} strokeWidth={2.5} />
              <Text style={{ color: isDark ? '#111111' : '#FFFFFF' }} className="font-semibold ml-1.5 text-sm">
                {isMobile && inventoryTab === 'services' ? 'Add Service' : 'Add'}
              </Text>
            </Pressable>
          </View>
        </View>

	        {/* Search + Filter Row */}
	        {isWebDesktop ? (
	          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
		            <View
		              className="flex-row items-center rounded-full px-4"
		              style={{
		                height: 44,
		                width: '30%',
		                maxWidth: 420,
		                minWidth: 320,
		                backgroundColor: colors.input.bg,
	                borderWidth: 1,
	                borderColor: colors.border.light,
	              }}
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

	            <ScrollView
	              horizontal
	              showsHorizontalScrollIndicator={false}
	              style={{ flex: 1 }}
	              contentContainerStyle={{ flexGrow: 0, gap: 8, paddingRight: 4 }}
	            >
		              <Pressable
		                onPress={() => setInventoryFilter('all')}
		                className="rounded-full active:opacity-70"
		                style={{
		                  height: 44,
		                  paddingHorizontal: 16,
		                  alignItems: 'center',
		                  justifyContent: 'center',
		                  backgroundColor: inventoryFilter === 'all' ? colors.accent.primary : colors.bg.card,
		                  borderWidth: inventoryFilter === 'all' ? 0 : 1,
	                  borderColor: separatorColor,
	                }}
	              >
	                <Text
	                  className="text-sm font-semibold"
	                  style={{
	                    color: inventoryFilter === 'all' ? (isDark ? '#000000' : '#FFFFFF') : colors.text.primary,
	                  }}
	                >
	                  All
	                </Text>
	              </Pressable>
		              <Pressable
		                onPress={() => setInventoryFilter('low-stock')}
		                className="rounded-full active:opacity-70"
		                style={{
		                  height: 44,
		                  paddingHorizontal: 16,
		                  alignItems: 'center',
		                  justifyContent: 'center',
		                  backgroundColor: inventoryFilter === 'low-stock' ? colors.accent.primary : colors.bg.card,
		                  borderWidth: inventoryFilter === 'low-stock' ? 0 : 1,
	                  borderColor: separatorColor,
	                }}
	              >
	                <Text
	                  className="text-sm font-semibold"
	                  style={{
	                    color: inventoryFilter === 'low-stock' ? (isDark ? '#000000' : '#FFFFFF') : colors.text.primary,
	                  }}
	                >
	                  Low Stock
	                </Text>
	              </Pressable>
		              <Pressable
		                onPress={() => setInventoryFilter('in-stock')}
		                className="rounded-full active:opacity-70"
		                style={{
		                  height: 44,
		                  paddingHorizontal: 16,
		                  alignItems: 'center',
		                  justifyContent: 'center',
		                  backgroundColor: inventoryFilter === 'in-stock' ? colors.accent.primary : colors.bg.card,
		                  borderWidth: inventoryFilter === 'in-stock' ? 0 : 1,
	                  borderColor: separatorColor,
	                }}
	              >
	                <Text
	                  className="text-sm font-semibold"
	                  style={{
	                    color: inventoryFilter === 'in-stock' ? (isDark ? '#000000' : '#FFFFFF') : colors.text.primary,
	                  }}
	                >
	                  In Stock
	                </Text>
	              </Pressable>
		              <Pressable
		                onPress={() => setInventoryFilter('out-of-stock')}
		                className="rounded-full active:opacity-70"
		                style={{
		                  height: 44,
		                  paddingHorizontal: 16,
		                  alignItems: 'center',
		                  justifyContent: 'center',
		                  backgroundColor: inventoryFilter === 'out-of-stock' ? colors.accent.primary : colors.bg.card,
		                  borderWidth: inventoryFilter === 'out-of-stock' ? 0 : 1,
	                  borderColor: separatorColor,
	                }}
	              >
	                <Text
	                  className="text-sm font-semibold"
	                  style={{
	                    color: inventoryFilter === 'out-of-stock' ? (isDark ? '#000000' : '#FFFFFF') : colors.text.primary,
	                  }}
	                >
	                  Out of Stock
	                </Text>
	              </Pressable>
	            </ScrollView>

		            <Pressable
		              onPress={() => {
		                if (Platform.OS !== 'web') {
		                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		                }
		                setShowFilterMenu(true);
		              }}
		              className="rounded-full items-center justify-center active:opacity-70 flex-row px-4"
		              style={{
		                height: 44,
		                backgroundColor: activeFilterCount > 0 ? colors.accent.primary : colors.bg.card,
		                borderWidth: activeFilterCount > 0 ? 0 : 1,
		                borderColor: separatorColor,
		              }}
	            >
	              <Filter
	                size={18}
	                color={activeFilterCount > 0 ? (isDark ? '#000000' : '#FFFFFF') : colors.text.tertiary}
	                strokeWidth={2}
	              />
	              {activeFilterCount > 0 && (
	                <Text style={{ color: isDark ? '#000000' : '#FFFFFF' }} className="font-semibold text-sm ml-1.5">
	                  {activeFilterCount}
	                </Text>
	              )}
	            </Pressable>
	          </View>
        ) : (
          <View className="flex-row gap-2">
            <View
              className="flex-1 flex-row items-center rounded-full px-4"
              style={{ height: 52, backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.border.light }}
            >
              <Search size={18} color={colors.text.muted} strokeWidth={2} />
              <TextInput
                placeholder={inventoryTab === 'services' ? 'Search services...' : 'Search products or SKUs...'}
                placeholderTextColor={colors.input.placeholder}
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={{ flex: 1, marginLeft: 8, color: colors.input.text, fontSize: 14 }}
                selectionColor={colors.text.primary}
              />
            </View>
            {inventoryTab === 'products' && (
              <Pressable
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  setShowFilterMenu(true);
                }}
                className="rounded-full items-center justify-center active:opacity-70 flex-row px-4"
                style={{
                  height: 52,
                  backgroundColor: activeFilterCount > 0 ? colors.accent.primary : colors.bg.secondary,
                  borderWidth: activeFilterCount > 0 ? 0 : 0.5,
                  borderColor: separatorColor,
                }}
              >
                <Filter
                  size={18}
                  color={activeFilterCount > 0 ? (isDark ? '#000000' : '#FFFFFF') : colors.text.tertiary}
                  strokeWidth={2}
                />
                {activeFilterCount > 0 && (
                  <Text style={{ color: isDark ? '#000000' : '#FFFFFF' }} className="font-semibold text-sm ml-1.5">
                    {activeFilterCount}
                  </Text>
                )}
              </Pressable>
            )}
          </View>
        )}
      </View>

      {!isWebDesktop && (
        <View className="px-5 pb-2 pt-3">
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => setInventoryTab('products')}
              className="flex-1 items-center justify-center rounded-full active:opacity-80"
              style={{
                height: 40,
                backgroundColor: inventoryTab === 'products' ? colors.text.primary : colors.bg.primary,
                borderWidth: 1,
                borderColor: separatorColor,
              }}
            >
              <Text style={{ color: inventoryTab === 'products' ? colors.bg.primary : colors.text.primary }} className="text-sm font-semibold">
                Products
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setInventoryTab('services')}
              className="flex-1 items-center justify-center rounded-full active:opacity-80"
              style={{
                height: 40,
                backgroundColor: inventoryTab === 'services' ? colors.text.primary : colors.bg.primary,
                borderWidth: 1,
                borderColor: separatorColor,
              }}
            >
              <Text style={{ color: inventoryTab === 'services' ? colors.bg.primary : colors.text.primary }} className="text-sm font-semibold">
                Services
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      <ScrollView
        style={{
          flex: 1,
          paddingHorizontal: isWebDesktop ? 28 : 20,
          paddingTop: 16,
          backgroundColor: showSplitView ? colors.bg.primary : (isWebDesktop ? colors.bg.primary : colors.bg.secondary),
          maxWidth: isWebDesktop ? undefined : showSplitView ? undefined : 600,
        }}
	        contentContainerStyle={{
	          maxWidth: isWebDesktop ? 1400 : isDesktop ? 600 : undefined,
	          alignSelf: isWebDesktop ? 'flex-start' : isDesktop && !selectedProductId ? 'center' : undefined,
	          width: '100%',
	          paddingBottom: tabBarHeight + 16,
        }}
        showsVerticalScrollIndicator={false}
        onScroll={handleInventoryScroll}
        scrollEventThrottle={16}
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
        ) : inventoryTab === 'services' ? (
          filteredServices.length === 0 ? (
            <View className="items-center justify-center py-20">
              <View
                className="w-20 h-20 rounded-2xl items-center justify-center mb-4"
                style={{ backgroundColor: colors.border.light }}
              >
                <Briefcase size={36} color={colors.text.muted} strokeWidth={1.5} />
              </View>
              <Text style={{ color: colors.text.tertiary }} className="text-base mb-1">No services found</Text>
              <Text style={{ color: colors.text.muted }} className="text-sm mb-4">Add your first service to get started</Text>
              <Pressable
                onPress={handleAddService}
                className="rounded-full active:opacity-80 px-6 py-3 flex-row items-center"
                style={{ backgroundColor: colors.accent.primary }}
              >
                <Plus size={16} color={isDark ? '#000000' : '#FFFFFF'} strokeWidth={2.5} />
                <Text style={{ color: isDark ? '#000000' : '#FFFFFF' }} className="font-semibold ml-1.5">Create First Service</Text>
              </Pressable>
            </View>
          ) : (
            <View>
              {visibleServices.map((service) => {
                const tag = service.serviceTags?.[0] ?? 'General';
                const price = service.variants[0]?.sellingPrice ?? 0;
                const isSelectedService = showSplitView && inventoryTab === 'services' && selectedServiceId === service.id;
                return (
                  <Pressable
                    key={service.id}
                    onPress={() => handleProductSelect(service.id)}
                    className="active:opacity-70"
                    style={{
                      backgroundColor: colors.bg.card,
                      borderRadius: 16,
                      padding: 16,
                      marginBottom: 12,
                      borderWidth: 1,
                      borderColor: colors.border.light,
                      borderLeftWidth: 1,
                      borderLeftColor: colors.border.light,
                      ...getActiveSplitCardStyle({
                        isSelected: isSelectedService,
                        showSplitView,
                        isDark,
                        colors,
                      }),
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text.primary }} className="text-sm font-semibold">
                          {service.name}
                        </Text>
                        <Text style={{ color: colors.text.muted }} className="text-xs mt-2">
                          {tag}
                        </Text>
                        <Text style={{ color: colors.text.primary }} className="text-sm font-semibold mt-2">
                          {formatCurrency(price)}
                        </Text>
                      </View>
                      {showSplitView && (
                        <ChevronRight size={18} color={colors.text.muted} strokeWidth={2} />
                      )}
                    </View>
                  </Pressable>
                );
              })}
              <View className="items-center py-3">
                {hasMoreServices ? (
                  <Pressable
                    onPress={loadMoreInventoryItems}
                    className="rounded-full active:opacity-80 px-4"
                    style={{
                      height: 38,
                      justifyContent: 'center',
                      backgroundColor: colors.bg.card,
                      borderWidth: 1,
                      borderColor: separatorColor,
                    }}
                  >
                    <Text style={{ color: colors.text.primary }} className="text-sm font-semibold">
                      Load more
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={{ color: colors.text.muted }} className="text-xs">
                    Showing {visibleServices.length} of {filteredServices.length}
                  </Text>
                )}
              </View>
              <View className="h-24" />
            </View>
          )
        ) : (
          <>
            {isWebDesktop ? (
              <View
                style={{
                  width: '100%',
                  borderWidth: 1,
                  borderColor: separatorColor,
                  borderRadius: 16,
                  overflow: 'hidden',
                  backgroundColor: colors.bg.card,
                }}
                >
                <View style={{ backgroundColor: colors.bg.card, borderBottomWidth: 1, borderBottomColor: separatorColor }}>
                  <View style={{ flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 12 }}>
                    <Text style={{ color: colors.text.muted, flex: 2.2 }} className="text-xs font-semibold">
                      PRODUCT
                    </Text>
                    <Text style={{ color: colors.text.muted, flex: 1 }} className="text-xs font-semibold">
                      SKU
                    </Text>
                    <Text style={{ color: colors.text.muted, flex: 1 }} className="text-xs font-semibold">
                      CATEGORY
                    </Text>
                    <Text style={{ color: colors.text.muted, width: 80, textAlign: 'center' }} className="text-xs font-semibold">
                      STOCK
                    </Text>
                    {isOwner ? (
                      <Text style={{ color: colors.text.muted, width: 120, textAlign: 'right' }} className="text-xs font-semibold">
                        PRICE
                      </Text>
                    ) : (
                      <View style={{ width: 0 }} />
                    )}
                    <View style={{ width: 170, paddingLeft: 24 }}>
                      <Text style={{ color: colors.text.muted }} className="text-xs font-semibold">
                        STATUS
                      </Text>
                    </View>
                    <View style={{ width: 34 }} />
                  </View>
                </View>

                {filteredProducts.length === 0 ? (
                  <View style={{ padding: 40, alignItems: 'center' }}>
                    <View style={{ width: 80, height: 80, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 16, backgroundColor: colors.border.light }}>
                      <Package size={36} color={colors.text.muted} strokeWidth={1.5} />
                    </View>
                    <Text style={{ color: colors.text.tertiary, fontSize: 16, marginBottom: 4 }}>No products found</Text>
                    <Text style={{ color: colors.text.muted, fontSize: 14, marginBottom: 16 }}>Add your first product to get started</Text>
                    <Pressable
                      onPress={handleAddProduct}
                      style={{ backgroundColor: colors.accent.primary, borderRadius: 999, paddingHorizontal: 24, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' }}
                    >
                      <Plus size={16} color={isDark ? '#000000' : '#FFFFFF'} strokeWidth={2.5} />
                      <Text style={{ color: isDark ? '#000000' : '#FFFFFF', fontWeight: '600', marginLeft: 6 }}>Create First Product</Text>
                    </Pressable>
                  </View>
                ) : visibleProducts.map((product, index) => {
                  const summary = getProductSummary(product);
                  const expanded = !!expandedByProductId[product.id];
                  const isSelected = selectedProductId === product.id && showSplitView;
                  const rowBg = isSelected ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') : colors.bg.card;

                  return (
                    <View
                      key={product.id}
                      style={{
                        backgroundColor: rowBg,
                        borderBottomWidth: index === visibleProducts.length - 1 ? 0 : 1,
                        borderBottomColor: separatorColor,
                      }}
                    >
                      <Pressable
                        onPress={() => handleProductSelect(product.id)}
                        className="active:opacity-70"
                        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 14 }}
                      >
                        <View style={{ flex: 2.2, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation();
                              toggleExpanded(product.id);
                            }}
                            className="active:opacity-70"
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 10,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: colors.bg.secondary,
                              borderWidth: 1,
                              borderColor: colors.border.light,
                            }}
                          >
                            {expanded ? (
                              <ChevronUp size={16} color={colors.text.tertiary} strokeWidth={2} />
                            ) : (
                              <ChevronDown size={16} color={colors.text.tertiary} strokeWidth={2} />
                            )}
                          </Pressable>

                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={{ color: colors.text.primary }} className="text-sm font-semibold" numberOfLines={1}>
                              {product.name}
                            </Text>
                            <Text style={{ color: colors.text.tertiary }} className="text-xs mt-0.5" numberOfLines={1}>
                              {product.variants.length} {product.variants.length === 1 ? 'variant' : 'variants'}
                            </Text>
                          </View>
                        </View>

                        <Text style={{ color: colors.text.secondary, flex: 1 }} className="text-sm" numberOfLines={1}>
                          {summary.primarySku}
                        </Text>
                        <Text style={{ color: colors.text.secondary, flex: 1 }} className="text-sm" numberOfLines={1}>
                          {summary.category}
                        </Text>

                        <Text style={{ color: colors.text.primary, width: 80, textAlign: 'center' }} className="text-sm font-semibold">
                          {summary.isService ? '—' : String(summary.totalStock)}
                        </Text>

                        {isOwner ? (
                          <Text style={{ color: colors.text.primary, width: 120, textAlign: 'right' }} className="text-sm font-semibold" numberOfLines={1}>
                            {formatCurrency(summary.displayPrice)}
                          </Text>
                        ) : (
                          <View style={{ width: 0 }} />
                        )}

                        <View style={{ width: 170, paddingLeft: 24, flexDirection: 'row' }}>
                          <View className="px-2 py-1 rounded-md" style={{ backgroundColor: `${summary.status.color}15` }}>
                            <Text style={{ color: summary.status.color }} className="text-xs font-semibold" numberOfLines={1}>
                              {summary.status.label}
                            </Text>
                          </View>
                        </View>

                        <View style={{ width: 34, alignItems: 'flex-end' }}>
                          <ChevronRight size={16} color={colors.text.muted} strokeWidth={2} />
                        </View>
                      </Pressable>

                      {expanded && (
                        <View style={{ backgroundColor: colors.bg.card, borderTopWidth: 1, borderTopColor: separatorColor }}>
                          {product.variants.map((variant, vIndex) => {
                            const variantName = Object.values(variant.variableValues).join(' / ') || 'Default';
                            const isService = normalizeProductType(product.productType) === 'service';
                            const isLow = !isService && variant.stock > 0 && variant.stock <= summary.effectiveThreshold;
                            const isOut = !isService && variant.stock === 0;
                            const vColor = isService ? '#10B981' : isOut ? '#EF4444' : isLow ? '#F59E0B' : '#10B981';
                            const vText = isService ? 'Service' : isOut ? 'Out' : isLow ? 'Low' : 'OK';

                            return (
                              <View
                                key={variant.id}
                                style={{
                                  backgroundColor: colors.bg.card,
                                  borderBottomWidth: vIndex === product.variants.length - 1 ? 0 : 1,
                                  borderBottomColor: separatorColor,
                                }}
                              >
                                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 12 }}>
                                  <View style={{ flex: 2.2, paddingLeft: 40, minWidth: 0 }}>
                                    <Text style={{ color: colors.text.primary }} className="text-sm font-medium" numberOfLines={1}>
                                      {variantName}
                                    </Text>
                                  </View>
                                  <Text style={{ color: colors.text.secondary, flex: 1 }} className="text-sm" numberOfLines={1}>
                                    {variant.sku}
                                  </Text>
                                  <View style={{ flex: 1 }}>
                                    <Text style={{ color: colors.text.tertiary }} className="text-xs" numberOfLines={1}>
                                      —
                                    </Text>
                                  </View>

                                  <View style={{ width: 80, alignItems: 'center' }}>
                                    {isService ? (
                                      <Text style={{ color: colors.text.muted }} className="text-sm">
                                        —
                                      </Text>
                                    ) : (
                                      <View
                                        className="flex-row items-center rounded-xl overflow-hidden"
                                        style={{ backgroundColor: colors.border.light }}
                                      >
                                        <Pressable
                                          onPress={() => handleAdjustStock(product.id, variant.id, -1)}
                                          className="p-2 active:opacity-50"
                                          disabled={variant.stock === 0}
                                        >
                                          <Minus size={14} color={variant.stock === 0 ? colors.text.muted : colors.text.primary} strokeWidth={2} />
                                        </Pressable>
                                        <View style={{ width: 28, alignItems: 'center' }}>
                                          <Text style={{ color: colors.text.primary }} className="text-sm font-semibold">
                                            {variant.stock}
                                          </Text>
                                        </View>
                                        <Pressable
                                          onPress={() => handleAdjustStock(product.id, variant.id, 1)}
                                          className="p-2 active:opacity-50"
                                        >
                                          <Plus size={14} color={colors.text.primary} strokeWidth={2} />
                                        </Pressable>
                                      </View>
                                    )}
                                  </View>

                                  {isOwner ? (
                                    <Text style={{ color: colors.text.primary, width: 120, textAlign: 'right' }} className="text-sm font-semibold" numberOfLines={1}>
                                      {formatCurrency(variant.sellingPrice)}
                                    </Text>
                                  ) : (
                                    <View style={{ width: 0 }} />
                                  )}

                                  <View style={{ width: 170, paddingLeft: 16, flexDirection: 'row', alignItems: 'center' }}>
                                    <View className="px-2 py-1 rounded-md" style={{ backgroundColor: `${vColor}15` }}>
                                      <Text style={{ color: vColor }} className="text-xs font-semibold">
                                        {vText}
                                      </Text>
                                    </View>
                                  </View>

                                  <View style={{ width: 64, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                                    {!isService && (
                                      <Pressable
                                        onPress={() =>
                                          router.push({
                                            pathname: '/restock',
                                            params: { productId: product.id, variantId: variant.id },
                                          })
                                        }
                                        className="active:opacity-60"
                                      >
                                        <PackagePlus size={16} color="#10B981" strokeWidth={2} />
                                      </Pressable>
                                    )}
                                    <Pressable
                                      onPress={() =>
                                        router.push({
                                          pathname: '/label-print',
                                          params: { productId: product.id, variantId: variant.id },
                                        })
                                      }
                                      className="active:opacity-60"
                                    >
                                      <Printer size={16} color={colors.text.tertiary} strokeWidth={2} />
                                    </Pressable>
                                  </View>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : filteredProducts.length === 0 ? (
              <View className="items-center justify-center py-20">
                <View className="w-20 h-20 rounded-2xl items-center justify-center mb-4" style={{ backgroundColor: colors.border.light }}>
                  <Package size={40} color={colors.text.muted} strokeWidth={1.5} />
                </View>
                <Text style={{ color: colors.text.tertiary }} className="text-base mb-1">No products found</Text>
                <Text style={{ color: colors.text.muted }} className="text-sm mb-4">Add your first product to get started</Text>
                <Pressable
                  onPress={handleAddProduct}
                  className="rounded-full active:opacity-80 px-6 py-3 flex-row items-center"
                  style={{ backgroundColor: colors.accent.primary }}
                >
                  <Plus size={16} color={isDark ? '#000000' : '#FFFFFF'} strokeWidth={2.5} />
                  <Text style={{ color: isDark ? '#000000' : '#FFFFFF' }} className="font-semibold ml-1.5">Create First Product</Text>
                </Pressable>
              </View>
            ) : (
              visibleProducts.map((product) => (
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
              ))
            )}
            <View className="items-center py-3">
              {hasMoreForCurrentTab ? (
                <Pressable
                  onPress={loadMoreInventoryItems}
                  className="rounded-full active:opacity-80 px-4"
                  style={{
                    height: 38,
                    justifyContent: 'center',
                    backgroundColor: colors.bg.card,
                    borderWidth: 1,
                    borderColor: separatorColor,
                  }}
                >
                  <Text style={{ color: colors.text.primary }} className="text-sm font-semibold">
                    Load more
                  </Text>
                </Pressable>
              ) : (
                <Text style={{ color: colors.text.muted }} className="text-xs">
                  Showing {visibleProducts.length} of {filteredProducts.length}
                </Text>
              )}
            </View>
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
    <View style={{ flex: 1, backgroundColor: showSplitView ? colors.bg.primary : (isWebDesktop ? colors.bg.primary : colors.bg.secondary) }}>
      <SafeAreaView className="flex-1" edges={isWebDesktop ? [] : ['top']}>
        <SplitViewLayout
          detailContent={
            inventoryTab === 'services'
              ? serviceDetailContent
              : showSplitView && selectedProductId
                ? <ProductDetailPanel productId={selectedProductId} onClose={() => setSelectedProductId(null)} />
                : null
          }
          detailTitle={
            showSplitView
              ? inventoryTab === 'services'
                ? (selectedService?.name || 'Service Details')
                : (selectedProduct?.name || 'Product Details')
              : undefined
          }
          onCloseDetail={
            showSplitView
              ? inventoryTab === 'services'
                ? () => setSelectedServiceId(null)
                : () => setSelectedProductId(null)
              : undefined
          }
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
                    <TrendingDown size={18} color={sortBy === 'stock-low' ? colors.accent.primary : colors.text.muted} strokeWidth={2} />
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
