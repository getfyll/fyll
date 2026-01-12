import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X, Plus, Minus, Trash2, ChevronDown, Package } from 'lucide-react-native';
import useFyllStore, { ProcurementItem, formatCurrency } from '@/lib/state/fyll-store';
import { cn } from '@/lib/cn';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';

interface ItemFormData extends ProcurementItem {
  tempId: string;
}

export default function NewProcurementScreen() {
  const router = useRouter();
  const products = useFyllStore((s) => s.products);
  const addProcurement = useFyllStore((s) => s.addProcurement);
  const updateVariantStock = useFyllStore((s) => s.updateVariantStock);

  const [supplierName, setSupplierName] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ItemFormData[]>([]);
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  const totalCost = useMemo(() => {
    return items.reduce((sum, item) => sum + item.costAtPurchase * item.quantity, 0);
  }, [items]);

  const handleAddItem = (productId: string, variantId: string) => {
    const existing = items.find((i) => i.productId === productId && i.variantId === variantId);
    if (existing) return;

    setItems([
      ...items,
      {
        tempId: Math.random().toString(36).substring(2, 10),
        productId,
        variantId,
        quantity: 1,
        costAtPurchase: 0,
      },
    ]);
  };

  const handleUpdateItem = (tempId: string, updates: Partial<ItemFormData>) => {
    setItems(items.map((item) => (item.tempId === tempId ? { ...item, ...updates } : item)));
  };

  const handleRemoveItem = (tempId: string) => {
    setItems(items.filter((item) => item.tempId !== tempId));
  };

  const handleSubmit = () => {
    if (!supplierName.trim() || items.length === 0) return;

    const procurementItems: ProcurementItem[] = items.map(({ productId, variantId, quantity, costAtPurchase }) => ({
      productId,
      variantId,
      quantity,
      costAtPurchase,
    }));

    addProcurement({
      id: Math.random().toString(36).substring(2, 15),
      supplierName: supplierName.trim(),
      items: procurementItems,
      totalCost,
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    });

    // Update stock levels
    items.forEach((item) => {
      updateVariantStock(item.productId, item.variantId, item.quantity);
    });

    router.back();
  };

  const getItemDetails = (item: ItemFormData) => {
    const product = products.find((p) => p.id === item.productId);
    const variant = product?.variants.find((v) => v.id === item.variantId);
    const variantName = variant ? Object.values(variant.variableValues).join(' / ') : '';
    return { productName: product?.name || 'Unknown', variantName };
  };

  const isValid = supplierName.trim() && items.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100">
          <Pressable onPress={() => router.back()} className="active:opacity-50">
            <X size={24} color="#111111" strokeWidth={2} />
          </Pressable>
          <Text className="text-lg font-bold text-gray-900">New Procurement</Text>
          <Pressable
            onPress={handleSubmit}
            disabled={!isValid}
            className={cn(
              'px-4 py-2 rounded-xl',
              isValid ? 'bg-gray-900 active:opacity-80' : 'bg-gray-200'
            )}
          >
            <Text className={cn('font-semibold text-sm', isValid ? 'text-white' : 'text-gray-400')}>
              Record
            </Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
          {/* Supplier Info */}
          <Animated.View entering={FadeInDown.duration(400)} className="mt-4">
            <Text className="text-gray-900 font-bold text-base mb-3">Supplier Information</Text>

            <TextInput
              placeholder="Supplier Name *"
              placeholderTextColor="#9CA3AF"
              value={supplierName}
              onChangeText={setSupplierName}
              className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900 text-sm mb-2"
            />

            <TextInput
              placeholder="Notes (optional)"
              placeholderTextColor="#9CA3AF"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
              className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900 text-sm"
              style={{ minHeight: 60 }}
            />
          </Animated.View>

          {/* Items */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)} className="mt-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-gray-900 font-bold text-base">Items Received</Text>
              <Pressable
                onPress={() => setShowProductSelector(!showProductSelector)}
                className="bg-gray-900 px-3 py-1.5 rounded-lg flex-row items-center active:opacity-80"
              >
                <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
                <Text className="text-white font-semibold text-xs ml-1">Add Items</Text>
              </Pressable>
            </View>

            {/* Product Selector */}
            {showProductSelector && (
              <View className="bg-gray-50 rounded-xl p-3 mb-3">
                {products.map((product) => (
                  <View key={product.id} className="mb-2">
                    <Pressable
                      onPress={() => setExpandedProduct(expandedProduct === product.id ? null : product.id)}
                      className="flex-row items-center justify-between py-2"
                    >
                      <View className="flex-row items-center">
                        <Package size={18} color="#374151" strokeWidth={1.5} />
                        <Text className="text-gray-900 font-semibold text-sm ml-2">{product.name}</Text>
                      </View>
                      <ChevronDown
                        size={18}
                        color="#6B7280"
                        strokeWidth={2}
                        style={{ transform: [{ rotate: expandedProduct === product.id ? '180deg' : '0deg' }] }}
                      />
                    </Pressable>
                    {expandedProduct === product.id && (
                      <View className="pl-6 border-l-2 border-gray-200">
                        {product.variants.map((variant) => {
                          const variantName = Object.values(variant.variableValues).join(' / ');
                          const isAdded = items.some(
                            (i) => i.productId === product.id && i.variantId === variant.id
                          );

                          return (
                            <Pressable
                              key={variant.id}
                              onPress={() => handleAddItem(product.id, variant.id)}
                              disabled={isAdded}
                              className={cn(
                                'flex-row items-center justify-between py-2 px-2 rounded-lg mb-1',
                                isAdded ? 'bg-green-100' : 'bg-white active:bg-gray-100'
                              )}
                            >
                              <View>
                                <Text className="text-gray-800 text-sm font-medium">{variantName}</Text>
                                <Text className="text-gray-500 text-xs">SKU: {variant.sku}</Text>
                              </View>
                              {isAdded ? (
                                <Text className="text-green-600 text-xs font-semibold">Added</Text>
                              ) : (
                                <Plus size={18} color="#6B7280" strokeWidth={2} />
                              )}
                            </Pressable>
                          );
                        })}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Added Items */}
            {items.length > 0 ? (
              <View className="bg-gray-50 rounded-xl p-3">
                {items.map((item) => {
                  const { productName, variantName } = getItemDetails(item);
                  return (
                    <Animated.View
                      key={item.tempId}
                      layout={Layout.springify()}
                      className="bg-white rounded-xl p-3 mb-2"
                    >
                      <View className="flex-row items-start justify-between mb-2">
                        <View className="flex-1">
                          <Text className="text-gray-900 font-semibold text-sm">{productName}</Text>
                          <Text className="text-gray-500 text-xs">{variantName}</Text>
                        </View>
                        <Pressable
                          onPress={() => handleRemoveItem(item.tempId)}
                          className="p-1 active:opacity-50"
                        >
                          <Trash2 size={16} color="#EF4444" strokeWidth={2} />
                        </Pressable>
                      </View>

                      <View className="flex-row items-center gap-3">
                        <View className="flex-1">
                          <Text className="text-gray-500 text-xs mb-1">Quantity</Text>
                          <View className="flex-row items-center bg-gray-100 rounded-lg">
                            <Pressable
                              onPress={() =>
                                handleUpdateItem(item.tempId, {
                                  quantity: Math.max(1, item.quantity - 1),
                                })
                              }
                              className="p-2 active:opacity-50"
                            >
                              <Minus size={14} color="#111111" strokeWidth={2} />
                            </Pressable>
                            <TextInput
                              value={String(item.quantity)}
                              onChangeText={(text) =>
                                handleUpdateItem(item.tempId, {
                                  quantity: parseInt(text, 10) || 1,
                                })
                              }
                              keyboardType="number-pad"
                              className="flex-1 text-center text-gray-900 font-semibold text-sm"
                            />
                            <Pressable
                              onPress={() =>
                                handleUpdateItem(item.tempId, { quantity: item.quantity + 1 })
                              }
                              className="p-2 active:opacity-50"
                            >
                              <Plus size={14} color="#111111" strokeWidth={2} />
                            </Pressable>
                          </View>
                        </View>

                        <View className="flex-1">
                          <Text className="text-gray-500 text-xs mb-1">Unit Cost</Text>
                          <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2">
                            <Text className="text-gray-500 text-sm">$</Text>
                            <TextInput
                              value={String(item.costAtPurchase)}
                              onChangeText={(text) =>
                                handleUpdateItem(item.tempId, {
                                  costAtPurchase: parseFloat(text) || 0,
                                })
                              }
                              keyboardType="decimal-pad"
                              className="flex-1 text-gray-900 font-semibold text-sm ml-1"
                            />
                          </View>
                        </View>

                        <View className="items-end">
                          <Text className="text-gray-500 text-xs mb-1">Subtotal</Text>
                          <Text className="text-gray-900 font-bold text-base">
                            {formatCurrency(item.quantity * item.costAtPurchase)}
                          </Text>
                        </View>
                      </View>
                    </Animated.View>
                  );
                })}
              </View>
            ) : (
              !showProductSelector && (
                <Pressable
                  onPress={() => setShowProductSelector(true)}
                  className="bg-gray-50 rounded-xl p-8 items-center active:opacity-70"
                >
                  <Text className="text-gray-400 text-sm">Tap to add items</Text>
                </Pressable>
              )
            )}
          </Animated.View>

          {/* Total */}
          {items.length > 0 && (
            <Animated.View
              entering={FadeInDown.delay(200).duration(400)}
              className="mt-6 bg-blue-50 rounded-2xl p-4"
            >
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-blue-900 text-base font-medium">Total Cost</Text>
                  <Text className="text-blue-600 text-xs">
                    {items.reduce((sum, i) => sum + i.quantity, 0)} items
                  </Text>
                </View>
                <Text className="text-blue-900 text-2xl font-bold">{formatCurrency(totalCost)}</Text>
              </View>
            </Animated.View>
          )}

          <View className="h-24" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
