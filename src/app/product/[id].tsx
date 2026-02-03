import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Alert, Modal, Switch, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Package, Plus, Minus, Trash2, Edit2, X, ChevronDown, Check, Search, Printer, PackagePlus, Clock, Camera, ImageIcon, Loader } from 'lucide-react-native';
import useFyllStore, { ProductVariant, formatCurrency } from '@/lib/state/fyll-store';
import { useThemeColors } from '@/lib/theme';
import { cn } from '@/lib/cn';
import * as Haptics from 'expo-haptics';
import { useImagePicker } from '@/hooks/useImagePicker';
import { Button } from '@/components/Button';
import useAuthStore from '@/lib/state/auth-store';

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

export default function ProductDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const themeColors = useThemeColors();
  const themeMode = useFyllStore((s) => s.themeMode);
  const isDark = themeMode === 'dark';

  const products = useFyllStore((s) => s.products);
  const productVariables = useFyllStore((s) => s.productVariables);
  const globalCategories = useFyllStore((s) => s.categories);
  const addCategory = useFyllStore((s) => s.addCategory);
  const updateProduct = useFyllStore((s) => s.updateProduct);
  const deleteProduct = useFyllStore((s) => s.deleteProduct);
  const updateVariantStock = useFyllStore((s) => s.updateVariantStock);
  const addProductVariant = useFyllStore((s) => s.addProductVariant);
  const updateProductVariant = useFyllStore ((s) => s.updateProductVariant);
  const deleteProductVariant = useFyllStore((s) => s.deleteProductVariant);
  const userRole = useFyllStore((s) => s.userRole);
  const restockLogs = useFyllStore((s) => s.restockLogs);
  const businessId = useAuthStore((s) => s.businessId);

  const product = useMemo(() => products.find((p) => p.id === id), [products, id]);
  const isOwner = userRole === 'owner';

  // Get recent restock logs for this product (last 3)
  const recentRestocks = useMemo(() => {
    if (!id) return [];
    return restockLogs
      .filter((log) => log.productId === id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 3);
  }, [restockLogs, id]);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(product?.name || '');
  const [editDescription, setEditDescription] = useState(product?.description || '');
  const [editThreshold, setEditThreshold] = useState(String(product?.lowStockThreshold || 5));
  const [editCategories, setEditCategories] = useState<string[]>(product?.categories || []);
  const [newCategory, setNewCategory] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [editImageUrl, setEditImageUrl] = useState<string | undefined>(product?.imageUrl);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');

  // New Design edit state
  const [editIsNewDesign, setEditIsNewDesign] = useState(product?.isNewDesign || false);
  const [editDesignYear, setEditDesignYear] = useState(String(product?.designYear || new Date().getFullYear()));

  // Discontinued edit state
  const [editIsDiscontinued, setEditIsDiscontinued] = useState(product?.isDiscontinued || false);

  // Global pricing state
  const [useGlobalPrice, setUseGlobalPrice] = useState(true);
  const [globalPrice, setGlobalPrice] = useState('');

  // Add variant modal state
  const [showAddVariant, setShowAddVariant] = useState(false);
  const [selectedVariableId, setSelectedVariableId] = useState<string>('');
  const [newVariantValue, setNewVariantValue] = useState('');
  const [newVariantSku, setNewVariantSku] = useState('');
  const [newVariantStock, setNewVariantStock] = useState('0');
  const [newVariantPrice, setNewVariantPrice] = useState('');
  const [showVariableTypeDropdown, setShowVariableTypeDropdown] = useState(false);

  // Edit variant modal state
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [editVariantSku, setEditVariantSku] = useState('');
  const [editVariantPrice, setEditVariantPrice] = useState('');
  const [editVariantName, setEditVariantName] = useState('');
  const [editVariantImageUrl, setEditVariantImageUrl] = useState<string | undefined>(undefined);

  // Use the web-safe image picker hook
  const imagePicker = useImagePicker();

  // Get product variables used by this product
  const usedVariables = useMemo(() => {
    if (!product || product.variants.length === 0) return productVariables;
    const firstVariant = product.variants[0];
    const usedVarNames = Object.keys(firstVariant.variableValues);
    return productVariables.filter((v) => usedVarNames.includes(v.name));
  }, [product, productVariables]);

  if (!product) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: colors.bg.primary }}>
        <Text style={{ color: colors.text.tertiary }} className="text-lg">Product not found</Text>
        <Pressable onPress={() => router.back()} className="mt-4 active:opacity-50">
          <Text style={{ color: colors.text.primary }} className="font-semibold">Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
  const retailValue = product.variants.reduce((sum, v) => sum + v.stock * v.sellingPrice, 0);
  const lowStockCount = product.variants.filter((v) => v.stock <= product.lowStockThreshold).length;

  const handleOpenEdit = () => {
    setEditName(product.name);
    setEditDescription(product.description);
    setEditThreshold(String(product.lowStockThreshold));
    setEditCategories(product.categories || []);
    setNewCategory('');
    setEditImageUrl(product.imageUrl);
    // Load new design values
    setEditIsNewDesign(product.isNewDesign || false);
    setEditDesignYear(String(product.designYear || new Date().getFullYear()));
    // Load discontinued value
    setEditIsDiscontinued(product.isDiscontinued || false);
    // Check if all variants have same price
    const prices = product.variants.map(v => v.sellingPrice);
    const allSamePrice = prices.every(p => p === prices[0]);
    setUseGlobalPrice(allSamePrice);
    setGlobalPrice(allSamePrice ? String(prices[0]) : '');
    setIsEditing(true);
  };

  const handleAddCategory = () => {
    if (newCategory.trim() && !editCategories.includes(newCategory.trim())) {
      const trimmedCat = newCategory.trim();
      setEditCategories([...editCategories, trimmedCat]);
      // Also save to global categories database
      addCategory(trimmedCat);
      setNewCategory('');
      setShowCategoryDropdown(false);
    }
  };

  const handleSelectCategory = (cat: string) => {
    if (!editCategories.includes(cat)) {
      setEditCategories([...editCategories, cat]);
    }
    setShowCategoryDropdown(false);
    setNewCategory('');
  };

  const handleRemoveCategory = (cat: string) => {
    setEditCategories(editCategories.filter(c => c !== cat));
  };

  // Image picker handler using the web-safe hook
  const handlePickImage = async () => {
    setShowImagePicker(false);
    const uri = await imagePicker.pickImage();
    if (uri) {
      setEditImageUrl(uri);
    }
  };

  const handleRemoveImage = () => {
    setEditImageUrl(undefined);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) return;

    // Determine if this is the first time marking as new design
    const wasNewDesign = product.isNewDesign || false;
    const nowNewDesign = editIsNewDesign;
    const firstTimeNewDesign = !wasNewDesign && nowNewDesign;

    // Determine if this is the first time marking as discontinued
    const wasDiscontinued = product.isDiscontinued || false;
    const nowDiscontinued = editIsDiscontinued;
    const firstTimeDiscontinued = !wasDiscontinued && nowDiscontinued;

    // FIRST: If using global price, update all variants BEFORE saving product
    // This ensures the prices are updated in the same transaction
    if (useGlobalPrice && globalPrice) {
      const newPrice = parseFloat(globalPrice) || 0;
      product.variants.forEach(variant => {
        updateProductVariant(product.id, variant.id, { sellingPrice: newPrice });
      });
    }

    // THEN: Update product basic info (this will trigger sync with all the updated variants)
    await updateProduct(product.id, {
      name: editName.trim(),
      description: editDescription.trim(),
      lowStockThreshold: parseInt(editThreshold, 10) || 5,
      categories: editCategories,
      imageUrl: editImageUrl,
      // New Design fields
      isNewDesign: editIsNewDesign,
      designYear: editIsNewDesign ? parseInt(editDesignYear, 10) || new Date().getFullYear() : undefined,
      designLaunchedAt: firstTimeNewDesign
        ? new Date().toISOString()
        : (editIsNewDesign ? product.designLaunchedAt : undefined),
      // Discontinued fields
      isDiscontinued: editIsDiscontinued,
      discontinuedAt: firstTimeDiscontinued
        ? new Date().toISOString()
        : (editIsDiscontinued ? product.discontinuedAt : undefined),
    }, businessId);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsEditing(false);
  };

  const handleSaveProduct = async () => {
    if (isSavingProduct) return;
    setIsSavingProduct(true);
    const latestProduct = useFyllStore.getState().products.find((p) => p.id === product.id);
    if (latestProduct) {
      await updateProduct(product.id, latestProduct, businessId);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaveNotice('Saved for all devices.');
    setTimeout(() => setSaveNotice(''), 2000);
    setIsSavingProduct(false);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Product',
      `Are you sure you want to delete "${product.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteProduct(product.id, businessId);
            router.back();
          },
        },
      ]
    );
  };

  const handleAdjustStock = (variantId: string, delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateVariantStock(product.id, variantId, delta);
  };

  const handleOpenAddVariant = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Initialize with first variable type if available
    const firstVar = productVariables[0];
    setSelectedVariableId(firstVar?.id || '');
    setNewVariantValue('');
    setNewVariantSku('');
    setNewVariantStock('0');
    setNewVariantPrice('');
    setShowVariableTypeDropdown(false);
    setShowAddVariant(true);
  };

  const generateBarcode = () => {
    return Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
  };

  // Auto-generate SKU when product name or variant value changes
  const getAutoSku = () => {
    if (!product || !newVariantValue.trim()) return '';
    const productPart = product.name.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10);
    const valuePart = newVariantValue.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10);
    return `${productPart}-${valuePart}`;
  };

  const handleAddVariant = () => {
    const selectedVariable = productVariables.find(v => v.id === selectedVariableId);

    if (!selectedVariable) {
      Alert.alert('Missing Variable Type', 'Please select a variable type (e.g., Color, Size).');
      return;
    }

    if (!newVariantValue.trim()) {
      Alert.alert('Missing Value', 'Please enter a value for the variant.');
      return;
    }

    if (!newVariantPrice) {
      Alert.alert('Missing Price', 'Please enter a selling price.');
      return;
    }

    const variantId = Math.random().toString(36).substring(2, 15);
    // Use user-entered SKU or auto-generate
    const sku = newVariantSku.trim() || getAutoSku();

    const newVariant: ProductVariant = {
      id: variantId,
      sku,
      barcode: generateBarcode(),
      variableValues: { [selectedVariable.name]: newVariantValue.trim() },
      stock: parseInt(newVariantStock, 10) || 0,
      sellingPrice: parseFloat(newVariantPrice) || 0,
    };

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addProductVariant(product.id, newVariant);
    setShowAddVariant(false);
  };

  const handleOpenEditVariant = (variant: ProductVariant) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingVariant(variant);
    setEditVariantSku(variant.sku);
    setEditVariantPrice(variant.sellingPrice.toString());
    setEditVariantName(Object.values(variant.variableValues).join(' / '));
    setEditVariantImageUrl(variant.imageUrl);
  };

  const handleSaveVariant = () => {
    if (!editingVariant) return;

    // Update variant name/value
    const variableKey = Object.keys(editingVariant.variableValues)[0];
    const newVariableValues = variableKey
      ? { [variableKey]: editVariantName.trim() || Object.values(editingVariant.variableValues)[0] }
      : editingVariant.variableValues;

    updateProductVariant(product.id, editingVariant.id, {
      sku: editVariantSku.trim() || editingVariant.sku,
      sellingPrice: parseFloat(editVariantPrice) || editingVariant.sellingPrice,
      variableValues: newVariableValues,
      imageUrl: editVariantImageUrl,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setEditingVariant(null);
  };

  const handleDeleteVariant = (variantId: string, variantName: string) => {
    if (product.variants.length <= 1) {
      Alert.alert('Cannot Delete', 'A product must have at least one variant.');
      return;
    }

    Alert.alert(
      'Delete Variant',
      `Are you sure you want to delete "${variantName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            deleteProductVariant(product.id, variantId);
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border.light, backgroundColor: colors.bg.primary }}>
          <Pressable onPress={() => router.back()} className="mr-4 active:opacity-50">
            <ArrowLeft size={24} color={colors.text.primary} strokeWidth={2} />
          </Pressable>
          <View className="flex-1">
            <View className="flex-row items-center">
              <Text style={{ color: colors.text.primary }} className="font-bold text-lg" numberOfLines={1}>
                {product.name}
              </Text>
              {product.isDiscontinued && (
                <View className="ml-2 px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(248, 113, 113, 0.2)' }}>
                  <Text style={{ color: '#F87171' }} className="text-[10px] font-bold">DISCONTINUED</Text>
                </View>
              )}
            </View>
            <Text style={{ color: colors.text.tertiary }} className="text-xs">{product.categories?.join(', ') || 'Uncategorized'}</Text>
          </View>
          <Pressable
            onPress={handleOpenEdit}
            className="w-10 h-10 rounded-full items-center justify-center active:opacity-70"
            style={{ backgroundColor: colors.bg.secondary }}
          >
            <Edit2 size={18} color={colors.text.primary} strokeWidth={2} />
          </Pressable>
        </View>

        <ScrollView style={{ flex: 1, backgroundColor: colors.bg.secondary }} showsVerticalScrollIndicator={false}>
          {/* Stats */}
          <View className="flex-row mx-5 mt-4 gap-3">
            <View className="flex-1 rounded-2xl p-4" style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
              <Text style={{ color: colors.text.tertiary }} className="text-xs font-medium">Total Stock</Text>
              <Text style={{ color: colors.text.primary }} className="text-2xl font-bold mt-1">{totalStock}</Text>
              {lowStockCount > 0 && (
                <View className="px-2 py-0.5 rounded-full self-start mt-1" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)' }}>
                  <Text className="text-amber-500 text-xs font-semibold">{lowStockCount} low</Text>
                </View>
              )}
            </View>
            {isOwner && (
              <View className="flex-1 rounded-2xl p-4" style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
                <Text style={{ color: colors.text.tertiary }} className="text-xs font-medium">Stock Value</Text>
                <Text style={{ color: colors.text.primary }} className="text-2xl font-bold mt-1">{formatCurrency(retailValue)}</Text>
                <Text style={{ color: colors.text.muted }} className="text-xs mt-1">at retail price</Text>
              </View>
            )}
          </View>

          {/* Description */}
          {product.description && (
            <View className="mx-5 mt-4 rounded-2xl p-4" style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
              <Text style={{ color: colors.text.tertiary }} className="text-xs font-medium mb-1">Description</Text>
              <Text style={{ color: colors.text.secondary }} className="text-sm">{product.description}</Text>
            </View>
          )}

          {/* Variants Header with Add Button */}
          <View className="mx-5 mt-4 flex-row items-center justify-between">
            <Text style={{ color: colors.text.primary }} className="font-bold text-base">Variants ({product.variants.length})</Text>
            <Pressable
              onPress={handleOpenAddVariant}
              className="flex-row items-center px-3 py-2 rounded-xl active:opacity-80"
              style={{ backgroundColor: '#111111' }}
            >
              <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
              <Text className="text-white font-semibold text-sm ml-1">Add Variant</Text>
            </Pressable>
          </View>

          {/* Variants List - Compact Modern Design */}
          <View className="mx-5 mt-3">
            {product.variants.map((variant, index) => {
              const variantName = Object.values(variant.variableValues).join(' / ');
              const isLowStock = variant.stock <= product.lowStockThreshold;
              // Use variant image if set, otherwise fallback to product image
              const displayImage = variant.imageUrl ?? product.imageUrl;

              return (
                <View
                  key={variant.id}
                  className="rounded-xl p-3 mb-2"
                  style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}
                >
                  {/* Main Row - Image, Name, Stock Badge, Actions */}
                  <View className="flex-row items-center">
                    {/* Image thumbnail */}
                    {displayImage && (
                      <View className="rounded-lg overflow-hidden mr-3" style={{ borderWidth: 1, borderColor: colors.border.light }}>
                        <Image
                          source={{ uri: displayImage }}
                          style={{ width: 40, height: 40 }}
                          resizeMode="cover"
                        />
                        {variant.imageUrl && (
                          <View className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white" />
                        )}
                      </View>
                    )}
                    <View className="flex-1">
                      <Text style={{ color: colors.text.primary }} className="font-semibold text-sm">{variantName}</Text>
                      <Text style={{ color: colors.text.muted }} className="text-xs">SKU: {variant.sku}</Text>
                    </View>
                    {/* Stock Badge */}
                    <View
                      className="px-2 py-1 rounded-full mr-2"
                      style={{
                        backgroundColor: isLowStock
                          ? variant.stock === 0
                            ? 'rgba(239, 68, 68, 0.15)'
                            : 'rgba(245, 158, 11, 0.15)'
                          : 'rgba(16, 185, 129, 0.15)'
                      }}
                    >
                      <Text
                        className="text-xs font-semibold"
                        style={{
                          color: isLowStock
                            ? variant.stock === 0
                              ? '#EF4444'
                              : '#F59E0B'
                            : '#10B981'
                        }}
                      >
                        {variant.stock}
                      </Text>
                    </View>
                    {/* Action buttons */}
                    {isOwner && (
                      <View className="flex-row items-center">
                        <Pressable
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            router.push({
                              pathname: '/label-print',
                              params: { productId: product.id, variantId: variant.id },
                            });
                          }}
                          className="p-1.5 active:opacity-50"
                        >
                          <Printer size={14} color={colors.text.tertiary} strokeWidth={2} />
                        </Pressable>
                        <Pressable
                          onPress={() => handleOpenEditVariant(variant)}
                          className="p-1.5 active:opacity-50"
                        >
                          <Edit2 size={14} color={colors.text.tertiary} strokeWidth={2} />
                        </Pressable>
                        <Pressable
                          onPress={() => handleDeleteVariant(variant.id, variantName)}
                          className="p-1.5 active:opacity-50"
                        >
                          <Trash2 size={14} color="#EF4444" strokeWidth={2} />
                        </Pressable>
                      </View>
                    )}
                  </View>

                  {/* Bottom Row - Price, Restock, Stock Adjustment */}
                  <View className="flex-row items-center justify-between mt-2 pt-2" style={{ borderTopWidth: 1, borderTopColor: colors.border.light }}>
                    {/* Price */}
                    {isOwner && (
                      <Text style={{ color: colors.text.primary }} className="font-bold text-sm">{formatCurrency(variant.sellingPrice)}</Text>
                    )}

                    {/* Actions Row */}
                    <View className="flex-row items-center gap-2">
                      {/* Restock Button - Compact */}
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          router.push({
                            pathname: '/restock',
                            params: { productId: product.id, variantId: variant.id },
                          });
                        }}
                        className="flex-row items-center px-3 py-1.5 rounded-lg active:opacity-80"
                        style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)' }}
                      >
                        <PackagePlus size={14} color="#10B981" strokeWidth={2} />
                        <Text className="text-emerald-500 font-medium text-xs ml-1">Restock</Text>
                      </Pressable>

                      {/* Stock Adjustment */}
                      <View className="flex-row items-center rounded-lg" style={{ backgroundColor: colors.border.light }}>
                        <Pressable
                          onPress={() => handleAdjustStock(variant.id, -1)}
                          disabled={variant.stock === 0}
                          className="p-2 active:opacity-50"
                        >
                          <Minus
                            size={14}
                            color={variant.stock === 0 ? colors.text.muted : colors.text.primary}
                            strokeWidth={2}
                          />
                        </Pressable>
                        <View className="w-8 items-center">
                          <Text style={{ color: colors.text.primary }} className="font-bold text-sm">{variant.stock}</Text>
                        </View>
                        <Pressable
                          onPress={() => handleAdjustStock(variant.id, 1)}
                          className="p-2 active:opacity-50"
                        >
                          <Plus size={14} color={colors.text.primary} strokeWidth={2} />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Recent Restocks */}
          {recentRestocks.length > 0 && (
            <View className="mx-5 mt-4">
              <Text style={{ color: colors.text.primary }} className="font-bold text-base mb-3">Recent Restocks</Text>
              <View className="rounded-2xl overflow-hidden" style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
                {recentRestocks.map((log, index) => {
                  const variant = product.variants.find((v) => v.id === log.variantId);
                  const variantName = variant ? Object.values(variant.variableValues).join(' / ') : 'Unknown';
                  const date = new Date(log.timestamp);
                  const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  const formattedTime = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

                  return (
                    <View
                      key={log.id}
                      className="flex-row items-center p-4"
                      style={{ borderBottomWidth: index < recentRestocks.length - 1 ? 1 : 0, borderBottomColor: colors.border.light }}
                    >
                      <View
                        className="w-10 h-10 rounded-full items-center justify-center mr-3"
                        style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)' }}
                      >
                        <PackagePlus size={18} color="#10B981" strokeWidth={2} />
                      </View>
                      <View className="flex-1">
                        <Text style={{ color: colors.text.primary }} className="font-medium text-sm">
                          +{log.quantityAdded} units
                        </Text>
                        <Text style={{ color: colors.text.tertiary }} className="text-xs">
                          {variantName} · {log.previousStock} → {log.newStock}
                        </Text>
                      </View>
                      <View className="items-end">
                        <View className="flex-row items-center">
                          <Clock size={12} color={colors.text.muted} strokeWidth={2} />
                          <Text style={{ color: colors.text.muted }} className="text-xs ml-1">{formattedDate}</Text>
                        </View>
                        <Text style={{ color: colors.text.muted }} className="text-xs">{formattedTime}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Save Product */}
          <View className="mx-5 mt-4">
            <Button onPress={handleSaveProduct} loading={isSavingProduct} loadingText="Saving...">
              Save Product
            </Button>
            {saveNotice ? (
              <Text style={{ color: colors.text.tertiary }} className="text-xs mt-2 text-center">
                {saveNotice}
              </Text>
            ) : null}
          </View>

          {/* Delete */}
          <View className="mx-5 mt-4 mb-8">
            <Pressable
              onPress={handleDelete}
              className="rounded-2xl p-4 flex-row items-center justify-center active:opacity-70"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)' }}
            >
              <Trash2 size={18} color="#EF4444" strokeWidth={2} />
              <Text className="text-red-500 font-semibold ml-2">Delete Product</Text>
            </Pressable>
          </View>
        </ScrollView>

        {/* Edit Product Modal - Centered */}
        <Modal
          visible={isEditing}
          animationType="fade"
          transparent
          onRequestClose={() => setIsEditing(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1"
          >
            <View
              className="flex-1 items-center justify-center"
              style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
            >
              <Pressable
                className="absolute inset-0"
                onPress={() => setIsEditing(false)}
              />
              <View
                className="w-[90%] rounded-2xl overflow-hidden"
                style={{ backgroundColor: '#111111', maxHeight: '85%', maxWidth: 400 }}
              >
                {/* Header */}
                <View className="flex-row items-center justify-between px-5 py-4 border-b" style={{ borderBottomColor: '#333333' }}>
                  <Text className="text-white font-bold text-lg">Edit Product</Text>
                  <Pressable
                    onPress={() => setIsEditing(false)}
                    className="w-8 h-8 rounded-full items-center justify-center active:opacity-50"
                    style={{ backgroundColor: '#222222' }}
                  >
                    <X size={18} color="#888888" strokeWidth={2} />
                  </Pressable>
                </View>

                <ScrollView
                  className="px-5 py-4"
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  bounces={true}
                  overScrollMode="always"
                >
                  {/* Error Toast */}
                  {imagePicker.error && (
                    <View className="mb-4 p-3 rounded-xl" style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)' }}>
                      <Text className="text-red-400 text-sm text-center">{imagePicker.error}</Text>
                    </View>
                  )}

                  {/* Product Image */}
                  <View className="mb-4">
                    <Text className="text-white text-sm font-medium mb-2">Product Image</Text>
                    {editImageUrl ? (
                      <View className="flex-row items-start">
                        <View className="rounded-xl overflow-hidden" style={{ borderWidth: 1, borderColor: '#444444' }}>
                          <Image
                            source={{ uri: editImageUrl }}
                            style={{ width: 72, height: 72 }}
                            resizeMode="cover"
                          />
                        </View>
                        <View className="ml-3 flex-1">
                          <Pressable
                            onPress={handlePickImage}
                            disabled={imagePicker.isLoading}
                            className="flex-row items-center px-3 py-2 rounded-lg mb-2 active:opacity-70"
                            style={{ backgroundColor: '#222222', opacity: imagePicker.isLoading ? 0.5 : 1 }}
                          >
                            <Camera size={14} color="#FFFFFF" strokeWidth={2} />
                            <Text className="text-white text-xs font-medium ml-2">Change</Text>
                          </Pressable>
                          <Pressable
                            onPress={handleRemoveImage}
                            className="flex-row items-center px-3 py-2 rounded-lg active:opacity-70"
                            style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)' }}
                          >
                            <Trash2 size={14} color="#EF4444" strokeWidth={2} />
                            <Text className="text-red-400 text-xs font-medium ml-2">Remove</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <Pressable
                        onPress={handlePickImage}
                        disabled={imagePicker.isLoading}
                        className="rounded-xl p-4 items-center active:opacity-70"
                        style={{ backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333333', borderStyle: 'dashed', opacity: imagePicker.isLoading ? 0.5 : 1 }}
                      >
                        {imagePicker.isLoading ? (
                          <>
                            <View className="w-6 h-6 items-center justify-center">
                              <Text className="text-gray-400 text-xs">...</Text>
                            </View>
                            <Text className="text-gray-400 text-sm font-medium mt-2">Opening...</Text>
                          </>
                        ) : (
                          <>
                            <ImageIcon size={24} color="#666666" strokeWidth={1.5} />
                            <Text className="text-gray-400 text-sm font-medium mt-2">Add Image</Text>
                          </>
                        )}
                      </Pressable>
                    )}
                  </View>

                  {/* Product Name */}
                  <View className="mb-4">
                    <Text className="text-white text-sm font-medium mb-2">Product Name</Text>
                    <View className="rounded-xl px-4" style={{ backgroundColor: '#000000', borderWidth: 1, borderColor: '#444444', height: 52, justifyContent: 'center' }}>
                      <TextInput
                        placeholder="Product Name"
                        placeholderTextColor="#888888"
                        value={editName}
                        onChangeText={setEditName}
                        style={{ color: '#FFFFFF', fontSize: 14 }}
                        selectionColor="#FFFFFF"
                      />
                    </View>
                  </View>

                  {/* Description */}
                  <View className="mb-4">
                    <Text className="text-white text-sm font-medium mb-2">Description</Text>
                    <View className="rounded-xl px-4 py-3" style={{ backgroundColor: '#000000', borderWidth: 1, borderColor: '#444444', minHeight: 80 }}>
                      <TextInput
                        placeholder="Description"
                        placeholderTextColor="#888888"
                        value={editDescription}
                        onChangeText={setEditDescription}
                        multiline
                        numberOfLines={3}
                        style={{ color: '#FFFFFF', fontSize: 14, textAlignVertical: 'top' }}
                        selectionColor="#FFFFFF"
                      />
                    </View>
                  </View>

                  {/* Categories */}
                  <View className="mb-4">
                    <Text className="text-white text-sm font-medium mb-2">Categories</Text>
                    {/* Selected Categories Chips */}
                    {editCategories.length > 0 && (
                      <View className="flex-row flex-wrap gap-2 mb-3">
                        {editCategories.map((cat) => (
                          <View key={cat} className="flex-row items-center px-3 py-1.5 rounded-full" style={{ backgroundColor: '#222222' }}>
                            <Text className="text-white text-sm mr-2">{cat}</Text>
                            <Pressable onPress={() => handleRemoveCategory(cat)}>
                              <X size={14} color="#888888" strokeWidth={2} />
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    )}
                    {/* Category Search/Add Input */}
                    <View className="flex-row gap-2">
                      <View className="flex-1">
                        <Pressable
                          onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
                          className="rounded-xl px-4 flex-row items-center"
                          style={{ backgroundColor: '#000000', borderWidth: 1, borderColor: '#444444', height: 52 }}
                        >
                          <TextInput
                            placeholder="Search or add category"
                            placeholderTextColor="#888888"
                            value={newCategory}
                            onChangeText={(text) => {
                              setNewCategory(text);
                              setShowCategoryDropdown(true);
                            }}
                            onFocus={() => setShowCategoryDropdown(true)}
                            onSubmitEditing={handleAddCategory}
                            style={{ color: '#FFFFFF', fontSize: 14, flex: 1 }}
                            selectionColor="#FFFFFF"
                          />
                          <ChevronDown size={18} color="#888888" strokeWidth={2} />
                        </Pressable>
                        {/* Dropdown with existing categories */}
                        {showCategoryDropdown && (
                          <View className="rounded-xl mt-2 overflow-hidden" style={{ backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333333', maxHeight: 200 }}>
                            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                              {/* Filter categories based on search and show unselected ones */}
                              {globalCategories
                                .filter(cat =>
                                  !editCategories.includes(cat) &&
                                  cat.toLowerCase().includes(newCategory.toLowerCase())
                                )
                                .map((cat) => (
                                  <Pressable
                                    key={cat}
                                    onPress={() => handleSelectCategory(cat)}
                                    className="px-4 py-3 border-b active:opacity-70"
                                    style={{ borderBottomColor: '#333333' }}
                                  >
                                    <Text className="text-gray-300 text-sm">{cat}</Text>
                                  </Pressable>
                                ))}
                              {/* Option to add new category if not exists */}
                              {newCategory.trim() && !globalCategories.includes(newCategory.trim()) && (
                                <Pressable
                                  onPress={handleAddCategory}
                                  className="px-4 py-3 flex-row items-center active:opacity-70"
                                  style={{ backgroundColor: '#222222' }}
                                >
                                  <Plus size={16} color="#10B981" strokeWidth={2} />
                                  <Text className="text-green-400 text-sm ml-2">Add "{newCategory.trim()}"</Text>
                                </Pressable>
                              )}
                              {globalCategories.filter(cat => !editCategories.includes(cat) && cat.toLowerCase().includes(newCategory.toLowerCase())).length === 0 && !newCategory.trim() && (
                                <View className="px-4 py-3">
                                  <Text className="text-gray-500 text-sm">No categories available. Type to add new.</Text>
                                </View>
                              )}
                            </ScrollView>
                          </View>
                        )}
                      </View>
                      <Pressable
                        onPress={handleAddCategory}
                        disabled={!newCategory.trim()}
                        className="rounded-xl items-center justify-center active:opacity-80"
                        style={{ backgroundColor: newCategory.trim() ? '#222222' : '#1A1A1A', width: 52, height: 52 }}
                      >
                        <Plus size={20} color={newCategory.trim() ? '#FFFFFF' : '#444444'} strokeWidth={2} />
                      </Pressable>
                    </View>
                  </View>

                  {/* Low Stock Threshold */}
                  <View className="mb-4">
                    <Text className="text-white text-sm font-medium mb-2">Low Stock Alert Threshold</Text>
                    <View className="rounded-xl px-4" style={{ backgroundColor: '#000000', borderWidth: 1, borderColor: '#444444', height: 52, justifyContent: 'center' }}>
                      <TextInput
                        placeholder="5"
                        placeholderTextColor="#888888"
                        value={editThreshold}
                        onChangeText={setEditThreshold}
                        keyboardType="number-pad"
                        style={{ color: '#FFFFFF', fontSize: 14 }}
                        selectionColor="#FFFFFF"
                      />
                    </View>
                  </View>

                  {/* New Design Toggle */}
                  <View className="mb-4 rounded-xl p-4" style={{ backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333333' }}>
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 mr-3">
                        <Text className="text-white text-base font-bold">Mark as New Design</Text>
                        <Text className="text-gray-500 text-xs">Track this for yearly reviews</Text>
                      </View>
                      <Switch
                        value={editIsNewDesign}
                        onValueChange={setEditIsNewDesign}
                        trackColor={{ false: '#555555', true: '#FFFFFF' }}
                        thumbColor={editIsNewDesign ? '#111111' : '#FFFFFF'}
                      />
                    </View>
                    {editIsNewDesign && (
                      <View className="mt-3">
                        <Text className="text-gray-400 text-xs font-medium mb-2">Design Year</Text>
                        <View className="rounded-xl px-4" style={{ backgroundColor: '#000000', borderWidth: 1, borderColor: '#444444', height: 48, justifyContent: 'center' }}>
                          <TextInput
                            placeholder={new Date().getFullYear().toString()}
                            placeholderTextColor="#888888"
                            value={editDesignYear}
                            onChangeText={setEditDesignYear}
                            keyboardType="number-pad"
                            maxLength={4}
                            style={{ color: '#FFFFFF', fontSize: 14 }}
                            selectionColor="#FFFFFF"
                          />
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Mark as Discontinued Toggle */}
                  <View className="mb-4 rounded-xl p-4" style={{ backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: editIsDiscontinued ? '#F87171' : '#333333' }}>
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 mr-3">
                        <Text className="text-white text-sm font-medium">Mark as Discontinued</Text>
                        <Text className="text-gray-500 text-xs">Hide from new order product picker</Text>
                      </View>
                      <Switch
                        value={editIsDiscontinued}
                        onValueChange={setEditIsDiscontinued}
                        trackColor={{ false: '#333333', true: '#F87171' }}
                        thumbColor={editIsDiscontinued ? '#FFFFFF' : '#888888'}
                      />
                    </View>
                    {editIsDiscontinued && (
                      <View className="mt-3 p-3 rounded-lg" style={{ backgroundColor: 'rgba(248, 113, 113, 0.15)' }}>
                        <Text className="text-red-400 text-xs">
                          This product won't appear in the product picker when creating new orders. Existing orders are not affected.
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Global Pricing Section */}
                  <View className="mb-4 rounded-xl p-4" style={{ backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333333' }}>
                    <View className="flex-row items-center justify-between mb-3">
                      <View className="flex-1">
                        <Text className="text-white text-sm font-medium">Global Pricing</Text>
                        <Text className="text-gray-500 text-xs">Update all variant prices at once</Text>
                      </View>
                      <Switch
                        value={useGlobalPrice}
                        onValueChange={setUseGlobalPrice}
                        trackColor={{ false: '#333333', true: '#FFFFFF' }}
                        thumbColor={useGlobalPrice ? '#111111' : '#666666'}
                      />
                    </View>
                    {useGlobalPrice && (
                      <View className="rounded-xl px-4 flex-row items-center" style={{ backgroundColor: '#000000', borderWidth: 1, borderColor: '#444444', height: 52 }}>
                        <Text style={{ color: '#888888', fontSize: 14, marginRight: 4 }}>₦</Text>
                        <TextInput
                          placeholder="Enter price for all variants"
                          placeholderTextColor="#888888"
                          value={globalPrice}
                          onChangeText={setGlobalPrice}
                          keyboardType="numeric"
                          style={{ color: '#FFFFFF', fontSize: 14, flex: 1 }}
                          selectionColor="#FFFFFF"
                        />
                      </View>
                    )}
                    {!useGlobalPrice && (
                      <Text className="text-gray-500 text-xs italic">Edit individual variant prices from the variant list</Text>
                    )}
                  </View>

                  {/* Save Button */}
                  <Pressable
                    onPress={handleSaveEdit}
                    className="rounded-xl items-center active:opacity-80 bg-white mb-3"
                    style={{ height: 52, justifyContent: 'center' }}
                  >
                    <Text className="text-black font-semibold text-base">Save Changes</Text>
                  </Pressable>

                  {/* Cancel Button */}
                  <Pressable
                    onPress={() => setIsEditing(false)}
                    className="rounded-xl items-center active:opacity-80 mb-4"
                    style={{ height: 52, justifyContent: 'center', backgroundColor: '#222222' }}
                  >
                    <Text className="text-gray-400 font-semibold text-base">Cancel</Text>
                  </Pressable>
                </ScrollView>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Add Variant Modal - Centered - Dynamic theme */}
        <Modal
          visible={showAddVariant}
          animationType="fade"
          transparent
          onRequestClose={() => setShowAddVariant(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1"
          >
            <View
              className="flex-1 items-center justify-center"
              style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
            >
              <Pressable
                className="absolute inset-0"
                onPress={() => setShowAddVariant(false)}
              />
              <View
                className="w-[90%] rounded-2xl overflow-hidden"
                style={{ backgroundColor: themeColors.bg.card, maxHeight: '85%', maxWidth: 400 }}
              >
                {/* Header */}
                <View className="flex-row items-center justify-between px-5 py-4 border-b" style={{ borderBottomColor: themeColors.border.light }}>
                  <Text style={{ color: themeColors.text.primary }} className="font-bold text-lg">Add New Variant</Text>
                  <Pressable
                    onPress={() => setShowAddVariant(false)}
                    className="w-8 h-8 rounded-full items-center justify-center active:opacity-50"
                    style={{ backgroundColor: themeColors.bg.secondary }}
                  >
                    <X size={18} color={themeColors.text.muted} strokeWidth={2} />
                  </Pressable>
                </View>

                <ScrollView
                  className="px-5 py-4"
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  bounces={true}
                  overScrollMode="always"
                >
                  {/* Variable Type Selector */}
                  <View className="mb-4">
                    <Text style={{ color: themeColors.text.primary }} className="text-sm font-medium mb-2">Variable Type</Text>
                    <Pressable
                      onPress={() => setShowVariableTypeDropdown(!showVariableTypeDropdown)}
                      className="rounded-xl px-4 flex-row items-center justify-between"
                      style={{ backgroundColor: themeColors.input.bg, borderWidth: 1, borderColor: themeColors.input.border, height: 52 }}
                    >
                      <Text style={{ color: selectedVariableId ? themeColors.text.primary : themeColors.text.muted }}>
                        {productVariables.find(v => v.id === selectedVariableId)?.name || 'Select Variable Type'}
                      </Text>
                      <ChevronDown size={18} color={themeColors.text.muted} strokeWidth={2} />
                    </Pressable>
                    {showVariableTypeDropdown && (
                      <View className="rounded-xl mt-2 overflow-hidden" style={{ backgroundColor: themeColors.bg.secondary, borderWidth: 1, borderColor: themeColors.border.light }}>
                        {productVariables.map((variable) => (
                          <Pressable
                            key={variable.id}
                            onPress={() => {
                              setSelectedVariableId(variable.id);
                              setShowVariableTypeDropdown(false);
                            }}
                            className="px-4 py-3 border-b active:opacity-70"
                            style={{ borderBottomColor: themeColors.border.light }}
                          >
                            <Text style={{ color: selectedVariableId === variable.id ? themeColors.text.primary : themeColors.text.tertiary }} className={cn(
                              'text-sm',
                              selectedVariableId === variable.id && 'font-semibold'
                            )}>
                              {variable.name}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                    {productVariables.length === 0 && (
                      <Text className="text-orange-400 text-xs mt-2">No variable types defined. Go to Settings to add them.</Text>
                    )}
                  </View>

                  {/* Variant Value - Editable Text Input */}
                  <View className="mb-4">
                    <Text style={{ color: themeColors.text.primary }} className="text-sm font-medium mb-2">Value</Text>
                    <View className="rounded-xl px-4" style={{ backgroundColor: themeColors.input.bg, borderWidth: 1, borderColor: themeColors.input.border, height: 52, justifyContent: 'center' }}>
                      <TextInput
                        placeholder={selectedVariableId ? `Enter ${productVariables.find(v => v.id === selectedVariableId)?.name || 'value'} (e.g., Pink, Large)` : 'Select a variable type first'}
                        placeholderTextColor={themeColors.input.placeholder}
                        value={newVariantValue}
                        onChangeText={setNewVariantValue}
                        editable={!!selectedVariableId}
                        style={{ color: themeColors.input.text, fontSize: 14 }}
                        selectionColor={themeColors.text.primary}
                      />
                    </View>
                  </View>

                  {/* SKU - Auto-generated but editable */}
                  <View className="mb-4">
                    <Text style={{ color: themeColors.text.primary }} className="text-sm font-medium mb-2">SKU</Text>
                    <View className="rounded-xl px-4" style={{ backgroundColor: themeColors.input.bg, borderWidth: 1, borderColor: themeColors.input.border, height: 52, justifyContent: 'center' }}>
                      <TextInput
                        placeholder={getAutoSku() || 'Auto-generated from Product-Value'}
                        placeholderTextColor={themeColors.text.muted}
                        value={newVariantSku}
                        onChangeText={setNewVariantSku}
                        autoCapitalize="characters"
                        style={{ color: themeColors.input.text, fontSize: 14 }}
                        selectionColor={themeColors.text.primary}
                      />
                    </View>
                    <Text style={{ color: themeColors.text.muted }} className="text-xs mt-1">
                      {newVariantSku ? 'Custom SKU' : `Will be: ${getAutoSku() || '[PRODUCT]-[VALUE]'}`}
                    </Text>
                  </View>

                  {/* Initial Stock */}
                  <View className="mb-4">
                    <Text style={{ color: themeColors.text.primary }} className="text-sm font-medium mb-2">Initial Stock</Text>
                    <View className="rounded-xl px-4" style={{ backgroundColor: themeColors.input.bg, borderWidth: 1, borderColor: themeColors.input.border, height: 52, justifyContent: 'center' }}>
                      <TextInput
                        placeholder="0"
                        placeholderTextColor={themeColors.input.placeholder}
                        value={newVariantStock}
                        onChangeText={setNewVariantStock}
                        keyboardType="number-pad"
                        style={{ color: themeColors.input.text, fontSize: 14 }}
                        selectionColor={themeColors.text.primary}
                      />
                    </View>
                  </View>

                  {/* Sale Price */}
                  <View className="mb-4">
                    <Text style={{ color: themeColors.text.primary }} className="text-sm font-medium mb-2">Sale Price</Text>
                    <View className="rounded-xl px-4 flex-row items-center" style={{ backgroundColor: themeColors.input.bg, borderWidth: 1, borderColor: themeColors.input.border, height: 52 }}>
                      <Text style={{ color: themeColors.text.muted, fontSize: 14, marginRight: 4 }}>₦</Text>
                      <TextInput
                        placeholder="0"
                        placeholderTextColor={themeColors.input.placeholder}
                        value={newVariantPrice}
                        onChangeText={setNewVariantPrice}
                        keyboardType="numeric"
                        style={{ color: themeColors.input.text, fontSize: 14, flex: 1 }}
                        selectionColor={themeColors.text.primary}
                      />
                    </View>
                  </View>

                  {/* Add Button */}
                  <Pressable
                    onPress={handleAddVariant}
                    className="rounded-xl items-center active:opacity-80 mb-4"
                    style={{ height: 52, justifyContent: 'center', backgroundColor: isDark ? '#FFFFFF' : '#111111' }}
                  >
                    <Text style={{ color: isDark ? '#000000' : '#FFFFFF' }} className="font-semibold text-base">Add Variant</Text>
                  </Pressable>
                </ScrollView>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Edit Variant Modal - Centered - Dynamic Theme */}
        <Modal
          visible={!!editingVariant}
          animationType="fade"
          transparent
          onRequestClose={() => setEditingVariant(null)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1"
          >
            <View
              className="flex-1 items-center justify-center"
              style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
            >
              <Pressable
                className="absolute inset-0"
                onPress={() => setEditingVariant(null)}
              />
              <View
                className="w-[90%] rounded-2xl overflow-hidden"
                style={{ backgroundColor: themeColors.bg.card, maxHeight: '85%', maxWidth: 400 }}
              >
                {/* Header */}
                <View className="flex-row items-center justify-between px-5 py-4 border-b" style={{ borderBottomColor: themeColors.border.light }}>
                  <Text style={{ color: themeColors.text.primary }} className="font-bold text-lg">Edit Variant</Text>
                  <Pressable
                    onPress={() => setEditingVariant(null)}
                    className="w-8 h-8 rounded-full items-center justify-center active:opacity-50"
                    style={{ backgroundColor: themeColors.bg.secondary }}
                  >
                    <X size={18} color={themeColors.text.muted} strokeWidth={2} />
                  </Pressable>
                </View>

                <ScrollView
                  className="px-5 py-4"
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  bounces={true}
                  overScrollMode="always"
                >
                  {/* Error Toast for image picker */}
                  {imagePicker.error && (
                    <View className="mb-4 p-3 rounded-xl" style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)' }}>
                      <Text className="text-red-400 text-sm text-center">{imagePicker.error}</Text>
                    </View>
                  )}

                  {/* Variant Image */}
                  <View className="mb-4">
                    <Text style={{ color: themeColors.text.primary }} className="text-sm font-medium mb-2">Variant Image</Text>
                    <Text style={{ color: themeColors.text.muted }} className="text-xs mb-3">
                      Optional. If not set, will use the main product image.
                    </Text>
                    {editVariantImageUrl ? (
                      <View className="flex-row items-start">
                        <View className="rounded-xl overflow-hidden" style={{ borderWidth: 1, borderColor: themeColors.border.light }}>
                          <Image
                            source={{ uri: editVariantImageUrl }}
                            style={{ width: 72, height: 72 }}
                            resizeMode="cover"
                          />
                        </View>
                        <View className="ml-3 flex-1">
                          <Pressable
                            onPress={async () => {
                              try {
                                const uri = await imagePicker.pickImage();
                                if (uri) {
                                  setEditVariantImageUrl(uri);
                                }
                              } catch (err) {
                                console.error('Variant image pick error:', err);
                              }
                            }}
                            disabled={imagePicker.isLoading}
                            className="flex-row items-center px-3 py-2 rounded-lg mb-2 active:opacity-70"
                            style={{ backgroundColor: themeColors.bg.secondary, opacity: imagePicker.isLoading ? 0.5 : 1 }}
                          >
                            <Camera size={14} color={themeColors.text.primary} strokeWidth={2} />
                            <Text style={{ color: themeColors.text.primary }} className="text-xs font-medium ml-2">Change</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => setEditVariantImageUrl(undefined)}
                            className="flex-row items-center px-3 py-2 rounded-lg active:opacity-70"
                            style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)' }}
                          >
                            <Trash2 size={14} color="#EF4444" strokeWidth={2} />
                            <Text className="text-red-400 text-xs font-medium ml-2">Remove</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <Pressable
                        onPress={async () => {
                          try {
                            const uri = await imagePicker.pickImage();
                            if (uri) {
                              setEditVariantImageUrl(uri);
                            }
                          } catch (err) {
                            console.error('Variant image pick error:', err);
                          }
                        }}
                        disabled={imagePicker.isLoading}
                        className="rounded-xl p-4 items-center active:opacity-70"
                        style={{ backgroundColor: themeColors.bg.secondary, borderWidth: 1, borderColor: themeColors.border.light, borderStyle: 'dashed', opacity: imagePicker.isLoading ? 0.5 : 1 }}
                      >
                        {imagePicker.isLoading ? (
                          <>
                            <View className="w-6 h-6 items-center justify-center">
                              <Text style={{ color: themeColors.text.muted }} className="text-xs">...</Text>
                            </View>
                            <Text style={{ color: themeColors.text.muted }} className="text-sm font-medium mt-2">Opening...</Text>
                          </>
                        ) : (
                          <>
                            <ImageIcon size={24} color={themeColors.text.muted} strokeWidth={1.5} />
                            <Text style={{ color: themeColors.text.muted }} className="text-sm font-medium mt-2">Add Variant Image</Text>
                            <Text style={{ color: themeColors.text.tertiary }} className="text-xs mt-1">Uses product image if empty</Text>
                          </>
                        )}
                      </Pressable>
                    )}
                  </View>

                  {/* Variant Name/Value - Editable */}
                  <View className="mb-4">
                    <Text style={{ color: themeColors.text.primary }} className="text-sm font-medium mb-2">Variant Name/Value</Text>
                    <View className="rounded-xl px-4" style={{ backgroundColor: themeColors.input.bg, borderWidth: 1, borderColor: themeColors.input.border, height: 52, justifyContent: 'center' }}>
                      <TextInput
                        placeholder="e.g., Pink, Soft Pink"
                        placeholderTextColor={themeColors.input.placeholder}
                        value={editVariantName}
                        onChangeText={setEditVariantName}
                        style={{ color: themeColors.input.text, fontSize: 14 }}
                        selectionColor={themeColors.text.primary}
                      />
                    </View>
                    <Text style={{ color: themeColors.text.muted }} className="text-xs mt-1">Change the variant name (e.g., "Pink" to "Soft Pink")</Text>
                  </View>

                  {/* SKU */}
                  <View className="mb-4">
                    <Text style={{ color: themeColors.text.primary }} className="text-sm font-medium mb-2">SKU</Text>
                    <View className="rounded-xl px-4" style={{ backgroundColor: themeColors.input.bg, borderWidth: 1, borderColor: themeColors.input.border, height: 52, justifyContent: 'center' }}>
                      <TextInput
                        placeholder="SKU"
                        placeholderTextColor={themeColors.input.placeholder}
                        value={editVariantSku}
                        onChangeText={setEditVariantSku}
                        style={{ color: themeColors.input.text, fontSize: 14 }}
                        selectionColor={themeColors.text.primary}
                      />
                    </View>
                  </View>

                  {/* Sale Price */}
                  <View className="mb-4">
                    <Text style={{ color: themeColors.text.primary }} className="text-sm font-medium mb-2">Sale Price</Text>
                    <View className="rounded-xl px-4 flex-row items-center" style={{ backgroundColor: themeColors.input.bg, borderWidth: 1, borderColor: themeColors.input.border, height: 52 }}>
                      <Text style={{ color: themeColors.text.muted, fontSize: 14, marginRight: 4 }}>₦</Text>
                      <TextInput
                        placeholder="0"
                        placeholderTextColor={themeColors.input.placeholder}
                        value={editVariantPrice}
                        onChangeText={setEditVariantPrice}
                        keyboardType="numeric"
                        style={{ color: themeColors.input.text, fontSize: 14, flex: 1 }}
                        selectionColor={themeColors.text.primary}
                      />
                    </View>
                  </View>

                  {/* Save Button */}
                  <Pressable
                    onPress={handleSaveVariant}
                    className="rounded-xl items-center active:opacity-80 mb-4"
                    style={{ height: 52, justifyContent: 'center', backgroundColor: isDark ? '#FFFFFF' : '#111111' }}
                  >
                    <Text style={{ color: isDark ? '#000000' : '#FFFFFF' }} className="font-semibold text-base">Save Changes</Text>
                  </Pressable>
                </ScrollView>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Image Picker Modal - Simplified for web compatibility */}
        <Modal
          visible={showImagePicker}
          animationType="fade"
          transparent
          onRequestClose={() => setShowImagePicker(false)}
        >
          <Pressable
            className="flex-1 items-center justify-end"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onPress={() => setShowImagePicker(false)}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              className="w-full rounded-t-3xl overflow-hidden"
              style={{ backgroundColor: '#111111' }}
            >
              <View className="p-5">
                <View className="w-10 h-1 rounded-full self-center mb-4" style={{ backgroundColor: '#333333' }} />
                <Text className="text-white text-lg font-bold mb-4">Change Product Image</Text>

                <Pressable
                  onPress={handlePickImage}
                  className="flex-row items-center p-4 rounded-xl mb-3 active:opacity-70"
                  style={{ backgroundColor: '#1A1A1A' }}
                >
                  <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: '#FFFFFF' }}>
                    <ImageIcon size={20} color="#111111" strokeWidth={2} />
                  </View>
                  <View>
                    <Text className="text-white font-semibold">Choose Image</Text>
                    <Text className="text-gray-500 text-xs">Select from your device</Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => setShowImagePicker(false)}
                  className="p-4 rounded-xl items-center active:opacity-70"
                  style={{ backgroundColor: '#1A1A1A' }}
                >
                  <Text className="text-gray-400 font-semibold">Cancel</Text>
                </Pressable>
              </View>
              <View className="h-8" />
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </View>
  );
}
