import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Platform,
  Linking,
  Modal,
  KeyboardAvoidingView,
  ScrollView,
  TextInput,
  Image,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Package, Edit2, Phone, Mail, MapPin, Calendar, Tag, CreditCard, Truck, RefreshCcw, Printer, Trash2, FileText, Camera, ChevronRight, X, User as UserIcon, Check, MessageSquare, MoreVertical, Plus } from 'lucide-react-native';
import useFyllStore, { Case, formatCurrency, Refund, type Order, type RefundRequestStatus } from '@/lib/state/fyll-store';
import useAuthStore from '@/lib/state/auth-store';
import { useThemeColors } from '@/lib/theme';
import { DetailSection, DetailKeyValue } from './SplitViewLayout';
import { Button } from '@/components/Button';
import * as Haptics from 'expo-haptics';
import { CaseForm } from '@/components/CaseForm';
import { collaborationData } from '@/lib/supabase/collaboration';
import { sendThreadNotification } from '@/hooks/useWebPushNotifications';
import { formatRefundRequestStatusLabel, inferRefundRequestType } from '@/lib/refund-requests';
import * as ImagePicker from 'expo-image-picker';
import { compressImage } from '@/lib/image-compression';
import DateTimePicker from '@react-native-community/datetimepicker';
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

interface OrderDetailPanelProps {
  orderId: string;
  onClose?: () => void;
  disableRootFlex?: boolean;
}

