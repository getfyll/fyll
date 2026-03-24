import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Linking, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Phone, Mail, MapPin, Calendar, Tag, Package, Trash2, Edit2, X, Check, Truck, CreditCard, ChevronDown, RefreshCcw, Camera, Plus, Minus, Search, Printer, User as UserIcon, Percent, ChevronLeft, ChevronRight, FileText, Save, MessageSquare, MoreVertical } from 'lucide-react-native';
import useFyllStore, { formatCurrency, NIGERIA_STATES, LogisticsInfo, Refund, OrderItem, PrescriptionInfo, Case, type Order, type RefundRequestStatus } from '@/lib/state/fyll-store';
import useAuthStore from '@/lib/state/auth-store';
import { useThemeColors } from '@/lib/theme';
import { useBreakpoint } from '@/lib/useBreakpoint';
import { cn } from '@/lib/cn';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { compressImage } from '@/lib/image-compression';
import DateTimePicker from '@react-native-community/datetimepicker';
import { PrescriptionSection } from '@/components/PrescriptionSection';
import { Button } from '@/components/Button';
import { CaseForm } from '@/components/CaseForm';
import { collaborationData } from '@/lib/supabase/collaboration';
import { sendThreadNotification } from '@/hooks/useWebPushNotifications';
import { formatRefundRequestStatusLabel, inferRefundRequestType } from '@/lib/refund-requests';
import { type RefundRequestAttachmentDraft, uploadRefundRequestAttachments } from '@/lib/refund-request-attachments';
import { canCreateRefundRequestForRole } from '@/lib/finance-access';

const STAMP_DUTY_THRESHOLD = 10000;

const getTransferChargeBreakdown = ({
  baseAmount,
  applyCharges,
  tiers,
  vatRate,
  stampDutyAmount,
}: {
  baseAmount: number;
  applyCharges: boolean;
  tiers: { maxAmount: number | null; fixedFee: number }[];
  vatRate: number;
  stampDutyAmount: number;
}) => {
  if (!applyCharges || baseAmount <= 0) {
    return { fee: 0, vat: 0, stampDuty: 0 };
  }
  const matchedTier = tiers.find((tier) => tier.maxAmount === null || baseAmount <= tier.maxAmount) ?? null;
  const fee = matchedTier?.fixedFee ?? 0;
  const vat = fee * vatRate;
  const stampDuty = baseAmount >= STAMP_DUTY_THRESHOLD ? stampDutyAmount : 0;
  return { fee, vat, stampDuty };
};

