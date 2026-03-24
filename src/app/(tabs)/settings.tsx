import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, TextInput, Alert, Switch, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Trash2, Edit2, Check, X, ChevronRight, ChevronLeft, Package, ShoppingCart, Tag, RotateCcw, Info, CreditCard, Truck, Wrench, Users, Moon, Sun, Laptop, LogOut, Shield, Building2, AlertTriangle, UserCircle, Upload, FileText, BarChart3, TrendingUp, Zap, Search, Sparkles, ListTodo, Bell, BellOff } from 'lucide-react-native';
import { useWebPushNotifications } from '@/hooks/useWebPushNotifications';
import useFyllStore, { formatCurrency, type ThemeMode } from '@/lib/state/fyll-store';
import useAuthStore, { ROLE_PERMISSIONS } from '@/lib/state/auth-store';
import { useResolvedThemeMode, useThemeColors } from '@/lib/theme';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import * as Haptics from 'expo-haptics';
import { useTabBarHeight } from '@/lib/useTabBarHeight';
import { useBreakpoint } from '@/lib/useBreakpoint';
import { canShowFinanceNavigation, getDefaultFinanceSectionForRole } from '@/lib/finance-access';
import { DESKTOP_PAGE_HEADER_GUTTER, DESKTOP_PAGE_HEADER_MIN_HEIGHT, getStandardPageHeadingStyle } from '@/lib/page-heading';

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

