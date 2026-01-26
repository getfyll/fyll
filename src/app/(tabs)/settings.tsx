import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, TextInput, Alert, Switch, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Trash2, Edit2, Check, X, ChevronRight, ChevronLeft, Package, ShoppingCart, Tag, RotateCcw, Info, CreditCard, Truck, Wrench, Users, Moon, Sun, LogOut, Shield, Building2, AlertTriangle, UserCircle, Upload, FileText } from 'lucide-react-native';
import useFyllStore, { formatCurrency } from '@/lib/state/fyll-store';
import useAuthStore from '@/lib/state/auth-store';
import { useThemeColors } from '@/lib/theme';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import * as Haptics from 'expo-haptics';

type SettingsSection =
  | 'order-statuses'
  | 'sale-sources'
  | 'custom-services'
  | 'payment-methods'
  | 'logistics-carriers'
  | 'case-statuses'
  | 'resolution-types';

const SETTINGS_SECTIONS: SettingsSection[] = [
  'order-statuses',
  'sale-sources',
  'custom-services',
  'payment-methods',
  'logistics-carriers',
  'case-statuses',
  'resolution-types',
];

interface EditableItemProps {
  item: { id: string; name: string; color?: string; defaultPrice?: number; description?: string };
  onUpdate: (name: string, color?: string, defaultPrice?: number, description?: string) => void;
  onDelete: () => void;
  showColor?: boolean;
  showPrice?: boolean;
  showDescription?: boolean;
}