export default function OrderDetailScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const isDark = colors.bg.primary === '#111111';
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isDesktop, width } = useBreakpoint();
  const isWebDesktop = Platform.OS === 'web' && isDesktop;
  const isNarrowWeb = Platform.OS === 'web' && width < 1280;
  const webMaxWidth = 1456;
  const rightColumnWidth = isWebDesktop ? (isNarrowWeb ? Math.max(320, Math.round(width * 0.3)) : 420) : undefined;

  const orders = useFyllStore((s) => s.orders);
  const products = useFyllStore((s) => s.products);
  const orderStatuses = useFyllStore((s) => s.orderStatuses);
  const logisticsCarriers = useFyllStore((s) => s.logisticsCarriers);
  const paymentMethods = useFyllStore((s) => s.paymentMethods);
  const saleSources = useFyllStore((s) => s.saleSources);
  const cases = useFyllStore((s) => s.cases);
  const refundRequests = useFyllStore((s) => s.refundRequests);
  const financeRules = useFyllStore((s) => s.financeRules);
  const addCase = useFyllStore((s) => s.addCase);
  const addRefundRequest = useFyllStore((s) => s.addRefundRequest);
  const updateOrder = useFyllStore((s) => s.updateOrder);
  const deleteOrder = useFyllStore((s) => s.deleteOrder);
  const updateVariantStock = useFyllStore((s) => s.updateVariantStock);
  const currentUser = useAuthStore((s) => s.currentUser);
  const teamMembers = useAuthStore((s) => s.teamMembers);
  const businessId = useAuthStore((s) => s.businessId ?? s.currentUser?.businessId ?? null);
  const isOfflineMode = useAuthStore((s) => s.isOfflineMode);

  const [draft, setDraft] = useState<Partial<Order>>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    setDraft({});
  }, [id]);

  const baseOrder = useMemo(() => orders.find((o) => o.id === id), [orders, id]);
  const order = useMemo((): Order | undefined => {
    if (!baseOrder) return undefined;
    return { ...baseOrder, ...draft } as Order;
  }, [baseOrder, draft]);
  const statusColor = useMemo(() => {
    const status = orderStatuses.find((s) => s.name === order?.status);
    return status?.color || '#6B7280';
  }, [orderStatuses, order?.status]);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeletePrompt, setShowDeletePrompt] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showHeaderActionMenu, setShowHeaderActionMenu] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editState, setEditState] = useState('');
  const [editDeliveryFee, setEditDeliveryFee] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('');
  const [editSource, setEditSource] = useState('');
  const [editWebsiteOrderRef, setEditWebsiteOrderRef] = useState('');
  const [editDiscountCode, setEditDiscountCode] = useState('');
  const [editDiscountAmount, setEditDiscountAmount] = useState('');
  const [editItems, setEditItems] = useState<OrderItem[]>([]);
  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const [showPaymentDropdown, setShowPaymentDropdown] = useState(false);
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');

  // Logistics edit state
  const [showLogisticsModal, setShowLogisticsModal] = useState(false);
  const [editCarrierId, setEditCarrierId] = useState('');
  const [editCarrierName, setEditCarrierName] = useState('');
  const [editTrackingNumber, setEditTrackingNumber] = useState('');
  const [editDatePickedUp, setEditDatePickedUp] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCarrierDropdown, setShowCarrierDropdown] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState(new Date());

  // Refund modal state
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showRefundRequestModal, setShowRefundRequestModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundDate, setRefundDate] = useState(new Date());
  const [refundReason, setRefundReason] = useState('');
  const [refundProofUri, setRefundProofUri] = useState('');
  const [refundRequestAttachments, setRefundRequestAttachments] = useState<RefundRequestAttachmentDraft[]>([]);
  const [refundRequestUploadError, setRefundRequestUploadError] = useState('');
  const [showRefundDatePicker, setShowRefundDatePicker] = useState(false);
  const [applyRefundBankCharges, setApplyRefundBankCharges] = useState(true);

  // Cases
  const [showCaseForm, setShowCaseForm] = useState(false);

  const orderCases = useMemo(() => {
    return cases.filter((caseItem) => caseItem.orderId === order?.id);
  }, [cases, order?.id]);

  const latestRefundRequest = useMemo(() => {
    const matchingRequests = refundRequests
      .filter((request) => request.orderId === order?.id)
      .sort((left, right) => {
        const leftAt = new Date(left.updatedAt ?? left.createdAt).getTime();
        const rightAt = new Date(right.updatedAt ?? right.createdAt).getTime();
        return rightAt - leftAt;
      });
    return matchingRequests[0] ?? null;
  }, [order?.id, refundRequests]);

  const orderThreadQuery = useQuery({
    queryKey: ['collaboration-thread-existing', businessId, 'order', order?.id],
    enabled: Boolean(businessId) && Boolean(order?.id) && !isOfflineMode,
    queryFn: () => collaborationData.getThreadByEntity(businessId as string, 'order', order!.id),
  });

  // Product search results for editing - must be before early return
  const refund = order?.refund;
  const hasRefund = refund?.amount != null && refund.amount > 0;
  const isAdmin = currentUser?.role === 'admin';
  const canCreateRefundRequest = canCreateRefundRequestForRole(currentUser?.role ?? 'staff');
  const currentUserId = currentUser?.id ?? '';
  const currentUserName = currentUser?.name || currentUser?.email || 'Team Member';
  const refundBaseAmount = useMemo(() => {
    const parsed = Number.parseFloat(refundAmount);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [refundAmount]);
  const refundTransferBreakdown = useMemo(() => getTransferChargeBreakdown({
    baseAmount: refundBaseAmount,
    applyCharges: applyRefundBankCharges,
    tiers: financeRules.bankChargeTiers,
    vatRate: financeRules.vatRate,
    stampDutyAmount: financeRules.incomingStampDuty ?? 50,
  }), [applyRefundBankCharges, financeRules.bankChargeTiers, financeRules.incomingStampDuty, financeRules.vatRate, refundBaseAmount]);
  const refundBankChargeAmount = applyRefundBankCharges ? (refundTransferBreakdown.fee + refundTransferBreakdown.vat) : 0;
  const refundStampDuty = applyRefundBankCharges ? refundTransferBreakdown.stampDuty : 0;
  const refundTotalDebit = refundBaseAmount + refundBankChargeAmount + refundStampDuty;

  const productSearchResults = useMemo(() => {
    if (!productSearchQuery.trim()) return [];
    const query = productSearchQuery.toLowerCase();
    const results: { productId: string; productName: string; variantId: string; variantName: string; stock: number; price: number }[] = [];
    products.forEach((product) => {
      product.variants.forEach((variant) => {
        const variantName = Object.values(variant.variableValues).join(' ');
        const matchesProduct = product.name.toLowerCase().includes(query);
        const matchesVariant = variantName.toLowerCase().includes(query);
        if (matchesProduct || matchesVariant) {
          results.push({
            productId: product.id,
            productName: product.name,
            variantId: variant.id,
            variantName,
            stock: variant.stock,
            price: variant.sellingPrice,
          });
        }
      });
    });
    return results;
  }, [productSearchQuery, products]);

  // Calculate edited order totals - must be before early return
  const editedSubtotal = useMemo(() => {
    return editItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }, [editItems]);

  const editedTotal = useMemo(() => {
    return editedSubtotal + (parseFloat(editDeliveryFee) || 0) - (parseFloat(editDiscountAmount) || 0);
  }, [editedSubtotal, editDeliveryFee, editDiscountAmount]);

  // Filter out generic "Updated order" entries when there's a more specific action at the same time
  const filteredActivityLog = useMemo(() => {
    const activityLog = order?.activityLog;
    if (!activityLog) return [];

    return activityLog.filter((entry, index, arr) => {
      // Keep all non-"Updated order" entries
      if (entry.action !== 'Updated order') return true;

      // For "Updated order" entries, check if there's a more specific entry at the same time
      const hasSpecificEntry = arr.some((other, otherIndex) =>
        otherIndex !== index &&
        other.staffName === entry.staffName &&
        Math.abs(new Date(other.date).getTime() - new Date(entry.date).getTime()) < 2000 && // Within 2 seconds
        other.action !== 'Updated order'
      );

      // Only keep "Updated order" if there's no more specific entry
      return !hasSpecificEntry;
    });
  }, [order?.activityLog]);

  if (!order) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: colors.bg.primary }}>
        <Text style={{ color: colors.text.tertiary }} className="text-lg">Order not found</Text>
        <Pressable onPress={() => router.back()} className="mt-4 active:opacity-50">
          <Text style={{ color: colors.text.secondary }} className="font-semibold">Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const orderDateSource = order.orderDate ?? order.createdAt;
  const orderDate = new Date(orderDateSource).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Status badge (handles refund states)
  const refundAmountValue = order.refund?.amount ?? 0;
  const isRefunded = order.status === 'Refunded' || refundAmountValue > 0;
  const isFullRefund = refundAmountValue > 0 && refundAmountValue >= order.totalAmount;
  const isPartialRefund = refundAmountValue > 0 && refundAmountValue < order.totalAmount;

  let displayStatus = order.status;
  let badgeBgColor = `${statusColor}20`;
  let badgeTextColor = statusColor;

  if (isFullRefund) {
    displayStatus = 'Full Refund';
    badgeBgColor = 'rgba(239, 68, 68, 0.15)';
    badgeTextColor = '#EF4444';
  } else if (isPartialRefund) {
    displayStatus = 'Partial Refund';
    badgeBgColor = 'rgba(239, 68, 68, 0.15)';
    badgeTextColor = '#EF4444';
  } else if (isRefunded) {
    badgeBgColor = 'rgba(239, 68, 68, 0.15)';
    badgeTextColor = '#EF4444';
  }

  const getItemDetails = (item: typeof order.items[0]) => {
    const product = products.find((p) => p.id === item.productId);
    const variant = product?.variants.find((v) => v.id === item.variantId);
    const variantName = variant ? Object.values(variant.variableValues).join(' / ') : '';
    return { productName: product?.name || 'Unknown', variantName, sku: variant?.sku || '' };
  };

  const mergeDraftUpdates = (updates: Partial<Order>) => {
    if (!baseOrder) return;
    setDraft((prev) => {
      const next: Partial<Order> = { ...prev };
      Object.entries(updates).forEach(([key, value]) => {
        const baseValue = (baseOrder as any)[key];
        const equal = value === baseValue || JSON.stringify(value) === JSON.stringify(baseValue);
        if (equal || typeof value === 'undefined') {
          delete (next as any)[key];
        } else {
          (next as any)[key] = value;
        }
      });
      return next;
    });
  };

  const hasUnsavedChanges = Object.keys(draft).length > 0;

  const applyStockDeltaForItemsChange = (previous: OrderItem[], next: OrderItem[]) => {
    const toMap = (items: OrderItem[]) => {
      const map = new Map<string, { productId: string; variantId: string; qty: number }>();
      items.forEach((item) => {
        const key = `${item.productId}:${item.variantId}`;
        const existing = map.get(key);
        const qty = (existing?.qty ?? 0) + item.quantity;
        map.set(key, { productId: item.productId, variantId: item.variantId, qty });
      });
      return map;
    };

    const prevMap = toMap(previous);
    const nextMap = toMap(next);
    const keys = new Set([...prevMap.keys(), ...nextMap.keys()]);
    keys.forEach((key) => {
      const prevQty = prevMap.get(key)?.qty ?? 0;
      const nextQty = nextMap.get(key)?.qty ?? 0;
      const delta = prevQty - nextQty;
      if (delta === 0) return;
      const info = prevMap.get(key) ?? nextMap.get(key);
      if (!info) return;
      updateVariantStock(info.productId, info.variantId, delta);
    });
  };

  const handleSaveAll = async () => {
    if (!baseOrder) return;
    if (!hasUnsavedChanges) return;

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    const updatedBy = currentUser?.name || currentUser?.email || 'Staff';
    const updatedAt = new Date().toISOString();

    if (draft.items) {
      applyStockDeltaForItemsChange(baseOrder.items, draft.items);
    }

    try {
      await updateOrder(order.id, { ...draft, updatedBy, updatedAt }, businessId);
      setDraft({});
      showToast('success', isOfflineMode ? 'Saved locally (offline).' : 'Order updated.');
    } catch (error) {
      console.warn('Order save failed:', error);
      showToast('error', 'Could not save. Please try again.');
    }
  };

  const handleUpdateStatus = (newStatus: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    mergeDraftUpdates({ status: newStatus });
    setShowStatusModal(false);
  };

  const handleOpenEdit = () => {
    setShowHeaderActionMenu(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/order-edit/${order.id}`);
  };

  const handleOpenThread = async () => {
    setShowHeaderActionMenu(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (businessId && !isOfflineMode && !orderThreadQuery.data) {
        await collaborationData.getOrCreateThread(businessId, 'order', order.id);
      }
    } catch (error) {
      console.warn('Failed to initialize order thread:', error);
    } finally {
      router.push(`/threads?orderId=${order.id}`);
    }
  };

  const handleCreateCase = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowCaseForm(true);
  };

  const handleSaveCase = async (caseData: Case) => {
    await addCase(caseData, businessId);
  };

  const handleAddEditItem = (result: { productId: string; variantId: string; price: number }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const existingIndex = editItems.findIndex(
      (item) => item.productId === result.productId && item.variantId === result.variantId
    );
    if (existingIndex >= 0) {
      const newItems = [...editItems];
      newItems[existingIndex].quantity += 1;
      setEditItems(newItems);
    } else {
      setEditItems([...editItems, {
        productId: result.productId,
        variantId: result.variantId,
        quantity: 1,
        unitPrice: result.price
      }]);
    }
    setProductSearchQuery('');
    setShowProductSearch(false);
  };

  const handleUpdateEditItemQty = (index: number, delta: number) => {
    const newItems = [...editItems];
    const newQty = newItems[index].quantity + delta;
    if (newQty <= 0) {
      newItems.splice(index, 1);
    } else {
      newItems[index].quantity = newQty;
    }
    setEditItems(newItems);
  };

  const handleRemoveEditItem = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditItems(editItems.filter((_, i) => i !== index));
  };

  const getEditItemDetails = (item: OrderItem) => {
    const product = products.find((p) => p.id === item.productId);
    const variant = product?.variants.find((v) => v.id === item.variantId);
    const variantName = variant ? Object.values(variant.variableValues).join(' / ') : '';
    return { productName: product?.name || 'Unknown', variantName };
  };

  const handleSaveEdit = () => {
    if (editItems.length === 0) {
      Alert.alert('No Products', 'Order must have at least one product.');
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    mergeDraftUpdates({
      customerName: editName.trim(),
      customerPhone: editPhone.trim(),
      customerEmail: editEmail.trim(),
      deliveryAddress: editAddress.trim(),
      deliveryState: editState,
      deliveryFee: parseFloat(editDeliveryFee) || 0,
      discountCode: editDiscountCode.trim() || undefined,
      discountAmount: parseFloat(editDiscountAmount) || undefined,
      paymentMethod: editPaymentMethod,
      source: editSource,
      websiteOrderReference: editWebsiteOrderRef.trim() || undefined,
      items: editItems,
      subtotal: editedSubtotal,
      totalAmount: editedTotal,
    });
    setShowEditModal(false);
  };

  const handleOpenLogistics = () => {
    console.log('[Logistics] Opening logistics modal');
    console.log('[Logistics] Current logistics data:', order.logistics);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setEditCarrierId(order.logistics?.carrierId || '');
    setEditCarrierName(order.logistics?.carrierName || '');
    setEditTrackingNumber(order.logistics?.trackingNumber || '');
    const existingDate = order.logistics?.datePickedUp ? new Date(order.logistics.datePickedUp) : null;
    console.log('[Logistics] Existing datePickedUp:', existingDate?.toISOString());
    setEditDatePickedUp(existingDate);
    setShowCarrierDropdown(false);
    setShowLogisticsModal(true);
  };

  const handleSaveLogistics = () => {
    console.log('[Logistics] Saving logistics...');
    console.log('[Logistics] Carrier:', editCarrierName);
    console.log('[Logistics] Tracking:', editTrackingNumber);
    console.log('[Logistics] Date Picked Up:', editDatePickedUp?.toISOString());

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const logistics: LogisticsInfo = {
      carrierId: editCarrierId,
      carrierName: editCarrierName,
      trackingNumber: editTrackingNumber.trim(),
      dispatchDate: order.logistics?.dispatchDate || new Date().toISOString(),
      datePickedUp: editDatePickedUp?.toISOString(),
    };
    console.log('[Logistics] Final logistics object:', logistics);
    mergeDraftUpdates({ logistics });
    console.log('[Logistics] Save complete');
    setShowLogisticsModal(false);
  };

  const handleSelectCarrier = (carrierId: string, carrierName: string) => {
    setEditCarrierId(carrierId);
    setEditCarrierName(carrierName);
    setShowCarrierDropdown(false);
  };

  const handleOpenRefund = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (order.refund) {
      setRefundAmount(String(order.refund.amount));
      setRefundDate(new Date(order.refund.date));
      setRefundReason(order.refund.reason);
      setRefundProofUri(order.refund.proofImageUri || '');
    } else {
      setRefundAmount(String(order.totalAmount));
      setRefundDate(new Date());
      setRefundReason('');
      setRefundProofUri('');
    }
    setShowRefundModal(true);
  };

  const handleOpenRefundRequest = () => {
    if (!canCreateRefundRequest) {
      showToast('error', 'Only managers and admins can create refund requests.');
      return;
    }
    const remainingRefundable = Math.max(0, order.totalAmount - (order.refund?.amount ?? 0));
    setRefundAmount(remainingRefundable > 0 ? String(remainingRefundable) : '');
    setRefundDate(new Date());
    setRefundReason('');
    setRefundRequestAttachments([]);
    setRefundRequestUploadError('');
    setApplyRefundBankCharges(true);
    setShowRefundRequestModal(true);
  };

  const handlePickRefundRequestAttachment = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
      });

      if (result.canceled || !result.assets.length) return;

      const nextAsset = result.assets[0];
      const attachment: RefundRequestAttachmentDraft = {
        id: Math.random().toString(36).slice(2, 15),
        fileName: nextAsset.fileName || `refund-screenshot-${refundRequestAttachments.length + 1}.jpg`,
        localUri: nextAsset.uri,
        mimeType: nextAsset.mimeType ?? null,
        fileSize: typeof nextAsset.fileSize === 'number' ? nextAsset.fileSize : null,
      };

      setRefundRequestAttachments((previous) => {
        const alreadyExists = previous.some((item) => item.localUri === attachment.localUri && item.fileName === attachment.fileName);
        return alreadyExists ? previous : [...previous, attachment];
      });
      setRefundRequestUploadError('');
    } catch (error) {
      console.warn('Refund request screenshot picker failed:', error);
      setRefundRequestUploadError('Could not select screenshot. Please try again.');
    }
  };

  const handlePickRefundProof = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const compressedUri = await compressImage(result.assets[0].uri);
      setRefundProofUri(compressedUri);
    }
  };

  const handleSaveRefund = async () => {
    if (!refundAmount || parseFloat(refundAmount) <= 0) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const refundAmount_ = parseFloat(refundAmount);
    const refund: Refund = {
      id: order.refund?.id || Math.random().toString(36).substring(2, 15),
      orderId: order.id,
      amount: refundAmount_,
      date: refundDate.toISOString(),
      reason: refundReason.trim(),
      proofImageUri: refundProofUri || undefined,
      createdAt: order.refund?.createdAt || new Date().toISOString(),
    };

    // Determine if it's a full or partial refund
    const isFullRefund = refundAmount_ >= order.totalAmount;
    const refundStatus = isFullRefund ? 'Refunded' : 'Partial Refund';

    // Create updates with refund and correct status
    const updates = { refund, status: refundStatus };

    // Update draft first
    mergeDraftUpdates(updates);

    // Then immediately save to persist the refund
    const updatedBy = currentUser?.name || currentUser?.email || 'Staff';
    const updatedAt = new Date().toISOString();

    try {
      await updateOrder(order.id, { ...updates, updatedBy, updatedAt }, businessId);
      setDraft({});
      showToast('success', 'Refund processed and saved.');
    } catch (error) {
      console.warn('Refund save failed:', error);
      showToast('error', 'Could not save refund. Please try again.');
    }

    setShowRefundModal(false);
  };

  const handleSubmitRefundRequest = async (mode: 'save' | 'submit' = 'submit') => {
    if (!canCreateRefundRequest) {
      showToast('error', 'Only managers and admins can create refund requests.');
      return;
    }
    if (!refundAmount || parseFloat(refundAmount) <= 0) return;
    const refundAmountValue = parseFloat(refundAmount);
    const remainingRefundable = Math.max(0, order.totalAmount - (order.refund?.amount ?? 0));
    if (refundAmountValue > remainingRefundable + 0.01) {
      showToast('error', `Refund exceeds remaining balance of ${formatCurrency(remainingRefundable)}.`);
      return;
    }

    const nowIso = new Date().toISOString();
    const nextStatus: RefundRequestStatus = mode === 'submit'
      ? (isAdmin ? 'approved' : 'submitted')
      : 'draft';
    let uploadedAttachments = undefined;
    if (refundRequestAttachments.length > 0) {
      if (!businessId) {
        showToast('error', 'Could not upload refund screenshots right now.');
        return;
      }
      try {
        uploadedAttachments = await uploadRefundRequestAttachments(businessId, refundRequestAttachments, 'order');
        setRefundRequestUploadError('');
      } catch (error) {
        console.warn('Refund request screenshot upload failed:', error);
        setRefundRequestUploadError('Could not upload screenshots. Please try again.');
        showToast('error', 'Could not upload refund screenshots.');
        return;
      }
    }
    try {
      await addRefundRequest({
        id: Math.random().toString(36).slice(2, 15),
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerEmail: order.customerEmail,
        amount: refundAmountValue,
        requestedDate: refundDate.toISOString(),
        reason: refundReason.trim(),
        attachments: uploadedAttachments && uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
        status: nextStatus,
        refundType: inferRefundRequestType(order.totalAmount, (order.refund?.amount ?? 0) + refundAmountValue),
        source: 'order',
        submittedByUserId: currentUserId,
        submittedByName: currentUserName,
        submittedAt: nextStatus !== 'draft' ? nowIso : undefined,
        reviewedByUserId: nextStatus === 'approved' ? currentUserId : undefined,
        reviewedByName: nextStatus === 'approved' ? currentUserName : undefined,
        reviewedAt: nextStatus === 'approved' ? nowIso : undefined,
        applyBankCharges: applyRefundBankCharges,
        bankChargeAmount: refundBankChargeAmount,
        stampDutyAmount: refundStampDuty,
        totalDebitAmount: refundAmountValue + refundBankChargeAmount + refundStampDuty,
        createdAt: nowIso,
        updatedAt: nowIso,
      }, businessId);
    } catch (error) {
      console.warn('Refund request submit failed:', error);
      showToast('error', 'Could not submit refund request. Check refund setup in Supabase.');
      return;
    }

    if (nextStatus === 'submitted' && businessId) {
      const adminRecipientIds = teamMembers
        .filter((member) => member.role === 'admin' && member.id !== currentUserId)
        .map((member) => member.id);
      if (adminRecipientIds.length > 0) {
        void sendThreadNotification({
          businessId,
          recipientUserIds: adminRecipientIds,
          senderUserId: currentUserId || null,
          authorName: currentUserName,
          body: `${currentUserName} submitted a refund request for ${order.orderNumber} (${formatCurrency(refundAmountValue)}).`,
          entityType: 'order',
          entityDisplayName: order.orderNumber,
          entityId: order.id,
        });
      }
    }

    setShowRefundRequestModal(false);
    showToast(
      'success',
      nextStatus === 'approved'
        ? 'Refund request approved.'
        : nextStatus === 'submitted'
          ? 'Refund request submitted.'
          : 'Refund request saved as draft.'
    );
  };

  const openDeletePrompt = () => {
    setShowHeaderActionMenu(false);
    if (Platform.OS === 'web') {
      const active = document.activeElement as HTMLElement | null;
      active?.blur();
    }
    setShowDeletePrompt(true);
  };

  const confirmDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    deleteOrder(order.id, businessId);
    setShowDeletePrompt(false);
    router.back();
  };

  const handlePrintLabel = () => {
    const carrierName = order.logistics?.carrierName?.trim();
    const carrierQuery = carrierName ? `&carrierName=${encodeURIComponent(carrierName)}` : '';
    router.push(`/order-label-preview?orderId=${order.id}${carrierQuery}`);
  };

  const handleUpdatePrescription = (prescription: PrescriptionInfo | undefined) => {
    mergeDraftUpdates({ prescription });
  };

  const formatDateDisplay = (dateString?: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatServiceFieldValue = (type: string | undefined, value: string | undefined) => {
    const safeValue = value?.toString().trim();
    if (!safeValue) return 'Not set';

    if (type === 'Price') {
      const parsed = Number.parseFloat(safeValue);
      return Number.isFinite(parsed) ? formatCurrency(parsed) : safeValue;
    }

    if (type === 'Date') {
      const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(safeValue);
      if (isoMatch) {
        const year = Number(isoMatch[1]);
        const month = Number(isoMatch[2]) - 1;
        const day = Number(isoMatch[3]);
        return new Date(year, month, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
      const parsed = new Date(safeValue);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    }

    if (type === 'Time') {
      const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(safeValue);
      if (timeMatch) {
        const date = new Date();
        date.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      }
    }

    return safeValue;
  };

  const formatServiceVariableValue = (type: string | undefined, value: string | undefined) => {
    const safeValue = value?.toString().trim();
    if (!safeValue) return 'Not set';
    if (type === 'Toggle') {
      return safeValue === 'true' ? 'Yes' : 'No';
    }
    return safeValue;
  };

  const customerSection = (
    <View className={cn('mt-4 rounded-2xl p-4', !isWebDesktop && 'mx-5')} style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
      <Text style={{ color: colors.text.primary }} className="font-bold text-base mb-3">Customer</Text>

      <Text style={{ color: colors.text.primary }} className="font-semibold text-lg mb-2">{order.customerName}</Text>

      {order.customerPhone && (
        <Pressable
          onPress={() => Linking.openURL(`tel:${order.customerPhone}`)}
          className="flex-row items-center py-2 active:opacity-50"
        >
          <Phone size={16} color={colors.text.primary} strokeWidth={2} />
          <Text style={{ color: colors.text.secondary }} className="text-sm ml-2 font-medium">{order.customerPhone}</Text>
        </Pressable>
      )}

      {order.customerEmail && (
        <Pressable
          onPress={() => Linking.openURL(`mailto:${order.customerEmail}`)}
          className="flex-row items-center py-2 active:opacity-50"
        >
          <Mail size={16} color={colors.text.primary} strokeWidth={2} />
          <Text style={{ color: colors.text.secondary }} className="text-sm ml-2 font-medium">{order.customerEmail}</Text>
        </Pressable>
      )}

      {order.deliveryAddress && (
        <View className="flex-row items-start py-2">
          <MapPin size={16} color={colors.text.primary} strokeWidth={2} />
          <Text style={{ color: colors.text.secondary }} className="text-sm ml-2 flex-1 font-medium">
            {order.deliveryAddress}
            {order.deliveryState && `, ${order.deliveryState}`}
          </Text>
        </View>
      )}
    </View>
  );

  const itemsSection = (
    <View className={cn('mt-4 rounded-2xl p-4', !isWebDesktop && 'mx-5')} style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
      <Text style={{ color: colors.text.primary }} className="font-bold text-base mb-3">Items</Text>

      {order.items.map((item, index) => {
        const { productName, variantName, sku } = getItemDetails(item);
        const serviceVariables = (item.serviceVariables ?? []).filter((variable) => (variable.value ?? '').toString().trim().length > 0);
        const serviceFields = (item.serviceFields ?? []).filter((field) => (field.value ?? '').toString().trim().length > 0);
        const hasServiceDetails = serviceVariables.length > 0 || serviceFields.length > 0;
        return (
          <View
            key={`${item.productId}-${item.variantId}`}
            className={cn(
              'py-3',
              index < order.items.length - 1 ? 'border-b' : ''
            )}
            style={{ borderBottomColor: colors.border.light }}
          >
            <View className="flex-row items-center">
              <View className="w-12 h-12 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: colors.bg.secondary }}>
                <Package size={24} color={colors.text.primary} strokeWidth={1.5} />
              </View>
              <View className="flex-1">
                <Text style={{ color: colors.text.primary }} className="font-semibold text-sm">{productName}</Text>
                <Text style={{ color: colors.text.muted }} className="text-xs">{variantName}</Text>
                <Text style={{ color: colors.text.muted }} className="text-xs">SKU: {sku}</Text>
              </View>
              <View className="items-end">
                <Text style={{ color: colors.text.primary }} className="font-bold text-sm">
                  {formatCurrency(item.unitPrice * item.quantity)}
                </Text>
                <Text style={{ color: colors.text.muted }} className="text-xs">
                  {item.quantity} × {formatCurrency(item.unitPrice)}
                </Text>
              </View>
            </View>
            {hasServiceDetails && (
              <View
                style={{
                  marginTop: 10,
                  marginLeft: 60,
                  paddingTop: 8,
                  borderTopWidth: 1,
                  borderTopColor: colors.border.light,
                }}
              >
                <Text style={{ color: colors.text.tertiary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 }}>
                  Service Details
                </Text>
                {serviceVariables.map((variable) => (
                  <View key={`var-${item.productId}-${item.variantId}-${variable.id}`} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ color: colors.text.secondary, fontSize: 12, flex: 1 }}>{variable.name}</Text>
                    <Text style={{ color: colors.text.primary, fontSize: 12, fontWeight: '600', marginLeft: 12 }}>
                      {formatServiceVariableValue(variable.type, variable.value)}
                    </Text>
                  </View>
                ))}
                {serviceFields.map((field) => (
                  <View key={`field-${item.productId}-${item.variantId}-${field.id}`} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ color: colors.text.secondary, fontSize: 12, flex: 1 }}>{field.label}</Text>
                    <Text style={{ color: colors.text.primary, fontSize: 12, fontWeight: '600', marginLeft: 12 }}>
                      {formatServiceFieldValue(field.type, field.value)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}

      {/* Services */}
      {order.services && order.services.length > 0 && (
        <View className="border-t mt-2 pt-2" style={{ borderTopColor: colors.border.light }}>
          {order.services.map((service) => (
            <View key={service.serviceId} className="flex-row items-center justify-between py-2">
              <Text style={{ color: colors.text.tertiary }} className="text-sm">{service.name}</Text>
              <Text style={{ color: colors.text.primary }} className="font-medium text-sm">{formatCurrency(service.price)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Delivery Fee */}
      {order.deliveryFee > 0 && (
        <View className="flex-row items-center justify-between py-2 border-t mt-1" style={{ borderTopColor: colors.border.light }}>
          <View className="flex-row items-center">
            <Truck size={14} color={colors.text.tertiary} strokeWidth={2} />
            <Text style={{ color: colors.text.tertiary }} className="text-sm ml-2">Delivery Fee</Text>
          </View>
          <Text style={{ color: colors.text.primary }} className="font-medium text-sm">{formatCurrency(order.deliveryFee)}</Text>
        </View>
      )}

      {/* Discount Row */}
      {order.discountAmount && order.discountAmount > 0 && (
        <View className="flex-row items-center justify-between py-2 border-t mt-1" style={{ borderTopColor: colors.border.light }}>
          <View className="flex-row items-center">
            <Percent size={14} color="#10B981" strokeWidth={2} />
            <Text style={{ color: '#10B981' }} className="text-sm ml-2 font-medium">
              Discount{order.discountCode ? ` (${order.discountCode})` : ''}
            </Text>
          </View>
          <Text style={{ color: '#10B981' }} className="font-bold text-sm">-{formatCurrency(order.discountAmount)}</Text>
        </View>
      )}

      {/* Refund Row - Display in Red if refund exists */}
      {order.refund && order.refund.amount > 0 && (
        <View className="flex-row items-center justify-between py-2 border-t mt-1" style={{ borderTopColor: colors.border.light }}>
          <View className="flex-row items-center">
            <RefreshCcw size={14} color="#EF4444" strokeWidth={2} />
            <Text style={{ color: '#EF4444' }} className="text-sm ml-2 font-medium">Refund</Text>
          </View>
          <Text style={{ color: '#EF4444' }} className="font-bold text-sm">-{formatCurrency(order.refund.amount)}</Text>
        </View>
      )}

      <View className="border-t mt-2 pt-3 flex-row items-center justify-between" style={{ borderTopColor: colors.border.medium }}>
        <Text style={{ color: colors.text.tertiary }} className="font-medium">Total</Text>
        <Text style={{ color: colors.text.primary }} className="font-bold text-xl">
          {formatCurrency(order.refund && order.refund.amount > 0 ? order.totalAmount - order.refund.amount : order.totalAmount)}
        </Text>
      </View>
      {order.refund && order.refund.amount > 0 && (
        <Text style={{ color: colors.text.muted }} className="text-xs text-right mt-1">
          Original: {formatCurrency(order.totalAmount)}
        </Text>
      )}
    </View>
  );

  const sourcePaymentSection = (
    <View className={cn('mt-4 rounded-2xl p-4', !isWebDesktop && 'mx-5')} style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Tag size={16} color={colors.text.primary} strokeWidth={2} />
          <Text style={{ color: colors.text.secondary }} className="text-sm ml-2 font-medium">{order.source}</Text>
        </View>
        <View className="flex-row items-center">
          <CreditCard size={16} color={colors.text.primary} strokeWidth={2} />
          <Text style={{ color: colors.text.secondary }} className="text-sm ml-2 font-medium">{order.paymentMethod || 'Not set'}</Text>
        </View>
      </View>
    </View>
  );

  const actionPillBaseStyle = {
    minHeight: 32,
    minWidth: 90,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };

  const primaryActionPillStyle = {
    ...actionPillBaseStyle,
    backgroundColor: colors.text.primary,
  };

  const primaryActionTextStyle = {
    color: colors.bg.primary,
    fontSize: 13,
    fontWeight: '600' as const,
  };

  const secondaryActionPillStyle = {
    ...actionPillBaseStyle,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
  };

  const secondaryActionTextStyle = {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '600' as const,
  };

  const logisticsSection = (
    <View className={cn('mt-4 rounded-2xl p-4', !isWebDesktop && 'mx-5')} style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
      <View className="flex-row items-center justify-between mb-3">
        <Text style={{ color: colors.text.primary }} className="font-bold text-base">Logistics</Text>
        <Pressable
          onPress={handleOpenLogistics}
          className="active:opacity-70"
          style={primaryActionPillStyle}
        >
          <Text style={primaryActionTextStyle}>
            {order.logistics ? 'Edit' : '+ Add'}
          </Text>
        </Pressable>
      </View>

      {order.logistics ? (
        <View>
          <View className="flex-row items-center py-2">
            <Truck size={16} color={colors.text.primary} strokeWidth={2} />
            <Text style={{ color: colors.text.primary }} className="text-sm ml-2 font-semibold">{order.logistics.carrierName}</Text>
          </View>
          {(() => {
            const logisticsDate = order.logistics?.datePickedUp ?? order.logistics?.dispatchDate;
            if (!logisticsDate) return null;
            const logisticsLabel = order.logistics?.datePickedUp ? 'Picked up' : 'Dispatched';
            return (
              <View className="flex-row items-center py-2">
                <Calendar size={16} color={colors.text.tertiary} strokeWidth={2} />
                <Text style={{ color: colors.text.secondary }} className="text-sm ml-2">
                  {logisticsLabel}: {formatDateDisplay(logisticsDate)}
                </Text>
              </View>
            );
          })()}
          {order.logistics.trackingNumber && (
            <View className="rounded-xl px-3 py-2 mt-2" style={{ backgroundColor: colors.bg.secondary }}>
              <Text style={{ color: colors.text.muted }} className="text-xs mb-1">Tracking Number</Text>
              <Text style={{ color: colors.text.primary }} className="text-sm font-mono">{order.logistics.trackingNumber}</Text>
            </View>
          )}
        </View>
      ) : (
        <View className="py-4 items-center">
          <Truck size={24} color={colors.text.muted} strokeWidth={1.5} />
          <Text style={{ color: colors.text.muted }} className="text-sm mt-2">No logistics info yet</Text>
        </View>
      )}
    </View>
  );

  const prescriptionSection = (
    <PrescriptionSection
      containerClassName={cn('mt-4', !isWebDesktop && 'mx-5')}
      prescription={order.prescription}
      onUpdate={handleUpdatePrescription}
      editable={true}
      staffName={currentUser?.name || currentUser?.email || 'Staff'}
    />
  );

  const refundSection = (
    <View className={cn('mt-4 rounded-2xl p-4', !isWebDesktop && 'mx-5')} style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
      <View className="flex-row items-center justify-between mb-3">
        <Text style={{ color: colors.text.primary }} className="font-bold text-base">Refund</Text>
        <View className="flex-row items-center" style={{ gap: 8 }}>
          {canCreateRefundRequest ? (
            <Pressable
              onPress={handleOpenRefundRequest}
              className="active:opacity-70"
              style={secondaryActionPillStyle}
            >
              <Text style={secondaryActionTextStyle}>
                {latestRefundRequest ? 'Refund Request' : 'Request Refund'}
              </Text>
            </Pressable>
          ) : (
            <Text style={{ color: colors.text.tertiary }} className="text-xs font-medium">
              Managers/Admins only
            </Text>
          )}
        </View>
      </View>

      {hasRefund && refund ? (
        <View>
          <View className="flex-row items-center justify-between py-2">
            <Text style={{ color: colors.text.tertiary }} className="text-sm">Amount Refunded</Text>
            <Text className="text-red-500 font-bold text-lg">{formatCurrency(refund.amount)}</Text>
          </View>
          <View className="flex-row items-center py-2">
            <Calendar size={14} color={colors.text.tertiary} strokeWidth={2} />
            {refund.date && (
              <Text style={{ color: colors.text.secondary }} className="text-sm ml-2">
                {formatDateDisplay(refund.date)}
              </Text>
            )}
          </View>
          {refund.reason && (
            <View className="rounded-xl px-3 py-2 mt-2" style={{ backgroundColor: colors.bg.secondary }}>
              <Text style={{ color: colors.text.muted }} className="text-xs mb-1">Reason</Text>
              <Text style={{ color: colors.text.primary }} className="text-sm">{refund.reason}</Text>
            </View>
          )}
        </View>
      ) : (
        <View className="py-4 items-center">
          <RefreshCcw size={24} color={colors.text.muted} strokeWidth={1.5} />
          <Text style={{ color: colors.text.muted }} className="text-sm mt-2">No refund processed</Text>
        </View>
      )}
      {latestRefundRequest && latestRefundRequest.status !== 'paid' ? (
        <View className="rounded-xl px-3 py-3 mt-3" style={{ backgroundColor: colors.bg.secondary }}>
          <View className="flex-row items-center justify-between" style={{ gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text.primary }} className="text-sm font-semibold">Latest refund request</Text>
              <Text style={{ color: colors.text.secondary }} className="text-xs mt-1">
                {formatCurrency(latestRefundRequest.amount)} requested on {new Date(latestRefundRequest.requestedDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
            </View>
            <View className="rounded-full px-3 py-1" style={{ backgroundColor: colors.bg.primary }}>
              <Text style={{ color: colors.text.primary, fontSize: 11, fontWeight: '700' }}>
                {formatRefundRequestStatusLabel(latestRefundRequest)}
              </Text>
            </View>
          </View>
          {latestRefundRequest.reason ? (
            <Text style={{ color: colors.text.tertiary }} className="text-xs mt-2" numberOfLines={3}>
              {latestRefundRequest.reason}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  const casesSection = (
    <View className={cn('mt-4 rounded-2xl p-4', !isWebDesktop && 'mx-5')} style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
      <View className="flex-row items-center justify-between mb-3">
        <Text style={{ color: colors.text.primary }} className="font-bold text-base">Cases</Text>
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => {
              void handleOpenThread();
            }}
            className="active:opacity-70"
            style={secondaryActionPillStyle}
          >
            <Text style={secondaryActionTextStyle}>{orderThreadQuery.data ? 'Open Thread' : 'Start Thread'}</Text>
          </Pressable>
          <Pressable
            onPress={handleCreateCase}
            className="active:opacity-70 flex-row items-center justify-center"
            style={primaryActionPillStyle}
          >
            <Plus size={13} color={colors.bg.primary} strokeWidth={2.5} />
            <Text style={[primaryActionTextStyle, { marginLeft: 5 }]}>Create Case</Text>
          </Pressable>
        </View>
      </View>

      {orderCases.length > 0 ? (
        <View className="gap-2">
          {orderCases.map((caseItem) => (
            <Pressable
              key={caseItem.id}
              onPress={() => router.push(`/case/${caseItem.id}`)}
              className="flex-row items-center justify-between rounded-2xl px-4 py-3"
              style={{ backgroundColor: colors.bg.primary, borderWidth: 1, borderColor: colors.border.light }}
            >
              <Text style={{ color: colors.text.primary, fontWeight: '600' }}>{caseItem.caseNumber}</Text>
              <ChevronRight size={18} color={colors.text.tertiary} strokeWidth={2} />
            </Pressable>
          ))}
        </View>
      ) : (
        <View className="py-4 items-center">
          <FileText size={24} color={colors.text.muted} strokeWidth={1.5} />
          <Text style={{ color: colors.text.muted }} className="text-sm mt-2">No cases yet</Text>
        </View>
      )}
    </View>
  );

  const printLabelSection = (
    <View className={cn('mt-4', !isWebDesktop && 'mx-5')}>
      {isDark ? (
        <Pressable
          onPress={handlePrintLabel}
          className="rounded-full items-center justify-center active:opacity-80 flex-row"
          style={{ backgroundColor: '#FFFFFF', height: 52 }}
        >
          <Printer size={18} color="#111111" strokeWidth={2} />
          <Text className="font-semibold text-base ml-2" style={{ color: '#111111' }}>
            Print Shipping Label
          </Text>
        </Pressable>
      ) : (
        <Button
          onPress={handlePrintLabel}
          icon={<Printer size={18} color="#FFFFFF" strokeWidth={2} />}
        >
          Print Shipping Label
        </Button>
      )}
    </View>
  );

  const updateStatusSection = (
    <View className={cn('mt-4 rounded-2xl p-4', !isWebDesktop && 'mx-5')} style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
      <Text style={{ color: colors.text.primary }} className="font-bold text-base mb-3">Update Status</Text>

      <View className="gap-2">
        {orderStatuses.map((status) => {
          const currentStatus = baseOrder?.status ?? order.status;
          const selectedStatus = draft.status ?? currentStatus;
          const isCurrentStatus = currentStatus === status.name;
          const isSelected = selectedStatus === status.name;
          return (
            <Pressable
              key={status.id}
              onPress={() => handleUpdateStatus(status.name)}
              className={cn(
                'flex-row items-center px-4 py-3 rounded-full',
                isSelected ? '' : 'border'
              )}
              style={isSelected ? { backgroundColor: status.color } : { backgroundColor: colors.bg.secondary, borderColor: colors.border.light }}
            >
              <View
                className={cn(
                  'w-6 h-6 rounded-full items-center justify-center mr-3',
                  isSelected ? 'bg-white/30' : ''
                )}
                style={!isSelected ? { backgroundColor: `${status.color}30` } : {}}
              >
                {isSelected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                {!isSelected && (
                  <View
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: status.color }}
                  />
                )}
              </View>
              <Text
                className={cn('font-semibold text-sm flex-1')}
                style={{ color: isSelected ? '#FFFFFF' : colors.text.secondary }}
              >
                {status.name}
              </Text>
              {isCurrentStatus && !isSelected && (
                <View className="bg-white/30 px-2 py-0.5 rounded-full">
                  <Text className="text-white text-xs font-medium">Current</Text>
                </View>
              )}
              {draft.status && isSelected && !isCurrentStatus && (
                <View className="bg-white/30 px-2 py-0.5 rounded-full">
                  <Text className="text-white text-xs font-medium">Selected</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const staffActivitySection =
    (order.createdBy || order.updatedBy || (order.activityLog && order.activityLog.length > 0)) ? (
      <View className={cn('mt-4', !isWebDesktop && 'mx-5')}>
        <View className="rounded-2xl p-4" style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
          <View className="flex-row items-center mb-3">
            <UserIcon size={16} color={colors.text.tertiary} strokeWidth={2} />
            <Text style={{ color: colors.text.tertiary }} className="font-semibold text-xs uppercase ml-2 tracking-wider">Staff Activity</Text>
          </View>

          {/* Created by entry */}
          {order.createdBy && (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border.light }}>
              <UserIcon size={14} color={colors.text.muted} strokeWidth={2} style={{ marginTop: 1 }} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={{ color: colors.text.primary }} className="text-xs font-semibold">{order.createdBy}</Text>
                <Text style={{ color: colors.text.muted }} className="text-xs">Created order</Text>
                {order.createdAt && (
                  <Text style={{ color: colors.text.tertiary }} className="text-xs mt-0.5">
                    {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(order.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Activity log entries */}
          {filteredActivityLog.map((entry, index) => (
            <View
              key={`${entry.date}-${index}`}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                paddingVertical: 6,
                borderBottomWidth: index < filteredActivityLog.length - 1 ? 1 : 0,
                borderBottomColor: colors.border.light,
              }}
            >
              <UserIcon size={14} color={colors.text.muted} strokeWidth={2} style={{ marginTop: 1 }} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={{ color: colors.text.primary }} className="text-xs font-semibold">{entry.staffName}</Text>
                <Text style={{ color: colors.text.muted }} className="text-xs">{entry.action}</Text>
                <Text style={{ color: colors.text.tertiary }} className="text-xs mt-0.5">
                  {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(entry.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                </Text>
              </View>
            </View>
          ))}

          {/* Fallback for old orders without activity log */}
          {filteredActivityLog.length === 0 && order.updatedBy && (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6 }}>
              <UserIcon size={14} color={colors.text.muted} strokeWidth={2} style={{ marginTop: 1 }} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={{ color: colors.text.primary }} className="text-xs font-semibold">{order.updatedBy}</Text>
                <Text style={{ color: colors.text.muted }} className="text-xs">Last updated order</Text>
                {order.updatedAt && (
                  <Text style={{ color: colors.text.tertiary }} className="text-xs mt-0.5">
                    {new Date(order.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(order.updatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>
      </View>
    ) : null;

  return (
    <View className="flex-1" style={{ backgroundColor: isWebDesktop ? colors.bg.primary : colors.bg.secondary }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        {isWebDesktop ? (
          <View style={{ backgroundColor: colors.bg.primary }}>
            <View
              style={{
                paddingHorizontal: 28,
                paddingTop: 32,
                paddingBottom: 18,
                width: '100%',
                maxWidth: webMaxWidth,
                alignSelf: 'flex-start',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
                  <Pressable
                    onPress={() => router.back()}
                    className="active:opacity-70"
                    style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}
                  >
                    <ArrowLeft size={20} color={colors.text.primary} strokeWidth={2} />
                  </Pressable>

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                      <Text style={{ color: colors.text.primary, fontSize: 24, fontWeight: '700' }} numberOfLines={1}>
                        {order.orderNumber}
                      </Text>
                      <Pressable
                        onPress={() => setShowStatusModal(true)}
                        className="active:opacity-80"
                        style={{ backgroundColor: badgeBgColor, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}
                      >
                        <Text style={{ color: badgeTextColor, fontSize: 13, fontWeight: '700' }}>
                          {displayStatus}
                        </Text>
                      </Pressable>
                    </View>

                    <Text style={{ color: colors.text.muted, fontSize: 14, marginTop: 6 }} numberOfLines={1}>
                      {orderDate}
                    </Text>

                    {order.websiteOrderReference ? (
                      <Text style={{ color: colors.text.tertiary, fontSize: 12, marginTop: 6 }} numberOfLines={1}>
                        Website Order Ref: {order.websiteOrderReference}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Pressable onPress={openDeletePrompt} className="active:opacity-80" style={{ paddingHorizontal: 8, height: 44, justifyContent: 'center' }}>
                    <Text style={{ color: '#EF4444', fontSize: 16, fontWeight: '700' }}>Delete</Text>
                  </Pressable>

                  <Pressable
                    onPress={handleOpenEdit}
                    className="active:opacity-80"
                    style={{
                      height: 44,
                      paddingHorizontal: 16,
                      borderRadius: 999,
                      backgroundColor: colors.bg.primary,
                      borderWidth: 1,
                      borderColor: colors.border.light,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Edit2 size={16} color={colors.text.primary} strokeWidth={2} />
                    <Text style={{ color: colors.text.primary, fontWeight: '700' }}>Edit</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      void handleOpenThread();
                    }}
                    className="active:opacity-80"
                    style={{
                      height: 44,
                      paddingHorizontal: 16,
                      borderRadius: 999,
                      backgroundColor: colors.bg.primary,
                      borderWidth: 1,
                      borderColor: colors.border.light,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <View style={{ position: 'relative', marginRight: 2 }}>
                      <MessageSquare size={16} color={colors.text.primary} strokeWidth={2} />
                      <View
                        style={{
                          position: 'absolute',
                          top: -3,
                          right: -4,
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: orderThreadQuery.data ? '#EF4444' : '#9CA3AF',
                        }}
                      />
                    </View>
                    <Text style={{ color: colors.text.primary, fontWeight: '700' }}>
                      {orderThreadQuery.data ? 'Thread' : 'Start Thread'}
                    </Text>
                  </Pressable>

                  <Button
                    onPress={handleSaveAll}
                    disabled={!hasUnsavedChanges}
                    fullWidth={false}
                    size="md"
                    icon={<Save size={18} color="#FFFFFF" strokeWidth={2.5} />}
                  >
                    Save Changes
                  </Button>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border.light, backgroundColor: colors.bg.primary }}>
            <View
              className="flex-row items-center"
              style={{
                paddingHorizontal: 16,
                paddingVertical: 14,
              }}
            >
              <Pressable
                onPress={() => router.back()}
                className="active:opacity-50 items-center justify-center"
                style={{ width: 36, height: 36, borderRadius: 18, marginRight: 10 }}
              >
                <ArrowLeft size={22} color={colors.text.primary} strokeWidth={2} />
              </Pressable>
              <View className="flex-1">
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <Text style={{ color: colors.text.primary }} className="font-bold text-lg">{order.orderNumber}</Text>
                  <Pressable
                    onPress={() => setShowStatusModal(true)}
                    className="active:opacity-80"
                    style={{ backgroundColor: badgeBgColor, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}
                  >
                    <Text style={{ color: badgeTextColor, fontSize: 12, fontWeight: '700' }}>
                      {displayStatus}
                    </Text>
                  </Pressable>
                </View>
                <Text style={{ color: colors.text.muted }} className="text-xs mt-0.5">{orderDate}</Text>
              </View>
              <Pressable
                onPress={() => {
                  void handleOpenThread();
                }}
                className="w-10 h-10 rounded-full items-center justify-center mr-2 active:opacity-70"
                style={{ backgroundColor: colors.bg.secondary, position: 'relative' }}
              >
                <MessageSquare size={18} color={colors.text.primary} strokeWidth={2} />
                <View
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: orderThreadQuery.data ? '#EF4444' : '#9CA3AF',
                  }}
                />
              </Pressable>
              <Pressable
                onPress={() => setShowHeaderActionMenu(true)}
                className="w-10 h-10 rounded-full items-center justify-center active:opacity-70"
                style={{ backgroundColor: colors.bg.secondary }}
              >
                <MoreVertical size={18} color={colors.text.primary} strokeWidth={2} />
              </Pressable>
            </View>
          </View>
        )}

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          style={{ backgroundColor: isWebDesktop ? colors.bg.primary : colors.bg.secondary }}
          contentContainerStyle={{
            paddingBottom: isWebDesktop ? 40 : Math.max(24, insets.bottom + 140),
            width: '100%',
            maxWidth: isWebDesktop ? webMaxWidth : undefined,
            alignSelf: isWebDesktop ? 'flex-start' : undefined,
            paddingHorizontal: isWebDesktop ? 28 : 0,
          }}
        >
          {isWebDesktop ? (
            <View style={{ flexDirection: 'row', gap: 24 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                {customerSection}
                {itemsSection}
                {sourcePaymentSection}
                {logisticsSection}
                {prescriptionSection}
                {refundSection}
              </View>
              <View style={{ width: rightColumnWidth ?? 420 }}>
                {updateStatusSection}
                {casesSection}
                {printLabelSection}
                {staffActivitySection}
              </View>
            </View>
          ) : (
            <>
              {customerSection}
              {itemsSection}
              {sourcePaymentSection}
              {logisticsSection}
              {prescriptionSection}
              {refundSection}
              {casesSection}
              {printLabelSection}
              {updateStatusSection}
              {staffActivitySection}
            </>
          )}

        </ScrollView>

        {/* Sticky Save */}
        {!isWebDesktop ? (
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border.light, backgroundColor: colors.bg.primary }}>
            <View
              style={{
                paddingHorizontal: 20,
                paddingTop: 12,
                paddingBottom: Math.max(12, insets.bottom + 12),
                width: '100%',
              }}
            >
              <Button onPress={handleSaveAll} disabled={!hasUnsavedChanges}>
                Save Changes
              </Button>
            </View>
          </View>
        ) : null}

        <Modal
          visible={showHeaderActionMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setShowHeaderActionMenu(false)}
        >
          <Pressable
            className="flex-1"
            style={{ backgroundColor: 'transparent' }}
            onPress={() => setShowHeaderActionMenu(false)}
          >
            <Pressable
              onPress={(event) => event.stopPropagation()}
              style={{
                position: 'absolute',
                top: Math.max(8, insets.top + 46),
                right: 16,
                width: 210,
                borderRadius: 16,
                overflow: 'hidden',
                backgroundColor: colors.bg.card,
                borderWidth: 1,
                borderColor: colors.border.light,
                shadowColor: '#000000',
                shadowOpacity: 0.16,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 8 },
                elevation: 14,
              }}
            >
              <Pressable
                onPress={handleOpenEdit}
                className="active:opacity-80"
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 48 }}
              >
                <Edit2 size={18} color={colors.text.secondary} strokeWidth={2} />
                <Text style={{ color: colors.text.primary, fontSize: 16, fontWeight: '600', marginLeft: 12 }}>
                  Edit Order
                </Text>
              </Pressable>
              <View style={{ height: 1, backgroundColor: colors.border.light, marginHorizontal: 14 }} />
              <Pressable
                onPress={openDeletePrompt}
                className="active:opacity-80"
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 48 }}
              >
                <Trash2 size={18} color="#EF4444" strokeWidth={2} />
                <Text style={{ color: '#EF4444', fontSize: 16, fontWeight: '600', marginLeft: 12 }}>
                  Delete
                </Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal
          visible={showStatusModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowStatusModal(false)}
        >
          <Pressable
            className="flex-1 items-center justify-center"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
            onPress={() => setShowStatusModal(false)}
          >
            <Pressable
              onPress={(event) => event.stopPropagation()}
              className="w-[90%] rounded-2xl overflow-hidden"
              style={{ backgroundColor: colors.bg.primary, maxWidth: 420 }}
            >
              <View className="px-5 py-4" style={{ borderBottomWidth: 1, borderBottomColor: colors.border.light }}>
                <Text style={{ color: colors.text.primary }} className="font-bold text-lg">Update Status</Text>
                <Text style={{ color: colors.text.tertiary }} className="text-sm mt-1">
                  Tap a status, then click Save Changes.
                </Text>
              </View>
              <View className="px-5 py-4">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {orderStatuses.map((status) => {
                    const currentStatus = baseOrder?.status ?? order.status;
                    const selectedStatus = draft.status ?? currentStatus;
                    const isSelected = selectedStatus === status.name;
                    return (
                      <Pressable
                        key={status.id}
                        onPress={() => handleUpdateStatus(status.name)}
                        className="rounded-full px-3 py-2 active:opacity-80"
                        style={isSelected ? { backgroundColor: status.color } : { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.light }}
                      >
                        <Text style={{ color: isSelected ? '#FFFFFF' : colors.text.secondary }} className="text-sm font-semibold">
                          {status.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal
          visible={showDeletePrompt}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDeletePrompt(false)}
        >
          <Pressable
            className="flex-1 items-center justify-center"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
            onPress={() => setShowDeletePrompt(false)}
          >
            <Pressable
              onPress={(event) => event.stopPropagation()}
              className="w-[90%] rounded-2xl p-5"
              style={{ backgroundColor: '#FFFFFF', maxWidth: 420 }}
            >
              <Text className="text-lg font-bold text-gray-900 mb-2">Delete order?</Text>
              <Text className="text-sm text-gray-600 mb-4">
                This will permanently remove order {order.orderNumber}.
              </Text>
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => setShowDeletePrompt(false)}
                  className="flex-1 rounded-full items-center justify-center"
                  style={{ height: 48, backgroundColor: '#F3F4F6' }}
                >
                  <Text className="text-gray-700 font-semibold">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={confirmDelete}
                  className="flex-1 rounded-full items-center justify-center"
                  style={{ height: 48, backgroundColor: '#EF4444' }}
                >
                  <Text className="text-white font-semibold">Delete</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Edit Order Modal */}
        <Modal
          visible={showEditModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowEditModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1"
          >
            <Pressable
              className="flex-1 items-center justify-center"
              style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
              onPress={() => setShowEditModal(false)}
            >
              <Pressable
                onPress={(e) => e.stopPropagation()}
                className="w-[90%] rounded-2xl overflow-hidden"
                style={{ backgroundColor: colors.bg.primary, maxHeight: '85%', maxWidth: 400 }}
              >
                {/* Header */}
                <View className="flex-row items-center justify-between px-5 py-4" style={{ borderBottomWidth: 1, borderBottomColor: colors.border.light }}>
                  <Text style={{ color: colors.text.primary }} className="font-bold text-lg">Edit Order</Text>
                  <Pressable
                    onPress={() => setShowEditModal(false)}
                    className="w-8 h-8 rounded-full items-center justify-center active:opacity-50"
                    style={{ backgroundColor: colors.bg.secondary }}
                  >
                    <X size={18} color={colors.text.tertiary} strokeWidth={2} />
                  </Pressable>
                </View>

                <ScrollView className="px-5 py-4" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {/* Customer Name */}
                  <View className="mb-4">
                    <Text style={{ color: colors.text.primary }} className="text-sm font-medium mb-2">Customer Name</Text>
                    <View className="rounded-xl px-4" style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 52, justifyContent: 'center' }}>
                      <TextInput
                        placeholder="Customer Name"
                        placeholderTextColor={colors.input.placeholder}
                        value={editName}
                        onChangeText={setEditName}
                        style={{ color: colors.input.text, fontSize: 14 }}
                        selectionColor={colors.text.primary}
                      />
                    </View>
                  </View>

                  {/* Phone */}
                  <View className="mb-4">
                    <Text style={{ color: colors.text.primary }} className="text-sm font-medium mb-2">Phone</Text>
                    <View className="rounded-xl px-4" style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 52, justifyContent: 'center' }}>
                      <TextInput
                        placeholder="Phone Number"
                        placeholderTextColor={colors.input.placeholder}
                        value={editPhone}
                        onChangeText={setEditPhone}
                        keyboardType="phone-pad"
                        style={{ color: colors.input.text, fontSize: 14 }}
                        selectionColor={colors.text.primary}
                      />
                    </View>
                  </View>

                  {/* Email */}
                  <View className="mb-4">
                    <Text style={{ color: colors.text.primary }} className="text-sm font-medium mb-2">Email</Text>
                    <View className="rounded-xl px-4" style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 52, justifyContent: 'center' }}>
                      <TextInput
                        placeholder="Email Address"
                        placeholderTextColor={colors.input.placeholder}
                        value={editEmail}
                        onChangeText={setEditEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        style={{ color: colors.input.text, fontSize: 14 }}
                        selectionColor={colors.text.primary}
                      />
                    </View>
                  </View>

                  {/* Delivery State */}
                  <View className="mb-4">
                    <Text style={{ color: colors.text.primary }} className="text-sm font-medium mb-2">Delivery State</Text>
                    <Pressable
                      onPress={() => setShowStateDropdown(!showStateDropdown)}
                      className="rounded-xl px-4 flex-row items-center justify-between"
                      style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 52 }}
                    >
                      <Text style={{ color: editState ? colors.input.text : colors.input.placeholder }}>
                        {editState || 'Select State'}
                      </Text>
                      <ChevronDown size={18} color={colors.text.tertiary} strokeWidth={2} />
                    </Pressable>
                    {showStateDropdown && (
                      <ScrollView className="rounded-xl mt-2 overflow-hidden" style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light, maxHeight: 200 }}>
                        {NIGERIA_STATES.map((state) => (
                          <Pressable
                            key={state}
                            onPress={() => {
                              setEditState(state);
                              setShowStateDropdown(false);
                            }}
                            className="px-4 py-3 border-b active:opacity-70"
                            style={{ borderBottomColor: colors.border.light }}
                          >
                            <Text style={{ color: editState === state ? colors.text.primary : colors.text.tertiary }} className={cn('text-sm', editState === state && 'font-semibold')}>
                              {state}
                            </Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    )}
                  </View>

                  {/* Delivery Address */}
                  <View className="mb-4">
                    <Text style={{ color: colors.text.primary }} className="text-sm font-medium mb-2">Delivery Address</Text>
                    <View className="rounded-xl px-4 py-3" style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, minHeight: 80 }}>
                      <TextInput
                        placeholder="Full Address"
                        placeholderTextColor={colors.input.placeholder}
                        value={editAddress}
                        onChangeText={setEditAddress}
                        multiline
                        numberOfLines={3}
                        style={{ color: colors.input.text, fontSize: 14, textAlignVertical: 'top' }}
                        selectionColor={colors.text.primary}
                      />
                    </View>
                  </View>

                  {/* Website Order Ref (WooCommerce) */}
                  <View className="mb-4">
                    <Text style={{ color: colors.text.primary }} className="text-sm font-medium mb-2">Website Order Ref (WooCommerce)</Text>
                    <View className="rounded-xl px-4" style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 52, justifyContent: 'center' }}>
                      <TextInput
                        placeholder="e.g. WC #10234 (optional)"
                        placeholderTextColor={colors.input.placeholder}
                        value={editWebsiteOrderRef}
                        onChangeText={setEditWebsiteOrderRef}
                        style={{ color: colors.input.text, fontSize: 14 }}
                        selectionColor={colors.text.primary}
                      />
                    </View>
                  </View>

                  {/* Delivery Fee */}
                  <View className="mb-4">
                    <Text style={{ color: colors.text.primary }} className="text-sm font-medium mb-2">Delivery Fee</Text>
                    <View className="rounded-xl px-4 flex-row items-center" style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 52 }}>
                      <Text style={{ color: colors.input.placeholder, fontSize: 14, marginRight: 4 }}>₦</Text>
                      <TextInput
                        placeholder="0"
                        placeholderTextColor={colors.input.placeholder}
                        value={editDeliveryFee}
                        onChangeText={setEditDeliveryFee}
                        keyboardType="decimal-pad"
                        style={{ color: colors.input.text, fontSize: 14, flex: 1 }}
                        selectionColor={colors.text.primary}
                      />
                    </View>
                  </View>

                  {/* Discount Code */}
                  <View className="mb-4">
                    <Text style={{ color: colors.text.primary }} className="text-sm font-medium mb-2">Discount Code</Text>
                    <View className="rounded-xl px-4" style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 52, justifyContent: 'center' }}>
                      <TextInput
                        placeholder="Enter discount code (optional)"
                        placeholderTextColor={colors.input.placeholder}
                        value={editDiscountCode}
                        onChangeText={setEditDiscountCode}
                        autoCapitalize="characters"
                        style={{ color: colors.input.text, fontSize: 14 }}
                        selectionColor={colors.text.primary}
                      />
                    </View>
                  </View>

                  {/* Discount Amount */}
                  <View className="mb-4">
                    <Text style={{ color: colors.text.primary }} className="text-sm font-medium mb-2">Discount Amount</Text>
                    <View className="rounded-xl px-4 flex-row items-center" style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 52 }}>
                      <Text style={{ color: colors.input.placeholder, fontSize: 14, marginRight: 4 }}>₦</Text>
                      <TextInput
                        placeholder="0"
                        placeholderTextColor={colors.input.placeholder}
                        value={editDiscountAmount}
                        onChangeText={setEditDiscountAmount}
                        keyboardType="decimal-pad"
                        style={{ color: colors.input.text, fontSize: 14, flex: 1 }}
                        selectionColor={colors.text.primary}
                      />
                    </View>
                  </View>

                  {/* Products Section */}
                  <View className="mb-4">
                    <View className="flex-row items-center justify-between mb-2">
                      <Text style={{ color: colors.text.primary }} className="text-sm font-medium">Products</Text>
                      <Pressable
                        onPress={() => setShowProductSearch(!showProductSearch)}
                        className="px-3 py-1.5 rounded-full flex-row items-center active:opacity-70"
                        style={{ backgroundColor: colors.bg.secondary }}
                      >
                        <Plus size={14} color={colors.text.primary} strokeWidth={2} />
                        <Text style={{ color: colors.text.primary }} className="text-xs font-medium ml-1">Add</Text>
                      </Pressable>
                    </View>

                    {/* Product Search */}
                    {showProductSearch && (
                      <View className="mb-3">
                        <View className="flex-row items-center rounded-xl px-3" style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border }}>
                          <Search size={16} color={colors.input.placeholder} strokeWidth={2} />
                          <TextInput
                            placeholder="Search products..."
                            placeholderTextColor={colors.input.placeholder}
                            value={productSearchQuery}
                            onChangeText={setProductSearchQuery}
                            autoFocus
                            style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 8, color: colors.input.text, fontSize: 14 }}
                          />
                        </View>
                        {productSearchResults.length > 0 && (
                          <View className="mt-2 rounded-xl overflow-hidden" style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light, maxHeight: 150 }}>
                            <ScrollView nestedScrollEnabled>
                              {productSearchResults.map((result) => (
                                <Pressable
                                  key={`${result.productId}-${result.variantId}`}
                                  onPress={() => handleAddEditItem(result)}
                                  className="flex-row items-center p-3 border-b active:opacity-70"
                                  style={{ borderBottomColor: colors.border.light }}
                                >
                                  <View className="flex-1">
                                    <Text style={{ color: colors.text.primary }} className="text-sm font-medium">
                                      {result.productName} - {result.variantName}
                                    </Text>
                                    <Text style={{ color: result.stock > 0 ? '#10B981' : '#EF4444' }} className="text-xs">
                                      {result.stock > 0 ? `${result.stock} in stock` : 'Out of stock'}
                                    </Text>
                                  </View>
                                  <Text style={{ color: colors.text.primary }} className="text-sm font-bold">{formatCurrency(result.price)}</Text>
                                </Pressable>
                              ))}
                            </ScrollView>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Current Items */}
                    {editItems.length > 0 ? (
                      <View className="rounded-xl overflow-hidden" style={{ backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.light }}>
                        {editItems.map((item, index) => {
                          const { productName, variantName } = getEditItemDetails(item);
                          return (
                            <View
                              key={`${item.productId}-${item.variantId}`}
                              className="flex-row items-center p-3 border-b"
                              style={{ borderBottomColor: colors.border.light }}
                            >
                              <View className="flex-1">
                                <Text style={{ color: colors.text.primary }} className="text-sm font-medium">{productName}</Text>
                                <Text style={{ color: colors.text.muted }} className="text-xs">{variantName}</Text>
                              </View>
                              <View className="flex-row items-center rounded-lg mr-2" style={{ backgroundColor: colors.bg.card }}>
                                <Pressable onPress={() => handleUpdateEditItemQty(index, -1)} className="p-2 active:opacity-50">
                                  <Minus size={12} color={colors.text.primary} strokeWidth={2} />
                                </Pressable>
                                <Text style={{ color: colors.text.primary }} className="text-sm font-bold w-6 text-center">{item.quantity}</Text>
                                <Pressable onPress={() => handleUpdateEditItemQty(index, 1)} className="p-2 active:opacity-50">
                                  <Plus size={12} color={colors.text.primary} strokeWidth={2} />
                                </Pressable>
                              </View>
                              <Text style={{ color: colors.text.primary }} className="text-sm font-bold w-20 text-right">{formatCurrency(item.unitPrice * item.quantity)}</Text>
                              <Pressable onPress={() => handleRemoveEditItem(index)} className="ml-2 p-1 active:opacity-50">
                                <Trash2 size={14} color="#EF4444" strokeWidth={2} />
                              </Pressable>
                            </View>
                          );
                        })}
                      </View>
                    ) : (
                      <View className="py-6 items-center rounded-xl" style={{ backgroundColor: colors.bg.secondary }}>
                        <Package size={24} color={colors.text.muted} strokeWidth={1.5} />
                        <Text style={{ color: colors.text.muted }} className="text-sm mt-2">No products added</Text>
                      </View>
                    )}
                  </View>

                  {/* Payment Method */}
                  <View className="mb-4">
                    <Text style={{ color: colors.text.primary }} className="text-sm font-medium mb-2">Payment Method</Text>
                    <Pressable
                      onPress={() => setShowPaymentDropdown(!showPaymentDropdown)}
                      className="rounded-xl px-4 flex-row items-center justify-between"
                      style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 52 }}
                    >
                      <Text style={{ color: editPaymentMethod ? colors.input.text : colors.input.placeholder }}>
                        {editPaymentMethod || 'Select Payment Method'}
                      </Text>
                      <ChevronDown size={18} color={colors.text.tertiary} strokeWidth={2} />
                    </Pressable>
                    {showPaymentDropdown && (
                      <View className="rounded-xl mt-2 overflow-hidden" style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
                        {paymentMethods.map((method) => (
                          <Pressable
                            key={method.id}
                            onPress={() => {
                              setEditPaymentMethod(method.name);
                              setShowPaymentDropdown(false);
                            }}
                            className="px-4 py-3 border-b active:opacity-70"
                            style={{ borderBottomColor: colors.border.light }}
                          >
                            <Text style={{ color: editPaymentMethod === method.name ? colors.text.primary : colors.text.tertiary }} className={cn('text-sm', editPaymentMethod === method.name && 'font-semibold')}>
                              {method.name}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Sales Source */}
                  <View className="mb-4">
                    <Text style={{ color: colors.text.primary }} className="text-sm font-medium mb-2">Sales Source</Text>
                    <Pressable
                      onPress={() => setShowSourceDropdown(!showSourceDropdown)}
                      className="rounded-xl px-4 flex-row items-center justify-between"
                      style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 52 }}
                    >
                      <Text style={{ color: editSource ? colors.input.text : colors.input.placeholder }}>
                        {editSource || 'Select Source'}
                      </Text>
                      <ChevronDown size={18} color={colors.text.tertiary} strokeWidth={2} />
                    </Pressable>
                    {showSourceDropdown && (
                      <View className="rounded-xl mt-2 overflow-hidden" style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
                        {saleSources.map((source) => (
                          <Pressable
                            key={source.id}
                            onPress={() => {
                              setEditSource(source.name);
                              setShowSourceDropdown(false);
                            }}
                            className="px-4 py-3 border-b active:opacity-70"
                            style={{ borderBottomColor: colors.border.light }}
                          >
                            <Text style={{ color: editSource === source.name ? colors.text.primary : colors.text.tertiary }} className={cn('text-sm', editSource === source.name && 'font-semibold')}>
                              {source.name}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Order Total */}
                  <View className="mb-4 p-3 rounded-xl" style={{ backgroundColor: colors.bg.secondary }}>
                    <View className="flex-row justify-between mb-1">
                      <Text style={{ color: colors.text.tertiary }} className="text-sm">Subtotal</Text>
                      <Text style={{ color: colors.text.primary }} className="text-sm font-medium">{formatCurrency(editedSubtotal)}</Text>
                    </View>
                    <View className="flex-row justify-between mb-1">
                      <Text style={{ color: colors.text.tertiary }} className="text-sm">Delivery</Text>
                      <Text style={{ color: colors.text.primary }} className="text-sm font-medium">{formatCurrency(parseFloat(editDeliveryFee) || 0)}</Text>
                    </View>
                    {(parseFloat(editDiscountAmount) || 0) > 0 && (
                      <View className="flex-row justify-between mb-1">
                        <Text style={{ color: '#10B981' }} className="text-sm">Discount{editDiscountCode ? ` (${editDiscountCode})` : ''}</Text>
                        <Text style={{ color: '#10B981' }} className="text-sm font-medium">-{formatCurrency(parseFloat(editDiscountAmount) || 0)}</Text>
                      </View>
                    )}
                    <View className="flex-row justify-between pt-2 border-t" style={{ borderTopColor: colors.border.light }}>
                      <Text style={{ color: colors.text.primary }} className="text-base font-bold">Total</Text>
                      <Text style={{ color: colors.text.primary }} className="text-base font-bold">{formatCurrency(editedTotal)}</Text>
                    </View>
                  </View>

                  {/* Done (stages changes) */}
                  <Button onPress={handleSaveEdit} className="mb-4">
                    Done
                  </Button>
                </ScrollView>
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>

        {/* Logistics Modal */}
        <Modal
          visible={showLogisticsModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowLogisticsModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1"
          >
            <Pressable
              className="flex-1 items-center justify-center"
              style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
              onPress={() => setShowLogisticsModal(false)}
            >
              <Pressable
                onPress={(e) => e.stopPropagation()}
                className="w-[90%] rounded-2xl overflow-hidden"
                style={{ backgroundColor: colors.bg.primary, maxHeight: '85%', maxWidth: 400 }}
              >
                {/* Header */}
                <View className="flex-row items-center justify-between px-5 py-4" style={{ borderBottomWidth: 1, borderBottomColor: colors.border.light }}>
                  <Text style={{ color: colors.text.primary }} className="font-bold text-lg">Logistics Info</Text>
                  <Pressable
                    onPress={() => setShowLogisticsModal(false)}
                    className="w-8 h-8 rounded-full items-center justify-center active:opacity-50"
                    style={{ backgroundColor: colors.bg.secondary }}
                  >
                    <X size={18} color={colors.text.tertiary} strokeWidth={2} />
                  </Pressable>
                </View>

                <ScrollView className="px-5 py-4" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {/* Carrier Selection */}
                  <View className="mb-4">
                    <Text style={{ color: colors.text.primary }} className="text-sm font-medium mb-2">Carrier</Text>
                    <Pressable
                      onPress={() => setShowCarrierDropdown(!showCarrierDropdown)}
                      className="rounded-xl px-4 flex-row items-center justify-between"
                      style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 52 }}
                    >
                      <Text style={{ color: editCarrierName ? colors.input.text : colors.input.placeholder }}>
                        {editCarrierName || 'Select Carrier'}
                      </Text>
                      <ChevronDown size={18} color={colors.text.tertiary} strokeWidth={2} />
                    </Pressable>
                    {showCarrierDropdown && (
                      <View className="rounded-xl mt-2 overflow-hidden" style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
                        {logisticsCarriers.map((carrier) => (
                          <Pressable
                            key={carrier.id}
                            onPress={() => handleSelectCarrier(carrier.id, carrier.name)}
                            className="px-4 py-3 border-b active:opacity-70"
                            style={{ borderBottomColor: colors.border.light }}
                          >
                            <Text style={{ color: editCarrierId === carrier.id ? colors.text.primary : colors.text.tertiary }} className={cn('text-sm', editCarrierId === carrier.id && 'font-semibold')}>
                              {carrier.name}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Date Picked Up */}
                  <View className="mb-4">
                    <Text style={{ color: colors.text.primary }} className="text-sm font-medium mb-2">Date Picked Up/Shipped</Text>
                    <Pressable
                      onPress={() => {
                        console.log('[Logistics Calendar] Opening date picker on', Platform.OS);
                        setShowDatePicker(true);
                      }}
                      className="rounded-xl px-4 flex-row items-center justify-between"
                      style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 52 }}
                    >
                      <Text style={{ color: editDatePickedUp ? colors.input.text : colors.input.placeholder }}>
                        {editDatePickedUp ? editDatePickedUp.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Select date'}
                      </Text>
                      <Calendar size={18} color={colors.text.tertiary} strokeWidth={2} />
                    </Pressable>
                  </View>

                  {/* Tracking Number */}
                  <View className="mb-4">
                    <Text style={{ color: colors.text.primary }} className="text-sm font-medium mb-2">Tracking Number (Optional)</Text>
                    <View className="rounded-xl px-4" style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 52, justifyContent: 'center' }}>
                      <TextInput
                        placeholder="Enter tracking number"
                        placeholderTextColor={colors.input.placeholder}
                        value={editTrackingNumber}
                        onChangeText={setEditTrackingNumber}
                        autoCapitalize="characters"
                        style={{ color: colors.input.text, fontSize: 14 }}
                        selectionColor={colors.text.primary}
                      />
                    </View>
                  </View>

                  {/* Save (stages changes) */}
                  <Pressable
                    onPress={handleSaveLogistics}
                    className="mb-4 rounded-full items-center justify-center active:opacity-80"
                    style={{
                      height: 52,
                      backgroundColor: isDark ? '#FFFFFF' : '#111111',
                    }}
                  >
                    <Text
                      className="font-semibold text-base"
                      style={{ color: isDark ? '#111111' : '#FFFFFF' }}
                    >
                      Save
                    </Text>
                  </Pressable>
                </ScrollView>
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>

        {/* Logistics Date Picker Modal - Custom Calendar Grid */}
        <Modal
          visible={showDatePicker}
          animationType="fade"
          transparent
          onRequestClose={() => setShowDatePicker(false)}
        >
          <Pressable
            className="flex-1 items-center justify-center"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
            onPress={() => setShowDatePicker(false)}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              className="w-[90%] rounded-2xl overflow-hidden"
              style={{ backgroundColor: '#FFFFFF', maxWidth: 400 }}
            >
              {/* Header */}
              <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-200">
                <Text className="text-gray-900 font-bold text-lg">Select Pickup Date</Text>
                <Pressable
                  onPress={() => setShowDatePicker(false)}
                  className="w-8 h-8 rounded-full items-center justify-center active:opacity-50 bg-gray-100"
                >
                  <X size={18} color="#666666" strokeWidth={2} />
                </Pressable>
              </View>

              {/* Calendar View */}
              <View className="p-4">
                {/* Month/Year Navigation */}
                <View className="flex-row items-center justify-between mb-4">
                  <Pressable
                    onPress={() => {
                      const newDate = new Date(calendarViewDate);
                      newDate.setMonth(newDate.getMonth() - 1);
                      setCalendarViewDate(newDate);
                    }}
                    className="w-10 h-10 rounded-full items-center justify-center active:opacity-50 bg-gray-100"
                  >
                    <ChevronLeft size={20} color="#111111" strokeWidth={2} />
                  </Pressable>
                  <Text className="text-gray-900 font-bold text-base">
                    {calendarViewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                  </Text>
                  <Pressable
                    onPress={() => {
                      const newDate = new Date(calendarViewDate);
                      newDate.setMonth(newDate.getMonth() + 1);
                      setCalendarViewDate(newDate);
                    }}
                    className="w-10 h-10 rounded-full items-center justify-center active:opacity-50 bg-gray-100"
                  >
                    <ChevronRight size={20} color="#111111" strokeWidth={2} />
                  </Pressable>
                </View>

                {/* Day Labels */}
                <View className="flex-row mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <View key={day} className="flex-1 items-center py-2">
                      <Text className="text-gray-500 text-xs font-semibold">{day}</Text>
                    </View>
                  ))}
                </View>

                {/* Calendar Grid */}
                {(() => {
                  const year = calendarViewDate.getFullYear();
                  const month = calendarViewDate.getMonth();
                  const firstDay = new Date(year, month, 1).getDay();
                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  const today = new Date();

                  const weeks: (number | null)[][] = [];
                  let currentWeek: (number | null)[] = [];

                  // Fill in empty slots before first day
                  for (let i = 0; i < firstDay; i++) {
                    currentWeek.push(null);
                  }

                  // Fill in days
                  for (let day = 1; day <= daysInMonth; day++) {
                    currentWeek.push(day);
                    if (currentWeek.length === 7) {
                      weeks.push(currentWeek);
                      currentWeek = [];
                    }
                  }

                  // Fill in remaining slots
                  if (currentWeek.length > 0) {
                    while (currentWeek.length < 7) {
                      currentWeek.push(null);
                    }
                    weeks.push(currentWeek);
                  }

                  return weeks.map((week, weekIndex) => (
                    <View key={weekIndex} className="flex-row">
                      {week.map((day, dayIndex) => {
                        if (day === null) {
                          return <View key={dayIndex} className="flex-1 items-center py-2" />;
                        }

                        const isSelected = editDatePickedUp &&
                          editDatePickedUp.getDate() === day &&
                          editDatePickedUp.getMonth() === month &&
                          editDatePickedUp.getFullYear() === year;
                        const isToday = today.getDate() === day &&
                          today.getMonth() === month &&
                          today.getFullYear() === year;

                        return (
                          <Pressable
                            key={dayIndex}
                            onPress={() => {
                              const newDate = new Date(year, month, day, 12, 0, 0);
                              setEditDatePickedUp(newDate);
                            }}
                            className={cn(
                              'flex-1 items-center py-2 mx-0.5 my-0.5 rounded-lg',
                              isSelected && 'bg-gray-900',
                              !isSelected && 'active:bg-gray-100'
                            )}
                          >
                            <Text className={cn(
                              'text-sm font-medium',
                              isSelected ? 'text-white' : 'text-gray-900',
                              isToday && !isSelected && 'text-blue-600 font-bold'
                            )}>
                              {day}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ));
                })()}

                {/* Confirm Button */}
                <View className="flex-row mt-4 gap-3">
                  <Pressable
                    onPress={() => {
                      setEditDatePickedUp(null);
                      setShowDatePicker(false);
                    }}
                    className="flex-1 py-3 rounded-full items-center bg-gray-200"
                  >
                    <Text className="text-gray-700 font-semibold">Clear</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setShowDatePicker(false)}
                    className="flex-1 py-3 rounded-full items-center bg-gray-900"
                  >
                    <Text className="text-white font-semibold">Done</Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Refund Request Modal */}
        <Modal
          visible={showRefundRequestModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowRefundRequestModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1"
          >
            <Pressable
              className="flex-1 items-center justify-center"
              style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
              onPress={() => setShowRefundRequestModal(false)}
            >
              <Pressable
                onPress={(e) => e.stopPropagation()}
                className="w-[90%] rounded-2xl overflow-hidden"
                style={{ backgroundColor: colors.bg.primary, maxHeight: '85%', maxWidth: 400 }}
              >
                <View className="flex-row items-center justify-between px-5 py-4" style={{ borderBottomWidth: 1, borderBottomColor: colors.border.light }}>
                  <Text style={{ color: colors.text.primary }} className="font-bold text-lg">Refund Request</Text>
                  <Pressable
                    onPress={() => setShowRefundRequestModal(false)}
                    className="w-8 h-8 rounded-full items-center justify-center active:opacity-50"
                    style={{ backgroundColor: colors.bg.secondary }}
                  >
                    <X size={18} color={colors.text.tertiary} strokeWidth={2} />
                  </Pressable>
                </View>

                <ScrollView className="px-5 py-4" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <View className="mb-4">
                    <Text style={{ color: colors.text.primary }} className="text-sm font-medium mb-2">Refund Amount *</Text>
                    <View className="rounded-xl px-4 flex-row items-center" style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 52 }}>
                      <Text style={{ color: colors.input.placeholder, fontSize: 14, marginRight: 4 }}>₦</Text>
                      <TextInput
                        placeholder="0"
                        placeholderTextColor={colors.input.placeholder}
                        value={refundAmount}
                        onChangeText={setRefundAmount}
                        keyboardType="decimal-pad"
                        style={{ color: colors.input.text, fontSize: 14, flex: 1 }}
                        selectionColor={colors.text.primary}
                      />
                    </View>
                    <Text style={{ color: colors.text.muted }} className="text-xs mt-1">
                      Remaining refundable: {formatCurrency(Math.max(0, order.totalAmount - (order.refund?.amount ?? 0)))}
                    </Text>
                  </View>

                  <View className="mb-4 rounded-xl px-4 py-3" style={{ borderWidth: 1, borderColor: colors.input.border, backgroundColor: colors.input.bg }}>
                    <Pressable
                      onPress={() => setApplyRefundBankCharges((value) => !value)}
                      className="flex-row items-center justify-between"
                    >
                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <Text style={{ color: colors.text.primary }} className="text-sm font-semibold">Apply bank charges</Text>
                        <Text style={{ color: colors.text.muted }} className="text-xs mt-1">
                          Include transfer fee, VAT and stamp duty in debit total
                        </Text>
                      </View>
                      <View style={{ width: 38, height: 22, borderRadius: 11, backgroundColor: applyRefundBankCharges ? '#F59E0B' : colors.border.light, justifyContent: 'center', paddingHorizontal: 2 }}>
                        <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFFFFF', marginLeft: applyRefundBankCharges ? 16 : 0 }} />
                      </View>
                    </Pressable>
                    {applyRefundBankCharges ? (
                      <View style={{ marginTop: 12, gap: 6 }}>
                        <View className="flex-row items-center justify-between">
                          <Text style={{ color: colors.text.muted }} className="text-xs">NIP fee + VAT</Text>
                          <Text style={{ color: colors.text.secondary }} className="text-xs font-semibold">{formatCurrency(refundBankChargeAmount)}</Text>
                        </View>
                        <View className="flex-row items-center justify-between">
                          <Text style={{ color: colors.text.muted }} className="text-xs">Stamp duty</Text>
                          <Text style={{ color: colors.text.secondary }} className="text-xs font-semibold">{formatCurrency(refundStampDuty)}</Text>
                        </View>
                      </View>
                    ) : (
                      <Text style={{ color: colors.text.muted }} className="text-xs mt-2">Bank charges are turned off for this refund.</Text>
                    )}
                    <View className="flex-row items-center justify-between mt-3 pt-3" style={{ borderTopWidth: 1, borderTopColor: colors.border.light }}>
                      <Text style={{ color: colors.text.primary }} className="text-sm font-semibold">Total debit</Text>
                      <Text style={{ color: colors.text.primary }} className="text-sm font-bold">{formatCurrency(refundTotalDebit)}</Text>
                    </View>
                  </View>

                  <View className="mb-4">
                    <Text style={{ color: colors.text.primary }} className="text-sm font-medium mb-2">Requested Refund Date *</Text>
                    {Platform.OS === 'web' ? (
                      <View
                        className="rounded-xl px-4 flex-row items-center"
                        style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 52 }}
                      >
                        <input
                          type="date"
                          value={refundDate.toISOString().split('T')[0]}
                          onChange={(e) => {
                            const dateValue = e.target.value;
                            if (dateValue) {
                              const [year, month, day] = dateValue.split('-').map(Number);
                              const newDate = new Date(year, month - 1, day, 12, 0, 0);
                              setRefundDate(newDate);
                            }
                          }}
                          style={{
                            width: '100%',
                            height: '100%',
                            fontSize: 14,
                            color: colors.input.text,
                            backgroundColor: 'transparent',
                            border: 'none',
                            outline: 'none',
                          }}
                        />
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => setShowRefundDatePicker(true)}
                        className="rounded-xl px-4 flex-row items-center justify-between"
                        style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 52 }}
                      >
                        <Text style={{ color: colors.input.text }}>
                          {refundDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Text>
                        <Calendar size={18} color={colors.text.tertiary} strokeWidth={2} />
                      </Pressable>
                    )}
                  </View>

                  <View className="mb-4">
                    <Text style={{ color: colors.text.primary }} className="text-sm font-medium mb-2">Reason</Text>
                    <View className="rounded-xl px-4 py-3" style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, minHeight: 80 }}>
                      <TextInput
                        placeholder="Explain why the refund is needed"
                        placeholderTextColor={colors.input.placeholder}
                        value={refundReason}
                        onChangeText={setRefundReason}
                        multiline
                        numberOfLines={3}
                        style={{ color: colors.input.text, fontSize: 14, textAlignVertical: 'top' }}
                        selectionColor={colors.text.primary}
                      />
                    </View>
                  </View>

                  <View className="mb-4">
                    <Text style={{ color: colors.text.primary }} className="text-sm font-medium mb-2">Context screenshots (optional)</Text>
                    {refundRequestAttachments.length === 0 ? (
                      <Pressable
                        onPress={() => { void handlePickRefundRequestAttachment(); }}
                        className="rounded-2xl items-center justify-center"
                        style={{
                          minHeight: 136,
                          borderWidth: 1,
                          borderStyle: 'dashed',
                          borderColor: colors.input.border,
                          backgroundColor: colors.input.bg,
                          paddingHorizontal: 20,
                          paddingVertical: 24,
                        }}
                      >
                        <View
                          className="rounded-full items-center justify-center mb-3"
                          style={{ width: 46, height: 46, backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.input.border }}
                        >
                          <Camera size={20} color={colors.text.tertiary} strokeWidth={2} />
                        </View>
                        <Text style={{ color: colors.text.primary, fontSize: 15, fontWeight: '600' }}>Upload screenshot</Text>
                        <Text style={{ color: colors.text.muted, fontSize: 12, marginTop: 4, textAlign: 'center' }}>
                          Optional context for the refund reason. Refund proof is uploaded after approval.
                        </Text>
                      </Pressable>
                    ) : (
                      <View style={{ gap: 10 }}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 4 }}>
                          {refundRequestAttachments.map((attachment) => (
                            <View key={attachment.id} style={{ width: 110 }}>
                              <View
                                className="rounded-2xl overflow-hidden"
                                style={{
                                  height: 110,
                                  borderWidth: 1,
                                  borderColor: colors.input.border,
                                  backgroundColor: colors.input.bg,
                                  position: 'relative',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                {attachment.localUri ? (
                                  <Image source={{ uri: attachment.localUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                ) : (
                                  <View className="items-center justify-center px-3">
                                    <FileText size={22} color={colors.text.tertiary} strokeWidth={2} />
                                    <Text style={{ color: colors.text.secondary, fontSize: 11, marginTop: 8, textAlign: 'center' }} numberOfLines={2}>
                                      {attachment.fileName}
                                    </Text>
                                  </View>
                                )}
                                <Pressable
                                  onPress={() => {
                                    setRefundRequestAttachments((previous) => previous.filter((item) => item.id !== attachment.id));
                                    setRefundRequestUploadError('');
                                  }}
                                  className="rounded-full items-center justify-center"
                                  style={{
                                    position: 'absolute',
                                    top: 8,
                                    right: 8,
                                    width: 28,
                                    height: 28,
                                    backgroundColor: 'rgba(0, 0, 0, 0.55)',
                                  }}
                                >
                                  <X size={14} color="#FFFFFF" strokeWidth={2} />
                                </Pressable>
                              </View>
                              <Text style={{ color: colors.text.secondary, fontSize: 11, marginTop: 6, textAlign: 'center' }} numberOfLines={2}>
                                {attachment.fileName}
                              </Text>
                            </View>
                          ))}
                        </ScrollView>

                        <Pressable
                          onPress={() => { void handlePickRefundRequestAttachment(); }}
                          className="rounded-xl items-center justify-center"
                          style={{
                            height: 44,
                            borderWidth: 1,
                            borderStyle: 'dashed',
                            borderColor: colors.input.border,
                          }}
                        >
                          <Text style={{ color: colors.text.secondary, fontSize: 13, fontWeight: '600' }}>+ Add Another Image</Text>
                        </Pressable>
                      </View>
                    )}

                    {refundRequestUploadError ? (
                      <Text style={{ color: colors.accent.danger, fontSize: 12, marginTop: 8 }}>
                        {refundRequestUploadError}
                      </Text>
                    ) : null}
                  </View>

                  <View className="flex-row items-center justify-end mb-4" style={{ gap: 10 }}>
                    <Pressable
                      onPress={() => { void handleSubmitRefundRequest('save'); }}
                      className="rounded-full px-5"
                      style={{ height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border.light }}
                    >
                      <Text style={{ color: colors.text.secondary, fontWeight: '600' }}>Save Draft</Text>
                    </Pressable>
                    <Button
                      onPress={() => { void handleSubmitRefundRequest('submit'); }}
                      disabled={!refundAmount || parseFloat(refundAmount) <= 0}
                      variant="primary"
                      fullWidth={false}
                    >
                      Submit
                    </Button>
                  </View>
                </ScrollView>
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>

        {/* Refund Modal */}
        <Modal
          visible={showRefundModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowRefundModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1"
          >
            <Pressable
              className="flex-1 items-center justify-center"
              style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
              onPress={() => setShowRefundModal(false)}
            >
              <Pressable
                onPress={(e) => e.stopPropagation()}
                className="w-[90%] rounded-2xl overflow-hidden"
                style={{ backgroundColor: colors.bg.primary, maxHeight: '85%', maxWidth: 400 }}
              >
                {/* Header */}
                <View className="flex-row items-center justify-between px-5 py-4" style={{ borderBottomWidth: 1, borderBottomColor: colors.border.light }}>
                  <Text style={{ color: colors.text.primary }} className="font-bold text-lg">Refund</Text>
                  <Pressable
                    onPress={() => setShowRefundModal(false)}
                    className="w-8 h-8 rounded-full items-center justify-center active:opacity-50"
                    style={{ backgroundColor: colors.bg.secondary }}
                  >
                    <X size={18} color={colors.text.tertiary} strokeWidth={2} />
                  </Pressable>
                </View>

                <ScrollView className="px-5 py-4" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {/* Refund Amount */}
                  <View className="mb-4">
                    <Text style={{ color: colors.text.primary }} className="text-sm font-medium mb-2">Refund Amount *</Text>
                    <View className="rounded-xl px-4 flex-row items-center" style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 52 }}>
                      <Text style={{ color: colors.input.placeholder, fontSize: 14, marginRight: 4 }}>₦</Text>
                      <TextInput
                        placeholder="0"
                        placeholderTextColor={colors.input.placeholder}
                        value={refundAmount}
                        onChangeText={setRefundAmount}
                        keyboardType="decimal-pad"
                        style={{ color: colors.input.text, fontSize: 14, flex: 1 }}
                        selectionColor={colors.text.primary}
                      />
                    </View>
                    <Text style={{ color: colors.text.muted }} className="text-xs mt-1">Order total: {formatCurrency(order.totalAmount)}</Text>
                  </View>

                  {/* Refund Date */}
                  <View className="mb-4">
                    <Text style={{ color: colors.text.primary }} className="text-sm font-medium mb-2">Refund Date *</Text>
                    {Platform.OS === 'web' ? (
                      /* Web fallback - HTML date input */
                      <View
                        className="rounded-xl px-4 flex-row items-center"
                        style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 52 }}
                      >
                        <input
                          type="date"
                          value={refundDate.toISOString().split('T')[0]}
                          onChange={(e) => {
                            const dateValue = e.target.value;
                            if (dateValue) {
                              const [year, month, day] = dateValue.split('-').map(Number);
                              const newDate = new Date(year, month - 1, day, 12, 0, 0);
                              setRefundDate(newDate);
                            }
                          }}
                          style={{
                            width: '100%',
                            height: '100%',
                            fontSize: 14,
                            color: colors.input.text,
                            backgroundColor: 'transparent',
                            border: 'none',
                            outline: 'none',
                          }}
                        />
                      </View>
                    ) : (
                      /* Native iOS/Android - Button to open picker */
                      <Pressable
                        onPress={() => setShowRefundDatePicker(true)}
                        className="rounded-xl px-4 flex-row items-center justify-between"
                        style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 52 }}
                      >
                        <Text style={{ color: colors.input.text }}>
                          {refundDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Text>
                        <Calendar size={18} color={colors.text.tertiary} strokeWidth={2} />
                      </Pressable>
                    )}
                  </View>

                  {/* Reason */}
                  <View className="mb-4">
                    <Text style={{ color: colors.text.primary }} className="text-sm font-medium mb-2">Reason</Text>
                    <View className="rounded-xl px-4 py-3" style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, minHeight: 80 }}>
                      <TextInput
                        placeholder="Enter refund reason"
                        placeholderTextColor={colors.input.placeholder}
                        value={refundReason}
                        onChangeText={setRefundReason}
                        multiline
                        numberOfLines={3}
                        style={{ color: colors.input.text, fontSize: 14, textAlignVertical: 'top' }}
                        selectionColor={colors.text.primary}
                      />
                    </View>
                  </View>

                  {/* Proof Image */}
                  <View className="mb-4">
                    <Text style={{ color: colors.text.primary }} className="text-sm font-medium mb-2">Proof (Screenshot of Transfer)</Text>
                    {refundProofUri ? (
                      <View className="rounded-xl overflow-hidden" style={{ borderWidth: 1, borderColor: colors.border.light }}>
                        <Image source={{ uri: refundProofUri }} style={{ width: '100%', height: 150 }} resizeMode="cover" />
                        <Pressable
                          onPress={() => setRefundProofUri('')}
                          className="absolute top-2 right-2 w-8 h-8 rounded-full items-center justify-center"
                          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
                        >
                          <X size={16} color="#FFFFFF" strokeWidth={2} />
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable
                        onPress={handlePickRefundProof}
                        className="rounded-xl items-center justify-center py-6 active:opacity-70"
                        style={{ backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.light, borderStyle: 'dashed' }}
                      >
                        <Camera size={24} color={colors.text.tertiary} strokeWidth={1.5} />
                        <Text style={{ color: colors.text.tertiary }} className="text-sm mt-2">Upload proof image</Text>
                      </Pressable>
                    )}
                  </View>

                  {/* Done (stages changes) */}
                  <Button
                    onPress={handleSaveRefund}
                    disabled={!refundAmount || parseFloat(refundAmount) <= 0}
                    variant="danger"
                    className="mb-4"
                  >
                    Done
                  </Button>
                </ScrollView>
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>

        {/* Refund Date Picker Modal for iOS/Android */}
        {Platform.OS !== 'web' && showRefundDatePicker && (
          <Modal
            visible={showRefundDatePicker}
            animationType="fade"
            transparent
            onRequestClose={() => setShowRefundDatePicker(false)}
          >
            <Pressable
              className="flex-1 items-center justify-center"
              style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
              onPress={() => setShowRefundDatePicker(false)}
            >
              <Pressable
                onPress={(e) => e.stopPropagation()}
                className="w-[90%] rounded-2xl overflow-hidden"
                style={{ backgroundColor: '#FFFFFF', maxWidth: 400 }}
              >
                <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-200">
                  <Text className="text-gray-900 font-bold text-lg">Select Refund Date</Text>
                  <Pressable
                    onPress={() => setShowRefundDatePicker(false)}
                    className="w-8 h-8 rounded-full items-center justify-center active:opacity-50 bg-gray-100"
                  >
                    <X size={18} color="#666666" strokeWidth={2} />
                  </Pressable>
                </View>
                <View className="p-4 items-center">
                  <DateTimePicker
                    value={refundDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, date) => {
                      if (Platform.OS === 'android') {
                        setShowRefundDatePicker(false);
                      }
                      if (date) {
                        setRefundDate(date);
                      }
                    }}
                    style={{ width: '100%' }}
                    themeVariant="light"
                  />
                  {Platform.OS === 'ios' && (
                    <Pressable
                      onPress={() => setShowRefundDatePicker(false)}
                      className="mt-4 w-full py-3 rounded-full items-center bg-gray-900"
                    >
                      <Text className="text-white font-semibold">Done</Text>
                    </Pressable>
                  )}
                </View>
              </Pressable>
            </Pressable>
          </Modal>
        )}

        <CaseForm
          visible={showCaseForm}
          onClose={() => setShowCaseForm(false)}
          onSave={handleSaveCase}
          orderId={order.id}
          orderNumber={order.orderNumber}
          customerId={order.customerId}
          customerName={order.customerName}
          createdBy={currentUser?.name}
        />
      </SafeAreaView>

      {toast && (
        <View
          className="absolute left-5 right-5 items-center"
          style={{ top: Math.max(12, insets.top + 12), pointerEvents: 'none' }}
        >
          <View
            className="flex-row items-center px-5 py-4 rounded-xl"
            style={{ backgroundColor: toast.type === 'success' ? '#111111' : '#EF4444' }}
          >
            <View className="w-8 h-8 rounded-full items-center justify-center mr-3 bg-white">
              <Check size={18} color={toast.type === 'success' ? '#111111' : '#EF4444'} strokeWidth={2.5} />
            </View>
            <Text className="text-white font-semibold text-sm">{toast.message}</Text>
          </View>
        </View>
      )}
    </View>
  );
}
