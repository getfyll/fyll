import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Image, Modal, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Package, Edit2, Printer, PackagePlus, Plus, Minus, Tag, Clock, Trash2 } from 'lucide-react-native';
import useFyllStore, { Product, formatCurrency } from '@/lib/state/fyll-store';
import useAuthStore from '@/lib/state/auth-store';
import { useThemeColors } from '@/lib/theme';
import { DetailSection, DetailImagePreview, DetailActionButton, DetailKeyValue } from './SplitViewLayout';
import * as Haptics from 'expo-haptics';

interface ProductDetailPanelProps {
  productId: string;
  onClose?: () => void;
}

export function ProductDetailPanel({ productId, onClose }: ProductDetailPanelProps) {
  const colors = useThemeColors();
  const router = useRouter();
  const isDark = colors.bg.primary === '#111111';

  const products = useFyllStore((s) => s.products);
  const updateVariantStock = useFyllStore((s) => s.updateVariantStock);
  const deleteProduct = useFyllStore((s) => s.deleteProduct);
  const userRole = useFyllStore((s) => s.userRole);
  const restockLogs = useFyllStore((s) => s.restockLogs);
  const useGlobalLowStockThreshold = useFyllStore((s) => s.useGlobalLowStockThreshold);
  const globalLowStockThreshold = useFyllStore((s) => s.globalLowStockThreshold);
  const businessId = useAuthStore((s) => s.businessId ?? s.currentUser?.businessId ?? null);
  const [pendingDelete, setPendingDelete] = useState(false);

  const product = useMemo(() => products.find((p) => p.id === productId), [products, productId]);
  const isOwner = userRole === 'owner';

  // Get effective threshold for this product
  const effectiveThreshold = useMemo(() => {
    if (!product) return 5;
    return useGlobalLowStockThreshold ? globalLowStockThreshold : product.lowStockThreshold;
  }, [product, useGlobalLowStockThreshold, globalLowStockThreshold]);

  // Get recent restock logs for this product (last 3)
  const recentRestocks = useMemo(() => {
    if (!productId) return [];
    return restockLogs
      .filter((log) => log.productId === productId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 3);
  }, [restockLogs, productId]);

  if (!product) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <Package size={48} color={colors.text.muted} strokeWidth={1.5} />
        <Text style={{ color: colors.text.muted, fontSize: 16, marginTop: 16 }}>
          Select a product to view details
        </Text>
      </View>
    );
  }

  const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
  const totalValue = product.variants.reduce((sum, v) => sum + v.stock * v.sellingPrice, 0);
  const lowStockCount = product.variants.filter((v) => v.stock <= effectiveThreshold).length;

  const handleAdjustStock = (variantId: string, delta: number) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    updateVariantStock(product.id, variantId, delta);
  };

  const handleEdit = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push(`/product/${product.id}`);
  };

  const handleDelete = () => {
    if (Platform.OS === 'web') {
      const active = document.activeElement as HTMLElement | null;
      active?.blur();
    }
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setPendingDelete(true);
  };

  const confirmDelete = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    deleteProduct(product.id, businessId);
    setPendingDelete(false);
    onClose?.();
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Product Image */}
      <DetailImagePreview imageUrl={product.imageUrl} />

      {/* Product Info */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <Text style={{ color: colors.text.primary, fontSize: 22, fontWeight: '700', flex: 1 }}>
            {product.name}
          </Text>
          {product.isNewDesign && (
            <View style={{ backgroundColor: '#3B82F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
                New {product.designYear || new Date().getFullYear()}
              </Text>
            </View>
          )}
          {product.isDiscontinued && (
            <View style={{ backgroundColor: 'rgba(248, 113, 113, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginLeft: 6 }}>
              <Text style={{ color: '#F87171', fontSize: 11, fontWeight: '700' }}>DISCONTINUED</Text>
            </View>
          )}
        </View>
        <Text style={{ color: colors.text.muted, fontSize: 13 }}>
          {product.categories?.join(', ') || 'Uncategorized'}
        </Text>
      </View>

      {/* Stats */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingTop: 16, gap: 12 }}>
        <View
          style={{
            flex: 1,
            backgroundColor: colors.bg.card,
            borderRadius: 16,
            padding: 14,
            borderWidth: 1,
            borderColor: colors.border.light,
          }}
        >
          <Text style={{ color: colors.text.tertiary, fontSize: 12, fontWeight: '500' }}>Total Stock</Text>
          <Text style={{ color: colors.text.primary, fontSize: 24, fontWeight: '700', marginTop: 4 }}>
            {totalStock}
          </Text>
          {lowStockCount > 0 && (
            <View style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 6, alignSelf: 'flex-start' }}>
              <Text style={{ color: '#F59E0B', fontSize: 12, fontWeight: '600' }}>{lowStockCount} low</Text>
            </View>
          )}
        </View>
        {isOwner && (
          <View
            style={{
              flex: 1,
              backgroundColor: colors.bg.card,
              borderRadius: 16,
              padding: 14,
              borderWidth: 1,
              borderColor: colors.border.light,
            }}
          >
            <Text style={{ color: colors.text.tertiary, fontSize: 12, fontWeight: '500' }}>Stock Value</Text>
            <Text style={{ color: '#10B981', fontSize: 24, fontWeight: '700', marginTop: 4 }}>
              {formatCurrency(totalValue)}
            </Text>
            <Text style={{ color: colors.text.muted, fontSize: 11, marginTop: 6 }}>at retail price</Text>
          </View>
        )}
      </View>

      {/* Description */}
      {product.description && (
        <DetailSection title="Description">
          <Text style={{ color: colors.text.secondary, fontSize: 14, lineHeight: 20 }}>
            {product.description}
          </Text>
        </DetailSection>
      )}

      {/* Variants */}
      <DetailSection title={`Variants (${product.variants.length})`}>
        {product.variants.map((variant, index) => {
          const variantName = Object.values(variant.variableValues).join(' / ');
          const isLowStock = variant.stock <= effectiveThreshold;
          const isOutOfStock = variant.stock === 0;
          const statusColor = isOutOfStock ? '#EF4444' : isLowStock ? '#F59E0B' : '#10B981';

          return (
            <View
              key={variant.id}
              style={{
                paddingVertical: 12,
                borderTopWidth: index > 0 ? 1 : 0,
                borderTopColor: colors.border.light,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text.primary, fontSize: 15, fontWeight: '600' }}>{variantName}</Text>
                  <Text style={{ color: colors.text.muted, fontSize: 12, marginTop: 2 }}>SKU: {variant.sku}</Text>
                </View>
                <View style={{ backgroundColor: `${statusColor}15`, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                  <Text style={{ color: statusColor, fontSize: 13, fontWeight: '600' }}>{variant.stock} units</Text>
                </View>
              </View>

              {/* Stock Controls */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Pressable
                    onPress={() => router.push(`/restock?productId=${product.id}&variantId=${variant.id}`)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 8,
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    }}
                  >
                    <PackagePlus size={14} color="#10B981" strokeWidth={2} />
                    <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '600', marginLeft: 4 }}>Restock</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => router.push(`/label-print?productId=${product.id}&variantId=${variant.id}`)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 8,
                      backgroundColor: colors.bg.secondary,
                    }}
                  >
                    <Printer size={14} color={colors.text.tertiary} strokeWidth={2} />
                  </Pressable>
                </View>

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderRadius: 10,
                    backgroundColor: colors.border.light,
                  }}
                >
                  <Pressable
                    onPress={() => handleAdjustStock(variant.id, -1)}
                    disabled={variant.stock === 0}
                    style={{ padding: 8, opacity: variant.stock === 0 ? 0.4 : 1 }}
                  >
                    <Minus size={16} color={colors.text.primary} strokeWidth={2} />
                  </Pressable>
                  <View style={{ width: 32, alignItems: 'center' }}>
                    <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '600' }}>{variant.stock}</Text>
                  </View>
                  <Pressable
                    onPress={() => handleAdjustStock(variant.id, 1)}
                    style={{ padding: 8 }}
                  >
                    <Plus size={16} color={colors.text.primary} strokeWidth={2} />
                  </Pressable>
                </View>
              </View>

              {isOwner && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border.light }}>
                  <Text style={{ color: colors.text.tertiary, fontSize: 13 }}>Sale Price</Text>
                  <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '600' }}>{formatCurrency(variant.sellingPrice)}</Text>
                </View>
              )}
            </View>
          );
        })}
      </DetailSection>

      {/* Recent Restocks */}
      {recentRestocks.length > 0 && (
        <DetailSection title="Recent Restocks">
          {recentRestocks.map((log, index) => {
            const variant = product.variants.find((v) => v.id === log.variantId);
            const variantName = variant ? Object.values(variant.variableValues).join(' / ') : 'Unknown';
            const date = new Date(log.timestamp);
            const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            return (
              <View
                key={log.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 10,
                  borderTopWidth: index > 0 ? 1 : 0,
                  borderTopColor: colors.border.light,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <PackagePlus size={16} color="#10B981" strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '500' }}>
                    +{log.quantityAdded} units
                  </Text>
                  <Text style={{ color: colors.text.muted, fontSize: 12 }}>
                    {variantName} · {log.previousStock} → {log.newStock}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Clock size={12} color={colors.text.muted} strokeWidth={2} />
                  <Text style={{ color: colors.text.muted, fontSize: 12, marginLeft: 4 }}>{formattedDate}</Text>
                </View>
              </View>
            );
          })}
        </DetailSection>
      )}
      {/* Actions */}
      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 }}>
        <DetailActionButton
          label="Edit Product"
          icon={<Edit2 size={18} color={isDark ? '#000000' : '#FFFFFF'} strokeWidth={2} />}
          onPress={handleEdit}
        />
        <Pressable
          onPress={handleDelete}
          className="rounded-xl items-center justify-center mt-3 active:opacity-80"
          style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', height: 48 }}
        >
          <View className="flex-row items-center">
            <Trash2 size={18} color="#EF4444" strokeWidth={2} />
            <Text style={{ color: '#EF4444', fontSize: 15, fontWeight: '600', marginLeft: 8 }}>
              Delete Product
            </Text>
          </View>
        </Pressable>
      </View>

      <Modal
        visible={pendingDelete}
        animationType="fade"
        transparent
        onRequestClose={() => setPendingDelete(false)}
      >
        <Pressable
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          onPress={() => setPendingDelete(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="w-[90%] rounded-2xl overflow-hidden"
            style={{ backgroundColor: colors.bg.primary, maxWidth: 360 }}
          >
            <View className="px-5 py-4" style={{ borderBottomWidth: 1, borderBottomColor: colors.border.light }}>
              <Text style={{ color: colors.text.primary }} className="font-bold text-lg">Delete Product</Text>
              <Text style={{ color: colors.text.tertiary }} className="text-sm mt-1">
                {product.name ? `Delete ${product.name}?` : 'Delete this product?'}
              </Text>
            </View>
            <View className="px-5 py-4 flex-row gap-3">
              <Pressable
                onPress={() => setPendingDelete(false)}
                className="flex-1 rounded-xl items-center"
                style={{ backgroundColor: colors.bg.secondary, height: 48, justifyContent: 'center' }}
              >
                <Text style={{ color: colors.text.tertiary }} className="font-medium">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={confirmDelete}
                className="flex-1 rounded-xl items-center"
                style={{ backgroundColor: '#EF4444', height: 48, justifyContent: 'center' }}
              >
                <Text className="text-white font-semibold">Delete</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
