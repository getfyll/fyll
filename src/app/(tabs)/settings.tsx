import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Trash2, Edit2, Check, X, ChevronRight, ChevronLeft, Package, ShoppingCart, Tag, RotateCcw, Info, CreditCard, Truck, Wrench, Users, Moon, Sun, LogOut, Shield, Building2, AlertTriangle, UserCircle } from 'lucide-react-native';
import useFyllStore, { formatCurrency } from '@/lib/state/fyll-store';
import useAuthStore from '@/lib/state/auth-store';
import { useThemeColors } from '@/lib/theme';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import * as Haptics from 'expo-haptics';

type SettingsSection = 'order-statuses' | 'sale-sources' | 'custom-services' | 'payment-methods' | 'logistics-carriers';

interface EditableItemProps {
  item: { id: string; name: string; color?: string; defaultPrice?: number };
  onUpdate: (name: string, color?: string, defaultPrice?: number) => void;
  onDelete: () => void;
  showColor?: boolean;
  showPrice?: boolean;
}

function EditableItem({ item, onUpdate, onDelete, showColor = false, showPrice = false }: EditableItemProps) {
  const colors = useThemeColors();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editColor, setEditColor] = useState(item.color || '#6B7280');
  const [editPrice, setEditPrice] = useState(item.defaultPrice?.toString() || '0');

  const colorOptions = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280', '#059669'];

  const handleSave = () => {
    if (editName.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onUpdate(editName.trim(), showColor ? editColor : undefined, showPrice ? parseFloat(editPrice) || 0 : undefined);
      setIsEditing(false);
    }
  };

  return (
    <View className="mb-2">
      <View className="rounded-xl" style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
        {isEditing ? (
          <View className="p-4">
            <View className="rounded-xl px-4 mb-3" style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 50, justifyContent: 'center' }}>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                style={{ color: colors.input.text, fontSize: 14 }}
                autoFocus
                placeholderTextColor={colors.input.placeholder}
                selectionColor={colors.text.primary}
              />
            </View>
            {showPrice && (
              <View className="rounded-xl px-4 mb-3" style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 50, justifyContent: 'center' }}>
                <TextInput
                  value={editPrice}
                  onChangeText={setEditPrice}
                  style={{ color: colors.input.text, fontSize: 14 }}
                  keyboardType="numeric"
                  placeholder="Default price"
                  placeholderTextColor={colors.input.placeholder}
                  selectionColor={colors.text.primary}
                />
              </View>
            )}
            {showColor && (
              <View className="flex-row flex-wrap gap-2 mb-3">
                {colorOptions.map((color) => (
                  <Pressable
                    key={color}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setEditColor(color);
                    }}
                    className="w-8 h-8 rounded-full items-center justify-center"
                    style={{
                      backgroundColor: color,
                      borderWidth: editColor === color ? 2 : 0,
                      borderColor: colors.text.primary,
                    }}
                  >
                    {editColor === color && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                  </Pressable>
                ))}
              </View>
            )}
            <View className="flex-row gap-2">
              <Pressable
                onPress={handleSave}
                className="flex-1 rounded-xl items-center active:opacity-80"
                style={{ backgroundColor: '#111111', height: 50, justifyContent: 'center' }}
              >
                <Text className="text-white font-semibold text-sm">Save</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setEditName(item.name);
                  setEditColor(item.color || '#6B7280');
                  setEditPrice(item.defaultPrice?.toString() || '0');
                  setIsEditing(false);
                }}
                className="px-4 rounded-xl items-center active:opacity-70"
                style={{ backgroundColor: colors.bg.secondary, height: 50, justifyContent: 'center' }}
              >
                <X size={18} color={colors.text.tertiary} strokeWidth={2} />
              </Pressable>
            </View>
          </View>
        ) : (
          <View className="flex-row items-center p-4">
            {showColor && (
              <View
                className="w-4 h-4 rounded-full mr-3"
                style={{ backgroundColor: item.color || '#6B7280' }}
              />
            )}
            <View className="flex-1">
              <Text style={{ color: colors.text.primary }} className="font-medium text-sm">{item.name}</Text>
              {showPrice && item.defaultPrice !== undefined && (
                <Text style={{ color: colors.text.tertiary }} className="text-xs">{formatCurrency(item.defaultPrice)}</Text>
              )}
            </View>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsEditing(true);
              }}
              className="p-2 active:opacity-50"
            >
              <Edit2 size={16} color={colors.text.tertiary} strokeWidth={2} />
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onDelete();
              }}
              className="p-2 active:opacity-50"
            >
              <Trash2 size={16} color="#EF4444" strokeWidth={2} />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

