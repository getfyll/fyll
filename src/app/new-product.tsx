import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Platform, Switch, Modal, KeyboardAvoidingView, Keyboard, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, X, Plus, Trash2, Package, Hash, Check, ChevronDown, Search, Camera, ImageIcon } from 'lucide-react-native';
import useFyllStore, { ProductVariant, generateProductId, generateVariantBarcode, formatCurrency } from '@/lib/state/fyll-store';
import useAuthStore from '@/lib/state/auth-store';
import { cn } from '@/lib/cn';
import * as Haptics from 'expo-haptics';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useImagePicker } from '@/hooks/useImagePicker';
import { Button, StickyButtonContainer } from '@/components/Button';

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

interface VariantFormData {
  id: string;
  variableValues: Record<string, string>;
  stock: string;
  sellingPrice: string;
  imageUrl?: string;
}

export default function NewProductScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const productVariables = useFyllStore((s) => s.productVariables);
  const globalCategories = useFyllStore((s) => s.categories);
  const addCategory = useFyllStore((s) => s.addCategory);
  const updateProductVariable = useFyllStore((s) => s.updateProductVariable);
  const addProduct = useFyllStore((s) => s.addProduct);
  const currentUser = useAuthStore((s) => s.currentUser);
  const businessId = useAuthStore((s) => s.businessId);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryInput, setCategoryInput] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [addingValueToVariable, setAddingValueToVariable] = useState<string | null>(null);
  const [newValueInput, setNewValueInput] = useState('');
  const [variants, setVariants] = useState<VariantFormData[]>([]);
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);

  // New Design tracking state
  const [isNewDesign, setIsNewDesign] = useState(false);
  const [designYear, setDesignYear] = useState(new Date().getFullYear().toString());

  // Loading and success state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // Use the web-safe image picker hook
  const imagePicker = useImagePicker();

  // Track which variant is currently picking an image (for loading state)
  const [variantImageLoading, setVariantImageLoading] = useState<string | null>(null);
  const [variantImageError, setVariantImageError] = useState<string | null>(null);

  // Variant selection modal state
  const [showVariantSelector, setShowVariantSelector] = useState<{ variantIndex: number; variableId: string } | null>(null);
  const [variantSearchQuery, setVariantSearchQuery] = useState('');

  // Global pricing state
  const [useGlobalPrice, setUseGlobalPrice] = useState(true);
  const [globalPrice, setGlobalPrice] = useState('');

  // Filter categories based on search
  const filteredCategories = useMemo(() => {
    if (!categoryInput.trim()) return globalCategories.filter(cat => !categories.includes(cat));
    return globalCategories.filter(cat =>
      !categories.includes(cat) &&
      cat.toLowerCase().includes(categoryInput.toLowerCase())
    );
  }, [globalCategories, categoryInput, categories]);

  const handleAddVariant = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    const newVariant: VariantFormData = {
      id: Math.random().toString(36).substring(2, 10),
      variableValues: productVariables.reduce((acc, v) => {
        acc[v.name] = v.values[0] || '';
        return acc;
      }, {} as Record<string, string>),
      stock: '0',
      sellingPrice: '',
    };
    setVariants(prev => [...prev, newVariant]);
  }, [productVariables]);

  const handleUpdateVariant = useCallback((index: number, updates: Partial<VariantFormData>) => {
    setVariants(prev => {
      const newVariants = [...prev];
      newVariants[index] = { ...newVariants[index], ...updates };
      return newVariants;
    });
  }, []);

  const handleRemoveVariant = useCallback((index: number) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setVariants(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddValueToVariable = (variableId: string) => {
    if (!newValueInput.trim()) return;

    const variable = productVariables.find((v) => v.id === variableId);
    if (!variable) return;

    // Check for duplicates
    if (variable.values.includes(newValueInput.trim())) {
      setNewValueInput('');
      setAddingValueToVariable(null);
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    updateProductVariable(variableId, {
      values: [...variable.values, newValueInput.trim()],
    });

    setNewValueInput('');
    setAddingValueToVariable(null);
  };

  // Category handling
  const handleSelectCategory = useCallback((cat: string) => {
    setCategories(prev => {
      if (!prev.includes(cat)) {
        return [...prev, cat];
      }
      return prev;
    });
    setCategoryInput('');
    setShowCategoryDropdown(false);
  }, []);

  const handleAddNewCategory = useCallback(() => {
    const trimmedCat = categoryInput.trim();
    if (trimmedCat) {
      setCategories(prev => {
        if (!prev.includes(trimmedCat)) {
          addCategory(trimmedCat);
          return [...prev, trimmedCat];
        }
        return prev;
      });
      setCategoryInput('');
      setShowCategoryDropdown(false);
    }
  }, [categoryInput, addCategory]);

  const handleRemoveCategory = useCallback((cat: string) => {
    setCategories(prev => prev.filter(c => c !== cat));
  }, []);

  // Image picker handler using the web-safe hook
  const handlePickImage = async () => {
    setShowImagePicker(false);
    const uri = await imagePicker.pickImage();
    if (uri) {
      setProductImageUrl(uri);
    }
  };

  const handleRemoveImage = () => {
    setProductImageUrl(null);
  };

  // Variant image picker handler
  const handlePickVariantImage = async (variantId: string, variantIndex: number) => {
    setVariantImageLoading(variantId);
    setVariantImageError(null);
    try {
      const uri = await imagePicker.pickImage();
      if (uri) {
        setVariants(prev => {
          const newVariants = [...prev];
          newVariants[variantIndex] = { ...newVariants[variantIndex], imageUrl: uri };
          return newVariants;
        });
      }
    } catch (err) {
      setVariantImageError('Failed to pick image. Please try again.');
    } finally {
      setVariantImageLoading(null);
    }
  };

  const handleRemoveVariantImage = (variantIndex: number) => {
    setVariants(prev => {
      const newVariants = [...prev];
      newVariants[variantIndex] = { ...newVariants[variantIndex], imageUrl: undefined };
      return newVariants;
    });
  };

  // Variant value selection handler
  const handleSelectVariantValue = useCallback((variantIndex: number, variableName: string, value: string) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setVariants(prev => {
      const newVariants = [...prev];
      newVariants[variantIndex] = {
        ...newVariants[variantIndex],
        variableValues: { ...newVariants[variantIndex].variableValues, [variableName]: value },
      };
      return newVariants;
    });
    setShowVariantSelector(null);
    setVariantSearchQuery('');
  }, []);

  const handleSubmit = async () => {
    if (!name.trim() || variants.length === 0 || isSubmitting) return;

    // Check all variants have images
    const missingImages = variants.some(v => !v.imageUrl);
    if (missingImages) return;

    setIsSubmitting(true);

    // Simulate a small delay for better UX feedback
    await new Promise(resolve => setTimeout(resolve, 300));

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    const productId = generateProductId();
    const productVariants: ProductVariant[] = variants.map((v, index) => {
      const sku = `${name.substring(0, 3).toUpperCase()}-${Object.values(v.variableValues).join('-').substring(0, 4).toUpperCase()}`;
      // Use global price if enabled, otherwise use individual variant price
      const finalPrice = useGlobalPrice ? (parseFloat(globalPrice) || 0) : (parseFloat(v.sellingPrice) || 0);
      return {
        id: `${productId}-${index + 1}`,
        sku,
        barcode: generateVariantBarcode(),
        variableValues: v.variableValues,
        stock: parseInt(v.stock, 10) || 0,
        sellingPrice: finalPrice,
        imageUrl: v.imageUrl,
      };
    });

    await addProduct({
      id: productId,
      name: name.trim(),
      description: description.trim(),
      categories: categories,
      variants: productVariants,
      lowStockThreshold: parseInt(lowStockThreshold, 10) || 5,
      createdAt: new Date().toISOString(),
      imageUrl: productImageUrl || undefined,
      createdBy: currentUser?.name,
      // New Design fields
      isNewDesign: isNewDesign,
      designYear: isNewDesign ? parseInt(designYear, 10) || new Date().getFullYear() : undefined,
      designLaunchedAt: isNewDesign ? new Date().toISOString() : undefined,
    }, businessId);

    // Show success toast
    setShowSuccessToast(true);

    // Navigate back after brief delay to show toast
    setTimeout(() => {
      router.back();
    }, 800);
  };

  // Check if all variants have images
  const allVariantsHaveImages = variants.length > 0 && variants.every(v => !!v.imageUrl);
  const isValid = name.trim() && variants.length > 0 && allVariantsHaveImages;

  return (
    <View className="flex-1 bg-gray-50">
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header - Full Screen Style with Back Button (no Create button) */}
        <View className="flex-row items-center justify-between px-5 py-4 bg-white border-b border-gray-200">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 rounded-xl items-center justify-center active:opacity-50 bg-gray-100"
          >
            <ArrowLeft size={20} color="#111111" strokeWidth={2} />
          </Pressable>
          <Text className="text-gray-900 text-lg font-bold">New Product</Text>
          {/* Empty spacer for layout balance */}
          <View className="w-10 h-10" />
        </View>

        <KeyboardAwareScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
          extraScrollHeight={100}
          enableOnAndroid={true}
          keyboardShouldPersistTaps="handled"
        >
          {/* Product Info */}
          <View className="mt-4">
            <View className="bg-white rounded-2xl p-4 border border-gray-200">
              <View className="flex-row items-center mb-4">
                <View className="w-10 h-10 rounded-xl items-center justify-center mr-3 bg-gray-100">
                  <Package size={20} color="#111111" strokeWidth={2} />
                </View>
                <View>
                  <Text className="text-gray-900 font-bold text-base">Product Details</Text>
                  <Text className="text-gray-500 text-xs">Basic product information</Text>
                </View>
              </View>

              {/* Product Image */}
              <View className="mb-3">
                <Text className="text-gray-500 text-xs font-medium mb-1.5 uppercase tracking-wider">Product Image</Text>
                {/* Error Toast */}
                {imagePicker.error && (
                  <View className="mb-2 p-3 rounded-xl" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                    <Text className="text-red-500 text-sm text-center">{imagePicker.error}</Text>
                  </View>
                )}
                {productImageUrl ? (
                  <View className="flex-row items-start">
                    <View className="rounded-xl overflow-hidden" style={{ borderWidth: 1, borderColor: colors.border.light }}>
                      <Image
                        source={{ uri: productImageUrl }}
                        style={{ width: 80, height: 80 }}
                        resizeMode="cover"
                      />
                    </View>
                    <View className="ml-3 flex-1">
                      <Pressable
                        onPress={handlePickImage}
                        disabled={imagePicker.isLoading}
                        className="flex-row items-center px-3 py-2 rounded-lg mb-2 active:opacity-70"
                        style={{ backgroundColor: colors.bg.secondary, opacity: imagePicker.isLoading ? 0.5 : 1 }}
                      >
                        <Camera size={16} color={colors.text.primary} strokeWidth={2} />
                        <Text style={{ color: colors.text.primary }} className="text-xs font-medium ml-2">Change</Text>
                      </Pressable>
                      <Pressable
                        onPress={handleRemoveImage}
                        className="flex-row items-center px-3 py-2 rounded-lg active:opacity-70"
                        style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
                      >
                        <Trash2 size={16} color="#EF4444" strokeWidth={2} />
                        <Text className="text-red-500 text-xs font-medium ml-2">Remove</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    onPress={handlePickImage}
                    disabled={imagePicker.isLoading}
                    className="rounded-xl p-4 items-center active:opacity-70"
                    style={{ backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.light, borderStyle: 'dashed', opacity: imagePicker.isLoading ? 0.5 : 1 }}
                  >
                    {imagePicker.isLoading ? (
                      <>
                        <View className="w-12 h-12 rounded-full items-center justify-center mb-2" style={{ backgroundColor: colors.bg.card }}>
                          <Text style={{ color: colors.text.muted }} className="text-xs">...</Text>
                        </View>
                        <Text style={{ color: colors.text.secondary }} className="text-sm font-medium">Opening...</Text>
                      </>
                    ) : (
                      <>
                        <View className="w-12 h-12 rounded-full items-center justify-center mb-2" style={{ backgroundColor: colors.bg.card }}>
                          <ImageIcon size={24} color={colors.text.muted} strokeWidth={1.5} />
                        </View>
                        <Text style={{ color: colors.text.secondary }} className="text-sm font-medium">Add Product Image</Text>
                        <Text style={{ color: colors.text.muted }} className="text-xs mt-0.5">Tap to upload from your device</Text>
                      </>
                    )}
                  </Pressable>
                )}
              </View>

              {/* Product Name */}
              <View className="mb-3">
                <Text className="text-gray-500 text-xs font-medium mb-1.5 uppercase tracking-wider">Product Name *</Text>
                <View className="rounded-xl px-4 py-3 border border-gray-300 bg-white">
                  <TextInput
                    placeholder="e.g. Classic Aviator Sunglasses"
                    placeholderTextColor="#9CA3AF"
                    value={name}
                    onChangeText={setName}
                    className="text-gray-900 text-sm"
                    selectionColor="#111111"
                  />
                </View>
              </View>

              {/* Categories - Right after Product Name */}
              <View className="mb-3" style={{ zIndex: 20 }}>
                <Text className="text-gray-500 text-xs font-medium mb-1.5 uppercase tracking-wider">Categories</Text>
                {/* Selected Categories - Black Chips with White Text */}
                {categories.length > 0 && (
                  <View className="flex-row flex-wrap mb-2" style={{ gap: 8 }}>
                    {categories.map((cat) => (
                      <View key={cat} className="flex-row items-center px-3 py-1.5 rounded-lg" style={{ backgroundColor: '#111111' }}>
                        <Text style={{ color: '#FFFFFF' }} className="text-xs font-medium mr-1">{cat}</Text>
                        <Pressable onPress={() => handleRemoveCategory(cat)}>
                          <X size={12} color="#FFFFFF" strokeWidth={2} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
                {/* Category Dropdown */}
                <View style={{ zIndex: 10 }}>
                  <Pressable
                    onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
                    className="rounded-xl px-4 flex-row items-center"
                    style={{ height: 52, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.input.border }}
                  >
                    <TextInput
                      placeholder="Search or add category"
                      placeholderTextColor={colors.text.muted}
                      value={categoryInput}
                      onChangeText={(text) => {
                        setCategoryInput(text);
                        setShowCategoryDropdown(true);
                      }}
                      onFocus={() => setShowCategoryDropdown(true)}
                      onSubmitEditing={handleAddNewCategory}
                      style={{ color: colors.text.primary, fontSize: 14, flex: 1 }}
                      selectionColor={colors.text.primary}
                    />
                    <ChevronDown size={18} color={colors.text.muted} strokeWidth={2} />
                  </Pressable>
                  {showCategoryDropdown && (
                    <View className="rounded-xl mt-2 overflow-hidden absolute left-0 right-0 top-14" style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light, maxHeight: 200, zIndex: 30 }}>
                      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                        {filteredCategories.map((cat) => (
                          <Pressable
                            key={cat}
                            onPress={() => handleSelectCategory(cat)}
                            className="px-4 py-3 active:opacity-70"
                            style={{ borderBottomWidth: 1, borderBottomColor: colors.border.light }}
                          >
                            <Text style={{ color: colors.text.secondary }} className="text-sm">{cat}</Text>
                          </Pressable>
                        ))}
                        {categoryInput.trim() && !globalCategories.includes(categoryInput.trim()) && (
                          <Pressable
                            onPress={handleAddNewCategory}
                            className="px-4 py-3 flex-row items-center active:opacity-70"
                            style={{ backgroundColor: colors.bg.secondary }}
                          >
                            <Plus size={16} color="#10B981" strokeWidth={2} />
                            <Text className="text-emerald-500 text-sm ml-2">Add "{categoryInput.trim()}"</Text>
                          </Pressable>
                        )}
                        {filteredCategories.length === 0 && !categoryInput.trim() && (
                          <View className="px-4 py-3">
                            <Text style={{ color: colors.text.muted }} className="text-sm">No categories. Type to add new.</Text>
                          </View>
                        )}
                      </ScrollView>
                    </View>
                  )}
                </View>
              </View>

              {/* Description */}
              <View className="mb-3">
                <Text className="text-gray-500 text-xs font-medium mb-1.5 uppercase tracking-wider">Description</Text>
                <View className="rounded-xl px-4 py-3 border border-gray-300 bg-white">
                  <TextInput
                    placeholder="Product description..."
                    placeholderTextColor="#9CA3AF"
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={3}
                    className="text-gray-900 text-sm"
                    style={{ minHeight: 70 }}
                    selectionColor="#111111"
                  />
                </View>
              </View>

              {/* Low Stock Threshold */}
              <View className="mb-3">
                <Text className="text-gray-500 text-xs font-medium mb-1.5 uppercase tracking-wider">Low Stock Alert Threshold</Text>
                <View className="rounded-xl px-4 flex-row items-center" style={{ height: 52, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.input.border }}>
                  <TextInput
                    placeholder="5"
                    placeholderTextColor={colors.text.muted}
                    value={lowStockThreshold}
                    onChangeText={setLowStockThreshold}
                    keyboardType="number-pad"
                    style={{ color: colors.text.primary, fontSize: 14, flex: 1 }}
                    selectionColor={colors.text.primary}
                  />
                </View>
              </View>

              {/* New Design Toggle */}
              <View className="mb-3">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 mr-3">
                    <Text className="text-gray-900 font-bold text-base">Mark as New Design</Text>
                    <Text className="text-gray-500 text-xs">Track this for yearly reviews</Text>
                  </View>
                  <Switch
                    value={isNewDesign}
                    onValueChange={setIsNewDesign}
                    trackColor={{ false: '#767577', true: '#111111' }}
                    thumbColor="#FFFFFF"
                  />
                </View>
                {isNewDesign && (
                  <View className="mt-3">
                    <Text className="text-gray-500 text-xs font-medium mb-1.5 uppercase tracking-wider">Design Year</Text>
                    <View className="rounded-xl px-4 flex-row items-center" style={{ height: 52, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.input.border }}>
                      <TextInput
                        placeholder={new Date().getFullYear().toString()}
                        placeholderTextColor={colors.text.muted}
                        value={designYear}
                        onChangeText={setDesignYear}
                        keyboardType="number-pad"
                        maxLength={4}
                        style={{ color: colors.text.primary, fontSize: 14, flex: 1 }}
                        selectionColor={colors.text.primary}
                      />
                    </View>
                  </View>
                )}
              </View>
            </View>
          </View>

            {/* Global Pricing Section */}
            <View className="mt-4">
              <View className="bg-white rounded-2xl p-4 border border-gray-200">
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-1">
                    <Text className="text-gray-900 font-bold text-base">Global Pricing</Text>
                    <Text className="text-gray-500 text-xs">Set one price for all variants</Text>
                  </View>
                  <Switch
                    value={useGlobalPrice}
                    onValueChange={setUseGlobalPrice}
                    trackColor={{ false: '#767577', true: '#111111' }}
                    thumbColor="#FFFFFF"
                  />
                </View>
                {useGlobalPrice && (
                  <View>
                    <Text className="text-gray-500 text-xs font-medium mb-1.5 uppercase tracking-wider">Sale Price (All Variants)</Text>
                    <View className="flex-row items-center rounded-xl px-4 bg-white border border-gray-400" style={{ height: 52, justifyContent: 'center' }}>
                      <Text className="text-gray-500 text-sm mr-2">₦</Text>
                      <TextInput
                        placeholder="Enter price for all variants"
                        placeholderTextColor="#9CA3AF"
                        value={globalPrice}
                        onChangeText={setGlobalPrice}
                        keyboardType="decimal-pad"
                        className="flex-1 text-gray-900 text-sm"
                        selectionColor="#111111"
                      />
                    </View>
                  </View>
                )}
                {!useGlobalPrice && (
                  <Text className="text-gray-500 text-xs italic">Set individual prices per variant below</Text>
                )}
              </View>
            </View>

            {/* Variants Section */}
            <View className="mt-4">
              <View className="flex-row items-center justify-between mb-3">
                <View>
                  <Text className="text-gray-900 font-bold text-base">Product Variants</Text>
                  <Text className="text-gray-500 text-xs">Add variants with pricing</Text>
                </View>
                <Pressable
                  onPress={handleAddVariant}
                  className="rounded-xl overflow-hidden active:opacity-80 bg-[#111111] px-3 py-2 flex-row items-center"
                >
                  <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
                  <Text className="text-white font-semibold text-xs ml-1">Add</Text>
                </Pressable>
              </View>

              {/* Variant image error toast */}
              {variantImageError && (
                <View className="mb-3 p-3 rounded-xl" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                  <Text className="text-red-500 text-sm text-center">{variantImageError}</Text>
                </View>
              )}

              {variants.length === 0 && (
                <Pressable
                  onPress={handleAddVariant}
                  className="active:opacity-70"
                >
                  <View className="bg-white rounded-2xl p-4 border border-gray-200 items-center py-8">
                    <View className="w-14 h-14 rounded-2xl items-center justify-center mb-3 bg-gray-100">
                      <Package size={28} color="#9CA3AF" strokeWidth={1.5} />
                    </View>
                    <Text className="text-gray-500 text-sm mb-1">No variants yet</Text>
                    <Text className="text-gray-400 text-xs">Tap to add your first variant</Text>
                  </View>
                </Pressable>
              )}
              {variants.map((variant, index) => (
                  <View
                    key={variant.id}
                    className="mb-3"
                  >
                    <View className="bg-white rounded-2xl p-4 border border-gray-200">
                      <View className="flex-row items-center justify-between mb-4">
                        <View className="flex-row items-center">
                          <View className="w-8 h-8 rounded-lg items-center justify-center mr-2 bg-gray-100">
                            <Text className="text-gray-700 font-bold text-sm">{index + 1}</Text>
                          </View>
                          <Text className="text-gray-900 font-semibold">Variant {index + 1}</Text>
                        </View>
                        <Pressable
                          onPress={() => handleRemoveVariant(index)}
                          className="w-8 h-8 rounded-lg items-center justify-center active:opacity-50 bg-red-50"
                        >
                          <Trash2 size={16} color="#EF4444" strokeWidth={2} />
                        </Pressable>
                      </View>

                      {/* Variant Image - Required */}
                      <View className="mb-3">
                        <Text style={{ color: '#666666' }} className="text-xs font-medium mb-2 uppercase tracking-wider">Variant Image *</Text>
                        {variant.imageUrl ? (
                          <View className="flex-row items-start">
                            <View className="rounded-xl overflow-hidden" style={{ borderWidth: 1, borderColor: colors.border.light }}>
                              <Image
                                source={{ uri: variant.imageUrl }}
                                style={{ width: 64, height: 64 }}
                                resizeMode="cover"
                              />
                            </View>
                            <View className="ml-3 flex-1">
                              <Pressable
                                onPress={() => handlePickVariantImage(variant.id, index)}
                                disabled={variantImageLoading === variant.id}
                                className="flex-row items-center px-3 py-2 rounded-lg mb-2 active:opacity-70"
                                style={{ backgroundColor: colors.bg.secondary, opacity: variantImageLoading === variant.id ? 0.5 : 1 }}
                              >
                                <Camera size={14} color={colors.text.primary} strokeWidth={2} />
                                <Text style={{ color: colors.text.primary }} className="text-xs font-medium ml-2">
                                  {variantImageLoading === variant.id ? 'Loading...' : 'Change'}
                                </Text>
                              </Pressable>
                              <Pressable
                                onPress={() => handleRemoveVariantImage(index)}
                                className="flex-row items-center px-3 py-2 rounded-lg active:opacity-70"
                                style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
                              >
                                <Trash2 size={14} color="#EF4444" strokeWidth={2} />
                                <Text className="text-red-500 text-xs font-medium ml-2">Remove</Text>
                              </Pressable>
                            </View>
                          </View>
                        ) : (
                          <Pressable
                            onPress={() => handlePickVariantImage(variant.id, index)}
                            disabled={variantImageLoading === variant.id}
                            className="rounded-xl p-3 items-center active:opacity-70"
                            style={{
                              backgroundColor: colors.bg.secondary,
                              borderWidth: 1,
                              borderColor: '#EF4444',
                              borderStyle: 'dashed',
                              opacity: variantImageLoading === variant.id ? 0.5 : 1
                            }}
                          >
                            {variantImageLoading === variant.id ? (
                              <Text style={{ color: colors.text.muted }} className="text-sm">Opening...</Text>
                            ) : (
                              <>
                                <View className="w-10 h-10 rounded-full items-center justify-center mb-1" style={{ backgroundColor: colors.bg.card }}>
                                  <ImageIcon size={20} color="#EF4444" strokeWidth={1.5} />
                                </View>
                                <Text style={{ color: '#EF4444' }} className="text-sm font-medium">Add Variant Image</Text>
                                <Text style={{ color: colors.text.muted }} className="text-[10px] mt-0.5">Required for this variant</Text>
                              </>
                            )}
                          </Pressable>
                        )}
                        {/* Error message for missing variant image */}
                        {!variant.imageUrl && (
                          <Text className="text-red-500 text-xs mt-1">Variant image is required</Text>
                        )}
                      </View>

                      {/* Variable Values - Searchable Dropdown */}
                      {productVariables.map((variable) => {
                        const selectedValue = variant.variableValues[variable.name];
                        return (
                          <View key={variable.id} className="mb-3" style={{ zIndex: 5 }}>
                            <Text style={{ color: '#666666' }} className="text-xs font-medium mb-2 uppercase tracking-wider">{variable.name}</Text>
                            {/* Dropdown Trigger */}
                            <Pressable
                              onPress={() => {
                                Keyboard.dismiss();
                                setShowVariantSelector({ variantIndex: index, variableId: variable.id });
                                setVariantSearchQuery('');
                              }}
                              className="rounded-xl px-4 flex-row items-center justify-between"
                              style={{ height: 52, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: selectedValue ? '#111111' : '#444444' }}
                            >
                              <View className="flex-row items-center flex-1">
                                {selectedValue && (
                                  <Check size={16} color="#111111" strokeWidth={2.5} style={{ marginRight: 8 }} />
                                )}
                                <Text style={{ color: selectedValue ? '#111111' : '#999999' }} className="text-sm font-medium">
                                  {selectedValue || `Select ${variable.name}`}
                                </Text>
                              </View>
                              <ChevronDown size={18} color="#999999" strokeWidth={2} />
                            </Pressable>
                          </View>
                        );
                      })}

                      {/* Stock and Price Row */}
                      <View className="flex-row gap-3 mt-1">
                        <View className={useGlobalPrice ? 'flex-1' : 'flex-[0.5]'}>
                          <Text className="text-gray-500 text-xs font-medium mb-1.5 uppercase tracking-wider">Stock</Text>
                          <View className="flex-row items-center rounded-xl px-3 border border-gray-400 bg-white" style={{ height: 52, justifyContent: 'center' }}>
                            <Hash size={14} color="#9CA3AF" strokeWidth={2} />
                            <TextInput
                              placeholder="0"
                              placeholderTextColor="#9CA3AF"
                              value={variant.stock}
                              onChangeText={(text) => handleUpdateVariant(index, { stock: text })}
                              keyboardType="number-pad"
                              className="flex-1 text-gray-900 text-sm ml-2"
                              selectionColor="#111111"
                            />
                          </View>
                        </View>
                        {!useGlobalPrice && (
                          <View className="flex-[0.5]">
                            <Text className="text-gray-500 text-xs font-medium mb-1.5 uppercase tracking-wider">Sale Price</Text>
                            <View className="flex-row items-center rounded-xl px-3 border border-gray-400 bg-white" style={{ height: 52, justifyContent: 'center' }}>
                              <Text className="text-gray-500 text-sm">₦</Text>
                              <TextInput
                                placeholder="0"
                                placeholderTextColor="#9CA3AF"
                                value={variant.sellingPrice}
                                onChangeText={(text) => handleUpdateVariant(index, { sellingPrice: text })}
                                keyboardType="decimal-pad"
                                className="flex-1 text-gray-900 text-sm ml-1"
                                selectionColor="#111111"
                              />
                            </View>
                          </View>
                        )}
                      </View>
                      {useGlobalPrice && globalPrice && (
                        <View className="mt-2 p-2 rounded-lg bg-gray-50">
                          <Text className="text-gray-500 text-xs">
                            Price: <Text className="font-bold text-gray-900">{formatCurrency(parseFloat(globalPrice) || 0)}</Text> (from Global Pricing)
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
              ))}
            </View>

            {/* Summary */}
            {variants.length > 0 && (
              <View className="mb-8 mt-2">
                <View className="bg-white rounded-2xl p-4 border border-gray-200">
                  <Text className="text-gray-500 text-xs font-medium mb-3 uppercase tracking-wider">Summary</Text>
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-gray-600 text-sm">Total Variants</Text>
                    <Text className="text-gray-900 font-semibold">{variants.length}</Text>
                  </View>
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-gray-600 text-sm">Total Starting Stock</Text>
                    <Text className="text-gray-900 font-semibold">
                      {variants.reduce((sum, v) => sum + (parseInt(v.stock, 10) || 0), 0)} units
                    </Text>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-gray-600 text-sm">Estimated Value</Text>
                    <Text className="text-gray-900 font-bold">
                      {formatCurrency(variants.reduce((sum, v) => {
                        const stock = parseInt(v.stock, 10) || 0;
                        const price = parseFloat(v.sellingPrice) || 0;
                        return sum + (stock * price);
                      }, 0))}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Extra space for sticky bottom CTA */}
            <View className="h-32" />
        </KeyboardAwareScrollView>

        {/* Variant Value Selection Modal - Centered */}
        <Modal
          visible={showVariantSelector !== null}
          animationType="fade"
          transparent
          onRequestClose={() => {
            setShowVariantSelector(null);
            setVariantSearchQuery('');
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1"
          >
            <View
              className="flex-1 items-center justify-center"
              style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            >
              <Pressable
                className="absolute inset-0"
                onPress={() => {
                  setShowVariantSelector(null);
                  setVariantSearchQuery('');
                }}
              />
              <View
                className="w-[90%] rounded-2xl overflow-hidden"
                style={{ backgroundColor: '#FFFFFF', maxWidth: 400, maxHeight: '70%' }}
              >
                {(() => {
                  if (!showVariantSelector) return null;
                  const variable = productVariables.find(v => v.id === showVariantSelector.variableId);
                  if (!variable) return null;

                  const filteredValues = variantSearchQuery.trim()
                    ? variable.values.filter(v => v.toLowerCase().includes(variantSearchQuery.toLowerCase()))
                    : variable.values;

                  return (
                    <>
                      {/* Header */}
                      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E5E5E5' }}>
                        <View className="flex-row items-center justify-between mb-3">
                          <Text style={{ color: '#111111' }} className="text-lg font-bold">Select {variable.name}</Text>
                          <Pressable
                            onPress={() => {
                              setShowVariantSelector(null);
                              setVariantSearchQuery('');
                            }}
                            className="w-8 h-8 rounded-full items-center justify-center"
                            style={{ backgroundColor: '#F9F9F9' }}
                          >
                            <X size={18} color="#666666" strokeWidth={2} />
                          </Pressable>
                        </View>
                        {/* Search */}
                        <View
                          className="flex-row items-center rounded-xl px-4"
                          style={{ height: 52, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#444444' }}
                        >
                          <Search size={18} color="#999999" strokeWidth={2} />
                          <TextInput
                            placeholder={`Search ${variable.name}...`}
                            placeholderTextColor="#999999"
                            value={variantSearchQuery}
                            onChangeText={setVariantSearchQuery}
                            style={{ flex: 1, marginLeft: 8, color: '#111111', fontSize: 14 }}
                            selectionColor="#111111"
                          />
                        </View>
                      </View>

                      {/* Options List */}
                      <ScrollView
                        style={{ maxHeight: 300 }}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        bounces={true}
                      >
                        {filteredValues.map((value) => {
                          const isSelected = variants[showVariantSelector.variantIndex]?.variableValues[variable.name] === value;
                          return (
                            <Pressable
                              key={value}
                              onPress={() => handleSelectVariantValue(showVariantSelector.variantIndex, variable.name, value)}
                              className="px-5 py-4 flex-row items-center justify-between active:opacity-70"
                              style={{ borderBottomWidth: 1, borderBottomColor: '#E5E5E5' }}
                            >
                              <Text style={{ color: '#111111' }} className={cn('text-base', isSelected && 'font-semibold')}>
                                {value}
                              </Text>
                              {isSelected && (
                                <Check size={20} color="#111111" strokeWidth={2.5} />
                              )}
                            </Pressable>
                          );
                        })}
                        {filteredValues.length === 0 && (
                          <View className="px-5 py-8 items-center">
                            <Text style={{ color: '#999999' }} className="text-sm">No values found</Text>
                          </View>
                        )}
                        {/* Add New Value Option */}
                        {variantSearchQuery.trim() && !variable.values.includes(variantSearchQuery.trim()) && (
                          <Pressable
                            onPress={() => {
                              // Add the new value to the variable
                              updateProductVariable(variable.id, {
                                values: [...variable.values, variantSearchQuery.trim()],
                              });
                              // Select it
                              handleSelectVariantValue(showVariantSelector.variantIndex, variable.name, variantSearchQuery.trim());
                            }}
                            className="px-5 py-4 flex-row items-center active:opacity-70"
                            style={{ backgroundColor: '#F9F9F9' }}
                          >
                            <Plus size={18} color="#10B981" strokeWidth={2} />
                            <Text style={{ color: '#10B981' }} className="text-base ml-2">Add "{variantSearchQuery.trim()}"</Text>
                          </Pressable>
                        )}
                        <View className="h-4" />
                      </ScrollView>
                    </>
                  );
                })()}
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Image Picker Modal */}
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
              style={{ backgroundColor: '#FFFFFF' }}
            >
              <View className="p-5">
                <View className="w-10 h-1 rounded-full bg-gray-300 self-center mb-4" />
                <Text className="text-gray-900 text-lg font-bold mb-4">Add Product Image</Text>

                <Pressable
                  onPress={handlePickImage}
                  className="flex-row items-center p-4 rounded-xl mb-3 active:opacity-70"
                  style={{ backgroundColor: colors.bg.secondary }}
                >
                  <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: '#111111' }}>
                    <ImageIcon size={20} color="#FFFFFF" strokeWidth={2} />
                  </View>
                  <View>
                    <Text className="text-gray-900 font-semibold">Choose Image</Text>
                    <Text className="text-gray-500 text-xs">Select from your device</Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => setShowImagePicker(false)}
                  className="p-4 rounded-xl items-center active:opacity-70"
                  style={{ backgroundColor: colors.bg.secondary }}
                >
                  <Text className="text-gray-600 font-semibold">Cancel</Text>
                </Pressable>
              </View>
              <View className="h-8" />
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>

      {/* Sticky Bottom CTA */}
      <StickyButtonContainer bottomInset={insets.bottom}>
        <Button
          onPress={handleSubmit}
          disabled={!isValid}
          loading={isSubmitting}
          loadingText="Creating..."
        >
          Create Product
        </Button>
      </StickyButtonContainer>

      {/* Success Toast */}
      {showSuccessToast && (
        <View
          className="absolute left-5 right-5 items-center"
          style={{ top: insets.top + 60 }}
        >
          <View
            className="flex-row items-center px-5 py-4 rounded-xl"
            style={{ backgroundColor: '#111111' }}
          >
            <View className="w-8 h-8 rounded-full items-center justify-center mr-3 bg-white">
              <Check size={18} color="#111111" strokeWidth={2.5} />
            </View>
            <Text className="text-white font-semibold text-sm">Product created successfully!</Text>
          </View>
        </View>
      )}
    </View>
  );
}