function EditableItem({
  item,
  onUpdate,
  onDelete,
  showColor = false,
  showPrice = false,
  showDescription = false,
}: EditableItemProps) {
  const colors = useThemeColors();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editColor, setEditColor] = useState(item.color || '#6B7280');
  const [editPrice, setEditPrice] = useState(item.defaultPrice?.toString() || '0');
  const [editDescription, setEditDescription] = useState(item.description || '');

  const colorOptions = [
    '#EF4444',
    '#F97316',
    '#F59E0B',
    '#EAB308',
    '#84CC16',
    '#22C55E',
    '#14B8A6',
    '#06B6D4',
    '#3B82F6',
    '#6366F1',
    '#8B5CF6',
    '#EC4899',
    '#F43F5E',
    '#6B7280',
  ];

  const handleSave = () => {
    if (editName.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onUpdate(
        editName.trim(),
        showColor ? editColor : undefined,
        showPrice ? parseFloat(editPrice) || 0 : undefined,
        showDescription ? editDescription.trim() : undefined,
      );
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
            {showDescription && (
              <View className="rounded-xl px-4 mb-3" style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, minHeight: 50, justifyContent: 'center' }}>
                <TextInput
                  value={editDescription}
                  onChangeText={setEditDescription}
                  style={{ color: colors.input.text, fontSize: 14 }}
                  placeholder="Description"
                  placeholderTextColor={colors.input.placeholder}
                  selectionColor={colors.text.primary}
                />
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
                  setEditDescription(item.description || '');
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
              {showDescription && item.description ? (
                <Text style={{ color: colors.text.tertiary }} className="text-[11px]">
                  {item.description}
                </Text>
              ) : null}
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

interface SettingsRowProps {
  title: string;
  description?: string;
  icon: React.ReactNode;
  rightText?: string;
  onPress?: () => void;
  showChevron?: boolean;
  rightElement?: React.ReactNode;
}

function SettingsRow({
  title,
  description,
  icon,
  rightText,
  onPress,
  showChevron = true,
  rightElement,
}: SettingsRowProps) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={() => {
        if (onPress) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }
      }}
      className="active:opacity-80"
      disabled={!onPress}
    >
      <View
        className="flex-row items-center px-4 py-3"
        style={{
          backgroundColor: colors.bg.card,
          borderWidth: 1,
          borderColor: colors.border.light,
          borderRadius: 14,
        }}
      >
        <View
          className="w-9 h-9 rounded-lg items-center justify-center mr-3"
          style={{ backgroundColor: colors.bg.secondary }}
        >
          {icon}
        </View>
        <View className="flex-1">
          <Text style={{ color: colors.text.primary }} className="font-semibold text-sm">
            {title}
          </Text>
          {description ? (
            <Text style={{ color: colors.text.tertiary }} className="text-[11px] mt-0.5">
              {description}
            </Text>
          ) : null}
        </View>
        {rightText ? (
          <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold mr-2">
            {rightText}
          </Text>
        ) : null}
        {rightElement ? rightElement : null}
        {showChevron && onPress ? <ChevronRight size={18} color={colors.text.muted} strokeWidth={2} /> : null}
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { section: sectionParam } = useLocalSearchParams<{ section?: SettingsSection }>();
  const colors = useThemeColors();
  const tabBarHeight = useBottomTabBarHeight();
  const orderStatuses = useFyllStore((s) => s.orderStatuses);
  const saleSources = useFyllStore((s) => s.saleSources);
  const productVariables = useFyllStore((s) => s.productVariables);
  const categories = useFyllStore((s) => s.categories);
  const customServices = useFyllStore((s) => s.customServices);
  const paymentMethods = useFyllStore((s) => s.paymentMethods);
  const logisticsCarriers = useFyllStore((s) => s.logisticsCarriers);
  const caseStatuses = useFyllStore((s) => s.caseStatuses);
  const saveGlobalSettings = useFyllStore((s) => s.saveGlobalSettings);
  const customers = useFyllStore((s) => s.customers);
  const themeMode = useFyllStore((s) => s.themeMode);
  const setThemeMode = useFyllStore((s) => s.setThemeMode);
  const businessId = useAuthStore((s) => s.businessId);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [sectionSaveStatus, setSectionSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [pendingDeleteSetting, setPendingDeleteSetting] = useState<{
    id: string;
    name: string;
    type: SettingsSection;
  } | null>(null);

  // Global Low Stock Threshold
  const useGlobalLowStockThreshold = useFyllStore((s) => s.useGlobalLowStockThreshold);
  const globalLowStockThreshold = useFyllStore((s) => s.globalLowStockThreshold);
  const setUseGlobalLowStockThreshold = useFyllStore((s) => s.setUseGlobalLowStockThreshold);
  const setGlobalLowStockThreshold = useFyllStore((s) => s.setGlobalLowStockThreshold);
  const [tempThreshold, setTempThreshold] = useState(globalLowStockThreshold.toString());
  const [showLowStockModal, setShowLowStockModal] = useState(false);

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
  const addCaseStatus = useFyllStore((s) => s.addCaseStatus);
  const updateCaseStatus = useFyllStore((s) => s.updateCaseStatus);
  const deleteCaseStatus = useFyllStore((s) => s.deleteCaseStatus);

  const resolutionTypes = useFyllStore((s) => s.resolutionTypes);
  const addResolutionType = useFyllStore((s) => s.addResolutionType);
  const updateResolutionType = useFyllStore((s) => s.updateResolutionType);
  const deleteResolutionType = useFyllStore((s) => s.deleteResolutionType);

  const openDeleteSetting = (type: SettingsSection, setting: { id: string; name: string }) => {
    if (Platform.OS === 'web') {
      const active = typeof document !== 'undefined' ? document.activeElement : null;
      if (active instanceof HTMLElement) {
        active.blur();
      }
    }
    setPendingDeleteSetting({ id: setting.id, name: setting.name, type });
  };

  const confirmDeleteSetting = () => {
    if (!pendingDeleteSetting) return;
    switch (pendingDeleteSetting.type) {
      case 'order-statuses':
        deleteOrderStatus(pendingDeleteSetting.id, businessId);
        break;
      case 'case-statuses':
        deleteCaseStatus(pendingDeleteSetting.id, businessId);
        break;
      case 'sale-sources':
        deleteSaleSource(pendingDeleteSetting.id, businessId);
        break;
      case 'custom-services':
        deleteCustomService(pendingDeleteSetting.id, businessId);
        break;
      case 'payment-methods':
        deletePaymentMethod(pendingDeleteSetting.id, businessId);
        break;
      case 'logistics-carriers':
        deleteLogisticsCarrier(pendingDeleteSetting.id, businessId);
        break;
      case 'resolution-types':
        deleteResolutionType(pendingDeleteSetting.id, businessId);
        break;
      default:
        break;
    }
    triggerGlobalSave();
    setPendingDeleteSetting(null);
  };

  const renderDeleteSettingModal = () => (
    <Modal
      visible={!!pendingDeleteSetting}
      animationType="fade"
      transparent
      onRequestClose={() => setPendingDeleteSetting(null)}
    >
      <Pressable
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
        onPress={() => setPendingDeleteSetting(null)}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="w-[90%] rounded-2xl overflow-hidden"
          style={{ backgroundColor: colors.bg.primary, maxWidth: 360 }}
        >
          <View className="px-5 py-4" style={{ borderBottomWidth: 1, borderBottomColor: colors.border.light }}>
            <Text style={{ color: colors.text.primary }} className="font-bold text-lg">Delete Item</Text>
            <Text style={{ color: colors.text.tertiary }} className="text-sm mt-1">
              {pendingDeleteSetting ? `Delete ${pendingDeleteSetting.name}?` : 'Delete this item?'}
            </Text>
          </View>
          <View className="px-5 py-4 flex-row gap-3">
            <Pressable
              onPress={() => setPendingDeleteSetting(null)}
              className="flex-1 rounded-xl items-center"
              style={{ backgroundColor: colors.bg.secondary, height: 48, justifyContent: 'center' }}
            >
              <Text style={{ color: colors.text.tertiary }} className="font-medium">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={confirmDeleteSetting}
              className="flex-1 rounded-xl items-center"
              style={{ backgroundColor: '#EF4444', height: 48, justifyContent: 'center' }}
            >
              <Text className="text-white font-semibold">Delete</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  // Auth
  const currentUser = useAuthStore((s) => s.currentUser);

  const handleSaveGlobalSettings = async () => {
    if (!businessId) {
      setSaveStatus('error');
      setSaveMessage('No business selected.');
      return;
    }

    setSaveStatus('saving');
    setSaveMessage(null);
    const result = await saveGlobalSettings(businessId);
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaveStatus('success');
      setSaveMessage('Saved for all devices.');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setSaveStatus('error');
      setSaveMessage(result.error ?? 'Save failed.');
    }

    setTimeout(() => {
      setSaveStatus('idle');
    }, 2500);
  };

  const handleSectionSave = async () => {
    if (!businessId) {
      setSectionSaveStatus('error');
      return;
    }

    setSectionSaveStatus('saving');
    const result = await saveGlobalSettings(businessId);
    setSectionSaveStatus(result.success ? 'success' : 'error');

    setTimeout(() => {
      setSectionSaveStatus('idle');
    }, 2000);
  };

  const triggerGlobalSave = () => {
    if (!businessId) return;
    void saveGlobalSettings(businessId).then((result) => {
      if (result.success) {
        setSaveStatus('success');
        setSaveMessage('Saved for all devices.');
      } else {
        setSaveStatus('error');
        setSaveMessage(result.error ?? 'Save failed.');
      }

      setTimeout(() => setSaveStatus('idle'), 2000);
    });
  };

  const handleSaveLowStock = () => {
    const parsed = parseInt(tempThreshold, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      setGlobalLowStockThreshold(parsed);
      triggerGlobalSave();
    } else {
      setTempThreshold(globalLowStockThreshold.toString());
    }
    setShowLowStockModal(false);
  };
  const teamMembers = useAuthStore((s) => s.teamMembers);
  const logout = useAuthStore((s) => s.logout);

  const [activeSection, setActiveSection] = useState<SettingsSection | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemColor, setNewItemColor] = useState('#3B82F6');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');

  const colorOptions = [
    '#EF4444',
    '#F97316',
    '#F59E0B',
    '#EAB308',
    '#84CC16',
    '#22C55E',
    '#14B8A6',
    '#06B6D4',
    '#3B82F6',
    '#6366F1',
    '#8B5CF6',
    '#EC4899',
    '#F43F5E',
    '#6B7280',
  ];

  useEffect(() => {
    if (
      sectionParam &&
      SETTINGS_SECTIONS.includes(sectionParam) &&
      sectionParam !== activeSection
    ) {
      setActiveSection(sectionParam);
    }
  }, [sectionParam, activeSection]);

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
    const trimmedName = newItemName.trim();
    if (!trimmedName) return;

    const nameExists = (items: Array<{ name: string }>) =>
      items.some((item) => item.name.trim().toLowerCase() === trimmedName.toLowerCase());

    const id = Math.random().toString(36).substring(2, 15);
    let didAdd = false;

      switch (activeSection) {
        case 'order-statuses':
          if (nameExists(orderStatuses)) {
            Alert.alert('Duplicate', 'This status already exists.');
            return;
          }
          addOrderStatus({ id, name: newItemName.trim(), color: newItemColor, order: orderStatuses.length + 1 });
          didAdd = true;
          break;
        case 'case-statuses':
          if (nameExists(caseStatuses)) {
            Alert.alert('Duplicate', 'This case status already exists.');
            return;
          }
          addCaseStatus({
            id,
            name: newItemName.trim(),
            color: newItemColor,
            description: newItemDescription.trim(),
            order: caseStatuses.length + 1,
          });
          didAdd = true;
          setNewItemDescription('');
          break;
        case 'sale-sources':
        if (nameExists(saleSources)) {
          Alert.alert('Duplicate', 'This sale source already exists.');
          return;
        }
        addSaleSource({ id, name: newItemName.trim(), icon: 'circle' });
        didAdd = true;
        break;
      case 'custom-services':
        if (nameExists(customServices)) {
          Alert.alert('Duplicate', 'This custom service already exists.');
          return;
        }
        addCustomService({ id, name: newItemName.trim(), defaultPrice: parseFloat(newItemPrice) || 0 });
        didAdd = true;
        break;
      case 'payment-methods':
        if (nameExists(paymentMethods)) {
          Alert.alert('Duplicate', 'This payment method already exists.');
          return;
        }
        addPaymentMethod({ id, name: newItemName.trim() });
        didAdd = true;
        break;
      case 'logistics-carriers':
        if (nameExists(logisticsCarriers)) {
          Alert.alert('Duplicate', 'This logistics carrier already exists.');
          return;
        }
        addLogisticsCarrier({ id, name: newItemName.trim() });
        didAdd = true;
        break;
      case 'resolution-types':
        if (nameExists(resolutionTypes)) {
          Alert.alert('Duplicate', 'This resolution type already exists.');
          return;
        }
        addResolutionType({
          id,
          name: newItemName.trim(),
          description: newItemDescription.trim(),
          order: resolutionTypes.length + 1,
        });
        didAdd = true;
        setNewItemDescription('');
        break;
    }

    if (!didAdd) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    triggerGlobalSave();
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
                onUpdate={(name, color) => {
                  updateOrderStatus(status.id, { name, color });
                  triggerGlobalSave();
                }}
                onDelete={() => {
                  openDeleteSetting('order-statuses', status);
                }}
              />
            ))}
          </View>
        );

      case 'case-statuses':
        return (
          <View className="px-5 pt-4">
            <View className="rounded-xl p-4 mb-4" style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
              <Text style={{ color: colors.text.primary }} className="font-bold text-sm mb-3">Add Case Status</Text>
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
              <View className="rounded-xl px-4 mb-3" style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, minHeight: 50, justifyContent: 'center' }}>
                <TextInput
                  placeholder="Description (optional)"
                  placeholderTextColor={colors.input.placeholder}
                  value={newItemDescription}
                  onChangeText={setNewItemDescription}
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

            {caseStatuses.map((status) => (
              <EditableItem
                key={status.id}
                item={status}
                showColor
                showDescription
                onUpdate={(name, color, _, description) => {
                  updateCaseStatus(status.id, { name, color, description });
                  triggerGlobalSave();
                }}
                onDelete={() => {
                  openDeleteSetting('case-statuses', status);
                }}
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
                onUpdate={(name) => {
                  updateSaleSource(source.id, { name });
                  triggerGlobalSave();
                }}
                onDelete={() => {
                  openDeleteSetting('sale-sources', source);
                }}
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
                onUpdate={(name, _, defaultPrice) => {
                  updateCustomService(service.id, { name, defaultPrice });
                  triggerGlobalSave();
                }}
                onDelete={() => {
                  openDeleteSetting('custom-services', service);
                }}
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
                onUpdate={(name) => {
                  updatePaymentMethod(method.id, { name });
                  triggerGlobalSave();
                }}
                onDelete={() => {
                  openDeleteSetting('payment-methods', method);
                }}
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
                onUpdate={(name) => {
                  updateLogisticsCarrier(carrier.id, { name });
                  triggerGlobalSave();
                }}
                onDelete={() => {
                  openDeleteSetting('logistics-carriers', carrier);
                }}
              />
            ))}
          </View>
        );

      case 'resolution-types':
        return (
          <View className="px-5 pt-4">
            <View className="rounded-xl p-4 mb-4" style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
              <Text style={{ color: colors.text.primary }} className="font-bold text-sm mb-3">Add Resolution Type</Text>
              <View className="rounded-xl px-4 mb-3" style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 50, justifyContent: 'center' }}>
                <TextInput
                  placeholder="Resolution type name"
                  placeholderTextColor={colors.input.placeholder}
                  value={newItemName}
                  onChangeText={setNewItemName}
                  style={{ color: colors.input.text, fontSize: 14 }}
                  selectionColor={colors.text.primary}
                />
              </View>
              <View className="rounded-xl px-4 mb-3" style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, minHeight: 50, justifyContent: 'center' }}>
                <TextInput
                  placeholder="Description (optional)"
                  placeholderTextColor={colors.input.placeholder}
                  value={newItemDescription}
                  onChangeText={setNewItemDescription}
                  style={{ color: colors.input.text, fontSize: 14 }}
                  selectionColor={colors.text.primary}
                />
              </View>
              <Pressable
                onPress={handleAddItem}
                className="rounded-xl items-center active:opacity-80"
                style={{ backgroundColor: '#111111', height: 50, justifyContent: 'center' }}
              >
                <Text className="text-white font-semibold">Add Resolution Type</Text>
              </Pressable>
            </View>

            {resolutionTypes.map((type) => (
              <EditableItem
                key={type.id}
                item={type}
                showDescription
                onUpdate={(name, _, __, description) => {
                  updateResolutionType(type.id, { name, description });
                  triggerGlobalSave();
                }}
                onDelete={() => {
                  openDeleteSetting('resolution-types', type);
                }}
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
      'case-statuses': 'Case Statuses',
      'resolution-types': 'Resolution Types',
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
            <View className="flex-1">
              <Text style={{ color: colors.text.primary }} className="text-xl font-bold">{titles[activeSection]}</Text>
              {sectionSaveStatus === 'success' && (
                <Text style={{ color: colors.text.tertiary }} className="text-xs mt-1">Saved</Text>
              )}
              {sectionSaveStatus === 'error' && (
                <Text style={{ color: '#EF4444' }} className="text-xs mt-1">Save failed</Text>
              )}
            </View>
            <Pressable
              onPress={handleSectionSave}
              className="px-4 rounded-xl items-center justify-center active:opacity-80"
              style={{ backgroundColor: '#111111', height: 42, minWidth: 104 }}
            >
              <Text className="text-white text-sm font-semibold">
                {sectionSaveStatus === 'saving' ? 'Saving…' : 'Save'}
              </Text>
            </Pressable>
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

        {renderDeleteSettingModal()}
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="px-5 pt-6 pb-3" style={{ borderBottomWidth: 1, borderBottomColor: colors.border.light }}>
          <Text style={{ color: colors.text.tertiary }} className="text-xs font-medium uppercase tracking-wider">Menu</Text>
          <Text style={{ color: colors.text.primary }} className="text-2xl font-bold">More</Text>
        </View>

        <KeyboardAwareScrollView
          className="flex-1 px-5 pt-4"
          showsVerticalScrollIndicator={false}
          enableOnAndroid
          extraScrollHeight={100}
          contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
        >
          {currentUser && (
            <>
              <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase mb-3 tracking-wider">Account</Text>
              <View className="gap-2">
                <SettingsRow
                  title="Account Info"
                  description="Email, role, business details"
                  icon={<Info size={18} color={colors.text.tertiary} strokeWidth={2} />}
                  onPress={() => router.push('/debug-business')}
                />
                <SettingsRow
                  title="My Account"
                  description="Profile and password"
                  icon={<UserCircle size={18} color="#3B82F6" strokeWidth={2} />}
                  onPress={() => router.push('/account-settings')}
                />
              </View>
            </>
          )}

          <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase mt-4 mb-3 tracking-wider">Business</Text>
          <SettingsRow
            title="Business Settings"
            description="Name, logo, branding"
            icon={<Building2 size={18} color="#10B981" strokeWidth={2} />}
            onPress={() => router.push('/business-settings')}
          />

          {currentUser?.role === 'admin' && (
            <>
              <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase mt-4 mb-3 tracking-wider">Team</Text>
              <SettingsRow
                title="Team Members"
                description="Roles and permissions"
                icon={<Shield size={18} color="#EF4444" strokeWidth={2} />}
                rightText={`${teamMembers.length}`}
                onPress={() => router.push('/team')}
              />
            </>
          )}

          <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase mt-4 mb-3 tracking-wider">Customers</Text>
          <SettingsRow
            title="Customer List"
            description="Contacts and history"
            icon={<Users size={18} color="#10B981" strokeWidth={2} />}
            rightText={`${customers.length}`}
            onPress={() => router.push('/customers')}
          />

          <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase mt-4 mb-3 tracking-wider">Orders & Sales</Text>
          <View className="gap-2">
            <SettingsRow
              title="Order Statuses"
              description="Workflow stages"
              icon={<ShoppingCart size={18} color="#F59E0B" strokeWidth={2} />}
              rightText={`${orderStatuses.length}`}
              onPress={() => setActiveSection('order-statuses')}
            />
            <SettingsRow
              title="Sale Sources"
              description="Where orders come from"
              icon={<Tag size={18} color="#059669" strokeWidth={2} />}
              rightText={`${saleSources.length}`}
              onPress={() => setActiveSection('sale-sources')}
            />
            <SettingsRow
              title="Payment Methods"
              description="Bank transfer, POS, website"
              icon={<CreditCard size={18} color="#3B82F6" strokeWidth={2} />}
              rightText={`${paymentMethods.length}`}
              onPress={() => setActiveSection('payment-methods')}
            />
          </View>

          <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase mt-4 mb-3 tracking-wider">Operations</Text>
          <View className="gap-2">
            <SettingsRow
              title="Cases"
              description="Post-order issues"
              icon={<FileText size={18} color="#8B5CF6" strokeWidth={2} />}
              onPress={() => router.push('/cases')}
            />
            <SettingsRow
              title="Case Statuses"
              description="Customize workflow stages"
              icon={<FileText size={18} color="#F59E0B" strokeWidth={2} />}
              rightText={`${caseStatuses.length}`}
              onPress={() => setActiveSection('case-statuses')}
            />
            <SettingsRow
              title="Resolution Types"
              description="How cases are resolved"
              icon={<Check size={18} color="#10B981" strokeWidth={2} />}
              rightText={`${resolutionTypes.length}`}
              onPress={() => setActiveSection('resolution-types')}
            />
          </View>

          <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase mt-4 mb-3 tracking-wider">Services & Logistics</Text>
          <View className="gap-2">
            <SettingsRow
              title="Custom Services"
              description="Lens coating, express delivery"
              icon={<Wrench size={18} color="#8B5CF6" strokeWidth={2} />}
              rightText={`${customServices.length}`}
              onPress={() => setActiveSection('custom-services')}
            />
            <SettingsRow
              title="Logistics Carriers"
              description="Delivery partners"
              icon={<Truck size={18} color="#F59E0B" strokeWidth={2} />}
              rightText={`${logisticsCarriers.length}`}
              onPress={() => setActiveSection('logistics-carriers')}
            />
          </View>

          <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase mt-4 mb-3 tracking-wider">Inventory</Text>
          <View className="gap-2">
            <SettingsRow
              title="Low Stock Alert"
              description={useGlobalLowStockThreshold
                ? `On • ${globalLowStockThreshold} units`
                : 'Off • Tap to configure'}
              icon={<AlertTriangle size={18} color="#F59E0B" strokeWidth={2} />}
              onPress={() => {
                setTempThreshold(globalLowStockThreshold.toString());
                setShowLowStockModal(true);
              }}
            />
            <SettingsRow
              title="Categories"
              description="Product groups"
              icon={<Tag size={18} color="#3B82F6" strokeWidth={2} />}
              rightText={`${categories.length}`}
              onPress={() => router.push('/category-manager')}
            />
            <SettingsRow
              title="Product Variables"
              description="Color, size, material"
              icon={<Package size={18} color="#A855F7" strokeWidth={2} />}
              rightText={`${productVariables.length}`}
              onPress={() => router.push('/product-variables')}
            />
            <SettingsRow
              title="Import Products"
              description="Upload CSV"
              icon={<Upload size={18} color="#10B981" strokeWidth={2} />}
              onPress={() => router.push('/import-products')}
            />
          </View>

          <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase mt-4 mb-3 tracking-wider">Appearance</Text>
          <SettingsRow
            title={themeMode === 'dark' ? 'Dark Mode' : 'Light Mode'}
            description={themeMode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            icon={
              themeMode === 'dark'
                ? <Moon size={18} color="#8B5CF6" strokeWidth={2} />
                : <Sun size={18} color="#F59E0B" strokeWidth={2} />
            }
            showChevron={false}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setThemeMode(themeMode === 'dark' ? 'light' : 'dark');
            }}
            rightElement={
              <Switch
                value={themeMode === 'dark'}
                onValueChange={(value) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setThemeMode(value ? 'dark' : 'light');
                }}
                trackColor={{ false: '#E5E5E5', true: '#8B5CF6' }}
                thumbColor="#FFFFFF"
              />
            }
          />

          <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase mt-4 mb-3 tracking-wider">Sync</Text>
          <SettingsRow
            title="Save Global Settings"
            description="Sync across devices"
            icon={<Upload size={18} color="#10B981" strokeWidth={2} />}
            showChevron={false}
            rightElement={
              <Pressable
                onPress={handleSaveGlobalSettings}
                disabled={saveStatus === 'saving'}
                className="rounded-xl px-3 items-center justify-center active:opacity-80"
                style={{ backgroundColor: '#111111', height: 36, minWidth: 80 }}
              >
                <Text className="text-white font-semibold text-xs">
                  {saveStatus === 'saving' ? 'Saving…' : 'Save'}
                </Text>
              </Pressable>
            }
          />
          {saveMessage && (
            <Text
              style={{ color: saveStatus === 'error' ? '#EF4444' : colors.text.tertiary }}
              className="text-xs mt-2"
            >
              {saveMessage}
            </Text>
          )}

          <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase mt-4 mb-3 tracking-wider">App</Text>
          <View className="gap-2">
            <SettingsRow
              title="Fyll ERP"
              description="Version 1.0.0"
              icon={<Info size={18} color="#3B82F6" strokeWidth={2} />}
              showChevron={false}
            />
            <SettingsRow
              title="Refresh App"
              description="Reload app data"
              icon={<RotateCcw size={18} color={colors.text.tertiary} strokeWidth={2} />}
              onPress={() => {
                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                  window.location.reload();
                  return;
                }
                Alert.alert('Refresh App', 'Close the app and reopen it to refresh on iPhone.');
              }}
            />
            {currentUser && (
              <SettingsRow
                title="Log Out"
                icon={<LogOut size={18} color={colors.text.tertiary} strokeWidth={2} />}
                showChevron={false}
                onPress={handleLogout}
              />
            )}
          </View>

          <View className="h-24" />
        </KeyboardAwareScrollView>

        <Modal
          visible={showLowStockModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowLowStockModal(false)}
        >
          <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}>
            <View className="w-full rounded-2xl p-5" style={{ backgroundColor: colors.bg.primary }}>
              <View className="flex-row items-center justify-between mb-4">
                <Text style={{ color: colors.text.primary }} className="text-lg font-bold">Global Low Stock Alert</Text>
                <Pressable
                  onPress={() => setShowLowStockModal(false)}
                  className="w-9 h-9 rounded-xl items-center justify-center active:opacity-70"
                  style={{ backgroundColor: colors.bg.secondary }}
                >
                  <X size={18} color={colors.text.tertiary} strokeWidth={2} />
                </Pressable>
              </View>

              <View className="flex-row items-center justify-between mb-4">
                <Text style={{ color: colors.text.tertiary }} className="text-sm">Enable global threshold</Text>
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
                <View className="mb-4">
                  <Text style={{ color: colors.text.tertiary }} className="text-xs font-medium mb-2">Alert when stock falls below</Text>
                  <View className="flex-row items-center">
                    <View
                      className="flex-1 rounded-xl px-4 mr-3"
                      style={{
                        backgroundColor: colors.input.bg,
                        borderWidth: 1,
                        borderColor: colors.input.border,
                        height: 50,
                        justifyContent: 'center',
                      }}
                    >
                      <TextInput
                        value={tempThreshold}
                        onChangeText={setTempThreshold}
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

              <Pressable
                onPress={handleSaveLowStock}
                className="rounded-xl items-center justify-center active:opacity-80"
                style={{ backgroundColor: '#111111', height: 48 }}
              >
                <Text className="text-white font-semibold">Save</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </SafeAreaView>

      {renderDeleteSettingModal()}
    </View>
  );
}