interface SectionCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  iconColor: string;
  count?: number;
  onPress: () => void;
}

function SectionCard({ title, description, icon, iconColor, count, onPress }: SectionCardProps) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      className="mb-3 active:opacity-80"
    >
      <View className="rounded-xl p-4 flex-row items-center" style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
        <View
          className="w-12 h-12 rounded-xl items-center justify-center mr-3"
          style={{ backgroundColor: `${iconColor}15` }}
        >
          {icon}
        </View>
        <View className="flex-1">
          <Text style={{ color: colors.text.primary }} className="font-bold text-base">{title}</Text>
          <Text style={{ color: colors.text.tertiary }} className="text-xs mt-0.5">{description}</Text>
        </View>
        {count !== undefined && (
          <View className="px-3 py-1.5 rounded-full mr-2" style={{ backgroundColor: colors.bg.secondary }}>
            <Text style={{ color: colors.text.tertiary }} className="text-sm font-semibold">{count}</Text>
          </View>
        )}
        <ChevronRight size={20} color={colors.text.muted} strokeWidth={2} />
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const tabBarHeight = useBottomTabBarHeight();
  const orderStatuses = useFyllStore((s) => s.orderStatuses);
  const saleSources = useFyllStore((s) => s.saleSources);
  const productVariables = useFyllStore((s) => s.productVariables);
  const categories = useFyllStore((s) => s.categories);
  const customServices = useFyllStore((s) => s.customServices);
  const paymentMethods = useFyllStore((s) => s.paymentMethods);
  const logisticsCarriers = useFyllStore((s) => s.logisticsCarriers);
  const customers = useFyllStore((s) => s.customers);
  const themeMode = useFyllStore((s) => s.themeMode);
  const setThemeMode = useFyllStore((s) => s.setThemeMode);

  // Global Low Stock Threshold
  const useGlobalLowStockThreshold = useFyllStore((s) => s.useGlobalLowStockThreshold);
  const globalLowStockThreshold = useFyllStore((s) => s.globalLowStockThreshold);
  const setUseGlobalLowStockThreshold = useFyllStore((s) => s.setUseGlobalLowStockThreshold);
  const setGlobalLowStockThreshold = useFyllStore((s) => s.setGlobalLowStockThreshold);
  const [tempThreshold, setTempThreshold] = useState(globalLowStockThreshold.toString());

  const addOrderStatus = useFyllStore((s) => s.addOrderStatus);
  const updateOrderStatus = useFyllStore((s) => s.updateOrderStatus);
  const deleteOrderStatus = useFyllStore((s) => s.deleteOrderStatus);

  const addSaleSource = useFyllStore((s) => s.addSaleSource);
  const updateSaleSource = useFyllStore((s) => s.updateSaleSource);
  const deleteSaleSource = useFyllStore((s) => s.deleteSaleSource);

  const addCustomService = useFyllStore((s) => s.addCustomService);
  const updateCustomService = useFyllStore((s) => s.updateCustomService);
  const deleteCustomService = useFyllStore((s) => s.deleteCustomService);

  const addPaymentMethod = useFyllStore((s) => s.addPaymentMethod);
  const updatePaymentMethod = useFyllStore((s) => s.updatePaymentMethod);
  const deletePaymentMethod = useFyllStore((s) => s.deletePaymentMethod);

  const addLogisticsCarrier = useFyllStore((s) => s.addLogisticsCarrier);
  const updateLogisticsCarrier = useFyllStore((s) => s.updateLogisticsCarrier);
  const deleteLogisticsCarrier = useFyllStore((s) => s.deleteLogisticsCarrier);

  const resetStore = useFyllStore((s) => s.resetStore);

  // Auth
  const currentUser = useAuthStore((s) => s.currentUser);
  const businessId = useAuthStore((s) => s.businessId);
  const teamMembers = useAuthStore((s) => s.teamMembers);
  const logout = useAuthStore((s) => s.logout);

  const [activeSection, setActiveSection] = useState<SettingsSection | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemColor, setNewItemColor] = useState('#3B82F6');
  const [newItemPrice, setNewItemPrice] = useState('');

  const colorOptions = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280', '#059669'];

  const handleLogout = async () => {
    try {
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } catch (e) {
      // Haptics might fail, continue anyway
    }

    try {
      await logout();
      router.replace('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Force navigate even if logout fails
      router.replace('/login');
    }
  };

  const handleAddItem = () => {
    if (!newItemName.trim()) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const id = Math.random().toString(36).substring(2, 15);

    switch (activeSection) {
      case 'order-statuses':
        addOrderStatus({ id, name: newItemName.trim(), color: newItemColor, order: orderStatuses.length + 1 });
        break;
      case 'sale-sources':
        addSaleSource({ id, name: newItemName.trim(), icon: 'circle' });
        break;
      case 'custom-services':
        addCustomService({ id, name: newItemName.trim(), defaultPrice: parseFloat(newItemPrice) || 0 });
        break;
      case 'payment-methods':
        addPaymentMethod({ id, name: newItemName.trim() });
        break;
      case 'logistics-carriers':
        addLogisticsCarrier({ id, name: newItemName.trim() });
        break;
    }

    setNewItemName('');
    setNewItemColor('#3B82F6');
    setNewItemPrice('');
  };

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'order-statuses':
        return (
          <View className="px-5 pt-4">
            <View className="rounded-xl p-4 mb-4" style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
              <Text style={{ color: colors.text.primary }} className="font-bold text-sm mb-3">Add New Status</Text>
              <View className="rounded-xl px-4 mb-3" style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 50, justifyContent: 'center' }}>
                <TextInput
                  placeholder="Status name"
                  placeholderTextColor={colors.input.placeholder}
                  value={newItemName}
                  onChangeText={setNewItemName}
                  style={{ color: colors.input.text, fontSize: 14 }}
                  selectionColor={colors.text.primary}
                />
              </View>
              <View className="flex-row flex-wrap gap-2 mb-3">
                {colorOptions.map((color) => (
                  <Pressable
                    key={color}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setNewItemColor(color);
                    }}
                    className="w-8 h-8 rounded-full items-center justify-center"
                    style={{
                      backgroundColor: color,
                      borderWidth: newItemColor === color ? 2 : 0,
                      borderColor: colors.text.primary,
                    }}
                  >
                    {newItemColor === color && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                  </Pressable>
                ))}
              </View>
              <Pressable
                onPress={handleAddItem}
                className="rounded-xl items-center active:opacity-80"
                style={{ backgroundColor: '#111111', height: 50, justifyContent: 'center' }}
              >
                <Text className="text-white font-semibold">Add Status</Text>
              </Pressable>
            </View>

            {orderStatuses.map((status) => (
              <EditableItem
                key={status.id}
                item={status}
                showColor
                onUpdate={(name, color) => updateOrderStatus(status.id, { name, color })}
                onDelete={() => deleteOrderStatus(status.id)}
              />
            ))}
          </View>
        );

      case 'sale-sources':
        return (
          <View className="px-5 pt-4">
            <View className="rounded-xl p-4 mb-4" style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
              <Text style={{ color: colors.text.primary }} className="font-bold text-sm mb-3">Add New Source</Text>
              <View className="rounded-xl px-4 mb-3" style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 50, justifyContent: 'center' }}>
                <TextInput
                  placeholder="Source name"
                  placeholderTextColor={colors.input.placeholder}
                  value={newItemName}
                  onChangeText={setNewItemName}
                  style={{ color: colors.input.text, fontSize: 14 }}
                  selectionColor={colors.text.primary}
                />
              </View>
              <Pressable
                onPress={handleAddItem}
                className="rounded-xl items-center active:opacity-80"
                style={{ backgroundColor: '#111111', height: 50, justifyContent: 'center' }}
              >
                <Text className="text-white font-semibold">Add Source</Text>
              </Pressable>
            </View>

            {saleSources.map((source) => (
              <EditableItem
                key={source.id}
                item={source}
                onUpdate={(name) => updateSaleSource(source.id, { name })}
                onDelete={() => deleteSaleSource(source.id)}
              />
            ))}
          </View>
        );

      case 'custom-services':
        return (
          <View className="px-5 pt-4">
            <View className="rounded-xl p-4 mb-4" style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
              <Text style={{ color: colors.text.primary }} className="font-bold text-sm mb-3">Add New Service</Text>
              <View className="rounded-xl px-4 mb-3" style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 50, justifyContent: 'center' }}>
                <TextInput
                  placeholder="Service name"
                  placeholderTextColor={colors.input.placeholder}
                  value={newItemName}
                  onChangeText={setNewItemName}
                  style={{ color: colors.input.text, fontSize: 14 }}
                  selectionColor={colors.text.primary}
                />
              </View>
              <View className="rounded-xl px-4 mb-3" style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 50, justifyContent: 'center' }}>
                <TextInput
                  placeholder="Default price (optional)"
                  placeholderTextColor={colors.input.placeholder}
                  value={newItemPrice}
                  onChangeText={setNewItemPrice}
                  keyboardType="numeric"
                  style={{ color: colors.input.text, fontSize: 14 }}
                  selectionColor={colors.text.primary}
                />
              </View>
              <Pressable
                onPress={handleAddItem}
                className="rounded-xl items-center active:opacity-80"
                style={{ backgroundColor: '#111111', height: 50, justifyContent: 'center' }}
              >
                <Text className="text-white font-semibold">Add Service</Text>
              </Pressable>
            </View>

            {customServices.map((service) => (
              <EditableItem
                key={service.id}
                item={service}
                showPrice
                onUpdate={(name, _, defaultPrice) => updateCustomService(service.id, { name, defaultPrice })}
                onDelete={() => deleteCustomService(service.id)}
              />
            ))}
          </View>
        );

      case 'payment-methods':
        return (
          <View className="px-5 pt-4">
            <View className="rounded-xl p-4 mb-4" style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
              <Text style={{ color: colors.text.primary }} className="font-bold text-sm mb-3">Add New Payment Method</Text>
              <View className="rounded-xl px-4 mb-3" style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 50, justifyContent: 'center' }}>
                <TextInput
                  placeholder="Payment method name"
                  placeholderTextColor={colors.input.placeholder}
                  value={newItemName}
                  onChangeText={setNewItemName}
                  style={{ color: colors.input.text, fontSize: 14 }}
                  selectionColor={colors.text.primary}
                />
              </View>
              <Pressable
                onPress={handleAddItem}
                className="rounded-xl items-center active:opacity-80"
                style={{ backgroundColor: '#111111', height: 50, justifyContent: 'center' }}
              >
                <Text className="text-white font-semibold">Add Payment Method</Text>
              </Pressable>
            </View>

            {paymentMethods.map((method) => (
              <EditableItem
                key={method.id}
                item={method}
                onUpdate={(name) => updatePaymentMethod(method.id, { name })}
                onDelete={() => deletePaymentMethod(method.id)}
              />
            ))}
          </View>
        );

      case 'logistics-carriers':
        return (
          <View className="px-5 pt-4">
            <View className="rounded-xl p-4 mb-4" style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
              <Text style={{ color: colors.text.primary }} className="font-bold text-sm mb-3">Add New Carrier</Text>
              <View className="rounded-xl px-4 mb-3" style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 50, justifyContent: 'center' }}>
                <TextInput
                  placeholder="Carrier name"
                  placeholderTextColor={colors.input.placeholder}
                  value={newItemName}
                  onChangeText={setNewItemName}
                  style={{ color: colors.input.text, fontSize: 14 }}
                  selectionColor={colors.text.primary}
                />
              </View>
              <Pressable
                onPress={handleAddItem}
                className="rounded-xl items-center active:opacity-80"
                style={{ backgroundColor: '#111111', height: 50, justifyContent: 'center' }}
              >
                <Text className="text-white font-semibold">Add Carrier</Text>
              </Pressable>
            </View>

            {logisticsCarriers.map((carrier) => (
              <EditableItem
                key={carrier.id}
                item={carrier}
                onUpdate={(name) => updateLogisticsCarrier(carrier.id, { name })}
                onDelete={() => deleteLogisticsCarrier(carrier.id)}
              />
            ))}
          </View>
        );

      default:
        return null;
    }
  };

  if (activeSection) {
    const titles: Record<SettingsSection, string> = {
      'order-statuses': 'Order Statuses',
      'sale-sources': 'Sale Sources',
      'custom-services': 'Custom Services',
      'payment-methods': 'Payment Methods',
      'logistics-carriers': 'Logistics Carriers',
    };

    return (
      <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
        <SafeAreaView className="flex-1" edges={['top']}>
          <View className="px-5 pt-6 pb-3 flex-row items-center" style={{ borderBottomWidth: 1, borderBottomColor: colors.border.light }}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveSection(null);
              }}
              className="w-10 h-10 rounded-xl items-center justify-center mr-3 active:opacity-50"
              style={{ backgroundColor: colors.bg.secondary }}
            >
              <ChevronLeft size={20} color={colors.text.primary} strokeWidth={2} />
            </Pressable>
            <Text style={{ color: colors.text.primary }} className="text-xl font-bold">{titles[activeSection]}</Text>
          </View>
          <KeyboardAwareScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            enableOnAndroid
            extraScrollHeight={100}
            contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
          >
            {renderSectionContent()}
            <View className="h-24" />
          </KeyboardAwareScrollView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="px-5 pt-6 pb-3" style={{ borderBottomWidth: 1, borderBottomColor: colors.border.light }}>
          <Text style={{ color: colors.text.tertiary }} className="text-xs font-medium uppercase tracking-wider">Configuration</Text>
          <Text style={{ color: colors.text.primary }} className="text-2xl font-bold">Settings</Text>
        </View>

        <KeyboardAwareScrollView
          className="flex-1 px-5 pt-4"
          showsVerticalScrollIndicator={false}
          enableOnAndroid
          extraScrollHeight={100}
          contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
        >
          {/* Account Settings */}
          {currentUser && (
            <>
              <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase mb-3 tracking-wider">Account</Text>

              {/* Account Info Debug Card */}
              <Pressable
                onPress={() => router.push('/debug-business')}
                className="rounded-xl p-4 mb-3 active:opacity-70"
                style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}
              >
                <View className="flex-row items-center mb-3">
                  <Info size={18} color={colors.text.tertiary} strokeWidth={1.5} />
                  <Text style={{ color: colors.text.secondary }} className="text-sm font-semibold ml-2">
                    Account Information
                  </Text>
                  <ChevronRight size={16} color={colors.text.tertiary} strokeWidth={2} style={{ marginLeft: 'auto' }} />
                </View>
                <View className="space-y-2">
                  <View className="flex-row justify-between items-center py-1">
                    <Text style={{ color: colors.text.tertiary }} className="text-xs">Email</Text>
                    <Text style={{ color: colors.text.primary }} className="text-xs font-medium">{currentUser.email}</Text>
                  </View>
                  <View className="flex-row justify-between items-center py-1">
                    <Text style={{ color: colors.text.tertiary }} className="text-xs">User ID</Text>
                    <Text style={{ color: colors.text.primary }} className="text-xs font-mono">{currentUser.id.substring(0, 12)}...</Text>
                  </View>
                  <View className="flex-row justify-between items-center py-1">
                    <Text style={{ color: colors.text.tertiary }} className="text-xs">Business ID</Text>
                    <Text style={{ color: colors.text.primary }} className="text-xs font-mono">{businessId?.substring(0, 20)}...</Text>
                  </View>
                  <View className="flex-row justify-between items-center py-1">
                    <Text style={{ color: colors.text.tertiary }} className="text-xs">Role</Text>
                    <Text style={{ color: colors.text.primary }} className="text-xs font-medium capitalize">{currentUser.role}</Text>
                  </View>
                </View>
                <View className="mt-3 pt-3" style={{ borderTopWidth: 1, borderTopColor: colors.border.light }}>
                  <Text style={{ color: colors.accent.primary }} className="text-xs font-semibold text-center">
                    Tap to see full details
                  </Text>
                </View>
              </Pressable>

              <SectionCard
                title="My Account"
                description="Update profile and password"
                icon={<UserCircle size={24} color="#3B82F6" strokeWidth={1.5} />}
                iconColor="#3B82F6"
                onPress={() => router.push('/account-settings')}
              />
            </>
          )}

          {/* Theme Toggle */}
          <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase mb-3 tracking-wider">Appearance</Text>

          <View className="rounded-xl p-4 mb-4" style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View
                  className="w-12 h-12 rounded-xl items-center justify-center mr-3"
                  style={{ backgroundColor: themeMode === 'dark' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)' }}
                >
                  {themeMode === 'dark' ? (
                    <Moon size={24} color="#8B5CF6" strokeWidth={1.5} />
                  ) : (
                    <Sun size={24} color="#F59E0B" strokeWidth={1.5} />
                  )}
                </View>
                <View>
                  <Text style={{ color: colors.text.primary }} className="font-bold text-base">
                    {themeMode === 'dark' ? 'Dark Mode' : 'Light Mode'}
                  </Text>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs">
                    {themeMode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                  </Text>
                </View>
              </View>
              <Switch
                value={themeMode === 'dark'}
                onValueChange={(value) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setThemeMode(value ? 'dark' : 'light');
                }}
                trackColor={{ false: '#E5E5E5', true: '#8B5CF6' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* Business Settings */}
          <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase mb-3 tracking-wider">Business</Text>

          <SectionCard
            title="Business Settings"
            description="Name, logo, and branding"
            icon={<Building2 size={24} color="#10B981" strokeWidth={1.5} />}
            iconColor="#10B981"
            onPress={() => router.push('/business-settings')}
          />

          {/* Team Management (Admin Only) */}
          {currentUser?.role === 'admin' && (
            <>
              <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase mb-3 tracking-wider">Team</Text>
              <SectionCard
                title="Team Members"
                description="Manage users and permissions"
                icon={<Shield size={24} color="#EF4444" strokeWidth={1.5} />}
                iconColor="#EF4444"
                count={teamMembers.length}
                onPress={() => router.push('/team')}
              />
            </>
          )}

          {/* CRM */}
          <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase mb-3 tracking-wider">Customer Management</Text>

          <SectionCard
            title="Customers"
            description="Manage your customer database"
            icon={<Users size={24} color="#10B981" strokeWidth={1.5} />}
            iconColor="#10B981"
            count={customers.length}
            onPress={() => router.push('/customers')}
          />

          <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase mt-4 mb-3 tracking-wider">Orders & Sales</Text>

          <SectionCard
            title="Order Statuses"
            description="Customize order workflow stages"
            icon={<ShoppingCart size={24} color="#F59E0B" strokeWidth={1.5} />}
            iconColor="#F59E0B"
            count={orderStatuses.length}
            onPress={() => setActiveSection('order-statuses')}
          />

          <SectionCard
            title="Sale Sources"
            description="Track where orders come from"
            icon={<Tag size={24} color="#059669" strokeWidth={1.5} />}
            iconColor="#059669"
            count={saleSources.length}
            onPress={() => setActiveSection('sale-sources')}
          />

          <SectionCard
            title="Payment Methods"
            description="Bank transfer, POS, website, cash"
            icon={<CreditCard size={24} color="#3B82F6" strokeWidth={1.5} />}
            iconColor="#3B82F6"
            count={paymentMethods.length}
            onPress={() => setActiveSection('payment-methods')}
          />

          <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase mt-4 mb-3 tracking-wider">Services & Logistics</Text>

          <SectionCard
            title="Custom Services"
            description="Lens coating, express delivery, etc."
            icon={<Wrench size={24} color="#8B5CF6" strokeWidth={1.5} />}
            iconColor="#8B5CF6"
            count={customServices.length}
            onPress={() => setActiveSection('custom-services')}
          />

          <SectionCard
            title="Logistics Carriers"
            description="GIG, DHL, Kwik, and more"
            icon={<Truck size={24} color="#F59E0B" strokeWidth={1.5} />}
            iconColor="#F59E0B"
            count={logisticsCarriers.length}
            onPress={() => setActiveSection('logistics-carriers')}
          />

          <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase mt-4 mb-3 tracking-wider">Inventory</Text>

          {/* Global Low Stock Threshold */}
          <View className="rounded-xl p-4 mb-3" style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <View
                  className="w-12 h-12 rounded-xl items-center justify-center mr-3"
                  style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)' }}
                >
                  <AlertTriangle size={24} color="#F59E0B" strokeWidth={1.5} />
                </View>
                <View className="flex-1 mr-3">
                  <Text style={{ color: colors.text.primary }} className="font-bold text-base">Global Low Stock Alert</Text>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs">Apply same threshold to all products</Text>
                </View>
              </View>
              <Switch
                value={useGlobalLowStockThreshold}
                onValueChange={(value) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setUseGlobalLowStockThreshold(value);
                }}
                trackColor={{ false: '#767577', true: '#F59E0B' }}
                thumbColor="#FFFFFF"
              />
            </View>
            {useGlobalLowStockThreshold && (
              <View className="mt-4 pt-4" style={{ borderTopWidth: 1, borderTopColor: colors.border.light }}>
                <Text style={{ color: colors.text.tertiary }} className="text-xs font-medium mb-2">Alert when stock falls below:</Text>
                <View className="flex-row items-center">
                  <View
                    className="flex-1 rounded-xl px-4 mr-3"
                    style={{
                      backgroundColor: colors.input.bg,
                      borderWidth: 1,
                      borderColor: colors.input.border,
                      height: 50,
                      justifyContent: 'center'
                    }}
                  >
                    <TextInput
                      value={tempThreshold}
                      onChangeText={setTempThreshold}
                      onBlur={() => {
                        const val = parseInt(tempThreshold, 10);
                        if (!isNaN(val) && val >= 0) {
                          setGlobalLowStockThreshold(val);
                        } else {
                          setTempThreshold(globalLowStockThreshold.toString());
                        }
                      }}
                      keyboardType="number-pad"
                      style={{ color: colors.input.text, fontSize: 16, fontWeight: '600' }}
                      placeholderTextColor={colors.input.placeholder}
                      selectionColor={colors.text.primary}
                    />
                  </View>
                  <Text style={{ color: colors.text.tertiary }} className="text-sm">units</Text>
                </View>
                <Text style={{ color: colors.text.muted }} className="text-xs mt-2">
                  This overrides individual product thresholds
                </Text>
              </View>
            )}
          </View>

          <SectionCard
            title="Categories"
            description="Manage product categories"
            icon={<Tag size={24} color="#3B82F6" strokeWidth={1.5} />}
            iconColor="#3B82F6"
            count={categories.length}
            onPress={() => router.push('/category-manager')}
          />

          <SectionCard
            title="Product Variables"
            description="Define product attributes (Color, Size)"
            icon={<Package size={24} color="#A855F7" strokeWidth={1.5} />}
            iconColor="#A855F7"
            count={productVariables.length}
            onPress={() => router.push('/product-variables')}
          />

          <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase mt-6 mb-3 tracking-wider">App</Text>

          <View className="rounded-xl p-4" style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
            <View className="flex-row items-center">
              <View className="w-12 h-12 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)' }}>
                <Info size={24} color="#3B82F6" strokeWidth={1.5} />
              </View>
              <View className="flex-1">
                <Text style={{ color: colors.text.primary }} className="font-bold text-base">Fyll ERP</Text>
                <Text style={{ color: colors.text.tertiary }} className="text-xs">Version 1.0.0</Text>
              </View>
            </View>
          </View>

          <Pressable
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              Alert.alert(
                'Reset Data',
                'This will reset all data to the initial demo. This action cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Reset',
                    style: 'destructive',
                    onPress: () => {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      resetStore();
                    }
                  },
                ]
              );
            }}
            className="mt-4 rounded-xl active:opacity-80"
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', height: 50, justifyContent: 'center' }}
          >
            <View className="flex-row items-center justify-center">
              <RotateCcw size={18} color="#EF4444" strokeWidth={2} />
              <Text className="text-red-500 font-semibold ml-2">Reset to Demo Data</Text>
            </View>
          </Pressable>

          {/* Logout Button */}
          {currentUser && (
            <Pressable
              onPress={handleLogout}
              className="mt-3 rounded-xl active:opacity-80"
              style={{ backgroundColor: colors.bg.secondary, height: 50, justifyContent: 'center' }}
            >
              <View className="flex-row items-center justify-center">
                <LogOut size={18} color={colors.text.tertiary} strokeWidth={2} />
                <Text style={{ color: colors.text.tertiary }} className="font-semibold ml-2">Log Out</Text>
              </View>
            </Pressable>
          )}

          <View className="h-24" />
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </View>
  );
}