const formatLogisticsDate = (dateString?: string) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export function OrderDetailPanel({ orderId, onClose, disableRootFlex = false }: OrderDetailPanelProps) {
  const colors = useThemeColors();
  const isDark = colors.bg.primary === '#111111';
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const orders = useFyllStore((s) => s.orders);
  const products = useFyllStore((s) => s.products);
  const orderStatuses = useFyllStore((s) => s.orderStatuses);
  const cases = useFyllStore((s) => s.cases);
  const refundRequests = useFyllStore((s) => s.refundRequests);
  const financeRules = useFyllStore((s) => s.financeRules);
  const addCase = useFyllStore((s) => s.addCase);
  const addRefundRequest = useFyllStore((s) => s.addRefundRequest);
  const updateCase = useFyllStore((s) => s.updateCase);
  const updateOrder = useFyllStore((s) => s.updateOrder);
  const deleteOrder = useFyllStore((s) => s.deleteOrder);
  const currentUser = useAuthStore((s) => s.currentUser);
  const teamMembers = useAuthStore((s) => s.teamMembers);
  const businessId = useAuthStore((s) => s.businessId ?? s.currentUser?.businessId ?? null);
  const isOfflineMode = useAuthStore((s) => s.isOfflineMode);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showHeaderActionMenu, setShowHeaderActionMenu] = useState(false);
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [editingCase, setEditingCase] = useState<Case | null>(null);
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

  // Business settings for label printing

  const [draft, setDraft] = useState<Partial<Order>>({});
  const baseOrder = useMemo(() => orders.find((o) => o.id === orderId), [orders, orderId]);
  const order = useMemo((): Order | undefined => {
    if (!baseOrder) return undefined;
    return { ...baseOrder, ...draft } as Order;
  }, [baseOrder, draft]);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const statusColor = useMemo(() => {
    const status = orderStatuses.find((s) => s.name === order?.status);
    return status?.color || '#6B7280';
  }, [orderStatuses, order?.status]);

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

  const orderThreadQuery = useQuery({
    queryKey: ['collaboration-thread-existing', businessId, 'order', order?.id],
    enabled: Boolean(businessId) && Boolean(order?.id) && !isOfflineMode,
    queryFn: () => collaborationData.getThreadByEntity(businessId as string, 'order', order!.id),
  });

  useEffect(() => {
    setDraft({});
  }, [orderId]);

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

  if (!order) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <Package size={48} color={colors.text.muted} strokeWidth={1.5} />
        <Text style={{ color: colors.text.muted, fontSize: 16, marginTop: 16 }}>
          Select an order to view details
        </Text>
      </View>
    );
  }

  const orderDateSource = order.orderDate ?? order.createdAt;
  const orderDate = new Date(orderDateSource).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const getItemDetails = (item: typeof order.items[0]) => {
    const product = products.find((p) => p.id === item.productId);
    const variant = product?.variants.find((v) => v.id === item.variantId);
    const variantName = variant ? Object.values(variant.variableValues).join(' / ') : '';
    return { productName: product?.name || 'Unknown', variantName, sku: variant?.sku || '' };
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

  const handleSaveAll = async () => {
    if (!hasUnsavedChanges) return;
    const updatedBy = currentUser?.name || currentUser?.email || 'Staff';
    const updatedAt = new Date().toISOString();
    try {
      await updateOrder(order.id, { ...draft, updatedBy, updatedAt }, businessId);
      setDraft({});
      showToast('success', isOfflineMode ? 'Saved locally (offline).' : 'Order updated.');
    } catch (error) {
      console.warn('Order save failed:', error);
      showToast('error', 'Could not save. Please try again.');
    }
  };

  const handleEdit = () => {
    setShowHeaderActionMenu(false);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push(`/order-edit/${order.id}`);
  };

  const handleOpenThread = async () => {
    setShowHeaderActionMenu(false);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

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
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setEditingCase(null);
    setShowCaseForm(true);
  };

  const handleSaveCase = async (caseData: Case) => {
    if (editingCase) {
      await updateCase(caseData.id, caseData, businessId);
    } else {
      await addCase(caseData, businessId);
    }
  };

  const handleDelete = () => {
    setShowHeaderActionMenu(false);
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
    deleteOrder(order.id, businessId);
    setPendingDelete(false);
    onClose?.();
  };

  const hasRefund = order.refund?.amount != null && order.refund.amount > 0;
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

  const handleOpenRefund = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (hasRefund) {
      setRefundAmount(String(order.refund?.amount ?? ''));
      if (order.refund?.date) {
        setRefundDate(new Date(order.refund.date));
      }
      setRefundReason(order.refund?.reason || '');
      setRefundProofUri(order.refund?.proofImageUri || '');
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

  const handlePrintLabel = () => {
    const carrierName = order.logistics?.carrierName?.trim();
    const carrierQuery = carrierName ? `&carrierName=${encodeURIComponent(carrierName)}` : '';
    router.push(`/order-label-preview?orderId=${order.id}${carrierQuery}`);
  };

  const handleUpdateStatus = (newStatus: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    mergeDraftUpdates({ status: newStatus });
    setShowStatusModal(false);
  };

  // Determine refund status
  const isFullRefund = order.refund && order.refund.amount >= order.totalAmount;
  const isPartialRefund = order.refund && order.refund.amount > 0 && order.refund.amount < order.totalAmount;

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
  }

  return (
    <View style={{ flex: disableRootFlex ? undefined : 1 }}>
      {/* Order Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <Text style={{ color: colors.text.primary, fontSize: 22, fontWeight: '700' }} numberOfLines={1}>
                {order.orderNumber}
              </Text>
              <Pressable
                onPress={() => setShowStatusModal(true)}
                className="active:opacity-80"
                style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: badgeBgColor }}
              >
                <Text style={{ color: badgeTextColor, fontSize: 12, fontWeight: '700' }}>
                  {displayStatus}
                </Text>
              </Pressable>
            </View>
            <Text style={{ color: colors.text.muted, fontSize: 13, marginTop: 4 }}>{orderDate}</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 10 }}>
            <Pressable
              onPress={() => {
                void handleOpenThread();
              }}
              className="active:opacity-70"
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.bg.secondary,
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
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
              className="active:opacity-70"
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.bg.secondary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MoreVertical size={18} color={colors.text.primary} strokeWidth={2} />
            </Pressable>
          </View>
        </View>
        {order.websiteOrderReference && (
          <Text style={{ color: colors.text.tertiary, fontSize: 12, marginTop: 4 }}>
            Website Ref: {order.websiteOrderReference}
          </Text>
        )}
      </View>

      {/* Customer Info */}
      <DetailSection title="Customer">
        <Text style={{ color: colors.text.primary, fontSize: 17, fontWeight: '600', marginBottom: 8 }}>
          {order.customerName}
        </Text>

        {order.customerPhone && (
          <Pressable
            onPress={() => Linking.openURL(`tel:${order.customerPhone}`)}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
          >
            <Phone size={14} color={colors.text.tertiary} strokeWidth={2} />
            <Text style={{ color: colors.text.secondary, fontSize: 14, marginLeft: 8 }}>{order.customerPhone}</Text>
          </Pressable>
        )}

        {order.customerEmail && (
          <Pressable
            onPress={() => Linking.openURL(`mailto:${order.customerEmail}`)}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
          >
            <Mail size={14} color={colors.text.tertiary} strokeWidth={2} />
            <Text style={{ color: colors.text.secondary, fontSize: 14, marginLeft: 8 }}>{order.customerEmail}</Text>
          </Pressable>
        )}

        {order.deliveryAddress && (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6 }}>
            <MapPin size={14} color={colors.text.tertiary} strokeWidth={2} style={{ marginTop: 2 }} />
            <Text style={{ color: colors.text.secondary, fontSize: 14, marginLeft: 8, flex: 1 }}>
              {order.deliveryAddress}
              {order.deliveryState && `, ${order.deliveryState}`}
            </Text>
          </View>
        )}
      </DetailSection>

      {/* Order Items */}
      <DetailSection title={`Items (${order.items.length})`}>
        {order.items.map((item, index) => {
          const { productName, variantName, sku } = getItemDetails(item);
          const serviceVariables = (item.serviceVariables ?? []).filter((variable) => (variable.value ?? '').toString().trim().length > 0);
          const serviceFields = (item.serviceFields ?? []).filter((field) => (field.value ?? '').toString().trim().length > 0);
          const hasServiceDetails = serviceVariables.length > 0 || serviceFields.length > 0;
          return (
            <View
              key={`${item.productId}-${item.variantId}`}
              style={{
                paddingVertical: 10,
                borderTopWidth: index > 0 ? 1 : 0,
                borderTopColor: colors.border.light,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.bg.secondary, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <Package size={20} color={colors.text.tertiary} strokeWidth={1.5} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '600' }}>{productName}</Text>
                  <Text style={{ color: colors.text.muted, fontSize: 12 }}>{variantName}</Text>
                  <Text style={{ color: colors.text.muted, fontSize: 12 }}>SKU: {sku}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '700' }}>
                    {formatCurrency(item.unitPrice * item.quantity)}
                  </Text>
                  <Text style={{ color: colors.text.muted, fontSize: 11 }}>
                    {item.quantity} x {formatCurrency(item.unitPrice)}
                  </Text>
                </View>
              </View>
              {hasServiceDetails && (
                <View
                  style={{
                    marginTop: 10,
                    marginLeft: 52,
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

        {/* Totals */}
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border.light, marginTop: 8, paddingTop: 12 }}>
          <DetailKeyValue label="Subtotal" value={formatCurrency(order.subtotal)} />
          {order.deliveryFee > 0 && (
            <DetailKeyValue label="Delivery Fee" value={formatCurrency(order.deliveryFee)} />
          )}
          {order.discountAmount && order.discountAmount > 0 && (
            <DetailKeyValue
              label={`Discount${order.discountCode ? ` (${order.discountCode})` : ''}`}
              value={`-${formatCurrency(order.discountAmount)}`}
              valueColor="#10B981"
            />
          )}
          {order.refund && order.refund.amount > 0 && (
            <DetailKeyValue
              label="Refund"
              value={`-${formatCurrency(order.refund.amount)}`}
              valueColor="#EF4444"
            />
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, marginTop: 4, borderTopWidth: 1, borderTopColor: colors.border.light }}>
            <Text style={{ color: colors.text.primary, fontSize: 16, fontWeight: '600' }}>Total</Text>
            <Text style={{ color: colors.text.primary, fontSize: 20, fontWeight: '700' }}>
              {formatCurrency(order.refund && order.refund.amount > 0 ? order.totalAmount - order.refund.amount : order.totalAmount)}
            </Text>
          </View>
        </View>
      </DetailSection>

      {/* Payment & Source */}
      <DetailSection title="Payment">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Tag size={14} color={colors.text.tertiary} strokeWidth={2} />
            <Text style={{ color: colors.text.secondary, fontSize: 14, marginLeft: 8 }}>{order.source}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <CreditCard size={14} color={colors.text.tertiary} strokeWidth={2} />
            <Text style={{ color: colors.text.secondary, fontSize: 14, marginLeft: 8 }}>{order.paymentMethod || 'Not set'}</Text>
          </View>
        </View>
      </DetailSection>

      {/* Logistics */}
      <DetailSection title="Logistics">
        <View className="flex-row items-center justify-end mb-3">
          <Pressable
            onPress={handleEdit}
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
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Truck size={16} color={colors.text.primary} strokeWidth={2} />
              <Text style={{ color: colors.text.primary, fontSize: 15, fontWeight: '600', marginLeft: 8 }}>
                {order.logistics.carrierName}
              </Text>
            </View>
            {order.logistics.trackingNumber && (
              <View style={{ backgroundColor: colors.bg.secondary, borderRadius: 10, padding: 12, marginBottom: 10 }}>
                <Text style={{ color: colors.text.muted, fontSize: 11, marginBottom: 4 }}>Tracking Number</Text>
                <Text style={{ color: colors.text.primary, fontSize: 14, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
                  {order.logistics.trackingNumber}
                </Text>
              </View>
            )}
            {(() => {
              const logisticsDate = order.logistics?.datePickedUp ?? order.logistics?.dispatchDate;
              if (!logisticsDate) return null;
              const logisticsLabel = order.logistics?.datePickedUp ? 'Picked up' : 'Dispatched';
              return (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Calendar size={14} color={colors.text.tertiary} strokeWidth={2} />
                  <Text style={{ color: colors.text.secondary, fontSize: 13, marginLeft: 8 }}>
                    {logisticsLabel} {formatLogisticsDate(logisticsDate)}
                  </Text>
                </View>
              );
            })()}
          </View>
        ) : (
          <View className="items-center py-3">
            <Truck size={20} color={colors.text.muted} strokeWidth={1.5} />
            <Text style={{ color: colors.text.muted }} className="text-sm mt-2">No logistics info yet</Text>
          </View>
        )}
      </DetailSection>

      {/* Prescription */}
      <DetailSection title="Prescription">
        <View className="flex-row items-center justify-end mb-3">
          <Pressable
            onPress={handleEdit}
            className="active:opacity-70"
            style={primaryActionPillStyle}
          >
            <Text style={primaryActionTextStyle}>
              {order.prescription ? 'Edit' : '+ Add'}
            </Text>
          </Pressable>
        </View>
        {order.prescription?.fileUrl || order.prescription?.text ? (
          <View>
            {order.prescription?.fileUrl && (
              <View style={{ backgroundColor: colors.bg.secondary, borderRadius: 10, padding: 12, marginBottom: 10 }}>
                <Text style={{ color: colors.text.muted, fontSize: 11, marginBottom: 4 }}>File</Text>
                <Text style={{ color: colors.text.primary, fontSize: 13 }} numberOfLines={1}>
                  Prescription file attached
                </Text>
              </View>
            )}
            {order.prescription?.text && (
              <View style={{ backgroundColor: colors.bg.secondary, borderRadius: 10, padding: 12 }}>
                <Text style={{ color: colors.text.muted, fontSize: 11, marginBottom: 6 }}>Notes</Text>
                <Text style={{ color: colors.text.primary, fontSize: 13 }} numberOfLines={4}>
                  {order.prescription.text}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View className="items-center py-3">
            <FileText size={20} color={colors.text.muted} strokeWidth={1.5} />
            <Text style={{ color: colors.text.muted }} className="text-sm mt-2">No prescription added</Text>
          </View>
        )}
      </DetailSection>

      {/* Refund */}
      <DetailSection title="Refund">
        <View className="flex-row items-center justify-end mb-3" style={{ gap: 8 }}>
          {canCreateRefundRequest ? (
            <Pressable
              onPress={handleOpenRefundRequest}
              className="active:opacity-80"
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
        {hasRefund ? (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
              <Text style={{ color: colors.text.tertiary }} className="text-sm">Amount Refunded</Text>
              <Text className="text-red-500 font-bold text-base">{formatCurrency(order.refund?.amount ?? 0)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
              <Calendar size={14} color={colors.text.tertiary} strokeWidth={2} />
              <Text style={{ color: colors.text.secondary, fontSize: 13, marginLeft: 8 }}>
                {order.refund?.date
                  ? new Date(order.refund.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                  : ''}
              </Text>
            </View>
            {order.refund?.reason && (
              <View style={{ backgroundColor: colors.bg.secondary, borderRadius: 10, padding: 10, marginTop: 8 }}>
                <Text style={{ color: colors.text.muted, fontSize: 11, marginBottom: 4 }}>Reason</Text>
                <Text style={{ color: colors.text.primary, fontSize: 13 }}>{order.refund.reason}</Text>
              </View>
            )}
          </View>
        ) : (
          <View className="items-center py-3">
            <RefreshCcw size={20} color={colors.text.muted} strokeWidth={1.5} />
            <Text style={{ color: colors.text.muted }} className="text-sm mt-2">No refund processed</Text>
          </View>
        )}
        {latestRefundRequest && latestRefundRequest.status !== 'paid' ? (
          <View style={{ backgroundColor: colors.bg.secondary, borderRadius: 12, padding: 12, marginTop: 10 }}>
            <View className="flex-row items-center justify-between" style={{ gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '700' }}>Latest refund request</Text>
                <Text style={{ color: colors.text.secondary, fontSize: 12, marginTop: 2 }}>
                  {formatCurrency(latestRefundRequest.amount)} requested on {new Date(latestRefundRequest.requestedDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
              </View>
              <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.bg.primary }}>
                <Text style={{ color: colors.text.primary, fontSize: 11, fontWeight: '700' }}>
                  {formatRefundRequestStatusLabel(latestRefundRequest)}
                </Text>
              </View>
            </View>
            {latestRefundRequest.reason ? (
              <Text style={{ color: colors.text.tertiary, fontSize: 12, marginTop: 8 }} numberOfLines={3}>
                {latestRefundRequest.reason}
              </Text>
            ) : null}
          </View>
        ) : null}
      </DetailSection>

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

                <View className="mb-4">
                  <Text style={{ color: colors.text.primary }} className="text-sm font-medium mb-2">Refund Date *</Text>
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

                <View className="mb-4">
                  <Text style={{ color: colors.text.primary }} className="text-sm font-medium mb-2">Proof (Screenshot of Transfer)</Text>
                  {refundProofUri ? (
                    <View className="rounded-xl overflow-hidden relative" style={{ borderWidth: 1, borderColor: colors.border.light }}>
                      <Image source={{ uri: refundProofUri }} style={{ width: '100%', height: 150 }} resizeMode="cover" />
                      <Pressable
                        onPress={() => setRefundProofUri('')}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full items-center justify-center active:opacity-70"
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
              style={{ backgroundColor: colors.bg.card, maxWidth: 400 }}
            >
              <View className="flex-row items-center justify-between px-5 py-4 border-b" style={{ borderBottomColor: colors.border.light }}>
                <Text style={{ color: colors.text.primary }} className="font-bold text-lg">Select Refund Date</Text>
                <Pressable
                  onPress={() => setShowRefundDatePicker(false)}
                  className="w-8 h-8 rounded-full items-center justify-center active:opacity-50"
                  style={{ backgroundColor: colors.bg.secondary }}
                >
                  <X size={18} color={colors.text.tertiary} strokeWidth={2} />
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
                  themeVariant={colors.bg.primary === '#111111' ? 'dark' : 'light'}
                />
                {Platform.OS === 'ios' && (
                  <View className="flex-row w-full gap-3 mt-4">
                    <Pressable
                      onPress={() => {
                        setRefundDate(new Date());
                        setShowRefundDatePicker(false);
                      }}
                      className="flex-1 py-3 rounded-full items-center"
                      style={{ backgroundColor: colors.bg.secondary }}
                    >
                      <Text className="font-semibold" style={{ color: colors.text.secondary }}>Today</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setShowRefundDatePicker(false)}
                      className="flex-1 py-3 rounded-full items-center"
                      style={{ backgroundColor: colors.text.primary }}
                    >
                      <Text className="font-semibold" style={{ color: colors.bg.primary }}>Done</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* Cases */}
      <DetailSection title="Cases">
        <View className="flex-row items-center justify-between mb-3">
          <Text style={{ color: colors.text.primary }} className="text-sm font-semibold">
            Linked Cases
          </Text>
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
                style={{ backgroundColor: colors.bg.secondary }}
              >
                <Text style={{ color: colors.text.primary, fontWeight: '600' }}>{caseItem.caseNumber}</Text>
                <ChevronRight size={18} color={colors.text.tertiary} strokeWidth={2} />
              </Pressable>
            ))}
          </View>
        ) : (
          <View className="items-center py-4">
            <FileText size={22} color={colors.text.muted} strokeWidth={1.5} />
            <Text style={{ color: colors.text.muted }} className="text-sm mt-2">No cases yet</Text>
          </View>
        )}
      </DetailSection>

      {/* Staff Activity */}
      {(order.createdBy || order.updatedBy || (order.activityLog && order.activityLog.length > 0)) && (
        <DetailSection title="Staff Activity">
          {/* Created by entry */}
          {order.createdBy && (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border.light }}>
              <UserIcon size={14} color={colors.text.tertiary} strokeWidth={2} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '500' }}>{order.createdBy}</Text>
                <Text style={{ color: colors.text.muted, fontSize: 11 }}>Created order</Text>
                <Text style={{ color: colors.text.tertiary, fontSize: 10, marginTop: 1 }}>
                  {new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(order.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          )}
          {/* Activity log entries */}
          {order.activityLog?.map((entry, index) => (
            <View
              key={`${entry.date}-${index}`}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                paddingVertical: 6,
                borderBottomWidth: index < (order.activityLog?.length ?? 0) - 1 ? 1 : 0,
                borderBottomColor: colors.border.light,
              }}
            >
              <UserIcon size={14} color={colors.text.tertiary} strokeWidth={2} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '500' }}>{entry.staffName}</Text>
                <Text style={{ color: colors.text.muted, fontSize: 11 }}>{entry.action}</Text>
                <Text style={{ color: colors.text.tertiary, fontSize: 10, marginTop: 1 }}>
                  {new Date(entry.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(entry.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          ))}
          {/* Fallback: show updatedBy if no activity log yet */}
          {!order.activityLog?.length && order.updatedBy && (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6 }}>
              <UserIcon size={14} color={colors.text.tertiary} strokeWidth={2} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '500' }}>{order.updatedBy}</Text>
                <Text style={{ color: colors.text.muted, fontSize: 11 }}>Last updated</Text>
                {order.updatedAt && (
                  <Text style={{ color: colors.text.tertiary, fontSize: 10, marginTop: 1 }}>
                    {new Date(order.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(order.updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                )}
              </View>
            </View>
          )}
        </DetailSection>
      )}

      {/* Update Status */}
      <DetailSection title="Update Status">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {orderStatuses.map((status) => {
            const currentStatus = baseOrder?.status ?? order.status;
            const activeStatus = draft.status ?? currentStatus;
            const isSelected = activeStatus === status.name;
            return (
              <Pressable
                key={status.id}
                onPress={() => handleUpdateStatus(status.name)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: isSelected ? status.color : colors.bg.secondary,
                  borderWidth: isSelected ? 0 : 1,
                  borderColor: colors.border.light,
                }}
              >
                <Text
                  style={{
                    color: isSelected ? '#FFFFFF' : colors.text.secondary,
                    fontSize: 13,
                    fontWeight: '600',
                  }}
                >
                  {status.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </DetailSection>

      {/* Actions */}
      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, gap: 12 }}>
        <Button onPress={handleSaveAll} disabled={!hasUnsavedChanges}>
          Save Changes
        </Button>
        <Pressable
          onPress={handlePrintLabel}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            height: 48,
            borderRadius: 999,
            backgroundColor: isDark ? '#FFFFFF' : '#111111',
          }}
        >
          <Printer size={18} color={isDark ? '#111111' : '#FFFFFF'} strokeWidth={2} />
          <Text style={{ color: isDark ? '#111111' : '#FFFFFF', fontSize: 15, fontWeight: '600', marginLeft: 8 }}>
            Print Shipping Label
          </Text>
        </Pressable>
      </View>

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
              top: Math.max(8, insets.top + 54),
              right: 20,
              width: 220,
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
              onPress={handleEdit}
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
              onPress={handleDelete}
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
        animationType="fade"
        transparent
        onRequestClose={() => setShowStatusModal(false)}
      >
        <Pressable
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          onPress={() => setShowStatusModal(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="w-[90%] rounded-2xl overflow-hidden"
            style={{ backgroundColor: colors.bg.primary, maxWidth: 360 }}
          >
            <View className="px-5 py-4" style={{ borderBottomWidth: 1, borderBottomColor: colors.border.light }}>
              <Text style={{ color: colors.text.primary }} className="font-bold text-lg">Update Status</Text>
              <Text style={{ color: colors.text.tertiary }} className="text-sm mt-1">
                Tap a status, then use Save Changes at the bottom.
              </Text>
            </View>
            <View className="px-5 py-4" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {orderStatuses.map((status) => {
                const currentStatus = baseOrder?.status ?? order.status;
                const activeStatus = draft.status ?? currentStatus;
                const isSelected = activeStatus === status.name;
                return (
                  <Pressable
                    key={status.id}
                    onPress={() => {
                      handleUpdateStatus(status.name);
                    }}
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
          </Pressable>
        </Pressable>
      </Modal>

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
              <Text style={{ color: colors.text.primary }} className="font-bold text-lg">Delete Order</Text>
              <Text style={{ color: colors.text.tertiary }} className="text-sm mt-1">
                {order.orderNumber ? `Delete ${order.orderNumber}?` : 'Delete this order?'}
              </Text>
            </View>
            <View className="px-5 py-4 flex-row gap-3">
              <Pressable
                onPress={() => setPendingDelete(false)}
                className="flex-1 rounded-full items-center"
                style={{ backgroundColor: colors.bg.secondary, height: 48, justifyContent: 'center' }}
              >
                <Text style={{ color: colors.text.tertiary }} className="font-medium">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={confirmDelete}
                className="flex-1 rounded-full items-center"
                style={{ backgroundColor: '#EF4444', height: 48, justifyContent: 'center' }}
              >
                <Text className="text-white font-semibold">Delete</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <CaseForm
        visible={showCaseForm}
        onClose={() => setShowCaseForm(false)}
        onSave={handleSaveCase}
        orderId={order.id}
        orderNumber={order.orderNumber}
        customerId={order.customerId}
        customerName={order.customerName}
        existingCase={editingCase ?? undefined}
        createdBy={currentUser?.name}
      />

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