let settingsMainScrollYMemory = 0;

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
  const primaryPillButtonStyle = {
    backgroundColor: colors.text.primary,
    borderRadius: 999,
  } as const;
  const primaryPillTextStyle = {
    color: colors.bg.primary,
  } as const;
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
                className="flex-1 rounded-full items-center active:opacity-80"
                style={[primaryPillButtonStyle, { height: 50, justifyContent: 'center' }]}
              >
                <Text style={primaryPillTextStyle} className="font-semibold text-sm">Save</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setEditName(item.name);
                  setEditColor(item.color || '#6B7280');
                  setEditPrice(item.defaultPrice?.toString() || '0');
                  setEditDescription(item.description || '');
                  setIsEditing(false);
                }}
                className="px-4 rounded-full items-center active:opacity-70"
                style={{ backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.light, height: 50, justifyContent: 'center' }}
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
  const tabBarHeight = useTabBarHeight();
  const { isDesktop, isMobile } = useBreakpoint();
  const isWebDesktop = Platform.OS === 'web' && isDesktop;
  const pageHeadingStyle = getStandardPageHeadingStyle(isMobile);
  const desktopHeaderMinHeight = DESKTOP_PAGE_HEADER_MIN_HEIGHT;
  const webDesktopGutterPad = isWebDesktop ? DESKTOP_PAGE_HEADER_GUTTER : 0;
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
  const resolvedThemeMode = useResolvedThemeMode();
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

  const themeOptions: { mode: ThemeMode; label: string }[] = [
    { mode: 'system', label: 'System' },
    { mode: 'light', label: 'Light' },
    { mode: 'dark', label: 'Dark' },
  ];

  const { isReady: notifReady, promptForPermission } = useWebPushNotifications();
  const [notifPermission, setNotifPermission] = useState<string | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const check = () => setNotifPermission(window.Notification?.permission ?? null);
    check();
    window.addEventListener('focus', check);
    return () => window.removeEventListener('focus', check);
  }, []);

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
              className="flex-1 rounded-full items-center"
              style={{ backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.light, height: 48, justifyContent: 'center' }}
            >
              <Text style={{ color: colors.text.tertiary }} className="font-medium">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={confirmDeleteSetting}
              className="flex-1 rounded-full items-center"
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
  const userRole = currentUser?.role ?? 'staff';
  const canViewInsights = ROLE_PERMISSIONS[userRole]?.canViewInsights ?? false;
  const canViewFinance = canShowFinanceNavigation(userRole);
  const financeSettingsRoute = `/finance?section=${getDefaultFinanceSectionForRole(userRole)}&from=settings`;

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

  const handleRefreshApp = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.reload();
      return;
    }
    Alert.alert('Refresh App', 'Close the app and reopen it to refresh on iPhone.');
  };

  const teamMembers = useAuthStore((s) => s.teamMembers);
  const logout = useAuthStore((s) => s.logout);
  const openSettingsPanel = (panel: string, nativeRoute: string | { pathname: string; params?: Record<string, string> }) => {
    const decodeParam = (raw: string) => {
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    };
    const webRouteParams: Record<string, string> = { panel, from: 'settings' };

    if (typeof nativeRoute === 'string') {
      const query = nativeRoute.split('?')[1];
      if (query) {
        query
          .split('&')
          .filter(Boolean)
          .forEach((pair) => {
            const [rawKey, rawValue = ''] = pair.split('=');
            if (!rawKey) return;
            const key = decodeParam(rawKey);
            const value = decodeParam(rawValue);
            if (key.length > 0 && value.length > 0) {
              webRouteParams[key] = value;
            }
          });
      }
    } else if (nativeRoute?.params) {
      Object.entries(nativeRoute.params).forEach(([key, value]) => {
        if (typeof value === 'string' && value.trim().length > 0) {
          webRouteParams[key] = value;
        }
      });
    }

    if (Platform.OS === 'web') {
      router.push({ pathname: '/settings-panel', params: webRouteParams });
      return;
    }
    router.push(nativeRoute as never);
  };

  const [activeSection, setActiveSection] = useState<SettingsSection | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemColor, setNewItemColor] = useState('#3B82F6');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');
  const mainMenuScrollYRef = useRef(settingsMainScrollYMemory);
  const primaryPillButtonStyle = {
    backgroundColor: colors.text.primary,
    borderRadius: 999,
  } as const;
  const primaryPillTextStyle = {
    color: colors.bg.primary,
  } as const;
  const settingsMainContentWrapStyle = ({ flex: 1 } as const);
  const settingsSectionContentWrapStyle = ({ flex: 1 } as const);

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
    } catch {
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

    const nameExists = (items: { name: string }[]) =>
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
          Alert.alert('Duplicate', 'This add-on already exists.');
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
            <View className="pl-5 pr-7 pt-4">
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
                className="rounded-full items-center active:opacity-80"
                style={[primaryPillButtonStyle, { height: 50, justifyContent: 'center' }]}
              >
                <Text style={primaryPillTextStyle} className="font-semibold">Add Status</Text>
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
          <View className="pl-5 pr-7 pt-4">
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
                className="rounded-full items-center active:opacity-80"
                style={[primaryPillButtonStyle, { height: 50, justifyContent: 'center' }]}
              >
                <Text style={primaryPillTextStyle} className="font-semibold">Add Status</Text>
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
          <View className="pl-5 pr-7 pt-4">
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
                className="rounded-full items-center active:opacity-80"
                style={[primaryPillButtonStyle, { height: 50, justifyContent: 'center' }]}
              >
                <Text style={primaryPillTextStyle} className="font-semibold">Add Source</Text>
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
          <View className="pl-5 pr-7 pt-4">
            <View className="rounded-xl p-4 mb-4" style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
              <Text style={{ color: colors.text.primary }} className="font-bold text-sm mb-3">Add New Add-on</Text>
              <View className="rounded-xl px-4 mb-3" style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 50, justifyContent: 'center' }}>
                <TextInput
                  placeholder="Add-on name"
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
                className="rounded-full items-center active:opacity-80"
                style={[primaryPillButtonStyle, { height: 50, justifyContent: 'center' }]}
              >
                <Text style={primaryPillTextStyle} className="font-semibold">Add Add-on</Text>
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
          <View className="pl-5 pr-7 pt-4">
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
                className="rounded-full items-center active:opacity-80"
                style={[primaryPillButtonStyle, { height: 50, justifyContent: 'center' }]}
              >
                <Text style={primaryPillTextStyle} className="font-semibold">Add Payment Method</Text>
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
          <View className="pl-5 pr-7 pt-4">
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
                className="rounded-full items-center active:opacity-80"
                style={[primaryPillButtonStyle, { height: 50, justifyContent: 'center' }]}
              >
                <Text style={primaryPillTextStyle} className="font-semibold">Add Carrier</Text>
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
          <View className="pl-5 pr-7 pt-4">
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
                className="rounded-full items-center active:opacity-80"
                style={[primaryPillButtonStyle, { height: 50, justifyContent: 'center' }]}
              >
                <Text style={primaryPillTextStyle} className="font-semibold">Add Resolution Type</Text>
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

  // All settings items for search
  const searchItems: { id: string; title: string; description?: string; icon: React.ReactNode; onPress?: () => void; rightText?: string }[] = [
    ...(currentUser ? [
      { id: 'account-info', title: 'Account Info', description: 'Email, role, business details', icon: <Info size={18} color={colors.text.tertiary} strokeWidth={2} />, onPress: () => openSettingsPanel('debug-business', '/debug-business?from=settings') },
      { id: 'my-account', title: 'My Account', description: 'Profile and password', icon: <UserCircle size={18} color="#3B82F6" strokeWidth={2} />, onPress: () => openSettingsPanel('account-settings', '/account-settings?from=settings') },
    ] : []),
    { id: 'business-settings', title: 'Business Settings', description: 'Logo, phone, website', icon: <Building2 size={18} color="#10B981" strokeWidth={2} />, onPress: () => openSettingsPanel('business-settings', '/business-settings?from=settings') },
    { id: 'import-ai', title: 'AI Import Assistant', description: 'Import orders, customers, products, and expenses', icon: <Sparkles size={18} color="#8B5CF6" strokeWidth={2} />, onPress: () => openSettingsPanel('import-ai', '/import-ai?from=settings') },
    ...(currentUser?.role === 'admin' ? [
      { id: 'team-members', title: 'Team Members', description: 'Roles and permissions', icon: <Shield size={18} color="#EF4444" strokeWidth={2} />, rightText: `${teamMembers.length}`, onPress: () => openSettingsPanel('team', '/team?from=settings') },
      { id: 'invitations', title: 'Invitations', description: 'VIP access, invite limits, history', icon: <Shield size={18} color="#F59E0B" strokeWidth={2} />, onPress: () => openSettingsPanel('invitations', '/invitations?from=settings') },
    ] : []),
    { id: 'tasks', title: 'Tasks', description: 'Assign work, due dates, recurring ops', icon: <ListTodo size={18} color="#2563EB" strokeWidth={2} />, onPress: () => openSettingsPanel('tasks', '/tasks') },
    { id: 'customer-list', title: 'Customer List', description: 'Contacts and history', icon: <Users size={18} color="#10B981" strokeWidth={2} />, rightText: `${customers.length}`, onPress: () => openSettingsPanel('customers', { pathname: '/customers', params: { from: 'settings' } }) },
    { id: 'import-customers', title: 'Import Customers', description: 'Upload contacts via CSV', icon: <Upload size={18} color="#10B981" strokeWidth={2} />, onPress: () => openSettingsPanel('import-customers', '/import-customers?from=settings') },
    { id: 'order-statuses', title: 'Order Statuses', description: 'Workflow stages', icon: <ShoppingCart size={18} color="#F59E0B" strokeWidth={2} />, rightText: `${orderStatuses.length}`, onPress: () => setActiveSection('order-statuses') },
    { id: 'sale-sources', title: 'Sale Sources', description: 'Where orders come from', icon: <Tag size={18} color="#059669" strokeWidth={2} />, rightText: `${saleSources.length}`, onPress: () => setActiveSection('sale-sources') },
    { id: 'payment-methods', title: 'Payment Methods', description: 'Bank transfer, POS, website', icon: <CreditCard size={18} color="#3B82F6" strokeWidth={2} />, rightText: `${paymentMethods.length}`, onPress: () => setActiveSection('payment-methods') },
    { id: 'order-automation', title: 'Order Automation', description: 'Auto-complete stale orders', icon: <Zap size={18} color="#F59E0B" strokeWidth={2} />, onPress: () => openSettingsPanel('order-automation', '/order-automation?from=settings') },
    { id: 'import-orders', title: 'Import Orders', description: 'Upload orders via CSV', icon: <Upload size={18} color="#10B981" strokeWidth={2} />, onPress: () => openSettingsPanel('import-orders', '/import-orders?from=settings') },
    ...(canViewInsights && currentUser?.role === 'admin' ? [
      { id: 'insights', title: 'Insights Dashboard', description: 'Sales, customers, and trends', icon: <BarChart3 size={18} color="#3B82F6" strokeWidth={2} />, onPress: () => openSettingsPanel('insights', '/insights?from=settings') },
    ] : []),
    ...(canViewFinance ? [
      { id: 'finance', title: 'Finance', description: 'Overview, expenses, procurement, settings', icon: <TrendingUp size={18} color="#10B981" strokeWidth={2} />, onPress: () => openSettingsPanel('finance', financeSettingsRoute) },
    ] : []),
    { id: 'service-catalog', title: 'Service Catalog', description: 'All services and pricing', icon: <Wrench size={18} color={colors.text.secondary} strokeWidth={2} />, onPress: () => openSettingsPanel('services', '/services?from=settings') },
    { id: 'addons', title: 'Add-ons', description: 'Lens coating, express delivery', icon: <Wrench size={18} color="#8B5CF6" strokeWidth={2} />, rightText: `${customServices.length}`, onPress: () => setActiveSection('custom-services') },
    { id: 'all-cases', title: 'All Cases', description: 'View and manage cases', icon: <FileText size={18} color="#8B5CF6" strokeWidth={2} />, onPress: () => openSettingsPanel('cases', '/(tabs)/cases?from=settings') },
    { id: 'case-statuses', title: 'Case Statuses', description: 'Customize workflow stages', icon: <FileText size={18} color="#F59E0B" strokeWidth={2} />, rightText: `${caseStatuses.length}`, onPress: () => setActiveSection('case-statuses') },
    { id: 'resolution-types', title: 'Resolution Types', description: 'How cases are resolved', icon: <Check size={18} color="#10B981" strokeWidth={2} />, rightText: `${resolutionTypes.length}`, onPress: () => setActiveSection('resolution-types') },
    { id: 'logistics-carriers', title: 'Logistics Carriers', description: 'Delivery partners', icon: <Truck size={18} color="#F59E0B" strokeWidth={2} />, rightText: `${logisticsCarriers.length}`, onPress: () => setActiveSection('logistics-carriers') },
    { id: 'low-stock-alert', title: 'Low Stock Alert', description: useGlobalLowStockThreshold ? `On · ${globalLowStockThreshold} units` : 'Off · Tap to configure', icon: <AlertTriangle size={18} color="#F59E0B" strokeWidth={2} />, onPress: () => { setTempThreshold(globalLowStockThreshold.toString()); setShowLowStockModal(true); } },
    { id: 'categories', title: 'Categories', description: 'Product groups', icon: <Tag size={18} color="#3B82F6" strokeWidth={2} />, rightText: `${categories.length}`, onPress: () => openSettingsPanel('category-manager', '/category-manager?from=settings') },
    { id: 'product-variables', title: 'Product Variables', description: 'Color, size, material', icon: <Package size={18} color="#A855F7" strokeWidth={2} />, rightText: `${productVariables.length}`, onPress: () => openSettingsPanel('product-variables', '/product-variables?from=settings') },
    { id: 'import-products', title: 'Import Products', description: 'Upload CSV', icon: <Upload size={18} color="#10B981" strokeWidth={2} />, onPress: () => openSettingsPanel('import-products', '/import-products?from=settings') },
    ...(currentUser ? [
      { id: 'log-out', title: 'Log Out', description: 'Sign out of your account', icon: <LogOut size={18} color={colors.text.tertiary} strokeWidth={2} />, onPress: handleLogout },
    ] : []),
  ];

  const filteredSearchItems = searchQuery.trim()
    ? searchItems.filter(
        (item) =>
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [];

  if (activeSection) {
    const titles: Record<SettingsSection, string> = {
      'order-statuses': 'Order Statuses',
      'sale-sources': 'Sale Sources',
      'custom-services': 'Add-ons',
      'payment-methods': 'Payment Methods',
      'logistics-carriers': 'Logistics Carriers',
      'case-statuses': 'Case Statuses',
      'resolution-types': 'Resolution Types',
    };

    return (
      <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
        <SafeAreaView className="flex-1" edges={isWebDesktop ? [] : ['top']}>
          <View style={settingsSectionContentWrapStyle}>
          <View style={isWebDesktop ? { paddingHorizontal: webDesktopGutterPad, borderBottomWidth: 1, borderBottomColor: colors.border.light } : { borderBottomWidth: 1, borderBottomColor: colors.border.light }}>
            <View
              className={isWebDesktop ? 'px-5 pt-5 pb-4 flex-row items-center' : 'px-5 pt-6 pb-3 flex-row items-center'}
              style={isWebDesktop ? { maxWidth: 1440, width: '100%', alignSelf: 'flex-start', minHeight: desktopHeaderMinHeight } : undefined}
            >
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
                className="px-4 rounded-full items-center justify-center active:opacity-80"
                style={[primaryPillButtonStyle, { height: 42, minWidth: 104 }]}
              >
                <Text style={primaryPillTextStyle} className="text-sm font-semibold">
                  {sectionSaveStatus === 'saving' ? 'Saving…' : 'Save'}
                </Text>
              </Pressable>
            </View>
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
          </View>
        </SafeAreaView>

        {renderDeleteSettingModal()}
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
      <SafeAreaView className="flex-1" edges={isWebDesktop ? [] : ['top']}>
        <View style={settingsMainContentWrapStyle}>
        <View>
          {isWebDesktop ? (
            <View className="px-5 pt-3" style={{ paddingTop: 20 }}>
              <View
                className="flex-row items-start justify-between"
                style={{
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border.light,
                  marginHorizontal: -20,
                  paddingHorizontal: 20,
                  paddingBottom: 10,
                }}
              >
                <View style={{ flex: 1 }}>
                  <View className="flex-row items-start justify-between">
                    <View>
                      <Text style={{ color: colors.text.tertiary }} className="text-xs font-medium uppercase tracking-wider">Menu</Text>
                      <Text style={{ color: colors.text.primary, ...pageHeadingStyle }}>More</Text>
                    </View>
                    <Pressable
                      onPress={handleRefreshApp}
                      className="w-10 h-10 rounded-xl items-center justify-center active:opacity-70"
                      style={{ backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.light }}
                    >
                      <RotateCcw size={16} color={colors.text.primary} strokeWidth={2} />
                    </Pressable>
                  </View>
                  <View className="flex-row items-center mt-2 rounded-full px-3" style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 42, marginBottom: 6 }}>
                    <Search size={15} color={colors.text.muted} strokeWidth={2} />
                    <TextInput
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      placeholder="Search settings…"
                      placeholderTextColor={colors.input.placeholder}
                      style={{ flex: 1, color: colors.input.text, fontSize: 14, marginLeft: 8 }}
                      selectionColor={colors.text.primary}
                      returnKeyType="search"
                      clearButtonMode="while-editing"
                    />
                    {searchQuery ? (
                      <Pressable onPress={() => setSearchQuery('')} className="p-1 active:opacity-70">
                        <X size={14} color={colors.text.muted} strokeWidth={2} />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <View className="px-5 pt-6 pb-3" style={{ borderBottomWidth: 1, borderBottomColor: colors.border.light }}>
              <View className="flex-row items-start justify-between">
                <View>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs font-medium uppercase tracking-wider">Menu</Text>
                  <Text style={{ color: colors.text.primary, ...pageHeadingStyle }}>More</Text>
                </View>
                <Pressable
                  onPress={handleRefreshApp}
                  className="w-10 h-10 rounded-xl items-center justify-center active:opacity-70"
                  style={{ backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.light }}
                >
                  <RotateCcw size={16} color={colors.text.primary} strokeWidth={2} />
                </Pressable>
              </View>
              <View className="flex-row items-center mt-3 rounded-full px-3" style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 42, marginBottom: 6 }}>
                <Search size={15} color={colors.text.muted} strokeWidth={2} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search settings…"
                  placeholderTextColor={colors.input.placeholder}
                  style={{ flex: 1, color: colors.input.text, fontSize: 14, marginLeft: 8 }}
                  selectionColor={colors.text.primary}
                  returnKeyType="search"
                  clearButtonMode="while-editing"
                />
                {searchQuery ? (
                  <Pressable onPress={() => setSearchQuery('')} className="p-1 active:opacity-70">
                    <X size={14} color={colors.text.muted} strokeWidth={2} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          )}
        </View>

        <KeyboardAwareScrollView
          className="flex-1 px-5 pt-4"
          showsVerticalScrollIndicator={false}
          enableOnAndroid
          extraScrollHeight={100}
          contentOffset={{ x: 0, y: mainMenuScrollYRef.current }}
          scrollEventThrottle={16}
          onScroll={(event) => {
            const nextY = event.nativeEvent.contentOffset.y;
            mainMenuScrollYRef.current = nextY;
            settingsMainScrollYMemory = nextY;
          }}
          contentContainerStyle={{
            paddingBottom: tabBarHeight + 16,
            paddingRight: Platform.OS === 'web' && isDesktop ? 24 : 0,
          }}
        >
          {searchQuery.trim() ? (
            <View className="gap-2">
              {filteredSearchItems.length > 0 ? (
                filteredSearchItems.map((item) => (
                  <SettingsRow
                    key={item.id}
                    title={item.title}
                    description={item.description}
                    icon={item.icon}
                    rightText={item.rightText}
                    onPress={item.onPress}
                    showChevron={!!item.onPress}
                  />
                ))
              ) : (
                <View className="items-center py-12">
                  <Search size={32} color={colors.text.muted} strokeWidth={1.5} />
                  <Text style={{ color: colors.text.tertiary }} className="text-sm font-medium mt-3">No results for "{searchQuery}"</Text>
                  <Text style={{ color: colors.text.muted }} className="text-xs mt-1">Try a different keyword</Text>
                </View>
              )}
              <View className="h-8" />
            </View>
          ) : null}

          {!searchQuery.trim() && currentUser && (
            <>
              <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase mb-3 tracking-wider">Account</Text>
              <View className="gap-2">
                <SettingsRow
                  title="Account Info"
                  description="Email, role, business details"
                  icon={<Info size={18} color={colors.text.tertiary} strokeWidth={2} />}
                  onPress={() => openSettingsPanel('debug-business', '/debug-business?from=settings')}
                />
                <SettingsRow
                  title="My Account"
                  description="Profile and password"
                  icon={<UserCircle size={18} color="#3B82F6" strokeWidth={2} />}
                  onPress={() => openSettingsPanel('account-settings', '/account-settings?from=settings')}
                />
              </View>
            </>
          )}

          {!searchQuery.trim() && (<>
          <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase mt-4 mb-3 tracking-wider">Business</Text>
          <View className="gap-2">
          <SettingsRow
            title="Business Settings"
            description="Logo, phone, website"
            icon={<Building2 size={18} color="#10B981" strokeWidth={2} />}
            onPress={() => openSettingsPanel('business-settings', '/business-settings?from=settings')}
          />
          {canViewInsights && currentUser?.role === 'admin' ? (
            <SettingsRow
              title="Insights Dashboard"
              description="Sales, customers, and trends"
              icon={<BarChart3 size={18} color="#3B82F6" strokeWidth={2} />}
              onPress={() => openSettingsPanel('insights', '/insights?from=settings')}
            />
          ) : null}
          {canViewFinance ? (
            <SettingsRow
              title="Finance"
              description="Overview, expenses, procurement, settings"
              icon={<TrendingUp size={18} color="#10B981" strokeWidth={2} />}
              onPress={() => openSettingsPanel('finance', financeSettingsRoute)}
            />
          ) : null}
          <SettingsRow
            title="Tasks"
            description="Assign work, due dates, recurring ops"
            icon={<ListTodo size={18} color="#2563EB" strokeWidth={2} />}
            onPress={() => openSettingsPanel('tasks', '/tasks')}
          />
          </View>

          {currentUser?.role === 'admin' && (
            <>
              <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase mt-4 mb-3 tracking-wider">Team</Text>
              <View className="gap-2">
                <SettingsRow
                  title="Team Members"
                  description="Roles and permissions"
                  icon={<Shield size={18} color="#EF4444" strokeWidth={2} />}
                  rightText={`${teamMembers.length}`}
                  onPress={() => openSettingsPanel('team', '/team?from=settings')}
                />
                <SettingsRow
                  title="Invitations"
                  description="VIP access, invite limits, history"
                  icon={<Shield size={18} color="#F59E0B" strokeWidth={2} />}
                  onPress={() => openSettingsPanel('invitations', '/invitations?from=settings')}
                />
              </View>
            </>
          )}

          <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase mt-4 mb-3 tracking-wider">Data</Text>
          <View className="gap-2">
            <SettingsRow
              title="AI Import Assistant"
              description="Orders, customers, products, expenses"
              icon={<Sparkles size={18} color="#8B5CF6" strokeWidth={2} />}
              onPress={() => openSettingsPanel('import-ai', '/import-ai?from=settings')}
            />
          </View>

          <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase mt-4 mb-3 tracking-wider">Customers</Text>
          <View className="gap-2">
            <SettingsRow
              title="Customer List"
              description="Contacts and history"
              icon={<Users size={18} color="#10B981" strokeWidth={2} />}
              rightText={`${customers.length}`}
              onPress={() => openSettingsPanel('customers', { pathname: '/customers', params: { from: 'settings' } })}
            />
            <SettingsRow
              title="Import Customers"
              description="Upload contacts via CSV"
              icon={<Upload size={18} color="#10B981" strokeWidth={2} />}
              onPress={() => openSettingsPanel('import-customers', '/import-customers?from=settings')}
            />
          </View>

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
            <SettingsRow
              title="Order Automation"
              description="Auto-complete stale orders"
              icon={<Zap size={18} color="#F59E0B" strokeWidth={2} />}
              onPress={() => openSettingsPanel('order-automation', '/order-automation?from=settings')}
            />
            <SettingsRow
              title="Import Orders"
              description="Upload orders via CSV"
              icon={<Upload size={18} color="#10B981" strokeWidth={2} />}
              onPress={() => openSettingsPanel('import-orders', '/import-orders?from=settings')}
            />
          </View>

          <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase mt-4 mb-3 tracking-wider">Services</Text>
          <View className="gap-2">
            <SettingsRow
              title="Service Catalog"
              description="All services and pricing"
              icon={<Wrench size={18} color={colors.text.secondary} strokeWidth={2} />}
              onPress={() => openSettingsPanel('services', '/services?from=settings')}
            />
            <SettingsRow
              title="Add-ons"
              description="Lens coating, express delivery"
              icon={<Wrench size={18} color="#8B5CF6" strokeWidth={2} />}
              rightText={`${customServices.length}`}
              onPress={() => setActiveSection('custom-services')}
            />
          </View>

          <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase mt-4 mb-3 tracking-wider">Cases</Text>
          <View className="gap-2">
            <SettingsRow
              title="All Cases"
              description="View and manage cases"
              icon={<FileText size={18} color="#8B5CF6" strokeWidth={2} />}
              onPress={() => openSettingsPanel('cases', '/(tabs)/cases?from=settings')}
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

          <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase mt-4 mb-3 tracking-wider">Logistics</Text>
          <View className="gap-2">
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
              onPress={() => openSettingsPanel('category-manager', '/category-manager?from=settings')}
            />
            <SettingsRow
              title="Product Variables"
              description="Color, size, material"
              icon={<Package size={18} color="#A855F7" strokeWidth={2} />}
              rightText={`${productVariables.length}`}
              onPress={() => openSettingsPanel('product-variables', '/product-variables?from=settings')}
            />
            <SettingsRow
              title="Import Products"
              description="Upload CSV"
              icon={<Upload size={18} color="#10B981" strokeWidth={2} />}
              onPress={() => openSettingsPanel('import-products', '/import-products?from=settings')}
            />
          </View>

          <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase mt-4 mb-3 tracking-wider">Appearance</Text>
          <View
            className="rounded-2xl p-4 border"
            style={{ backgroundColor: colors.bg.card, borderColor: colors.border.light }}
          >
            <View className="flex-row items-center mb-3">
              <View
                className="w-9 h-9 rounded-lg items-center justify-center mr-3"
                style={{ backgroundColor: colors.bg.secondary }}
              >
                {themeMode === 'system'
                  ? <Laptop size={18} color="#6366F1" strokeWidth={2} />
                  : resolvedThemeMode === 'dark'
                  ? <Moon size={18} color="#8B5CF6" strokeWidth={2} />
                  : <Sun size={18} color="#F59E0B" strokeWidth={2} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text.primary }} className="font-semibold text-sm">
                  Theme
                </Text>
                <Text style={{ color: colors.text.tertiary }} className="text-[11px] mt-0.5">
                  {themeMode === 'system'
                    ? `Following device: ${resolvedThemeMode === 'dark' ? 'Dark' : 'Light'}`
                    : `Manually set: ${themeMode === 'dark' ? 'Dark' : 'Light'}`}
                </Text>
              </View>
            </View>

            <View
              className="rounded-full p-1"
              style={{ backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.light }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {themeOptions.map((option) => {
                  const isSelected = themeMode === option.mode;
                  return (
                    <Pressable
                      key={option.mode}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setThemeMode(option.mode);
                      }}
                      className="rounded-full active:opacity-80"
                      style={{
                        flex: 1,
                        height: 36,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isSelected ? colors.bg.card : 'transparent',
                        borderWidth: isSelected ? 1 : 0,
                        borderColor: isSelected ? colors.border.light : 'transparent',
                      }}
                    >
                      <Text
                        style={{
                          color: isSelected ? colors.text.primary : colors.text.tertiary,
                          fontSize: 12,
                          fontWeight: '700',
                        }}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {Platform.OS === 'web' && notifPermission !== null && (
            <>
              <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase mt-4 mb-3 tracking-wider">Notifications</Text>
              <View
                className="rounded-2xl p-4 border"
                style={{ backgroundColor: colors.bg.card, borderColor: colors.border.light }}
              >
                <View className="flex-row items-center gap-3">
                  <View
                    className="w-9 h-9 rounded-lg items-center justify-center"
                    style={{ backgroundColor: notifPermission === 'granted' ? '#10B98120' : colors.bg.secondary }}
                  >
                    {notifPermission === 'granted'
                      ? <Bell size={18} color="#10B981" strokeWidth={2} />
                      : <BellOff size={18} color={colors.text.tertiary} strokeWidth={2} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text.primary }} className="font-semibold text-sm">
                      Push Notifications
                    </Text>
                    <Text style={{ color: notifPermission === 'granted' ? '#10B981' : notifPermission === 'denied' ? '#EF4444' : colors.text.tertiary }} className="text-[11px] mt-0.5">
                      {notifPermission === 'granted' ? 'Enabled — you\'ll receive alerts' : notifPermission === 'denied' ? 'Blocked — enable in browser settings' : 'Not yet enabled'}
                    </Text>
                  </View>
                  {notifPermission !== 'granted' && notifPermission !== 'denied' && (
                    <Pressable
                      onPress={() => {
                        promptForPermission();
                        setTimeout(() => setNotifPermission(window.Notification?.permission ?? null), 1500);
                      }}
                      disabled={!notifReady}
                      className="rounded-full px-3 items-center justify-center active:opacity-80"
                      style={{ height: 34, backgroundColor: '#2563EB', opacity: notifReady ? 1 : 0.5 }}
                    >
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Enable</Text>
                    </Pressable>
                  )}
                  {notifPermission === 'denied' && (
                    <Pressable
                      onPress={() => {
                        if (typeof window !== 'undefined') window.open('https://support.apple.com/guide/safari/customize-settings-for-a-website-ibrw7f78f7fe/mac', '_blank');
                      }}
                      className="rounded-full px-3 items-center justify-center active:opacity-80"
                      style={{ height: 34, backgroundColor: colors.bg.secondary }}
                    >
                      <Text style={{ color: colors.text.tertiary, fontSize: 12, fontWeight: '600' }}>How to fix</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </>
          )}

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
                className="rounded-full px-3 items-center justify-center active:opacity-80"
                style={[primaryPillButtonStyle, { height: 36, minWidth: 80 }]}
              >
                <Text style={primaryPillTextStyle} className="font-semibold text-xs">
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
              onPress={handleRefreshApp}
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

          <View className="h-8" />
          </>)}

          <View className="h-16" />
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
                className="rounded-full items-center justify-center active:opacity-80"
                style={[primaryPillButtonStyle, { height: 48 }]}
              >
                <Text style={primaryPillTextStyle} className="font-semibold">Save</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
        </View>
      </SafeAreaView>

      {renderDeleteSettingModal()}
    </View>
  );
}
