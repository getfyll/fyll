import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Platform, Modal, TextInput, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Lock, Plus, Receipt, TrendingUp, TrendingDown, Truck, Trash2, MoreVertical, ChevronDown, ChevronLeft, ChevronRight, Search, Filter, Settings, Download, Pencil, X, Sparkles, Calendar, FileText, Camera, Check, Clock, Paperclip, Image as ImageIcon, ShoppingCart, User, Shield, ArrowLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import useFyllStore, {
  type Expense,
  type ExpensePaymentStatus,
  type ExpenseRequest,
  type ExpenseRequestReceipt,
  type ExpenseRequestStatus,
  type RefundRequest,
  type RefundRequestStatus,
  type Procurement,
  type ProcurementAttachment,
  type ProcurementStatusOption,
  type FixedCostSetting,
  type FixedCostFrequency,
  type BankChargeTier,
  formatCurrency,
} from '@/lib/state/fyll-store';
import useAuthStore from '@/lib/state/auth-store';
import { useResolvedThemeMode, useStatsColors } from '@/lib/theme';
import { useTabBarHeight } from '@/lib/useTabBarHeight';
import { useBreakpoint } from '@/lib/useBreakpoint';
import { getStandardPageHeadingStyle } from '@/lib/page-heading';
import { InteractiveLineChart, type LineChartDatum } from '@/components/stats/InteractiveLineChart';
import { SalesBarChart } from '@/components/stats/SalesBarChart';
import { BreakdownTable } from '@/components/stats/BreakdownTable';
import { type FyllAiMetric } from '@/components/FyllAiAnalyticsCard';
import { FyllAiAssistantDrawer } from '@/components/FyllAiAssistantDrawer';
import { FyllAiButton } from '@/components/FyllAiButton';
import { supabase } from '@/lib/supabase';
import { supabaseData } from '@/lib/supabase/data';
import { compressImage } from '@/lib/image-compression';
import { parseExpenseDraft, parseMultipleExpenseDrafts, type ExpenseDraftData } from '@/lib/ai-expense-parser';
import { parseProcurementDraft, type ProcurementDraftData } from '@/lib/ai-procurement-parser';
import { askFyllAssistant, type FyllAssistantCard, type FyllAssistantResponse } from '@/lib/fyll-ai-assistant';
import { ExpenseDetailPanel } from '@/components/ExpenseDetailPanel';
import { ProcurementDetailPanel } from '@/components/ProcurementDetailPanel';
import { sendThreadNotification } from '@/hooks/useWebPushNotifications';
import {
  applyPaidRefundRequestToOrder,
  applyVoidedRefundRequestToOrder,
  formatRefundRequestStatusLabel,
  inferRefundRequestType,
} from '@/lib/refund-requests';
import {
  canAccessFinanceScreen,
  canCreateExpenseRequestForRole,
  canCreateRefundRequestForRole,
  canCreateProcurementRequestForRole,
  getAllowedFinanceSections,
  getDefaultFinanceSectionForRole,
  type FinanceSection,
} from '@/lib/finance-access';
import { getRefundDate, getRefundedAmount } from '@/lib/analytics-utils';
import { openRefundRequestAttachment, type RefundRequestAttachmentDraft, uploadRefundRequestAttachments } from '@/lib/refund-request-attachments';
import { openAttachmentPath, uploadBusinessAttachment } from '@/lib/storage-attachments';

type TabType = FinanceSection;
type ExpenseWorkspaceView = 'list' | 'approvals';
type ExpenseType = 'one-time' | 'recurring';
type ExpenseFilter = 'all' | ExpenseType;
type ExpenseRequestFilter = 'all' | ExpenseRequestStatus;
type RefundRequestFilter = 'all' | RefundRequestStatus;
type ExpenseSort = 'newest' | 'oldest' | 'amount-high' | 'amount-low';
type RefundSort = ExpenseSort;
type ProcurementStatus = string;
type ProcurementApprovalStatus = 'draft' | 'submitted' | 'approved' | 'rejected';
type ProcurementFilter = 'all' | string;
type ProcurementSort = 'workflow' | 'newest' | 'oldest' | 'amount-high' | 'amount-low';
type OverviewRange = '7d' | '30d' | 'year';

type TrendBucket = {
  key: string;
  label: string;
  revenue: number;
  expenses: number;
  procurement: number;
  outflow: number;
  net: number;
};

type ExpenseRow = {
  id: string;
  name: string;
  merchant: string;
  category: string;
  type: ExpenseType;
  frequency: string;
  amount: number;
  date: string;
  sortAt: number;
};

type ExpenseRequestRow = {
  id: string;
  name: string;
  merchant: string;
  category: string;
  type: ExpenseType;
  frequency: string;
  amount: number;
  date: string;
  status: ExpenseRequestStatus;
  approvedExpenseId?: string;
  submittedByName: string;
  submittedByUserId: string;
  rejectionReason?: string;
  dateAt: number;
  sortAt: number;
};

type RefundRequestRow = {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  amount: number;
  requestedDate: string;
  status: RefundRequestStatus;
  refundType: 'full' | 'partial';
  submittedByName: string;
  submittedByUserId: string;
  reviewedByName?: string;
  paidByName?: string;
  rejectionReason?: string;
  reason: string;
  note?: string;
  sortAt: number;
  dateAt: number;
};

type ExpenseBreakdownLineItem = {
  id: string;
  label: string;
  amount: number;
  category: string;
  kind: 'base' | 'charge';
};

type ExpenseBreakdownDraftItem = {
  id: string;
  label: string;
  amount: string;
  category: string;
  kind: 'base' | 'charge';
};

type ProcurementRow = {
  id: string;
  poNumber: string;
  title: string;
  supplier: string;
  status: ProcurementStatus;
  approvalStatus: ProcurementApprovalStatus;
  requestedStatus: ProcurementStatus;
  submittedByUserId: string;
  submittedByName: string;
  rejectionReason: string;
  paidDate: string;
  receivedDate: string;
  total: number;
  lineCount: number;
  sortAt: number;
};

type MobileDetailState =
  | { kind: 'expense'; id: string }
  | { kind: 'procurement'; id: string }
  | { kind: 'supplier'; id: string }
  | { kind: 'category'; id: string }
  | { kind: 'fixed-cost'; id: string }
  | { kind: 'status'; id: string }
  | null;

const tabOptions: { key: TabType; label: string; icon: typeof TrendingUp }[] = [
  { key: 'overview', label: 'Overview', icon: TrendingUp },
  { key: 'expenses', label: 'Expenses', icon: Receipt },
  { key: 'refunds', label: 'Refunds', icon: TrendingDown },
  { key: 'procurement', label: 'Procurement', icon: Truck },
  { key: 'settings', label: 'Settings', icon: Settings },
];

const expenseSortOptions: { key: ExpenseSort; label: string }[] = [
  { key: 'newest', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
  { key: 'amount-high', label: 'Amount: High to low' },
  { key: 'amount-low', label: 'Amount: Low to high' },
];

const expenseRequestFilterOptions: { key: ExpenseRequestFilter; label: string }[] = [
  { key: 'all', label: 'All Requests' },
  { key: 'draft', label: 'Draft' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

const refundRequestFilterOptions: { key: RefundRequestFilter; label: string }[] = [
  { key: 'all', label: 'All Refunds' },
  { key: 'draft', label: 'Draft' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'approved', label: 'Approved' },
  { key: 'paid', label: 'Paid' },
  { key: 'void', label: 'Void' },
  { key: 'rejected', label: 'Rejected' },
];

const procurementSortOptions: { key: ProcurementSort; label: string }[] = [
  { key: 'workflow', label: 'Workflow status' },
  { key: 'newest', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
  { key: 'amount-high', label: 'Amount: High to low' },
  { key: 'amount-low', label: 'Amount: Low to high' },
];

const expenseTypeOptions: ExpenseType[] = ['one-time', 'recurring'];
const expenseFrequencyOptions = ['Monthly', 'Quarterly', 'Yearly'];
const fixedCostFrequencyOptions: FixedCostFrequency[] = ['Monthly', 'Quarterly', 'Yearly'];
const overviewRangeOptions: { key: OverviewRange; label: string }[] = [
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'year', label: 'This Year' },
];
const DEFAULT_PROCUREMENT_STATUSES = ['Draft', 'Sent', 'Confirmed', 'Received', 'Cancelled'];
const STAMP_DUTY_THRESHOLD = 10000;
const STAMP_DUTY_THRESHOLD_LABEL = `₦${STAMP_DUTY_THRESHOLD.toLocaleString('en-NG')}`;
const formatExpenseTypeLabel = (value: ExpenseType) => (
  value === 'one-time' ? 'One-Time' : value.charAt(0).toUpperCase() + value.slice(1)
);
const isBankTransferPaymentMethod = (value?: string) => {
  const normalized = value?.trim().toLowerCase() ?? '';
  if (!normalized) return false;
  return (
    normalized.includes('bank transfer')
    || normalized === 'transfer'
    || normalized.includes('bank deposit')
  );
};

const getTransferChargeBreakdown = ({
  baseAmount,
  applyCharges,
  tiers,
  vatRate,
  stampDutyAmount,
}: {
  baseAmount: number;
  applyCharges: boolean;
  tiers: BankChargeTier[];
  vatRate: number;
  stampDutyAmount: number;
}) => {
  if (!applyCharges || baseAmount <= 0) {
    return { fee: 0, vat: 0, stampDuty: 0, total: 0 };
  }

  const tier = tiers.find((candidate) => candidate.maxAmount === null || baseAmount <= candidate.maxAmount);
  const fee = tier?.fixedFee ?? 0;
  const vat = fee * vatRate;
  const stampDuty = baseAmount >= STAMP_DUTY_THRESHOLD ? stampDutyAmount : 0;
  const total = fee + vat + stampDuty;
  return { fee, vat, stampDuty, total };
};

const parseTimestamp = (value?: string): number | null => {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

const resolveTab = (value?: string | string[]): TabType => {
  const section = Array.isArray(value) ? value[0] : value;
  if (section === 'expenses') return 'expenses';
  if (section === 'refunds') return 'refunds';
  if (section === 'procurement') return 'procurement';
  if (section === 'settings') return 'settings';
  return 'overview';
};

const resolveParamValue = (value?: string | string[]): string | null => {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== 'string') return null;
  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const slugify = (value: string) => value
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)+/g, '');

const escapeCsv = (value: string | number) => {
  const raw = String(value ?? '');
  if (raw.includes('"') || raw.includes(',') || raw.includes('\n')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
};

const calcPercentChange = (current: number, previous: number): number | null => {
  if (!Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
};

const formatPercentChangeLabel = (change: number | null) => {
  if (change === null) return 'No prior data';
  return `${change >= 0 ? '+' : ''}${change.toFixed(1)}% vs previous period`;
};

const splitTrendLabel = (label?: string): { primary: string; secondary?: string } | null => {
  const normalized = label?.trim();
  if (!normalized) return null;

  const match = normalized.match(/^([+-]?\d+(?:\.\d+)?%)\s+vs\s+(.+)$/i);
  if (!match) return { primary: normalized };

  return {
    primary: match[1],
    secondary: `vs ${match[2]}`,
  };
};

const resolveChangeTone = (
  change: number | null,
  options?: { inverse?: boolean }
): 'positive' | 'negative' | 'neutral' => {
  if (change === null || Math.abs(change) < 0.01) return 'neutral';
  const isIncrease = change > 0;
  const isPositive = options?.inverse ? !isIncrease : isIncrease;
  return isPositive ? 'positive' : 'negative';
};

const extractMetadataValue = (source: string | undefined, key: string): string | null => {
  if (!source) return null;
  const metadataPattern = /\[([a-z_]+):([^\]]+)\]/gi;
  const keyLower = key.toLowerCase();
  let match = metadataPattern.exec(source);
  while (match) {
    if (match[1]?.toLowerCase() === keyLower) {
      return match[2]?.trim() ?? null;
    }
    match = metadataPattern.exec(source);
  }
  return null;
};

const stripMetadata = (source: string | undefined): string => {
  if (!source) return '';
  const metadataPattern = /\[([a-z_]+):([^\]]+)\]/gi;
  return source.replace(metadataPattern, '').replace(/\s+/g, ' ').trim();
};

const sanitizeMetadata = (value: string): string => value.replace(/\]/g, '').trim();

const encodeMetadataJson = (value: unknown): string => sanitizeMetadata(encodeURIComponent(JSON.stringify(value)));

const decodeMetadataJson = <T, >(value: string | null): T | null => {
  if (!value) return null;
  try {
    return JSON.parse(decodeURIComponent(value)) as T;
  } catch {
    return null;
  }
};

const normalizeBreakdownCategory = (value: string): string => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : 'General';
};

const parseExpenseLineItemsFromDescription = (
  description: string | undefined,
  fallbackCategory: string,
  fallbackAmount: number
): ExpenseBreakdownLineItem[] => {
  const encoded = extractMetadataValue(description, 'line_items');
  const parsed = decodeMetadataJson<{
    label?: string;
    amount?: number;
    category?: string;
    kind?: 'base' | 'charge';
  }[]>(encoded);

  if (parsed && parsed.length > 0) {
    const normalized = parsed
      .map((line, index) => {
        const kind: 'base' | 'charge' = line.kind === 'charge' ? 'charge' : (index === 0 ? 'base' : 'charge');
        return {
          id: `line-${index + 1}`,
          label: (line.label ?? '').trim() || (index === 0 ? 'Base Amount' : 'Additional Charge'),
          amount: Number.isFinite(Number(line.amount)) ? Number(line.amount) : 0,
          category: normalizeBreakdownCategory(line.category ?? fallbackCategory),
          kind,
        };
      })
      .filter((line) => line.amount >= 0);
    if (normalized.length > 0) return normalized;
  }

  return [{
    id: 'line-base',
    label: 'Base Amount',
    amount: Number.isFinite(fallbackAmount) ? fallbackAmount : 0,
    category: normalizeBreakdownCategory(fallbackCategory),
    kind: 'base',
  }];
};

const parseExpenseReceiptsFromDescription = (description: string | undefined): ExpenseRequestReceipt[] => {
  const encoded = extractMetadataValue(description, 'receipts');
  const parsed = decodeMetadataJson<{
    id?: string;
    fileName?: string;
    storagePath?: string;
    mimeType?: string;
    fileSize?: number;
  }[]>(encoded);
  if (parsed && parsed.length > 0) {
    return parsed
      .filter((receipt) => Boolean(receipt.storagePath))
      .map((receipt, index) => ({
        id: receipt.id || `receipt-${index + 1}`,
        fileName: receipt.fileName || `Receipt ${index + 1}`,
        storagePath: receipt.storagePath || '',
        mimeType: receipt.mimeType,
        fileSize: Number.isFinite(Number(receipt.fileSize)) ? Number(receipt.fileSize) : undefined,
      }))
      .filter((receipt) => receipt.storagePath.length > 0);
  }

  const legacyPath = extractMetadataValue(description, 'receipt_path');
  if (!legacyPath) return [];
  const legacyName = extractMetadataValue(description, 'receipt_name') || 'Receipt';
  return [{
    id: 'receipt-legacy',
    fileName: legacyName,
    storagePath: legacyPath,
  }];
};

const createBaseBreakdownDraftItem = (
  category: string,
  amount: string = ''
): ExpenseBreakdownDraftItem => ({
  id: `line-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
  label: 'Base Amount',
  amount,
  category: normalizeBreakdownCategory(category || 'General'),
  kind: 'base',
});

const lineItemAmountToNumber = (value: string): number => {
  const parsed = Number(String(value).replace(/,/g, '').trim());
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
};

const sanitizeFileName = (fileName: string) => {
  const trimmed = fileName.trim();
  if (!trimmed) return 'receipt';
  return trimmed.replace(/[^a-zA-Z0-9._-]/g, '-');
};

const toJpegFileName = (fileName: string) => {
  const safe = sanitizeFileName(fileName);
  const lastDot = safe.lastIndexOf('.');
  if (lastDot === -1) return `${safe}.jpg`;
  return `${safe.slice(0, lastDot)}.jpg`;
};

const isImageUpload = (fileName: string, mimeType?: string | null) => {
  const mime = mimeType?.toLowerCase() ?? '';
  if (mime.startsWith('image/')) return true;
  const lowered = fileName.toLowerCase();
  return (
    lowered.endsWith('.jpg')
    || lowered.endsWith('.jpeg')
    || lowered.endsWith('.png')
    || lowered.endsWith('.webp')
    || lowered.endsWith('.heic')
  );
};

const inferMimeTypeFromFileName = (fileName: string) => {
  const lowered = fileName.toLowerCase();
  if (lowered.endsWith('.jpg') || lowered.endsWith('.jpeg')) return 'image/jpeg';
  if (lowered.endsWith('.png')) return 'image/png';
  if (lowered.endsWith('.webp')) return 'image/webp';
  if (lowered.endsWith('.heic')) return 'image/heic';
  return 'application/octet-stream';
};

const toDataUrlFromAsset = async (asset: { uri: string; name: string; mimeType?: string | null }) => {
  if (Platform.OS === 'web') {
    const response = await fetch(asset.uri);
    if (!response.ok) throw new Error('Could not read selected receipt image');
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('Could not convert image to data URL'));
      reader.readAsDataURL(blob);
    });
    return dataUrl;
  }

  const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
  const mimeType = asset.mimeType || inferMimeTypeFromFileName(asset.name);
  return `data:${mimeType};base64,${base64}`;
};

const toInputDate = (isoDate?: string): string => {
  if (!isoDate) return new Date().toISOString().split('T')[0];
  const timestamp = parseTimestamp(isoDate);
  if (timestamp === null) return new Date().toISOString().split('T')[0];
  return new Date(timestamp).toISOString().split('T')[0];
};

const toIsoDate = (inputDate: string): string => {
  const timestamp = parseTimestamp(inputDate);
  if (timestamp !== null) return new Date(timestamp).toISOString();
  return new Date().toISOString();
};

const formatFrequencyLabel = (value: string): string => {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'monthly') return 'Monthly';
  if (normalized === 'quarterly') return 'Quarterly';
  if (normalized === 'yearly') return 'Yearly';
  return value.trim();
};

const isMoreInfoRequestedExpense = (request: Pick<ExpenseRequest, 'status' | 'rejectionReason'>) => {
  if (request.status !== 'draft') return false;
  const reason = request.rejectionReason?.trim().toLowerCase() ?? '';
  return reason.startsWith('more info');
};

const formatManagerExpenseRequestStatusLabel = (request: Pick<ExpenseRequest, 'status' | 'rejectionReason'>) => {
  if (isMoreInfoRequestedExpense(request)) return 'More Info Needed';
  const status = request.status;
  if (status === 'submitted') return 'Pending';
  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  return 'Draft';
};

const normalizeProcurementApprovalStatus = (
  status?: string | null
): ProcurementApprovalStatus | null => {
  const normalized = status?.trim().toLowerCase();
  if (normalized === 'draft') return 'draft';
  if (normalized === 'submitted') return 'submitted';
  if (normalized === 'approved') return 'approved';
  if (normalized === 'rejected') return 'rejected';
  return null;
};

const normalizeProcurementStatus = (status?: string | null): ProcurementStatus | null => {
  const normalized = status?.trim().toLowerCase();
  if (!normalized) return null;
  const words = normalized
    .replace(/[_-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return null;
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const formatSignedCurrency = (amount: number): string => {
  const absolute = Math.abs(amount);
  return `${amount < 0 ? '-' : ''}${formatCurrency(absolute)}`;
};

const formatAxisCurrency = (value: number): string => {
  if (value >= 1000000) return `N${(value / 1000000).toFixed(1)}m`;
  if (value >= 1000) return `N${Math.round(value / 1000)}k`;
  return `N${Math.round(value)}`;
};

type ExpenseClassification = ExpenseType | 'fixed';

const inferExpenseClassification = (expense: Expense): ExpenseClassification => {
  const metadataType = extractMetadataValue(expense.description, 'type')?.toLowerCase();
  if (metadataType === 'one-time' || metadataType === 'recurring' || metadataType === 'fixed') {
    return metadataType as ExpenseClassification;
  }

  const source = `${expense.category} ${expense.description}`.toLowerCase();

  if (
    source.includes('rent')
    || source.includes('salary')
    || source.includes('payroll')
    || source.includes('utility')
    || source.includes('insurance')
    || source.includes('lease')
  ) {
    return 'fixed';
  }

  if (
    source.includes('subscription')
    || source.includes('recurring')
    || source.includes('ads')
    || source.includes('marketing')
    || source.includes('internet')
    || source.includes('delivery')
    || source.includes('logistics')
  ) {
    return 'recurring';
  }

  return 'one-time';
};

const inferExpenseType = (expense: Expense): ExpenseType => {
  const classification = inferExpenseClassification(expense);
  return classification === 'fixed' ? 'recurring' : classification;
};

const isFixedExpense = (expense: Expense): boolean => inferExpenseClassification(expense) === 'fixed';

const inferExpenseFrequency = (expense: Expense, type: ExpenseType): string => {
  const metadataFrequency = extractMetadataValue(expense.description, 'frequency');
  if (metadataFrequency) return formatFrequencyLabel(metadataFrequency);

  if (type === 'one-time') return '-';

  const source = `${expense.category} ${expense.description}`.toLowerCase();
  if (source.includes('quarter')) return 'Quarterly';
  if (source.includes('year') || source.includes('annual')) return 'Yearly';
  return 'Monthly';
};

const inferProcurementStatus = (procurement: Procurement): ProcurementStatus => {
  const metadataStatus = normalizeProcurementStatus(extractMetadataValue(procurement.notes, 'status'));
  if (metadataStatus) return metadataStatus;

  const source = `${procurement.notes}`.toLowerCase();
  if (source.includes('cancelled') || source.includes('canceled')) return 'Cancelled';
  if (source.includes('draft')) return 'Draft';
  if (source.includes('sent')) return 'Sent';
  if (source.includes('confirm')) return 'Confirmed';
  return 'Received';
};

const inferProcurementApprovalStatus = (procurement: Procurement): ProcurementApprovalStatus => {
  const metadataStatus = normalizeProcurementApprovalStatus(
    extractMetadataValue(procurement.notes, 'approval_status')
  );
  if (metadataStatus) return metadataStatus;

  const workflowStatus = inferProcurementStatus(procurement).trim().toLowerCase();
  if (workflowStatus === 'pending approval') return 'submitted';
  if (workflowStatus === 'rejected') return 'rejected';
  return 'approved';
};

const resolveProcurementRequestedStatus = (procurement: Procurement): ProcurementStatus => {
  const requestedStatus = normalizeProcurementStatus(extractMetadataValue(procurement.notes, 'requested_status'));
  if (requestedStatus) return requestedStatus;

  const workflowStatus = inferProcurementStatus(procurement);
  if (workflowStatus.trim().toLowerCase() === 'pending approval') return 'Draft';
  return workflowStatus;
};

const resolveProcurementSubmittedByUserId = (procurement: Procurement): string => (
  extractMetadataValue(procurement.notes, 'submitted_by_user_id') ?? ''
);

const resolveProcurementSubmittedByName = (procurement: Procurement): string => (
  extractMetadataValue(procurement.notes, 'submitted_by_name')
  || procurement.createdBy
  || 'Team Member'
);

const resolveProcurementRejectionReason = (procurement: Procurement): string => (
  extractMetadataValue(procurement.notes, 'rejection_reason') ?? ''
);

const parseFlexibleDateToTimestamp = (value?: string | null): number | null => {
  const normalized = value?.trim();
  if (!normalized) return null;

  // Handle day-first dates explicitly (e.g. 01/03/2026) to avoid locale ambiguity.
  const dayFirstMatch = normalized.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (dayFirstMatch) {
    const day = Number(dayFirstMatch[1]);
    const monthIndex = Number(dayFirstMatch[2]) - 1;
    const year = Number(dayFirstMatch[3]);
    if (
      Number.isInteger(day)
      && Number.isInteger(monthIndex)
      && Number.isInteger(year)
      && monthIndex >= 0
      && monthIndex <= 11
      && day >= 1
      && day <= 31
    ) {
      const candidate = new Date(year, monthIndex, day);
      if (
        candidate.getFullYear() === year
        && candidate.getMonth() === monthIndex
        && candidate.getDate() === day
      ) {
        return candidate.getTime();
      }
    }
  }

  return parseTimestamp(normalized);
};

const resolveProcurementPaidDate = (procurement: Procurement, createdAtMs: number): string => {
  const metadataPaidDate = extractMetadataValue(procurement.notes, 'paid_date');
  if (metadataPaidDate) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(metadataPaidDate)) return metadataPaidDate;
    const parsed = parseFlexibleDateToTimestamp(metadataPaidDate);
    if (parsed !== null) return new Date(parsed).toISOString().split('T')[0];
  }

  return new Date(createdAtMs).toISOString().split('T')[0];
};

const resolveProcurementReceivedDate = (procurement: Procurement, createdAtMs: number): string => {
  const metadataReceivedDate = extractMetadataValue(procurement.notes, 'received_date');
  if (metadataReceivedDate) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(metadataReceivedDate)) return metadataReceivedDate;
    const parsed = parseFlexibleDateToTimestamp(metadataReceivedDate);
    if (parsed !== null) return new Date(parsed).toISOString().split('T')[0];
  }

  const metadataExpected = extractMetadataValue(procurement.notes, 'expected');
  if (metadataExpected) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(metadataExpected)) return metadataExpected;
    const parsed = parseFlexibleDateToTimestamp(metadataExpected);
    if (parsed !== null) return new Date(parsed).toISOString().split('T')[0];
  }

  return resolveProcurementPaidDate(procurement, createdAtMs);
};

const resolveProcurementPaidTimestamp = (procurement: Procurement): number => {
  const createdAtMs = parseTimestamp(procurement.createdAt) ?? Date.now();
  const paidDate = resolveProcurementPaidDate(procurement, createdAtMs);
  return parseFlexibleDateToTimestamp(paidDate) ?? createdAtMs;
};

const resolveProcurementPONumber = (procurement: Procurement): string => {
  const metadataPo = extractMetadataValue(procurement.notes, 'po');
  if (metadataPo) return metadataPo.toUpperCase();

  const rawId = procurement.id.slice(-4).toUpperCase();
  const normalizedId = rawId.padStart(4, '0');
  return `PO-${normalizedId}`;
};

const normalizeFixedCostFrequency = (value?: string): FixedCostFrequency => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'quarterly') return 'Quarterly';
  if (normalized === 'yearly' || normalized === 'annual') return 'Yearly';
  return 'Monthly';
};

const estimateFixedCostInWindow = (
  cost: FixedCostSetting,
  startMs: number,
  endMs: number
): number => {
  const durationMs = Math.max(0, endMs - startMs);
  const durationDays = durationMs / (24 * 60 * 60 * 1000);
  if (durationDays <= 0) return 0;
  if (cost.frequency === 'Quarterly') return (cost.amount / 90) * durationDays;
  if (cost.frequency === 'Yearly') return (cost.amount / 365) * durationDays;
  return (cost.amount / 30) * durationDays;
};

function FinanceMetricCard({
  label,
  value,
  helper,
  helperTone,
  trendLabel,
  trendTone = 'neutral',
  trendPlacement = 'below',
  compactTrend = false,
  valueFontSize = 16,
  onPress,
  colors,
}: {
  label: string;
  value: string;
  helper: string;
  helperTone: 'positive' | 'negative' | 'neutral';
  trendLabel?: string;
  trendTone?: 'positive' | 'negative' | 'neutral';
  trendPlacement?: 'below' | 'right';
  compactTrend?: boolean;
  valueFontSize?: number;
  onPress?: () => void;
  colors: ReturnType<typeof useStatsColors>;
}) {
  const { isMobile } = useBreakpoint();
  const helperColor = helperTone === 'positive'
    ? colors.success
    : helperTone === 'negative'
      ? colors.danger
      : colors.text.tertiary;

  const trendColor = trendTone === 'positive'
    ? colors.success
    : trendTone === 'negative'
      ? colors.danger
      : colors.text.muted;
  const trendLabelParts = splitTrendLabel(trendLabel);
  const trendIconSize = compactTrend ? 9 : 10;
  const trendPrimaryTextStyle = {
    color: trendColor,
    fontSize: compactTrend ? 10 : 11,
    lineHeight: compactTrend ? 12 : 13,
  };
  const trendRightContainerMaxWidth = isMobile ? 146 : compactTrend ? 132 : 154;
  const trendRightSecondaryMaxWidth = isMobile ? 126 : compactTrend ? 104 : 116;
  const trendBelowContainerMaxWidth = compactTrend ? 128 : 140;
  const trendBelowSecondaryMaxWidth = compactTrend ? 80 : 92;
  const trendSecondaryTextStyle = {
    color: trendColor,
    fontSize: compactTrend ? 9 : 10,
    lineHeight: compactTrend ? 11 : 12,
    marginTop: 1,
  };
  const helperTextClassName = compactTrend ? 'text-xs font-medium' : 'text-sm font-medium';
  const labelFontSize = isMobile ? 10 : 8;
  const labelClassName = isMobile ? 'font-semibold mb-2' : 'font-semibold uppercase tracking-wider mb-2';
  const resolvedValueFontSize = Math.min(valueFontSize, 16);

  return (
    <Pressable
      className="flex-1 rounded-2xl p-5"
      style={colors.getCardStyle()}
      onPress={onPress}
      disabled={!onPress}
    >
      <Text style={{ color: colors.text.tertiary, fontSize: labelFontSize }} className={labelClassName}>
        {label}
      </Text>
      <Text style={{ color: colors.text.primary, fontSize: resolvedValueFontSize, lineHeight: resolvedValueFontSize + 2 }} className="font-bold" numberOfLines={1}>
        {value}
      </Text>
      {trendPlacement === 'right' ? (
        <View className="flex-row items-end justify-between mt-2">
          {helper.trim().length > 0 ? (
            <Text style={{ color: helperColor }} className={helperTextClassName}>
              {helper}
            </Text>
          ) : (
            <View />
          )}
          {trendLabelParts ? (
            <View style={{ alignItems: 'flex-end', maxWidth: trendRightContainerMaxWidth }}>
              <View className="flex-row items-center" style={{ gap: 4 }}>
                {trendTone === 'positive' ? (
                  <TrendingUp size={trendIconSize} color={trendColor} strokeWidth={2.4} />
                ) : trendTone === 'negative' ? (
                  <TrendingDown size={trendIconSize} color={trendColor} strokeWidth={2.4} />
                ) : null}
                <Text style={trendPrimaryTextStyle} numberOfLines={1}>
                  {trendLabelParts.primary}
                </Text>
              </View>
              {trendLabelParts.secondary ? (
                <Text style={[trendSecondaryTextStyle, { maxWidth: trendRightSecondaryMaxWidth, textAlign: 'right' }]} numberOfLines={1}>
                  {trendLabelParts.secondary}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : (
        <>
          {helper.trim().length > 0 ? (
            <Text style={{ color: helperColor }} className={`${helperTextClassName} mt-2`}>
              {helper}
            </Text>
          ) : null}
          {trendLabelParts ? (
            <View className="mt-1.5" style={{ alignItems: 'flex-start', maxWidth: trendBelowContainerMaxWidth }}>
              <View className="flex-row items-center" style={{ gap: 4 }}>
                {trendTone === 'positive' ? (
                  <TrendingUp size={trendIconSize} color={trendColor} strokeWidth={2.4} />
                ) : trendTone === 'negative' ? (
                  <TrendingDown size={trendIconSize} color={trendColor} strokeWidth={2.4} />
                ) : null}
                <Text style={trendPrimaryTextStyle} numberOfLines={1}>
                  {trendLabelParts.primary}
                </Text>
              </View>
              {trendLabelParts.secondary ? (
                <Text style={[trendSecondaryTextStyle, { maxWidth: trendBelowSecondaryMaxWidth }]} numberOfLines={2}>
                  {trendLabelParts.secondary}
                </Text>
              ) : null}
            </View>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

function FinanceFilterPill({
  label,
  active,
  onPress,
  colors,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useStatsColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-full px-4"
      style={{
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active ? colors.bar : colors.bg.card,
        borderWidth: active ? 0 : 1,
        borderColor: colors.divider,
      }}
    >
      <Text
        className="text-sm font-semibold"
        style={{ color: active ? colors.bg.screen : colors.text.secondary }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const getStatusTone = (
  label: string,
  colors: ReturnType<typeof useStatsColors>
): { bg: string; text: string } => {
  const key = label.trim().toLowerCase();
  const styleMap: Record<string, { bg: string; text: string }> = {
    'fixed': { bg: 'rgba(16, 185, 129, 0.16)', text: '#10B981' },
    'recurring': { bg: 'rgba(139, 92, 246, 0.16)', text: '#8B5CF6' },
    'one-time': { bg: 'rgba(59, 130, 246, 0.16)', text: '#3B82F6' },
    'draft': { bg: colors.bg.input, text: colors.text.secondary },
    'pending': { bg: 'rgba(59, 130, 246, 0.16)', text: '#2563EB' },
    'submitted': { bg: 'rgba(59, 130, 246, 0.16)', text: '#2563EB' },
    'more info needed': { bg: 'rgba(245, 158, 11, 0.16)', text: '#D97706' },
    'approved': { bg: 'rgba(16, 185, 129, 0.16)', text: '#10B981' },
    'paid': { bg: 'rgba(16, 185, 129, 0.2)', text: '#059669' },
    'void': { bg: 'rgba(107, 114, 128, 0.18)', text: '#6B7280' },
    'rejected': { bg: 'rgba(239, 68, 68, 0.16)', text: '#EF4444' },
    'sent': { bg: 'rgba(59, 130, 246, 0.16)', text: '#3B82F6' },
    'confirmed': { bg: 'rgba(139, 92, 246, 0.16)', text: '#8B5CF6' },
    'received': { bg: 'rgba(16, 185, 129, 0.16)', text: '#10B981' },
    'cancelled': { bg: 'rgba(239, 68, 68, 0.16)', text: '#EF4444' },
  };
  return styleMap[key] ?? { bg: colors.bg.input, text: colors.text.secondary };
};

function StatusBadge({
  label,
  colors,
  maxWidth,
  compact = false,
}: {
  label: ExpenseType | ProcurementStatus;
  colors: ReturnType<typeof useStatsColors>;
  maxWidth?: number;
  compact?: boolean;
}) {
  const tone = getStatusTone(String(label), colors);

  return (
    <View
      className={compact ? 'px-2 py-0.5 rounded-full' : 'px-2.5 py-1 rounded-full'}
      style={{
        backgroundColor: tone.bg,
        alignSelf: 'flex-start',
        maxWidth: maxWidth ?? '100%',
        overflow: 'hidden',
      }}
    >
      <Text className={compact ? 'text-xs font-semibold' : 'text-sm font-semibold'} style={{ color: tone.text }} numberOfLines={1} ellipsizeMode="tail">
        {label}
      </Text>
    </View>
  );
}

export default function FinanceScreen() {
  const router = useRouter();
  const { section, editExpenseId, editProcurementId } = useLocalSearchParams<{ section?: string | string[]; editExpenseId?: string | string[]; editProcurementId?: string | string[] }>();
  const routeEditExpenseId = resolveParamValue(editExpenseId);
  const consumedRouteEditExpenseIdRef = useRef<string | null>(null);
  const routeEditProcurementId = resolveParamValue(editProcurementId);
  const consumedRouteEditProcurementIdRef = useRef<string | null>(null);
  const colors = useStatsColors();
  const resolvedThemeMode = useResolvedThemeMode();
  const isDarkMode = resolvedThemeMode === 'dark';
  const pendingBadgeBg = isDarkMode ? 'rgba(59, 130, 246, 0.2)' : '#EFF6FF';
  const pendingBadgeBorder = isDarkMode ? 'rgba(96, 165, 250, 0.6)' : '#BFDBFE';
  const pendingBadgeText = isDarkMode ? '#93C5FD' : '#1D4ED8';
  const pendingBadgeSolid = '#2563EB';
  const formFieldBg = isDarkMode ? '#212121' : '#FFFFFF';
  const formFieldBorder = isDarkMode ? '#3A3A3A' : colors.divider;
  const formFieldActiveBorder = isDarkMode ? '#686868' : colors.bar;
  const formDashedBg = isDarkMode ? '#1C1C1C' : '#FFFFFF';
  const toggleTrackOn = isDarkMode ? '#686868' : colors.bar;
  const toggleTrackOff = isDarkMode ? '#343434' : colors.divider;
  const toggleKnobColor = isDarkMode ? '#F3F4F6' : '#FFFFFF';
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const { isDesktop, isTablet, isMobile, width: viewportWidth } = useBreakpoint();
  const pageHeadingStyle = getStandardPageHeadingStyle(isMobile);

  const orders = useFyllStore((s) => s.orders);
  const expenses = useFyllStore((s) => s.expenses);
  const expenseRequests = useFyllStore((s) => s.expenseRequests);
  const refundRequests = useFyllStore((s) => s.refundRequests);
  const procurements = useFyllStore((s) => s.procurements);
  const expenseCategories = useFyllStore((s) => s.expenseCategories);
  const financeSuppliers = useFyllStore((s) => s.financeSuppliers);
  const procurementStatusOptions = useFyllStore((s) => s.procurementStatusOptions);
  const fixedCosts = useFyllStore((s) => s.fixedCosts);
  const addExpense = useFyllStore((s) => s.addExpense);
  const addExpenseRequest = useFyllStore((s) => s.addExpenseRequest);
  const addRefundRequest = useFyllStore((s) => s.addRefundRequest);
  const addProcurement = useFyllStore((s) => s.addProcurement);
  const updateExpense = useFyllStore((s) => s.updateExpense);
  const updateExpenseRequest = useFyllStore((s) => s.updateExpenseRequest);
  const updateRefundRequest = useFyllStore((s) => s.updateRefundRequest);
  const updateOrder = useFyllStore((s) => s.updateOrder);
  const updateProcurement = useFyllStore((s) => s.updateProcurement);
  const deleteExpense = useFyllStore((s) => s.deleteExpense);
  const deleteExpenseRequest = useFyllStore((s) => s.deleteExpenseRequest);
  const deleteRefundRequest = useFyllStore((s) => s.deleteRefundRequest);
  const deleteProcurement = useFyllStore((s) => s.deleteProcurement);
  const addExpenseCategory = useFyllStore((s) => s.addExpenseCategory);
  const updateExpenseCategory = useFyllStore((s) => s.updateExpenseCategory);
  const deleteExpenseCategory = useFyllStore((s) => s.deleteExpenseCategory);
  const addFinanceSupplier = useFyllStore((s) => s.addFinanceSupplier);
  const updateFinanceSupplier = useFyllStore((s) => s.updateFinanceSupplier);
  const deleteFinanceSupplier = useFyllStore((s) => s.deleteFinanceSupplier);
  const addProcurementStatusOption = useFyllStore((s) => s.addProcurementStatusOption);
  const updateProcurementStatusOption = useFyllStore((s) => s.updateProcurementStatusOption);
  const deleteProcurementStatusOption = useFyllStore((s) => s.deleteProcurementStatusOption);
  const addFixedCost = useFyllStore((s) => s.addFixedCost);
  const updateFixedCost = useFyllStore((s) => s.updateFixedCost);
  const deleteFixedCost = useFyllStore((s) => s.deleteFixedCost);
  const financeRules = useFyllStore((s) => s.financeRules);
  const updateFinanceRules = useFyllStore((s) => s.updateFinanceRules);
  const addRevenueRule = useFyllStore((s) => s.addRevenueRule);
  const updateRevenueRule = useFyllStore((s) => s.updateRevenueRule);
  const deleteRevenueRule = useFyllStore((s) => s.deleteRevenueRule);
  const paymentMethods = useFyllStore((s) => s.paymentMethods);
  const authRole = useAuthStore((s) => s.currentUser?.role ?? 'staff');
  const currentUserId = useAuthStore((s) => s.currentUser?.id ?? '');
  const currentUserName = useAuthStore((s) => s.currentUser?.name ?? 'Team Member');
  const businessId = useAuthStore((s) => s.businessId ?? s.currentUser?.businessId ?? null);
  const isOfflineMode = useAuthStore((s) => s.isOfflineMode);
  const teamMembers = useAuthStore((s) => s.teamMembers);

  const [activeTab, setActiveTab] = useState<TabType>(() => resolveTab(section));
  const [overviewRange, setOverviewRange] = useState<OverviewRange>('30d');
  const [expensePeriod, setExpensePeriod] = useState<OverviewRange>('30d');
  const [refundPeriod, setRefundPeriod] = useState<OverviewRange>('30d');
  const [procurementPeriod, setProcurementPeriod] = useState<OverviewRange>('30d');
  const [expenseFilter, setExpenseFilter] = useState<ExpenseFilter>('all');
  const [expenseSort, setExpenseSort] = useState<ExpenseSort>('newest');
  const [expenseRequestFilter, setExpenseRequestFilter] = useState<ExpenseRequestFilter>('all');
  const [expenseRequestSort, setExpenseRequestSort] = useState<ExpenseSort>('newest');
  const [refundRequestFilter, setRefundRequestFilter] = useState<RefundRequestFilter>('all');
  const [refundSort, setRefundSort] = useState<RefundSort>('newest');
  const [procurementFilter, setProcurementFilter] = useState<ProcurementFilter>('all');
  const [procurementSort, setProcurementSort] = useState<ProcurementSort>('workflow');
  const [showExpenseFilterSheet, setShowExpenseFilterSheet] = useState(false);
  const [showExpenseRequestFilterSheet, setShowExpenseRequestFilterSheet] = useState(false);
  const [showRefundRequestFilterSheet, setShowRefundRequestFilterSheet] = useState(false);
  const [showProcurementFilterSheet, setShowProcurementFilterSheet] = useState(false);
  const [expenseWorkspaceView, setExpenseWorkspaceView] = useState<ExpenseWorkspaceView>('list');
  const [showExpenseApprovalWorkspace, setShowExpenseApprovalWorkspace] = useState(false);
  const [approvalWorkspaceSelectedId, setApprovalWorkspaceSelectedId] = useState<string | null>(null);
  const [approvalQueueSearchQuery, setApprovalQueueSearchQuery] = useState('');
  const [approvalInfoRequestNote, setApprovalInfoRequestNote] = useState('');
  const [procurementWorkspaceView, setProcurementWorkspaceView] = useState<'list' | 'approvals'>('list');
  const [procurementWorkspaceSelectedId, setProcurementWorkspaceSelectedId] = useState<string | null>(null);
  const [procurementQueueSearchQuery, setProcurementQueueSearchQuery] = useState('');
  const [approvalDetailRequestId, setApprovalDetailRequestId] = useState<string | null>(null);
  const [mobileDetail, setMobileDetail] = useState<MobileDetailState>(null);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [selectedProcurementId, setSelectedProcurementId] = useState<string | null>(null);
  const [expenseSearchQuery, setExpenseSearchQuery] = useState('');
  const [procurementSearchQuery, setProcurementSearchQuery] = useState('');
  const [showExpenseAiModal, setShowExpenseAiModal] = useState(false);
  const [showFinanceAiPanel, setShowFinanceAiPanel] = useState(false);
  const [aiType, setAiType] = useState<'expense' | 'procurement'>('expense');
  const [aiStep, setAiStep] = useState<'choose' | 'upload' | 'review'>('choose');
  const [aiParsedDrafts, setAiParsedDrafts] = useState<ExpenseDraftData[]>([]);
  const [aiParsedProcurementDraft, setAiParsedProcurementDraft] = useState<ProcurementDraftData | null>(null);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showProcurementModal, setShowProcurementModal] = useState(false);
  const [expenseModalMode, setExpenseModalMode] = useState<'create' | 'edit'>('create');
  const [procurementModalMode, setProcurementModalMode] = useState<'create' | 'edit'>('create');
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingExpenseRequestId, setEditingExpenseRequestId] = useState<string | null>(null);
  const [editingRefundRequestId, setEditingRefundRequestId] = useState<string | null>(null);
  const [editingProcurementId, setEditingProcurementId] = useState<string | null>(null);
  const [expenseActionMenuId, setExpenseActionMenuId] = useState<string | null>(null);
  const [procurementActionMenuId, setProcurementActionMenuId] = useState<string | null>(null);
  const [refundDetailActionMenuOpen, setRefundDetailActionMenuOpen] = useState(false);
  const [refundComposerActionMenuOpen, setRefundComposerActionMenuOpen] = useState(false);
  const [expenseName, setExpenseName] = useState('');
  const [expenseMerchant, setExpenseMerchant] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseLineItems, setExpenseLineItems] = useState<ExpenseBreakdownDraftItem[]>([]);
  const [applyBankCharges, setApplyBankCharges] = useState(true);
  const [expenseCategory, setExpenseCategory] = useState('');
  const [expenseCategorySearch, setExpenseCategorySearch] = useState('');
  const [showExpenseCategoryDropdown, setShowExpenseCategoryDropdown] = useState(false);
  const [showExpenseMerchantDropdown, setShowExpenseMerchantDropdown] = useState(false);
  const [showExpenseTypeDropdown, setShowExpenseTypeDropdown] = useState(false);
  const [expenseMerchantSearch, setExpenseMerchantSearch] = useState('');
  const [, setActiveBreakdownLineCategoryId] = useState<string | null>(null);
  const [, setBreakdownLineCategorySearch] = useState('');
  const [expenseReceiptAssets, setExpenseReceiptAssets] = useState<{
    uri: string;
    name: string;
    mimeType?: string | null;
    size?: number | null;
  }[]>([]);
  const [expenseReceiptPathDraft, setExpenseReceiptPathDraft] = useState('');
  const [expenseReceiptNameDraft, setExpenseReceiptNameDraft] = useState('');
  const [expenseUploadError, setExpenseUploadError] = useState('');
  const [isGeneratingExpenseDraft, setIsGeneratingExpenseDraft] = useState(false);
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [showRefundRequestModal, setShowRefundRequestModal] = useState(false);
  const [showRefundRequestDetailModal, setShowRefundRequestDetailModal] = useState(false);
  const [refundOrderSearchQuery, setRefundOrderSearchQuery] = useState('');
  const [selectedRefundOrderId, setSelectedRefundOrderId] = useState<string | null>(null);
  const [refundAmountDraft, setRefundAmountDraft] = useState('');
  const [applyRefundBankCharges, setApplyRefundBankCharges] = useState(true);
  const [refundReasonDraft, setRefundReasonDraft] = useState('');
  const [refundNoteDraft, setRefundNoteDraft] = useState('');
  const [refundAttachmentDrafts, setRefundAttachmentDrafts] = useState<RefundRequestAttachmentDraft[]>([]);
  const [refundAttachmentError, setRefundAttachmentError] = useState('');
  const [refundProofAttachmentDrafts, setRefundProofAttachmentDrafts] = useState<RefundRequestAttachmentDraft[]>([]);
  const [refundProofAttachmentError, setRefundProofAttachmentError] = useState('');
  const [refundRequestedDate, setRefundRequestedDate] = useState(toInputDate());
  const [showRefundDatePicker, setShowRefundDatePicker] = useState(false);
  const [refundPaymentReferenceDraft, setRefundPaymentReferenceDraft] = useState('');
  const [refundAdminNoteDraft, setRefundAdminNoteDraft] = useState('');
  const [refundSearchQuery, setRefundSearchQuery] = useState('');
  const [selectedRefundRequestId, setSelectedRefundRequestId] = useState<string | null>(null);
  const [expenseDate, setExpenseDate] = useState(toInputDate());
  const [showExpenseDatePicker, setShowExpenseDatePicker] = useState(false);
  const [expenseTypeDraft, setExpenseTypeDraft] = useState<ExpenseType>('one-time');
  const [expenseFrequencyDraft, setExpenseFrequencyDraft] = useState('Monthly');
  const [expenseNoteDraft, setExpenseNoteDraft] = useState('');
  const [expenseStatusDraft, setExpenseStatusDraft] = useState<ExpensePaymentStatus>('paid');
  const [poNumberDraft, setPoNumberDraft] = useState('');
  const [poTitleDraft, setPoTitleDraft] = useState('');
  const [poAttachmentsDraft, setPoAttachmentsDraft] = useState<ProcurementAttachment[]>([]);
  const [isPickingPoFile, setIsPickingPoFile] = useState(false);
  const [poStatusDraft, setPoStatusDraft] = useState<ProcurementStatus>('Draft');
  const [showPoSupplierDropdown, setShowPoSupplierDropdown] = useState(false);
  const [showPoStatusDropdown, setShowPoStatusDropdown] = useState(false);
  const [poSupplierDraft, setPoSupplierDraft] = useState('');
  const [poSupplierSearch, setPoSupplierSearch] = useState('');
  const [poExpectedDateDraft, setPoExpectedDateDraft] = useState(toInputDate());
  const [poReceivedDateDraft, setPoReceivedDateDraft] = useState(toInputDate());
  const [showPoDatePicker, setShowPoDatePicker] = useState(false);
  const [showPoReceivedDatePicker, setShowPoReceivedDatePicker] = useState(false);
  const [poPurchaseLines, setPoPurchaseLines] = useState<{ id: string; description: string; amount: string }[]>([{ id: 'l0', description: '', amount: '' }]);
  const [poNoteDraft, setPoNoteDraft] = useState('');
  const [financeSettingsView, setFinanceSettingsView] = useState<'suppliers' | 'categories' | 'fixed-costs' | 'statuses' | 'rules' | 'export'>('suppliers');
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [statusSearchQuery, setStatusSearchQuery] = useState('');
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [supplierNameDraft, setSupplierNameDraft] = useState('');
  const [supplierContactDraft, setSupplierContactDraft] = useState('');
  const [supplierEmailDraft, setSupplierEmailDraft] = useState('');
  const [supplierTermsDraft, setSupplierTermsDraft] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryNameDraft, setCategoryNameDraft] = useState('');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [statusNameDraft, setStatusNameDraft] = useState('');
  const [fixedCostSearchQuery, setFixedCostSearchQuery] = useState('');
  const [showFixedCostModal, setShowFixedCostModal] = useState(false);
  const [editingFixedCostId, setEditingFixedCostId] = useState<string | null>(null);
  const [fixedCostNameDraft, setFixedCostNameDraft] = useState('');
  const [fixedCostCategoryDraft, setFixedCostCategoryDraft] = useState('');
  const [fixedCostCategorySearch, setFixedCostCategorySearch] = useState('');
  const [showFixedCostCategoryDropdown, setShowFixedCostCategoryDropdown] = useState(false);
  const [fixedCostSupplierDraft, setFixedCostSupplierDraft] = useState('');
  const [fixedCostSupplierSearch, setFixedCostSupplierSearch] = useState('');
  const [showFixedCostSupplierDropdown, setShowFixedCostSupplierDropdown] = useState(false);
  const [fixedCostAmountDraft, setFixedCostAmountDraft] = useState('');
  const [fixedCostFrequencyDraft, setFixedCostFrequencyDraft] = useState<FixedCostFrequency>('Monthly');
  const [showFixedCostFrequencyDropdown, setShowFixedCostFrequencyDropdown] = useState(false);
  const [fixedCostNotesDraft, setFixedCostNotesDraft] = useState('');
  const [showBankChargeTierModal, setShowBankChargeTierModal] = useState(false);
  const [editingBankChargeTierId, setEditingBankChargeTierId] = useState<string | null>(null);
  const [tierMaxAmountDraft, setTierMaxAmountDraft] = useState('');
  const [tierFixedFeeDraft, setTierFixedFeeDraft] = useState('');
  const [tierIsLastDraft, setTierIsLastDraft] = useState(false);
  const [editingVatRate, setEditingVatRate] = useState(false);
  const [vatRateDraft, setVatRateDraft] = useState('');
  const [showRevenueRuleModal, setShowRevenueRuleModal] = useState(false);
  const [editingRevenueRuleId, setEditingRevenueRuleId] = useState<string | null>(null);
  const [revenueRuleNameDraft, setRevenueRuleNameDraft] = useState('');
  const [revenueRuleChannelDraft, setRevenueRuleChannelDraft] = useState('All Payment Methods');
  const [revenueRulePercentDraft, setRevenueRulePercentDraft] = useState('');
  const [revenueRuleFlatDraft, setRevenueRuleFlatDraft] = useState('');
  const [editingStampDuty, setEditingStampDuty] = useState(false);
  const [stampDutyDraft, setStampDutyDraft] = useState('');
  const [chargePreviewAmountDraft, setChargePreviewAmountDraft] = useState('50000');
  const [settingsToast, setSettingsToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const settingsToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isFinanceApprover = authRole === 'admin';
  const isManagerRole = authRole === 'manager';
  const canCreateExpenseRequest = canCreateExpenseRequestForRole(authRole);
  const canCreateRefundRequest = canCreateRefundRequestForRole(authRole);
  const canCreateProcurementRequest = canCreateProcurementRequestForRole(authRole);
  const canAccessFinance = canAccessFinanceScreen(authRole);
  const isWebDesktop = Platform.OS === 'web' && isDesktop;
  const isCompactLayout = !isWebDesktop;
  const webDesktopGutterPad = isWebDesktop ? 8 : 0;
  const desktopFinanceHeaderMinHeight = 92;
  const splitDetailPanelWidth = useMemo(() => {
    if (isMobile) return 0;
    if (isTablet) {
      return Math.min(340, Math.max(300, Math.round(viewportWidth * 0.34)));
    }
    return Math.min(380, Math.max(320, Math.round(viewportWidth * 0.3)));
  }, [isMobile, isTablet, viewportWidth]);
  const isDetailPanelCompact = splitDetailPanelWidth <= 350;
  const financeSectionTopMargin = isWebDesktop ? 0 : (isMobile ? 16 : 24);
  const financeSectionControlsMargin = isMobile ? 24 : 20;
  const financeSectionBodyMargin = isMobile ? 20 : 16;

  const activeTabLabel = activeTab === 'overview'
    ? 'Overview'
    : activeTab === 'expenses'
      ? 'Expenses'
      : activeTab === 'refunds'
        ? 'Refunds'
      : activeTab === 'procurement'
        ? 'Procurement'
        : 'Settings';
  const financeHeaderTitle = isWebDesktop && activeTab !== 'overview' ? activeTabLabel : 'Finance';
  const financeHeaderSubtitle = isWebDesktop && activeTab !== 'overview' ? 'Finance' : activeTabLabel;
  const isShowingWebExpenseApprovals = isWebDesktop && isFinanceApprover && expenseWorkspaceView === 'approvals';
  const isShowingWebProcurementApprovals = isWebDesktop && isFinanceApprover && procurementWorkspaceView === 'approvals';
  const isDesktopExpenseSplitView = isWebDesktop && !isMobile && activeTab === 'expenses' && (isFinanceApprover || Boolean(selectedExpenseId)) && !isShowingWebExpenseApprovals;
  const isDesktopRefundSplitView = isWebDesktop && !isMobile && activeTab === 'refunds' && Boolean(selectedRefundRequestId);
  const isDesktopProcurementSplitView = isWebDesktop && !isMobile && activeTab === 'procurement' && !isShowingWebProcurementApprovals && (isFinanceApprover || Boolean(selectedProcurementId));
  const adminNotificationRecipientIds = useMemo(
    () => teamMembers
      .filter((member) => member.role === 'admin' && member.id !== currentUserId)
      .map((member) => member.id),
    [currentUserId, teamMembers]
  );
  const showSettingsToast = useCallback((type: 'success' | 'error', message: string) => {
    setSettingsToast({ type, message });
    if (settingsToastTimerRef.current) {
      clearTimeout(settingsToastTimerRef.current);
    }
    settingsToastTimerRef.current = setTimeout(() => {
      setSettingsToast(null);
    }, 2200);
  }, []);
  const notifySettingsSaved = useCallback((message: string) => {
    showSettingsToast('success', message);
  }, [showSettingsToast]);
  const settingsSavedMessage = useCallback((subject: string) => {
    if (!businessId || isOfflineMode) {
      return `${subject} saved locally.`;
    }
    return `${subject} saved. Syncing to cloud.`;
  }, [businessId, isOfflineMode]);
  const refreshFinanceExpensesRealtime = useCallback(async () => {
    if (!businessId || isOfflineMode) return;
    try {
      const [expenseRows, expenseRequestRows, refundRequestRows] = await Promise.all([
        supabaseData.fetchCollection<Expense>('expenses', businessId, { orderBy: 'updated_at' }),
        supabaseData.fetchCollection<ExpenseRequest>('expense_requests', businessId, { orderBy: 'updated_at' }),
        supabaseData.fetchCollection<RefundRequest>('refund_requests', businessId, { orderBy: 'updated_at' }),
      ]);

      const nextExpenses = (expenseRows ?? []).map((row) => row.data);
      const nextExpenseRequests = (expenseRequestRows ?? []).map((row) => row.data);
      const nextRefundRequests = (refundRequestRows ?? []).map((row) => row.data);

      useFyllStore.setState({
        expenses: nextExpenses,
        expenseRequests: nextExpenseRequests,
        refundRequests: nextRefundRequests,
      });
    } catch (error) {
      console.warn('Finance realtime refresh failed:', error);
    }
  }, [businessId, isOfflineMode]);

  useEffect(() => () => {
    if (settingsToastTimerRef.current) {
      clearTimeout(settingsToastTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!businessId || isOfflineMode) return;

    const channel = supabase.channel(`finance-expenses-${businessId}`);
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'expenses', filter: `business_id=eq.${businessId}` },
      () => {
        void refreshFinanceExpensesRealtime();
      }
    );
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'expense_requests', filter: `business_id=eq.${businessId}` },
      () => {
        void refreshFinanceExpensesRealtime();
      }
    );
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'refund_requests', filter: `business_id=eq.${businessId}` },
      () => {
        void refreshFinanceExpensesRealtime();
      }
    );
    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [businessId, isOfflineMode, refreshFinanceExpensesRealtime]);
  const allowedTabs = useMemo<TabType[]>(
    () => getAllowedFinanceSections(authRole),
    [authRole]
  );
  const visibleTabOptions = tabOptions.filter((tab) => allowedTabs.includes(tab.key));
  const showFinanceTopHeader = true;
  const showTopHeaderDivider = isWebDesktop;

  useEffect(() => {
    const nextTab = resolveTab(section);
    setActiveTab((previous) => (previous === nextTab ? previous : nextTab));
  }, [section]);

  useEffect(() => {
    if (activeTab !== 'expenses' && expenseWorkspaceView !== 'list') {
      setExpenseWorkspaceView('list');
    }
  }, [activeTab, expenseWorkspaceView]);

  useEffect(() => {
    if (allowedTabs.includes(activeTab)) return;
    const roleDefaultTab = getDefaultFinanceSectionForRole(authRole);
    const fallbackTab = allowedTabs.includes(roleDefaultTab) ? roleDefaultTab : (allowedTabs[0] ?? 'expenses');
    if (activeTab !== fallbackTab) {
      setActiveTab(fallbackTab);
      router.replace(`/(tabs)/finance?section=${fallbackTab}` as any);
    }
  }, [activeTab, allowedTabs, authRole, router]);

  useEffect(() => {
    if (activeTab !== 'expenses' && activeTab !== 'overview') return;
    void refreshFinanceExpensesRealtime();
  }, [activeTab, refreshFinanceExpensesRealtime]);

  const selectTab = (tab: TabType) => {
    if (!allowedTabs.includes(tab)) return;
    if (tab === activeTab) return;
    void Haptics.selectionAsync();
    setActiveTab(tab);
    setSelectedExpenseId(null);
    setSelectedProcurementId(null);
    router.replace(`/(tabs)/finance?section=${tab}` as any);
  };

  const effectiveProcurementStatusOptions = useMemo<ProcurementStatusOption[]>(() => {
    const normalized = (procurementStatusOptions ?? [])
      .filter((option) => option.name.trim())
      .slice()
      .sort((a, b) => a.order - b.order);
    if (normalized.length > 0) return normalized;
    return DEFAULT_PROCUREMENT_STATUSES.map((name, index) => ({
      id: `proc-status-${slugify(name) || index + 1}`,
      name,
      order: index + 1,
    }));
  }, [procurementStatusOptions]);

  const procurementFilterOptions = useMemo<{ key: ProcurementFilter; label: string }[]>(() => ([
    { key: 'all', label: 'All' },
    ...effectiveProcurementStatusOptions.map((option) => ({ key: option.name, label: option.name })),
  ]), [effectiveProcurementStatusOptions]);

  const procurementStatusOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    effectiveProcurementStatusOptions.forEach((option, index) => {
      map.set(option.name.trim().toLowerCase(), index + 1);
    });
    return map;
  }, [effectiveProcurementStatusOptions]);

  useEffect(() => {
    if (effectiveProcurementStatusOptions.length === 0) return;
    const exists = effectiveProcurementStatusOptions.some(
      (option) => option.name.trim().toLowerCase() === poStatusDraft.trim().toLowerCase()
    );
    if (!exists) {
      setPoStatusDraft(effectiveProcurementStatusOptions[0].name);
    }
  }, [effectiveProcurementStatusOptions, poStatusDraft]);

  useEffect(() => {
    if (procurementFilter === 'all') return;
    const exists = effectiveProcurementStatusOptions.some(
      (option) => option.name.trim().toLowerCase() === procurementFilter.trim().toLowerCase()
    );
    if (!exists) {
      setProcurementFilter('all');
    }
  }, [effectiveProcurementStatusOptions, procurementFilter]);

  const availableExpenseCategories = useMemo(() => {
    const names = new Set<string>();
    expenseCategories.forEach((category) => {
      const normalized = category.name.trim();
      if (normalized) names.add(normalized);
    });
    fixedCosts.forEach((cost) => {
      const normalized = cost.category?.trim();
      if (normalized) names.add(normalized);
    });
    expenses.forEach((expense) => {
      const normalized = expense.category.trim();
      if (normalized) names.add(normalized);
    });
    return Array.from(names);
  }, [expenseCategories, expenses, fixedCosts]);

  const filteredExpenseCategories = useMemo(() => {
    const query = expenseCategorySearch.trim().toLowerCase();
    if (!query) return availableExpenseCategories.slice(0, 80);
    return availableExpenseCategories
      .filter((category) => category.toLowerCase().includes(query))
      .slice(0, 80);
  }, [availableExpenseCategories, expenseCategorySearch]);

  const availableExpenseMerchants = useMemo(() => {
    const names = new Set<string>();
    financeSuppliers.forEach((supplier) => {
      const normalized = supplier.name?.trim();
      if (normalized) names.add(normalized);
    });
    fixedCosts.forEach((cost) => {
      const normalized = cost.supplierName?.trim();
      if (normalized) names.add(normalized);
    });
    expenses.forEach((expense) => {
      const merchant = extractMetadataValue(expense.description, 'merchant');
      const normalized = merchant?.trim();
      if (normalized) names.add(normalized);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [expenses, financeSuppliers, fixedCosts]);

  const filteredExpenseMerchants = useMemo(() => {
    const query = expenseMerchantSearch.trim().toLowerCase();
    if (!query) return availableExpenseMerchants.slice(0, 50);
    return availableExpenseMerchants
      .filter((merchant) => merchant.toLowerCase().includes(query))
      .slice(0, 50);
  }, [availableExpenseMerchants, expenseMerchantSearch]);

  const gatewayFeePaymentMethodOptions = useMemo(() => {
    const names = new Set<string>();
    paymentMethods.forEach((method) => {
      const normalized = method.name?.trim();
      if (normalized) names.add(normalized);
    });
    orders.forEach((order) => {
      const normalized = order.paymentMethod?.trim();
      if (normalized) names.add(normalized);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [orders, paymentMethods]);

  const availableProcurementSuppliers = useMemo(() => {
    const names = new Set<string>();
    financeSuppliers.forEach((supplier) => {
      const normalized = supplier.name?.trim();
      if (normalized) names.add(normalized);
    });
    fixedCosts.forEach((cost) => {
      const normalized = cost.supplierName?.trim();
      if (normalized) names.add(normalized);
    });
    procurements.forEach((procurement) => {
      const normalized = procurement.supplierName?.trim();
      if (normalized) names.add(normalized);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [financeSuppliers, procurements, fixedCosts]);

  const filteredProcurementSuppliers = useMemo(() => {
    const query = poSupplierSearch.trim().toLowerCase();
    if (!query) return availableProcurementSuppliers.slice(0, 50);
    return availableProcurementSuppliers
      .filter((supplier) => supplier.toLowerCase().includes(query))
      .slice(0, 50);
  }, [availableProcurementSuppliers, poSupplierSearch]);

  const createPoNumber = () => `PO-${Math.floor(1000 + Math.random() * 9000)}`;

  const buildExpenseDescription = (
    name: string,
    merchant: string,
    type: ExpenseType,
    frequency: string,
    note: string,
    receiptPath?: string,
    receiptName?: string,
    lineItems?: ExpenseBreakdownLineItem[],
    receipts?: ExpenseRequestReceipt[]
  ) => {
    const metadataChunks: string[] = [`[type:${type}]`];
    if (merchant.trim()) {
      metadataChunks.push(`[merchant:${sanitizeMetadata(merchant)}]`);
    }
    if (type !== 'one-time') {
      metadataChunks.push(`[frequency:${sanitizeMetadata(frequency || 'Monthly')}]`);
    }
    if (note.trim()) {
      metadataChunks.push(`[note:${sanitizeMetadata(note)}]`);
    }
    if (receiptPath?.trim()) {
      metadataChunks.push(`[receipt_path:${sanitizeMetadata(receiptPath)}]`);
    }
    if (receiptName?.trim()) {
      metadataChunks.push(`[receipt_name:${sanitizeMetadata(receiptName)}]`);
    }
    if (lineItems && lineItems.length > 0) {
      metadataChunks.push(`[line_items:${encodeMetadataJson(lineItems.map((line) => ({
        label: line.label,
        amount: line.amount,
        category: line.category,
        kind: line.kind,
      })))}]`);
    }
    if (receipts && receipts.length > 0) {
      metadataChunks.push(`[receipts:${encodeMetadataJson(receipts.map((receipt) => ({
        id: receipt.id,
        fileName: receipt.fileName,
        storagePath: receipt.storagePath,
        mimeType: receipt.mimeType,
        fileSize: receipt.fileSize,
      })))}]`);
    }
    return `${name.trim()} ${metadataChunks.join(' ')}`.trim();
  };

  const buildProcurementNotes = (
    note: string,
    poNumber: string,
    status: ProcurementStatus,
    receivedDate: string,
    extraMetadata?: Record<string, string | null | undefined>,
    existingNotes?: string
  ) => {
    const metadataEntries = new Map<string, string>();
    const metadataPattern = /\[([a-z_]+):([^\]]+)\]/gi;
    const source = existingNotes ?? '';
    let match = metadataPattern.exec(source);
    while (match) {
      const key = match[1]?.trim().toLowerCase();
      const value = match[2]?.trim();
      if (key && value) {
        metadataEntries.set(key, sanitizeMetadata(value));
      }
      match = metadataPattern.exec(source);
    }

    metadataEntries.set('po', sanitizeMetadata(poNumber.trim().toUpperCase()));
    metadataEntries.set('status', sanitizeMetadata(status.toLowerCase()));
    metadataEntries.set('expected', sanitizeMetadata(receivedDate));

    Object.entries(extraMetadata ?? {}).forEach(([rawKey, rawValue]) => {
      const key = rawKey.trim().toLowerCase();
      if (!key) return;
      const value = (rawValue ?? '').trim();
      if (!value) {
        metadataEntries.delete(key);
        return;
      }
      metadataEntries.set(key, sanitizeMetadata(value));
    });

    const metadataChunks = Array.from(metadataEntries.entries()).map(
      ([key, value]) => `[${key}:${value}]`
    );
    if (note.trim()) {
      metadataChunks.unshift(note.trim());
    }
    return metadataChunks.join(' ').trim();
  };

  const upsertExpenseCategoryName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const exists = expenseCategories.some((category) => (
      category.name.trim().toLowerCase() === trimmed.toLowerCase()
    ));
    if (exists) return;
    addExpenseCategory({
      id: `expense-category-${slugify(trimmed) || Date.now().toString(36)}`,
      name: trimmed,
    });
  };

  const upsertFinanceSupplierName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const exists = financeSuppliers.some((supplier) => (
      supplier.name.trim().toLowerCase() === trimmed.toLowerCase()
    ));
    if (exists) return;
    addFinanceSupplier({
      id: `finance-supplier-${slugify(trimmed) || Date.now().toString(36)}`,
      name: trimmed,
      contactName: '',
      email: '',
      paymentTerms: '',
    });
  };

  const openSupplierComposer = () => {
    setEditingSupplierId(null);
    setSupplierNameDraft('');
    setSupplierContactDraft('');
    setSupplierEmailDraft('');
    setSupplierTermsDraft('');
    setShowSupplierModal(true);
  };

  const openSupplierEditor = (supplierId: string) => {
    const supplier = financeSuppliers.find((item) => item.id === supplierId);
    if (!supplier) return;
    setEditingSupplierId(supplierId);
    setSupplierNameDraft(supplier.name ?? '');
    setSupplierContactDraft(supplier.contactName ?? '');
    setSupplierEmailDraft(supplier.email ?? '');
    setSupplierTermsDraft(supplier.paymentTerms ?? '');
    setShowSupplierModal(true);
  };

  const saveSupplierModal = () => {
    const normalizedName = supplierNameDraft.trim();
    if (!normalizedName) return;
    if (editingSupplierId) {
      updateFinanceSupplier(editingSupplierId, {
        name: normalizedName,
        contactName: supplierContactDraft.trim(),
        email: supplierEmailDraft.trim(),
        paymentTerms: supplierTermsDraft.trim(),
      });
      notifySettingsSaved('Supplier updated. Syncing changes.');
      setShowSupplierModal(false);
      return;
    }
    addFinanceSupplier({
      id: `finance-supplier-${Date.now().toString(36)}`,
      name: normalizedName,
      contactName: supplierContactDraft.trim(),
      email: supplierEmailDraft.trim(),
      paymentTerms: supplierTermsDraft.trim(),
    });
    notifySettingsSaved('Supplier added. Syncing changes.');
    setShowSupplierModal(false);
  };

  const openCategoryComposer = () => {
    setEditingCategoryId(null);
    setCategoryNameDraft('');
    setShowCategoryModal(true);
  };

  const openCategoryEditor = (categoryId: string) => {
    const category = expenseCategories.find((item) => item.id === categoryId);
    if (!category) return;
    setEditingCategoryId(categoryId);
    setCategoryNameDraft(category.name);
    setShowCategoryModal(true);
  };

  const saveCategoryModal = () => {
    const normalizedName = categoryNameDraft.trim();
    if (!normalizedName) return;
    if (editingCategoryId) {
      updateExpenseCategory(editingCategoryId, { name: normalizedName });
      notifySettingsSaved('Category updated. Syncing changes.');
      setShowCategoryModal(false);
      return;
    }
    addExpenseCategory({
      id: `expense-category-${slugify(normalizedName) || Date.now().toString(36)}`,
      name: normalizedName,
    });
    notifySettingsSaved('Category added. Syncing changes.');
    setShowCategoryModal(false);
  };

  const openStatusComposer = () => {
    setEditingStatusId(null);
    setStatusNameDraft('');
    setShowStatusModal(true);
  };

  const openStatusEditor = (statusId: string) => {
    const option = effectiveProcurementStatusOptions.find((item) => item.id === statusId);
    if (!option) return;
    setEditingStatusId(statusId);
    setStatusNameDraft(option.name);
    setShowStatusModal(true);
  };

  const saveStatusModal = () => {
    const normalizedName = statusNameDraft.trim();
    if (!normalizedName) return;
    if (editingStatusId) {
      updateProcurementStatusOption(editingStatusId, { name: normalizedName });
      notifySettingsSaved('Status updated. Syncing changes.');
      setShowStatusModal(false);
      return;
    }
    addProcurementStatusOption({
      id: `proc-status-${slugify(normalizedName) || Date.now().toString(36)}`,
      name: normalizedName,
      order: effectiveProcurementStatusOptions.length + 1,
    });
    notifySettingsSaved('Status added. Syncing changes.');
    setShowStatusModal(false);
  };

  const openFixedCostComposer = () => {
    setEditingFixedCostId(null);
    setFixedCostNameDraft('');
    setFixedCostCategoryDraft(availableExpenseCategories[0] ?? '');
    setFixedCostCategorySearch('');
    setShowFixedCostCategoryDropdown(false);
    setFixedCostSupplierDraft('');
    setFixedCostSupplierSearch('');
    setShowFixedCostSupplierDropdown(false);
    setFixedCostAmountDraft('');
    setFixedCostFrequencyDraft('Monthly');
    setShowFixedCostFrequencyDropdown(false);
    setFixedCostNotesDraft('');
    setShowFixedCostModal(true);
  };

  const openFixedCostEditor = (fixedCostId: string) => {
    const cost = fixedCosts.find((item) => item.id === fixedCostId);
    if (!cost) return;
    setEditingFixedCostId(cost.id);
    setFixedCostNameDraft(cost.name);
    setFixedCostCategoryDraft(cost.category);
    setFixedCostCategorySearch(cost.category);
    setShowFixedCostCategoryDropdown(false);
    setFixedCostSupplierDraft(cost.supplierName ?? '');
    setFixedCostSupplierSearch(cost.supplierName ?? '');
    setShowFixedCostSupplierDropdown(false);
    setFixedCostAmountDraft(String(cost.amount));
    setFixedCostFrequencyDraft(normalizeFixedCostFrequency(cost.frequency));
    setShowFixedCostFrequencyDropdown(false);
    setFixedCostNotesDraft(cost.notes ?? '');
    setShowFixedCostModal(true);
  };

  const saveFixedCostModal = () => {
    const name = fixedCostNameDraft.trim();
    const category = fixedCostCategoryDraft.trim();
    const supplierName = fixedCostSupplierDraft.trim();
    const amount = Number(fixedCostAmountDraft.replace(/,/g, ''));
    if (!name || !category || !Number.isFinite(amount) || amount <= 0) return;

    upsertExpenseCategoryName(category);
    if (supplierName) {
      upsertFinanceSupplierName(supplierName);
    }

    const next: FixedCostSetting = {
      id: editingFixedCostId ?? `fixed-cost-${Date.now().toString(36)}`,
      name,
      category,
      amount,
      frequency: normalizeFixedCostFrequency(fixedCostFrequencyDraft),
      supplierName,
      notes: fixedCostNotesDraft.trim(),
      createdAt: editingFixedCostId
        ? (fixedCosts.find((item) => item.id === editingFixedCostId)?.createdAt ?? new Date().toISOString())
        : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (editingFixedCostId) {
      updateFixedCost(editingFixedCostId, next);
      notifySettingsSaved('Fixed cost updated. Syncing changes.');
    } else {
      addFixedCost(next);
      notifySettingsSaved('Fixed cost added. Syncing changes.');
    }

    setShowFixedCostModal(false);
    setEditingFixedCostId(null);
    setShowFixedCostCategoryDropdown(false);
    setShowFixedCostSupplierDropdown(false);
    setShowFixedCostFrequencyDropdown(false);
  };

  const handleDeleteFinanceSupplier = (supplierId: string) => {
    deleteFinanceSupplier(supplierId);
    notifySettingsSaved('Supplier deleted. Syncing changes.');
  };

  const handleDeleteExpenseCategory = (categoryId: string) => {
    deleteExpenseCategory(categoryId, businessId);
    notifySettingsSaved('Category deleted. Syncing changes.');
  };

  const handleDeleteFixedCost = (fixedCostId: string) => {
    deleteFixedCost(fixedCostId);
    notifySettingsSaved('Fixed cost deleted. Syncing changes.');
  };

  const handleDeleteProcurementStatusOption = (statusId: string) => {
    if (effectiveProcurementStatusOptions.length <= 1) return;
    deleteProcurementStatusOption(statusId);
    notifySettingsSaved('Status deleted. Syncing changes.');
  };

  const handleSaveFinanceRules = (rules: Partial<typeof financeRules>, message: string) => {
    updateFinanceRules(rules);
    notifySettingsSaved(message);
  };

  const handleDeleteBankChargeTier = (tierId: string) => {
    const nextTiers = financeRules.bankChargeTiers.filter((tier) => tier.id !== tierId);
    handleSaveFinanceRules({ bankChargeTiers: nextTiers }, settingsSavedMessage('Transfer fee tier'));
  };

  const handleToggleRevenueRule = (ruleId: string, enabled: boolean) => {
    updateRevenueRule(ruleId, { enabled });
    notifySettingsSaved(settingsSavedMessage(`Gateway fee ${enabled ? 'enabled' : 'disabled'}`));
  };

  const handleDeleteRevenueRule = (ruleId: string) => {
    deleteRevenueRule(ruleId);
    notifySettingsSaved(settingsSavedMessage('Gateway fee'));
  };

  const downloadCsv = (fileName: string, csvData: string) => {
    if (Platform.OS !== 'web') return;
    const webGlobal = globalThis as any;
    const blob = new webGlobal.Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = webGlobal.URL.createObjectURL(blob);
    const link = webGlobal.document.createElement('a');
    link.href = url;
    link.download = fileName;
    webGlobal.document.body.appendChild(link);
    link.click();
    webGlobal.document.body.removeChild(link);
    webGlobal.URL.revokeObjectURL(url);
  };

  const handleExportExpensesCsv = () => {
    const headers = ['Date', 'Name', 'Category', 'Merchant', 'Type', 'Frequency', 'Amount'];
    const rows = filteredExpenseRows.map((row) => [
      row.date,
      row.name,
      row.category,
      row.merchant,
      row.type,
      row.frequency,
      row.amount.toFixed(2),
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
    downloadCsv('fyll-expenses.csv', csv);
  };

  const handleExportProcurementCsv = () => {
    const headers = ['PO Number', 'Supplier', 'Status', 'Date Paid', 'Date Received', 'Total'];
    const rows = visibleProcurementRows.map((row) => [
      row.poNumber,
      row.supplier,
      row.status,
      row.paidDate,
      row.receivedDate,
      row.total.toFixed(2),
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
    downloadCsv('fyll-procurement.csv', csv);
  };

  const handleExportFixedCostsCsv = () => {
    const headers = ['Name', 'Category', 'Frequency', 'Supplier', 'Amount', 'Notes'];
    const rows = (fixedCosts ?? []).map((row) => [
      row.name,
      row.category,
      row.frequency,
      row.supplierName ?? '',
      row.amount.toFixed(2),
      row.notes ?? '',
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
    downloadCsv('fyll-fixed-costs.csv', csv);
  };

  const handleExportProfitLossCsv = () => {
    const headers = ['Metric', 'Amount', 'Period'];
    const fixedCostsInWindow = (fixedCosts ?? []).reduce((sum, cost) => (
      sum + estimateFixedCostInWindow(cost, overviewWindow.startMs, overviewWindow.endMs)
    ), 0);
    const periodLabel = overviewRangeOptions.find((option) => option.key === overviewRange)?.label ?? '';
    const rows = [
      ['Gross Revenue', overviewFinancials.totalRevenue.toFixed(2), periodLabel],
      ['Gateway Fees', (-overviewFinancials.totalGatewayFees).toFixed(2), periodLabel],
      ['Stamp Duty (₦50/order)', (-overviewFinancials.totalStampDuty).toFixed(2), periodLabel],
      ['Refunds', (-overviewFinancials.totalRefunds).toFixed(2), periodLabel],
      ['Net Revenue', overviewFinancials.netRevenue.toFixed(2), periodLabel],
      ['Expenses', overviewFinancials.totalExpenses.toFixed(2), periodLabel],
      ['Fixed Costs (included in expenses)', fixedCostsInWindow.toFixed(2), periodLabel],
      ['Procurement', overviewFinancials.totalProcurement.toFixed(2), periodLabel],
      ['Net Profit', overviewFinancials.netProfit.toFixed(2), periodLabel],
    ];
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
    downloadCsv('fyll-profit-loss-statement.csv', csv);
  };

  const resetExpenseDraft = () => {
    setExpenseModalMode('create');
    setEditingExpenseId(null);
    setEditingExpenseRequestId(null);
    setExpenseActionMenuId(null);
    setExpenseName('');
    setExpenseMerchant('');
    setExpenseMerchantSearch('');
    setExpenseAmount('');
    setExpenseLineItems([createBaseBreakdownDraftItem(availableExpenseCategories[0] ?? 'General')]);
    setExpenseCategory(availableExpenseCategories[0] ?? '');
    setExpenseCategorySearch('');
    setShowExpenseCategoryDropdown(false);
    setShowExpenseMerchantDropdown(false);
    setShowExpenseTypeDropdown(false);
    setExpenseReceiptAssets([]);
    setExpenseReceiptPathDraft('');
    setExpenseReceiptNameDraft('');
    setExpenseUploadError('');
    setIsGeneratingExpenseDraft(false);
    setIsSavingExpense(false);
    setExpenseDate(toInputDate());
    setExpenseTypeDraft('one-time');
    setExpenseFrequencyDraft('Monthly');
    setExpenseNoteDraft('');
    setExpenseStatusDraft('paid');
  };

  const resetProcurementDraft = () => {
    setProcurementModalMode('create');
    setEditingProcurementId(null);
    setProcurementActionMenuId(null);
    setPoNumberDraft(createPoNumber());
    setPoTitleDraft('');
    setPoAttachmentsDraft([]);
    setPoStatusDraft(DEFAULT_PROCUREMENT_STATUSES[0]);
    setShowPoSupplierDropdown(false);
    setShowPoStatusDropdown(false);
    setShowPoDatePicker(false);
    setShowPoReceivedDatePicker(false);
    setPoSupplierDraft('');
    setPoSupplierSearch('');
    setPoExpectedDateDraft(toInputDate());
    setPoReceivedDateDraft(toInputDate());
    setPoPurchaseLines([{ id: `l${Date.now().toString(36)}`, description: '', amount: '' }]);
    setPoNoteDraft('');
  };

  const openExpenseComposer = () => {
    setExpenseModalMode('create');
    resetExpenseDraft();
    setShowExpenseAiModal(false);
    setShowExpenseModal(true);
  };

  const openAiModal = () => {
    setAiType('expense');
    setAiStep('choose');
    setExpenseReceiptAssets([]);
    setExpenseUploadError('');
    setAiParsedDrafts([]);
    setAiParsedProcurementDraft(null);
    setShowExpenseAiModal(true);
  };

  const openProcurementComposer = () => {
    setProcurementModalMode('create');
    resetProcurementDraft();
    setShowProcurementModal(true);
  };

  const openExpenseEditor = useCallback((expenseId: string) => {
    const existingExpense = expenses.find((expense) => expense.id === expenseId);
    if (!existingExpense) return;

    const inferredType = inferExpenseType(existingExpense);
    setExpenseModalMode('edit');
    setEditingExpenseId(expenseId);
    setExpenseActionMenuId(null);
    setExpenseName(stripMetadata(existingExpense.description) || existingExpense.description);
    const existingMerchant = extractMetadataValue(existingExpense.description, 'merchant') ?? '';
    setExpenseMerchant(existingMerchant);
    setExpenseMerchantSearch(existingMerchant);
    setExpenseAmount(String(existingExpense.amount ?? 0));
    const parsedLineItems = parseExpenseLineItemsFromDescription(
      existingExpense.description,
      existingExpense.category || (availableExpenseCategories[0] ?? 'General'),
      existingExpense.amount ?? 0
    );
    setExpenseLineItems(parsedLineItems.map((line) => ({
      id: line.id,
      label: line.label,
      amount: line.amount > 0 ? String(line.amount) : '',
      category: line.category,
      kind: line.kind,
    })));
    const primaryLineCategory = parsedLineItems[0]?.category?.trim();
    const resolvedCategory = primaryLineCategory || existingExpense.category || (availableExpenseCategories[0] ?? '');
    setExpenseCategory(resolvedCategory);
    setExpenseCategorySearch(resolvedCategory);
    setShowExpenseCategoryDropdown(false);
    setShowExpenseMerchantDropdown(false);
    setShowExpenseTypeDropdown(false);
    setExpenseReceiptAssets([]);
    const parsedReceipts = parseExpenseReceiptsFromDescription(existingExpense.description);
    setExpenseReceiptPathDraft(parsedReceipts[0]?.storagePath ?? extractMetadataValue(existingExpense.description, 'receipt_path') ?? '');
    setExpenseReceiptNameDraft(parsedReceipts[0]?.fileName ?? extractMetadataValue(existingExpense.description, 'receipt_name') ?? '');
    setExpenseUploadError('');
    setIsSavingExpense(false);
    setExpenseDate(toInputDate(existingExpense.date));
    setExpenseTypeDraft(inferredType);
    setExpenseFrequencyDraft(inferExpenseFrequency(existingExpense, inferredType));
    setExpenseNoteDraft(extractMetadataValue(existingExpense.description, 'note') ?? '');
    setExpenseStatusDraft(existingExpense.status ?? 'paid');
    setShowExpenseModal(true);
  }, [availableExpenseCategories, expenses]);

  useEffect(() => {
    if (!routeEditExpenseId) {
      consumedRouteEditExpenseIdRef.current = null;
      return;
    }
    if (consumedRouteEditExpenseIdRef.current === routeEditExpenseId) return;
    const exists = expenses.some((expense) => expense.id === routeEditExpenseId);
    if (!exists) return;

    consumedRouteEditExpenseIdRef.current = routeEditExpenseId;
    setActiveTab('expenses');
    openExpenseEditor(routeEditExpenseId);
    router.setParams({ editExpenseId: '' } as any);
  }, [expenses, openExpenseEditor, routeEditExpenseId, router]);

  const openExpenseRequestEditor = (requestId: string) => {
    const request = expenseRequests.find((item) => item.id === requestId);
    if (!request) return;
    setExpenseModalMode('create');
    setEditingExpenseId(null);
    setEditingExpenseRequestId(request.id);
    setExpenseActionMenuId(null);
    setExpenseName(request.title ?? '');
    setExpenseMerchant(request.merchant ?? '');
    setExpenseMerchantSearch(request.merchant ?? '');
    setExpenseAmount(String(request.amount ?? 0));
    const requestLineItems = (request.lineItems ?? []).length > 0
      ? request.lineItems!
      : parseExpenseLineItemsFromDescription(
        undefined,
        request.category || (availableExpenseCategories[0] ?? 'General'),
        request.amount ?? 0
      );
    setExpenseLineItems(requestLineItems.map((line) => ({
      id: line.id || `line-${Math.random().toString(36).slice(2, 8)}`,
      label: line.label,
      amount: line.amount > 0 ? String(line.amount) : '',
      category: line.category,
      kind: line.kind === 'charge' ? 'charge' : 'base',
    })));
    const requestPrimaryCategory = requestLineItems[0]?.category?.trim();
    const requestResolvedCategory = requestPrimaryCategory || request.category || (availableExpenseCategories[0] ?? '');
    setExpenseCategory(requestResolvedCategory);
    setExpenseCategorySearch(requestResolvedCategory);
    setShowExpenseCategoryDropdown(false);
    setShowExpenseMerchantDropdown(false);
    setShowExpenseTypeDropdown(false);
    setExpenseReceiptAssets([]);
    const firstReceipt = request.receipts?.[0];
    setExpenseReceiptPathDraft(firstReceipt?.storagePath ?? '');
    setExpenseReceiptNameDraft(firstReceipt?.fileName ?? '');
    setExpenseUploadError('');
    setIsGeneratingExpenseDraft(false);
    setIsSavingExpense(false);
    setExpenseDate(toInputDate(request.date));
    setExpenseTypeDraft(request.type ?? 'one-time');
    setExpenseFrequencyDraft(formatFrequencyLabel(request.frequency ?? 'Monthly'));
    setExpenseNoteDraft(request.note ?? '');
    setShowExpenseModal(true);
  };

  const resetRefundRequestDraft = useCallback((orderId?: string | null) => {
    const nextOrder = orderId ? orders.find((order) => order.id === orderId) ?? null : null;
    setEditingRefundRequestId(null);
    setRefundComposerActionMenuOpen(false);
    setRefundOrderSearchQuery(nextOrder ? `${nextOrder.orderNumber} ${nextOrder.customerName}` : '');
    setSelectedRefundOrderId(nextOrder?.id ?? null);
    setRefundAmountDraft(nextOrder ? String(Math.max(0, nextOrder.totalAmount - (nextOrder.refund?.amount ?? 0))) : '');
    setApplyRefundBankCharges(true);
    setRefundReasonDraft('');
    setRefundNoteDraft('');
    setRefundAttachmentDrafts([]);
    setRefundAttachmentError('');
    setRefundRequestedDate(toInputDate());
    setRefundPaymentReferenceDraft('');
  }, [orders]);

  const openRefundRequestComposer = useCallback((orderId?: string | null) => {
    if (!canCreateRefundRequest) {
      showSettingsToast('error', 'Only managers and admins can create refund requests.');
      return;
    }
    resetRefundRequestDraft(orderId);
    setShowRefundRequestModal(true);
  }, [canCreateRefundRequest, resetRefundRequestDraft, showSettingsToast]);

  const openRefundRequestEditor = useCallback((requestId: string) => {
    const request = refundRequests.find((item) => item.id === requestId);
    if (!request) return;
    setRefundComposerActionMenuOpen(false);
    setEditingRefundRequestId(request.id);
    setSelectedRefundOrderId(request.orderId);
    setRefundOrderSearchQuery(`${request.orderNumber} ${request.customerName}`.trim());
    setRefundAmountDraft(String(request.amount ?? 0));
    setApplyRefundBankCharges(request.applyBankCharges ?? true);
    setRefundReasonDraft(request.reason ?? '');
    setRefundNoteDraft(request.note ?? '');
    setRefundAttachmentDrafts((request.attachments ?? []).map((attachment) => ({
      id: attachment.id,
      fileName: attachment.fileName,
      storagePath: attachment.storagePath,
      mimeType: attachment.mimeType ?? null,
      fileSize: attachment.fileSize ?? null,
    })));
    setRefundAttachmentError('');
    setRefundRequestedDate(toInputDate(request.requestedDate));
    setRefundPaymentReferenceDraft(request.paymentReference ?? '');
    setShowRefundRequestModal(true);
  }, [refundRequests]);

  const openRefundRequestDetail = useCallback((requestId: string, options?: { modal?: boolean }) => {
    const request = refundRequests.find((item) => item.id === requestId);
    if (!request) return;
    setRefundDetailActionMenuOpen(false);
    setSelectedRefundRequestId(requestId);
    setRefundPaymentReferenceDraft(request.paymentReference ?? '');
    setRefundAdminNoteDraft('');
    setRefundProofAttachmentDrafts((request.proofAttachments ?? []).map((attachment) => ({
      id: attachment.id,
      fileName: attachment.fileName,
      storagePath: attachment.storagePath,
      mimeType: attachment.mimeType ?? null,
      fileSize: attachment.fileSize ?? null,
    })));
    setRefundProofAttachmentError('');
    setShowRefundRequestDetailModal(options?.modal ?? true);
  }, [refundRequests]);

  const pickRefundRequestAttachments = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
      });

      if (result.canceled || !result.assets.length) return;

      const nextAssets: RefundRequestAttachmentDraft[] = result.assets.map((asset, index) => ({
        id: Math.random().toString(36).slice(2, 15),
        fileName: asset.fileName || `refund-screenshot-${refundAttachmentDrafts.length + index + 1}.jpg`,
        localUri: asset.uri,
        mimeType: asset.mimeType ?? null,
        fileSize: typeof asset.fileSize === 'number' ? asset.fileSize : null,
      }));

      setRefundAttachmentDrafts((previous) => {
        const merged = [...previous];
        nextAssets.forEach((asset) => {
          const alreadyExists = merged.some((item) => (
            item.storagePath
              ? item.storagePath === asset.storagePath
              : item.localUri === asset.localUri && item.fileName === asset.fileName
          ));
          if (!alreadyExists) merged.push(asset);
        });
        return merged;
      });
      setRefundAttachmentError('');
    } catch (error) {
      console.warn('Refund attachment picker failed:', error);
      setRefundAttachmentError('Could not select screenshot. Please try again.');
    }
  };

  const removeRefundRequestAttachment = (attachmentId: string) => {
    setRefundAttachmentDrafts((previous) => previous.filter((attachment) => attachment.id !== attachmentId));
    setRefundAttachmentError('');
  };

  const pickRefundProofAttachments = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
      });

      if (result.canceled || !result.assets.length) return;

      const nextAssets: RefundRequestAttachmentDraft[] = result.assets.map((asset, index) => ({
        id: Math.random().toString(36).slice(2, 15),
        fileName: asset.fileName || `refund-proof-${refundProofAttachmentDrafts.length + index + 1}.jpg`,
        localUri: asset.uri,
        mimeType: asset.mimeType ?? null,
        fileSize: typeof asset.fileSize === 'number' ? asset.fileSize : null,
      }));

      setRefundProofAttachmentDrafts((previous) => {
        const merged = [...previous];
        nextAssets.forEach((asset) => {
          const alreadyExists = merged.some((item) => (
            item.storagePath
              ? item.storagePath === asset.storagePath
              : item.localUri === asset.localUri && item.fileName === asset.fileName
          ));
          if (!alreadyExists) merged.push(asset);
        });
        return merged;
      });
      setRefundProofAttachmentError('');
    } catch (error) {
      console.warn('Refund proof picker failed:', error);
      setRefundProofAttachmentError('Could not select refund proof. Please try again.');
    }
  };

  const removeRefundProofAttachment = (attachmentId: string) => {
    setRefundProofAttachmentDrafts((previous) => previous.filter((attachment) => attachment.id !== attachmentId));
    setRefundProofAttachmentError('');
  };

  const openProcurementEditor = useCallback((procurementId: string) => {
    const existingProcurement = procurements.find((procurement) => procurement.id === procurementId);
    if (!existingProcurement) return;

    const createdAtMs = parseTimestamp(existingProcurement.createdAt) ?? Date.now();
    setProcurementModalMode('edit');
    setEditingProcurementId(procurementId);
    setProcurementActionMenuId(null);
    setPoNumberDraft(resolveProcurementPONumber(existingProcurement));
    setPoTitleDraft(existingProcurement.title ?? '');
    setPoAttachmentsDraft(existingProcurement.attachments ?? []);
    setPoStatusDraft(inferProcurementStatus(existingProcurement));
    setShowPoSupplierDropdown(false);
    setShowPoStatusDropdown(false);
    setShowPoDatePicker(false);
    setShowPoReceivedDatePicker(false);
    setPoSupplierDraft(existingProcurement.supplierName ?? '');
    setPoSupplierSearch(existingProcurement.supplierName ?? '');
    setPoExpectedDateDraft(resolveProcurementPaidDate(existingProcurement, createdAtMs));
    setPoReceivedDateDraft(resolveProcurementReceivedDate(existingProcurement, createdAtMs));
    const existingLines = existingProcurement.items
      .filter((item) => item.productId === 'manual' || /^manual-\d+$/.test(item.productId))
      .map((item, i) => ({
        id: `l${i}`,
        description: item.productName || `Payment ${i + 1}`,
        amount: String((item.costAtPurchase || 0) * (item.quantity || 1)),
      }));
    setPoPurchaseLines(
      existingLines.length > 0
        ? existingLines
        : [{ id: 'l0', description: '', amount: String(existingProcurement.totalCost ?? 0) }]
    );
    setPoNoteDraft(stripMetadata(existingProcurement.notes));
    setShowProcurementModal(true);
  }, [procurements]);

  useEffect(() => {
    if (!routeEditProcurementId) {
      consumedRouteEditProcurementIdRef.current = null;
      return;
    }
    if (consumedRouteEditProcurementIdRef.current === routeEditProcurementId) return;
    const exists = procurements.some((p) => p.id === routeEditProcurementId);
    if (!exists) return;

    consumedRouteEditProcurementIdRef.current = routeEditProcurementId;
    setActiveTab('procurement');
    openProcurementEditor(routeEditProcurementId);
    router.setParams({ editProcurementId: '' } as any);
  }, [procurements, openProcurementEditor, routeEditProcurementId, router]);

  const pickPoAttachment = async () => {
    setIsPickingPoFile(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (result.canceled || !result.assets.length) return;
      const newAttachments: ProcurementAttachment[] = [];
      for (const asset of result.assets) {
        newAttachments.push({
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType ?? undefined,
          fileSize: typeof asset.size === 'number' ? asset.size : undefined,
        });
      }
      setPoAttachmentsDraft((prev) => [...prev, ...newAttachments]);
    } catch (e) {
      console.warn('PO attachment pick error:', e);
    } finally {
      setIsPickingPoFile(false);
    }
  };

  const pickExpenseReceipt = async () => {
    setExpenseUploadError('');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled || !result.assets.length) return;
      const nextAssets = result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.name ?? 'receipt',
        mimeType: asset.mimeType ?? null,
        size: typeof asset.size === 'number' ? asset.size : null,
      }));
      setExpenseReceiptAssets((previous) => {
        const merged = [...previous];
        nextAssets.forEach((asset) => {
          const alreadyExists = merged.some((item) => item.uri === asset.uri && item.name === asset.name);
          if (!alreadyExists) merged.push(asset);
        });
        return merged;
      });
      const newestName = nextAssets[nextAssets.length - 1]?.name;
      setExpenseReceiptNameDraft(newestName ?? 'receipt');
    } catch (error) {
      console.warn('Expense receipt picker failed:', error);
      setExpenseUploadError('Could not select file. Please try again.');
    }
  };

  const uploadExpenseReceipt = async (asset: { uri: string; name: string; mimeType?: string | null; size?: number | null }) => {
    if (!businessId) throw new Error('No business selected for receipt upload');

    let uploadUri = asset.uri;
    let uploadMime = asset.mimeType ?? null;
    let uploadName = sanitizeFileName(asset.name || 'receipt');

    if (isImageUpload(uploadName, uploadMime)) {
      uploadUri = await compressImage(asset.uri, { maxDimension: 1600, quality: 0.72 });
      uploadMime = 'image/jpeg';
      uploadName = toJpegFileName(uploadName);
    }

    const uniqueKey = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const storagePath = `${businessId}/finance/expenses/${uniqueKey}-${uploadName}`;
    const response = await fetch(uploadUri);
    if (!response.ok) throw new Error('Could not read selected receipt file');
    const blob = await response.blob();
    const resolvedMime = uploadMime ?? blob.type ?? undefined;

    const { error } = await supabase
      .storage
      .from('collaboration-attachments')
      .upload(storagePath, blob, {
        upsert: false,
        contentType: resolvedMime,
      });

    if (error) throw error;

    return { storagePath, fileName: uploadName };
  };

  const uploadProcurementAttachment = async (attachment: ProcurementAttachment): Promise<ProcurementAttachment> => {
    const existingStoragePath = attachment.storagePath?.trim();
    if (existingStoragePath) {
      return {
        ...attachment,
        uri: existingStoragePath,
        storagePath: existingStoragePath,
      };
    }

    const rawUri = attachment.uri?.trim();
    if (!rawUri) return attachment;

    if (/^https?:\/\//i.test(rawUri)) {
      return attachment;
    }

    // Treat non-local URIs as already persisted storage paths.
    if (!/^(file:|content:|blob:|data:)/i.test(rawUri)) {
      return {
        ...attachment,
        uri: rawUri,
        storagePath: rawUri,
      };
    }

    if (!businessId) {
      return attachment;
    }

    const uploaded = await uploadBusinessAttachment({
      businessId,
      folder: 'finance/procurements',
      uri: rawUri,
      fileName: attachment.name,
      mimeType: attachment.mimeType ?? null,
    });

    return {
      ...attachment,
      uri: uploaded.storagePath,
      storagePath: uploaded.storagePath,
      mimeType: uploaded.mimeType ?? attachment.mimeType,
      fileSize: uploaded.fileSize ?? attachment.fileSize,
    };
  };

  const applyExpenseDraftToForm = (aiDraft: ExpenseDraftData) => {
    setExpenseName(aiDraft.name || '');
    setExpenseMerchant(aiDraft.merchant || '');
    setExpenseMerchantSearch(aiDraft.merchant || '');
    const nextLineItems = (aiDraft.lineItems ?? [])
      .filter((line) => Number(line.amount) >= 0)
      .map((line, index) => {
        const kind: 'base' | 'charge' = line.kind === 'charge' ? 'charge' : (index === 0 ? 'base' : 'charge');
        return {
          id: `line-ai-${Date.now().toString(36)}-${index}`,
          label: line.label?.trim() || (index === 0 ? 'Base Amount' : 'Additional Charge'),
          amount: Number(line.amount) > 0 ? String(Number(line.amount)) : '',
          category: normalizeBreakdownCategory(line.category || aiDraft.category || expenseCategory || 'General'),
          kind,
        };
      });
    if (nextLineItems.length > 0) {
      setExpenseLineItems(nextLineItems);
    } else if (aiDraft.amount > 0) {
      setExpenseLineItems([createBaseBreakdownDraftItem(aiDraft.category || expenseCategory || 'General', String(aiDraft.amount))]);
    }
    setExpenseAmount(aiDraft.amount > 0 ? String(aiDraft.amount) : '');
    setExpenseCategory(aiDraft.category || '');
    setExpenseCategorySearch(aiDraft.category || '');
    setExpenseDate(aiDraft.expenseDate || expenseDate);
    setExpenseTypeDraft(aiDraft.type || 'one-time');
    setExpenseFrequencyDraft(aiDraft.frequency || 'Monthly');
    if (aiDraft.note) setExpenseNoteDraft(aiDraft.note);
    if (aiDraft.category) upsertExpenseCategoryName(aiDraft.category);
    if (aiDraft.merchant) upsertFinanceSupplierName(aiDraft.merchant);
  };

  const applyProcurementDraftToForm = (aiDraft: ProcurementDraftData) => {
    if (aiDraft.title) setPoTitleDraft(aiDraft.title);
    if (aiDraft.supplier) {
      setPoSupplierDraft(aiDraft.supplier);
      setPoSupplierSearch(aiDraft.supplier);
      upsertFinanceSupplierName(aiDraft.supplier);
    }
    if (aiDraft.lines && aiDraft.lines.length > 0) {
      setPoPurchaseLines(aiDraft.lines.map((line, i) => ({
        id: `ai-${i}-${Date.now().toString(36)}`,
        description: line.description,
        amount: String(line.amount),
      })));
    } else if (aiDraft.totalCost > 0) {
      setPoPurchaseLines([{ id: `ai-0-${Date.now().toString(36)}`, description: aiDraft.title || 'Payment', amount: String(aiDraft.totalCost) }]);
    }
    if (aiDraft.note) setPoNoteDraft(aiDraft.note);
    if (aiDraft.expectedDate) setPoReceivedDateDraft(aiDraft.expectedDate);
  };

  const mergeExpenseDraftsIntoSingleExpense = (drafts: ExpenseDraftData[]): ExpenseDraftData | null => {
    const validDrafts = drafts.filter((draft) => {
      const hasAmount = Number(draft.amount) > 0;
      const hasLines = Array.isArray(draft.lineItems) && draft.lineItems.some((line) => Number(line.amount) > 0);
      const hasText = Boolean(draft.name?.trim() || draft.merchant?.trim() || draft.note?.trim());
      return hasAmount || hasLines || hasText;
    });

    if (validDrafts.length === 0) return null;

    const first = validDrafts[0];
    const mergedLineItems: { label: string; amount: number; category: string; kind: 'base' | 'charge' }[] = [];

    validDrafts.forEach((draft, draftIndex) => {
      const sourceLabel = draft.name?.trim() || `Receipt ${draftIndex + 1}`;
      const fallbackCategory = draft.category?.trim() || first.category?.trim() || 'General';
      const candidateLines = Array.isArray(draft.lineItems) && draft.lineItems.length > 0
        ? draft.lineItems
        : (Number(draft.amount) > 0
          ? [{ label: sourceLabel, amount: Number(draft.amount), category: fallbackCategory, kind: 'base' as const }]
          : []);

      candidateLines.forEach((line, lineIndex) => {
        const amount = Number(line.amount);
        if (!Number.isFinite(amount) || amount <= 0) return;

        const lineLabel = (line.label || '').trim();
        const normalizedLabel = lineLabel.length > 0
          ? (validDrafts.length > 1 && lineLabel.toLowerCase() === 'base amount' ? sourceLabel : lineLabel)
          : sourceLabel;

        mergedLineItems.push({
          label: normalizedLabel,
          amount,
          category: (line.category || '').trim() || fallbackCategory,
          kind: (line.kind === 'charge' ? 'charge' : (draftIndex === 0 && lineIndex === 0 ? 'base' : 'charge')),
        });
      });
    });

    if (mergedLineItems.length === 0 && Number(first.amount) > 0) {
      mergedLineItems.push({
        label: first.name?.trim() || 'Base Amount',
        amount: Number(first.amount),
        category: first.category?.trim() || 'General',
        kind: 'base',
      });
    }

    if (mergedLineItems.length === 0) return null;

    const normalizedLineItems = mergedLineItems.map((line, index) => ({
      ...line,
      kind: index === 0 ? 'base' as const : 'charge' as const,
    }));
    const totalAmount = normalizedLineItems.reduce((sum, line) => sum + line.amount, 0);
    const names = Array.from(new Set(validDrafts.map((draft) => draft.name?.trim()).filter((name): name is string => Boolean(name))));
    const merchants = Array.from(new Set(validDrafts.map((draft) => draft.merchant?.trim()).filter((name): name is string => Boolean(name))));
    const notes = validDrafts
      .map((draft) => draft.note?.trim())
      .filter((note): note is string => Boolean(note));
    const confidence: ExpenseDraftData['confidence'] = validDrafts.some((draft) => draft.confidence === 'low')
      ? 'low'
      : validDrafts.some((draft) => draft.confidence === 'medium')
        ? 'medium'
        : 'high';

    const type: ExpenseDraftData['type'] = validDrafts.some((draft) => draft.type === 'recurring') ? 'recurring' : 'one-time';
    const frequency: ExpenseDraftData['frequency'] = type === 'one-time'
      ? 'Monthly'
      : (validDrafts.find((draft) => draft.type === 'recurring')?.frequency || first.frequency || 'Monthly');

    return {
      name: names[0] || 'Combined Expense',
      merchant: merchants.length === 1 ? merchants[0] : (merchants[0] || first.merchant || ''),
      category: first.category || normalizedLineItems[0]?.category || 'General',
      amount: totalAmount,
      expenseDate: first.expenseDate || toInputDate(),
      type,
      frequency,
      note: notes.join(' | '),
      confidence,
      lineItems: normalizedLineItems,
    };
  };

  const handleGenerateExpenseDraftWithAI = async () => {
    const selectedAssets = expenseReceiptAssets;
    if (selectedAssets.length === 0) {
      setExpenseUploadError('Add at least one receipt to generate a Fyll AI draft.');
      return;
    }

    setExpenseUploadError('');
    setIsGeneratingExpenseDraft(true);

    try {
      const imageDataUrls = await Promise.all(selectedAssets.map((asset) => toDataUrlFromAsset(asset)));
      const parsedExpenseDraft = imageDataUrls.length === 1
        ? await parseExpenseDraft({
          messageText: expenseNoteDraft.trim() || undefined,
          imageDataUrls,
          categories: availableExpenseCategories,
          suppliers: availableExpenseMerchants,
        })
        : mergeExpenseDraftsIntoSingleExpense(await parseMultipleExpenseDrafts({
          imageDataUrls,
          categories: availableExpenseCategories,
          suppliers: availableExpenseMerchants,
        }));

      if (!parsedExpenseDraft) {
        setExpenseUploadError(
          imageDataUrls.length === 1
            ? 'Fyll AI could not generate a draft. Please fill manually.'
            : 'Fyll AI could not read any receipts. Please try again.'
        );
        return;
      }

      resetExpenseDraft();
      applyExpenseDraftToForm(parsedExpenseDraft);
      setExpenseReceiptAssets(selectedAssets.map((asset) => ({ ...asset })));
      setExpenseReceiptNameDraft(selectedAssets[selectedAssets.length - 1]?.name ?? '');
      setExpenseModalMode('create');
      setShowExpenseAiModal(false);
      setShowExpenseModal(true);
      setAiStep('choose');
      setAiParsedDrafts([]);
      setAiParsedProcurementDraft(null);
      setExpenseUploadError('');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    } catch (error) {
      console.warn('Expense Fyll AI draft failed:', error);
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      const isFormatError = message.includes('json') || message.includes('parse') || message.includes('structured');
      setExpenseUploadError(
        isFormatError
          ? 'Fyll AI returned an unreadable draft. Please retry.'
          : 'Fyll AI failed. Please check key/quota and retry.'
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsGeneratingExpenseDraft(false);
    }
  };

  const handleGenerateProcurementDraftWithAI = async () => {
    const selectedAssets = expenseReceiptAssets;
    if (selectedAssets.length === 0) {
      setExpenseUploadError('Add at least one receipt or invoice to generate a draft.');
      return;
    }

    setExpenseUploadError('');
    setIsGeneratingExpenseDraft(true);

    try {
      const imageDataUrls = await Promise.all(selectedAssets.map((asset) => toDataUrlFromAsset(asset)));
      const aiDraft = await parseProcurementDraft({
        messageText: expenseNoteDraft.trim() || undefined,
        imageDataUrls,
        suppliers: availableExpenseMerchants,
      });

      if (!aiDraft) {
        setExpenseUploadError('Fyll AI could not generate a draft. Please fill manually.');
        return;
      }

      resetProcurementDraft();
      applyProcurementDraftToForm(aiDraft);
      setPoAttachmentsDraft(selectedAssets.map((asset) => ({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? undefined,
      })));
      setShowExpenseAiModal(false);
      setProcurementModalMode('create');
      setShowProcurementModal(true);
      setAiStep('choose');
      setAiParsedProcurementDraft(null);
      setAiParsedDrafts([]);
      setExpenseReceiptAssets([]);
      setExpenseUploadError('');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.warn('Procurement Fyll AI draft failed:', error);
      setExpenseUploadError('Fyll AI failed. Please check your Gemini API key and retry.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsGeneratingExpenseDraft(false);
    }
  };

  const handleApproveExpenseReview = () => {
    if (aiParsedDrafts.length === 0) return;
    const draft = aiParsedDrafts[0];
    resetExpenseDraft();
    applyExpenseDraftToForm(draft);
    setShowExpenseAiModal(false);
    setShowExpenseModal(true);
    setAiStep('choose');
    setAiParsedDrafts([]);
    setAiParsedProcurementDraft(null);
    setExpenseReceiptAssets([]);
    setExpenseUploadError('');
  };

  const handleApproveProcurementReview = () => {
    if (!aiParsedProcurementDraft) return;

    resetProcurementDraft();
    applyProcurementDraftToForm(aiParsedProcurementDraft);

    setShowExpenseAiModal(false);
    setProcurementModalMode('create');
    setShowProcurementModal(true);
    setAiStep('choose');
    setAiParsedProcurementDraft(null);
    setAiParsedDrafts([]);
    setExpenseReceiptAssets([]);
    setExpenseUploadError('');
  };

  const handleSaveAiDrafts = () => {
    const today = new Date().toISOString().split('T')[0];
    aiParsedDrafts.forEach((aiDraft, index) => {
      const name = aiDraft.name || `Receipt ${index + 1}`;
      const category = aiDraft.category || 'Miscellaneous';
      const amount = aiDraft.amount > 0 ? aiDraft.amount : 0;

      if (aiDraft.category) upsertExpenseCategoryName(aiDraft.category);
      if (aiDraft.merchant) upsertFinanceSupplierName(aiDraft.merchant);

      const desc = buildExpenseDescription(
        name,
        aiDraft.merchant || '',
        aiDraft.type || 'one-time',
        aiDraft.frequency || 'Monthly',
        aiDraft.note || '',
        undefined,
        undefined,
        aiDraft.lineItems?.map((line, lineIdx) => ({
          id: `line-${index}-${lineIdx}`,
          label: line.label || 'Amount',
          amount: line.amount,
          category: line.category || category,
          kind: line.kind || (lineIdx === 0 ? 'base' : 'charge'),
        })) ?? [],
      );

      addExpense({
        id: `${Date.now().toString(36)}-ai-${index}`,
        category,
        description: desc,
        amount,
        date: aiDraft.expenseDate || today,
        createdAt: new Date().toISOString(),
        createdBy: currentUserName,
      }, businessId);
    });

    setAiParsedDrafts([]);
    setAiStep('choose');
    setShowExpenseAiModal(false);
    setExpenseReceiptAssets([]);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSaveExpenseModal = async (mode: 'save' | 'submit' = 'save') => {
    const normalizedName = expenseName.trim();
    const normalizedCategory = expenseCategory.trim();
    const parsedAmount = expenseLineItemsTotal;
    if (!normalizedName || !normalizedCategory || !Number.isFinite(parsedAmount) || parsedAmount <= 0) return;

    setExpenseUploadError('');
    setIsSavingExpense(true);
    try {
      const uploadedReceipts = [];
      for (const asset of expenseReceiptAssets) {
        const uploaded = await uploadExpenseReceipt(asset);
        uploadedReceipts.push({
          id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          fileName: uploaded.fileName,
          storagePath: uploaded.storagePath,
          mimeType: asset.mimeType ?? undefined,
          fileSize: typeof asset.size === 'number' ? asset.size : undefined,
        });
      }

      const firstUploaded = uploadedReceipts[0];
      const receiptPath = firstUploaded?.storagePath ?? expenseReceiptPathDraft;
      const receiptName = firstUploaded?.fileName ?? expenseReceiptNameDraft;
      const existingReceiptsFromSource = editingExpenseRequestId
        ? (expenseRequests.find((request) => request.id === editingExpenseRequestId)?.receipts ?? [])
        : parseExpenseReceiptsFromDescription(
          editingExpenseId ? expenses.find((expense) => expense.id === editingExpenseId)?.description : undefined
        );
      const mergedReceipts = uploadedReceipts.length > 0 ? uploadedReceipts : existingReceiptsFromSource;

      const nextDescription = buildExpenseDescription(
        normalizedName,
        expenseMerchant,
        expenseTypeDraft,
        expenseFrequencyDraft,
        expenseNoteDraft,
        receiptPath,
        receiptName,
        normalizedExpenseLineItems,
        mergedReceipts
      );

      upsertExpenseCategoryName(normalizedCategory);
      upsertFinanceSupplierName(expenseMerchant);
      normalizedExpenseLineItems.forEach((line) => upsertExpenseCategoryName(line.category));

      if (isFinanceApprover && expenseModalMode === 'edit' && editingExpenseId) {
        updateExpense(editingExpenseId, {
          category: normalizedCategory,
          description: nextDescription,
          amount: parsedAmount,
          date: toIsoDate(expenseDate),
          status: expenseStatusDraft,
        }, businessId);

        setShowExpenseModal(false);
        setEditingExpenseId(null);
        setEditingExpenseRequestId(null);
        setExpenseActionMenuId(null);
        setShowExpenseCategoryDropdown(false);
        setShowExpenseMerchantDropdown(false);
        setShowExpenseTypeDropdown(false);
        setExpenseReceiptAssets([]);
        setExpenseUploadError('');
        return;
      }

      if (isFinanceApprover && !editingExpenseRequestId) {
        addExpense({
          id: Math.random().toString(36).slice(2, 15),
          category: normalizedCategory,
          description: nextDescription,
          amount: parsedAmount,
          date: toIsoDate(expenseDate),
          createdAt: new Date().toISOString(),
          status: expenseStatusDraft,
        }, businessId);
      } else {
        const nowIso = new Date().toISOString();
        const nextStatus: ExpenseRequestStatus = mode === 'submit' ? 'submitted' : 'draft';
        let requestIdForNotification: string | null = null;
        const payload: Partial<ExpenseRequest> = {
          title: normalizedName,
          category: normalizedCategory,
          amount: parsedAmount,
          date: toIsoDate(expenseDate),
          merchant: expenseMerchant.trim(),
          type: expenseTypeDraft,
          frequency: expenseTypeDraft === 'one-time' ? 'Monthly' : expenseFrequencyDraft,
          note: expenseNoteDraft.trim(),
          lineItems: normalizedExpenseLineItems,
          receipts: mergedReceipts,
          status: nextStatus,
          submittedByUserId: currentUserId,
          submittedByName: currentUserName,
          submittedAt: nextStatus === 'submitted' ? nowIso : undefined,
          updatedAt: nowIso,
          reviewedByName: undefined,
          reviewedByUserId: undefined,
          reviewedAt: undefined,
          rejectionReason: undefined,
          approvedExpenseId: undefined,
        };

        if (editingExpenseRequestId) {
          updateExpenseRequest(editingExpenseRequestId, payload, businessId);
          requestIdForNotification = editingExpenseRequestId;
        } else {
          const newRequestId = Math.random().toString(36).slice(2, 15);
          addExpenseRequest({
            id: newRequestId,
            title: normalizedName,
            category: normalizedCategory,
            amount: parsedAmount,
            date: toIsoDate(expenseDate),
            merchant: expenseMerchant.trim(),
            type: expenseTypeDraft,
            frequency: expenseTypeDraft === 'one-time' ? 'Monthly' : expenseFrequencyDraft,
            note: expenseNoteDraft.trim(),
            lineItems: normalizedExpenseLineItems,
            receipts: mergedReceipts,
            status: nextStatus,
            submittedByUserId: currentUserId,
            submittedByName: currentUserName,
            submittedAt: nextStatus === 'submitted' ? nowIso : undefined,
            createdAt: nowIso,
            updatedAt: nowIso,
          }, businessId);
          requestIdForNotification = newRequestId;
        }

        if (
          nextStatus === 'submitted'
          && !isFinanceApprover
          && businessId
          && adminNotificationRecipientIds.length > 0
        ) {
          void sendThreadNotification({
            businessId,
            recipientUserIds: adminNotificationRecipientIds,
            senderUserId: currentUserId || null,
            authorName: currentUserName || 'Team Member',
            body: `${currentUserName || 'A team member'} submitted an expense request: ${normalizedName} (${formatCurrency(parsedAmount)}).`,
            entityType: null,
            entityDisplayName: normalizedName,
            entityId: requestIdForNotification,
          });
        }
      }

      setShowExpenseModal(false);
      setEditingExpenseId(null);
      setEditingExpenseRequestId(null);
      setExpenseActionMenuId(null);
      setShowExpenseCategoryDropdown(false);
      setShowExpenseMerchantDropdown(false);
      setShowExpenseTypeDropdown(false);
      setExpenseReceiptAssets([]);
      setExpenseUploadError('');
    } catch (error) {
      console.warn('Expense save failed:', error);
      setExpenseUploadError('Could not upload/save this expense. Please retry.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSavingExpense(false);
    }
  };

  const handleSaveProcurementModal = async () => {
    // PO number is auto-generated — not user-editable
    const normalizedPo = poNumberDraft.trim().toUpperCase() || createPoNumber();
    const normalizedSupplier = poSupplierDraft.trim();
    const normalizedRequestedStatus = poStatusDraft.trim() || effectiveProcurementStatusOptions[0]?.name || 'Draft';
    const validLines = poPurchaseLines.filter((l) => parseFloat(l.amount) > 0);
    const parsedTotal = validLines.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);
    const normalizedPaidDate = poExpectedDateDraft || toInputDate();
    const normalizedReceivedDate = poReceivedDateDraft || normalizedPaidDate;
    if (!normalizedSupplier || parsedTotal <= 0) return;

    let finalizedAttachments: ProcurementAttachment[] | undefined;
    if (poAttachmentsDraft.length > 0) {
      try {
        finalizedAttachments = await Promise.all(poAttachmentsDraft.map(uploadProcurementAttachment));
      } catch (error) {
        console.warn('Procurement attachment upload failed:', error);
        setExpenseUploadError('Could not upload procurement attachment(s). Please try again.');
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
    }

    const existingProcurement = editingProcurementId
      ? procurements.find((procurement) => procurement.id === editingProcurementId)
      : null;
    const isSubmittingForApproval = !isFinanceApprover;
    const procurementLabel = poTitleDraft.trim() || normalizedPo;
    const shouldNotifyAdminsAboutSubmission = (
      isSubmittingForApproval
      && Boolean(businessId)
      && adminNotificationRecipientIds.length > 0
    );
    const nextWorkflowStatus = isSubmittingForApproval ? 'Pending Approval' : normalizedRequestedStatus;
    const nowIso = new Date().toISOString();
    const extraMetadata = {
      paid_date: normalizedPaidDate,
      received_date: normalizedReceivedDate,
      ...(isSubmittingForApproval
        ? {
            approval_status: 'submitted',
            requested_status: normalizedRequestedStatus,
            submitted_by_user_id: currentUserId,
            submitted_by_name: currentUserName,
            submitted_at: nowIso,
            reviewed_by_user_id: null,
            reviewed_by_name: null,
            reviewed_at: null,
            rejection_reason: null,
          }
        : {}),
    };

    const nextNotes = buildProcurementNotes(
      poNoteDraft,
      normalizedPo,
      nextWorkflowStatus,
      normalizedReceivedDate,
      extraMetadata,
      existingProcurement?.notes
    );

    upsertFinanceSupplierName(normalizedSupplier);
    const statusExists = effectiveProcurementStatusOptions.some(
      (option) => option.name.trim().toLowerCase() === normalizedRequestedStatus.toLowerCase()
    );
    if (isFinanceApprover && !statusExists && normalizedRequestedStatus) {
      addProcurementStatusOption({
        id: `proc-status-${slugify(normalizedRequestedStatus) || Date.now().toString(36)}`,
        name: normalizedRequestedStatus,
        order: effectiveProcurementStatusOptions.length + 1,
      });
    }

    const nextItems = validLines.length > 0
      ? validLines.map((line, i) => ({
          productId: `manual-${i}`,
          variantId: `manual-${i}`,
          quantity: 0,
          costAtPurchase: parseFloat(line.amount) || 0,
          productName: line.description || `Payment ${i + 1}`,
          variantName: '',
        }))
      : [{ productId: 'manual', variantId: 'manual', quantity: 0, costAtPurchase: parsedTotal, productName: '', variantName: '' }];

    if (procurementModalMode === 'edit' && editingProcurementId) {
      updateProcurement(editingProcurementId, {
        title: poTitleDraft.trim() || undefined,
        supplierName: normalizedSupplier,
        items: nextItems,
        totalCost: parsedTotal,
        notes: nextNotes,
        attachments: finalizedAttachments && finalizedAttachments.length > 0 ? finalizedAttachments : undefined,
      }, businessId);
      if (shouldNotifyAdminsAboutSubmission && businessId) {
        void sendThreadNotification({
          businessId,
          recipientUserIds: adminNotificationRecipientIds,
          senderUserId: currentUserId || null,
          authorName: currentUserName || 'Team Member',
          body: `${currentUserName || 'A team member'} submitted a procurement request: ${procurementLabel} (${formatCurrency(parsedTotal)}).`,
          entityType: null,
          entityDisplayName: procurementLabel,
          entityId: editingProcurementId,
        });
      }

      setShowProcurementModal(false);
      setEditingProcurementId(null);
      setProcurementActionMenuId(null);
      setShowPoSupplierDropdown(false);
      setShowPoStatusDropdown(false);
      return;
    }

    const newProcurementId = Math.random().toString(36).slice(2, 15);
    addProcurement({
      id: newProcurementId,
      title: poTitleDraft.trim() || undefined,
      supplierName: normalizedSupplier,
      items: nextItems,
      totalCost: parsedTotal,
      notes: nextNotes,
      createdAt: new Date().toISOString(),
      createdBy: currentUserName,
      attachments: finalizedAttachments && finalizedAttachments.length > 0 ? finalizedAttachments : undefined,
    }, businessId);
    if (shouldNotifyAdminsAboutSubmission && businessId) {
      void sendThreadNotification({
        businessId,
        recipientUserIds: adminNotificationRecipientIds,
        senderUserId: currentUserId || null,
        authorName: currentUserName || 'Team Member',
        body: `${currentUserName || 'A team member'} submitted a procurement request: ${procurementLabel} (${formatCurrency(parsedTotal)}).`,
        entityType: null,
        entityDisplayName: procurementLabel,
        entityId: newProcurementId,
      });
    }

    setShowProcurementModal(false);
    setEditingProcurementId(null);
    setProcurementActionMenuId(null);
    setShowPoSupplierDropdown(false);
    setShowPoStatusDropdown(false);
  };

  const overviewWindow = useMemo(() => {
    const nowMs = Date.now();
    const now = new Date(nowMs);

    if (overviewRange === '7d') {
      return {
        startMs: nowMs - (7 * 24 * 60 * 60 * 1000),
        endMs: nowMs + 1,
        label: 'Last 7 days',
      };
    }

    if (overviewRange === 'year') {
      return {
        startMs: new Date(now.getFullYear(), 0, 1).getTime(),
        endMs: nowMs + 1,
        label: 'This Year',
      };
    }

    return {
      startMs: nowMs - (30 * 24 * 60 * 60 * 1000),
      endMs: nowMs + 1,
      label: 'Last 30 days',
    };
  }, [overviewRange]);

  const calcPeriodWindow = useCallback((range: OverviewRange) => {
    const nowMs = Date.now();
    const now = new Date(nowMs);
    if (range === '7d') return { startMs: nowMs - 7 * 24 * 60 * 60 * 1000, endMs: nowMs + 1, label: 'Last 7 days' };
    if (range === 'year') return { startMs: new Date(now.getFullYear(), 0, 1).getTime(), endMs: nowMs + 1, label: 'This Year' };
    return { startMs: nowMs - 30 * 24 * 60 * 60 * 1000, endMs: nowMs + 1, label: 'Last 30 days' };
  }, []);

  const expensePeriodWindow = useMemo(() => calcPeriodWindow(expensePeriod), [calcPeriodWindow, expensePeriod]);
  const refundPeriodWindow = useMemo(() => calcPeriodWindow(refundPeriod), [calcPeriodWindow, refundPeriod]);
  const procurementPeriodWindow = useMemo(() => calcPeriodWindow(procurementPeriod), [calcPeriodWindow, procurementPeriod]);

  const nonFixedExpenses = useMemo(
    () => expenses.filter((expense) => !isFixedExpense(expense)),
    [expenses]
  );

  const overviewFinancials = useMemo(() => {
    let totalRevenue = 0;
    let totalExpenses = 0;
    let totalProcurement = 0;
    let totalRefunds = 0;
    const expenseByCategory: Record<string, number> = {};

    const isWithinOverviewWindow = (timestamp: number | null) => (
      timestamp !== null
      && timestamp >= overviewWindow.startMs
      && timestamp < overviewWindow.endMs
    );

    let totalGatewayFees = 0;
    let totalStampDuty = 0;
    const stampDutyPerOrder = financeRules.incomingStampDuty ?? 50;
    const activeRules = (financeRules.revenueRules ?? []).filter((r) => r.enabled);

    orders.forEach((order) => {
      const timestamp = parseTimestamp(order.orderDate ?? order.createdAt);
      if (!isWithinOverviewWindow(timestamp)) return;
      totalRevenue += order.totalAmount;
      // Stamp duty applies to bank transfer receipts at or above the threshold.
      if (order.totalAmount >= STAMP_DUTY_THRESHOLD && isBankTransferPaymentMethod(order.paymentMethod)) {
        totalStampDuty += stampDutyPerOrder;
      }
      // Gateway fees: matching rules by payment method.
      const orderPaymentMethod = (order.paymentMethod ?? '').toLowerCase().trim();
      activeRules.forEach((rule) => {
        const ruleChannel = rule.channel.toLowerCase().trim();
        const appliesToAllPaymentMethods = (
          ruleChannel === 'all payment methods'
          || ruleChannel === 'all methods'
          || ruleChannel === 'all channels' // backwards compatibility with older saved rules
        );
        if (appliesToAllPaymentMethods || (orderPaymentMethod.length > 0 && ruleChannel === orderPaymentMethod)) {
          totalGatewayFees += (order.totalAmount * rule.percentFee) / 100 + rule.flatFee;
        }
      });
    });

    orders.forEach((order) => {
      const refundTimestamp = getRefundDate(order)?.getTime() ?? null;
      if (!isWithinOverviewWindow(refundTimestamp)) return;
      totalRefunds += getRefundedAmount(order);
    });

    nonFixedExpenses.forEach((expense) => {
      const timestamp = parseTimestamp(expense.date) ?? parseTimestamp(expense.createdAt);
      if (!isWithinOverviewWindow(timestamp)) return;
      totalExpenses += expense.amount;
      const lineItems = parseExpenseLineItemsFromDescription(
        expense.description,
        expense.category?.trim() || 'General',
        expense.amount
      );
      if (lineItems.length > 0) {
        lineItems.forEach((line) => {
          const categoryName = normalizeBreakdownCategory(line.category);
          expenseByCategory[categoryName] = (expenseByCategory[categoryName] ?? 0) + line.amount;
        });
      } else {
        const categoryName = expense.category?.trim() || 'General';
        expenseByCategory[categoryName] = (expenseByCategory[categoryName] ?? 0) + expense.amount;
      }
    });

    fixedCosts.forEach((cost) => {
      const amount = estimateFixedCostInWindow(cost, overviewWindow.startMs, overviewWindow.endMs);
      if (amount <= 0) return;
      totalExpenses += amount;
      const categoryName = cost.category?.trim() || 'General';
      expenseByCategory[categoryName] = (expenseByCategory[categoryName] ?? 0) + amount;
    });

    procurements.forEach((procurement) => {
      const timestamp = resolveProcurementPaidTimestamp(procurement);
      if (!isWithinOverviewWindow(timestamp)) return;
      totalProcurement += procurement.totalCost;
    });

    const netRevenue = totalRevenue - totalGatewayFees - totalStampDuty - totalRefunds;
    const netProfit = netRevenue - (totalExpenses + totalProcurement);
    const expenseByCategoryRows = Object.entries(expenseByCategory)
      .sort(([, a], [, b]) => b - a)
      .map(([category, amount]) => ({
        label: category,
        value: formatCurrency(amount),
        percentage: totalExpenses > 0 ? Number(((amount / totalExpenses) * 100).toFixed(1)) : 0,
      }));

    return {
      totalRevenue,
      totalGatewayFees,
      totalStampDuty,
      totalRefunds,
      netRevenue,
      totalExpenses,
      totalProcurement,
      netProfit,
      expenseByCategoryRows,
    };
  }, [orders, nonFixedExpenses, fixedCosts, procurements, overviewWindow.endMs, overviewWindow.startMs, financeRules]);

  const overviewComparison = useMemo(() => {
    const durationMs = overviewWindow.endMs - overviewWindow.startMs;
    const previousWindow = {
      startMs: overviewWindow.startMs - durationMs,
      endMs: overviewWindow.startMs,
    };

    let prevRevenue = 0;
    let prevExpenses = 0;
    let prevProcurement = 0;
    let prevGatewayFees = 0;
    let prevStampDuty = 0;
    let prevRefunds = 0;

    const isWithinPreviousWindow = (timestamp: number | null) => (
      timestamp !== null
      && timestamp >= previousWindow.startMs
      && timestamp < previousWindow.endMs
    );

    const stampDutyPerOrder = financeRules.incomingStampDuty ?? 50;
    const activeRules = (financeRules.revenueRules ?? []).filter((r) => r.enabled);

    orders.forEach((order) => {
      const timestamp = parseTimestamp(order.orderDate ?? order.createdAt);
      if (!isWithinPreviousWindow(timestamp)) return;
      prevRevenue += order.totalAmount;
      if (order.totalAmount >= STAMP_DUTY_THRESHOLD && isBankTransferPaymentMethod(order.paymentMethod)) {
        prevStampDuty += stampDutyPerOrder;
      }
      const orderPaymentMethod = (order.paymentMethod ?? '').toLowerCase().trim();
      activeRules.forEach((rule) => {
        const ruleChannel = rule.channel.toLowerCase().trim();
        const appliesToAllPaymentMethods = (
          ruleChannel === 'all payment methods'
          || ruleChannel === 'all methods'
          || ruleChannel === 'all channels'
        );
        if (appliesToAllPaymentMethods || (orderPaymentMethod.length > 0 && ruleChannel === orderPaymentMethod)) {
          prevGatewayFees += (order.totalAmount * rule.percentFee) / 100 + rule.flatFee;
        }
      });
    });

    orders.forEach((order) => {
      const refundTimestamp = getRefundDate(order)?.getTime() ?? null;
      if (!isWithinPreviousWindow(refundTimestamp)) return;
      prevRefunds += getRefundedAmount(order);
    });

    nonFixedExpenses.forEach((expense) => {
      const timestamp = parseTimestamp(expense.date) ?? parseTimestamp(expense.createdAt);
      if (!isWithinPreviousWindow(timestamp)) return;
      prevExpenses += expense.amount;
    });

    fixedCosts.forEach((cost) => {
      prevExpenses += estimateFixedCostInWindow(cost, previousWindow.startMs, previousWindow.endMs);
    });

    procurements.forEach((procurement) => {
      const timestamp = resolveProcurementPaidTimestamp(procurement);
      if (!isWithinPreviousWindow(timestamp)) return;
      prevProcurement += procurement.totalCost;
    });

    const prevNetRevenue = prevRevenue - prevGatewayFees - prevStampDuty - prevRefunds;
    const prevNet = prevNetRevenue - (prevExpenses + prevProcurement);

    const revenueChange = calcPercentChange(overviewFinancials.totalRevenue, prevRevenue);
    const refundsChange = calcPercentChange(overviewFinancials.totalRefunds, prevRefunds);
    const expensesChange = calcPercentChange(overviewFinancials.totalExpenses, prevExpenses);
    const procurementChange = calcPercentChange(overviewFinancials.totalProcurement, prevProcurement);
    const netChange = calcPercentChange(overviewFinancials.netProfit, prevNet);

    return {
      revenue: { label: formatPercentChangeLabel(revenueChange), tone: resolveChangeTone(revenueChange) },
      refunds: { label: formatPercentChangeLabel(refundsChange), tone: resolveChangeTone(refundsChange, { inverse: true }) },
      expenses: { label: formatPercentChangeLabel(expensesChange), tone: resolveChangeTone(expensesChange, { inverse: true }) },
      procurement: { label: formatPercentChangeLabel(procurementChange), tone: resolveChangeTone(procurementChange, { inverse: true }) },
      net: { label: formatPercentChangeLabel(netChange), tone: resolveChangeTone(netChange) },
    };
  }, [orders, nonFixedExpenses, fixedCosts, procurements, overviewFinancials, overviewWindow.endMs, overviewWindow.startMs, financeRules]);

  const overviewBreakdownRows = useMemo(() => ([
    {
      label: 'Gross Revenue',
      value: formatCurrency(overviewFinancials.totalRevenue),
    },
    {
      label: 'Gateway Fees',
      value: formatSignedCurrency(-overviewFinancials.totalGatewayFees),
      subValue: 'Deducted from gross revenue',
    },
    {
      label: 'Stamp Duty',
      value: formatSignedCurrency(-overviewFinancials.totalStampDuty),
      subValue: `${formatCurrency(financeRules.incomingStampDuty ?? 50)} per bank transfer order from ${STAMP_DUTY_THRESHOLD_LABEL}`,
    },
    {
      label: 'Refunds',
      value: formatSignedCurrency(-overviewFinancials.totalRefunds),
      subValue: 'Amounts paid back to customers',
    },
    {
      label: 'Net Revenue',
      value: formatCurrency(overviewFinancials.netRevenue),
      subValue: 'After fees, stamp duty, and refunds',
    },
    {
      label: 'Total Expenses',
      value: formatSignedCurrency(-overviewFinancials.totalExpenses),
    },
    {
      label: 'Procurement',
      value: formatSignedCurrency(-overviewFinancials.totalProcurement),
    },
    {
      label: 'Net Profit',
      value: formatSignedCurrency(overviewFinancials.netProfit),
    },
  ]), [financeRules.incomingStampDuty, overviewFinancials]);

  const financeAiSummary = useMemo(() => {
    const grossRevenue = overviewFinancials.totalRevenue;
    const netRevenue = overviewFinancials.netRevenue;
    const totalOutflow = overviewFinancials.totalExpenses + overviewFinancials.totalProcurement;
    const feeTotal = overviewFinancials.totalGatewayFees + overviewFinancials.totalStampDuty;
    const refundTotal = overviewFinancials.totalRefunds;

    const profitMargin = grossRevenue > 0 ? overviewFinancials.netProfit / grossRevenue : 0;
    const feeRate = grossRevenue > 0 ? feeTotal / grossRevenue : 0;
    const outflowRatio = netRevenue > 0 ? totalOutflow / netRevenue : 0;

    let score = 45;
    if (grossRevenue > 0) score += 10;

    if (profitMargin >= 0.2) score += 25;
    else if (profitMargin >= 0.1) score += 16;
    else if (profitMargin > 0) score += 8;
    else score -= 15;

    if (feeRate <= 0.03) score += 10;
    else if (feeRate >= 0.08) score -= 8;

    if (outflowRatio <= 0.7) score += 10;
    else if (outflowRatio > 1) score -= 10;

    if (overviewComparison.net.tone === 'positive') score += 8;
    if (overviewComparison.net.tone === 'negative') score -= 8;

    const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));
    const statusLabel = normalizedScore >= 75 ? 'Strong' : normalizedScore >= 55 ? 'Stable' : 'Watch';

    let headline = `In ${overviewWindow.label.toLowerCase()}, your business has limited data for a confident trend read yet.`;
    if (grossRevenue > 0 && overviewFinancials.netProfit < 0) {
      headline = `In ${overviewWindow.label.toLowerCase()}, outflows are above revenue. Focus on reducing expense and procurement pressure.`;
    } else if (grossRevenue > 0 && (profitMargin < 0.1 || refundTotal > 0)) {
      headline = `In ${overviewWindow.label.toLowerCase()}, revenue is coming in but margins are tight after fees and operating outflows.`;
    } else if (grossRevenue > 0) {
      headline = `In ${overviewWindow.label.toLowerCase()}, profitability is healthy with controlled fees and manageable outflows.`;
    }

    const recommendations: { id: string; text: string }[] = [];
    if (grossRevenue <= 0) {
      recommendations.push({
        id: 'kickstart-revenue',
        text: 'No revenue landed in this range. Expand active sales campaigns and confirm payment methods are tracked.',
      });
    }

    if (feeRate >= 0.05) {
      recommendations.push({
        id: 'fee-load',
        text: `Gateway + transfer fees are ${(feeRate * 100).toFixed(1)}% of gross revenue. Review payment mix and pricing buffers.`,
      });
    }

    if (overviewFinancials.totalStampDuty > 0 && (financeRules.incomingStampDuty ?? 50) > 0) {
      recommendations.push({
        id: 'stamp-duty',
        text: `Stamp duty is deducting ${formatCurrency(overviewFinancials.totalStampDuty)}. Confirm transfer orders include this recovery cost.`,
      });
    }

    if (refundTotal > 0) {
      recommendations.push({
        id: 'refund-pressure',
        text: `Refunds total ${formatCurrency(refundTotal)} in this period. Check return reasons and stop repeat issues at source.`,
      });
    }

    if (outflowRatio > 0.8) {
      recommendations.push({
        id: 'outflow-pressure',
        text: `Expenses + procurement consume ${(outflowRatio * 100).toFixed(0)}% of net revenue. Prioritize top expense categories this cycle.`,
      });
    }

    const topExpense = overviewFinancials.expenseByCategoryRows[0];
    if (topExpense) {
      recommendations.push({
        id: 'top-expense-category',
        text: `${topExpense.label} is your largest expense category. Set a spend cap and monitor weekly drift.`,
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        id: 'maintain-ops',
        text: 'Current structure looks balanced. Keep weekly checks on net profit and fee load to protect margin.',
      });
    }

    const keyMetrics: FyllAiMetric[] = [
      {
        label: 'Profit Margin',
        value: `${(profitMargin * 100).toFixed(1)}%`,
        tone: profitMargin >= 0.1 ? 'positive' : profitMargin >= 0 ? 'neutral' : 'negative',
      },
      {
        label: 'Fee Load',
        value: `${(feeRate * 100).toFixed(1)}%`,
        tone: feeRate >= 0.05 ? 'negative' : feeRate > 0 ? 'neutral' : 'positive',
      },
      {
        label: 'Net Profit',
        value: formatSignedCurrency(overviewFinancials.netProfit),
        tone: overviewFinancials.netProfit >= 0 ? 'positive' : 'negative',
      },
    ];

    return {
      score: normalizedScore,
      statusLabel,
      headline,
      keyMetrics,
      recommendations,
    };
  }, [overviewComparison.net.tone, overviewFinancials, overviewWindow.label, financeRules.incomingStampDuty]);

  const financeAiRecommendations = useMemo(
    () => financeAiSummary.recommendations.map((item) => item.text),
    [financeAiSummary.recommendations]
  );

  const financeAiContextBadges = useMemo(() => [
    { label: 'Range', value: overviewWindow.label },
    { label: 'Health', value: `${financeAiSummary.score}/100` },
    { label: 'Net Profit', value: formatSignedCurrency(overviewFinancials.netProfit) },
    { label: 'Fee Load', value: financeAiSummary.keyMetrics[1]?.value ?? '0.0%' },
  ], [financeAiSummary.keyMetrics, financeAiSummary.score, overviewFinancials.netProfit, overviewWindow.label]);

  const financeAiOpeningMessage = useMemo(
    () => `${financeAiSummary.headline} Ask me anything about profit, fees, expenses, procurement, or what to do next.`,
    [financeAiSummary.headline]
  );

  const financeAiQuickPrompts = useMemo(
    () => ['How is my profit?', 'Where am I leaking money?', 'What should I do this week?', 'Explain fee impact'],
    []
  );

  const handleAskFinanceAi = useCallback(async (
    question: string,
    history: { role: 'assistant' | 'user'; text: string }[]
  ): Promise<FyllAssistantResponse> => {
    const q = question.trim().toLowerCase();
    const isGreeting = /^(hi|hello|hey|yo|sup|what'?s up|whats up|good morning|good afternoon|good evening|how are you)[!.?,\s]*$/.test(q);
    if (isGreeting || q.length <= 2) {
      return {
        text: 'Hi. I can help as your finance, business, ops, and sales advisor. Ask me something specific like: "where are we leaking money this month?"',
        cards: [],
      };
    }
    const grossRevenue = overviewFinancials.totalRevenue;
    const netRevenue = overviewFinancials.netRevenue;
    const expensesTotal = overviewFinancials.totalExpenses;
    const procurementTotal = overviewFinancials.totalProcurement;
    const netProfit = overviewFinancials.netProfit;
    const feeTotal = overviewFinancials.totalGatewayFees + overviewFinancials.totalStampDuty;
    const refundTotal = overviewFinancials.totalRefunds;
    const feeRate = grossRevenue > 0 ? (feeTotal / grossRevenue) * 100 : 0;
    const outflowRatio = netRevenue > 0 ? ((expensesTotal + procurementTotal) / netRevenue) * 100 : 0;
    const topExpense = overviewFinancials.expenseByCategoryRows[0];

    try {
      return await askFyllAssistant({
        scope: 'finance',
        question,
        periodLabel: overviewWindow.label,
        headline: financeAiSummary.headline,
        metrics: [
          { label: 'Gross Revenue', value: formatCurrency(grossRevenue) },
          { label: 'Gateway Fees', value: formatCurrency(overviewFinancials.totalGatewayFees) },
          { label: 'Stamp Duty', value: formatCurrency(overviewFinancials.totalStampDuty) },
          { label: 'Refunds', value: formatCurrency(refundTotal) },
          { label: 'Net Revenue', value: formatCurrency(netRevenue) },
          { label: 'Expenses', value: formatCurrency(expensesTotal) },
          { label: 'Procurement', value: formatCurrency(procurementTotal) },
          { label: 'Net Profit', value: formatSignedCurrency(netProfit) },
        ],
        recommendations: financeAiRecommendations,
        history,
      });
    } catch {
      // Fall back to deterministic local answers when API key/quota/network fails.
    }

    if (q.includes('profit') || q.includes('margin')) {
      const margin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;
      return {
        text: `For ${overviewWindow.label.toLowerCase()}, net profit is ${formatSignedCurrency(netProfit)} with a ${margin.toFixed(1)}% margin on gross revenue.`,
        cards: [
          {
            title: 'Net Profit',
            value: formatSignedCurrency(netProfit),
            hint: 'After fees, expenses, and procurement',
            tone: netProfit >= 0 ? 'positive' : 'negative',
          },
          {
            title: 'Profit Margin',
            value: `${margin.toFixed(1)}%`,
            hint: 'Net profit relative to gross revenue',
            tone: margin >= 10 ? 'positive' : margin >= 0 ? 'neutral' : 'negative',
          },
        ],
      };
    }

    if (q.includes('fee') || q.includes('paystack') || q.includes('gateway') || q.includes('stamp')) {
      return {
        text: `Total payment deductions are ${formatCurrency(feeTotal)} (${feeRate.toFixed(1)}% of gross revenue): gateway fees ${formatCurrency(overviewFinancials.totalGatewayFees)} and stamp duty ${formatCurrency(overviewFinancials.totalStampDuty)} at ${formatCurrency(financeRules.incomingStampDuty ?? 50)} per qualifying transfer.`,
        cards: [
          {
            title: 'Gateway Fees',
            value: formatCurrency(overviewFinancials.totalGatewayFees),
            hint: 'Processor deductions',
            tone: 'negative',
          },
          {
            title: 'Stamp Duty',
            value: formatCurrency(overviewFinancials.totalStampDuty),
            hint: `${formatCurrency(financeRules.incomingStampDuty ?? 50)} per qualifying transfer`,
            tone: 'negative',
          },
          {
            title: 'Total Fee Load',
            value: `${feeRate.toFixed(1)}%`,
            hint: 'Percent of gross revenue',
            tone: feeRate >= 5 ? 'negative' : feeRate > 2 ? 'neutral' : 'positive',
          },
        ],
      };
    }

    if (q.includes('expense') || q.includes('cost') || q.includes('outflow')) {
      const expenseLead = topExpense ? `${topExpense.label} is the biggest expense bucket.` : 'No expense category dominates yet.';
      return {
        text: `Operating outflow in this range is ${formatCurrency(expensesTotal + procurementTotal)} (${outflowRatio.toFixed(0)}% of net revenue). ${expenseLead}`,
        cards: [
          {
            title: 'Expenses',
            value: formatCurrency(expensesTotal),
            hint: 'Operational spend',
            tone: 'neutral',
          },
          {
            title: 'Procurement',
            value: formatCurrency(procurementTotal),
            hint: 'Inventory/supplier purchasing',
            tone: 'neutral',
          },
          {
            title: 'Outflow Pressure',
            value: `${outflowRatio.toFixed(0)}%`,
            hint: topExpense ? `Top category: ${topExpense.label}` : 'No dominant category yet',
            tone: outflowRatio > 90 ? 'negative' : outflowRatio > 70 ? 'neutral' : 'positive',
          },
        ],
      };
    }

    if (q.includes('procurement')) {
      return {
        text: `Procurement spend is ${formatCurrency(procurementTotal)} in ${overviewWindow.label.toLowerCase()}. Track whether procurement timing is ahead of sales cash-in to avoid pressure on cashflow.`,
        cards: [
          {
            title: 'Procurement Spend',
            value: formatCurrency(procurementTotal),
            hint: overviewWindow.label,
            tone: procurementTotal > grossRevenue ? 'negative' : 'neutral',
          },
          {
            title: 'Net Revenue',
            value: formatCurrency(netRevenue),
            hint: 'Compare against procurement timing',
            tone: 'neutral',
          },
        ],
      };
    }

    if (q.includes('what should') || q.includes('next') || q.includes('recommend') || q.includes('advice')) {
      const topActions = financeAiRecommendations.slice(0, 3).map((item, index) => `${index + 1}. ${item}`).join('\n');
      return {
        text: `Top actions I recommend now:\n${topActions}`,
        cards: financeAiRecommendations.slice(0, 3).map((item, index) => ({
          title: `Action ${index + 1}`,
          value: item,
          hint: 'High-impact next step',
          tone: 'neutral' as const,
        })),
      };
    }

    if (q.includes('summary') || q.includes('snapshot') || q.includes('overview')) {
      const summaryCards: FyllAssistantCard[] = [
        {
          title: 'Net Profit',
          value: formatSignedCurrency(netProfit),
          hint: `${overviewWindow.label} snapshot`,
          tone: netProfit >= 0 ? 'positive' : 'negative',
        },
        {
          title: 'Fee Load',
          value: `${feeRate.toFixed(1)}%`,
          hint: `${formatCurrency(feeTotal)} in gateway + stamp deductions`,
          tone: feeRate >= 5 ? 'negative' : feeRate > 2 ? 'neutral' : 'positive',
        },
      ];
      return {
        text: `Snapshot for ${overviewWindow.label.toLowerCase()}: Gross ${formatCurrency(grossRevenue)}, Refunds ${formatCurrency(refundTotal)}, Net Revenue ${formatCurrency(netRevenue)}, Expenses ${formatCurrency(expensesTotal)}, Procurement ${formatCurrency(procurementTotal)}, Net Profit ${formatSignedCurrency(netProfit)}.`,
        cards: summaryCards,
      };
    }

    return {
      text: `Snapshot for ${overviewWindow.label.toLowerCase()}: Gross ${formatCurrency(grossRevenue)}, Refunds ${formatCurrency(refundTotal)}, Net Revenue ${formatCurrency(netRevenue)}, Expenses ${formatCurrency(expensesTotal)}, Procurement ${formatCurrency(procurementTotal)}, Net Profit ${formatSignedCurrency(netProfit)}.`,
      cards: [],
    };
  }, [financeAiRecommendations, financeAiSummary.headline, financeRules.incomingStampDuty, overviewFinancials, overviewWindow.label]);

  const monthlyTrend = useMemo((): TrendBucket[] => {
    const now = new Date();
    const buckets: TrendBucket[] = Array.from({ length: 6 }, (_, index) => {
      const distanceFromCurrent = 5 - index;
      const date = new Date(now.getFullYear(), now.getMonth() - distanceFromCurrent, 1);
      const year = date.getFullYear();
      const month = date.getMonth();
      return {
        key: `${year}-${month + 1}`,
        label: date.toLocaleDateString('en-US', { month: 'short' }),
        revenue: 0,
        expenses: 0,
        procurement: 0,
        outflow: 0,
        net: 0,
      };
    });

    const firstBucketDate = new Date(now.getFullYear(), now.getMonth() - 5, 1).getTime();
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();

    const bucketIndexByKey = new Map<string, number>();
    buckets.forEach((bucket, index) => {
      bucketIndexByKey.set(bucket.key, index);
    });

    const toBucketKey = (timestamp: number) => {
      const date = new Date(timestamp);
      return `${date.getFullYear()}-${date.getMonth() + 1}`;
    };

    orders.forEach((order) => {
      const timestamp = parseTimestamp(order.orderDate ?? order.createdAt);
      if (timestamp === null || timestamp < firstBucketDate || timestamp >= endDate) return;
      const bucketIndex = bucketIndexByKey.get(toBucketKey(timestamp));
      if (bucketIndex === undefined) return;
      buckets[bucketIndex].revenue += order.totalAmount;
    });

    nonFixedExpenses.forEach((expense) => {
      const timestamp = parseTimestamp(expense.date);
      if (timestamp === null || timestamp < firstBucketDate || timestamp >= endDate) return;
      const bucketIndex = bucketIndexByKey.get(toBucketKey(timestamp));
      if (bucketIndex === undefined) return;
      buckets[bucketIndex].expenses += expense.amount;
    });

    buckets.forEach((bucket) => {
      const [yearValue, monthValue] = bucket.key.split('-');
      const year = Number(yearValue);
      const month = Number(monthValue) - 1;
      const bucketStart = new Date(year, month, 1).getTime();
      const bucketEnd = new Date(year, month + 1, 1).getTime();
      fixedCosts.forEach((cost) => {
        bucket.expenses += estimateFixedCostInWindow(cost, bucketStart, bucketEnd);
      });
    });

    procurements.forEach((procurement) => {
      const timestamp = resolveProcurementPaidTimestamp(procurement);
      if (timestamp < firstBucketDate || timestamp >= endDate) return;
      const bucketIndex = bucketIndexByKey.get(toBucketKey(timestamp));
      if (bucketIndex === undefined) return;
      buckets[bucketIndex].procurement += procurement.totalCost;
    });

    return buckets.map((bucket) => {
      const outflow = bucket.expenses + bucket.procurement;
      return {
        ...bucket,
        outflow,
        net: bucket.revenue - outflow,
      };
    });
  }, [orders, nonFixedExpenses, fixedCosts, procurements]);

  const expensePeriodStats = useMemo(() => {
    let total = 0;
    let count = 0;
    nonFixedExpenses.forEach((expense) => {
      const timestamp = parseTimestamp(expense.date) ?? parseTimestamp(expense.createdAt);
      if (timestamp === null || timestamp < expensePeriodWindow.startMs || timestamp >= expensePeriodWindow.endMs) return;
      total += expense.amount;
      count += 1;
    });
    return { total, count };
  }, [nonFixedExpenses, expensePeriodWindow]);

  const procurementPeriodStats = useMemo(() => {
    let total = 0;
    let count = 0;
    procurements.forEach((procurement) => {
      const timestamp = resolveProcurementPaidTimestamp(procurement);
      if (timestamp < procurementPeriodWindow.startMs || timestamp >= procurementPeriodWindow.endMs) return;
      total += procurement.totalCost;
      count += 1;
    });
    return { total, count };
  }, [procurements, procurementPeriodWindow]);

  const revenueTrendData = useMemo<LineChartDatum[]>(() => {
    return monthlyTrend.map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      value: bucket.revenue,
    }));
  }, [monthlyTrend]);

  const outflowTrendData = useMemo(() => {
    return monthlyTrend.map((bucket) => ({
      label: bucket.label,
      value: bucket.outflow,
    }));
  }, [monthlyTrend]);

  const monthlySnapshotRows = useMemo(() => {
    return monthlyTrend.map((bucket) => ({
      label: bucket.label,
      value: formatSignedCurrency(bucket.net),
      subValue: `in ${formatCurrency(bucket.revenue)} | out ${formatCurrency(bucket.outflow)}`,
    }));
  }, [monthlyTrend]);

  const expenseRows = useMemo<ExpenseRow[]>(() => {
    return nonFixedExpenses
      .map((expense) => {
        const type = inferExpenseType(expense);
        const frequency = inferExpenseFrequency(expense, type);
        const sortAt = parseTimestamp(expense.date) ?? parseTimestamp(expense.createdAt) ?? 0;
        const merchant = extractMetadataValue(expense.description, 'merchant') ?? '';
        return {
          id: expense.id,
          name: stripMetadata(expense.description) || expense.description,
          merchant,
          category: expense.category || 'General',
          type,
          frequency,
          amount: expense.amount,
          date: new Date(sortAt || Date.now()).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          sortAt,
        };
      })
      .sort((a, b) => b.sortAt - a.sortAt);
  }, [nonFixedExpenses]);

  const filteredExpenseRows = useMemo(() => {
    const normalizedSearch = expenseSearchQuery.trim().toLowerCase();
    const filtered = expenseRows.filter((expense) => {
      if (expenseFilter !== 'all' && expense.type !== expenseFilter) return false;
      if (!normalizedSearch) return true;

      const searchBlob = [
        expense.name,
        expense.category,
        expense.type,
        expense.frequency,
        expense.merchant,
      ].join(' ').toLowerCase();

      return searchBlob.includes(normalizedSearch);
    });
    return filtered.sort((left, right) => {
      if (expenseSort === 'oldest') return left.sortAt - right.sortAt || right.amount - left.amount;
      if (expenseSort === 'amount-high') return right.amount - left.amount || right.sortAt - left.sortAt;
      if (expenseSort === 'amount-low') return left.amount - right.amount || right.sortAt - left.sortAt;
      return right.sortAt - left.sortAt || right.amount - left.amount;
    });
  }, [expenseFilter, expenseRows, expenseSearchQuery, expenseSort]);

  const filteredExpensesTotal = useMemo(
    () => filteredExpenseRows.reduce((sum, expense) => sum + expense.amount, 0),
    [filteredExpenseRows]
  );

  const expenseRequestRows = useMemo<ExpenseRequestRow[]>(() => (
    (expenseRequests ?? [])
      .map((request) => {
        const sortAt = parseTimestamp(request.updatedAt ?? request.createdAt) ?? 0;
        const dateAt = parseTimestamp(request.date) ?? sortAt;
        return {
          id: request.id,
          name: request.title,
          merchant: request.merchant ?? '',
          category: request.category || 'General',
          type: request.type,
          frequency: request.type === 'one-time' ? '—' : formatFrequencyLabel(request.frequency ?? 'Monthly'),
          amount: request.amount,
          date: new Date(parseTimestamp(request.date) ?? Date.now()).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          status: request.status,
          approvedExpenseId: request.approvedExpenseId,
          submittedByName: request.submittedByName || 'Team Member',
          submittedByUserId: request.submittedByUserId,
          rejectionReason: request.rejectionReason,
          dateAt,
          sortAt,
        };
      })
      .sort((a, b) => b.sortAt - a.sortAt)
  ), [expenseRequests]);

  const filteredExpenseRequestRows = useMemo(() => {
    const normalizedSearch = expenseSearchQuery.trim().toLowerCase();
    const filtered = expenseRequestRows.filter((request) => {
      if (expenseRequestFilter !== 'all' && request.status !== expenseRequestFilter) return false;
      if (!normalizedSearch) return true;
      const searchBlob = [
        request.name,
        request.category,
        request.merchant,
        request.status,
        request.submittedByName,
      ].join(' ').toLowerCase();
      return searchBlob.includes(normalizedSearch);
    });
    return filtered.sort((left, right) => {
      if (expenseRequestSort === 'oldest') return left.sortAt - right.sortAt || right.amount - left.amount;
      if (expenseRequestSort === 'amount-high') return right.amount - left.amount || right.sortAt - left.sortAt;
      if (expenseRequestSort === 'amount-low') return left.amount - right.amount || right.sortAt - left.sortAt;
      return right.sortAt - left.sortAt || right.amount - left.amount;
    });
  }, [expenseRequestRows, expenseRequestFilter, expenseRequestSort, expenseSearchQuery]);

  const isCurrentUserExpenseRequestRow = useCallback((row: ExpenseRequestRow) => {
    const normalizedCurrentUserId = currentUserId.trim();
    const normalizedCurrentName = currentUserName.trim().toLowerCase();
    if (normalizedCurrentUserId.length > 0 && row.submittedByUserId === normalizedCurrentUserId) {
      return true;
    }
    if (!normalizedCurrentName) return false;
    return row.submittedByName.trim().toLowerCase() === normalizedCurrentName;
  }, [currentUserId, currentUserName]);

  const myExpenseRequestRows = useMemo(
    () => expenseRequestRows.filter((row) => isCurrentUserExpenseRequestRow(row)),
    [expenseRequestRows, isCurrentUserExpenseRequestRow]
  );

  const filteredMyExpenseRequestRows = useMemo(
    () => filteredExpenseRequestRows.filter((row) => isCurrentUserExpenseRequestRow(row)),
    [filteredExpenseRequestRows, isCurrentUserExpenseRequestRow]
  );

  const mySubmittedExpenseRequestRows = useMemo(
    () => myExpenseRequestRows.filter((row) => row.status !== 'draft'),
    [myExpenseRequestRows]
  );

  const mySubmittedExpenseRequestPeriodStats = useMemo(() => {
    let total = 0;
    let count = 0;
    for (const row of mySubmittedExpenseRequestRows) {
      const timestamp = row.dateAt || row.sortAt;
      if (timestamp < expensePeriodWindow.startMs || timestamp >= expensePeriodWindow.endMs) continue;
      total += row.amount;
      count += 1;
    }
    return { total, count };
  }, [expensePeriodWindow, mySubmittedExpenseRequestRows]);

  const myPendingExpenseRequestRows = useMemo(
    () => myExpenseRequestRows.filter((row) => row.status === 'submitted'),
    [myExpenseRequestRows]
  );

  useEffect(() => {
    if (isFinanceApprover) return;
    if (expenseRequestFilter !== 'submitted') return;
    if (myPendingExpenseRequestRows.length > 0) return;
    if (myExpenseRequestRows.length === 0) return;
    setExpenseRequestFilter('all');
  }, [
    expenseRequestFilter,
    isFinanceApprover,
    myExpenseRequestRows.length,
    myPendingExpenseRequestRows.length,
  ]);

  const filteredMyExpenseRequestTotal = useMemo(
    () => filteredMyExpenseRequestRows.reduce((sum, row) => sum + row.amount, 0),
    [filteredMyExpenseRequestRows]
  );

  const refundRequestRows = useMemo<RefundRequestRow[]>(() => (
    (refundRequests ?? [])
      .map((request) => {
        const sortAt = parseTimestamp(request.updatedAt ?? request.createdAt) ?? 0;
        const dateAt = parseTimestamp(request.requestedDate) ?? sortAt;
        return {
          id: request.id,
          orderId: request.orderId,
          orderNumber: request.orderNumber,
          customerName: request.customerName,
          amount: request.amount,
          requestedDate: new Date(dateAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          status: request.status,
          refundType: request.refundType,
          submittedByName: request.submittedByName || 'Team Member',
          submittedByUserId: request.submittedByUserId,
          reviewedByName: request.reviewedByName,
          paidByName: request.paidByName,
          rejectionReason: request.rejectionReason,
          reason: request.reason,
          note: request.note,
          sortAt,
          dateAt,
        };
      })
      .sort((a, b) => b.sortAt - a.sortAt)
  ), [refundRequests]);

  const isCurrentUserRefundRequestOwner = useCallback((request: {
    submittedByUserId?: string;
    submittedByName?: string;
  }) => {
    const normalizedCurrentUserId = currentUserId.trim();
    const normalizedCurrentName = currentUserName.trim().toLowerCase();
    if (normalizedCurrentUserId.length > 0 && request.submittedByUserId === normalizedCurrentUserId) {
      return true;
    }
    if (!normalizedCurrentName) return false;
    return (request.submittedByName ?? '').trim().toLowerCase() === normalizedCurrentName;
  }, [currentUserId, currentUserName]);

  const isCurrentUserRefundRequestRow = useCallback((row: RefundRequestRow) => {
    return isCurrentUserRefundRequestOwner(row);
  }, [isCurrentUserRefundRequestOwner]);

  const visibleRefundRequestRows = useMemo(
    () => (isFinanceApprover ? refundRequestRows : refundRequestRows.filter((row) => isCurrentUserRefundRequestRow(row))),
    [isFinanceApprover, refundRequestRows, isCurrentUserRefundRequestRow]
  );

  const filteredRefundRequestRows = useMemo(() => {
    const normalizedSearch = refundSearchQuery.trim().toLowerCase();
    const filtered = visibleRefundRequestRows.filter((row) => {
      if (refundRequestFilter !== 'all' && row.status !== refundRequestFilter) return false;
      if (!normalizedSearch) return true;
      const blob = [
        row.orderNumber,
        row.customerName,
        row.status,
        row.submittedByName,
        row.reason,
      ].join(' ').toLowerCase();
      return blob.includes(normalizedSearch);
    });
    return filtered.sort((left, right) => {
      if (refundSort === 'oldest') return left.sortAt - right.sortAt || right.amount - left.amount;
      if (refundSort === 'amount-high') return right.amount - left.amount || right.sortAt - left.sortAt;
      if (refundSort === 'amount-low') return left.amount - right.amount || right.sortAt - left.sortAt;
      return right.sortAt - left.sortAt || right.amount - left.amount;
    });
  }, [refundRequestFilter, refundSearchQuery, refundSort, visibleRefundRequestRows]);

  const filteredRefundRequestsTotal = useMemo(
    () => filteredRefundRequestRows.reduce((sum, row) => sum + (row.status === 'void' ? 0 : row.amount), 0),
    [filteredRefundRequestRows]
  );

  const submittedRefundRequestRows = useMemo(
    () => visibleRefundRequestRows.filter((row) => row.status !== 'draft' && row.status !== 'void'),
    [visibleRefundRequestRows]
  );

  const refundPeriodStats = useMemo(() => {
    let total = 0;
    let count = 0;
    for (const row of submittedRefundRequestRows) {
      const timestamp = row.dateAt || row.sortAt;
      if (timestamp < refundPeriodWindow.startMs || timestamp >= refundPeriodWindow.endMs) continue;
      total += row.amount;
      count += 1;
    }
    return { total, count };
  }, [refundPeriodWindow, submittedRefundRequestRows]);

  const pendingRefundApprovalRows = useMemo(
    () => refundRequestRows.filter((row) => row.status === 'submitted'),
    [refundRequestRows]
  );

  const myPendingRefundRequestRows = useMemo(
    () => refundRequestRows.filter((row) => (
      (row.status === 'submitted' || row.status === 'approved')
      && isCurrentUserRefundRequestRow(row)
    )),
    [refundRequestRows, isCurrentUserRefundRequestRow]
  );

  useEffect(() => {
    if (isFinanceApprover) return;
    if (refundRequestFilter !== 'submitted') return;
    if (myPendingRefundRequestRows.some((row) => row.status === 'submitted')) return;
    if (myPendingRefundRequestRows.some((row) => row.status === 'approved')) {
      setRefundRequestFilter('approved');
      return;
    }
    if (visibleRefundRequestRows.length === 0) return;
    setRefundRequestFilter('all');
  }, [
    isFinanceApprover,
    myPendingRefundRequestRows,
    refundRequestFilter,
    visibleRefundRequestRows.length,
  ]);

  const selectedRefundRequest = useMemo(
    () => (selectedRefundRequestId
      ? refundRequests.find((request) => request.id === selectedRefundRequestId) ?? null
      : null),
    [selectedRefundRequestId, refundRequests]
  );

  useEffect(() => {
    if (!selectedRefundRequestId) return;
    if (activeTab !== 'refunds') return;
    if (filteredRefundRequestRows.some((row) => row.id === selectedRefundRequestId)) return;
    if (showRefundRequestDetailModal && selectedRefundRequest) return;
    setSelectedRefundRequestId(null);
  }, [
    activeTab,
    filteredRefundRequestRows,
    selectedRefundRequest,
    selectedRefundRequestId,
    showRefundRequestDetailModal,
  ]);

  const selectedRefundOrder = useMemo(
    () => orders.find((order) => order.id === selectedRefundOrderId) ?? null,
    [orders, selectedRefundOrderId]
  );

  const editingRefundRequest = useMemo(
    () => (editingRefundRequestId
      ? refundRequests.find((request) => request.id === editingRefundRequestId) ?? null
      : null),
    [editingRefundRequestId, refundRequests]
  );

  const isEditingPaidRefundRequest = editingRefundRequest?.status === 'paid';
  const isEditingDraftLikeRefundRequest = !editingRefundRequest
    || editingRefundRequest.status === 'draft'
    || editingRefundRequest.status === 'rejected';
  const canManageEditingRefundRequest = Boolean(
    editingRefundRequest
    && (isFinanceApprover || isCurrentUserRefundRequestOwner(editingRefundRequest))
  );

  useEffect(() => {
    setRefundDetailActionMenuOpen(false);
  }, [selectedRefundRequestId, showRefundRequestDetailModal]);

  useEffect(() => {
    if (!showRefundRequestModal) {
      setRefundComposerActionMenuOpen(false);
    }
  }, [showRefundRequestModal]);

  const refundOrderMatches = useMemo(() => {
    const normalizedQuery = refundOrderSearchQuery.trim().toLowerCase();
    const candidates = orders.filter((order) => {
      if (order.status === 'Refunded') return false;
      if (!normalizedQuery) return true;
      const blob = [
        order.orderNumber,
        order.customerName,
        order.customerPhone,
        order.customerEmail,
      ].join(' ').toLowerCase();
      return blob.includes(normalizedQuery);
    });
    return candidates.slice(0, 8);
  }, [orders, refundOrderSearchQuery]);

  const pendingExpenseApprovalRows = useMemo(
    () => expenseRequestRows.filter((row) => row.status === 'submitted'),
    [expenseRequestRows]
  );

  const approvalWorkspaceRows = useMemo(() => {
    const query = approvalQueueSearchQuery.trim().toLowerCase();
    if (!query) return pendingExpenseApprovalRows;
    return pendingExpenseApprovalRows.filter((row) => {
      const blob = [row.name, row.category, row.submittedByName, row.date].join(' ').toLowerCase();
      return blob.includes(query);
    });
  }, [approvalQueueSearchQuery, pendingExpenseApprovalRows]);

  const isExpenseApprovalWorkspaceActive = isWebDesktop
    ? expenseWorkspaceView === 'approvals'
    : showExpenseApprovalWorkspace;

  const approvalWorkspaceSelectedRequest = useMemo(
    () => (approvalWorkspaceSelectedId
      ? expenseRequests.find((request) => request.id === approvalWorkspaceSelectedId) ?? null
      : null),
    [approvalWorkspaceSelectedId, expenseRequests]
  );


  const approvalWorkspaceLineItems = useMemo(() => {
    if (!approvalWorkspaceSelectedRequest) return [];
    if ((approvalWorkspaceSelectedRequest.lineItems ?? []).length > 0) return approvalWorkspaceSelectedRequest.lineItems ?? [];
    return parseExpenseLineItemsFromDescription(
      undefined,
      approvalWorkspaceSelectedRequest.category || 'General',
      approvalWorkspaceSelectedRequest.amount
    );
  }, [approvalWorkspaceSelectedRequest]);

  const approvalDetailRequest = useMemo(
    () => (approvalDetailRequestId
      ? expenseRequests.find((request) => request.id === approvalDetailRequestId) ?? null
      : null),
    [approvalDetailRequestId, expenseRequests]
  );

  const approvalDetailLineItems = useMemo(
    () => {
      if (!approvalDetailRequest) return [];
      if ((approvalDetailRequest.lineItems ?? []).length > 0) return approvalDetailRequest.lineItems ?? [];
      return parseExpenseLineItemsFromDescription(
        undefined,
        approvalDetailRequest.category || 'General',
        approvalDetailRequest.amount
      );
    },
    [approvalDetailRequest]
  );

  useEffect(() => {
    if (!isExpenseApprovalWorkspaceActive) return;
    if (pendingExpenseApprovalRows.length === 0) {
      setApprovalWorkspaceSelectedId(null);
      if (isWebDesktop) {
        setExpenseWorkspaceView('list');
      } else {
        setShowExpenseApprovalWorkspace(false);
      }
      return;
    }
    if (approvalWorkspaceRows.length === 0) {
      if (approvalWorkspaceSelectedId) {
        setApprovalWorkspaceSelectedId(null);
      }
      return;
    }
    if (!isWebDesktop) {
      if (approvalWorkspaceSelectedId && !approvalWorkspaceRows.some((row) => row.id === approvalWorkspaceSelectedId)) {
        setApprovalWorkspaceSelectedId(null);
      }
      return;
    }
    if (approvalWorkspaceSelectedId && !approvalWorkspaceRows.some((row) => row.id === approvalWorkspaceSelectedId)) {
      setApprovalWorkspaceSelectedId(approvalWorkspaceRows[0]?.id ?? null);
    } else if (!approvalWorkspaceSelectedId && approvalWorkspaceRows.length > 0) {
      setApprovalWorkspaceSelectedId(approvalWorkspaceRows[0].id);
    }
  }, [
    approvalWorkspaceRows,
    approvalWorkspaceSelectedId,
    isExpenseApprovalWorkspaceActive,
    isWebDesktop,
    pendingExpenseApprovalRows,
  ]);

  const procurementRows = useMemo<ProcurementRow[]>(() => {
    return procurements
      .map((procurement) => {
        const createdAtMs = parseTimestamp(procurement.createdAt) ?? 0;
        const status = inferProcurementStatus(procurement);
        const paidDate = resolveProcurementPaidDate(procurement, createdAtMs);
        const paidAtMs = parseFlexibleDateToTimestamp(paidDate) ?? createdAtMs;
        const receivedDate = resolveProcurementReceivedDate(procurement, createdAtMs);

        return {
          id: procurement.id,
          poNumber: resolveProcurementPONumber(procurement),
          title: procurement.title ?? '',
          supplier: procurement.supplierName,
          status,
          approvalStatus: inferProcurementApprovalStatus(procurement),
          requestedStatus: resolveProcurementRequestedStatus(procurement),
          submittedByUserId: resolveProcurementSubmittedByUserId(procurement),
          submittedByName: resolveProcurementSubmittedByName(procurement),
          rejectionReason: resolveProcurementRejectionReason(procurement),
          paidDate,
          receivedDate,
          total: procurement.totalCost,
          lineCount: procurement.items.length,
          sortAt: paidAtMs,
        };
      })
      .sort((a, b) => {
        const aRank = procurementStatusOrderMap.get(a.status.trim().toLowerCase()) ?? 999;
        const bRank = procurementStatusOrderMap.get(b.status.trim().toLowerCase()) ?? 999;
        const rankDiff = aRank - bRank;
        if (rankDiff !== 0) return rankDiff;
        return b.sortAt - a.sortAt;
      });
  }, [procurements, procurementStatusOrderMap]);

  const isCurrentUserProcurementRow = useCallback((row: ProcurementRow) => {
    const normalizedCurrentUserId = currentUserId.trim();
    const normalizedCurrentName = currentUserName.trim().toLowerCase();
    if (normalizedCurrentUserId.length > 0 && row.submittedByUserId === normalizedCurrentUserId) {
      return true;
    }
    if (!normalizedCurrentName) return false;
    return row.submittedByName.trim().toLowerCase() === normalizedCurrentName;
  }, [currentUserId, currentUserName]);

  const filteredProcurementRows = useMemo(() => {
    const normalizedSearch = procurementSearchQuery.trim().toLowerCase();
    const filtered = procurementRows.filter((procurement) => {
      if (procurementFilter !== 'all' && procurement.status !== procurementFilter) return false;
      if (!normalizedSearch) return true;

      const searchBlob = [
        procurement.poNumber,
        procurement.title,
        procurement.supplier,
        procurement.status,
        procurement.submittedByName,
        procurement.paidDate,
        procurement.receivedDate,
      ].join(' ').toLowerCase();

      return searchBlob.includes(normalizedSearch);
    });
    if (procurementSort === 'workflow') return filtered;
    return filtered.sort((left, right) => {
      if (procurementSort === 'oldest') return left.sortAt - right.sortAt || right.total - left.total;
      if (procurementSort === 'amount-high') return right.total - left.total || right.sortAt - left.sortAt;
      if (procurementSort === 'amount-low') return left.total - right.total || right.sortAt - left.sortAt;
      return right.sortAt - left.sortAt || right.total - left.total;
    });
  }, [procurementFilter, procurementRows, procurementSearchQuery, procurementSort]);

  const visibleProcurementRows = useMemo(() => {
    if (isFinanceApprover) return filteredProcurementRows;
    if (!isManagerRole) return [];
    return filteredProcurementRows.filter((row) => isCurrentUserProcurementRow(row));
  }, [filteredProcurementRows, isCurrentUserProcurementRow, isFinanceApprover, isManagerRole]);

  const managerSubmittedProcurementRows = useMemo(
    () => procurementRows.filter((row) => isCurrentUserProcurementRow(row) && row.approvalStatus !== 'draft'),
    [isCurrentUserProcurementRow, procurementRows]
  );

  const managerSubmittedProcurementPeriodStats = useMemo(() => {
    let total = 0;
    let count = 0;
    managerSubmittedProcurementRows.forEach((row) => {
      if (row.sortAt < procurementPeriodWindow.startMs || row.sortAt >= procurementPeriodWindow.endMs) return;
      total += row.total;
      count += 1;
    });
    return { total, count };
  }, [managerSubmittedProcurementRows, procurementPeriodWindow]);

  const pendingProcurementApprovalRows = useMemo(
    () => procurementRows.filter((row) => row.approvalStatus === 'submitted'),
    [procurementRows]
  );

  const procurementApprovalWorkspaceRows = useMemo(() => {
    const query = procurementQueueSearchQuery.trim().toLowerCase();
    if (!query) return pendingProcurementApprovalRows;
    return pendingProcurementApprovalRows.filter((row) => {
      const blob = [row.title, row.poNumber, row.supplier, row.submittedByName].join(' ').toLowerCase();
      return blob.includes(query);
    });
  }, [procurementQueueSearchQuery, pendingProcurementApprovalRows]);

  const procurementWorkspaceSelectedRequest = useMemo(
    () => (procurementWorkspaceSelectedId
      ? procurements.find((p) => p.id === procurementWorkspaceSelectedId) ?? null
      : null),
    [procurementWorkspaceSelectedId, procurements]
  );

  const procurementWorkspaceSelectedRow = useMemo(
    () => (procurementWorkspaceSelectedId
      ? pendingProcurementApprovalRows.find((r) => r.id === procurementWorkspaceSelectedId) ?? null
      : null),
    [procurementWorkspaceSelectedId, pendingProcurementApprovalRows]
  );

  useEffect(() => {
    if (!isShowingWebProcurementApprovals) return;
    if (pendingProcurementApprovalRows.length === 0) {
      setProcurementWorkspaceSelectedId(null);
      setProcurementWorkspaceView('list');
      return;
    }
    if (procurementApprovalWorkspaceRows.length === 0) {
      if (procurementWorkspaceSelectedId) setProcurementWorkspaceSelectedId(null);
      return;
    }
    if (procurementWorkspaceSelectedId && !procurementApprovalWorkspaceRows.some((r) => r.id === procurementWorkspaceSelectedId)) {
      setProcurementWorkspaceSelectedId(procurementApprovalWorkspaceRows[0]?.id ?? null);
    } else if (!procurementWorkspaceSelectedId && procurementApprovalWorkspaceRows.length > 0) {
      setProcurementWorkspaceSelectedId(procurementApprovalWorkspaceRows[0].id);
    }
  }, [procurementApprovalWorkspaceRows, procurementWorkspaceSelectedId, isShowingWebProcurementApprovals, pendingProcurementApprovalRows]);

  const expenseFilterSortCount = useMemo(
    () => (expenseFilter !== 'all' ? 1 : 0) + (expenseSort !== 'newest' ? 1 : 0),
    [expenseFilter, expenseSort]
  );

  const expenseRequestFilterSortCount = useMemo(
    () => (expenseRequestFilter !== 'all' ? 1 : 0) + (expenseRequestSort !== 'newest' ? 1 : 0),
    [expenseRequestFilter, expenseRequestSort]
  );

  const refundRequestFilterSortCount = useMemo(
    () => (refundRequestFilter !== 'all' ? 1 : 0) + (refundSort !== 'newest' ? 1 : 0),
    [refundRequestFilter, refundSort]
  );

  const procurementFilterSortCount = useMemo(
    () => (procurementFilter !== 'all' ? 1 : 0) + (procurementSort !== 'workflow' ? 1 : 0),
    [procurementFilter, procurementSort]
  );

  const filteredProcurementTotal = useMemo(
    () => visibleProcurementRows.reduce((sum, procurement) => sum + procurement.total, 0),
    [visibleProcurementRows]
  );

  const filteredSupplierRows = useMemo(() => {
    const query = supplierSearchQuery.trim().toLowerCase();
    return (financeSuppliers ?? [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter((supplier) => {
        if (!query) return true;
        return [
          supplier.name,
          supplier.contactName,
          supplier.email,
          supplier.paymentTerms,
        ].join(' ').toLowerCase().includes(query);
      });
  }, [financeSuppliers, supplierSearchQuery]);

  const filteredStatusRows = useMemo(() => {
    const query = statusSearchQuery.trim().toLowerCase();
    return effectiveProcurementStatusOptions.filter((status) => {
      if (!query) return true;
      return status.name.toLowerCase().includes(query);
    });
  }, [effectiveProcurementStatusOptions, statusSearchQuery]);

  const filteredFixedCostRows = useMemo(() => {
    const query = fixedCostSearchQuery.trim().toLowerCase();
    const rows = (fixedCosts ?? [])
      .slice()
      .sort((a, b) => {
        const aUpdated = parseTimestamp(a.updatedAt ?? a.createdAt) ?? 0;
        const bUpdated = parseTimestamp(b.updatedAt ?? b.createdAt) ?? 0;
        return bUpdated - aUpdated;
      });
    if (!query) return rows;
    return rows.filter((cost) => {
      const searchBlob = [
        cost.name,
        cost.category,
        cost.frequency,
        cost.supplierName ?? '',
        cost.notes ?? '',
      ].join(' ').toLowerCase();
      return searchBlob.includes(query);
    });
  }, [fixedCostSearchQuery, fixedCosts]);

  const filteredFixedCostCategories = useMemo(() => {
    const query = fixedCostCategorySearch.trim().toLowerCase();
    if (!query) return availableExpenseCategories.slice(0, 80);
    return availableExpenseCategories
      .filter((category) => category.toLowerCase().includes(query))
      .slice(0, 80);
  }, [availableExpenseCategories, fixedCostCategorySearch]);

  const filteredFixedCostSuppliers = useMemo(() => {
    const query = fixedCostSupplierSearch.trim().toLowerCase();
    if (!query) return availableExpenseMerchants.slice(0, 80);
    return availableExpenseMerchants
      .filter((supplier) => supplier.toLowerCase().includes(query))
      .slice(0, 80);
  }, [availableExpenseMerchants, fixedCostSupplierSearch]);

  const normalizedExpenseLineItems = useMemo<ExpenseBreakdownLineItem[]>(() => (
    expenseLineItems
      .map((line, index) => {
        const kind: 'base' | 'charge' = line.kind === 'charge' ? 'charge' : (index === 0 ? 'base' : 'charge');
        return {
          id: line.id,
          label: (line.label || '').trim() || (index === 0 ? 'Base Amount' : 'Additional Charge'),
          amount: lineItemAmountToNumber(line.amount),
          category: normalizeBreakdownCategory(line.category || expenseCategory || 'General'),
          kind,
        };
      })
      .filter((line) => line.amount > 0)
  ), [expenseCategory, expenseLineItems]);

  const expenseTransferCharges = useMemo(() => {
    const baseAmount = lineItemAmountToNumber(expenseLineItems[0]?.amount ?? '');
    return getTransferChargeBreakdown({
      baseAmount,
      applyCharges: applyBankCharges,
      tiers: financeRules.bankChargeTiers,
      vatRate: financeRules.vatRate,
      stampDutyAmount: financeRules.incomingStampDuty ?? 50,
    });
  }, [applyBankCharges, expenseLineItems, financeRules.bankChargeTiers, financeRules.incomingStampDuty, financeRules.vatRate]);

  const bankChargeAmount = expenseTransferCharges.fee + expenseTransferCharges.vat;
  const expenseStampDuty = expenseTransferCharges.stampDuty;

  const expenseLineItemsTotal = useMemo(
    () => normalizedExpenseLineItems.reduce((sum, line) => sum + line.amount, 0) + bankChargeAmount + expenseStampDuty,
    [normalizedExpenseLineItems, bankChargeAmount, expenseStampDuty]
  );

  const refundBaseAmount = useMemo(
    () => lineItemAmountToNumber(refundAmountDraft),
    [refundAmountDraft]
  );

  const refundTransferCharges = useMemo(() => (
    getTransferChargeBreakdown({
      baseAmount: refundBaseAmount,
      applyCharges: applyRefundBankCharges,
      tiers: financeRules.bankChargeTiers,
      vatRate: financeRules.vatRate,
      stampDutyAmount: financeRules.incomingStampDuty ?? 50,
    })
  ), [applyRefundBankCharges, financeRules.bankChargeTiers, financeRules.incomingStampDuty, financeRules.vatRate, refundBaseAmount]);

  const refundBankChargeAmount = refundTransferCharges.fee + refundTransferCharges.vat;
  const refundStampDuty = refundTransferCharges.stampDuty;
  const refundTotalDebit = refundBaseAmount + refundTransferCharges.total;

  const chargePreviewAmount = useMemo(
    () => lineItemAmountToNumber(chargePreviewAmountDraft),
    [chargePreviewAmountDraft]
  );

  const chargePreviewTier = useMemo(
    () => financeRules.bankChargeTiers.find((tier) => tier.maxAmount === null || chargePreviewAmount <= tier.maxAmount) ?? null,
    [chargePreviewAmount, financeRules.bankChargeTiers]
  );

  const chargePreviewFee = chargePreviewTier?.fixedFee ?? 0;
  const chargePreviewVat = chargePreviewFee * financeRules.vatRate;
  const chargePreviewStampDuty = chargePreviewAmount >= STAMP_DUTY_THRESHOLD ? (financeRules.incomingStampDuty ?? 50) : 0;
  const chargePreviewTotalCharges = chargePreviewFee + chargePreviewVat + chargePreviewStampDuty;
  const chargePreviewTotalDebit = chargePreviewAmount + chargePreviewTotalCharges;

  useEffect(() => {
    const nextAmount = expenseLineItemsTotal > 0 ? String(expenseLineItemsTotal) : '';
    if (expenseAmount !== nextAmount) {
      setExpenseAmount(nextAmount);
    }
  }, [expenseAmount, expenseLineItemsTotal]);

  useEffect(() => {
    const primaryCategory = normalizeBreakdownCategory(expenseLineItems[0]?.category || expenseCategory || 'General');
    if (primaryCategory && primaryCategory !== expenseCategory) {
      setExpenseCategory(primaryCategory);
      setExpenseCategorySearch(primaryCategory);
    }
  }, [expenseCategory, expenseLineItems]);

  const canSaveExpense = Boolean(
    expenseName.trim()
    && expenseCategory.trim()
    && Number.isFinite(Number(expenseAmount.replace(/,/g, '')))
    && Number(expenseAmount.replace(/,/g, '')) > 0
    && normalizedExpenseLineItems.length > 0
  );

  const editingExpenseRequest = useMemo(
    () => (editingExpenseRequestId
      ? expenseRequests.find((request) => request.id === editingExpenseRequestId) ?? null
      : null),
    [editingExpenseRequestId, expenseRequests]
  );

  const canRevokeExpenseRequestFromModal = Boolean(
    isMobile
    && !isFinanceApprover
    && editingExpenseRequestId
    && editingExpenseRequest?.status === 'submitted'
  );
  const canDeleteDraftExpenseRequestFromModal = Boolean(
    editingExpenseRequestId
    && editingExpenseRequest?.status === 'draft'
  );

  const canSaveProcurement = Boolean(
    poSupplierDraft.trim()
    && poPurchaseLines.some((l) => parseFloat(l.amount) > 0)
  );

  const canSaveSupplier = Boolean(supplierNameDraft.trim());
  const canSaveCategory = Boolean(categoryNameDraft.trim());
  const canSaveProcurementStatus = Boolean(statusNameDraft.trim());
  const canSaveFixedCost = Boolean(
    fixedCostNameDraft.trim()
    && fixedCostCategoryDraft.trim()
    && Number.isFinite(Number(fixedCostAmountDraft.replace(/,/g, '')))
    && Number(fixedCostAmountDraft.replace(/,/g, '')) > 0
  );

  const selectedMobileExpense = useMemo(
    () => (mobileDetail?.kind === 'expense'
      ? expenseRows.find((row) => row.id === mobileDetail.id) ?? null
      : null),
    [mobileDetail, expenseRows]
  );
  const selectedMobileExpenseRecord = useMemo(
    () => (mobileDetail?.kind === 'expense'
      ? expenses.find((row) => row.id === mobileDetail.id) ?? null
      : null),
    [mobileDetail, expenses]
  );
  const selectedMobileExpenseLineItems = useMemo(
    () => {
      if (!selectedMobileExpenseRecord) return [];
      return parseExpenseLineItemsFromDescription(
        selectedMobileExpenseRecord.description,
        selectedMobileExpenseRecord.category || selectedMobileExpense?.category || 'General',
        selectedMobileExpenseRecord.amount
      );
    },
    [selectedMobileExpense, selectedMobileExpenseRecord]
  );
  const selectedMobileExpenseReceipts = useMemo(
    () => parseExpenseReceiptsFromDescription(selectedMobileExpenseRecord?.description),
    [selectedMobileExpenseRecord]
  );

  const selectedMobileProcurement = useMemo(
    () => (mobileDetail?.kind === 'procurement'
      ? procurementRows.find((row) => row.id === mobileDetail.id) ?? null
      : null),
    [mobileDetail, procurementRows]
  );
  const selectedMobileProcurementRecord = useMemo(
    () => (mobileDetail?.kind === 'procurement'
      ? procurements.find((row) => row.id === mobileDetail.id) ?? null
      : null),
    [mobileDetail, procurements]
  );

  const selectedMobileSupplier = useMemo(
    () => (mobileDetail?.kind === 'supplier'
      ? financeSuppliers.find((row) => row.id === mobileDetail.id) ?? null
      : null),
    [mobileDetail, financeSuppliers]
  );

  const selectedMobileCategory = useMemo(
    () => (mobileDetail?.kind === 'category'
      ? expenseCategories.find((row) => row.id === mobileDetail.id) ?? null
      : null),
    [mobileDetail, expenseCategories]
  );

  const selectedMobileFixedCost = useMemo(
    () => (mobileDetail?.kind === 'fixed-cost'
      ? fixedCosts.find((row) => row.id === mobileDetail.id) ?? null
      : null),
    [mobileDetail, fixedCosts]
  );

  const selectedMobileStatus = useMemo(
    () => (mobileDetail?.kind === 'status'
      ? effectiveProcurementStatusOptions.find((row) => row.id === mobileDetail.id) ?? null
      : null),
    [mobileDetail, effectiveProcurementStatusOptions]
  );

  const handleDeleteExpense = (expenseId: string) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    deleteExpense(expenseId, businessId);
  };

  const handleDeleteDraftExpenseRequest = (requestId: string) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    deleteExpenseRequest(requestId, businessId);
  };

  const handleDeleteProcurement = (procurementId: string) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    deleteProcurement(procurementId, businessId);
  };

  const handleOpenExpenseReceipt = async (storagePath: string) => {
    const normalizedPath = storagePath.trim();
    if (!normalizedPath) return;
    try {
      await openAttachmentPath(normalizedPath, 60 * 10);
    } catch (error) {
      console.warn('Open expense receipt failed:', error);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const openExpenseApprovalWorkspace = useCallback((requestId?: string) => {
    setApprovalQueueSearchQuery('');
    const initialSelectedId = isWebDesktop
      ? (requestId ?? pendingExpenseApprovalRows[0]?.id ?? null)
      : (requestId ?? null);
    setApprovalWorkspaceSelectedId(initialSelectedId);
    setApprovalInfoRequestNote('');
    if (isWebDesktop) {
      setExpenseWorkspaceView('approvals');
    } else {
      setShowExpenseApprovalWorkspace(true);
    }
  }, [isWebDesktop, pendingExpenseApprovalRows]);

  const focusNextPendingExpenseApproval = useCallback((processedRequestId: string) => {
    const currentRows = pendingExpenseApprovalRows;
    if (currentRows.length <= 1) {
      setApprovalWorkspaceSelectedId(null);
      if (isWebDesktop) {
        setExpenseWorkspaceView('list');
      } else {
        setShowExpenseApprovalWorkspace(false);
      }
      return;
    }
    const currentIndex = currentRows.findIndex((row) => row.id === processedRequestId);
    const remainingRows = currentRows.filter((row) => row.id !== processedRequestId);
    const fallbackIndex = Math.max(0, Math.min(currentIndex, remainingRows.length - 1));
    setApprovalWorkspaceSelectedId(remainingRows[fallbackIndex]?.id ?? remainingRows[0]?.id ?? null);
    setApprovalInfoRequestNote('');
  }, [isWebDesktop, pendingExpenseApprovalRows]);

  const openProcurementApprovalWorkspace = useCallback((procurementId?: string) => {
    setProcurementQueueSearchQuery('');
    setProcurementWorkspaceSelectedId(procurementId ?? pendingProcurementApprovalRows[0]?.id ?? null);
    setProcurementWorkspaceView('approvals');
  }, [pendingProcurementApprovalRows]);

  const focusNextPendingProcurementApproval = useCallback((processedId: string) => {
    const currentRows = pendingProcurementApprovalRows;
    if (currentRows.length <= 1) {
      setProcurementWorkspaceSelectedId(null);
      setProcurementWorkspaceView('list');
      return;
    }
    const currentIndex = currentRows.findIndex((row) => row.id === processedId);
    const remainingRows = currentRows.filter((row) => row.id !== processedId);
    const fallbackIndex = Math.max(0, Math.min(currentIndex, remainingRows.length - 1));
    setProcurementWorkspaceSelectedId(remainingRows[fallbackIndex]?.id ?? remainingRows[0]?.id ?? null);
  }, [pendingProcurementApprovalRows]);

  const handleApproveExpenseRequest = (requestId: string) => {
    const request = expenseRequests.find((item) => item.id === requestId);
    if (!request || request.status !== 'submitted') return;

    const approvedExpenseId = request.approvedExpenseId || `expense-${Date.now().toString(36)}`;
    const description = buildExpenseDescription(
      request.title,
      request.merchant ?? '',
      request.type,
      request.frequency ?? 'Monthly',
      request.note ?? '',
      request.receipts?.[0]?.storagePath,
      request.receipts?.[0]?.fileName,
      request.lineItems as ExpenseBreakdownLineItem[] | undefined,
      request.receipts
    );

    addExpense({
      id: approvedExpenseId,
      category: request.category,
      description,
      amount: request.amount,
      date: request.date,
      createdAt: new Date().toISOString(),
      createdBy: request.submittedByName || 'Team Member',
    }, businessId);

    updateExpenseRequest(requestId, {
      status: 'approved',
      approvedExpenseId,
      reviewedByUserId: currentUserId,
      reviewedByName: currentUserName,
      reviewedAt: new Date().toISOString(),
      rejectionReason: undefined,
      updatedAt: new Date().toISOString(),
    }, businessId);

    if (businessId && request.submittedByUserId && request.submittedByUserId !== currentUserId) {
      void sendThreadNotification({
        businessId,
        recipientUserIds: [request.submittedByUserId],
        senderUserId: currentUserId || null,
        authorName: currentUserName || 'Admin',
        body: `Your expense request "${request.title}" (${formatCurrency(request.amount)}) was approved.`,
        entityType: null,
        entityDisplayName: request.title,
        entityId: request.id,
      });
    }

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleRejectExpenseRequest = (requestId: string) => {
    const request = expenseRequests.find((item) => item.id === requestId);
    if (!request || request.status !== 'submitted') return;
    updateExpenseRequest(requestId, {
      status: 'rejected',
      reviewedByUserId: currentUserId,
      reviewedByName: currentUserName,
      reviewedAt: new Date().toISOString(),
      rejectionReason: 'Rejected by approver',
      updatedAt: new Date().toISOString(),
    }, businessId);

    if (businessId && request.submittedByUserId && request.submittedByUserId !== currentUserId) {
      void sendThreadNotification({
        businessId,
        recipientUserIds: [request.submittedByUserId],
        senderUserId: currentUserId || null,
        authorName: currentUserName || 'Admin',
        body: `Your expense request "${request.title}" (${formatCurrency(request.amount)}) was rejected.`,
        entityType: null,
        entityDisplayName: request.title,
        entityId: request.id,
      });
    }

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const handleRequestExpenseRequestInfo = (requestId: string, note?: string) => {
    const request = expenseRequests.find((item) => item.id === requestId);
    if (!request || request.status !== 'submitted') return;
    const trimmedNote = note?.trim() ?? '';
    updateExpenseRequest(requestId, {
      status: 'draft',
      submittedAt: undefined,
      reviewedByUserId: currentUserId,
      reviewedByName: currentUserName,
      reviewedAt: new Date().toISOString(),
      rejectionReason: trimmedNote ? `More info needed: ${trimmedNote}` : 'More info needed by approver.',
      updatedAt: new Date().toISOString(),
    }, businessId);

    if (businessId && request.submittedByUserId && request.submittedByUserId !== currentUserId) {
      void sendThreadNotification({
        businessId,
        recipientUserIds: [request.submittedByUserId],
        senderUserId: currentUserId || null,
        authorName: currentUserName || 'Admin',
        body: trimmedNote
          ? `More info needed for "${request.title}" (${formatCurrency(request.amount)}): ${trimmedNote}`
          : `More info needed for "${request.title}" (${formatCurrency(request.amount)}).`,
        entityType: null,
        entityDisplayName: request.title,
        entityId: request.id,
      });
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const handleRevokeExpenseRequest = (requestId: string) => {
    const request = expenseRequests.find((item) => item.id === requestId);
    if (!request || request.status !== 'submitted') return;
    updateExpenseRequest(requestId, {
      status: 'draft',
      submittedAt: undefined,
      reviewedByUserId: undefined,
      reviewedByName: undefined,
      reviewedAt: undefined,
      rejectionReason: undefined,
      updatedAt: new Date().toISOString(),
    }, businessId);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSaveRefundRequestModal = async (mode: 'save' | 'submit' = 'save') => {
    const existingRequest = editingRefundRequestId
      ? refundRequests.find((request) => request.id === editingRefundRequestId) ?? null
      : null;

    if (editingRefundRequestId && !existingRequest) {
      showSettingsToast('error', 'This refund request could not be found.');
      return;
    }

    if (existingRequest?.status === 'void') {
      showSettingsToast('error', 'Voided refunds cannot be edited.');
      return;
    }

    if (existingRequest && !isFinanceApprover && !isCurrentUserRefundRequestOwner(existingRequest)) {
      showSettingsToast('error', 'Only the request owner can edit this refund.');
      return;
    }

    const selectedOrder = orders.find((order) => order.id === selectedRefundOrderId) ?? null;
    const lockedPaidOrder = existingRequest?.status === 'paid'
      ? (orders.find((order) => order.id === existingRequest.orderId) ?? null)
      : null;
    const targetOrder = lockedPaidOrder ?? selectedOrder;

    if (!targetOrder) {
      showSettingsToast('error', 'Select an order for this refund.');
      return;
    }

    const canModifyFinancialFields = existingRequest?.status !== 'paid';
    const parsedAmount = Number.parseFloat(refundAmountDraft);
    if (canModifyFinancialFields && (!Number.isFinite(parsedAmount) || parsedAmount <= 0)) {
      showSettingsToast('error', 'Enter a valid refund amount.');
      return;
    }

    const effectiveAmount = canModifyFinancialFields
      ? parsedAmount
      : Math.max(0, existingRequest?.amount ?? 0);

    const existingPaidAmount = existingRequest?.status === 'paid' ? existingRequest.amount : 0;
    const remainingRefundable = Math.max(
      0,
      targetOrder.totalAmount - Math.max(0, (targetOrder.refund?.amount ?? 0) - existingPaidAmount)
    );
    if (canModifyFinancialFields && effectiveAmount > remainingRefundable + 0.01) {
      showSettingsToast('error', `Refund exceeds remaining balance of ${formatCurrency(remainingRefundable)}.`);
      return;
    }

    const nowIso = new Date().toISOString();
    const nextStatus: RefundRequestStatus = !existingRequest
      ? (mode === 'submit' ? (isFinanceApprover ? 'approved' : 'submitted') : 'draft')
      : ((existingRequest.status === 'draft' || existingRequest.status === 'rejected')
        ? (mode === 'submit' ? (isFinanceApprover ? 'approved' : 'submitted') : 'draft')
        : existingRequest.status);

    let uploadedAttachments = undefined;
    if (refundAttachmentDrafts.length > 0) {
      if (!businessId) {
        showSettingsToast('error', 'Could not upload refund screenshots right now.');
        return;
      }
      try {
        uploadedAttachments = await uploadRefundRequestAttachments(businessId, refundAttachmentDrafts, 'finance');
        setRefundAttachmentError('');
      } catch (error) {
        console.warn('Refund attachment upload failed:', error);
        setRefundAttachmentError('Could not upload screenshots. Please try again.');
        showSettingsToast('error', 'Could not upload refund screenshots.');
        return;
      }
    }

    const effectiveReason = canModifyFinancialFields
      ? refundReasonDraft.trim()
      : (existingRequest?.reason ?? '');
    const effectiveRequestedDate = canModifyFinancialFields
      ? toIsoDate(refundRequestedDate)
      : (existingRequest?.requestedDate ?? toIsoDate(refundRequestedDate));
    const transferBreakdown = getTransferChargeBreakdown({
      baseAmount: effectiveAmount,
      applyCharges: applyRefundBankCharges,
      tiers: financeRules.bankChargeTiers,
      vatRate: financeRules.vatRate,
      stampDutyAmount: financeRules.incomingStampDuty ?? 50,
    });
    const bankChargeValue = applyRefundBankCharges ? (transferBreakdown.fee + transferBreakdown.vat) : 0;
    const stampDutyValue = applyRefundBankCharges ? transferBreakdown.stampDuty : 0;
    const totalDebitValue = effectiveAmount + bankChargeValue + stampDutyValue;
    const baseAppliedAmount = Math.max(0, (targetOrder.refund?.amount ?? 0) - existingPaidAmount);
    const refundType = canModifyFinancialFields
      ? inferRefundRequestType(targetOrder.totalAmount, baseAppliedAmount + effectiveAmount)
      : (existingRequest?.refundType ?? inferRefundRequestType(targetOrder.totalAmount, baseAppliedAmount + effectiveAmount));
    const shouldAutoApprove = nextStatus === 'approved' && (!existingRequest || existingRequest.status !== 'approved');

    const payload: Partial<RefundRequest> = {
      orderId: canModifyFinancialFields ? targetOrder.id : (existingRequest?.orderId ?? targetOrder.id),
      orderNumber: canModifyFinancialFields ? targetOrder.orderNumber : (existingRequest?.orderNumber ?? targetOrder.orderNumber),
      customerName: canModifyFinancialFields ? targetOrder.customerName : (existingRequest?.customerName ?? targetOrder.customerName),
      customerPhone: canModifyFinancialFields ? targetOrder.customerPhone : (existingRequest?.customerPhone ?? targetOrder.customerPhone),
      customerEmail: canModifyFinancialFields ? targetOrder.customerEmail : (existingRequest?.customerEmail ?? targetOrder.customerEmail),
      amount: effectiveAmount,
      requestedDate: effectiveRequestedDate,
      reason: effectiveReason,
      note: refundNoteDraft.trim(),
      attachments: refundAttachmentDrafts.length > 0
        ? ((uploadedAttachments && uploadedAttachments.length > 0) ? uploadedAttachments : [])
        : (existingRequest ? [] : undefined),
      status: nextStatus,
      refundType,
      source: existingRequest?.source ?? 'finance',
      submittedByUserId: existingRequest?.submittedByUserId ?? currentUserId,
      submittedByName: existingRequest?.submittedByName ?? currentUserName,
      submittedAt: nextStatus !== 'draft'
        ? (existingRequest?.submittedAt ?? nowIso)
        : undefined,
      reviewedByUserId: nextStatus === 'approved'
        ? (shouldAutoApprove ? currentUserId : (existingRequest?.reviewedByUserId ?? currentUserId))
        : (nextStatus === 'submitted' || nextStatus === 'draft' ? undefined : existingRequest?.reviewedByUserId),
      reviewedByName: nextStatus === 'approved'
        ? (shouldAutoApprove ? currentUserName : (existingRequest?.reviewedByName ?? currentUserName))
        : (nextStatus === 'submitted' || nextStatus === 'draft' ? undefined : existingRequest?.reviewedByName),
      reviewedAt: nextStatus === 'approved'
        ? (existingRequest?.reviewedAt ?? nowIso)
        : (nextStatus === 'submitted' || nextStatus === 'draft' ? undefined : existingRequest?.reviewedAt),
      rejectionReason: undefined,
      paidAt: nextStatus === 'paid' ? existingRequest?.paidAt : undefined,
      paidByUserId: nextStatus === 'paid' ? existingRequest?.paidByUserId : undefined,
      paidByName: nextStatus === 'paid' ? existingRequest?.paidByName : undefined,
      paymentReference: nextStatus === 'paid'
        ? (refundPaymentReferenceDraft.trim() || existingRequest?.paymentReference)
        : undefined,
      proofAttachments: nextStatus === 'paid' ? existingRequest?.proofAttachments : undefined,
      applyBankCharges: applyRefundBankCharges,
      bankChargeAmount: bankChargeValue,
      stampDutyAmount: stampDutyValue,
      totalDebitAmount: totalDebitValue,
      voidedAt: undefined,
      voidedByUserId: undefined,
      voidedByName: undefined,
      voidReason: undefined,
      updatedAt: nowIso,
    };

    let targetRequestId = editingRefundRequestId;
    try {
      if (editingRefundRequestId) {
        await updateRefundRequest(editingRefundRequestId, payload, businessId);
      } else {
        targetRequestId = Math.random().toString(36).slice(2, 15);
        await addRefundRequest({
          id: targetRequestId,
          orderId: payload.orderId ?? targetOrder.id,
          orderNumber: payload.orderNumber ?? targetOrder.orderNumber,
          customerName: payload.customerName ?? targetOrder.customerName,
          customerPhone: payload.customerPhone,
          customerEmail: payload.customerEmail,
          amount: payload.amount ?? effectiveAmount,
          requestedDate: payload.requestedDate ?? effectiveRequestedDate,
          reason: payload.reason ?? effectiveReason,
          note: payload.note,
          attachments: payload.attachments,
          proofAttachments: payload.proofAttachments,
          status: payload.status ?? nextStatus,
          refundType: payload.refundType ?? refundType,
          source: payload.source ?? 'finance',
          submittedByUserId: payload.submittedByUserId ?? currentUserId,
          submittedByName: payload.submittedByName ?? currentUserName,
          submittedAt: payload.submittedAt,
          reviewedByUserId: payload.reviewedByUserId,
          reviewedByName: payload.reviewedByName,
          reviewedAt: payload.reviewedAt,
          rejectionReason: payload.rejectionReason,
          paidAt: payload.paidAt,
          paidByUserId: payload.paidByUserId,
          paidByName: payload.paidByName,
          paymentReference: payload.paymentReference,
          applyBankCharges: payload.applyBankCharges,
          bankChargeAmount: payload.bankChargeAmount,
          stampDutyAmount: payload.stampDutyAmount,
          totalDebitAmount: payload.totalDebitAmount,
          createdAt: nowIso,
          updatedAt: nowIso,
        }, businessId);
      }
    } catch (error) {
      console.warn('Refund request save failed:', error);
      showSettingsToast('error', 'Could not save refund request. Check Supabase refund setup.');
      return;
    }

    const shouldNotifySubmission = nextStatus === 'submitted'
      && businessId
      && (!existingRequest || existingRequest.status !== 'submitted');
    if (shouldNotifySubmission) {
      const adminRecipientIds = teamMembers
        .filter((member) => member.role === 'admin' && member.id !== currentUserId)
        .map((member) => member.id);
      if (adminRecipientIds.length > 0 && targetRequestId) {
        void sendThreadNotification({
          businessId,
          recipientUserIds: adminRecipientIds,
          senderUserId: currentUserId || null,
          authorName: currentUserName || 'Team Member',
          body: `${currentUserName || 'A team member'} submitted a refund request for ${targetOrder.orderNumber} (${formatCurrency(effectiveAmount)}).`,
          entityType: 'order',
          entityDisplayName: targetOrder.orderNumber,
          entityId: targetOrder.id,
        });
      }
    }

    setShowRefundRequestModal(false);
    resetRefundRequestDraft();
    showSettingsToast(
      'success',
      existingRequest
        ? 'Refund request updated.'
        : nextStatus === 'approved'
          ? 'Refund request approved.'
          : nextStatus === 'submitted'
            ? 'Refund request submitted.'
            : 'Refund request saved.'
    );
    void Haptics.notificationAsync(
      nextStatus === 'draft' ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success
    );
  };

  const handleApproveRefundRequest = async (requestId: string) => {
    const request = refundRequests.find((item) => item.id === requestId);
    if (!request || request.status !== 'submitted') return;
    try {
      await updateRefundRequest(requestId, {
        status: 'approved',
        reviewedByUserId: currentUserId,
        reviewedByName: currentUserName,
        reviewedAt: new Date().toISOString(),
        rejectionReason: undefined,
        updatedAt: new Date().toISOString(),
      }, businessId);
    } catch (error) {
      console.warn('Refund request approval failed:', error);
      showSettingsToast('error', 'Could not approve refund request.');
      return;
    }

    if (businessId && request.submittedByUserId && request.submittedByUserId !== currentUserId) {
      void sendThreadNotification({
        businessId,
        recipientUserIds: [request.submittedByUserId],
        senderUserId: currentUserId || null,
        authorName: currentUserName || 'Admin',
        body: `Your refund request for ${request.orderNumber} (${formatCurrency(request.amount)}) was approved. Upload the refund receipt and mark it as paid once the transfer is completed.`,
        entityType: 'order',
        entityDisplayName: request.orderNumber,
        entityId: request.orderId,
      });
    }

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleRejectRefundRequest = async (requestId: string) => {
    const request = refundRequests.find((item) => item.id === requestId);
    if (!request || (request.status !== 'submitted' && request.status !== 'approved')) return;
    try {
      await updateRefundRequest(requestId, {
        status: 'rejected',
        reviewedByUserId: currentUserId,
        reviewedByName: currentUserName,
        reviewedAt: new Date().toISOString(),
        rejectionReason: 'Rejected by approver',
        updatedAt: new Date().toISOString(),
      }, businessId);
    } catch (error) {
      console.warn('Refund request rejection failed:', error);
      showSettingsToast('error', 'Could not reject refund request.');
      return;
    }

    if (businessId && request.submittedByUserId && request.submittedByUserId !== currentUserId) {
      void sendThreadNotification({
        businessId,
        recipientUserIds: [request.submittedByUserId],
        senderUserId: currentUserId || null,
        authorName: currentUserName || 'Admin',
        body: `Your refund request for ${request.orderNumber} (${formatCurrency(request.amount)}) was rejected.`,
        entityType: 'order',
        entityDisplayName: request.orderNumber,
        entityId: request.orderId,
      });
    }

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const handleRequestRefundRequestInfo = async (requestId: string, note?: string) => {
    const request = refundRequests.find((item) => item.id === requestId);
    if (!request || (request.status !== 'submitted' && request.status !== 'approved')) return;
    const trimmedNote = note?.trim() ?? '';
    try {
      await updateRefundRequest(requestId, {
        status: 'draft',
        submittedAt: undefined,
        reviewedByUserId: currentUserId,
        reviewedByName: currentUserName,
        reviewedAt: new Date().toISOString(),
        rejectionReason: trimmedNote ? `More info needed: ${trimmedNote}` : 'More info needed by approver.',
        updatedAt: new Date().toISOString(),
      }, businessId);
    } catch (error) {
      console.warn('Refund request info request failed:', error);
      showSettingsToast('error', 'Could not request more info for this refund.');
      return;
    }

    if (businessId && request.submittedByUserId && request.submittedByUserId !== currentUserId) {
      void sendThreadNotification({
        businessId,
        recipientUserIds: [request.submittedByUserId],
        senderUserId: currentUserId || null,
        authorName: currentUserName || 'Admin',
        body: trimmedNote
          ? `More info needed for refund request ${request.orderNumber} (${formatCurrency(request.amount)}): ${trimmedNote}`
          : `More info needed for refund request ${request.orderNumber} (${formatCurrency(request.amount)}).`,
        entityType: 'order',
        entityDisplayName: request.orderNumber,
        entityId: request.orderId,
      });
    }

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const handleMarkRefundRequestPaid = async (requestId: string, paymentReference?: string) => {
    const request = refundRequests.find((item) => item.id === requestId);
    if (!request || request.status !== 'approved') return;
    if (!isCurrentUserRefundRequestOwner(request)) {
      showSettingsToast('error', 'Only the requester can upload refund proof and complete this refund.');
      return;
    }
    if (!businessId) {
      showSettingsToast('error', 'Business not available for this refund.');
      return;
    }
    const order = orders.find((item) => item.id === request.orderId);
    if (!order) {
      showSettingsToast('error', 'Linked order not found for this refund.');
      return;
    }
    if (refundProofAttachmentDrafts.length === 0) {
      setRefundProofAttachmentError('Upload refund proof before marking this refund as paid.');
      showSettingsToast('error', 'Upload refund proof before marking this refund as paid.');
      return;
    }

    let uploadedProofAttachments = request.proofAttachments;
    try {
      uploadedProofAttachments = await uploadRefundRequestAttachments(businessId, refundProofAttachmentDrafts, 'finance');
      setRefundProofAttachmentError('');
    } catch (error) {
      console.warn('Refund proof upload failed:', error);
      setRefundProofAttachmentError('Could not upload refund proof. Please try again.');
      showSettingsToast('error', 'Could not upload refund proof.');
      return;
    }

    const nowIso = new Date().toISOString();
    const nextRequest: RefundRequest = {
      ...request,
      status: 'paid',
      paidAt: nowIso,
      paidByUserId: currentUserId,
      paidByName: currentUserName,
      paymentReference: paymentReference?.trim() || request.paymentReference,
      proofAttachments: uploadedProofAttachments,
      updatedAt: nowIso,
    };
    const orderUpdates = applyPaidRefundRequestToOrder(order, nextRequest);

    await updateOrder(order.id, {
      ...orderUpdates,
      updatedBy: currentUserName,
      updatedAt: nowIso,
    }, businessId);
    try {
      await updateRefundRequest(requestId, {
        status: 'paid',
        paidAt: nowIso,
        paidByUserId: currentUserId,
        paidByName: currentUserName,
        paymentReference: paymentReference?.trim() || request.paymentReference,
        proofAttachments: uploadedProofAttachments,
        updatedAt: nowIso,
      }, businessId);
    } catch (error) {
      console.warn('Refund request payout update failed:', error);
      showSettingsToast('error', 'Refund was saved on the order, but the refund request record failed to update.');
      return;
    }
    setRefundProofAttachmentDrafts((uploadedProofAttachments ?? []).map((attachment) => ({
      id: attachment.id,
      fileName: attachment.fileName,
      storagePath: attachment.storagePath,
      mimeType: attachment.mimeType ?? null,
      fileSize: attachment.fileSize ?? null,
    })));

    if (businessId && request.submittedByUserId && request.submittedByUserId !== currentUserId) {
      void sendThreadNotification({
        businessId,
        recipientUserIds: [request.submittedByUserId],
        senderUserId: currentUserId || null,
        authorName: currentUserName || 'Team Member',
        body: `Refund for ${request.orderNumber} (${formatCurrency(request.amount)}) has been paid.`,
        entityType: 'order',
        entityDisplayName: request.orderNumber,
        entityId: request.orderId,
      });
    }

    if (businessId && adminNotificationRecipientIds.length > 0) {
      void sendThreadNotification({
        businessId,
        recipientUserIds: adminNotificationRecipientIds,
        senderUserId: currentUserId || null,
        authorName: currentUserName || 'Team Member',
        body: `${currentUserName || 'A team member'} completed refund payout for ${request.orderNumber} (${formatCurrency(request.amount)}).`,
        entityType: 'order',
        entityDisplayName: request.orderNumber,
        entityId: request.orderId,
      });
    }

    showSettingsToast('success', 'Refund marked as paid and order updated.');
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleVoidRefundRequest = async (requestId: string, note?: string) => {
    const request = refundRequests.find((item) => item.id === requestId);
    if (!request || request.status === 'void') return;

    const canManageRequest = isFinanceApprover || isCurrentUserRefundRequestOwner(request);
    if (!canManageRequest) {
      showSettingsToast('error', 'Only the request owner or admin can void this refund.');
      return;
    }

    const nowIso = new Date().toISOString();
    const voidReason = note?.trim() || 'Refund cancelled';

    if (request.status === 'paid') {
      if (!businessId) {
        showSettingsToast('error', 'Business not available for this refund.');
        return;
      }
      const order = orders.find((item) => item.id === request.orderId);
      if (!order) {
        showSettingsToast('error', 'Linked order not found for this refund.');
        return;
      }

      try {
        const orderUpdates = applyVoidedRefundRequestToOrder(order, request);
        await updateOrder(order.id, {
          ...orderUpdates,
          updatedBy: currentUserName,
          updatedAt: nowIso,
        }, businessId);
      } catch (error) {
        console.warn('Refund void order rollback failed:', error);
        showSettingsToast('error', 'Could not roll back the paid refund on the order.');
        return;
      }
    }

    try {
      await updateRefundRequest(requestId, {
        status: 'void',
        voidedAt: nowIso,
        voidedByUserId: currentUserId,
        voidedByName: currentUserName,
        voidReason,
        rejectionReason: `Voided: ${voidReason}`,
        updatedAt: nowIso,
      }, businessId);
    } catch (error) {
      console.warn('Refund request void failed:', error);
      showSettingsToast('error', 'Could not mark refund as void.');
      return;
    }

    showSettingsToast('success', 'Refund marked as void.');
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const handleDeleteRefundRequest = async (requestId: string) => {
    const request = refundRequests.find((item) => item.id === requestId);
    if (!request) return;

    const canManageRequest = isFinanceApprover || isCurrentUserRefundRequestOwner(request);
    if (!canManageRequest) {
      showSettingsToast('error', 'Only the request owner or admin can delete this refund.');
      return;
    }

    if (request.status === 'paid') {
      if (!businessId) {
        showSettingsToast('error', 'Business not available for this refund.');
        return;
      }
      const order = orders.find((item) => item.id === request.orderId);
      if (!order) {
        showSettingsToast('error', 'Linked order not found for this refund.');
        return;
      }
      try {
        const orderUpdates = applyVoidedRefundRequestToOrder(order, request);
        await updateOrder(order.id, {
          ...orderUpdates,
          updatedBy: currentUserName,
          updatedAt: new Date().toISOString(),
        }, businessId);
      } catch (error) {
        console.warn('Refund request delete rollback failed:', error);
        showSettingsToast('error', 'Could not reverse paid refund before deleting.');
        return;
      }
    }

    try {
      await deleteRefundRequest(requestId, businessId);
    } catch (error) {
      console.warn('Refund request delete failed:', error);
      showSettingsToast('error', 'Could not delete refund request.');
      return;
    }
    if (selectedRefundRequestId === requestId) {
      setSelectedRefundRequestId(null);
    }
    showSettingsToast('success', 'Refund request deleted.');
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const handleApproveProcurementRequest = (procurementId: string) => {
    const procurement = procurements.find((item) => item.id === procurementId);
    if (!procurement || inferProcurementApprovalStatus(procurement) !== 'submitted') return;

    const createdAtMs = parseTimestamp(procurement.createdAt) ?? Date.now();
    const procurementLabel = procurement.title?.trim() || resolveProcurementPONumber(procurement);
    const submittedByUserId = resolveProcurementSubmittedByUserId(procurement);
    const paidDate = resolveProcurementPaidDate(procurement, createdAtMs);
    const receivedDate = resolveProcurementReceivedDate(procurement, createdAtMs);
    const requestedStatus = resolveProcurementRequestedStatus(procurement).trim() || 'Draft';
    const nowIso = new Date().toISOString();
    const nextNotes = buildProcurementNotes(
      stripMetadata(procurement.notes),
      resolveProcurementPONumber(procurement),
      requestedStatus,
      receivedDate,
      {
        paid_date: paidDate,
        received_date: receivedDate,
        approval_status: 'approved',
        requested_status: requestedStatus,
        reviewed_by_user_id: currentUserId,
        reviewed_by_name: currentUserName,
        reviewed_at: nowIso,
        rejection_reason: null,
      },
      procurement.notes
    );

    updateProcurement(procurementId, { notes: nextNotes }, businessId);
    if (businessId && submittedByUserId && submittedByUserId !== currentUserId) {
      void sendThreadNotification({
        businessId,
        recipientUserIds: [submittedByUserId],
        senderUserId: currentUserId || null,
        authorName: currentUserName || 'Admin',
        body: `Your procurement request "${procurementLabel}" (${formatCurrency(procurement.totalCost || 0)}) was approved.`,
        entityType: null,
        entityDisplayName: procurementLabel,
        entityId: procurementId,
      });
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleRejectProcurementRequest = (procurementId: string) => {
    const procurement = procurements.find((item) => item.id === procurementId);
    if (!procurement || inferProcurementApprovalStatus(procurement) !== 'submitted') return;

    const createdAtMs = parseTimestamp(procurement.createdAt) ?? Date.now();
    const procurementLabel = procurement.title?.trim() || resolveProcurementPONumber(procurement);
    const submittedByUserId = resolveProcurementSubmittedByUserId(procurement);
    const paidDate = resolveProcurementPaidDate(procurement, createdAtMs);
    const receivedDate = resolveProcurementReceivedDate(procurement, createdAtMs);
    const nowIso = new Date().toISOString();
    const nextNotes = buildProcurementNotes(
      stripMetadata(procurement.notes),
      resolveProcurementPONumber(procurement),
      'Rejected',
      receivedDate,
      {
        paid_date: paidDate,
        received_date: receivedDate,
        approval_status: 'rejected',
        reviewed_by_user_id: currentUserId,
        reviewed_by_name: currentUserName,
        reviewed_at: nowIso,
        rejection_reason: 'Rejected by approver',
      },
      procurement.notes
    );

    updateProcurement(procurementId, { notes: nextNotes }, businessId);
    if (businessId && submittedByUserId && submittedByUserId !== currentUserId) {
      void sendThreadNotification({
        businessId,
        recipientUserIds: [submittedByUserId],
        senderUserId: currentUserId || null,
        authorName: currentUserName || 'Admin',
        body: `Your procurement request "${procurementLabel}" (${formatCurrency(procurement.totalCost || 0)}) was rejected.`,
        entityType: null,
        entityDisplayName: procurementLabel,
        entityId: procurementId,
      });
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const renderOverviewRangeFilters = () => (
    <View style={{ marginTop: isWebDesktop ? 0 : 16 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {overviewRangeOptions.map((option) => (
          <FinanceFilterPill
            key={option.key}
            label={option.label}
            active={overviewRange === option.key}
            onPress={() => setOverviewRange(option.key)}
            colors={colors}
          />
        ))}
      </ScrollView>
    </View>
  );

  const renderTotalsInfoNote = (message: string, marginTop = 12) => (
    <View
      className="rounded-xl px-3 py-2.5"
      style={{
        marginTop,
        borderWidth: 1,
        borderColor: colors.divider,
        backgroundColor: colors.bg.card,
      }}
    >
      <Text style={{ color: colors.text.tertiary, fontSize: 12, lineHeight: 17 }}>
        {message}
      </Text>
    </View>
  );

  const renderOverviewTopCards = () => {
    const grossRevenueDeductions = [
      overviewFinancials.totalGatewayFees > 0 || overviewFinancials.totalStampDuty > 0 ? 'fees' : '',
      overviewFinancials.totalRefunds > 0 ? 'refunds' : '',
    ].filter(Boolean).join(' & ');
    const handleOpenFinanceDetail = (route: string) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push(route as never);
    };
    const cards: {
      label: string;
      value: string;
      helper: string;
      helperTone: 'positive' | 'negative' | 'neutral';
      trendLabel?: string;
      trendTone?: 'positive' | 'negative' | 'neutral';
      onPress: () => void;
    }[] = [
      {
        label: 'Gross Revenue',
        value: formatCurrency(overviewFinancials.totalRevenue),
        helper: grossRevenueDeductions
          ? `Net ${formatCurrency(overviewFinancials.netRevenue)} after ${grossRevenueDeductions}`
          : '',
        helperTone: 'neutral' as const,
        trendLabel: overviewComparison.revenue.label,
        trendTone: overviewComparison.revenue.tone,
        onPress: () => handleOpenFinanceDetail('/finance/revenue'),
      },
      {
        label: 'Refunds',
        value: formatSignedCurrency(-overviewFinancials.totalRefunds),
        helper: overviewFinancials.totalRefunds > 0 ? 'Paid back to customers' : '',
        helperTone: 'neutral' as const,
        trendLabel: overviewComparison.refunds.label,
        trendTone: overviewComparison.refunds.tone,
        onPress: () => selectTab('refunds'),
      },
      {
        label: 'Total Expenses',
        value: formatCurrency(overviewFinancials.totalExpenses),
        helper: '',
        helperTone: 'neutral' as const,
        trendLabel: overviewComparison.expenses.label,
        trendTone: overviewComparison.expenses.tone,
        onPress: () => handleOpenFinanceDetail('/finance/expenses'),
      },
      {
        label: 'Procurement',
        value: formatCurrency(overviewFinancials.totalProcurement),
        helper: '',
        helperTone: 'neutral' as const,
        trendLabel: overviewComparison.procurement.label,
        trendTone: overviewComparison.procurement.tone,
        onPress: () => handleOpenFinanceDetail('/finance/procurement'),
      },
      {
        label: 'Net Profit',
        value: formatSignedCurrency(overviewFinancials.netProfit),
        helper: '',
        helperTone: 'neutral' as const,
        trendLabel: overviewComparison.net.label,
        trendTone: overviewComparison.net.tone,
        onPress: () => handleOpenFinanceDetail('/finance/net-profit'),
      },
    ];

    if (isWebDesktop) {
      const firstRowCards = cards.slice(0, 3);
      const secondRowCards = cards.slice(3);
      return (
        <View className="mt-4" style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {firstRowCards.map((card) => (
              <FinanceMetricCard
                key={card.label}
                label={card.label}
                value={card.value}
                helper={card.helper}
                helperTone={card.helperTone}
                trendLabel={card.trendLabel}
                trendTone={card.trendTone}
                trendPlacement="right"
                compactTrend={isCompactLayout}
                valueFontSize={20}
                onPress={card.onPress}
                colors={colors}
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {secondRowCards.map((card) => (
              <FinanceMetricCard
                key={card.label}
                label={card.label}
                value={card.value}
                helper={card.helper}
                helperTone={card.helperTone}
                trendLabel={card.trendLabel}
                trendTone={card.trendTone}
                trendPlacement="right"
                compactTrend={isCompactLayout}
                valueFontSize={20}
                onPress={card.onPress}
                colors={colors}
              />
            ))}
          </View>
        </View>
      );
    }

    return (
      <View className="mt-6">
        <View className="mb-3">
          <FinanceMetricCard {...cards[0]} trendPlacement="right" compactTrend={isCompactLayout} valueFontSize={20} onPress={cards[0].onPress} colors={colors} />
        </View>
        <View className="flex-row mb-3" style={{ gap: 12 }}>
          <FinanceMetricCard {...cards[1]} trendPlacement="right" compactTrend={isCompactLayout} valueFontSize={18} onPress={cards[1].onPress} colors={colors} />
          <FinanceMetricCard {...cards[2]} trendPlacement="right" compactTrend={isCompactLayout} valueFontSize={18} onPress={cards[2].onPress} colors={colors} />
        </View>
        <View className="flex-row" style={{ gap: 12 }}>
          <FinanceMetricCard {...cards[3]} trendPlacement="right" compactTrend={isCompactLayout} valueFontSize={18} onPress={cards[3].onPress} colors={colors} />
          <FinanceMetricCard {...cards[4]} trendPlacement="right" compactTrend={isCompactLayout} valueFontSize={18} onPress={cards[4].onPress} colors={colors} />
        </View>
      </View>
    );
  };

  const renderOverviewExpenseRequestsBadgeCard = () => {
    if (!isFinanceApprover || pendingExpenseApprovalRows.length === 0) return null;
    return (
      <Pressable
        onPress={() => {
          selectTab('expenses');
          if (pendingExpenseApprovalRows.length > 0) {
            openExpenseApprovalWorkspace();
          }
        }}
        className="mt-4 rounded-2xl p-4"
        style={colors.getCardStyle()}
      >
        <View className="flex-row items-center justify-between" style={{ gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text.primary }} className="text-base font-semibold">Expense Requests</Text>
            <Text style={{ color: colors.text.tertiary }} className="text-xs mt-1">
              Pending requests from team members.
            </Text>
          </View>
          <View
            className="rounded-full items-center justify-center"
            style={{
              minWidth: 30,
              height: 30,
              paddingHorizontal: 8,
              borderWidth: 1,
              borderColor: pendingBadgeBorder,
              backgroundColor: pendingBadgeBg,
            }}
          >
            <Text style={{ color: pendingBadgeText, fontSize: 12, fontWeight: '700' }}>
              {pendingExpenseApprovalRows.length > 99 ? '99+' : pendingExpenseApprovalRows.length}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

  const renderExpenseTopCards = () => {
    const periodPills = (
      <View style={{ marginTop: isWebDesktop ? 0 : 16 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {overviewRangeOptions.map((option) => (
            <FinanceFilterPill
              key={option.key}
              label={option.label}
              active={expensePeriod === option.key}
              onPress={() => setExpensePeriod(option.key)}
              colors={colors}
            />
          ))}
        </ScrollView>
      </View>
    );

    if (isWebDesktop) {
      return (
        <>
          {periodPills}
          <View className="mt-4" style={{ flexDirection: 'row', gap: 12 }}>
            <FinanceMetricCard
              label="Expense Total"
              value={formatCurrency(expensePeriodStats.total)}
              helper={expensePeriodWindow.label}
              helperTone="neutral"
              trendPlacement="right"
              compactTrend={isCompactLayout}
              valueFontSize={24}
              colors={colors}
            />
            <FinanceMetricCard
              label="Entries"
              value={expensePeriodStats.count.toLocaleString()}
              helper={expensePeriodWindow.label}
              helperTone="neutral"
              trendPlacement="right"
              compactTrend={isCompactLayout}
              valueFontSize={24}
              colors={colors}
            />
          </View>
        </>
      );
    }

    if (isMobile) {
      return (
        <View className="mt-4" style={{ flexDirection: 'row', gap: 12 }}>
          <FinanceMetricCard
            label="Expense Total"
            value={formatCurrency(expensePeriodStats.total)}
            helper={expensePeriodWindow.label}
            helperTone="neutral"
            trendPlacement="right"
            compactTrend={isCompactLayout}
            valueFontSize={20}
            colors={colors}
          />
          <FinanceMetricCard
            label="Entries"
            value={expensePeriodStats.count.toLocaleString()}
            helper={expensePeriodWindow.label}
            helperTone="neutral"
            trendPlacement="right"
            compactTrend={isCompactLayout}
            valueFontSize={20}
            colors={colors}
          />
        </View>
      );
    }

    return (
      <>
        {periodPills}
        <View className="mt-4" style={{ flexDirection: 'row', gap: 12 }}>
          <FinanceMetricCard
            label="Expense Total"
            value={formatCurrency(expensePeriodStats.total)}
            helper={expensePeriodWindow.label}
            helperTone="neutral"
            trendPlacement="right"
            compactTrend={isCompactLayout}
            valueFontSize={20}
            colors={colors}
          />
          <FinanceMetricCard
            label="Entries"
            value={expensePeriodStats.count.toLocaleString()}
            helper={expensePeriodWindow.label}
            helperTone="neutral"
            trendPlacement="right"
            compactTrend={isCompactLayout}
            valueFontSize={20}
            colors={colors}
          />
        </View>
      </>
    );
  };

  const renderMyExpenseRequestTopCards = () => {
    const periodPills = (
      <View style={{ marginTop: isWebDesktop ? 0 : 16 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {overviewRangeOptions.map((option) => (
            <FinanceFilterPill
              key={option.key}
              label={option.label}
              active={expensePeriod === option.key}
              onPress={() => setExpensePeriod(option.key)}
              colors={colors}
            />
          ))}
        </ScrollView>
      </View>
    );

    if (isWebDesktop) {
      return (
        <>
          {periodPills}
          <View className="mt-4" style={{ flexDirection: 'row', gap: 12 }}>
            <FinanceMetricCard
              label="Expense Total"
              value={formatCurrency(mySubmittedExpenseRequestPeriodStats.total)}
              helper={expensePeriodWindow.label}
              helperTone="neutral"
              trendPlacement="right"
              compactTrend={isCompactLayout}
              valueFontSize={24}
              colors={colors}
            />
            <FinanceMetricCard
              label="Entries"
              value={mySubmittedExpenseRequestPeriodStats.count.toLocaleString()}
              helper={expensePeriodWindow.label}
              helperTone="neutral"
              trendPlacement="right"
              compactTrend={isCompactLayout}
              valueFontSize={24}
              colors={colors}
            />
          </View>
        </>
      );
    }

    if (isMobile) {
      return (
        <View className="mt-4" style={{ flexDirection: 'row', gap: 12 }}>
          <FinanceMetricCard
            label="Expense Total"
            value={formatCurrency(mySubmittedExpenseRequestPeriodStats.total)}
            helper={expensePeriodWindow.label}
            helperTone="neutral"
            trendPlacement="right"
            compactTrend={isCompactLayout}
            valueFontSize={20}
            colors={colors}
          />
          <FinanceMetricCard
            label="Entries"
            value={mySubmittedExpenseRequestPeriodStats.count.toLocaleString()}
            helper={expensePeriodWindow.label}
            helperTone="neutral"
            trendPlacement="right"
            compactTrend={isCompactLayout}
            valueFontSize={20}
            colors={colors}
          />
        </View>
      );
    }

    return (
      <>
        {periodPills}
        <View className="mt-4" style={{ flexDirection: 'row', gap: 12 }}>
          <FinanceMetricCard
            label="Expense Total"
            value={formatCurrency(mySubmittedExpenseRequestPeriodStats.total)}
            helper={expensePeriodWindow.label}
            helperTone="neutral"
            trendPlacement="right"
            compactTrend={isCompactLayout}
            valueFontSize={20}
            colors={colors}
          />
          <FinanceMetricCard
            label="Entries"
            value={mySubmittedExpenseRequestPeriodStats.count.toLocaleString()}
            helper={expensePeriodWindow.label}
            helperTone="neutral"
            trendPlacement="right"
            compactTrend={isCompactLayout}
            valueFontSize={20}
            colors={colors}
          />
        </View>
      </>
    );
  };

  const renderOwnerExpenseApprovalQueue = () => {
    const rows = pendingExpenseApprovalRows;
    return (
      <Pressable
        onPress={() => openExpenseApprovalWorkspace()}
        disabled={rows.length === 0}
        className="mt-4 rounded-2xl p-4"
        style={{ ...colors.getCardStyle(), opacity: rows.length === 0 ? 0.6 : 1 }}
      >
        <View className="flex-row items-center justify-between" style={{ gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text.primary }} className="text-base font-semibold">Pending Approvals</Text>
            <Text style={{ color: colors.text.tertiary }} className="text-xs mt-1">
              Tap to open all pending expense approvals.
            </Text>
          </View>
          <View
            className="rounded-full items-center justify-center"
            style={{
              width: 30,
              height: 30,
              borderWidth: 1,
              borderColor: pendingBadgeBorder,
              backgroundColor: pendingBadgeBg,
            }}
          >
            <Text style={{ color: pendingBadgeText, fontSize: 12, fontWeight: '700' }}>{rows.length > 9 ? '9+' : rows.length}</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  const renderExpenseApprovalWorkspacePanels = () => {
    // Submitted request amount already includes any auto charges from the requester form.
    // For approvals, never add charges again; derive charge portion from submitted totals.
    const baseSubtotalForSelected = (() => {
      if (!approvalWorkspaceSelectedRequest) return 0;
      const requestLineItems = approvalWorkspaceSelectedRequest.lineItems ?? [];
      if (requestLineItems.length === 0) return approvalWorkspaceSelectedRequest.amount;
      return requestLineItems.reduce((sum, line) => (
        sum + (Number.isFinite(Number(line.amount)) ? Number(line.amount) : 0)
      ), 0);
    })();
    const autoChargesForSelected = approvalWorkspaceSelectedRequest
      ? Math.max(0, approvalWorkspaceSelectedRequest.amount - baseSubtotalForSelected)
      : 0;
    const totalDeductionForSelected = approvalWorkspaceSelectedRequest?.amount ?? 0;

    // Build audit trail entries
    const auditTrailEntries = (() => {
      if (!approvalWorkspaceSelectedRequest) return [];
      const req = approvalWorkspaceSelectedRequest;
      const submittedTs = parseTimestamp(req.submittedAt ?? req.createdAt);
      const timeLabel = submittedTs
        ? (() => {
            const diffMs = Date.now() - submittedTs;
            const diffMins = Math.floor(diffMs / 60000);
            if (diffMins < 60) return `${diffMins}m ago`;
            const diffHrs = Math.floor(diffMins / 60);
            if (diffHrs < 24) return `${diffHrs}h ago`;
            return `${Math.floor(diffHrs / 24)}d ago`;
          })()
        : '';
      const entries: { icon: 'person' | 'shield'; label: string; time: string; actor: string }[] = [
        { icon: 'person', label: 'submitted request', time: timeLabel, actor: req.submittedByName || 'Team Member' },
      ];
      if (autoChargesForSelected > 0) {
        entries.push({ icon: 'shield', label: 'applied rule: Standard Bank Transfer', time: timeLabel, actor: 'SYSTEM' });
        if (financeRules.vatRate > 0) {
          entries.push({ icon: 'shield', label: `calculated ${(financeRules.vatRate * 100).toFixed(1)}% VAT on fee`, time: timeLabel, actor: 'SYSTEM' });
        }
      }
      if (req.status === 'approved' && req.reviewedByName) {
        entries.push({ icon: 'shield', label: 'approved', time: '', actor: req.reviewedByName });
      }
      if (req.status === 'rejected' && req.reviewedByName) {
        entries.push({ icon: 'shield', label: 'declined', time: '', actor: req.reviewedByName });
      }
      return entries;
    })();

    // ── Queue sidebar list ──
    const queueSidebar = (
      <View style={{ width: isWebDesktop ? 290 : undefined, borderRightWidth: isWebDesktop ? 1 : 0, borderRightColor: colors.divider, flex: isWebDesktop ? undefined : 1 }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.divider, gap: 12 }}>
          <Text style={{ color: colors.text.primary, fontSize: 16, fontWeight: '700' }}>Review Queue</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', height: 38, borderRadius: 100, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.input, paddingHorizontal: 14, gap: 8 }}>
            <Search size={14} color={colors.text.muted} strokeWidth={2} />
            <TextInput
              value={approvalQueueSearchQuery}
              onChangeText={setApprovalQueueSearchQuery}
              placeholder="Search by name or ID..."
              placeholderTextColor={colors.text.muted}
              style={{ flex: 1, color: colors.text.primary, fontSize: 13 }}
            />
          </View>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          {approvalWorkspaceRows.length === 0 ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: colors.text.tertiary, fontSize: 13, textAlign: 'center' }}>
                {approvalQueueSearchQuery.trim() ? 'No results found.' : 'No submitted requests right now.'}
              </Text>
            </View>
          ) : approvalWorkspaceRows.map((row, index) => {
            const selected = row.id === approvalWorkspaceSelectedId;
            return (
              <Pressable
                key={row.id}
                onPress={() => setApprovalWorkspaceSelectedId(row.id)}
                style={{
                  paddingHorizontal: 16, paddingVertical: 14,
                  borderBottomWidth: index === approvalWorkspaceRows.length - 1 ? 0 : 1,
                  borderBottomColor: colors.divider,
                  backgroundColor: selected ? colors.bg.input : 'transparent',
                  borderLeftWidth: 3,
                  borderLeftColor: selected ? colors.bar : 'transparent',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{row.name}</Text>
                    <Text style={{ color: colors.text.tertiary, fontSize: 11, marginTop: 3 }} numberOfLines={1}>
                      {row.submittedByName ?? 'Team Member'} · {row.category}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '700' }}>{formatCurrency(row.amount)}</Text>
                    <Text style={{ color: colors.text.muted, fontSize: 10, marginTop: 3 }}>{row.date}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );

    // ── Empty center state ──
    const emptyCenter = (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <Text style={{ color: colors.text.tertiary, fontSize: 14 }}>Select a request from the queue to review.</Text>
      </View>
    );

    // ── Center + Right detail panels ──
    const detailPanels = !approvalWorkspaceSelectedRequest ? emptyCenter : (() => {
      const req = approvalWorkspaceSelectedRequest;
      const requestDateLabel = new Date(
        parseTimestamp(req.date) ?? Date.now()
      ).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const submittedDateLabel = new Date(
        parseTimestamp(req.submittedAt ?? req.createdAt) ?? Date.now()
      ).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      // Centre column
      const centerCol = (
        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 16 }}>
          {/* Financial summary card */}
          <View style={{ borderRadius: 20, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, padding: 20, gap: 0 }}>
            <View style={{ marginBottom: 6 }}>
              <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>Financial Summary</Text>
            </View>
            <Text style={{ color: colors.text.primary, fontSize: 34, fontWeight: '800', marginBottom: 18, letterSpacing: -0.5 }}>{formatCurrency(req.amount)}</Text>

            {/* Subtotal row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.divider }}>
              <Text style={{ color: colors.text.secondary, fontSize: 14 }}>Subtotal</Text>
              <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '600' }}>{formatCurrency(baseSubtotalForSelected)}</Text>
            </View>

            {/* Auto charges row */}
            {autoChargesForSelected > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.divider }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: colors.text.secondary, fontSize: 14 }}>Auto Charges</Text>
                  <View style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: colors.text.muted, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: colors.text.muted, fontSize: 8, fontWeight: '700' }}>i</Text>
                  </View>
                </View>
                <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '600' }}>{formatCurrency(autoChargesForSelected)}</Text>
              </View>
            ) : null}

            {/* Total deduction row */}
            <View style={{ paddingTop: 12, marginTop: 4, borderTopWidth: 2, borderTopColor: colors.divider, gap: 2 }}>
              <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>Total Deduction from Business Account</Text>
              <Text style={{ color: colors.text.primary, fontSize: 22, fontWeight: '800', marginTop: 4 }}>{formatCurrency(totalDeductionForSelected)}</Text>
            </View>
          </View>

          {/* Evidence */}
          <View style={{ borderRadius: 20, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: colors.divider, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.input }}>
                  <Text style={{ fontSize: 13 }}>📎</Text>
                </View>
                <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '600' }}>Proof of Payment</Text>
              </View>
              {(req.receipts ?? []).length > 0 ? (
                <Text style={{ color: colors.bar, fontSize: 12, fontWeight: '700' }}>VIEW ALL ↗</Text>
              ) : null}
            </View>
            {(req.receipts ?? []).length === 0 ? (
              <View style={{ height: 80, borderRadius: 12, borderWidth: 1, borderColor: colors.divider, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.text.muted, fontSize: 13 }}>No files attached</Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {(req.receipts ?? []).map((receipt) => (
                  <Pressable
                    key={receipt.id}
                    onPress={() => void handleOpenExpenseReceipt(receipt.storagePath)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.input }}
                  >
                    <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.divider, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 16 }}>🧾</Text>
                    </View>
                    <Text style={{ flex: 1, color: colors.text.primary, fontSize: 13, fontWeight: '500' }} numberOfLines={1}>{receipt.fileName}</Text>
                    <Text style={{ color: colors.bar, fontSize: 12, fontWeight: '600' }}>Open</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Breakdown (if multi-line) */}
          {approvalWorkspaceLineItems.length > 1 ? (
            <View style={{ borderRadius: 20, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, padding: 20 }}>
              <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>Expense Breakdown</Text>
              <View style={{ gap: 12 }}>
                {approvalWorkspaceLineItems.map((line) => (
                  <View key={line.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '500' }}>{line.label}</Text>
                      <Text style={{ color: colors.text.muted, fontSize: 11, marginTop: 2 }}>{line.category}</Text>
                    </View>
                    <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '600' }}>{formatCurrency(line.amount)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      );

      // Right sidebar
      const rightSidebar = (
        <View style={{ width: isWebDesktop ? 300 : undefined, borderLeftWidth: isWebDesktop ? 1 : 0, borderLeftColor: colors.divider }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 16 }}>
            {/* Requester */}
            <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, padding: 16 }}>
              <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Requester</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bar, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: colors.bg.screen, fontSize: 18, fontWeight: '700' }}>
                    {(req.submittedByName || 'T').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '600' }}>{req.submittedByName || 'Team Member'}</Text>
                  <Text style={{ color: colors.text.tertiary, fontSize: 12, marginTop: 2 }}>{req.category}</Text>
                  <Text style={{ color: colors.text.tertiary, fontSize: 12, marginTop: 2 }}>Expense date: {requestDateLabel}</Text>
                  <Text style={{ color: colors.text.tertiary, fontSize: 12, marginTop: 2 }}>Submitted: {submittedDateLabel}</Text>
                </View>
              </View>
            </View>

            {/* Audit trail */}
            <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, padding: 16 }}>
              <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>Activity</Text>
              <View style={{ gap: 0 }}>
                {auditTrailEntries.map((entry, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 10, paddingBottom: i < auditTrailEntries.length - 1 ? 14 : 0 }}>
                    <View style={{ alignItems: 'center', width: 28 }}>
                      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.divider, alignItems: 'center', justifyContent: 'center' }}>
                        {entry.icon === 'person'
                          ? <User size={13} color={colors.text.secondary} strokeWidth={2} />
                          : <Shield size={13} color={colors.text.secondary} strokeWidth={2} />}
                      </View>
                      {i < auditTrailEntries.length - 1 ? (
                        <View style={{ width: 1, flex: 1, backgroundColor: colors.divider, marginTop: 4 }} />
                      ) : null}
                    </View>
                    <View style={{ flex: 1, paddingTop: 4 }}>
                      <Text style={{ color: colors.text.primary, fontSize: 12, fontWeight: '500' }}>{entry.label}</Text>
                      <Text style={{ color: colors.text.muted, fontSize: 11, marginTop: 2 }}>{entry.time}{entry.time && entry.actor ? ' · ' : ''}{entry.actor}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Comment / info request input */}
            <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, padding: 16 }}>
              <TextInput
                value={approvalInfoRequestNote}
                onChangeText={setApprovalInfoRequestNote}
                placeholder="Comment for reviewer..."
                placeholderTextColor={colors.text.muted}
                multiline
                style={{ minHeight: 72, color: colors.text.primary, fontSize: 13, textAlignVertical: 'top' }}
              />
              <Pressable
                onPress={() => { handleRequestExpenseRequestInfo(req.id, approvalInfoRequestNote); focusNextPendingExpenseApproval(req.id); }}
                style={{ marginTop: 10, height: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.divider, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.input }}
              >
                <Text style={{ color: colors.text.secondary, fontSize: 13, fontWeight: '600' }}>Send & Request Info</Text>
              </Pressable>
            </View>

            {/* Internal memo (note) */}
            {req.note?.trim() ? (
              <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, padding: 16 }}>
                <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Internal Memo</Text>
                <Text style={{ color: colors.text.secondary, fontSize: 13, fontStyle: 'italic', lineHeight: 20 }}>{`"${req.note.trim()}"`}</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      );

      if (isWebDesktop) {
        return (
          <View style={{ flexDirection: 'row', flex: 1 }}>
            {centerCol}
            {rightSidebar}
          </View>
        );
      }
      // Mobile: single merged scroll with all sections
      return (
        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}>
          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, padding: 16 }}>
            <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Financial Summary</Text>
            <Text style={{ color: colors.text.primary, fontSize: 30, fontWeight: '800', letterSpacing: -0.5, marginBottom: 14 }}>{formatCurrency(req.amount)}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.divider }}>
              <Text style={{ color: colors.text.secondary, fontSize: 14 }}>Subtotal</Text>
              <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '600' }}>{formatCurrency(baseSubtotalForSelected)}</Text>
            </View>
            {autoChargesForSelected > 0 ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.divider }}>
                <Text style={{ color: colors.text.secondary, fontSize: 14 }}>Auto Charges</Text>
                <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '600' }}>{formatCurrency(autoChargesForSelected)}</Text>
              </View>
            ) : null}
            <View style={{ paddingTop: 10, marginTop: 2, borderTopWidth: 2, borderTopColor: colors.divider }}>
              <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>Total Deduction</Text>
              <Text style={{ color: colors.text.primary, fontSize: 20, fontWeight: '800', marginTop: 2 }}>{formatCurrency(totalDeductionForSelected)}</Text>
            </View>
          </View>
          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, padding: 16 }}>
            <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Proof of Payment</Text>
            {(req.receipts ?? []).length === 0 ? (
              <View style={{ height: 56, borderRadius: 10, borderWidth: 1, borderColor: colors.divider, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.text.muted, fontSize: 13 }}>No files attached</Text>
              </View>
            ) : (req.receipts ?? []).map((receipt) => (
              <Pressable key={receipt.id} onPress={() => void handleOpenExpenseReceipt(receipt.storagePath)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.input }}>
                <Text style={{ fontSize: 18 }}>🧾</Text>
                <Text style={{ flex: 1, color: colors.text.primary, fontSize: 13, fontWeight: '500' }} numberOfLines={1}>{receipt.fileName || 'Receipt'}</Text>
                <Download size={15} color={colors.text.muted} strokeWidth={2} />
              </Pressable>
            ))}
          </View>
          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, padding: 16 }}>
            <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Requester</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.bar, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.bg.screen, fontSize: 17, fontWeight: '700' }}>{(req.submittedByName || 'T').charAt(0).toUpperCase()}</Text>
              </View>
              <View>
                <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '600' }}>{req.submittedByName || 'Team Member'}</Text>
                <Text style={{ color: colors.text.tertiary, fontSize: 12, marginTop: 2 }}>{req.category}</Text>
                <Text style={{ color: colors.text.tertiary, fontSize: 12, marginTop: 2 }}>Expense date: {requestDateLabel}</Text>
                <Text style={{ color: colors.text.tertiary, fontSize: 12, marginTop: 2 }}>Submitted: {submittedDateLabel}</Text>
              </View>
            </View>
          </View>
          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, padding: 16 }}>
            <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>Activity</Text>
            {auditTrailEntries.map((entry, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 10, paddingBottom: i < auditTrailEntries.length - 1 ? 14 : 0 }}>
                <View style={{ alignItems: 'center', width: 28 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.divider, alignItems: 'center', justifyContent: 'center' }}>
                    {entry.icon === 'person' ? <User size={13} color={colors.text.secondary} strokeWidth={2} /> : <Shield size={13} color={colors.text.secondary} strokeWidth={2} />}
                  </View>
                  {i < auditTrailEntries.length - 1 ? <View style={{ width: 1, flex: 1, backgroundColor: colors.divider, marginTop: 4 }} /> : null}
                </View>
                <View style={{ flex: 1, paddingTop: 4 }}>
                  <Text style={{ color: colors.text.primary, fontSize: 12, fontWeight: '500' }}>{entry.label}</Text>
                  <Text style={{ color: colors.text.muted, fontSize: 11, marginTop: 2 }}>{entry.time}{entry.time && entry.actor ? ' · ' : ''}{entry.actor}</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, padding: 16 }}>
            <TextInput value={approvalInfoRequestNote} onChangeText={setApprovalInfoRequestNote} placeholder="Comment for reviewer..." placeholderTextColor={colors.text.muted} multiline style={{ minHeight: 80, color: colors.text.primary, fontSize: 13, textAlignVertical: 'top' }} />
            <Pressable onPress={() => { handleRequestExpenseRequestInfo(req.id, approvalInfoRequestNote); focusNextPendingExpenseApproval(req.id); }} style={{ marginTop: 10, height: 40, borderRadius: 12, borderWidth: 1, borderColor: colors.divider, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.input }}>
              <Text style={{ color: colors.text.secondary, fontSize: 13, fontWeight: '600' }}>Send & Request Info</Text>
            </Pressable>
          </View>
          {req.note?.trim() ? (
            <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, padding: 16 }}>
              <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Internal Memo</Text>
              <Text style={{ color: colors.text.secondary, fontSize: 13, fontStyle: 'italic', lineHeight: 20 }}>{`"${req.note.trim()}"`}</Text>
            </View>
          ) : null}
        </ScrollView>
      );
    })();

    // ── Desktop header bar ──
    const headerBar = approvalWorkspaceSelectedRequest ? (() => {
      const req = approvalWorkspaceSelectedRequest;
      const idLabel = `EXP-${req.id.slice(-6).toUpperCase()} · ${(req.merchant || req.category || '').toUpperCase()}`;
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.divider, gap: 12 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.text.primary, fontSize: 18, fontWeight: '700' }} numberOfLines={1}>{req.title}</Text>
            <Text style={{ color: colors.text.tertiary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{idLabel}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable onPress={() => { handleRequestExpenseRequestInfo(req.id, approvalInfoRequestNote); focusNextPendingExpenseApproval(req.id); }} style={{ height: 38, paddingHorizontal: 18, borderRadius: 100, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.input, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.text.secondary, fontSize: 13, fontWeight: '600' }}>Request Info</Text>
            </Pressable>
            <Pressable onPress={() => { handleRejectExpenseRequest(req.id); focusNextPendingExpenseApproval(req.id); }} style={{ height: 38, paddingHorizontal: 18, borderRadius: 100, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.input, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.danger, fontSize: 13, fontWeight: '600' }}>Decline</Text>
            </Pressable>
            <Pressable onPress={() => { handleApproveExpenseRequest(req.id); focusNextPendingExpenseApproval(req.id); }} style={{ height: 38, paddingHorizontal: 18, borderRadius: 100, backgroundColor: colors.bar, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.bg.screen, fontSize: 13, fontWeight: '700' }}>Approve</Text>
            </Pressable>
          </View>
        </View>
      );
    })() : null;

    if (isWebDesktop) {
      return (
        <View style={{ flex: 1, flexDirection: 'row', borderRadius: 20, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, overflow: 'hidden' }}>
          {queueSidebar}
          <View style={{ flex: 1, flexDirection: 'column' }}>
            {headerBar}
            <View style={{ flex: 1, flexDirection: 'row' }}>
              {detailPanels}
            </View>
          </View>
        </View>
      );
    }

    // ── Mobile layout ──
    if (approvalWorkspaceSelectedRequest) {
      const req = approvalWorkspaceSelectedRequest;
      return (
        <View style={{ flex: 1, backgroundColor: colors.bg.screen }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.divider, gap: 12 }}>
            <Pressable onPress={() => setApprovalWorkspaceSelectedId(null)} style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.divider, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.card }}>
              <ChevronLeft size={18} color={colors.text.secondary} strokeWidth={2.5} />
            </Pressable>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: colors.text.primary, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>{req.title}</Text>
              <Text style={{ color: colors.text.tertiary, fontSize: 11, marginTop: 1 }} numberOfLines={1}>{req.category}{req.merchant ? ` · ${req.merchant}` : ''}</Text>
            </View>
          </View>
          {detailPanels}
          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12, paddingBottom: insets.bottom + 12, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.bg.screen }}>
            <Pressable onPress={() => { handleRejectExpenseRequest(req.id); focusNextPendingExpenseApproval(req.id); }} style={{ flex: 1, height: 50, borderRadius: 25, borderWidth: 1, borderColor: colors.divider, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.card }}>
              <Text style={{ color: colors.danger, fontSize: 15, fontWeight: '700' }}>Decline</Text>
            </Pressable>
            <Pressable onPress={() => { handleApproveExpenseRequest(req.id); focusNextPendingExpenseApproval(req.id); }} style={{ flex: 2, height: 50, borderRadius: 25, backgroundColor: colors.bar, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.bg.screen, fontSize: 15, fontWeight: '700' }}>Approve</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.screen }}>
        {queueSidebar}
      </View>
    );

  };

  const renderOwnerProcurementApprovalQueue = () => {
    const rows = pendingProcurementApprovalRows;
    return (
      <View className="mt-4 rounded-2xl p-4" style={colors.getCardStyle()}>
        <View className="flex-row items-center justify-between">
          <Text style={{ color: colors.text.primary }} className="text-base font-semibold">Pending PO Approvals</Text>
          <View
            className="rounded-full items-center justify-center"
            style={{
              width: 30,
              height: 30,
              borderWidth: 1,
              borderColor: pendingBadgeBorder,
              backgroundColor: pendingBadgeBg,
            }}
          >
            <Text style={{ color: pendingBadgeText, fontSize: 12, fontWeight: '700' }}>
              {rows.length > 9 ? '9+' : rows.length}
            </Text>
          </View>
        </View>
        {rows.length === 0 ? (
          <Text style={{ color: colors.text.tertiary }} className="text-sm mt-3">No submitted POs right now.</Text>
        ) : (
          <View className="mt-3" style={{ gap: 10 }}>
            {rows.slice(0, 6).map((row) => (
              <View
                key={row.id}
                className="rounded-xl p-3"
                style={{ borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card }}
              >
                <View className="flex-row items-start justify-between" style={{ gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text.primary }} className="text-sm font-semibold" numberOfLines={1}>
                      {row.title || row.poNumber}
                    </Text>
                    <Text style={{ color: colors.text.secondary }} className="text-xs mt-1" numberOfLines={1}>
                      {row.supplier} • {row.submittedByName}
                    </Text>
                  </View>
                  <Text style={{ color: colors.text.primary }} className="text-sm font-semibold">
                    {formatCurrency(row.total)}
                  </Text>
                </View>
                <View className="flex-row mt-3" style={{ gap: 8 }}>
                  <Pressable
                    onPress={() => handleApproveProcurementRequest(row.id)}
                    className="flex-1 rounded-lg"
                    style={{ height: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.success }}
                  >
                    <Text style={{ color: '#FFFFFF' }} className="text-sm font-semibold">Approve</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleRejectProcurementRequest(row.id)}
                    className="flex-1 rounded-lg"
                    style={{ height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.danger }}
                  >
                    <Text style={{ color: colors.danger }} className="text-sm font-semibold">Reject</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderProcurementApprovalWorkspacePanels = () => {
    // ── Queue sidebar ──
    const queueSidebar = (
      <View style={{ width: 290, borderRightWidth: 1, borderRightColor: colors.divider }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.divider, gap: 12 }}>
          <Text style={{ color: colors.text.primary, fontSize: 16, fontWeight: '700' }}>Review Queue</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', height: 38, borderRadius: 100, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.input, paddingHorizontal: 14, gap: 8 }}>
            <Search size={14} color={colors.text.muted} strokeWidth={2} />
            <TextInput
              value={procurementQueueSearchQuery}
              onChangeText={setProcurementQueueSearchQuery}
              placeholder="Search by name or PO..."
              placeholderTextColor={colors.text.muted}
              style={{ flex: 1, color: colors.text.primary, fontSize: 13 }}
            />
          </View>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          {procurementApprovalWorkspaceRows.length === 0 ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: colors.text.tertiary, fontSize: 13, textAlign: 'center' }}>
                {procurementQueueSearchQuery.trim() ? 'No results found.' : 'No submitted POs right now.'}
              </Text>
            </View>
          ) : procurementApprovalWorkspaceRows.map((row, index) => {
            const selected = row.id === procurementWorkspaceSelectedId;
            return (
              <Pressable
                key={row.id}
                onPress={() => setProcurementWorkspaceSelectedId(row.id)}
                style={{
                  paddingHorizontal: 16, paddingVertical: 14,
                  borderBottomWidth: index === procurementApprovalWorkspaceRows.length - 1 ? 0 : 1,
                  borderBottomColor: colors.divider,
                  backgroundColor: selected ? colors.bg.input : 'transparent',
                  borderLeftWidth: 3,
                  borderLeftColor: selected ? colors.bar : 'transparent',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{row.title || row.poNumber}</Text>
                    <Text style={{ color: colors.text.tertiary, fontSize: 11, marginTop: 3 }} numberOfLines={1}>
                      {row.submittedByName} · {row.supplier || 'No supplier'}
                    </Text>
                  </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '700' }}>{formatCurrency(row.total)}</Text>
                  <Text style={{ color: colors.text.muted, fontSize: 10, marginTop: 3 }}>{row.receivedDate}</Text>
                </View>
              </View>
            </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );

    // ── Empty center state ──
    const emptyCenter = (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <Text style={{ color: colors.text.tertiary, fontSize: 14 }}>Select a PO from the queue to review.</Text>
      </View>
    );

    if (!procurementWorkspaceSelectedRequest || !procurementWorkspaceSelectedRow) {
      return (
        <View style={{ flex: 1, flexDirection: 'row', borderRadius: 20, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, overflow: 'hidden' }}>
          {queueSidebar}
          {emptyCenter}
        </View>
      );
    }

    const req = procurementWorkspaceSelectedRequest;
    const row = procurementWorkspaceSelectedRow;
    const idLabel = `${row.poNumber} · ${(req.supplierName || '').toUpperCase()}`;

    // ── Header bar ──
    const headerBar = (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.divider, gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.text.primary, fontSize: 18, fontWeight: '700' }} numberOfLines={1}>{req.title || row.poNumber}</Text>
          <Text style={{ color: colors.text.tertiary, fontSize: 12, marginTop: 2 }}>{idLabel}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable
            onPress={() => { handleRejectProcurementRequest(row.id); focusNextPendingProcurementApproval(row.id); }}
            style={{ height: 38, paddingHorizontal: 18, borderRadius: 100, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.input, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: colors.danger, fontSize: 13, fontWeight: '600' }}>Decline</Text>
          </Pressable>
          <Pressable
            onPress={() => { handleApproveProcurementRequest(row.id); focusNextPendingProcurementApproval(row.id); }}
            style={{ height: 38, paddingHorizontal: 18, borderRadius: 100, backgroundColor: colors.bar, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: colors.bg.screen, fontSize: 13, fontWeight: '700' }}>Approve</Text>
          </Pressable>
        </View>
      </View>
    );

    // ── Center column ──
    const centerCol = (
      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 16 }}>
        {/* Financial Summary */}
        <View style={{ borderRadius: 20, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, padding: 20 }}>
          <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Financial Summary</Text>
          <Text style={{ color: colors.text.primary, fontSize: 34, fontWeight: '800', marginBottom: 18, letterSpacing: -0.5 }}>{formatCurrency(req.totalCost)}</Text>
          {(req.items ?? []).length > 0 ? (
            <>
              {req.items.map((item, i) => (
                <View
                  key={`${item.productId}-${i}`}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.divider }}
                >
                  <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                    <Text style={{ color: colors.text.primary, fontSize: 14 }} numberOfLines={1}>{item.variantName || item.productName || `Item ${i + 1}`}</Text>
                    <Text style={{ color: colors.text.muted, fontSize: 12, marginTop: 2 }}>Line item</Text>
                  </View>
                  <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '600' }}>{formatCurrency(item.costAtPurchase)}</Text>
                </View>
              ))}
              <View style={{ paddingTop: 12, marginTop: 4, borderTopWidth: 2, borderTopColor: colors.divider, gap: 2 }}>
                <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>Total Order Value</Text>
                <Text style={{ color: colors.text.primary, fontSize: 22, fontWeight: '800', marginTop: 4 }}>{formatCurrency(req.totalCost)}</Text>
              </View>
            </>
          ) : null}
        </View>

        {/* Attachments */}
        {(req.attachments ?? []).length > 0 ? (
          <View style={{ borderRadius: 20, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <View style={{ width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: colors.divider, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.input }}>
                <Text style={{ fontSize: 13 }}>📎</Text>
              </View>
              <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '600' }}>Attachments</Text>
            </View>
            <View style={{ gap: 8 }}>
              {(req.attachments ?? []).map((att, i) => (
                <Pressable
                  key={i}
                  onPress={() => {
                    void openAttachmentPath(att.storagePath ?? att.uri).catch((error) => {
                      console.warn('Open procurement attachment failed:', error);
                      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    });
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.input, gap: 12 }}
                >
                  <FileText size={18} color={colors.text.tertiary} strokeWidth={2} />
                  <Text style={{ flex: 1, color: colors.text.primary, fontSize: 13, fontWeight: '500' }} numberOfLines={1}>{att.name}</Text>
                  <Download size={16} color={colors.text.muted} strokeWidth={2} />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    );

    // ── Right sidebar ──
    const rightSidebar = (
      <View style={{ width: 300, borderLeftWidth: 1, borderLeftColor: colors.divider }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 16 }}>
          {/* Requester */}
          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, padding: 16 }}>
            <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Requester</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bar, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.bg.screen, fontSize: 18, fontWeight: '700' }}>
                  {(row.submittedByName || 'T').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '600' }}>{row.submittedByName || 'Team Member'}</Text>
                <Text style={{ color: colors.text.tertiary, fontSize: 12, marginTop: 2 }}>{req.supplierName || 'No supplier'}</Text>
              </View>
            </View>
          </View>

          {/* PO Details */}
          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, padding: 16, gap: 10 }}>
            <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>PO Details</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.text.muted, fontSize: 13 }}>PO Number</Text>
              <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '600' }}>{row.poNumber}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.text.muted, fontSize: 13 }}>Date Paid</Text>
              <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '600' }}>{row.paidDate}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.text.muted, fontSize: 13 }}>Date Received</Text>
              <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '600' }}>{row.receivedDate}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.text.muted, fontSize: 13 }}>Line Items</Text>
              <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '600' }}>{row.lineCount}</Text>
            </View>
          </View>

          {/* Activity */}
          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, padding: 16 }}>
            <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>Activity</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.divider, alignItems: 'center', justifyContent: 'center' }}>
                <User size={13} color={colors.text.secondary} strokeWidth={2} />
              </View>
              <View style={{ flex: 1, paddingTop: 4 }}>
                <Text style={{ color: colors.text.primary, fontSize: 12, fontWeight: '500' }}>submitted PO request</Text>
                <Text style={{ color: colors.text.muted, fontSize: 11, marginTop: 2 }}>{row.submittedByName || 'Team Member'}</Text>
              </View>
            </View>
          </View>

          {/* Notes */}
          {req.notes?.trim() ? (
            <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, padding: 16 }}>
              <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Notes</Text>
              <Text style={{ color: colors.text.secondary, fontSize: 13, lineHeight: 20 }}>{req.notes.trim()}</Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    );

    return (
      <View style={{ flex: 1, flexDirection: 'row', borderRadius: 20, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, overflow: 'hidden' }}>
        {queueSidebar}
        <View style={{ flex: 1, flexDirection: 'column' }}>
          {headerBar}
          <View style={{ flex: 1, flexDirection: 'row' }}>
            {centerCol}
            {rightSidebar}
          </View>
        </View>
      </View>
    );
  };

  const renderRefundDetailHeaderActions = (
    request: RefundRequest,
    options?: { closeModalOnEdit?: boolean; onClose?: () => void }
  ) => {
    const canManageRequest = isFinanceApprover || isCurrentUserRefundRequestOwner(request);
    const canEditRequest = canManageRequest && request.status !== 'void';
    const canDeleteRequest = canManageRequest;
    const canVoidRequest = canManageRequest && request.status !== 'void';
    const canShowActionMenu = canEditRequest || canVoidRequest || canDeleteRequest;

    if (!canShowActionMenu && !options?.onClose) {
      return <View style={{ width: 38, height: 38 }} />;
    }

    return (
      <View className="flex-row items-center" style={{ gap: 8, position: 'relative', zIndex: 80 }}>
        {canShowActionMenu ? (
          <View style={{ position: 'relative' }}>
            <Pressable
              onPress={() => setRefundDetailActionMenuOpen((previous) => !previous)}
              className="rounded-full items-center justify-center"
              style={{
                width: 40,
                height: 40,
                borderWidth: 1,
                borderColor: colors.divider,
                backgroundColor: refundDetailActionMenuOpen ? colors.bg.input : colors.bg.card,
              }}
            >
              <MoreVertical size={16} color={colors.text.secondary} strokeWidth={2} />
            </Pressable>
            {refundDetailActionMenuOpen ? (
              <View
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 46,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.divider,
                  backgroundColor: colors.bg.card,
                  zIndex: 1400,
                  elevation: 36,
                  minWidth: 160,
                  overflow: 'hidden',
                }}
              >
                {canEditRequest ? (
                  <Pressable
                    onPress={() => {
                      setRefundDetailActionMenuOpen(false);
                      if (options?.closeModalOnEdit) {
                        setShowRefundRequestDetailModal(false);
                      }
                      openRefundRequestEditor(request.id);
                    }}
                    className="px-3 py-2.5"
                    style={{ borderBottomWidth: canVoidRequest || canDeleteRequest ? 1 : 0, borderBottomColor: colors.divider }}
                  >
                    <Text style={{ color: colors.text.primary }} className="text-sm font-medium">Edit</Text>
                  </Pressable>
                ) : null}
                {canVoidRequest ? (
                  <Pressable
                    onPress={() => {
                      setRefundDetailActionMenuOpen(false);
                      void handleVoidRefundRequest(request.id, refundAdminNoteDraft);
                    }}
                    className="px-3 py-2.5"
                    style={{ borderBottomWidth: canDeleteRequest ? 1 : 0, borderBottomColor: colors.divider }}
                  >
                    <Text style={{ color: colors.danger }} className="text-sm font-medium">Mark Void</Text>
                  </Pressable>
                ) : null}
                {canDeleteRequest ? (
                  <Pressable
                    onPress={() => {
                      setRefundDetailActionMenuOpen(false);
                      void handleDeleteRefundRequest(request.id);
                    }}
                    className="px-3 py-2.5"
                  >
                    <Text style={{ color: colors.danger }} className="text-sm font-medium">Delete</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}
        {options?.onClose ? (
          <Pressable
            onPress={() => {
              setRefundDetailActionMenuOpen(false);
              options.onClose?.();
            }}
            style={{ width: 38, height: 38, borderRadius: 10, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.input, alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={18} color={colors.text.secondary} strokeWidth={2.4} />
          </Pressable>
        ) : null}
      </View>
    );
  };

  const renderRefundRequestDetailBody = (request: RefundRequest, mode: 'modal' | 'panel' = 'modal') => {
    const isPanel = mode === 'panel';
    const canReviewRefundRequest = isFinanceApprover && request.status === 'submitted';
    const canOwnerMarkPaid = request.status === 'approved' && isCurrentUserRefundRequestOwner(request);
    const requestBankChargeAmount = Math.max(0, request.bankChargeAmount ?? 0);
    const requestStampDutyAmount = Math.max(0, request.stampDutyAmount ?? 0);
    const requestTotalDebit = Number.isFinite(request.totalDebitAmount ?? NaN)
      ? Math.max(0, request.totalDebitAmount ?? 0)
      : request.amount + requestBankChargeAmount + requestStampDutyAmount;

    return (
      <>
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={isPanel ? { flex: 1 } : (isWebDesktop ? { maxHeight: 560 } : { flex: 1 })}
          contentContainerStyle={{ paddingTop: isPanel ? 0 : 18, paddingBottom: 12, gap: 14 }}
        >
          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.input, padding: 16, gap: 8 }}>
            <View className="flex-row items-center justify-between" style={{ gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text.primary, fontSize: 18, fontWeight: '400' }}>{request.orderNumber}</Text>
                <Text style={{ color: colors.text.secondary, fontSize: 13, marginTop: 2 }}>{request.customerName}</Text>
              </View>
              <StatusBadge label={formatRefundRequestStatusLabel(request)} colors={colors} maxWidth={140} />
            </View>
            <Text style={{ color: colors.text.primary, fontSize: 22, fontWeight: '500' }}>{formatCurrency(request.amount)}</Text>
            <Text style={{ color: colors.text.tertiary, fontSize: 12 }}>
              Requested on {new Date(request.requestedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
          </View>

          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, padding: 16, gap: 10 }}>
            <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>Request Details</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
              <Text style={{ color: colors.text.tertiary, fontSize: 13 }}>Refund Type</Text>
              <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '600' }}>
                {request.refundType === 'full' ? 'Full refund' : 'Partial refund'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
              <Text style={{ color: colors.text.tertiary, fontSize: 13 }}>Bank Charges</Text>
              <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '600' }}>
                {request.applyBankCharges ? 'Applied' : 'Not applied'}
              </Text>
            </View>
            {request.applyBankCharges ? (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                  <Text style={{ color: colors.text.tertiary, fontSize: 13 }}>NIP Fee + VAT</Text>
                  <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '600' }}>
                    {formatCurrency(requestBankChargeAmount)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                  <Text style={{ color: colors.text.tertiary, fontSize: 13 }}>Stamp Duty</Text>
                  <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '600' }}>
                    {formatCurrency(requestStampDutyAmount)}
                  </Text>
                </View>
              </>
            ) : null}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
              <Text style={{ color: colors.text.tertiary, fontSize: 13 }}>Total Debit</Text>
              <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '700' }}>
                {formatCurrency(requestTotalDebit)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
              <Text style={{ color: colors.text.tertiary, fontSize: 13 }}>Submitted By</Text>
              <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '600' }}>
                {request.submittedByName || 'Team Member'}
              </Text>
            </View>
            {request.reviewedByName ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <Text style={{ color: colors.text.tertiary, fontSize: 13 }}>Reviewed By</Text>
                <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '600' }}>
                  {request.reviewedByName}
                </Text>
              </View>
            ) : null}
            {request.paidByName ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <Text style={{ color: colors.text.tertiary, fontSize: 13 }}>Paid By</Text>
                <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '600' }}>
                  {request.paidByName}
                </Text>
              </View>
            ) : null}
            {request.paymentReference ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <Text style={{ color: colors.text.tertiary, fontSize: 13 }}>Payment Ref</Text>
                <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '600' }}>
                  {request.paymentReference}
                </Text>
              </View>
            ) : null}
            {request.voidedByName ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <Text style={{ color: colors.text.tertiary, fontSize: 13 }}>Voided By</Text>
                <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '600' }}>
                  {request.voidedByName}
                </Text>
              </View>
            ) : null}
            {request.voidReason ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <Text style={{ color: colors.text.tertiary, fontSize: 13 }}>Void Reason</Text>
                <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '600', textAlign: 'right', flex: 1 }}>
                  {request.voidReason}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, padding: 16, gap: 8 }}>
            <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>Reason</Text>
            <Text style={{ color: colors.text.secondary, fontSize: 14, lineHeight: 22 }}>{request.reason}</Text>
            {request.note?.trim() ? (
              <>
                <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 6 }}>Internal Note</Text>
                <Text style={{ color: colors.text.secondary, fontSize: 14, lineHeight: 22 }}>{request.note.trim()}</Text>
              </>
            ) : null}
            {request.rejectionReason ? (
              <>
                <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 6 }}>Review Note</Text>
                <Text style={{ color: colors.danger, fontSize: 14, lineHeight: 22 }}>{request.rejectionReason}</Text>
              </>
            ) : null}
          </View>

          {(request.attachments ?? []).length > 0 ? (
            <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, padding: 16, gap: 10 }}>
              <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>
                Request Context
              </Text>
              {(request.attachments ?? []).map((attachment) => (
                <Pressable
                  key={attachment.id}
                  onPress={() => {
                    void openRefundRequestAttachment(attachment.storagePath).catch((error) => {
                      console.warn('Open refund attachment failed:', error);
                      showSettingsToast('error', 'Could not open screenshot.');
                    });
                  }}
                  className="rounded-xl flex-row items-center px-3"
                  style={{
                    minHeight: 52,
                    borderWidth: 1,
                    borderColor: colors.divider,
                    backgroundColor: colors.bg.input,
                  }}
                >
                  <View
                    className="rounded-lg items-center justify-center"
                    style={{ width: 36, height: 36, backgroundColor: colors.bg.screen, borderWidth: 1, borderColor: colors.divider }}
                  >
                    <ImageIcon size={16} color={colors.text.tertiary} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
                    <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '500' }} numberOfLines={1}>
                      {attachment.fileName}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}

          {isFinanceApprover && request.status === 'submitted' ? (
            <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, padding: 16, gap: 10 }}>
              <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>
                Admin Action
              </Text>
              <TextInput
                value={refundAdminNoteDraft}
                onChangeText={setRefundAdminNoteDraft}
                placeholder="Add note for more info or payout context"
                placeholderTextColor={colors.text.muted}
                multiline
                textAlignVertical="top"
                style={{
                  minHeight: 90,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: formFieldBorder,
                  backgroundColor: formFieldBg,
                  color: colors.text.primary,
                  paddingHorizontal: 14,
                  paddingVertical: 14,
                  fontSize: 15,
                }}
              />
            </View>
          ) : null}

          {request.status === 'approved' && isCurrentUserRefundRequestOwner(request) ? (
            <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, padding: 16, gap: 10 }}>
              <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>
                Refund Payout
              </Text>
              <Text style={{ color: colors.text.secondary, fontSize: 13, lineHeight: 20 }}>
                This refund has been approved. Upload the transfer receipt after the refund is fully processed, then mark it as paid.
              </Text>
              <TextInput
                value={refundPaymentReferenceDraft}
                onChangeText={setRefundPaymentReferenceDraft}
                placeholder="Payment reference (optional)"
                placeholderTextColor={colors.text.muted}
                style={{
                  height: 52,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: formFieldBorder,
                  backgroundColor: formFieldBg,
                  color: colors.text.primary,
                  paddingHorizontal: 14,
                  fontSize: 15,
                }}
              />
              <View style={{ gap: 10 }}>
                <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '600' }}>
                  Refund Receipt
                </Text>
                {refundProofAttachmentDrafts.length === 0 ? (
                  <Pressable
                    onPress={() => { void pickRefundProofAttachments(); }}
                    className="rounded-2xl items-center justify-center"
                    style={{
                      minHeight: 120,
                      borderWidth: 1,
                      borderStyle: 'dashed',
                      borderColor: formFieldBorder,
                      backgroundColor: formFieldBg,
                      paddingHorizontal: 20,
                      paddingVertical: 20,
                    }}
                  >
                    <View
                      className="rounded-full items-center justify-center mb-3"
                      style={{ width: 42, height: 42, backgroundColor: colors.bg.cardAlt, borderWidth: 1, borderColor: formFieldBorder }}
                    >
                      <Camera size={18} color={colors.text.tertiary} strokeWidth={2} />
                    </View>
                    <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '600' }}>Upload refund receipt</Text>
                    <Text style={{ color: colors.text.muted, fontSize: 12, marginTop: 4, textAlign: 'center' }}>
                      Required before marking this refund as paid
                    </Text>
                  </Pressable>
                ) : (
                  <View style={{ gap: 10 }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 4 }}>
                      {refundProofAttachmentDrafts.map((attachment) => (
                        <View key={attachment.id} style={{ width: 110 }}>
                          <View
                            className="rounded-2xl overflow-hidden"
                            style={{
                              height: 110,
                              borderWidth: 1,
                              borderColor: formFieldBorder,
                              backgroundColor: formFieldBg,
                              position: 'relative',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {attachment.localUri ? (
                              <Image source={{ uri: attachment.localUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                            ) : (
                              <View className="items-center justify-center px-3">
                                <ImageIcon size={22} color={colors.text.tertiary} strokeWidth={2} />
                                <Text style={{ color: colors.text.secondary, fontSize: 11, marginTop: 8, textAlign: 'center' }} numberOfLines={2}>
                                  {attachment.fileName}
                                </Text>
                              </View>
                            )}
                            <Pressable
                              onPress={() => removeRefundProofAttachment(attachment.id)}
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
                      onPress={() => { void pickRefundProofAttachments(); }}
                      className="rounded-xl items-center justify-center"
                      style={{
                        height: 44,
                        borderWidth: 1,
                        borderStyle: 'dashed',
                        borderColor: formFieldBorder,
                      }}
                    >
                      <Text style={{ color: colors.text.secondary, fontSize: 13, fontWeight: '600' }}>+ Add Receipt</Text>
                    </Pressable>
                  </View>
                )}

                {refundProofAttachmentError ? (
                  <Text style={{ color: colors.danger, fontSize: 12 }}>
                    {refundProofAttachmentError}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {request.status === 'approved' && isFinanceApprover ? (
            <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, padding: 16, gap: 8 }}>
              <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>
                Awaiting Payout Confirmation
              </Text>
              <Text style={{ color: colors.text.secondary, fontSize: 13, lineHeight: 20 }}>
                The requester will upload the refund receipt after the bank transfer is completed, then mark this refund as paid.
              </Text>
            </View>
          ) : null}

          {(request.proofAttachments ?? []).length > 0 ? (
            <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, padding: 16, gap: 10 }}>
              <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>
                Refund Proof
              </Text>
              {(request.proofAttachments ?? []).map((attachment) => (
                <Pressable
                  key={attachment.id}
                  onPress={() => {
                    void openRefundRequestAttachment(attachment.storagePath).catch((error) => {
                      console.warn('Open refund proof failed:', error);
                      showSettingsToast('error', 'Could not open refund proof.');
                    });
                  }}
                  className="rounded-xl flex-row items-center px-3"
                  style={{
                    minHeight: 52,
                    borderWidth: 1,
                    borderColor: colors.divider,
                    backgroundColor: colors.bg.input,
                  }}
                >
                  <View
                    className="rounded-lg items-center justify-center"
                    style={{ width: 36, height: 36, backgroundColor: colors.bg.screen, borderWidth: 1, borderColor: colors.divider }}
                  >
                    <ImageIcon size={16} color={colors.text.tertiary} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
                    <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '500' }} numberOfLines={1}>
                      {attachment.fileName}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}
        </ScrollView>

        {canReviewRefundRequest ? (
          <View className="flex-row items-center justify-end mt-4" style={{ gap: 10, flexWrap: 'wrap' }}>
            <>
              <Pressable
                onPress={() => handleRequestRefundRequestInfo(request.id, refundAdminNoteDraft)}
                className="rounded-full px-5"
                style={{ height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.divider }}
              >
                <Text style={{ color: colors.text.secondary }} className="font-semibold">More Info</Text>
              </Pressable>
              <Pressable
                onPress={() => handleRejectRefundRequest(request.id)}
                className="rounded-full px-5"
                style={{ height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.divider }}
              >
                <Text style={{ color: colors.danger }} className="font-semibold">Reject</Text>
              </Pressable>
              <Pressable
                onPress={() => handleApproveRefundRequest(request.id)}
                className="rounded-full px-5"
                style={{ height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bar }}
              >
                <Text style={{ color: colors.bg.screen }} className="font-semibold">Approve</Text>
              </Pressable>
            </>
          </View>
        ) : null}

        {canOwnerMarkPaid ? (
          <Pressable
            onPress={() => { void handleMarkRefundRequestPaid(request.id, refundPaymentReferenceDraft); }}
            className="rounded-full mt-4"
            style={{
              width: '100%',
              height: 46,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: refundProofAttachmentDrafts.length > 0
                ? '#FFFFFF'
                : (isDarkMode ? '#3A3A3A' : colors.bg.cardAlt),
              borderWidth: 1,
              borderColor: refundProofAttachmentDrafts.length > 0
                ? '#E5E7EB'
                : (isDarkMode ? '#4A4A4A' : colors.divider),
            }}
          >
            <Text
              style={{
                color: refundProofAttachmentDrafts.length > 0
                  ? '#111111'
                  : (isDarkMode ? '#B3B3B3' : colors.text.secondary),
              }}
              className="font-semibold"
            >
              Mark Paid
            </Text>
          </Pressable>
        ) : null}
      </>
    );
  };

  const renderRefundRequestDetailPanel = () => {
    if (!selectedRefundRequest) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: colors.text.muted, fontSize: 15 }}>Select a refund request</Text>
        </View>
      );
    }

    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.screen }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            height: 56,
            borderBottomWidth: 1,
            borderBottomColor: colors.divider,
            backgroundColor: colors.bg.card,
            zIndex: 80,
            elevation: 28,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ color: colors.text.primary, fontSize: isDetailPanelCompact ? 15 : 16, fontWeight: '700' }}>Refund Details</Text>
          </View>
          {renderRefundDetailHeaderActions(selectedRefundRequest, {
            onClose: () => setSelectedRefundRequestId(null),
          })}
        </View>

        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 }}>
          {renderRefundRequestDetailBody(selectedRefundRequest, 'panel')}
        </View>
      </View>
    );
  };

  const renderRefundRequestSection = () => {
    const renderRefundRequestTopCards = () => {
      const periodPills = (
        <View style={{ marginTop: isWebDesktop ? 0 : 16 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {overviewRangeOptions.map((option) => (
              <FinanceFilterPill
                key={option.key}
                label={option.label}
                active={refundPeriod === option.key}
                onPress={() => setRefundPeriod(option.key)}
                colors={colors}
              />
            ))}
          </ScrollView>
        </View>
      );

      if (isWebDesktop) {
        return (
          <>
            {periodPills}
            <View className="mt-4" style={{ flexDirection: 'row', gap: 12 }}>
              <FinanceMetricCard
                label="Refund Total"
                value={formatCurrency(refundPeriodStats.total)}
                helper={refundPeriodWindow.label}
                helperTone="neutral"
                trendPlacement="right"
                compactTrend={isCompactLayout}
                valueFontSize={24}
                colors={colors}
              />
              <FinanceMetricCard
                label="Entries"
                value={refundPeriodStats.count.toLocaleString()}
                helper={refundPeriodWindow.label}
                helperTone="neutral"
                trendPlacement="right"
                compactTrend={isCompactLayout}
                valueFontSize={24}
                colors={colors}
              />
            </View>
          </>
        );
      }

      if (isMobile) {
        return (
          <View className="mt-4" style={{ flexDirection: 'row', gap: 12 }}>
            <FinanceMetricCard
              label="Refund Total"
              value={formatCurrency(refundPeriodStats.total)}
              helper={refundPeriodWindow.label}
              helperTone="neutral"
              trendPlacement="right"
              compactTrend={isCompactLayout}
              valueFontSize={20}
              colors={colors}
            />
            <FinanceMetricCard
              label="Entries"
              value={refundPeriodStats.count.toLocaleString()}
              helper={refundPeriodWindow.label}
              helperTone="neutral"
              trendPlacement="right"
              compactTrend={isCompactLayout}
              valueFontSize={20}
              colors={colors}
            />
          </View>
        );
      }

      return (
        <>
          {periodPills}
          <View className="mt-4" style={{ flexDirection: 'row', gap: 12 }}>
            <FinanceMetricCard
              label="Refund Total"
              value={formatCurrency(refundPeriodStats.total)}
              helper={refundPeriodWindow.label}
              helperTone="neutral"
              trendPlacement="right"
              compactTrend={isCompactLayout}
              valueFontSize={20}
              colors={colors}
            />
            <FinanceMetricCard
              label="Entries"
              value={refundPeriodStats.count.toLocaleString()}
              helper={refundPeriodWindow.label}
              helperTone="neutral"
              trendPlacement="right"
              compactTrend={isCompactLayout}
              valueFontSize={20}
              colors={colors}
            />
          </View>
        </>
      );
    };

    const visiblePendingCount = isFinanceApprover ? pendingRefundApprovalRows.length : myPendingRefundRequestRows.length;

    return (
      <View style={{ marginTop: activeTab === 'refunds' ? financeSectionTopMargin : 24 }}>
        {!isWebDesktop ? (
          <View className="flex-row items-start justify-between" style={{ gap: 12 }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: colors.text.primary }} className="text-2xl font-bold">Refunds</Text>
              <Text style={{ color: colors.text.tertiary }} className="text-sm mt-1">
                Request, review, and complete customer refunds tied to orders.
              </Text>
            </View>
            {canCreateRefundRequest ? (
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  openRefundRequestComposer();
                }}
                className="rounded-full active:opacity-80 px-3.5 flex-row items-center"
                style={{ height: 40, backgroundColor: colors.bar }}
              >
                <Plus size={18} color={colors.bg.screen} strokeWidth={2.5} />
                <Text style={{ color: colors.bg.screen }} className="font-semibold ml-1.5 text-sm">New Refund</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {renderRefundRequestTopCards()}

        <Pressable
          onPress={() => {
            if (!isFinanceApprover) {
              const hasSubmittedRefunds = myPendingRefundRequestRows.some((row) => row.status === 'submitted');
              const hasApprovedRefunds = myPendingRefundRequestRows.some((row) => row.status === 'approved');
              setRefundRequestFilter(hasSubmittedRefunds ? 'submitted' : hasApprovedRefunds ? 'approved' : 'all');
              return;
            }

            const hasSubmittedRefunds = pendingRefundApprovalRows.some((row) => row.status === 'submitted');
            if (hasSubmittedRefunds) {
              setRefundRequestFilter('submitted');
              return;
            }

            const hasApprovedRefunds = pendingRefundApprovalRows.some((row) => row.status === 'approved');
            setRefundRequestFilter(hasApprovedRefunds ? 'approved' : 'all');
          }}
          disabled={visiblePendingCount === 0}
          className="mt-4 rounded-2xl p-4"
          style={{ ...colors.getCardStyle(), opacity: visiblePendingCount === 0 ? 0.6 : 1 }}
        >
          <View className="flex-row items-center justify-between" style={{ gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text.primary }} className="text-base font-semibold">
                {isFinanceApprover ? 'Pending Refund Approvals' : 'My Pending Refunds'}
              </Text>
              <Text style={{ color: colors.text.tertiary }} className="text-xs mt-1">
                {isFinanceApprover
                  ? 'Refund requests waiting for admin approval.'
                  : 'Refund requests waiting for admin review or payout completion.'}
              </Text>
            </View>
            <View
              className="rounded-full items-center justify-center"
              style={{
                width: 30,
                height: 30,
                borderWidth: 1,
                borderColor: pendingBadgeBorder,
                backgroundColor: pendingBadgeBg,
              }}
            >
              <Text style={{ color: pendingBadgeText, fontSize: 13, fontWeight: '700' }}>
                {visiblePendingCount > 9 ? '9+' : visiblePendingCount}
              </Text>
            </View>
          </View>
        </Pressable>

        {renderTotalsInfoNote(
          'Top cards use the selected period. Amount beside filter icon sums the visible refund list after search and filters.',
          financeSectionControlsMargin
        )}

        {isWebDesktop ? (
          <View className="flex-row items-center" style={{ gap: 12, marginTop: financeSectionControlsMargin }}>
            <View
              className="flex-row items-center rounded-full px-3"
              style={{
                height: 40,
                width: 280,
                borderWidth: 1,
                borderColor: colors.divider,
                backgroundColor: 'transparent',
              }}
            >
              <Search size={15} color={colors.text.muted} strokeWidth={2} />
              <TextInput
                value={refundSearchQuery}
                onChangeText={setRefundSearchQuery}
                placeholder="Search refunds"
                placeholderTextColor={colors.text.muted}
                style={{ flex: 1, marginLeft: 8, color: colors.text.primary, fontSize: 14 }}
              />
            </View>
            <View style={{ flex: 1 }} />
            <Text style={{ color: colors.text.primary }} className="text-lg font-semibold">
              {formatCurrency(filteredRefundRequestsTotal)}
            </Text>
            <View style={{ position: 'relative' }}>
              {refundRequestFilterSortCount > 0 ? (
                <View
                  className="rounded-full items-center justify-center"
                  style={{
                    position: 'absolute',
                    right: 1,
                    top: -6,
                    minWidth: 16,
                    height: 16,
                    paddingHorizontal: 4,
                    backgroundColor: colors.bar,
                    zIndex: 2,
                  }}
                >
                  <Text style={{ color: colors.bg.screen, fontSize: 9, fontWeight: '700' }}>
                    {refundRequestFilterSortCount > 9 ? '9+' : refundRequestFilterSortCount}
                  </Text>
                </View>
              ) : null}
              <Pressable
                onPress={() => setShowRefundRequestFilterSheet(true)}
                className="rounded-full items-center justify-center"
                style={{
                  width: 40,
                  height: 40,
                  borderWidth: 1,
                  borderColor: colors.divider,
                  backgroundColor: 'transparent',
                }}
              >
                <Filter
                  size={16}
                  color={refundRequestFilterSortCount > 0 ? colors.bar : colors.text.tertiary}
                  strokeWidth={2}
                />
              </Pressable>
            </View>
          </View>
        ) : isMobile ? (
          <View style={{ gap: 10, marginTop: financeSectionControlsMargin }}>
            <View className="flex-row items-center" style={{ gap: 10 }}>
              <View
                className="flex-row items-center rounded-full px-3"
                style={{
                  height: 40,
                  flex: 1,
                  borderWidth: 1,
                  borderColor: colors.divider,
                  backgroundColor: 'transparent',
                }}
              >
                <Search size={15} color={colors.text.muted} strokeWidth={2} />
                <TextInput
                  value={refundSearchQuery}
                  onChangeText={setRefundSearchQuery}
                  placeholder="Search refunds"
                  placeholderTextColor={colors.text.muted}
                  style={{ flex: 1, marginLeft: 8, color: colors.text.primary, fontSize: 14 }}
                />
              </View>
              <View style={{ position: 'relative' }}>
                {refundRequestFilterSortCount > 0 ? (
                  <View
                    className="rounded-full items-center justify-center"
                    style={{
                      position: 'absolute',
                      right: 1,
                      top: -6,
                      minWidth: 16,
                      height: 16,
                      paddingHorizontal: 4,
                      backgroundColor: colors.bar,
                      zIndex: 2,
                    }}
                  >
                    <Text style={{ color: colors.bg.screen, fontSize: 9, fontWeight: '700' }}>
                      {refundRequestFilterSortCount > 9 ? '9+' : refundRequestFilterSortCount}
                    </Text>
                  </View>
                ) : null}
                <Pressable
                  onPress={() => setShowRefundRequestFilterSheet(true)}
                  className="items-center justify-center"
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    borderColor: colors.divider,
                  }}
                >
                  <Filter
                    size={16}
                    color={refundRequestFilterSortCount > 0 ? colors.bar : colors.text.tertiary}
                    strokeWidth={2}
                  />
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          <View style={{ gap: 10, marginTop: financeSectionControlsMargin }}>
            <View className="flex-row items-center" style={{ gap: 10 }}>
              <View
                className="flex-row items-center rounded-full px-3"
                style={{
                  height: 40,
                  flex: 1,
                  borderWidth: 1,
                  borderColor: colors.divider,
                  backgroundColor: 'transparent',
                }}
              >
                <Search size={15} color={colors.text.muted} strokeWidth={2} />
                <TextInput
                  value={refundSearchQuery}
                  onChangeText={setRefundSearchQuery}
                  placeholder="Search refunds"
                  placeholderTextColor={colors.text.muted}
                  style={{ flex: 1, marginLeft: 8, color: colors.text.primary, fontSize: 14 }}
                />
              </View>
              <Text style={{ color: colors.text.primary }} className="text-lg font-semibold">
                {formatCurrency(filteredRefundRequestsTotal)}
              </Text>
              <View style={{ position: 'relative' }}>
                {refundRequestFilterSortCount > 0 ? (
                  <View
                    className="rounded-full items-center justify-center"
                    style={{
                      position: 'absolute',
                      right: 1,
                      top: -6,
                      minWidth: 16,
                      height: 16,
                      paddingHorizontal: 4,
                      backgroundColor: colors.bar,
                      zIndex: 2,
                    }}
                  >
                    <Text style={{ color: colors.bg.screen, fontSize: 9, fontWeight: '700' }}>
                      {refundRequestFilterSortCount > 9 ? '9+' : refundRequestFilterSortCount}
                    </Text>
                  </View>
                ) : null}
                <Pressable
                  onPress={() => setShowRefundRequestFilterSheet(true)}
                  className="items-center justify-center"
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    borderColor: colors.divider,
                  }}
                >
                  <Filter
                    size={16}
                    color={refundRequestFilterSortCount > 0 ? colors.bar : colors.text.tertiary}
                    strokeWidth={2}
                  />
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {!isMobile ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, marginTop: 10 }}>
            {refundRequestFilterOptions.map((option) => (
              <FinanceFilterPill
                key={option.key}
                label={option.label}
                active={refundRequestFilter === option.key}
                onPress={() => setRefundRequestFilter(option.key)}
                colors={colors}
              />
            ))}
          </ScrollView>
        ) : null}

        <View
          style={{
            marginTop: financeSectionBodyMargin,
            borderWidth: 1,
            borderColor: colors.divider,
            borderRadius: 16,
            overflow: 'hidden',
            backgroundColor: colors.bg.card,
          }}
        >
          {isWebDesktop ? (
            <View style={{ borderBottomWidth: 1, borderBottomColor: colors.divider }}>
              <View className="grid grid-cols-12 items-center px-3 py-3" style={{ columnGap: 12 } as any}>
                <Text style={{ color: colors.text.muted }} className="col-span-3 text-xs font-semibold uppercase">Order</Text>
                <Text style={{ color: colors.text.muted }} className="col-span-2 text-xs font-semibold uppercase">Requested</Text>
                <Text style={{ color: colors.text.muted }} className="col-span-2 text-xs font-semibold uppercase">Submitted By</Text>
                <Text style={{ color: colors.text.muted }} className="col-span-2 text-xs font-semibold uppercase">Status</Text>
                <Text style={{ color: colors.text.muted }} className="col-span-1 text-xs font-semibold uppercase">Type</Text>
                <Text
                  style={{ color: colors.text.muted, textAlign: 'right' }}
                  className="col-span-2 text-xs font-semibold uppercase"
                >
                  Amount
                </Text>
              </View>
            </View>
          ) : null}

          {filteredRefundRequestRows.length === 0 ? (
            <View className="items-center justify-center py-12">
              <Text style={{ color: colors.text.tertiary }} className="text-base">No refund requests found</Text>
            </View>
          ) : filteredRefundRequestRows.map((row, index) => {
            return (
              <Pressable
                key={row.id}
                onPress={() => {
                  openRefundRequestDetail(row.id, { modal: !isWebDesktop });
                }}
                style={{
                  borderBottomWidth: index === filteredRefundRequestRows.length - 1 ? 0 : 1,
                  borderBottomColor: colors.divider,
                  backgroundColor: selectedRefundRequestId === row.id ? colors.bg.input : 'transparent',
                  borderLeftWidth: selectedRefundRequestId === row.id ? 3 : 0,
                  borderLeftColor: colors.bar,
                }}
                className={isWebDesktop ? '' : 'px-4 py-3.5'}
              >
                {isWebDesktop ? (
                  <View className="grid grid-cols-12 items-center px-3 py-3.5" style={{ columnGap: 12 } as any}>
                    <View className="col-span-3" style={{ minWidth: 0 }}>
                      <Text style={{ color: colors.text.primary }} className="text-sm font-normal" numberOfLines={1}>
                        {row.orderNumber}
                      </Text>
                      <Text style={{ color: colors.text.secondary }} className="text-xs mt-0.5" numberOfLines={1}>
                        {row.customerName}
                      </Text>
                    </View>
                    <Text style={{ color: colors.text.secondary }} className="col-span-2 text-sm" numberOfLines={1}>
                      {row.requestedDate}
                    </Text>
                    <Text style={{ color: colors.text.secondary }} className="col-span-2 text-sm" numberOfLines={1}>
                      {row.submittedByName}
                    </Text>
                    <View className="col-span-2" style={{ paddingRight: 8 }}>
                      <StatusBadge label={formatRefundRequestStatusLabel(row)} colors={colors} maxWidth={120} />
                    </View>
                    <Text style={{ color: colors.text.secondary }} className="col-span-1 text-sm" numberOfLines={1}>
                      {row.refundType === 'full' ? 'Full' : 'Partial'}
                    </Text>
                    <Text style={{ color: colors.text.primary, textAlign: 'right' }} className="col-span-2 text-sm font-normal" numberOfLines={1}>
                      {formatCurrency(row.amount)}
                    </Text>
                  </View>
                ) : (
                  <View className="flex-row items-start justify-between" style={{ gap: 10 }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: colors.text.primary }} className="text-base font-normal" numberOfLines={1}>
                        {row.orderNumber}
                      </Text>
                      <Text style={{ color: colors.text.secondary }} className="text-sm mt-1" numberOfLines={1}>
                        {`${row.customerName} · ${row.refundType === 'full' ? 'Full refund' : 'Partial refund'}`}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', minWidth: 120 }}>
                      <Text style={{ color: colors.text.primary }} className="text-base font-normal" numberOfLines={1}>
                        {formatCurrency(row.amount)}
                      </Text>
                      <View className="flex-row items-center mt-1" style={{ gap: 6 }}>
                        <StatusBadge label={formatRefundRequestStatusLabel(row)} colors={colors} compact maxWidth={92} />
                        <Text style={{ color: colors.text.secondary }} className="text-xs" numberOfLines={1}>
                          {row.requestedDate}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  const renderRefunds = () => (
    <View style={isWebDesktop ? { maxWidth: 1440, width: '100%', alignSelf: 'flex-start' } : undefined}>
      {renderRefundRequestSection()}
    </View>
  );

  const renderMyExpenseRequestWorkspace = () => (
    <View style={isWebDesktop ? { maxWidth: 1440, width: '100%', alignSelf: 'flex-start' } : undefined}>
      <View style={{ marginTop: financeSectionTopMargin }}>
        {!isWebDesktop ? (
          <View className="flex-row items-start justify-between" style={{ gap: 12 }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: colors.text.primary }} className="text-2xl font-bold">Expenses</Text>
              <Text style={{ color: colors.text.tertiary }} className="text-sm mt-1">
                Track one-time and recurring costs
              </Text>
            </View>
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  openExpenseComposer();
                }}
                className="rounded-full active:opacity-80 px-3.5 flex-row items-center"
                style={{ height: 40, backgroundColor: colors.bar }}
              >
                <Plus size={18} color={colors.bg.screen} strokeWidth={2.5} />
                <Text style={{ color: colors.bg.screen }} className="font-semibold ml-1.5 text-sm">Add Expense</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {renderMyExpenseRequestTopCards()}

        <Pressable
          onPress={() => {
            if (myPendingExpenseRequestRows.length === 0) return;
            setExpenseRequestFilter('submitted');
            setExpenseRequestSort('newest');
          }}
          disabled={myPendingExpenseRequestRows.length === 0}
          className="mt-4 rounded-2xl p-4"
          style={{ ...colors.getCardStyle(), opacity: myPendingExpenseRequestRows.length === 0 ? 0.6 : 1 }}
        >
          <View className="flex-row items-center justify-between" style={{ gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text.primary }} className="text-base font-semibold">
                Pending Approvals
              </Text>
              <Text style={{ color: colors.text.tertiary }} className="text-xs mt-1">
                Expenses waiting for admin approval.
              </Text>
            </View>
            <View
              className="rounded-full items-center justify-center"
              style={{
                width: 30,
                height: 30,
                borderWidth: 1,
                borderColor: pendingBadgeBorder,
                backgroundColor: pendingBadgeBg,
              }}
            >
              <Text style={{ color: pendingBadgeText, fontSize: 13, fontWeight: '700' }}>{myPendingExpenseRequestRows.length > 9 ? '9+' : myPendingExpenseRequestRows.length}</Text>
            </View>
          </View>
        </Pressable>
        {renderTotalsInfoNote(
          'Top cards use the selected period. Amount beside filter icon sums your visible requests after search and filters.',
          financeSectionControlsMargin
        )}

        {isWebDesktop ? (
          <View className="flex-row items-center" style={{ gap: 12, marginTop: financeSectionControlsMargin }}>
            <View
              className="flex-row items-center rounded-full px-3"
              style={{
                height: 40,
                width: 280,
                borderWidth: 1,
                borderColor: colors.divider,
                backgroundColor: 'transparent',
              }}
            >
              <Search size={15} color={colors.text.muted} strokeWidth={2} />
              <TextInput
                value={expenseSearchQuery}
                onChangeText={setExpenseSearchQuery}
                placeholder="Search expenses"
                placeholderTextColor={colors.text.muted}
                style={{ flex: 1, marginLeft: 8, color: colors.text.primary, fontSize: 14 }}
              />
            </View>
            <View style={{ flex: 1 }} />
            <Text style={{ color: colors.text.primary }} className="text-lg font-semibold">
              {formatCurrency(filteredMyExpenseRequestTotal)}
            </Text>
            <View style={{ position: 'relative' }}>
              {expenseRequestFilterSortCount > 0 ? (
                <View
                  className="rounded-full items-center justify-center"
                  style={{
                    position: 'absolute',
                    right: 1,
                    top: -6,
                    minWidth: 16,
                    height: 16,
                    paddingHorizontal: 4,
                    backgroundColor: colors.bar,
                    zIndex: 2,
                  }}
                >
                  <Text style={{ color: colors.bg.screen, fontSize: 9, fontWeight: '700' }}>
                    {expenseRequestFilterSortCount > 9 ? '9+' : expenseRequestFilterSortCount}
                  </Text>
                </View>
              ) : null}
              <Pressable
                onPress={() => setShowExpenseRequestFilterSheet(true)}
                className="rounded-full items-center justify-center"
                style={{
                  width: 40,
                  height: 40,
                  borderWidth: 1,
                  borderColor: colors.divider,
                  backgroundColor: 'transparent',
                }}
              >
                <Filter
                  size={16}
                  color={expenseRequestFilterSortCount > 0 ? colors.bar : colors.text.tertiary}
                  strokeWidth={2}
                />
              </Pressable>
            </View>
          </View>
        ) : isMobile ? (
          <View style={{ gap: 10, marginTop: financeSectionControlsMargin }}>
            <View className="flex-row items-center" style={{ gap: 10 }}>
              <View
                className="flex-row items-center rounded-full px-3"
                style={{
                  height: 40,
                  flex: 1,
                  borderWidth: 1,
                  borderColor: colors.divider,
                  backgroundColor: 'transparent',
                }}
              >
                <Search size={15} color={colors.text.muted} strokeWidth={2} />
                <TextInput
                  value={expenseSearchQuery}
                  onChangeText={setExpenseSearchQuery}
                  placeholder="Search expenses"
                  placeholderTextColor={colors.text.muted}
                  style={{ flex: 1, marginLeft: 8, color: colors.text.primary, fontSize: 14 }}
                />
              </View>
              <View style={{ position: 'relative' }}>
                {expenseRequestFilterSortCount > 0 ? (
                  <View
                    className="rounded-full items-center justify-center"
                    style={{
                      position: 'absolute',
                      right: 1,
                      top: -6,
                      minWidth: 16,
                      height: 16,
                      paddingHorizontal: 4,
                      backgroundColor: colors.bar,
                      zIndex: 2,
                    }}
                  >
                    <Text style={{ color: colors.bg.screen, fontSize: 9, fontWeight: '700' }}>
                      {expenseRequestFilterSortCount > 9 ? '9+' : expenseRequestFilterSortCount}
                    </Text>
                  </View>
                ) : null}
                <Pressable
                  onPress={() => setShowExpenseRequestFilterSheet(true)}
                  className="items-center justify-center"
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    borderColor: colors.divider,
                  }}
                >
                  <Filter
                    size={16}
                    color={expenseRequestFilterSortCount > 0 ? colors.bar : colors.text.tertiary}
                    strokeWidth={2}
                  />
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          <View style={{ gap: 10, marginTop: financeSectionControlsMargin }}>
            <View className="flex-row items-center" style={{ gap: 10 }}>
              <View
                className="flex-row items-center rounded-full px-3"
                style={{
                  height: 40,
                  flex: 1,
                  borderWidth: 1,
                  borderColor: colors.divider,
                  backgroundColor: 'transparent',
                }}
              >
                <Search size={15} color={colors.text.muted} strokeWidth={2} />
                <TextInput
                  value={expenseSearchQuery}
                  onChangeText={setExpenseSearchQuery}
                  placeholder="Search expenses"
                  placeholderTextColor={colors.text.muted}
                  style={{ flex: 1, marginLeft: 8, color: colors.text.primary, fontSize: 14 }}
                />
              </View>
              <Text style={{ color: colors.text.primary }} className="text-lg font-semibold">
                {formatCurrency(filteredMyExpenseRequestTotal)}
              </Text>
              <View style={{ position: 'relative' }}>
                {expenseRequestFilterSortCount > 0 ? (
                  <View
                    className="rounded-full items-center justify-center"
                    style={{
                      position: 'absolute',
                      right: 1,
                      top: -6,
                      minWidth: 16,
                      height: 16,
                      paddingHorizontal: 4,
                      backgroundColor: colors.bar,
                      zIndex: 2,
                    }}
                  >
                    <Text style={{ color: colors.bg.screen, fontSize: 9, fontWeight: '700' }}>
                      {expenseRequestFilterSortCount > 9 ? '9+' : expenseRequestFilterSortCount}
                    </Text>
                  </View>
                ) : null}
                <Pressable
                  onPress={() => setShowExpenseRequestFilterSheet(true)}
                  className="items-center justify-center"
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    borderColor: colors.divider,
                  }}
                >
                  <Filter
                    size={16}
                    color={expenseRequestFilterSortCount > 0 ? colors.bar : colors.text.tertiary}
                    strokeWidth={2}
                  />
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {!isMobile ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, marginTop: 10 }}
          >
            {expenseRequestFilterOptions.map((option) => (
              <FinanceFilterPill
                key={option.key}
                label={option.label}
                active={expenseRequestFilter === option.key}
                onPress={() => setExpenseRequestFilter(option.key)}
                colors={colors}
              />
            ))}
          </ScrollView>
        ) : null}

        <View
          style={{
            marginTop: financeSectionBodyMargin,
            borderWidth: 1,
            borderColor: colors.divider,
            borderRadius: 16,
            overflow: 'hidden',
            backgroundColor: colors.bg.card,
          }}
        >
          {isWebDesktop ? (
            <View style={{ borderBottomWidth: 1, borderBottomColor: colors.divider }}>
              <View className="grid grid-cols-12 items-center px-3 py-3" style={{ columnGap: 12 } as any}>
                <Text style={{ color: colors.text.muted }} className="col-span-2 text-xs font-semibold uppercase">Name</Text>
                <Text style={{ color: colors.text.muted }} className="col-span-2 text-xs font-semibold uppercase">Supplier/Merchant</Text>
                <Text style={{ color: colors.text.muted }} className="col-span-2 text-xs font-semibold uppercase">Category</Text>
                <Text style={{ color: colors.text.muted }} className="col-span-2 text-xs font-semibold uppercase">Date</Text>
                <Text style={{ color: colors.text.muted, textAlign: 'right', paddingRight: 8 }} className="col-span-2 text-xs font-semibold uppercase">Amount</Text>
                <Text style={{ color: colors.text.muted }} className="col-span-1 text-xs font-semibold uppercase">Status</Text>
                <View className="col-span-1" />
              </View>
            </View>
          ) : null}

          {filteredMyExpenseRequestRows.length === 0 ? (
            <View className="items-center justify-center py-12">
              <Text style={{ color: colors.text.tertiary }} className="text-base">No expenses found</Text>
            </View>
          ) : filteredMyExpenseRequestRows.map((request, index) => (
            <Pressable
              key={request.id}
              className={isWebDesktop ? '' : 'px-4 py-3.5'}
              style={{
                borderBottomWidth: index === filteredMyExpenseRequestRows.length - 1 ? 0 : 1,
                borderBottomColor: colors.divider,
                backgroundColor: isWebDesktop && request.approvedExpenseId && request.approvedExpenseId === selectedExpenseId
                  ? colors.bg.input
                  : 'transparent',
                borderLeftWidth: isWebDesktop && request.approvedExpenseId && request.approvedExpenseId === selectedExpenseId ? 3 : 0,
                borderLeftColor: colors.bar,
              }}
              onPress={() => {
                const approvedExpenseId = request.approvedExpenseId ?? '';
                const hasLinkedApprovedExpense = Boolean(
                  approvedExpenseId && expenses.some((expense) => expense.id === approvedExpenseId)
                );

                if (isWebDesktop) {
                  if (hasLinkedApprovedExpense) {
                    setSelectedExpenseId(approvedExpenseId);
                    return;
                  }
                }

                if (hasLinkedApprovedExpense) {
                  router.push({ pathname: '/expense/[id]', params: { id: approvedExpenseId } } as any);
                  return;
                }

                setSelectedExpenseId(null);
                if (request.status === 'draft' || request.status === 'submitted' || request.status === 'rejected') {
                  openExpenseRequestEditor(request.id);
                  return;
                }

                // Fallback: still open the request editor to avoid dead taps
                // if an approved request is missing a linked expense id.
                openExpenseRequestEditor(request.id);
              }}
            >
              {isWebDesktop ? (
                <View className="grid grid-cols-12 items-center px-3 py-3.5" style={{ columnGap: 12 } as any}>
                  <View className="col-span-2" style={{ minWidth: 0 }}>
                    <Text style={{ color: colors.text.primary }} className="text-sm font-semibold" numberOfLines={1} ellipsizeMode="tail">
                      {request.name}
                    </Text>
                    {request.rejectionReason ? (
                      <Text style={{ color: colors.danger }} className="text-xs mt-0.5" numberOfLines={1}>
                        {request.rejectionReason}
                      </Text>
                    ) : null}
                  </View>

                  <Text style={{ color: colors.text.secondary }} className="col-span-2 text-sm" numberOfLines={1}>
                    {request.merchant || '—'}
                  </Text>

                  <Text style={{ color: colors.text.secondary }} className="col-span-2 text-sm" numberOfLines={1}>
                    {request.category}
                  </Text>

                  <Text style={{ color: colors.text.secondary }} className="col-span-2 text-sm" numberOfLines={1}>
                    {request.date}
                  </Text>

                  <Text style={{ color: colors.text.primary, textAlign: 'right', paddingRight: 8 }} className="col-span-2 text-sm font-semibold" numberOfLines={1}>
                    {formatCurrency(request.amount)}
                  </Text>

                  <View className="col-span-1">
                    <StatusBadge
                      label={formatManagerExpenseRequestStatusLabel(request)}
                      colors={colors}
                      compact
                      maxWidth={104}
                    />
                  </View>

                  <View className="col-span-1 items-end">
                    <Text style={{ color: colors.text.muted }} className="text-xs">—</Text>
                  </View>
                </View>
              ) : (
                <View className="flex-row items-start justify-between" style={{ gap: 12 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: colors.text.primary }} className="text-base font-semibold" numberOfLines={1}>
                      {request.name}
                    </Text>
                    <Text style={{ color: colors.text.secondary }} className="text-sm mt-1" numberOfLines={1}>
                      {request.category}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', minWidth: 120 }}>
                    <Text style={{ color: colors.text.primary }} className="text-base font-semibold" numberOfLines={1}>
                      {formatCurrency(request.amount)}
                    </Text>
                    <View className="flex-row items-center mt-1" style={{ gap: 6 }}>
                      <StatusBadge
                        label={formatManagerExpenseRequestStatusLabel(request)}
                        colors={colors}
                        compact
                        maxWidth={92}
                      />
                      <Text style={{ color: colors.text.secondary }} className="text-xs" numberOfLines={1}>
                        {request.date}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );

  const renderProcurementTopCards = () => {
    const cardStats = isFinanceApprover ? procurementPeriodStats : managerSubmittedProcurementPeriodStats;
    const periodPills = (
      <View style={{ marginTop: isWebDesktop ? 0 : 16 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {overviewRangeOptions.map((option) => (
            <FinanceFilterPill
              key={option.key}
              label={option.label}
              active={procurementPeriod === option.key}
              onPress={() => setProcurementPeriod(option.key)}
              colors={colors}
            />
          ))}
        </ScrollView>
      </View>
    );

    if (isWebDesktop) {
      return (
        <>
          {periodPills}
          <View className="mt-4" style={{ flexDirection: 'row', gap: 12 }}>
            <FinanceMetricCard
              label="Procurement Total"
              value={formatCurrency(cardStats.total)}
              helper={procurementPeriodWindow.label}
              helperTone="neutral"
              trendPlacement="right"
              compactTrend={isCompactLayout}
              valueFontSize={24}
              colors={colors}
            />
            <FinanceMetricCard
              label="Entries"
              value={cardStats.count.toLocaleString()}
              helper={procurementPeriodWindow.label}
              helperTone="neutral"
              trendPlacement="right"
              compactTrend={isCompactLayout}
              valueFontSize={24}
              colors={colors}
            />
          </View>
        </>
      );
    }

    if (isMobile) {
      return (
        <View className="mt-4" style={{ flexDirection: 'row', gap: 12 }}>
          <FinanceMetricCard
            label="Procurement Total"
            value={formatCurrency(cardStats.total)}
            helper={procurementPeriodWindow.label}
            helperTone="neutral"
            trendPlacement="right"
            compactTrend={isCompactLayout}
            valueFontSize={20}
            colors={colors}
          />
          <FinanceMetricCard
            label="Entries"
            value={cardStats.count.toLocaleString()}
            helper={procurementPeriodWindow.label}
            helperTone="neutral"
            trendPlacement="right"
            compactTrend={isCompactLayout}
            valueFontSize={20}
            colors={colors}
          />
        </View>
      );
    }

    return (
      <>
        {periodPills}
        <View className="mt-4" style={{ flexDirection: 'row', gap: 12 }}>
          <FinanceMetricCard
            label="Procurement Total"
            value={formatCurrency(cardStats.total)}
            helper={procurementPeriodWindow.label}
            helperTone="neutral"
            trendPlacement="right"
            compactTrend={isCompactLayout}
            valueFontSize={20}
            colors={colors}
          />
          <FinanceMetricCard
            label="Entries"
            value={cardStats.count.toLocaleString()}
            helper={procurementPeriodWindow.label}
            helperTone="neutral"
            trendPlacement="right"
            compactTrend={isCompactLayout}
            valueFontSize={20}
            colors={colors}
          />
        </View>
      </>
    );
  };

  const renderOverview = () => (
    isWebDesktop ? (
      <>
        <View className="mt-4">
          <BreakdownTable
            title="Financial Breakdown"
            data={overviewBreakdownRows}
            columns={{ label: 'Metric', value: 'Amount' }}
          />
        </View>

        <View className="mt-4" style={{ flexDirection: 'row', gap: 12 }}>
          <View style={[{ flex: 1 }, colors.getCardStyle()]} className="rounded-2xl p-5">
            <Text style={{ color: colors.text.primary }} className="text-lg font-bold mb-4">
              Revenue trend (6 months)
            </Text>
            <InteractiveLineChart
              data={revenueTrendData}
              height={230}
              lineColor={colors.bar}
              gridColor={colors.divider}
              textColor={colors.text.tertiary}
              formatYLabel={formatAxisCurrency}
            />
          </View>

          <View style={[{ flex: 1 }, colors.getCardStyle()]} className="rounded-2xl p-5">
            <Text style={{ color: colors.text.primary }} className="text-lg font-bold mb-4">
              Outflow trend (expenses + procurement)
            </Text>
            <SalesBarChart
              data={outflowTrendData}
              height={230}
              barColor={colors.bar}
              gridColor={colors.divider}
              textColor={colors.text.tertiary}
              showTopValue={false}
            />
          </View>
        </View>

        <View className="mt-4" style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <BreakdownTable
              title="Monthly net snapshot"
              data={monthlySnapshotRows}
              columns={{ label: 'Month', value: 'Net' }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <BreakdownTable
              title="Expenses by category"
              data={overviewFinancials.expenseByCategoryRows}
              columns={{ label: 'Category', value: 'Amount', percentage: 'Share' }}
              emptyMessage="No expenses recorded yet"
            />
          </View>
        </View>
      </>
    ) : (
      <>
        <View className="mt-4">
          <BreakdownTable
            title="Financial Breakdown"
            data={overviewBreakdownRows}
            columns={{ label: 'Metric', value: 'Amount' }}
          />
        </View>

        <View className="mt-4 rounded-2xl p-5" style={colors.getCardStyle()}>
          <Text style={{ color: colors.text.primary }} className="text-lg font-bold mb-4">
            Revenue trend (6 months)
          </Text>
          <InteractiveLineChart
            data={revenueTrendData}
            height={230}
            lineColor={colors.bar}
            gridColor={colors.divider}
            textColor={colors.text.tertiary}
            formatYLabel={formatAxisCurrency}
          />
        </View>

        <View className="mt-4 rounded-2xl p-5" style={colors.getCardStyle()}>
          <Text style={{ color: colors.text.primary }} className="text-lg font-bold mb-4">
            Outflow trend (expenses + procurement)
          </Text>
          <SalesBarChart
            data={outflowTrendData}
            height={220}
            barColor={colors.bar}
            gridColor={colors.divider}
            textColor={colors.text.tertiary}
            showTopValue={false}
          />
        </View>

        <View className="mt-4">
          <BreakdownTable
            title="Expenses by category"
            data={overviewFinancials.expenseByCategoryRows}
            columns={{ label: 'Category', value: 'Amount', percentage: 'Share' }}
            emptyMessage="No expenses recorded yet"
          />
        </View>

        <View className="mt-4">
          <BreakdownTable
            title="Monthly net snapshot"
            data={monthlySnapshotRows}
            columns={{ label: 'Month', value: 'Net' }}
          />
        </View>
      </>
    )
  );

  const renderExpenses = () => (
    <View style={isWebDesktop ? { maxWidth: 1440, width: '100%', alignSelf: 'flex-start' } : undefined}>
      <View style={{ marginTop: financeSectionTopMargin }}>
        {!isWebDesktop ? (
          <View className="flex-row items-start justify-between" style={{ gap: 12 }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: colors.text.primary }} className="text-2xl font-bold">Expenses</Text>
              <Text style={{ color: colors.text.tertiary }} className="text-sm mt-1">Track one-time and recurring costs</Text>
            </View>
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  openExpenseComposer();
                }}
                className="rounded-full active:opacity-80 px-3.5 flex-row items-center"
                style={{ height: 40, backgroundColor: colors.bar }}
              >
                <Plus size={18} color={colors.bg.screen} strokeWidth={2.5} />
                <Text style={{ color: colors.bg.screen }} className="font-semibold ml-1.5 text-sm">Add Expense</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {renderExpenseTopCards()}
        {isFinanceApprover && isWebDesktop ? (
          <View className="flex-row items-center" style={{ gap: 8, marginTop: financeSectionControlsMargin }}>
            <Pressable
              onPress={() => setExpenseWorkspaceView('list')}
              className="rounded-full px-4 flex-row items-center justify-center"
              style={{
                height: 36,
                borderWidth: 1,
                borderColor: expenseWorkspaceView === 'list' ? colors.bar : colors.divider,
                backgroundColor: expenseWorkspaceView === 'list' ? colors.bar : 'transparent',
              }}
            >
              <Text style={{ color: expenseWorkspaceView === 'list' ? colors.bg.screen : colors.text.secondary }} className="text-sm font-semibold">
                Expenses
              </Text>
            </Pressable>
            <Pressable
              onPress={() => openExpenseApprovalWorkspace()}
              className="rounded-full px-3.5 flex-row items-center justify-center"
              style={{
                height: 36,
                borderWidth: 1,
                borderColor: expenseWorkspaceView === 'approvals' ? pendingBadgeBorder : colors.divider,
                backgroundColor: expenseWorkspaceView === 'approvals' ? pendingBadgeBg : 'transparent',
                gap: 8,
              }}
            >
              <Text
                style={{ color: expenseWorkspaceView === 'approvals' ? pendingBadgeText : colors.text.secondary }}
                className="text-sm font-semibold"
              >
                Pending Approvals
              </Text>
              <View
                className="rounded-full items-center justify-center"
                style={{
                  minWidth: 22,
                  height: 22,
                  paddingHorizontal: 6,
                  backgroundColor: pendingBadgeSolid,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
                  {pendingExpenseApprovalRows.length > 99 ? '99+' : pendingExpenseApprovalRows.length}
                </Text>
              </View>
            </Pressable>
          </View>
        ) : null}
        {isFinanceApprover && !isWebDesktop ? renderOwnerExpenseApprovalQueue() : null}
        {renderTotalsInfoNote(
          'Top cards use the selected period. Amount beside filter icon sums the visible list after search and filters.',
          financeSectionControlsMargin
        )}

            {isWebDesktop ? (
              <View className="flex-row items-center" style={{ gap: 12, marginTop: financeSectionControlsMargin }}>
                <View
                  className="flex-row items-center rounded-full px-3"
                  style={{
                    height: 40,
                    width: 280,
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    borderColor: colors.divider,
                  }}
                >
                  <Search size={15} color={colors.text.muted} strokeWidth={2} />
                  <TextInput
                    value={expenseSearchQuery}
                    onChangeText={setExpenseSearchQuery}
                    placeholder="Search expenses"
                    placeholderTextColor={colors.text.muted}
                    style={{ flex: 1, marginLeft: 8, color: colors.text.primary, fontSize: 14 }}
                  />
                </View>
                <View style={{ flex: 1 }} />
                <Text style={{ color: colors.text.primary }} className="text-xl font-semibold">
                  {formatCurrency(filteredExpensesTotal)}
                </Text>
                <View style={{ position: 'relative' }}>
                  {expenseFilterSortCount > 0 ? (
                    <View
                      className="rounded-full items-center justify-center"
                      style={{
                        position: 'absolute',
                        right: 1,
                        top: -6,
                        minWidth: 16,
                        height: 16,
                        paddingHorizontal: 4,
                        backgroundColor: colors.bar,
                        zIndex: 2,
                      }}
                    >
                      <Text style={{ color: colors.bg.screen, fontSize: 9, fontWeight: '700' }}>
                        {expenseFilterSortCount > 9 ? '9+' : expenseFilterSortCount}
                      </Text>
                    </View>
                  ) : null}
                  <Pressable
                    onPress={() => setShowExpenseFilterSheet(true)}
                    className="rounded-full items-center justify-center"
                    style={{
                      width: 40,
                      height: 40,
                      borderWidth: 1,
                      borderColor: colors.divider,
                      backgroundColor: 'transparent',
                    }}
                  >
                    <Filter
                      size={16}
                      color={expenseFilterSortCount > 0 ? colors.bar : colors.text.tertiary}
                      strokeWidth={2}
                    />
                  </Pressable>
                </View>
              </View>
            ) : isMobile ? (
              <View style={{ gap: 10, marginTop: financeSectionControlsMargin }}>
                <View className="flex-row items-center" style={{ gap: 10 }}>
                  <View
                    className="flex-row items-center rounded-full px-3"
                    style={{
                      flex: 1,
                      height: 40,
                      backgroundColor: 'transparent',
                      borderWidth: 1,
                      borderColor: colors.divider,
                    }}
                  >
                    <Search size={15} color={colors.text.muted} strokeWidth={2} />
                    <TextInput
                      value={expenseSearchQuery}
                      onChangeText={setExpenseSearchQuery}
                      placeholder="Search expenses"
                      placeholderTextColor={colors.text.muted}
                      style={{ flex: 1, marginLeft: 8, color: colors.text.primary, fontSize: 14 }}
                    />
                  </View>
                  <View style={{ position: 'relative' }}>
                    {expenseFilterSortCount > 0 ? (
                      <View
                        className="rounded-full items-center justify-center"
                        style={{
                          position: 'absolute',
                          right: 1,
                          top: -6,
                          minWidth: 16,
                          height: 16,
                          paddingHorizontal: 4,
                          backgroundColor: colors.bar,
                          zIndex: 2,
                        }}
                      >
                        <Text style={{ color: colors.bg.screen, fontSize: 9, fontWeight: '700' }}>
                          {expenseFilterSortCount > 9 ? '9+' : expenseFilterSortCount}
                        </Text>
                      </View>
                    ) : null}
                    <Pressable
                      onPress={() => setShowExpenseFilterSheet(true)}
                      className="items-center justify-center"
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: 'transparent',
                        borderWidth: 1,
                        borderColor: colors.divider,
                      }}
                    >
                      <Filter
                        size={16}
                        color={expenseFilterSortCount > 0 ? colors.bar : colors.text.tertiary}
                        strokeWidth={2}
                      />
                    </Pressable>
                  </View>
                </View>
              </View>
            ) : (
              <View style={{ gap: 10, marginTop: financeSectionControlsMargin }}>
                <View className="flex-row items-center" style={{ gap: 10 }}>
                  <View
                    className="flex-row items-center rounded-full px-3"
                    style={{
                      height: 40,
                      flex: 1,
                      backgroundColor: 'transparent',
                      borderWidth: 1,
                      borderColor: colors.divider,
                    }}
                  >
                    <Search size={15} color={colors.text.muted} strokeWidth={2} />
                    <TextInput
                      value={expenseSearchQuery}
                      onChangeText={setExpenseSearchQuery}
                      placeholder="Search expenses"
                      placeholderTextColor={colors.text.muted}
                      style={{ flex: 1, marginLeft: 8, color: colors.text.primary, fontSize: 14 }}
                    />
                  </View>
                  <Text style={{ color: colors.text.primary }} className="text-xl font-semibold">
                    {formatCurrency(filteredExpensesTotal)}
                  </Text>
                  <View style={{ position: 'relative' }}>
                    {expenseFilterSortCount > 0 ? (
                      <View
                        className="rounded-full items-center justify-center"
                        style={{
                          position: 'absolute',
                          right: 1,
                          top: -6,
                          minWidth: 16,
                          height: 16,
                          paddingHorizontal: 4,
                          backgroundColor: colors.bar,
                          zIndex: 2,
                        }}
                      >
                        <Text style={{ color: colors.bg.screen, fontSize: 9, fontWeight: '700' }}>
                          {expenseFilterSortCount > 9 ? '9+' : expenseFilterSortCount}
                        </Text>
                      </View>
                    ) : null}
                    <Pressable
                      onPress={() => setShowExpenseFilterSheet(true)}
                      className="rounded-full items-center justify-center"
                      style={{
                        width: 40,
                        height: 40,
                        borderWidth: 1,
                        borderColor: colors.divider,
                        backgroundColor: 'transparent',
                      }}
                    >
                      <Filter
                        size={16}
                        color={expenseFilterSortCount > 0 ? colors.bar : colors.text.tertiary}
                        strokeWidth={2}
                      />
                    </Pressable>
                  </View>
                </View>
              </View>
            )}

          <View
            style={{
              marginTop: financeSectionBodyMargin,
              borderWidth: 1,
              borderColor: colors.divider,
              borderRadius: 16,
              overflow: 'visible',
              backgroundColor: colors.bg.card,
              width: '100%',
            }}
          >
            {isWebDesktop ? (
              <View style={{ borderBottomWidth: 1, borderBottomColor: colors.divider }}>
                <View className="grid grid-cols-12 items-center px-3 py-3" style={{ columnGap: 12 } as any}>
                  <Text style={{ color: colors.text.muted }} className="col-span-2 text-xs font-semibold uppercase">Name</Text>
                  <Text style={{ color: colors.text.muted }} className="col-span-2 text-xs font-semibold uppercase">Supplier/Merchant</Text>
                  <Text style={{ color: colors.text.muted }} className="col-span-2 text-xs font-semibold uppercase">Category</Text>
                  <Text style={{ color: colors.text.muted }} className="col-span-2 text-xs font-semibold uppercase">Type</Text>
                  <Text style={{ color: colors.text.muted }} className="col-span-2 text-xs font-semibold uppercase">Date</Text>
                  <Text style={{ color: colors.text.muted, textAlign: 'right' }} className="col-span-1 text-xs font-semibold uppercase">Amount</Text>
                  <View className="col-span-1" />
                </View>
              </View>
            ) : null}

            {filteredExpenseRows.length === 0 ? (
              <View className="items-center justify-center py-12">
                <Text style={{ color: colors.text.tertiary }} className="text-base">No expenses found</Text>
              </View>
            ) : filteredExpenseRows.map((expense, index) => (
              <Pressable
                key={expense.id}
                onPress={() => {
                  if (isMobile) {
                    router.push({ pathname: '/expense/[id]', params: { id: expense.id } } as any);
                  } else {
                    setSelectedExpenseId(expense.id);
                  }
                }}
                style={{
                  borderBottomWidth: index === filteredExpenseRows.length - 1 ? 0 : 1,
                  borderBottomColor: colors.divider,
                  position: 'relative',
                  zIndex: expenseActionMenuId === expense.id ? 40 : 1,
                  backgroundColor: selectedExpenseId === expense.id ? colors.bg.input : 'transparent',
                  borderLeftWidth: selectedExpenseId === expense.id ? 3 : 0,
                  borderLeftColor: colors.bar,
                }}
              >
                {isWebDesktop ? (
                  <View className="grid grid-cols-12 items-center px-3 py-3.5" style={{ columnGap: 12 } as any}>
                    <View className="col-span-2 flex-row items-center" style={{ gap: 8, minWidth: 0 }}>
                      <Receipt size={16} color={colors.text.tertiary} strokeWidth={2} />
                      <View style={{ minWidth: 0, flex: 1 }}>
                        <Text style={{ color: colors.text.primary }} className="text-sm font-normal" numberOfLines={1} ellipsizeMode="tail">
                          {expense.name}
                        </Text>
                      </View>
                    </View>

                    <Text style={{ color: colors.text.secondary }} className="col-span-2 text-sm" numberOfLines={1}>
                      {expense.merchant || '—'}
                    </Text>

                    <Text style={{ color: colors.text.secondary }} className="col-span-2 text-sm" numberOfLines={1}>
                      {expense.category}
                    </Text>

                    <View className="col-span-2" style={{ paddingRight: 8 }}>
                      <StatusBadge label={formatExpenseTypeLabel(expense.type)} colors={colors} maxWidth={112} />
                    </View>

                    <Text style={{ color: colors.text.secondary }} className="col-span-2 text-sm" numberOfLines={1}>
                      {expense.date}
                    </Text>

                    <Text style={{ color: colors.text.primary, textAlign: 'right' }} className="col-span-1 text-sm font-normal" numberOfLines={1}>
                      {formatCurrency(expense.amount)}
                    </Text>

                    <View className="col-span-1 items-end">
                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation();
                          setExpenseActionMenuId((current) => (current === expense.id ? null : expense.id));
                        }}
                        className="p-1.5 rounded-md"
                        style={{ backgroundColor: expenseActionMenuId === expense.id ? colors.bg.input : 'transparent' }}
                      >
                        <MoreVertical size={16} color={colors.text.tertiary} strokeWidth={2} />
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View style={{ paddingHorizontal: 12, paddingVertical: 12 }}>
                    <View className="flex-row items-start justify-between" style={{ gap: 12 }}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ color: colors.text.primary }} className="text-base font-normal" numberOfLines={1}>
                          {expense.name}
                        </Text>
                        <Text style={{ color: colors.text.secondary }} className="text-sm mt-1" numberOfLines={1}>
                          {expense.category}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', minWidth: 120 }}>
                        <Text style={{ color: colors.text.primary }} className="text-base font-normal" numberOfLines={1}>
                          {formatCurrency(expense.amount)}
                        </Text>
                        <View className="flex-row items-center mt-1" style={{ gap: 6 }}>
                          <StatusBadge label={formatExpenseTypeLabel(expense.type)} colors={colors} compact maxWidth={92} />
                          <Text style={{ color: colors.text.secondary }} className="text-xs" numberOfLines={1}>
                            {expense.date}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                )}

                {!isMobile && expenseActionMenuId === expense.id ? (
                  <View
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: 42,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colors.divider,
                      backgroundColor: colors.bg.card,
                      zIndex: 50,
                      minWidth: 140,
                      overflow: 'hidden',
                    }}
                  >
                    <Pressable
                      onPress={(event) => {
                        event.stopPropagation();
                        openExpenseEditor(expense.id);
                      }}
                      className="px-3 py-2.5"
                      style={{ borderBottomWidth: 1, borderBottomColor: colors.divider }}
                    >
                      <Text style={{ color: colors.text.primary }} className="text-sm font-medium">Edit Expense</Text>
                    </Pressable>
                    <Pressable
                      onPress={(event) => {
                        event.stopPropagation();
                        setExpenseActionMenuId(null);
                        handleDeleteExpense(expense.id);
                      }}
                      className="px-3 py-2.5"
                    >
                      <Text style={{ color: colors.danger }} className="text-sm font-medium">Delete Expense</Text>
                    </Pressable>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>

          {!isMobile && expenseActionMenuId ? (
            <Pressable
              onPress={() => setExpenseActionMenuId(null)}
              style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 25 }}
            />
          ) : null}
      </View>
    </View>
  );

  const renderProcurement = () => (
    <View style={isWebDesktop ? { maxWidth: 1440, width: '100%', alignSelf: 'flex-start' } : undefined}>
      <View style={{ marginTop: financeSectionTopMargin }}>
        {!isWebDesktop ? (
          <View className="flex-row items-start justify-between" style={{ gap: 12 }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: colors.text.primary }} className="text-2xl font-bold">Procurement</Text>
              <Text
                style={{
                  color: colors.text.tertiary,
                  maxWidth: isMobile ? 190 : undefined,
                  lineHeight: 18,
                }}
                className="text-sm mt-1"
              >
                Manage purchase orders and supplier spend
              </Text>
            </View>

            {canCreateProcurementRequest ? (
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  openProcurementComposer();
                }}
                className="rounded-full active:opacity-80 px-3.5 flex-row items-center"
                style={{ height: 40, backgroundColor: colors.bar }}
              >
                <Plus size={18} color={colors.bg.screen} strokeWidth={2.5} />
                <Text style={{ color: colors.bg.screen }} className="font-semibold ml-1.5 text-sm">New PO</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {renderProcurementTopCards()}
        {isFinanceApprover && !isWebDesktop ? renderOwnerProcurementApprovalQueue() : null}

        {isFinanceApprover && isWebDesktop ? (
          <View className="flex-row items-center" style={{ gap: 8, marginTop: financeSectionControlsMargin }}>
            <Pressable
              onPress={() => setProcurementWorkspaceView('list')}
              className="rounded-full px-4 flex-row items-center justify-center"
              style={{
                height: 36,
                borderWidth: 1,
                borderColor: procurementWorkspaceView === 'list' ? colors.bar : colors.divider,
                backgroundColor: procurementWorkspaceView === 'list' ? colors.bar : 'transparent',
              }}
            >
              <Text style={{ color: procurementWorkspaceView === 'list' ? colors.bg.screen : colors.text.secondary }} className="text-sm font-semibold">
                Procurement
              </Text>
            </Pressable>
            <Pressable
              onPress={() => openProcurementApprovalWorkspace()}
              className="rounded-full px-3.5 flex-row items-center justify-center"
              style={{
                height: 36,
                borderWidth: 1,
                borderColor: procurementWorkspaceView === 'approvals' ? pendingBadgeBorder : colors.divider,
                backgroundColor: procurementWorkspaceView === 'approvals' ? pendingBadgeBg : 'transparent',
                gap: 8,
              }}
            >
              <Text style={{ color: procurementWorkspaceView === 'approvals' ? pendingBadgeText : colors.text.secondary }} className="text-sm font-semibold">
                Pending Approvals
              </Text>
              <View
                className="rounded-full items-center justify-center"
                style={{ minWidth: 22, height: 22, paddingHorizontal: 6, backgroundColor: pendingBadgeSolid }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
                  {pendingProcurementApprovalRows.length > 99 ? '99+' : pendingProcurementApprovalRows.length}
                </Text>
              </View>
            </Pressable>
          </View>
        ) : null}
        {renderTotalsInfoNote(
          'Top cards use the selected period by Date Paid. Amount beside filter icon sums the visible list after search and filters.',
          financeSectionControlsMargin
        )}

        {isWebDesktop ? (
          <View className="flex-row items-center" style={{ gap: 12, marginTop: isFinanceApprover ? 8 : financeSectionControlsMargin }}>
            <View
              className="flex-row items-center rounded-full px-3"
              style={{
                height: 40,
                width: 280,
                backgroundColor: 'transparent',
                borderWidth: 1,
                borderColor: colors.divider,
              }}
            >
              <Search size={15} color={colors.text.muted} strokeWidth={2} />
              <TextInput
                value={procurementSearchQuery}
                onChangeText={setProcurementSearchQuery}
                placeholder="Search procurement"
                placeholderTextColor={colors.text.muted}
                style={{ flex: 1, marginLeft: 8, color: colors.text.primary, fontSize: 14 }}
              />
            </View>
            <View style={{ flex: 1 }} />
            <Text style={{ color: colors.text.primary }} className="text-xl font-semibold">
              {formatCurrency(filteredProcurementTotal)}
            </Text>
            <View style={{ position: 'relative' }}>
              {procurementFilterSortCount > 0 ? (
                <View
                  className="rounded-full items-center justify-center"
                  style={{
                    position: 'absolute',
                    right: 1,
                    top: -6,
                    minWidth: 16,
                    height: 16,
                    paddingHorizontal: 4,
                    backgroundColor: colors.bar,
                    zIndex: 2,
                  }}
                >
                  <Text style={{ color: colors.bg.screen, fontSize: 9, fontWeight: '700' }}>
                    {procurementFilterSortCount > 9 ? '9+' : procurementFilterSortCount}
                  </Text>
                </View>
              ) : null}
              <Pressable
                onPress={() => setShowProcurementFilterSheet(true)}
                className="rounded-full items-center justify-center"
                style={{
                  width: 40,
                  height: 40,
                  borderWidth: 1,
                  borderColor: colors.divider,
                  backgroundColor: 'transparent',
                }}
              >
                <Filter
                  size={16}
                  color={procurementFilterSortCount > 0 ? colors.bar : colors.text.tertiary}
                  strokeWidth={2}
                />
              </Pressable>
            </View>
          </View>
        ) : isMobile ? (
          <View style={{ gap: 10, marginTop: financeSectionControlsMargin }}>
            <View className="flex-row items-center" style={{ gap: 10 }}>
              <View
                className="flex-row items-center rounded-full px-3"
                style={{
                  flex: 1,
                  height: 40,
                  backgroundColor: 'transparent',
                  borderWidth: 1,
                  borderColor: colors.divider,
                }}
              >
                <Search size={15} color={colors.text.muted} strokeWidth={2} />
                <TextInput
                  value={procurementSearchQuery}
                  onChangeText={setProcurementSearchQuery}
                  placeholder="Search procurement"
                  placeholderTextColor={colors.text.muted}
                  style={{ flex: 1, marginLeft: 8, color: colors.text.primary, fontSize: 14 }}
                />
              </View>
              <View style={{ position: 'relative' }}>
                {procurementFilterSortCount > 0 ? (
                  <View
                    className="rounded-full items-center justify-center"
                    style={{
                      position: 'absolute',
                      right: 1,
                      top: -6,
                      minWidth: 16,
                      height: 16,
                      paddingHorizontal: 4,
                      backgroundColor: colors.bar,
                      zIndex: 2,
                    }}
                  >
                    <Text style={{ color: colors.bg.screen, fontSize: 9, fontWeight: '700' }}>
                      {procurementFilterSortCount > 9 ? '9+' : procurementFilterSortCount}
                    </Text>
                  </View>
                ) : null}
                <Pressable
                  onPress={() => setShowProcurementFilterSheet(true)}
                  className="items-center justify-center"
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    borderColor: colors.divider,
                  }}
                >
                  <Filter
                    size={16}
                    color={procurementFilterSortCount > 0 ? colors.bar : colors.text.tertiary}
                    strokeWidth={2}
                  />
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          <View style={{ gap: 10, marginTop: financeSectionControlsMargin }}>
            <View className="flex-row items-center" style={{ gap: 10 }}>
              <View
                className="flex-row items-center rounded-full px-3"
                style={{
                  height: 40,
                  flex: 1,
                  backgroundColor: 'transparent',
                  borderWidth: 1,
                  borderColor: colors.divider,
                }}
              >
                <Search size={15} color={colors.text.muted} strokeWidth={2} />
                <TextInput
                  value={procurementSearchQuery}
                  onChangeText={setProcurementSearchQuery}
                  placeholder="Search procurement"
                  placeholderTextColor={colors.text.muted}
                  style={{ flex: 1, marginLeft: 8, color: colors.text.primary, fontSize: 14 }}
                />
              </View>
              <Text style={{ color: colors.text.primary }} className="text-xl font-semibold">
                {formatCurrency(filteredProcurementTotal)}
              </Text>
              <View style={{ position: 'relative' }}>
                {procurementFilterSortCount > 0 ? (
                  <View
                    className="rounded-full items-center justify-center"
                    style={{
                      position: 'absolute',
                      right: 1,
                      top: -6,
                      minWidth: 16,
                      height: 16,
                      paddingHorizontal: 4,
                      backgroundColor: colors.bar,
                      zIndex: 2,
                    }}
                  >
                    <Text style={{ color: colors.bg.screen, fontSize: 9, fontWeight: '700' }}>
                      {procurementFilterSortCount > 9 ? '9+' : procurementFilterSortCount}
                    </Text>
                  </View>
                ) : null}
                <Pressable
                  onPress={() => setShowProcurementFilterSheet(true)}
                  className="rounded-full items-center justify-center"
                  style={{
                    width: 40,
                    height: 40,
                    borderWidth: 1,
                    borderColor: colors.divider,
                    backgroundColor: 'transparent',
                  }}
                >
                  <Filter
                    size={16}
                    color={procurementFilterSortCount > 0 ? colors.bar : colors.text.tertiary}
                    strokeWidth={2}
                  />
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </View>

      <View
        style={{
          marginTop: financeSectionBodyMargin,
          borderWidth: 1,
          borderColor: colors.divider,
          borderRadius: 16,
          overflow: 'visible',
          backgroundColor: colors.bg.card,
          width: '100%',
        }}
      >
        {isWebDesktop ? (
          <View style={{ borderBottomWidth: 1, borderBottomColor: colors.divider }}>
            <View className="grid grid-cols-12 items-center px-3 py-3" style={{ columnGap: 12 } as any}>
              <Text style={{ color: colors.text.muted }} className="col-span-2 text-xs font-semibold uppercase">PO Number</Text>
              <Text style={{ color: colors.text.muted }} className="col-span-2 text-xs font-semibold uppercase">Name</Text>
              <Text style={{ color: colors.text.muted }} className="col-span-2 text-xs font-semibold uppercase">Supplier</Text>
              <Text style={{ color: colors.text.muted }} className="col-span-2 text-xs font-semibold uppercase">Status</Text>
              <Text style={{ color: colors.text.muted }} className="col-span-1 text-xs font-semibold uppercase">Date Paid</Text>
              <Text style={{ color: colors.text.muted }} className="col-span-1 text-xs font-semibold uppercase">Date Received</Text>
              <Text style={{ color: colors.text.muted, textAlign: 'right' }} className="col-span-1 text-xs font-semibold uppercase">Total</Text>
              <View className="col-span-1" />
            </View>
          </View>
        ) : null}

        {visibleProcurementRows.length === 0 ? (
          <View className="items-center justify-center py-12">
            <Text style={{ color: colors.text.tertiary }} className="text-base">No procurements found</Text>
          </View>
        ) : visibleProcurementRows.map((procurement, index) => (
          <Pressable
            key={procurement.id}
            onPress={() => {
              if (isMobile) {
                router.push({ pathname: '/procurement/[id]', params: { id: procurement.id } } as any);
                return;
              }
              setSelectedProcurementId((prev) => prev === procurement.id ? null : procurement.id);
              setProcurementActionMenuId(null);
            }}
            style={{
              borderBottomWidth: index === visibleProcurementRows.length - 1 ? 0 : 1,
              borderBottomColor: colors.divider,
              position: 'relative',
              zIndex: procurementActionMenuId === procurement.id ? 40 : 1,
              backgroundColor: selectedProcurementId === procurement.id ? colors.bg.input : 'transparent',
              borderLeftWidth: selectedProcurementId === procurement.id ? 3 : 0,
              borderLeftColor: colors.bar,
            }}
          >
            {isWebDesktop ? (
              <View className="grid grid-cols-12 items-center px-3 py-3.5" style={{ columnGap: 12 } as any}>
                <View className="col-span-2 flex-row items-center" style={{ gap: 8 }}>
                  <Truck size={16} color={colors.text.tertiary} strokeWidth={2} />
                  <Text style={{ color: colors.text.primary }} className="text-sm font-normal" numberOfLines={1}>
                    {procurement.poNumber}
                  </Text>
                </View>

                <Text style={{ color: procurement.title ? colors.text.primary : colors.text.muted }} className="col-span-2 text-sm" numberOfLines={1}>
                  {procurement.title || '—'}
                </Text>

                <Text style={{ color: colors.text.secondary }} className="col-span-2 text-sm" numberOfLines={1}>
                  {procurement.supplier}
                </Text>

                <View className="col-span-2" style={{ paddingRight: 8 }}>
                  <StatusBadge
                    label={procurement.status}
                    colors={colors}
                    maxWidth={116}
                  />
                </View>

                <Text style={{ color: colors.text.secondary }} className="col-span-1 text-sm" numberOfLines={1}>
                  {procurement.paidDate}
                </Text>

                <Text style={{ color: colors.text.secondary }} className="col-span-1 text-sm" numberOfLines={1}>
                  {procurement.receivedDate}
                </Text>

                <Text style={{ color: colors.text.primary, textAlign: 'right' }} className="col-span-1 text-sm font-normal" numberOfLines={1}>
                  {formatCurrency(procurement.total)}
                </Text>

                <View className="col-span-1 items-end">
                  {isFinanceApprover ? (
                    <Pressable
                      onPress={(event) => {
                        event.stopPropagation();
                        setProcurementActionMenuId((current) => (current === procurement.id ? null : procurement.id));
                      }}
                      className="p-1.5 rounded-md"
                      style={{ backgroundColor: procurementActionMenuId === procurement.id ? colors.bg.input : 'transparent' }}
                    >
                      <MoreVertical size={16} color={colors.text.tertiary} strokeWidth={2} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : (
              <View style={{ paddingHorizontal: 12, paddingVertical: 12 }}>
                <View className="flex-row items-start justify-between" style={{ gap: 10 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    {procurement.title ? (
                      <>
                        <Text style={{ color: colors.text.primary, flex: 1 }} className="text-base font-normal" numberOfLines={1}>
                          {procurement.title}
                        </Text>
                        <Text style={{ color: colors.text.muted }} className="text-xs mt-0.5" numberOfLines={1}>
                          {procurement.poNumber} · {procurement.supplier}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={{ color: colors.text.primary, flex: 1 }} className="text-base font-normal" numberOfLines={1}>
                          {procurement.poNumber}
                        </Text>
                        <Text style={{ color: colors.text.secondary }} className="text-sm mt-1" numberOfLines={1}>
                          {procurement.supplier}
                        </Text>
                      </>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end', minWidth: 120 }}>
                    <Text style={{ color: colors.text.primary }} className="text-base font-normal" numberOfLines={1}>
                      {formatCurrency(procurement.total)}
                    </Text>
                    <View className="flex-row items-center mt-1" style={{ gap: 6 }}>
                      <StatusBadge label={procurement.status} colors={colors} compact maxWidth={92} />
                      <Text style={{ color: colors.text.secondary }} className="text-xs" numberOfLines={1}>
                        {procurement.paidDate}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {!isMobile && isFinanceApprover && procurementActionMenuId === procurement.id ? (
              <View
                style={{
                  position: 'absolute',
                  right: 8,
                  top: 42,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.divider,
                  backgroundColor: colors.bg.card,
                  zIndex: 50,
                  minWidth: 160,
                  overflow: 'hidden',
                }}
              >
                <Pressable
                  onPress={(event) => {
                    event.stopPropagation();
                    openProcurementEditor(procurement.id);
                  }}
                  className="px-3 py-2.5"
                  style={{ borderBottomWidth: 1, borderBottomColor: colors.divider }}
                >
                  <Text style={{ color: colors.text.primary }} className="text-sm font-medium">Edit PO</Text>
                </Pressable>
                <Pressable
                  onPress={(event) => {
                    event.stopPropagation();
                    setProcurementActionMenuId(null);
                    handleDeleteProcurement(procurement.id);
                  }}
                  className="px-3 py-2.5"
                >
                  <Text style={{ color: colors.danger }} className="text-sm font-medium">Delete PO</Text>
                </Pressable>
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>

      {!isMobile && isFinanceApprover && procurementActionMenuId ? (
        <Pressable
          onPress={() => setProcurementActionMenuId(null)}
          style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 25 }}
        />
      ) : null}
    </View>
  );

  const renderFinanceSettings = () => (
    <View style={isWebDesktop ? { maxWidth: 1440, width: '100%', alignSelf: 'flex-start' } : undefined}>
      <View className="mt-6">
        <Text style={{ color: colors.text.primary }} className="text-2xl font-bold">Finance Settings</Text>
        <Text style={{ color: colors.text.tertiary }} className="text-sm mt-1">
          Manage suppliers, expense categories, procurement statuses, and exports.
        </Text>
      </View>

      <View className="mt-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          <FinanceFilterPill
            label="Suppliers"
            active={financeSettingsView === 'suppliers'}
            onPress={() => setFinanceSettingsView('suppliers')}
            colors={colors}
          />
          <FinanceFilterPill
            label="Expense Categories"
            active={financeSettingsView === 'categories'}
            onPress={() => setFinanceSettingsView('categories')}
            colors={colors}
          />
          <FinanceFilterPill
            label="Fixed Costs"
            active={financeSettingsView === 'fixed-costs'}
            onPress={() => setFinanceSettingsView('fixed-costs')}
            colors={colors}
          />
          <FinanceFilterPill
            label="PO Statuses"
            active={financeSettingsView === 'statuses'}
            onPress={() => setFinanceSettingsView('statuses')}
            colors={colors}
          />
          <FinanceFilterPill
            label="Rules"
            active={financeSettingsView === 'rules'}
            onPress={() => setFinanceSettingsView('rules')}
            colors={colors}
          />
          <FinanceFilterPill
            label="Export"
            active={financeSettingsView === 'export'}
            onPress={() => setFinanceSettingsView('export')}
            colors={colors}
          />
        </ScrollView>
      </View>

      {financeSettingsView === 'suppliers' ? (
        <>
          <View className="mt-5" style={{ gap: 10 }}>
            <View
              className="flex-row items-center rounded-full px-3"
              style={{
                height: 40,
                width: isWebDesktop ? 260 : '100%',
                borderWidth: 1,
                borderColor: colors.divider,
                backgroundColor: 'transparent',
              }}
            >
              <Search size={15} color={colors.text.muted} strokeWidth={2} />
              <TextInput
                value={supplierSearchQuery}
                onChangeText={setSupplierSearchQuery}
                placeholder="Search suppliers"
                placeholderTextColor={colors.text.muted}
                style={{ flex: 1, marginLeft: 8, color: colors.text.primary, fontSize: 14 }}
              />
            </View>

            <Pressable
              onPress={openSupplierComposer}
              className="rounded-full active:opacity-80 px-4 flex-row items-center self-start"
              style={{ height: 42, backgroundColor: colors.bar, alignSelf: 'flex-start' }}
            >
              <Plus size={18} color={colors.bg.screen} strokeWidth={2.5} />
              <Text style={{ color: colors.bg.screen }} className="font-semibold ml-1.5 text-sm">Add Supplier</Text>
            </Pressable>
          </View>

          <View className="mt-4 rounded-2xl" style={{ borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, overflow: 'hidden' }}>
            {isWebDesktop ? (
              <View style={{ borderBottomWidth: 1, borderBottomColor: colors.divider }} className="px-4 py-3 flex-row">
                <Text style={{ color: colors.text.muted, flex: 1.3 }} className="text-xs font-semibold uppercase">Supplier</Text>
                <Text style={{ color: colors.text.muted, flex: 1 }} className="text-xs font-semibold uppercase">Contact</Text>
                <Text style={{ color: colors.text.muted, flex: 1.1 }} className="text-xs font-semibold uppercase">Email</Text>
                <Text style={{ color: colors.text.muted, width: 120 }} className="text-xs font-semibold uppercase">Terms</Text>
                <View style={{ width: 74 }} />
              </View>
            ) : null}
            {filteredSupplierRows.length === 0 ? (
              <View className="py-10 items-center">
                <Text style={{ color: colors.text.tertiary }} className="text-sm">No suppliers yet</Text>
              </View>
            ) : filteredSupplierRows.map((supplier, index) => (
              isWebDesktop ? (
                <View
                  key={supplier.id}
                  className="px-4 py-3.5 flex-row items-center"
                  style={{ borderBottomWidth: index === filteredSupplierRows.length - 1 ? 0 : 1, borderBottomColor: colors.divider }}
                >
                  <Text style={{ color: colors.text.primary, flex: 1.3 }} className="text-sm font-medium" numberOfLines={1}>{supplier.name}</Text>
                  <Text style={{ color: colors.text.secondary, flex: 1 }} className="text-sm" numberOfLines={1}>{supplier.contactName || '-'}</Text>
                  <Text style={{ color: colors.text.secondary, flex: 1.1 }} className="text-sm" numberOfLines={1}>{supplier.email || '-'}</Text>
                  <Text style={{ color: colors.text.secondary, width: 120 }} className="text-sm" numberOfLines={1}>{supplier.paymentTerms || '-'}</Text>
                  <View style={{ width: 74 }} className="flex-row justify-end">
                    <Pressable className="p-1.5 mr-1" onPress={() => openSupplierEditor(supplier.id)}>
                      <Pencil size={16} color={colors.text.tertiary} strokeWidth={2} />
                    </Pressable>
                    <Pressable className="p-1.5" onPress={() => handleDeleteFinanceSupplier(supplier.id)}>
                      <Trash2 size={16} color={colors.danger} strokeWidth={2} />
                    </Pressable>
                  </View>
                </View>
              ) : isMobile ? (
                <Pressable
                  key={supplier.id}
                  className="px-4 py-3.5"
                  style={{ borderBottomWidth: index === filteredSupplierRows.length - 1 ? 0 : 1, borderBottomColor: colors.divider }}
                  onPress={() => setMobileDetail({ kind: 'supplier', id: supplier.id })}
                >
                  <Text style={{ color: colors.text.primary, flex: 1 }} className="text-sm font-semibold" numberOfLines={1}>{supplier.name}</Text>
                  <Text style={{ color: colors.text.secondary }} className="text-xs mt-1" numberOfLines={1}>
                    {supplier.contactName || supplier.email || supplier.paymentTerms || '-'}
                  </Text>
                </Pressable>
              ) : (
                <View
                  key={supplier.id}
                  className="px-4 py-3.5"
                  style={{ borderBottomWidth: index === filteredSupplierRows.length - 1 ? 0 : 1, borderBottomColor: colors.divider }}
                >
                  <View className="flex-row items-start justify-between" style={{ gap: 10 }}>
                    <Text style={{ color: colors.text.primary, flex: 1 }} className="text-sm font-semibold" numberOfLines={1}>{supplier.name}</Text>
                    <View className="flex-row items-center">
                      <Pressable className="p-1.5 mr-1" onPress={() => openSupplierEditor(supplier.id)}>
                        <Pencil size={16} color={colors.text.tertiary} strokeWidth={2} />
                      </Pressable>
                      <Pressable className="p-1.5" onPress={() => handleDeleteFinanceSupplier(supplier.id)}>
                        <Trash2 size={16} color={colors.danger} strokeWidth={2} />
                      </Pressable>
                    </View>
                  </View>
                  <Text style={{ color: colors.text.secondary }} className="text-xs mt-1">Contact: {supplier.contactName || '-'}</Text>
                  <Text style={{ color: colors.text.secondary }} className="text-xs mt-0.5" numberOfLines={1}>Email: {supplier.email || '-'}</Text>
                  <Text style={{ color: colors.text.secondary }} className="text-xs mt-0.5">Terms: {supplier.paymentTerms || '-'}</Text>
                </View>
              )
            ))}
          </View>
        </>
      ) : null}

      {financeSettingsView === 'categories' ? (
        <>
          <View className="mt-5" style={{ gap: 10 }}>
            <Text style={{ color: colors.text.secondary }} className="text-sm">
              {expenseCategories.length} categories
            </Text>
            <Pressable
              onPress={openCategoryComposer}
              className="rounded-full active:opacity-80 px-4 flex-row items-center self-start"
              style={{ height: 42, backgroundColor: colors.bar, alignSelf: 'flex-start' }}
            >
              <Plus size={18} color={colors.bg.screen} strokeWidth={2.5} />
              <Text style={{ color: colors.bg.screen }} className="font-semibold ml-1.5 text-sm">Add Category</Text>
            </Pressable>
          </View>

          <View className="mt-4 rounded-2xl" style={{ borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, overflow: 'hidden' }}>
            {isWebDesktop ? (
              <View style={{ borderBottomWidth: 1, borderBottomColor: colors.divider }} className="px-4 py-3 flex-row">
                <Text style={{ color: colors.text.muted, flex: 1 }} className="text-xs font-semibold uppercase">Category</Text>
                <View style={{ width: 74 }} />
              </View>
            ) : null}
            {expenseCategories.length === 0 ? (
              <View className="py-10 items-center">
                <Text style={{ color: colors.text.tertiary }} className="text-sm">No categories yet</Text>
              </View>
            ) : expenseCategories
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((category, index, list) => (
                isWebDesktop ? (
                  <View
                    key={category.id}
                    className="px-4 py-3.5 flex-row items-center"
                    style={{ borderBottomWidth: index === list.length - 1 ? 0 : 1, borderBottomColor: colors.divider }}
                  >
                    <Text style={{ color: colors.text.primary, flex: 1 }} className="text-sm font-medium">{category.name}</Text>
                    <View style={{ width: 74 }} className="flex-row justify-end">
                      <Pressable className="p-1.5 mr-1" onPress={() => openCategoryEditor(category.id)}>
                        <Pencil size={16} color={colors.text.tertiary} strokeWidth={2} />
                      </Pressable>
                      <Pressable className="p-1.5" onPress={() => handleDeleteExpenseCategory(category.id)}>
                        <Trash2 size={16} color={colors.danger} strokeWidth={2} />
                      </Pressable>
                    </View>
                  </View>
                ) : isMobile ? (
                  <Pressable
                    key={category.id}
                    className="px-4 py-3.5"
                    style={{ borderBottomWidth: index === list.length - 1 ? 0 : 1, borderBottomColor: colors.divider }}
                    onPress={() => setMobileDetail({ kind: 'category', id: category.id })}
                  >
                    <Text style={{ color: colors.text.primary, flex: 1 }} className="text-sm font-medium">{category.name}</Text>
                  </Pressable>
                ) : (
                  <View
                    key={category.id}
                    className="px-4 py-3.5 flex-row items-center justify-between"
                    style={{ borderBottomWidth: index === list.length - 1 ? 0 : 1, borderBottomColor: colors.divider }}
                  >
                    <Text style={{ color: colors.text.primary, flex: 1 }} className="text-sm font-medium">{category.name}</Text>
                    <View className="flex-row justify-end">
                      <Pressable className="p-1.5 mr-1" onPress={() => openCategoryEditor(category.id)}>
                        <Pencil size={16} color={colors.text.tertiary} strokeWidth={2} />
                      </Pressable>
                      <Pressable className="p-1.5" onPress={() => handleDeleteExpenseCategory(category.id)}>
                        <Trash2 size={16} color={colors.danger} strokeWidth={2} />
                      </Pressable>
                    </View>
                  </View>
                )
              ))}
          </View>
        </>
      ) : null}

      {financeSettingsView === 'fixed-costs' ? (
        <>
          <View className="mt-5" style={{ gap: 10 }}>
            <View
              className="flex-row items-center rounded-full px-3"
              style={{
                height: 40,
                width: isWebDesktop ? 260 : '100%',
                borderWidth: 1,
                borderColor: colors.divider,
                backgroundColor: 'transparent',
              }}
            >
              <Search size={15} color={colors.text.muted} strokeWidth={2} />
              <TextInput
                value={fixedCostSearchQuery}
                onChangeText={setFixedCostSearchQuery}
                placeholder="Search fixed costs"
                placeholderTextColor={colors.text.muted}
                style={{ flex: 1, marginLeft: 8, color: colors.text.primary, fontSize: 14 }}
              />
            </View>

            <Pressable
              onPress={openFixedCostComposer}
              className="rounded-full active:opacity-80 px-4 flex-row items-center self-start"
              style={{ height: 42, backgroundColor: colors.bar, alignSelf: 'flex-start' }}
            >
              <Plus size={18} color={colors.bg.screen} strokeWidth={2.5} />
              <Text style={{ color: colors.bg.screen }} className="font-semibold ml-1.5 text-sm">Add Fixed Cost</Text>
            </Pressable>
          </View>

          <View className="mt-3">
            <Text style={{ color: colors.text.tertiary }} className="text-xs">
              Fixed costs are managed here and included in overview/profit calculations.
            </Text>
          </View>

          <View className="mt-4 rounded-2xl" style={{ borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, overflow: 'hidden' }}>
            {isWebDesktop ? (
              <View style={{ borderBottomWidth: 1, borderBottomColor: colors.divider }} className="px-4 py-3 flex-row">
                <Text style={{ color: colors.text.muted, flex: 1.35 }} className="text-xs font-semibold uppercase">Name</Text>
                <Text style={{ color: colors.text.muted, flex: 1 }} className="text-xs font-semibold uppercase">Category</Text>
                <Text style={{ color: colors.text.muted, width: 120 }} className="text-xs font-semibold uppercase">Frequency</Text>
                <Text style={{ color: colors.text.muted, flex: 1 }} className="text-xs font-semibold uppercase">Supplier</Text>
                <Text style={{ color: colors.text.muted, width: 120, textAlign: 'right' }} className="text-xs font-semibold uppercase">Amount</Text>
                <View style={{ width: 74 }} />
              </View>
            ) : null}
            {filteredFixedCostRows.length === 0 ? (
              <View className="py-10 items-center">
                <Text style={{ color: colors.text.tertiary }} className="text-sm">No fixed costs yet</Text>
              </View>
            ) : filteredFixedCostRows.map((cost, index) => (
              <Pressable
                key={cost.id}
                className={isWebDesktop ? 'px-4 py-3.5 flex-row items-center' : 'px-4 py-3.5'}
                style={{ borderBottomWidth: index === filteredFixedCostRows.length - 1 ? 0 : 1, borderBottomColor: colors.divider }}
                onPress={() => {
                  if (isMobile) {
                    setMobileDetail({ kind: 'fixed-cost', id: cost.id });
                    return;
                  }
                  openFixedCostEditor(cost.id);
                }}
              >
                {isWebDesktop ? (
                  <>
                    <View style={{ flex: 1.35 }}>
                      <Text style={{ color: colors.text.primary }} className="text-sm font-medium" numberOfLines={1}>{cost.name}</Text>
                      {cost.notes ? (
                        <Text style={{ color: colors.text.muted }} className="text-xs mt-0.5" numberOfLines={1}>{cost.notes}</Text>
                      ) : null}
                    </View>
                    <Text style={{ color: colors.text.secondary, flex: 1 }} className="text-sm" numberOfLines={1}>{cost.category}</Text>
                    <Text style={{ color: colors.text.secondary, width: 120 }} className="text-sm" numberOfLines={1}>{cost.frequency}</Text>
                    <Text style={{ color: colors.text.secondary, flex: 1 }} className="text-sm" numberOfLines={1}>{cost.supplierName || '-'}</Text>
                    <Text style={{ color: colors.text.primary, width: 120, textAlign: 'right' }} className="text-sm font-semibold" numberOfLines={1}>
                      {formatCurrency(cost.amount)}
                    </Text>
                    <View style={{ width: 74 }} className="flex-row justify-end">
                      <Pressable className="p-1.5 mr-1" onPress={() => openFixedCostEditor(cost.id)}>
                        <Pencil size={16} color={colors.text.tertiary} strokeWidth={2} />
                      </Pressable>
                      <Pressable className="p-1.5" onPress={() => handleDeleteFixedCost(cost.id)}>
                        <Trash2 size={16} color={colors.danger} strokeWidth={2} />
                      </Pressable>
                    </View>
                  </>
                ) : isMobile ? (
                  <View>
                    <View className="flex-row items-start justify-between" style={{ gap: 10 }}>
                      <Text style={{ color: colors.text.primary, flex: 1 }} className="text-sm font-semibold" numberOfLines={1}>{cost.name}</Text>
                      <Text style={{ color: colors.text.primary }} className="text-sm font-semibold">{formatCurrency(cost.amount)}</Text>
                    </View>
                    <Text style={{ color: colors.text.secondary }} className="text-xs mt-1" numberOfLines={1}>
                      {cost.category} • {cost.frequency}
                    </Text>
                  </View>
                ) : (
                  <>
                    <View className="flex-row items-start justify-between" style={{ gap: 10 }}>
                      <Text style={{ color: colors.text.primary, flex: 1 }} className="text-sm font-semibold" numberOfLines={1}>{cost.name}</Text>
                      <Text style={{ color: colors.text.primary }} className="text-sm font-semibold">{formatCurrency(cost.amount)}</Text>
                    </View>
                    <Text style={{ color: colors.text.secondary }} className="text-xs mt-1">Category: {cost.category}</Text>
                    <Text style={{ color: colors.text.secondary }} className="text-xs mt-0.5">Frequency: {cost.frequency}</Text>
                    <Text style={{ color: colors.text.secondary }} className="text-xs mt-0.5">Supplier: {cost.supplierName || '-'}</Text>
                    {cost.notes ? (
                      <Text style={{ color: colors.text.muted }} className="text-xs mt-0.5" numberOfLines={2}>{cost.notes}</Text>
                    ) : null}
                    <View className="flex-row justify-end mt-2">
                      <Pressable className="p-1.5 mr-1" onPress={() => openFixedCostEditor(cost.id)}>
                        <Pencil size={16} color={colors.text.tertiary} strokeWidth={2} />
                      </Pressable>
                      <Pressable className="p-1.5" onPress={() => handleDeleteFixedCost(cost.id)}>
                        <Trash2 size={16} color={colors.danger} strokeWidth={2} />
                      </Pressable>
                    </View>
                  </>
                )}
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {financeSettingsView === 'statuses' ? (
        <>
          <View className="mt-5" style={{ gap: 10 }}>
            <View
              className="flex-row items-center rounded-full px-3"
              style={{
                height: 40,
                width: isWebDesktop ? 260 : '100%',
                borderWidth: 1,
                borderColor: colors.divider,
                backgroundColor: 'transparent',
              }}
            >
              <Search size={15} color={colors.text.muted} strokeWidth={2} />
              <TextInput
                value={statusSearchQuery}
                onChangeText={setStatusSearchQuery}
                placeholder="Search statuses"
                placeholderTextColor={colors.text.muted}
                style={{ flex: 1, marginLeft: 8, color: colors.text.primary, fontSize: 14 }}
              />
            </View>

            <Pressable
              onPress={openStatusComposer}
              className="rounded-full active:opacity-80 px-4 flex-row items-center self-start"
              style={{ height: 42, backgroundColor: colors.bar, alignSelf: 'flex-start' }}
            >
              <Plus size={18} color={colors.bg.screen} strokeWidth={2.5} />
              <Text style={{ color: colors.bg.screen }} className="font-semibold ml-1.5 text-sm">Add Status</Text>
            </Pressable>
          </View>

          <View className="mt-4 rounded-2xl" style={{ borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, overflow: 'hidden' }}>
            {filteredStatusRows.length === 0 ? (
              <View className="py-10 items-center">
                <Text style={{ color: colors.text.tertiary }} className="text-sm">No statuses found</Text>
              </View>
            ) : filteredStatusRows.map((status, index) => (
              <View
                key={status.id}
                className={isWebDesktop ? 'px-4 py-3.5 flex-row items-center' : 'px-4 py-3.5'}
                style={{ borderBottomWidth: index === filteredStatusRows.length - 1 ? 0 : 1, borderBottomColor: colors.divider }}
              >
                {isWebDesktop ? (
                  <>
                    <Text style={{ color: colors.text.primary, flex: 1 }} className="text-sm font-medium">{status.name}</Text>
                    <Text style={{ color: colors.text.tertiary, width: 72, textAlign: 'center' }} className="text-sm">#{status.order}</Text>
                    <View style={{ width: 74 }} className="flex-row justify-end">
                      <Pressable className="p-1.5 mr-1" onPress={() => openStatusEditor(status.id)}>
                        <Pencil size={16} color={colors.text.tertiary} strokeWidth={2} />
                      </Pressable>
                      <Pressable
                        className="p-1.5"
                        onPress={() => handleDeleteProcurementStatusOption(status.id)}
                      >
                        <Trash2 size={16} color={colors.danger} strokeWidth={2} />
                      </Pressable>
                    </View>
                  </>
                ) : isMobile ? (
                  <Pressable
                    className="py-1"
                    onPress={() => setMobileDetail({ kind: 'status', id: status.id })}
                  >
                    <Text style={{ color: colors.text.primary }} className="text-sm font-medium">{status.name}</Text>
                    <Text style={{ color: colors.text.tertiary }} className="text-xs mt-0.5">Order #{status.order}</Text>
                  </Pressable>
                ) : (
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text style={{ color: colors.text.primary }} className="text-sm font-medium">{status.name}</Text>
                      <Text style={{ color: colors.text.tertiary }} className="text-xs mt-0.5">Order #{status.order}</Text>
                    </View>
                    <View className="flex-row justify-end">
                      <Pressable className="p-1.5 mr-1" onPress={() => openStatusEditor(status.id)}>
                        <Pencil size={16} color={colors.text.tertiary} strokeWidth={2} />
                      </Pressable>
                      <Pressable
                        className="p-1.5"
                        onPress={() => handleDeleteProcurementStatusOption(status.id)}
                      >
                        <Trash2 size={16} color={colors.danger} strokeWidth={2} />
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>
        </>
      ) : null}

      {financeSettingsView === 'rules' ? (
        <View className="mt-5" style={{ gap: 16 }}>
          {/* VAT Rate */}
          <View className="rounded-2xl" style={{ borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, overflow: 'hidden' }}>
            <View className="px-4 flex-row items-center" style={{ paddingVertical: 14, gap: 12 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '600' }}>VAT Rate</Text>
                <Text style={{ color: colors.text.tertiary, fontSize: 12, marginTop: 1 }}>Applied on top of automated bank charges</Text>
              </View>
              {!editingVatRate ? (
                <>
                  <Text style={{ color: colors.text.primary, fontSize: 17, fontWeight: '700' }}>{(financeRules.vatRate * 100).toFixed(1)}%</Text>
                  <Pressable
                    onPress={() => { setVatRateDraft((financeRules.vatRate * 100).toFixed(1)); setEditingVatRate(true); }}
                    style={{ paddingHorizontal: 16, height: 34, borderRadius: 100, backgroundColor: colors.text.primary, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ color: colors.bg.card, fontSize: 13, fontWeight: '600' }}>Edit</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.divider, borderRadius: 100, backgroundColor: colors.bg.input, paddingHorizontal: 14, height: 36 }}>
                    <TextInput
                      value={vatRateDraft}
                      onChangeText={setVatRateDraft}
                      keyboardType="decimal-pad"
                      placeholder="7.5"
                      placeholderTextColor={colors.text.muted}
                      style={{ flex: 1, color: colors.text.primary, fontSize: 14 }}
                    />
                    <Text style={{ color: colors.text.secondary, fontSize: 13, fontWeight: '600' }}>%</Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      const parsed = Number.parseFloat(vatRateDraft);
                      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
                        showSettingsToast('error', 'Enter a valid VAT percentage (0 to 100).');
                        return;
                      }
                      handleSaveFinanceRules({ vatRate: parsed / 100 }, settingsSavedMessage('VAT rate'));
                      setEditingVatRate(false);
                    }}
                    style={{ flex: 1, height: 36, borderRadius: 100, backgroundColor: colors.text.primary, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ color: colors.bg.card, fontSize: 13, fontWeight: '600' }}>Save</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setEditingVatRate(false)}
                    style={{ flex: 1, height: 36, borderRadius: 100, borderWidth: 1, borderColor: colors.divider, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ color: colors.text.secondary, fontSize: 13 }}>Cancel</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>

          {/* Bank Charge Tiers */}
          <View>
            <View className="flex-row items-center justify-between mb-3">
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ color: colors.text.primary }} className="text-sm font-semibold">Transfer Fees (NIP)</Text>
                <Text style={{ color: colors.text.tertiary }} className="text-xs mt-0.5">Your bank charges this when you send money. e.g. ₦10 for transfers under ₦5,000</Text>
              </View>
              <Pressable
                onPress={() => {
                  setEditingBankChargeTierId(null);
                  setTierMaxAmountDraft('');
                  setTierFixedFeeDraft('');
                  setTierIsLastDraft(false);
                  setShowBankChargeTierModal(true);
                }}
                className="flex-row items-center rounded-full px-3"
                style={{ height: 36, backgroundColor: colors.bar }}
              >
                <Plus size={14} color={colors.bg.screen} strokeWidth={2.5} />
                <Text style={{ color: colors.bg.screen, fontSize: 13, fontWeight: '600', marginLeft: 4 }}>Add Tier</Text>
              </Pressable>
            </View>

            <View className="rounded-2xl" style={{ borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, overflow: 'hidden' }}>
              {isWebDesktop ? (
                <View className="px-4 py-2.5 flex-row" style={{ borderBottomWidth: 1, borderBottomColor: colors.divider }}>
                  <Text style={{ color: colors.text.muted, flex: 2 }} className="text-xs font-semibold uppercase">Amount Range</Text>
                  <Text style={{ color: colors.text.muted, flex: 1 }} className="text-xs font-semibold uppercase">Fixed Fee</Text>
                  <View style={{ width: 74 }} />
                </View>
              ) : null}
              {financeRules.bankChargeTiers.length === 0 ? (
                <View className="py-10 items-center">
                  <Text style={{ color: colors.text.tertiary }} className="text-sm">No tiers yet. Tap Add Tier to get started.</Text>
                </View>
              ) : financeRules.bankChargeTiers.map((tier, index) => {
                const prevMax = index > 0 ? financeRules.bankChargeTiers[index - 1].maxAmount : 0;
                const rangeLabel = tier.maxAmount !== null
                  ? `Up to ${formatCurrency(tier.maxAmount)}`
                  : `Over ${formatCurrency(prevMax ?? 0)}`;
                return (
                  <View
                    key={tier.id}
                    className="px-4 flex-row items-center"
                    style={{ paddingVertical: 14, borderBottomWidth: index === financeRules.bankChargeTiers.length - 1 ? 0 : 1, borderBottomColor: colors.divider }}
                  >
                    <View style={{ flex: isWebDesktop ? 2 : 1 }}>
                      <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '500' }}>{rangeLabel}</Text>
                      {!isWebDesktop ? (
                        <Text style={{ color: colors.text.tertiary, fontSize: 12, marginTop: 2 }}>Fee: {formatCurrency(tier.fixedFee)}</Text>
                      ) : null}
                    </View>
                    {isWebDesktop ? (
                      <Text style={{ color: colors.text.secondary, flex: 1, fontSize: 14 }}>{formatCurrency(tier.fixedFee)}</Text>
                    ) : null}
                    <View style={{ width: 74, flexDirection: 'row', justifyContent: 'flex-end' }}>
                      <Pressable
                        style={{ padding: 6, marginRight: 4 }}
                        onPress={() => {
                          setEditingBankChargeTierId(tier.id);
                          setTierMaxAmountDraft(tier.maxAmount !== null ? tier.maxAmount.toString() : '');
                          setTierFixedFeeDraft(tier.fixedFee.toString());
                          setTierIsLastDraft(tier.maxAmount === null);
                          setShowBankChargeTierModal(true);
                        }}
                      >
                        <Pencil size={16} color={colors.text.tertiary} strokeWidth={2} />
                      </Pressable>
                      <Pressable
                        style={{ padding: 6 }}
                        onPress={() => handleDeleteBankChargeTier(tier.id)}
                      >
                        <Trash2 size={16} color={colors.danger} strokeWidth={2} />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
            <Text style={{ color: colors.text.muted, fontSize: 12, marginTop: 8 }}>
              VAT ({(financeRules.vatRate * 100).toFixed(1)}%) is added on top. This is automatically added when you log an expense with bank charges on.
            </Text>
          </View>

          {/* Stamp Duty */}
          <View className="rounded-2xl" style={{ borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, overflow: 'hidden' }}>
            <View className="px-4 flex-row items-center" style={{ paddingVertical: 14, gap: 12 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '600' }}>Stamp Duty (CBN)</Text>
                <Text style={{ color: colors.text.tertiary, fontSize: 12, marginTop: 1 }}>{`Applied only when base transfer amount is ${STAMP_DUTY_THRESHOLD_LABEL} and above.`}</Text>
              </View>
              {!editingStampDuty ? (
                <>
                  <Text style={{ color: colors.text.primary, fontSize: 17, fontWeight: '700' }}>{formatCurrency(financeRules.incomingStampDuty ?? 50)}</Text>
                  <Pressable
                    onPress={() => { setStampDutyDraft(String(financeRules.incomingStampDuty ?? 50)); setEditingStampDuty(true); }}
                    style={{ paddingHorizontal: 16, height: 34, borderRadius: 100, backgroundColor: colors.text.primary, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ color: colors.bg.card, fontSize: 13, fontWeight: '600' }}>Edit</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.divider, borderRadius: 100, backgroundColor: colors.bg.input, paddingHorizontal: 14, height: 36 }}>
                    <Text style={{ color: colors.text.secondary, fontSize: 13, marginRight: 4 }}>₦</Text>
                    <TextInput value={stampDutyDraft} onChangeText={setStampDutyDraft} keyboardType="decimal-pad" placeholder="50" placeholderTextColor={colors.text.muted} style={{ flex: 1, color: colors.text.primary, fontSize: 14 }} />
                  </View>
                  <Pressable
                    onPress={() => {
                      const v = parseFloat(stampDutyDraft);
                      if (Number.isFinite(v) && v >= 0) {
                        handleSaveFinanceRules({ incomingStampDuty: v }, settingsSavedMessage('Stamp duty'));
                      } else {
                        showSettingsToast('error', 'Enter a valid stamp duty amount.');
                        return;
                      }
                      setEditingStampDuty(false);
                    }}
                    style={{ flex: 1, height: 36, borderRadius: 100, backgroundColor: colors.text.primary, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ color: colors.bg.card, fontSize: 13, fontWeight: '600' }}>Save</Text>
                  </Pressable>
                  <Pressable onPress={() => setEditingStampDuty(false)} style={{ flex: 1, height: 36, borderRadius: 100, borderWidth: 1, borderColor: colors.divider, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: colors.text.secondary, fontSize: 13 }}>Cancel</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>

          {/* Charge Preview */}
          <View className="rounded-2xl" style={{ borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, overflow: 'hidden' }}>
            <View className="px-4" style={{ paddingVertical: 14, gap: 12 }}>
              <View>
                <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '600' }}>Charge Preview</Text>
                <Text style={{ color: colors.text.tertiary, fontSize: 12, marginTop: 1 }}>
                  Uses the same fee rules for admin, manager, and staff expense requests.
                </Text>
              </View>

              <View style={{ flexDirection: isWebDesktop ? 'row' : 'column', gap: 10 }}>
                <View
                  style={{
                    flex: isWebDesktop ? 1 : undefined,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: colors.divider,
                    borderRadius: 100,
                    backgroundColor: colors.bg.input,
                    paddingHorizontal: 14,
                    height: 38,
                  }}
                >
                  <Text style={{ color: colors.text.secondary, fontSize: 13, marginRight: 4 }}>₦</Text>
                  <TextInput
                    value={chargePreviewAmountDraft}
                    onChangeText={setChargePreviewAmountDraft}
                    keyboardType="decimal-pad"
                    placeholder="50000"
                    placeholderTextColor={colors.text.muted}
                    style={{ flex: 1, color: colors.text.primary, fontSize: 14 }}
                  />
                </View>
                <View
                  className="rounded-full items-center justify-center"
                  style={{
                    minWidth: 136,
                    height: 38,
                    borderWidth: 1,
                    borderColor: colors.divider,
                    backgroundColor: colors.bg.input,
                    paddingHorizontal: 14,
                    alignSelf: isWebDesktop ? 'auto' : 'flex-start',
                  }}
                >
                  <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '600' }}>
                    Amount: {formatCurrency(chargePreviewAmount)}
                  </Text>
                </View>
              </View>

              <View style={{ borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 10, gap: 8 }}>
                <View className="flex-row items-center justify-between">
                  <Text style={{ color: colors.text.secondary, fontSize: 13 }}>Transfer fee (NIP tier)</Text>
                  <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '600' }}>
                    {formatCurrency(chargePreviewFee)}
                  </Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <Text style={{ color: colors.text.secondary, fontSize: 13 }}>
                    VAT on fee ({(financeRules.vatRate * 100).toFixed(1)}%)
                  </Text>
                  <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '600' }}>
                    {formatCurrency(chargePreviewVat)}
                  </Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <Text style={{ color: colors.text.secondary, fontSize: 13 }}>{`Stamp duty (${STAMP_DUTY_THRESHOLD_LABEL}+ only)`}</Text>
                  <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '600' }}>
                    {formatCurrency(chargePreviewStampDuty)}
                  </Text>
                </View>
                <View className="flex-row items-center justify-between" style={{ borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 8 }}>
                  <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '700' }}>Total charges</Text>
                  <Text style={{ color: colors.text.primary, fontSize: 15, fontWeight: '700' }}>
                    {formatCurrency(chargePreviewTotalCharges)}
                  </Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <Text style={{ color: colors.text.secondary, fontSize: 12 }}>Total debit (amount + charges)</Text>
                  <Text style={{ color: colors.text.secondary, fontSize: 13, fontWeight: '600' }}>
                    {formatCurrency(chargePreviewTotalDebit)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Payment Gateway Fees */}
          <View>
            <View className="flex-row items-center justify-between mb-3">
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ color: colors.text.primary }} className="text-sm font-semibold">Payment Gateway Fees</Text>
                <Text style={{ color: colors.text.tertiary }} className="text-xs mt-0.5">What Paystack, Flutterwave etc. remove before paying into your account</Text>
              </View>
              <Pressable
                onPress={() => { setEditingRevenueRuleId(null); setRevenueRuleNameDraft(''); setRevenueRuleChannelDraft('All Payment Methods'); setRevenueRulePercentDraft(''); setRevenueRuleFlatDraft(''); setShowRevenueRuleModal(true); }}
                className="flex-row items-center rounded-full px-3"
                style={{ height: 36, backgroundColor: colors.bar }}
              >
                <Plus size={14} color={colors.bg.screen} strokeWidth={2.5} />
                <Text style={{ color: colors.bg.screen, fontSize: 13, fontWeight: '600', marginLeft: 4 }}>Add Fee</Text>
              </Pressable>
            </View>
            <View className="rounded-2xl" style={{ borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, overflow: 'hidden' }}>
              {(financeRules.revenueRules ?? []).length === 0 ? (
                <View className="py-10 items-center px-6">
                  <Text style={{ color: colors.text.tertiary, fontSize: 13, textAlign: 'center' }}>No fees added yet. Tap "Add Fee" to set up Paystack, Flutterwave, etc.</Text>
                </View>
              ) : (financeRules.revenueRules ?? []).map((rule, index) => (
                <View key={rule.id} className="px-4 flex-row items-center" style={{ paddingVertical: 14, borderBottomWidth: index === (financeRules.revenueRules ?? []).length - 1 ? 0 : 1, borderBottomColor: colors.divider, gap: 10 }}>
                  <Pressable
                    onPress={() => handleToggleRevenueRule(rule.id, !rule.enabled)}
                    style={{ width: 38, height: 22, borderRadius: 11, backgroundColor: rule.enabled ? colors.bar : colors.bg.input, borderWidth: 1, borderColor: rule.enabled ? colors.bar : colors.divider, justifyContent: 'center', paddingHorizontal: 2 }}
                  >
                    <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: rule.enabled ? colors.bg.screen : colors.text.muted, alignSelf: rule.enabled ? 'flex-end' : 'flex-start' }} />
                  </Pressable>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{rule.name}</Text>
                    <Text style={{ color: colors.text.tertiary, fontSize: 12, marginTop: 1 }}>
                      {rule.channel}{rule.percentFee > 0 ? ` · ${rule.percentFee}%` : ''}{rule.flatFee > 0 ? ` + ${formatCurrency(rule.flatFee)}` : ''}
                    </Text>
                  </View>
                  <Pressable style={{ padding: 6, marginRight: 2 }} onPress={() => { setEditingRevenueRuleId(rule.id); setRevenueRuleNameDraft(rule.name); setRevenueRuleChannelDraft(rule.channel); setRevenueRulePercentDraft(String(rule.percentFee)); setRevenueRuleFlatDraft(String(rule.flatFee)); setShowRevenueRuleModal(true); }}>
                    <Pencil size={16} color={colors.text.tertiary} strokeWidth={2} />
                  </Pressable>
                  <Pressable style={{ padding: 6 }} onPress={() => handleDeleteRevenueRule(rule.id)}>
                    <Trash2 size={16} color={colors.danger} strokeWidth={2} />
                  </Pressable>
                </View>
              ))}
            </View>
            <Text style={{ color: colors.text.muted, fontSize: 12, marginTop: 8 }}>
              e.g. Paystack charges 1.5% + ₦100 on each payment. These are deducted from your gross revenue to show your true net.
            </Text>
          </View>
        </View>
      ) : null}

      {financeSettingsView === 'export' ? (
        <View className="mt-5 rounded-2xl p-5" style={colors.getCardStyle()}>
          <Text style={{ color: colors.text.primary }} className="text-lg font-semibold">Export Finance Data</Text>
          <Text style={{ color: colors.text.tertiary }} className="text-sm mt-1">
            Download CSV exports for expenses, procurement, and Profit & Loss summary.
          </Text>

          <View className="mt-4" style={{ gap: 10 }}>
            <Pressable
              onPress={handleExportExpensesCsv}
              className="rounded-xl px-4 flex-row items-center"
              style={{ height: 42, borderWidth: 1, borderColor: colors.divider }}
            >
              <Download size={16} color={colors.text.tertiary} strokeWidth={2} />
              <Text style={{ color: colors.text.primary }} className="ml-2 text-sm font-semibold">Export Expenses CSV</Text>
            </Pressable>
            <Pressable
              onPress={handleExportProcurementCsv}
              className="rounded-xl px-4 flex-row items-center"
              style={{ height: 42, borderWidth: 1, borderColor: colors.divider }}
            >
              <Download size={16} color={colors.text.tertiary} strokeWidth={2} />
              <Text style={{ color: colors.text.primary }} className="ml-2 text-sm font-semibold">Export Procurement CSV</Text>
            </Pressable>
            <Pressable
              onPress={handleExportFixedCostsCsv}
              className="rounded-xl px-4 flex-row items-center"
              style={{ height: 42, borderWidth: 1, borderColor: colors.divider }}
            >
              <Download size={16} color={colors.text.tertiary} strokeWidth={2} />
              <Text style={{ color: colors.text.primary }} className="ml-2 text-sm font-semibold">Export Fixed Costs CSV</Text>
            </Pressable>
            <Pressable
              onPress={handleExportProfitLossCsv}
              className="rounded-xl px-4 flex-row items-center"
              style={{ height: 42, borderWidth: 1, borderColor: colors.divider }}
            >
              <Download size={16} color={colors.text.tertiary} strokeWidth={2} />
              <Text style={{ color: colors.text.primary }} className="ml-2 text-sm font-semibold">Export Profit & Loss CSV</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );

  const renderActiveSection = () => {
    if (!isFinanceApprover) {
      if (activeTab === 'procurement' && isManagerRole) {
        return renderProcurement();
      }
      if (activeTab === 'refunds') {
        return renderRefunds();
      }
      return renderMyExpenseRequestWorkspace();
    }

    if (activeTab === 'overview') {
      return (
        <>
          {renderOverviewRangeFilters()}
          {renderOverviewTopCards()}
          {renderOverviewExpenseRequestsBadgeCard()}
          {renderTotalsInfoNote(
            'In this period: Net Revenue = Gross Revenue - gateway fees - stamp duty - refunds. Net Profit = Net Revenue - Expenses - Procurement.',
            isWebDesktop ? 12 : 16
          )}
          {renderOverview()}
        </>
      );
    }

    if (activeTab === 'expenses') {
      return renderExpenses();
    }

    if (activeTab === 'refunds') {
      return renderRefunds();
    }

    if (activeTab === 'procurement') {
      return renderProcurement();
    }

    return renderFinanceSettings();
  };

  if (!canAccessFinance) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.bg.screen }}>
        <SafeAreaView className="flex-1 items-center justify-center" edges={['top']}>
          <View
            className="w-20 h-20 rounded-2xl items-center justify-center mb-4"
            style={{ backgroundColor: colors.bg.input }}
          >
            <Lock size={40} color={colors.text.tertiary} strokeWidth={1.5} />
          </View>
          <Text style={{ color: colors.text.primary }} className="text-lg font-semibold">Access Restricted</Text>
          <Text style={{ color: colors.text.tertiary }} className="text-sm mt-1">You do not have finance permissions</Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.screen }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        {(showFinanceTopHeader || !isWebDesktop) && !isDesktopExpenseSplitView && !isDesktopRefundSplitView && !isDesktopProcurementSplitView ? (
          <View
            style={isWebDesktop ? {
              paddingHorizontal: webDesktopGutterPad,
              borderBottomWidth: showTopHeaderDivider ? 1 : 0,
              borderBottomColor: colors.divider,
            } : undefined}
          >
            <View
              className="px-5 pt-6 pb-2"
              style={isWebDesktop ? {
                maxWidth: 1440,
                width: '100%',
                alignSelf: 'flex-start',
                minHeight: desktopFinanceHeaderMinHeight,
                justifyContent: 'center',
              } : undefined}
            >
              {showFinanceTopHeader ? (
                <>
                  <View className="flex-row items-start justify-between" style={{ gap: 12 }}>
                    <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                      <Text style={{ color: colors.text.primary, ...pageHeadingStyle }}>{financeHeaderTitle}</Text>
                      <Text style={{ color: colors.text.tertiary }} className="text-sm mt-1">{financeHeaderSubtitle}</Text>
                    </View>
                    <View className="flex-row items-center" style={{ gap: 8, marginTop: 2 }}>
                      {canAccessFinance && (isWebDesktop || activeTab === 'overview') ? (
                        <FyllAiButton
                          label={isWebDesktop ? 'Fyll AI Finance' : 'Fyll AI'}
                          onPress={() => setShowFinanceAiPanel(true)}
                          height={40}
                          borderRadius={20}
                          iconSize={14}
                          textSize={13}
                          horizontalPadding={12}
                        />
                      ) : null}

                    {canCreateExpenseRequest && (
                        activeTab === 'expenses'
                        || activeTab === 'procurement'
                      ) ? (
                        <FyllAiButton
                          label="Fyll AI Draft"
                          onPress={() => {
                            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            openAiModal();
                          }}
                          height={40}
                          borderRadius={20}
                          iconSize={14}
                          textSize={13}
                          horizontalPadding={12}
                        />
                      ) : null}

                      {isWebDesktop && activeTab === 'expenses' && canCreateExpenseRequest ? (
                        <Pressable
                          onPress={() => {
                            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            openExpenseComposer();
                          }}
                          className="rounded-full active:opacity-80 px-3.5 flex-row items-center"
                          style={{ height: 40, backgroundColor: colors.bar }}
                        >
                          <Plus size={18} color={colors.bg.screen} strokeWidth={2.5} />
                          <Text style={{ color: colors.bg.screen }} className="font-semibold ml-1.5 text-sm">Add Expense</Text>
                        </Pressable>
                      ) : null}

                      {isWebDesktop && activeTab === 'refunds' && canCreateRefundRequest ? (
                        <Pressable
                          onPress={() => {
                            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            openRefundRequestComposer();
                          }}
                          className="rounded-full active:opacity-80 px-3.5 flex-row items-center"
                          style={{ height: 40, backgroundColor: colors.bar }}
                        >
                          <Plus size={18} color={colors.bg.screen} strokeWidth={2.5} />
                          <Text style={{ color: colors.bg.screen }} className="font-semibold ml-1.5 text-sm">New Refund</Text>
                        </Pressable>
                      ) : null}

                      {isWebDesktop && activeTab === 'procurement' && canCreateProcurementRequest ? (
                        <Pressable
                          onPress={() => {
                            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            openProcurementComposer();
                          }}
                          className="rounded-full active:opacity-80 px-3.5 flex-row items-center"
                          style={{ height: 40, backgroundColor: colors.bar }}
                        >
                          <Plus size={18} color={colors.bg.screen} strokeWidth={2.5} />
                          <Text style={{ color: colors.bg.screen }} className="font-semibold ml-1.5 text-sm">New PO</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                </>
              ) : null}

              {!isWebDesktop ? (
                <View style={{ marginTop: 16 }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {visibleTabOptions.map((tab) => {
                      const isActive = activeTab === tab.key;
                      const Icon = tab.icon;

                      return (
                        <Pressable
                          key={tab.key}
                          onPress={() => selectTab(tab.key)}
                          className="px-4 rounded-full flex-row items-center justify-center"
                          style={{
                            minWidth: isWebDesktop ? 168 : isTablet ? 164 : 134,
                            height: 44,
                            backgroundColor: isActive ? colors.bar : 'transparent',
                            borderWidth: isActive ? 0 : 1,
                            borderColor: colors.divider,
                          }}
                        >
                          <Icon
                            size={15}
                            color={isActive ? colors.bg.screen : colors.text.tertiary}
                            strokeWidth={2.25}
                          />
                          <Text
                            style={{ color: isActive ? colors.bg.screen : colors.text.tertiary }}
                            className="font-semibold text-base ml-2"
                            numberOfLines={1}
                          >
                            {tab.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}

              {isMobile && (isFinanceApprover || isManagerRole) && (activeTab === 'expenses' || activeTab === 'refunds' || activeTab === 'procurement') ? (
                <View className="mt-4" style={{ paddingBottom: 10 }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 2 }}>
                    {overviewRangeOptions.map((option) => {
                      const isActive = activeTab === 'expenses'
                        ? expensePeriod === option.key
                        : activeTab === 'refunds'
                          ? refundPeriod === option.key
                        : procurementPeriod === option.key;
                      return (
                        <FinanceFilterPill
                          key={option.key}
                          label={option.label}
                          active={isActive}
                          onPress={() => {
                            if (activeTab === 'expenses') {
                              setExpensePeriod(option.key);
                            } else if (activeTab === 'refunds') {
                              setRefundPeriod(option.key);
                            } else {
                              setProcurementPeriod(option.key);
                            }
                          }}
                          colors={colors}
                        />
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {!isMobile && activeTab === 'expenses' && (isFinanceApprover || Boolean(selectedExpenseId)) ? (
          isShowingWebExpenseApprovals ? (
            // Full-height approval workspace — no ScrollView, fills entire content area
            <View style={{ flex: 1, paddingHorizontal: isWebDesktop ? webDesktopGutterPad : 0, paddingBottom: 16 }}>
              <View style={{ flex: 1, maxWidth: 1440, width: '100%', paddingHorizontal: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 }}>
                  <Pressable
                    onPress={() => setExpenseWorkspaceView('list')}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 34, borderRadius: 100, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card }}
                  >
                    <ChevronLeft size={15} color={colors.text.secondary} strokeWidth={2.5} />
                    <Text style={{ color: colors.text.secondary, fontSize: 13, fontWeight: '600' }}>Back to Expenses</Text>
                  </Pressable>
                </View>
                <View style={{ flex: 1 }}>
                  {renderExpenseApprovalWorkspacePanels()}
                </View>
              </View>
            </View>
          ) : (
            // Normal split view for expense list — header lives inside left column on desktop
            <View style={{ flex: 1, flexDirection: 'row' }}>
              <View style={{ flex: 1, flexDirection: 'column' }}>
                {/* Finance page header inside the left column (desktop only) */}
                {isWebDesktop ? (
                  <View style={{ paddingHorizontal: webDesktopGutterPad, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
                    <View
                      className="px-5 pt-5 pb-4"
                      style={{ maxWidth: 1440, width: '100%', minHeight: desktopFinanceHeaderMinHeight, justifyContent: 'center' }}
                    >
                      <View className="flex-row items-start justify-between" style={{ gap: 12 }}>
                        <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                          <Text style={{ color: colors.text.primary, ...pageHeadingStyle }}>{financeHeaderTitle}</Text>
                          <Text style={{ color: colors.text.tertiary }} className="text-sm mt-1">{financeHeaderSubtitle}</Text>
                        </View>
                        <View className="flex-row items-center" style={{ gap: 8, marginTop: 2 }}>
                          {canCreateExpenseRequest ? (
                            <FyllAiButton
                              label="Fyll AI Draft"
                              onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); openAiModal(); }}
                              height={40}
                              borderRadius={20}
                              iconSize={14}
                              textSize={13}
                              horizontalPadding={12}
                            />
                          ) : null}
                          {canCreateExpenseRequest ? (
                            <Pressable
                              onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); openExpenseComposer(); }}
                              className="rounded-full active:opacity-80 px-3.5 flex-row items-center"
                              style={{ height: 40, backgroundColor: colors.bar }}
                            >
                              <Plus size={18} color={colors.bg.screen} strokeWidth={2.5} />
                              <Text style={{ color: colors.bg.screen }} className="font-semibold ml-1.5 text-sm">Add Expense</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  </View>
                ) : null}
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  style={{ flex: 1, maxWidth: selectedExpenseId ? undefined : 1440 }}
                  contentContainerStyle={{
                    paddingLeft: 20 + (isWebDesktop ? webDesktopGutterPad : 0),
                    paddingRight: 20,
                    paddingTop: isWebDesktop ? 20 : 0,
                    paddingBottom: tabBarHeight + 24,
                  }}
                >
                  {renderActiveSection()}
                </ScrollView>
              </View>
              {selectedExpenseId ? (
                <View style={{ width: splitDetailPanelWidth, borderLeftWidth: 1, borderLeftColor: colors.divider }}>
                  <ExpenseDetailPanel
                    expenseId={selectedExpenseId}
                    compact={isDetailPanelCompact}
                    onClose={() => setSelectedExpenseId(null)}
                    onEdit={(id) => { openExpenseEditor(id); }}
                    onDelete={(id) => { handleDeleteExpense(id); setSelectedExpenseId(null); }}
                  />
                </View>
              ) : null}
            </View>
          )
        ) : !isMobile && activeTab === 'refunds' && isDesktopRefundSplitView ? (
          <View style={{ flex: 1, flexDirection: 'row' }}>
            <View style={{ flex: 1, flexDirection: 'column' }}>
              {isWebDesktop ? (
                <View style={{ paddingHorizontal: webDesktopGutterPad, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
                  <View
                    className="px-5 pt-5 pb-4"
                    style={{ maxWidth: 1440, width: '100%', minHeight: desktopFinanceHeaderMinHeight, justifyContent: 'center' }}
                  >
                    <View className="flex-row items-start justify-between" style={{ gap: 12 }}>
                      <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                        <Text style={{ color: colors.text.primary, ...pageHeadingStyle }}>{financeHeaderTitle}</Text>
                        <Text style={{ color: colors.text.tertiary }} className="text-sm mt-1">{financeHeaderSubtitle}</Text>
                      </View>
                      <View className="flex-row items-center" style={{ gap: 8, marginTop: 2 }}>
                        {canCreateRefundRequest ? (
                          <Pressable
                            onPress={() => {
                              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                              openRefundRequestComposer();
                            }}
                            className="rounded-full active:opacity-80 px-3.5 flex-row items-center"
                            style={{ height: 40, backgroundColor: colors.bar }}
                          >
                            <Plus size={18} color={colors.bg.screen} strokeWidth={2.5} />
                            <Text style={{ color: colors.bg.screen }} className="font-semibold ml-1.5 text-sm">New Refund</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  </View>
                </View>
              ) : null}
              <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ flex: 1, maxWidth: 1440 }}
                contentContainerStyle={{
                  paddingLeft: 20 + (isWebDesktop ? webDesktopGutterPad : 0),
                  paddingRight: 20,
                  paddingTop: isWebDesktop ? 20 : 0,
                  paddingBottom: tabBarHeight + 24,
                }}
              >
                {renderActiveSection()}
              </ScrollView>
            </View>
            <View style={{ width: splitDetailPanelWidth, borderLeftWidth: 1, borderLeftColor: colors.divider }}>
              {renderRefundRequestDetailPanel()}
            </View>
          </View>
        ) :!isMobile && activeTab === 'procurement' && isShowingWebProcurementApprovals ? (
          // Full-height procurement approval workspace
          <View style={{ flex: 1, paddingHorizontal: isWebDesktop ? webDesktopGutterPad : 0, paddingBottom: 16 }}>
            <View style={{ flex: 1, maxWidth: 1440, width: '100%', paddingHorizontal: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 }}>
                <Pressable
                  onPress={() => setProcurementWorkspaceView('list')}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 34, borderRadius: 100, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card }}
                >
                  <ChevronLeft size={15} color={colors.text.secondary} strokeWidth={2.5} />
                  <Text style={{ color: colors.text.secondary, fontSize: 13, fontWeight: '600' }}>Back to Procurement</Text>
                </Pressable>
              </View>
              <View style={{ flex: 1 }}>
                {renderProcurementApprovalWorkspacePanels()}
              </View>
            </View>
          </View>
        ) :!isMobile && activeTab === 'procurement' && (isFinanceApprover || Boolean(selectedProcurementId)) ? (
          // Split view for procurement tab on tablet/desktop — header lives inside left column
          <View style={{ flex: 1, flexDirection: 'row' }}>
            <View style={{ flex: 1, flexDirection: 'column' }}>
              {/* Finance page header inside the left column (desktop only) */}
              {isWebDesktop ? (
                <View style={{ paddingHorizontal: webDesktopGutterPad, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
                  <View
                    className="px-5 pt-5 pb-4"
                    style={{ maxWidth: 1440, width: '100%', minHeight: desktopFinanceHeaderMinHeight, justifyContent: 'center' }}
                  >
                    <View className="flex-row items-start justify-between" style={{ gap: 12 }}>
                      <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                        <Text style={{ color: colors.text.primary, ...pageHeadingStyle }}>{financeHeaderTitle}</Text>
                        <Text style={{ color: colors.text.tertiary }} className="text-sm mt-1">{financeHeaderSubtitle}</Text>
                      </View>
                      <View className="flex-row items-center" style={{ gap: 8, marginTop: 2 }}>
                        {canCreateExpenseRequest ? (
                          <FyllAiButton
                            label="Fyll AI Draft"
                            onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); openAiModal(); }}
                            height={40}
                            borderRadius={20}
                            iconSize={14}
                            textSize={13}
                            horizontalPadding={12}
                          />
                        ) : null}
                        {canCreateProcurementRequest ? (
                          <Pressable
                            onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); openProcurementComposer(); }}
                            className="rounded-full active:opacity-80 px-3.5 flex-row items-center"
                            style={{ height: 40, backgroundColor: colors.bar }}
                          >
                            <Plus size={18} color={colors.bg.screen} strokeWidth={2.5} />
                            <Text style={{ color: colors.bg.screen }} className="font-semibold ml-1.5 text-sm">New PO</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  </View>
                </View>
              ) : null}
              <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ flex: 1, maxWidth: selectedProcurementId ? undefined : 1440 }}
                contentContainerStyle={{
                  paddingLeft: 20 + (isWebDesktop ? webDesktopGutterPad : 0),
                  paddingRight: 20,
                  paddingTop: isWebDesktop ? 20 : 0,
                  paddingBottom: tabBarHeight + 24,
                }}
              >
                {renderActiveSection()}
              </ScrollView>
            </View>
            {selectedProcurementId ? (
              <View style={{ width: splitDetailPanelWidth, borderLeftWidth: 1, borderLeftColor: colors.divider }}>
                <ProcurementDetailPanel
                  procurementId={selectedProcurementId}
                  compact={isDetailPanelCompact}
                  onClose={() => setSelectedProcurementId(null)}
                  onEdit={(id) => { openProcurementEditor(id); setSelectedProcurementId(null); }}
                  onDelete={(id) => { handleDeleteProcurement(id); setSelectedProcurementId(null); }}
                />
              </View>
            ) : null}
          </View>
        ) : (
          <View style={[{ flex: 1 }, isWebDesktop ? { paddingHorizontal: webDesktopGutterPad, alignItems: 'flex-start' } : undefined]}>
            <ScrollView
              className="flex-1"
              showsVerticalScrollIndicator={false}
              style={isWebDesktop ? { flex: 1, maxWidth: 1440, width: '100%', alignSelf: 'flex-start' } : undefined}
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingTop: isWebDesktop && (activeTab === 'expenses' || activeTab === 'refunds' || activeTab === 'procurement') ? 20 : isWebDesktop ? 12 : 0,
                paddingBottom: tabBarHeight + 24,
              }}
            >
              {renderActiveSection()}
            </ScrollView>
          </View>
        )}
      </SafeAreaView>

      <Modal
        visible={showExpenseFilterSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExpenseFilterSheet(false)}
      >
        <Pressable
          className="flex-1 justify-end"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onPress={() => setShowExpenseFilterSheet(false)}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            className="rounded-t-3xl"
            style={{
              backgroundColor: colors.bg.screen,
              maxHeight: '72%',
              width: '100%',
            }}
          >
            <View className="items-center py-3">
              <View className="w-10 h-1 rounded-full" style={{ backgroundColor: colors.divider }} />
            </View>

            <View
              className="flex-row items-center justify-between px-5 pb-4"
              style={{ borderBottomWidth: 0.5, borderBottomColor: colors.divider }}
            >
              <Text style={{ color: colors.text.primary }} className="font-bold text-lg">
                Filter & Sort Expenses
              </Text>
              <Pressable
                onPress={() => setShowExpenseFilterSheet(false)}
                className="w-8 h-8 rounded-full items-center justify-center active:opacity-50"
                style={{ backgroundColor: colors.bg.input }}
              >
                <X size={18} color={colors.text.tertiary} strokeWidth={2} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="px-5 pt-4 pb-2">
                <Text style={{ color: colors.text.muted }} className="text-xs font-semibold uppercase tracking-wider mb-3">
                  Sort By
                </Text>

                {expenseSortOptions.map((option) => {
                  const isActive = expenseSort === option.key;
                  const iconNode = option.key === 'newest' || option.key === 'oldest'
                    ? <Clock size={18} color={isActive ? colors.bar : colors.text.muted} strokeWidth={2} />
                    : option.key === 'amount-low'
                      ? <TrendingDown size={18} color={isActive ? colors.bar : colors.text.muted} strokeWidth={2} />
                      : <TrendingUp size={18} color={isActive ? colors.bar : colors.text.muted} strokeWidth={2} />;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => {
                        void Haptics.selectionAsync();
                        setExpenseSort(option.key);
                      }}
                      className="flex-row items-center py-3 active:opacity-70"
                    >
                      {iconNode}
                      <View className="flex-1 ml-3">
                        <Text style={{ color: colors.text.primary }} className="font-medium text-sm">{option.label}</Text>
                      </View>
                      {isActive ? (
                        <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: colors.bar }}>
                          <Check size={12} color={colors.bg.screen} strokeWidth={3} />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              <View className="px-5 pt-4" style={{ borderTopWidth: 0.5, borderTopColor: colors.divider, marginTop: 8 }}>
                <Text style={{ color: colors.text.muted }} className="text-xs font-semibold uppercase tracking-wider mb-3">
                  Filter
                </Text>

                {[
                  { key: 'all', label: 'All expenses', description: 'Every expense record', icon: Receipt },
                  { key: 'one-time', label: 'One-time only', description: 'Single purchases or costs', icon: FileText },
                  { key: 'recurring', label: 'Recurring only', description: 'Subscriptions or repeated costs', icon: Calendar },
                ].map((option) => {
                  const Icon = option.icon;
                  const isActive = expenseFilter === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => {
                        void Haptics.selectionAsync();
                        setExpenseFilter(option.key as ExpenseFilter);
                      }}
                      className="flex-row items-center py-3 active:opacity-70"
                    >
                      <Icon size={18} color={isActive ? colors.bar : colors.text.muted} strokeWidth={2} />
                      <View className="flex-1 ml-3">
                        <Text style={{ color: colors.text.primary }} className="font-medium text-sm">{option.label}</Text>
                        <Text style={{ color: colors.text.muted }} className="text-xs mt-0.5">{option.description}</Text>
                      </View>
                      {isActive ? (
                        <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: colors.bar }}>
                          <Check size={12} color={colors.bg.screen} strokeWidth={3} />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              <View className="px-5 py-4" style={{ gap: 10 }}>
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setExpenseFilter('all');
                    setExpenseSort('newest');
                  }}
                  className="rounded-xl items-center justify-center"
                  style={{ height: 42, backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.divider }}
                >
                  <Text style={{ color: colors.text.primary }} className="text-sm font-semibold">Clear filters</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setShowExpenseFilterSheet(false);
                  }}
                  className="rounded-xl items-center justify-center active:opacity-80"
                  style={{ height: 50, backgroundColor: colors.bar }}
                >
                  <Text style={{ color: colors.bg.screen }} className="font-semibold">Apply</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showExpenseRequestFilterSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExpenseRequestFilterSheet(false)}
      >
        <Pressable
          className="flex-1 justify-end"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onPress={() => setShowExpenseRequestFilterSheet(false)}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            className="rounded-t-3xl"
            style={{
              backgroundColor: colors.bg.screen,
              maxHeight: '72%',
              width: '100%',
            }}
          >
            <View className="items-center py-3">
              <View className="w-10 h-1 rounded-full" style={{ backgroundColor: colors.divider }} />
            </View>

            <View
              className="flex-row items-center justify-between px-5 pb-4"
              style={{ borderBottomWidth: 0.5, borderBottomColor: colors.divider }}
            >
              <Text style={{ color: colors.text.primary }} className="font-bold text-lg">
                Filter & Sort Requests
              </Text>
              <Pressable
                onPress={() => setShowExpenseRequestFilterSheet(false)}
                className="w-8 h-8 rounded-full items-center justify-center active:opacity-50"
                style={{ backgroundColor: colors.bg.input }}
              >
                <X size={18} color={colors.text.tertiary} strokeWidth={2} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="px-5 pt-4 pb-2">
                <Text style={{ color: colors.text.muted }} className="text-xs font-semibold uppercase tracking-wider mb-3">
                  Sort By
                </Text>

                {expenseSortOptions.map((option) => {
                  const isActive = expenseRequestSort === option.key;
                  const iconNode = option.key === 'newest' || option.key === 'oldest'
                    ? <Clock size={18} color={isActive ? colors.bar : colors.text.muted} strokeWidth={2} />
                    : option.key === 'amount-low'
                      ? <TrendingDown size={18} color={isActive ? colors.bar : colors.text.muted} strokeWidth={2} />
                      : <TrendingUp size={18} color={isActive ? colors.bar : colors.text.muted} strokeWidth={2} />;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => {
                        void Haptics.selectionAsync();
                        setExpenseRequestSort(option.key);
                      }}
                      className="flex-row items-center py-3 active:opacity-70"
                    >
                      {iconNode}
                      <View className="flex-1 ml-3">
                        <Text style={{ color: colors.text.primary }} className="font-medium text-sm">{option.label}</Text>
                      </View>
                      {isActive ? (
                        <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: colors.bar }}>
                          <Check size={12} color={colors.bg.screen} strokeWidth={3} />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              <View className="px-5 pt-4" style={{ borderTopWidth: 0.5, borderTopColor: colors.divider, marginTop: 8 }}>
                <Text style={{ color: colors.text.muted }} className="text-xs font-semibold uppercase tracking-wider mb-3">
                  Filter
                </Text>

                {[
                  { key: 'all', label: 'All requests', description: 'Draft, submitted, approved, and rejected', icon: Receipt },
                  { key: 'draft', label: 'Draft only', description: 'Saved but not submitted', icon: FileText },
                  { key: 'submitted', label: 'Submitted only', description: 'Waiting for admin review', icon: Clock },
                  { key: 'approved', label: 'Approved only', description: 'Already approved by admin', icon: Check },
                  { key: 'rejected', label: 'Rejected only', description: 'Needs changes and resubmission', icon: X },
                ].map((option) => {
                  const Icon = option.icon;
                  const isActive = expenseRequestFilter === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => {
                        void Haptics.selectionAsync();
                        setExpenseRequestFilter(option.key as ExpenseRequestFilter);
                      }}
                      className="flex-row items-center py-3 active:opacity-70"
                    >
                      <Icon size={18} color={isActive ? colors.bar : colors.text.muted} strokeWidth={2} />
                      <View className="flex-1 ml-3">
                        <Text style={{ color: colors.text.primary }} className="font-medium text-sm">{option.label}</Text>
                        <Text style={{ color: colors.text.muted }} className="text-xs mt-0.5">{option.description}</Text>
                      </View>
                      {isActive ? (
                        <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: colors.bar }}>
                          <Check size={12} color={colors.bg.screen} strokeWidth={3} />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              <View className="px-5 py-4" style={{ gap: 10 }}>
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setExpenseRequestFilter('all');
                    setExpenseRequestSort('newest');
                  }}
                  className="rounded-xl items-center justify-center"
                  style={{ height: 42, backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.divider }}
                >
                  <Text style={{ color: colors.text.primary }} className="text-sm font-semibold">Clear filters</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setShowExpenseRequestFilterSheet(false);
                  }}
                  className="rounded-xl items-center justify-center active:opacity-80"
                  style={{ height: 50, backgroundColor: colors.bar }}
                >
                  <Text style={{ color: colors.bg.screen }} className="font-semibold">Apply</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showRefundRequestFilterSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRefundRequestFilterSheet(false)}
      >
        <Pressable
          className="flex-1 justify-end"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onPress={() => setShowRefundRequestFilterSheet(false)}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            className="rounded-t-3xl"
            style={{
              backgroundColor: colors.bg.screen,
              maxHeight: '72%',
              width: '100%',
            }}
          >
            <View className="items-center py-3">
              <View className="w-10 h-1 rounded-full" style={{ backgroundColor: colors.divider }} />
            </View>

            <View
              className="flex-row items-center justify-between px-5 pb-4"
              style={{ borderBottomWidth: 0.5, borderBottomColor: colors.divider }}
            >
              <Text style={{ color: colors.text.primary }} className="font-bold text-lg">
                Filter & Sort Refunds
              </Text>
              <Pressable
                onPress={() => setShowRefundRequestFilterSheet(false)}
                className="w-8 h-8 rounded-full items-center justify-center active:opacity-50"
                style={{ backgroundColor: colors.bg.input }}
              >
                <X size={18} color={colors.text.tertiary} strokeWidth={2} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="px-5 pt-4 pb-2">
                <Text style={{ color: colors.text.muted }} className="text-xs font-semibold uppercase tracking-wider mb-3">
                  Sort By
                </Text>

                {expenseSortOptions.map((option) => {
                  const isActive = refundSort === option.key;
                  const iconNode = option.key === 'newest' || option.key === 'oldest'
                    ? <Clock size={18} color={isActive ? colors.bar : colors.text.muted} strokeWidth={2} />
                    : option.key === 'amount-low'
                      ? <TrendingDown size={18} color={isActive ? colors.bar : colors.text.muted} strokeWidth={2} />
                      : <TrendingUp size={18} color={isActive ? colors.bar : colors.text.muted} strokeWidth={2} />;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => {
                        void Haptics.selectionAsync();
                        setRefundSort(option.key);
                      }}
                      className="flex-row items-center py-3 active:opacity-70"
                    >
                      {iconNode}
                      <View className="flex-1 ml-3">
                        <Text style={{ color: colors.text.primary }} className="font-medium text-sm">{option.label}</Text>
                      </View>
                      {isActive ? (
                        <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: colors.bar }}>
                          <Check size={12} color={colors.bg.screen} strokeWidth={3} />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              <View className="px-5 pt-4" style={{ borderTopWidth: 0.5, borderTopColor: colors.divider, marginTop: 8 }}>
                <Text style={{ color: colors.text.muted }} className="text-xs font-semibold uppercase tracking-wider mb-3">
                  Filter
                </Text>

                {[
                  { key: 'all', label: 'All refunds', description: 'Draft, submitted, approved, paid, and rejected', icon: Receipt },
                  { key: 'draft', label: 'Draft only', description: 'Saved but not submitted', icon: FileText },
                  { key: 'submitted', label: 'Submitted only', description: 'Waiting for admin review', icon: Clock },
                  { key: 'approved', label: 'Approved only', description: 'Waiting for payout confirmation', icon: Check },
                  { key: 'paid', label: 'Paid only', description: 'Refund completed and tied back to the order', icon: Check },
                  { key: 'rejected', label: 'Rejected only', description: 'Needs changes and resubmission', icon: X },
                ].map((option) => {
                  const Icon = option.icon;
                  const isActive = refundRequestFilter === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => {
                        void Haptics.selectionAsync();
                        setRefundRequestFilter(option.key as RefundRequestFilter);
                      }}
                      className="flex-row items-center py-3 active:opacity-70"
                    >
                      <Icon size={18} color={isActive ? colors.bar : colors.text.muted} strokeWidth={2} />
                      <View className="flex-1 ml-3">
                        <Text style={{ color: colors.text.primary }} className="font-medium text-sm">{option.label}</Text>
                        <Text style={{ color: colors.text.muted }} className="text-xs mt-0.5">{option.description}</Text>
                      </View>
                      {isActive ? (
                        <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: colors.bar }}>
                          <Check size={12} color={colors.bg.screen} strokeWidth={3} />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              <View className="px-5 py-4" style={{ gap: 10 }}>
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setRefundRequestFilter('all');
                    setRefundSort('newest');
                  }}
                  className="rounded-xl items-center justify-center"
                  style={{ height: 42, backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.divider }}
                >
                  <Text style={{ color: colors.text.primary }} className="text-sm font-semibold">Clear filters</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setShowRefundRequestFilterSheet(false);
                  }}
                  className="rounded-xl items-center justify-center active:opacity-80"
                  style={{ height: 50, backgroundColor: colors.bar }}
                >
                  <Text style={{ color: colors.bg.screen }} className="font-semibold">Apply</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showProcurementFilterSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowProcurementFilterSheet(false)}
      >
        <Pressable
          className="flex-1 justify-end"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onPress={() => setShowProcurementFilterSheet(false)}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            className="rounded-t-3xl"
            style={{
              backgroundColor: colors.bg.screen,
              maxHeight: '72%',
              width: '100%',
            }}
          >
            <View className="items-center py-3">
              <View className="w-10 h-1 rounded-full" style={{ backgroundColor: colors.divider }} />
            </View>

            <View
              className="flex-row items-center justify-between px-5 pb-4"
              style={{ borderBottomWidth: 0.5, borderBottomColor: colors.divider }}
            >
              <Text style={{ color: colors.text.primary }} className="font-bold text-lg">
                Filter & Sort Procurement
              </Text>
              <Pressable
                onPress={() => setShowProcurementFilterSheet(false)}
                className="w-8 h-8 rounded-full items-center justify-center active:opacity-50"
                style={{ backgroundColor: colors.bg.input }}
              >
                <X size={18} color={colors.text.tertiary} strokeWidth={2} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="px-5 pt-4 pb-2">
                <Text style={{ color: colors.text.muted }} className="text-xs font-semibold uppercase tracking-wider mb-3">
                  Sort By
                </Text>

                {procurementSortOptions.map((option) => {
                  const isActive = procurementSort === option.key;
                  const iconNode = option.key === 'workflow'
                    ? <Filter size={18} color={isActive ? colors.bar : colors.text.muted} strokeWidth={2} />
                    : option.key === 'newest' || option.key === 'oldest'
                      ? <Clock size={18} color={isActive ? colors.bar : colors.text.muted} strokeWidth={2} />
                      : option.key === 'amount-low'
                        ? <TrendingDown size={18} color={isActive ? colors.bar : colors.text.muted} strokeWidth={2} />
                        : <TrendingUp size={18} color={isActive ? colors.bar : colors.text.muted} strokeWidth={2} />;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => {
                        void Haptics.selectionAsync();
                        setProcurementSort(option.key);
                      }}
                      className="flex-row items-center py-3 active:opacity-70"
                    >
                      {iconNode}
                      <View className="flex-1 ml-3">
                        <Text style={{ color: colors.text.primary }} className="font-medium text-sm">{option.label}</Text>
                      </View>
                      {isActive ? (
                        <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: colors.bar }}>
                          <Check size={12} color={colors.bg.screen} strokeWidth={3} />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              <View className="px-5 pt-4" style={{ borderTopWidth: 0.5, borderTopColor: colors.divider, marginTop: 8 }}>
                <Text style={{ color: colors.text.muted }} className="text-xs font-semibold uppercase tracking-wider mb-3">
                  Filter
                </Text>

                {procurementFilterOptions.map((option) => {
                  const isActive = procurementFilter === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => {
                        void Haptics.selectionAsync();
                        setProcurementFilter(option.key);
                      }}
                      className="flex-row items-center py-3 active:opacity-70"
                    >
                      <Truck size={18} color={isActive ? colors.bar : colors.text.muted} strokeWidth={2} />
                      <View className="flex-1 ml-3">
                        <Text style={{ color: colors.text.primary }} className="font-medium text-sm">{option.label}</Text>
                        <Text style={{ color: colors.text.muted }} className="text-xs mt-0.5">
                          {option.key === 'all' ? 'Every purchase order' : `Only ${option.label.toLowerCase()} orders`}
                        </Text>
                      </View>
                      {isActive ? (
                        <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: colors.bar }}>
                          <Check size={12} color={colors.bg.screen} strokeWidth={3} />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              <View className="px-5 py-4" style={{ gap: 10 }}>
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setProcurementFilter('all');
                    setProcurementSort('workflow');
                  }}
                  className="rounded-xl items-center justify-center"
                  style={{ height: 42, backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.divider }}
                >
                  <Text style={{ color: colors.text.primary }} className="text-sm font-semibold">Clear filters</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setShowProcurementFilterSheet(false);
                  }}
                  className="rounded-xl items-center justify-center active:opacity-80"
                  style={{ height: 50, backgroundColor: colors.bar }}
                >
                  <Text style={{ color: colors.bg.screen }} className="font-semibold">Apply</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={isMobile && mobileDetail !== null}
        animationType="none"
        onRequestClose={() => setMobileDetail(null)}
      >
        <View className="flex-1" style={{ backgroundColor: colors.bg.screen }}>
          <SafeAreaView className="flex-1" edges={['top']}>
            <View className="px-4 pt-3 pb-2 flex-row items-center justify-between" style={{ borderBottomWidth: 1, borderBottomColor: colors.divider }}>
              <Text style={{ color: colors.text.primary }} className="text-lg font-semibold">
                {mobileDetail?.kind === 'expense' ? 'Expense Details'
                  : mobileDetail?.kind === 'procurement' ? 'Purchase Order Details'
                    : mobileDetail?.kind === 'supplier' ? 'Supplier Details'
                      : mobileDetail?.kind === 'category' ? 'Category Details'
                        : mobileDetail?.kind === 'fixed-cost' ? 'Fixed Cost Details'
                          : 'Status Details'}
              </Text>
              <Pressable
                onPress={() => setMobileDetail(null)}
                className="rounded-full items-center justify-center"
                style={{ backgroundColor: colors.bg.input, width: 40, height: 40 }}
              >
                <X size={20} color={colors.text.secondary} strokeWidth={2.5} />
              </Pressable>
            </View>

            <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: tabBarHeight + 16 }}>
              {mobileDetail?.kind === 'expense' && selectedMobileExpense ? (
                <View style={{ gap: 12 }}>
                  <View className="rounded-2xl p-5" style={colors.getCardStyle()}>
                    <View className="items-center">
                      <View className="rounded-2xl items-center justify-center mb-3" style={{ width: 54, height: 54, backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.divider }}>
                        <Receipt size={22} color={colors.text.tertiary} strokeWidth={2.2} />
                      </View>
                      <Text style={{ color: colors.text.tertiary }} className="text-xs font-normal uppercase tracking-wider mb-1">
                        {selectedMobileExpense.name}
                      </Text>
                      <Text style={{ color: colors.text.primary, fontSize: 44, lineHeight: 48, fontWeight: '500' }}>
                        {formatCurrency(selectedMobileExpense.amount)}
                      </Text>
                      <Text style={{ color: colors.text.secondary }} className="text-sm mt-1">
                        Paid on {selectedMobileExpense.date}
                      </Text>
                    </View>
                  </View>

                  <View className="rounded-2xl p-4" style={colors.getCardStyle()}>
                    <Text style={{ color: colors.text.tertiary }} className="text-xs uppercase font-semibold mb-3">Payment Breakdown</Text>
                    {selectedMobileExpenseLineItems.map((line, index) => (
                      <View key={line.id} className="flex-row items-center justify-between" style={{ marginBottom: index === selectedMobileExpenseLineItems.length - 1 ? 0 : 10 }}>
                        <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                          <Text numberOfLines={1} style={{ color: index === 0 ? colors.text.primary : colors.text.secondary }} className="text-sm font-medium">
                            {line.label}
                          </Text>
                          <Text numberOfLines={1} style={{ color: colors.text.muted, fontSize: 12 }} className="mt-0.5">
                            {line.category}
                          </Text>
                        </View>
                        <Text style={{ color: colors.text.primary }} className="text-sm font-semibold">
                          {formatCurrency(line.amount)}
                        </Text>
                      </View>
                    ))}
                    <View className="flex-row items-center justify-between mt-3 pt-3" style={{ borderTopWidth: 1, borderTopColor: colors.divider }}>
                      <Text style={{ color: colors.text.secondary }} className="text-base font-semibold">Total Logged</Text>
                      <Text style={{ color: colors.text.primary }} className="text-base font-medium">{formatCurrency(selectedMobileExpense.amount)}</Text>
                    </View>
                  </View>

                  <View className="rounded-2xl p-4" style={colors.getCardStyle()}>
                    <View className="flex-row items-center justify-between">
                      <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                        <Text style={{ color: colors.text.tertiary }} className="text-xs uppercase font-semibold mb-1">Supplier / Merchant</Text>
                        <Text style={{ color: colors.text.primary }} className="text-lg font-semibold">{selectedMobileExpense.merchant || '-'}</Text>
                      </View>
                      <StatusBadge label={formatExpenseTypeLabel(selectedMobileExpense.type)} colors={colors} compact maxWidth={120} />
                    </View>
                    <View className="mt-3 pt-3" style={{ borderTopWidth: 1, borderTopColor: colors.divider }}>
                      <Text style={{ color: colors.text.tertiary }} className="text-xs uppercase font-semibold mb-1">Primary Category</Text>
                      <Text style={{ color: colors.text.primary }} className="text-lg font-semibold">{selectedMobileExpense.category}</Text>
                    </View>
                  </View>

                  {selectedMobileExpenseRecord ? (
                    <View className="rounded-2xl p-4" style={colors.getCardStyle()}>
                      <Text style={{ color: colors.text.tertiary }} className="text-xs uppercase font-semibold mb-1">Notes</Text>
                      <Text style={{ color: colors.text.primary }} className="text-sm">
                        {extractMetadataValue(selectedMobileExpenseRecord.description, 'note') || '-'}
                      </Text>
                    </View>
                  ) : null}
                  {selectedMobileExpenseReceipts.length > 0 ? (
                    <View style={{ gap: 10 }}>
                      {selectedMobileExpenseReceipts.map((receipt) => (
                        <Pressable
                          key={receipt.id}
                          onPress={() => { void handleOpenExpenseReceipt(receipt.storagePath); }}
                          className="rounded-2xl px-4 py-3 flex-row items-center"
                          style={colors.getCardStyle()}
                        >
                          <View className="rounded-xl items-center justify-center" style={{ width: 42, height: 42, backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.divider }}>
                            <Receipt size={18} color={colors.text.tertiary} strokeWidth={2} />
                          </View>
                          <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
                            <Text style={{ color: colors.text.primary }} className="text-base font-semibold" numberOfLines={1}>{receipt.fileName}</Text>
                            <Text style={{ color: colors.text.secondary }} className="text-sm" numberOfLines={1}>Tap to view receipt</Text>
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}

                  <View className="flex-row" style={{ gap: 10 }}>
                    <Pressable
                      onPress={() => {
                        const expenseId = selectedMobileExpense.id;
                        setMobileDetail(null);
                        openExpenseEditor(expenseId);
                      }}
                      className="flex-1 rounded-xl"
                      style={{ height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.divider }}
                    >
                      <Text style={{ color: colors.text.secondary }} className="font-semibold">Edit</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        handleDeleteExpense(selectedMobileExpense.id);
                        setMobileDetail(null);
                      }}
                      className="flex-1 rounded-xl"
                      style={{ height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.danger }}
                    >
                      <Text style={{ color: '#FFFFFF' }} className="font-semibold">Delete</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {mobileDetail?.kind === 'procurement' && selectedMobileProcurement ? (
                <View style={{ gap: 12 }}>
                  <View className="rounded-2xl p-5" style={colors.getCardStyle()}>
                    <View className="items-center">
                      <View className="rounded-2xl items-center justify-center mb-3" style={{ width: 54, height: 54, backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.divider }}>
                        <Truck size={22} color={colors.text.tertiary} strokeWidth={2.2} />
                      </View>
                      <Text style={{ color: colors.text.tertiary }} className="text-xs font-normal uppercase tracking-wider mb-1">
                        {selectedMobileProcurement.title?.trim() || selectedMobileProcurement.supplier || 'Purchase Order'}
                      </Text>
                      <Text style={{ color: colors.text.primary, fontSize: 40, lineHeight: 44, fontWeight: '500' }}>
                        {formatCurrency(selectedMobileProcurement.total)}
                      </Text>
                      <Text style={{ color: colors.text.secondary }} className="text-sm mt-1">
                        {selectedMobileProcurement.poNumber} · Paid on {selectedMobileProcurement.paidDate}
                      </Text>
                    </View>
                  </View>

                  <View className="rounded-2xl p-4" style={colors.getCardStyle()}>
                    <View className="flex-row items-center justify-between">
                      <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                        <Text style={{ color: colors.text.tertiary }} className="text-xs uppercase font-semibold mb-1">Supplier</Text>
                        <Text style={{ color: colors.text.primary }} className="text-lg font-semibold">{selectedMobileProcurement.supplier}</Text>
                      </View>
                      <StatusBadge label={selectedMobileProcurement.status} colors={colors} compact maxWidth={120} />
                    </View>
                    <View className="mt-3 pt-3 flex-row items-center justify-between" style={{ borderTopWidth: 1, borderTopColor: colors.divider }}>
                      <View>
                        <Text style={{ color: colors.text.tertiary }} className="text-xs uppercase font-semibold mb-1">Line Items</Text>
                        <Text style={{ color: colors.text.primary }} className="text-base font-semibold">{selectedMobileProcurement.lineCount}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ color: colors.text.tertiary }} className="text-xs uppercase font-semibold mb-1">Date Paid</Text>
                        <Text style={{ color: colors.text.primary }} className="text-base font-semibold">{selectedMobileProcurement.paidDate}</Text>
                        <Text style={{ color: colors.text.tertiary }} className="text-xs uppercase font-semibold mt-2 mb-1">Date Received</Text>
                        <Text style={{ color: colors.text.primary }} className="text-base font-semibold">{selectedMobileProcurement.receivedDate}</Text>
                      </View>
                    </View>
                  </View>
                  {selectedMobileProcurementRecord ? (
                    <View className="rounded-2xl p-4" style={colors.getCardStyle()}>
                      <Text style={{ color: colors.text.tertiary }} className="text-xs uppercase font-semibold mb-1">Notes</Text>
                      <Text style={{ color: colors.text.primary }} className="text-sm">{stripMetadata(selectedMobileProcurementRecord.notes) || '-'}</Text>
                    </View>
                  ) : null}

                  <View className="flex-row" style={{ gap: 10 }}>
                    <Pressable
                      onPress={() => {
                        const procurementId = selectedMobileProcurement.id;
                        setMobileDetail(null);
                        openProcurementEditor(procurementId);
                      }}
                      className="flex-1 rounded-xl"
                      style={{ height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.divider }}
                    >
                      <Text style={{ color: colors.text.secondary }} className="font-semibold">Edit</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        handleDeleteProcurement(selectedMobileProcurement.id);
                        setMobileDetail(null);
                      }}
                      className="flex-1 rounded-xl"
                      style={{ height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.danger }}
                    >
                      <Text style={{ color: '#FFFFFF' }} className="font-semibold">Delete</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {mobileDetail?.kind === 'supplier' && selectedMobileSupplier ? (
                <View style={{ gap: 12 }}>
                  <View className="rounded-2xl p-4" style={colors.getCardStyle()}>
                    <Text style={{ color: colors.text.tertiary }} className="text-xs uppercase font-semibold mb-1">Supplier Name</Text>
                    <Text style={{ color: colors.text.primary }} className="text-base font-semibold">{selectedMobileSupplier.name}</Text>
                  </View>
                  <View className="rounded-2xl p-4" style={colors.getCardStyle()}>
                    <Text style={{ color: colors.text.tertiary }} className="text-xs uppercase font-semibold mb-1">Contact</Text>
                    <Text style={{ color: colors.text.primary }} className="text-sm">{selectedMobileSupplier.contactName || '-'}</Text>
                  </View>
                  <View className="rounded-2xl p-4" style={colors.getCardStyle()}>
                    <Text style={{ color: colors.text.tertiary }} className="text-xs uppercase font-semibold mb-1">Email</Text>
                    <Text style={{ color: colors.text.primary }} className="text-sm">{selectedMobileSupplier.email || '-'}</Text>
                  </View>
                  <View className="rounded-2xl p-4" style={colors.getCardStyle()}>
                    <Text style={{ color: colors.text.tertiary }} className="text-xs uppercase font-semibold mb-1">Payment Terms</Text>
                    <Text style={{ color: colors.text.primary }} className="text-sm">{selectedMobileSupplier.paymentTerms || '-'}</Text>
                  </View>
                </View>
              ) : null}

              {mobileDetail?.kind === 'category' && selectedMobileCategory ? (
                <View style={{ gap: 12 }}>
                  <View className="rounded-2xl p-4" style={colors.getCardStyle()}>
                    <Text style={{ color: colors.text.tertiary }} className="text-xs uppercase font-semibold mb-1">Category</Text>
                    <Text style={{ color: colors.text.primary }} className="text-base font-semibold">{selectedMobileCategory.name}</Text>
                  </View>
                </View>
              ) : null}

              {mobileDetail?.kind === 'fixed-cost' && selectedMobileFixedCost ? (
                <View style={{ gap: 12 }}>
                  <View className="rounded-2xl p-4" style={colors.getCardStyle()}>
                    <Text style={{ color: colors.text.tertiary }} className="text-xs uppercase font-semibold mb-1">Name</Text>
                    <Text style={{ color: colors.text.primary }} className="text-base font-semibold">{selectedMobileFixedCost.name}</Text>
                  </View>
                  <View className="rounded-2xl p-4" style={colors.getCardStyle()}>
                    <Text style={{ color: colors.text.tertiary }} className="text-xs uppercase font-semibold mb-1">Amount</Text>
                    <Text style={{ color: colors.text.primary }} className="text-base font-semibold">{formatCurrency(selectedMobileFixedCost.amount)}</Text>
                  </View>
                  <View className="rounded-2xl p-4" style={colors.getCardStyle()}>
                    <Text style={{ color: colors.text.tertiary }} className="text-xs uppercase font-semibold mb-1">Category</Text>
                    <Text style={{ color: colors.text.primary }} className="text-sm">{selectedMobileFixedCost.category}</Text>
                  </View>
                  <View className="rounded-2xl p-4" style={colors.getCardStyle()}>
                    <Text style={{ color: colors.text.tertiary }} className="text-xs uppercase font-semibold mb-1">Frequency</Text>
                    <Text style={{ color: colors.text.primary }} className="text-sm">{selectedMobileFixedCost.frequency}</Text>
                  </View>
                  <View className="rounded-2xl p-4" style={colors.getCardStyle()}>
                    <Text style={{ color: colors.text.tertiary }} className="text-xs uppercase font-semibold mb-1">Supplier / Merchant</Text>
                    <Text style={{ color: colors.text.primary }} className="text-sm">{selectedMobileFixedCost.supplierName || '-'}</Text>
                  </View>
                  <View className="rounded-2xl p-4" style={colors.getCardStyle()}>
                    <Text style={{ color: colors.text.tertiary }} className="text-xs uppercase font-semibold mb-1">Notes</Text>
                    <Text style={{ color: colors.text.primary }} className="text-sm">{selectedMobileFixedCost.notes || '-'}</Text>
                  </View>
                </View>
              ) : null}

              {mobileDetail?.kind === 'status' && selectedMobileStatus ? (
                <View style={{ gap: 12 }}>
                  <View className="rounded-2xl p-4" style={colors.getCardStyle()}>
                    <Text style={{ color: colors.text.tertiary }} className="text-xs uppercase font-semibold mb-1">Status</Text>
                    <Text style={{ color: colors.text.primary }} className="text-base font-semibold">{selectedMobileStatus.name}</Text>
                  </View>
                  <View className="rounded-2xl p-4" style={colors.getCardStyle()}>
                    <Text style={{ color: colors.text.tertiary }} className="text-xs uppercase font-semibold mb-1">Order</Text>
                    <Text style={{ color: colors.text.primary }} className="text-sm">#{selectedMobileStatus.order}</Text>
                  </View>
                </View>
              ) : null}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      <Modal
        visible={showExpenseAiModal}
        transparent
        animationType="none"
        onRequestClose={() => {
          setShowExpenseAiModal(false);
          setExpenseUploadError('');
          setIsGeneratingExpenseDraft(false);
          setAiStep('choose');
          setAiParsedDrafts([]);
          setAiParsedProcurementDraft(null);
          setExpenseReceiptAssets([]);
        }}
      >
        <Pressable
          className={isWebDesktop ? 'flex-1 items-center justify-center' : 'flex-1'}
          style={{ backgroundColor: isWebDesktop ? 'rgba(0, 0, 0, 0.6)' : colors.bg.screen }}
          onPress={() => {
            setShowExpenseAiModal(false);
            setExpenseUploadError('');
            setIsGeneratingExpenseDraft(false);
            setAiStep('choose');
            setAiParsedDrafts([]);
            setAiParsedProcurementDraft(null);
            setExpenseReceiptAssets([]);
          }}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              width: isWebDesktop ? '92%' : '100%',
              maxWidth: isWebDesktop ? 620 : undefined,
              height: isWebDesktop ? undefined : '100%',
              borderRadius: isWebDesktop ? 20 : 0,
              borderWidth: 1,
              borderColor: colors.divider,
              backgroundColor: colors.bg.card,
              overflow: 'visible',
              padding: isWebDesktop ? 20 : 16,
              paddingTop: isWebDesktop ? 20 : 24,
            }}
          >
            <View className="flex-row items-center justify-between">
              <View style={{ flex: 1, marginRight: 12 }}>
                {aiStep === 'upload' ? (
                  <Pressable onPress={() => { setAiStep('choose'); setExpenseReceiptAssets([]); setExpenseUploadError(''); setAiParsedDrafts([]); setAiParsedProcurementDraft(null); }} className="flex-row items-center mb-1" style={{ gap: 4 }}>
                    <ChevronLeft size={16} color={colors.accent} strokeWidth={2.5} />
                    <Text style={{ color: colors.accent, fontSize: 13 }} className="font-semibold">Back</Text>
                  </Pressable>
                ) : aiStep === 'review' ? (
                  <Pressable onPress={() => { setAiStep('upload'); setAiParsedDrafts([]); setAiParsedProcurementDraft(null); }} className="flex-row items-center mb-1" style={{ gap: 4 }}>
                    <ChevronLeft size={16} color={colors.accent} strokeWidth={2.5} />
                    <Text style={{ color: colors.accent, fontSize: 13 }} className="font-semibold">Back</Text>
                  </Pressable>
                ) : null}
                <Text style={{ color: colors.text.primary }} className="text-xl font-bold">
                  {aiStep === 'choose'
                    ? 'Fyll AI'
                    : aiStep === 'review'
                      ? aiType === 'procurement'
                        ? 'Review Procurement Draft'
                        : `Review ${aiParsedDrafts.length} Expense${aiParsedDrafts.length !== 1 ? 's' : ''}`
                      : aiType === 'expense'
                        ? 'Fyll AI Expense Draft'
                        : 'Fyll AI Procurement Draft'}
                </Text>
                <Text style={{ color: colors.text.tertiary }} className="text-sm mt-1">
                  {aiStep === 'choose'
                    ? 'What would you like to create?'
                    : aiStep === 'review'
                      ? aiType === 'procurement'
                        ? 'Review the parsed PO draft, then approve to continue.'
                        : 'Review parsed draft(s), then approve before saving.'
                      : 'Upload receipt(s) and Fyll AI will prefill your draft.'}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setShowExpenseAiModal(false);
                  setExpenseUploadError('');
                  setIsGeneratingExpenseDraft(false);
                  setAiStep('choose');
                  setAiParsedDrafts([]);
                  setAiParsedProcurementDraft(null);
                  setExpenseReceiptAssets([]);
                }}
                className="rounded-full items-center justify-center"
                style={{ backgroundColor: colors.bg.input, width: 40, height: 40 }}
              >
                <X size={20} color={colors.text.secondary} strokeWidth={2.5} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={isWebDesktop ? { maxHeight: 520 } : { flex: 1 }}
              contentContainerStyle={{ paddingBottom: 12 }}
            >
              {aiStep === 'choose' ? (
                <View className="mt-5" style={{ gap: 12 }}>
                  <Pressable
                    onPress={() => { setAiType('expense'); setAiStep('upload'); setAiParsedDrafts([]); setAiParsedProcurementDraft(null); }}
                    className="rounded-2xl flex-row items-center px-5"
                    style={{
                      paddingVertical: 20,
                      borderWidth: 1.5,
                      borderColor: colors.divider,
                      backgroundColor: colors.bg.input,
                      gap: 14,
                    }}
                  >
                    <View className="rounded-2xl items-center justify-center" style={{ width: 52, height: 52, backgroundColor: '#7C3AED18' }}>
                      <Receipt size={24} color="#7C3AED" strokeWidth={2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text.primary }} className="text-base font-bold">Expense</Text>
                      <Text style={{ color: colors.text.tertiary, marginTop: 2 }} className="text-sm">Log a business cost from a receipt or invoice</Text>
                    </View>
                    <ChevronRight size={18} color={colors.text.muted} strokeWidth={2} />
                  </Pressable>

                  <Pressable
                    onPress={() => { setAiType('procurement'); setAiStep('upload'); setAiParsedDrafts([]); setAiParsedProcurementDraft(null); }}
                    className="rounded-2xl flex-row items-center px-5"
                    style={{
                      paddingVertical: 20,
                      borderWidth: 1.5,
                      borderColor: colors.divider,
                      backgroundColor: colors.bg.input,
                      gap: 14,
                    }}
                  >
                    <View className="rounded-2xl items-center justify-center" style={{ width: 52, height: 52, backgroundColor: '#0EA5E918' }}>
                      <ShoppingCart size={24} color="#0EA5E9" strokeWidth={2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text.primary }} className="text-base font-bold">Procurement</Text>
                      <Text style={{ color: colors.text.tertiary, marginTop: 2 }} className="text-sm">Create a purchase order from an invoice or quote</Text>
                    </View>
                    <ChevronRight size={18} color={colors.text.muted} strokeWidth={2} />
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setShowExpenseAiModal(false);
                      setAiStep('choose');
                      setAiParsedDrafts([]);
                      setAiParsedProcurementDraft(null);
                      setExpenseUploadError('');
                      setIsGeneratingExpenseDraft(false);
                      setExpenseReceiptAssets([]);
                    }}
                    className="rounded-full items-center justify-center mt-2"
                    style={{ height: 44, borderWidth: 1, borderColor: colors.divider }}
                  >
                    <Text style={{ color: colors.text.secondary }} className="font-semibold">Cancel</Text>
                  </Pressable>
                </View>
              ) : aiStep === 'review' ? (
                aiType === 'procurement' ? (
                  <View className="mt-4" style={{ gap: 10 }}>
                    {aiParsedProcurementDraft ? (
                      <View
                        className="rounded-2xl px-4 py-4"
                        style={{ borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.input, gap: 8 }}
                      >
                        <Text style={{ color: colors.text.primary, fontSize: 16 }} className="font-bold" numberOfLines={2}>
                          {aiParsedProcurementDraft.title || 'Procurement Draft'}
                        </Text>
                        {aiParsedProcurementDraft.supplier ? (
                          <Text style={{ color: colors.text.tertiary, fontSize: 13 }}>{aiParsedProcurementDraft.supplier}</Text>
                        ) : null}
                        <View className="flex-row flex-wrap" style={{ gap: 6, marginTop: 2 }}>
                          <View className="rounded-lg px-2.5 py-1" style={{ backgroundColor: colors.bg.screen, borderWidth: 1, borderColor: colors.divider }}>
                            <Text style={{ color: colors.text.primary, fontSize: 13 }} className="font-semibold">
                              {formatCurrency(aiParsedProcurementDraft.totalCost)}
                            </Text>
                          </View>
                          <View className="rounded-lg px-2.5 py-1" style={{ backgroundColor: colors.bg.screen, borderWidth: 1, borderColor: colors.divider }}>
                            <Text style={{ color: colors.text.secondary, fontSize: 12 }}>{aiParsedProcurementDraft.expectedDate}</Text>
                          </View>
                          <View className="rounded-lg px-2.5 py-1" style={{ backgroundColor: aiParsedProcurementDraft.confidence === 'high' ? '#16A34A18' : aiParsedProcurementDraft.confidence === 'medium' ? '#CA8A0418' : '#DC262618', borderWidth: 1, borderColor: aiParsedProcurementDraft.confidence === 'high' ? '#16A34A40' : aiParsedProcurementDraft.confidence === 'medium' ? '#CA8A0440' : '#DC262640' }}>
                            <Text style={{ color: aiParsedProcurementDraft.confidence === 'high' ? '#16A34A' : aiParsedProcurementDraft.confidence === 'medium' ? '#CA8A04' : '#DC2626', fontSize: 11 }} className="font-semibold capitalize">{aiParsedProcurementDraft.confidence}</Text>
                          </View>
                        </View>
                      </View>
                    ) : (
                      <View className="items-center py-8">
                        <Text style={{ color: colors.text.muted, fontSize: 14 }}>No procurement draft to review.</Text>
                      </View>
                    )}

                    <View className="flex-row justify-end mt-2" style={{ gap: 10 }}>
                      <Pressable
                        onPress={() => {
                          setAiStep('choose');
                          setAiParsedDrafts([]);
                          setAiParsedProcurementDraft(null);
                          setShowExpenseAiModal(false);
                          setExpenseReceiptAssets([]);
                        }}
                        className="rounded-full px-6"
                        style={{ height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.divider }}
                      >
                        <Text style={{ color: colors.text.secondary }} className="font-semibold">Cancel</Text>
                      </Pressable>
                      <Pressable
                        onPress={handleApproveProcurementReview}
                        disabled={!aiParsedProcurementDraft}
                        className="overflow-hidden"
                        style={{ height: 44, borderRadius: 999, opacity: aiParsedProcurementDraft ? 1 : 0.4 }}
                      >
                        <LinearGradient
                          colors={['#0369A1', '#0EA5E9', '#38BDF8']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={{ height: 44, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                        >
                          <Check size={15} color="#FFFFFF" strokeWidth={2.5} />
                          <Text style={{ color: '#FFFFFF' }} className="font-semibold">Approve & Continue</Text>
                        </LinearGradient>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View className="mt-4" style={{ gap: 10 }}>
                    {aiParsedDrafts.map((draft, index) => (
                      <View
                        key={index}
                        className="rounded-2xl px-4 py-4"
                        style={{ borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.input, gap: 6 }}
                      >
                        <View className="flex-row items-start justify-between" style={{ gap: 8 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.text.primary, fontSize: 15 }} className="font-bold" numberOfLines={2}>
                              {draft.name || `Expense ${index + 1}`}
                            </Text>
                            {draft.merchant ? (
                              <Text style={{ color: colors.text.tertiary, fontSize: 12, marginTop: 1 }}>{draft.merchant}</Text>
                            ) : null}
                          </View>
                          <Pressable
                            onPress={() => setAiParsedDrafts((prev) => prev.filter((_, i) => i !== index))}
                            className="rounded-full items-center justify-center"
                            style={{ width: 28, height: 28, backgroundColor: colors.bg.screen, borderWidth: 1, borderColor: colors.divider, marginTop: 2 }}
                          >
                            <X size={14} color={colors.text.tertiary} strokeWidth={2.5} />
                          </Pressable>
                        </View>
                        <View className="flex-row flex-wrap" style={{ gap: 6, marginTop: 2 }}>
                          <View className="rounded-lg px-2.5 py-1" style={{ backgroundColor: colors.bg.screen, borderWidth: 1, borderColor: colors.divider }}>
                            <Text style={{ color: colors.text.primary, fontSize: 13 }} className="font-semibold">
                              {formatCurrency(draft.amount)}
                            </Text>
                          </View>
                          {draft.category ? (
                            <View className="rounded-lg px-2.5 py-1" style={{ backgroundColor: colors.bg.screen, borderWidth: 1, borderColor: colors.divider }}>
                              <Text style={{ color: colors.text.secondary, fontSize: 12 }}>{draft.category}</Text>
                            </View>
                          ) : null}
                          {draft.expenseDate ? (
                            <View className="rounded-lg px-2.5 py-1" style={{ backgroundColor: colors.bg.screen, borderWidth: 1, borderColor: colors.divider }}>
                              <Text style={{ color: colors.text.secondary, fontSize: 12 }}>{draft.expenseDate}</Text>
                            </View>
                          ) : null}
                          <View className="rounded-lg px-2.5 py-1" style={{ backgroundColor: draft.confidence === 'high' ? '#16A34A18' : draft.confidence === 'medium' ? '#CA8A0418' : '#DC262618', borderWidth: 1, borderColor: draft.confidence === 'high' ? '#16A34A40' : draft.confidence === 'medium' ? '#CA8A0440' : '#DC262640' }}>
                            <Text style={{ color: draft.confidence === 'high' ? '#16A34A' : draft.confidence === 'medium' ? '#CA8A04' : '#DC2626', fontSize: 11 }} className="font-semibold capitalize">{draft.confidence}</Text>
                          </View>
                        </View>
                      </View>
                    ))}

                    {aiParsedDrafts.length === 0 ? (
                      <View className="items-center py-8">
                        <Text style={{ color: colors.text.muted, fontSize: 14 }}>All drafts removed.</Text>
                      </View>
                    ) : null}

                    <View className="flex-row justify-end mt-2" style={{ gap: 10 }}>
                      <Pressable
                        onPress={() => {
                          setAiStep('choose');
                          setAiParsedDrafts([]);
                          setAiParsedProcurementDraft(null);
                          setShowExpenseAiModal(false);
                          setExpenseReceiptAssets([]);
                        }}
                        className="rounded-full px-6"
                        style={{ height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.divider }}
                      >
                        <Text style={{ color: colors.text.secondary }} className="font-semibold">Cancel</Text>
                      </Pressable>
                      {aiParsedDrafts.length === 1 ? (
                        <Pressable
                          onPress={handleApproveExpenseReview}
                          className="overflow-hidden"
                          style={{ height: 44, borderRadius: 999 }}
                        >
                          <LinearGradient
                            colors={['#7C3AED', '#9333EA', '#A855F7']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={{ height: 44, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                          >
                            <Check size={15} color="#FFFFFF" strokeWidth={2.5} />
                            <Text style={{ color: '#FFFFFF' }} className="font-semibold">Approve & Continue</Text>
                          </LinearGradient>
                        </Pressable>
                      ) : (
                        <Pressable
                          onPress={handleSaveAiDrafts}
                          disabled={aiParsedDrafts.length === 0}
                          className="overflow-hidden"
                          style={{ height: 44, borderRadius: 999, opacity: aiParsedDrafts.length === 0 ? 0.4 : 1 }}
                        >
                          <LinearGradient
                            colors={['#7C3AED', '#9333EA', '#A855F7']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={{ height: 44, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                          >
                            <Check size={15} color="#FFFFFF" strokeWidth={2.5} />
                            <Text style={{ color: '#FFFFFF' }} className="font-semibold">
                              Approve & Save {aiParsedDrafts.length} Expense{aiParsedDrafts.length !== 1 ? 's' : ''}
                            </Text>
                          </LinearGradient>
                        </Pressable>
                      )}
                    </View>
                  </View>
                )
              ) : (
                <View className="mt-5" style={{ gap: 12 }}>
                  {expenseReceiptAssets.length === 0 ? (
                    <Pressable
                      onPress={pickExpenseReceipt}
                      className="rounded-2xl items-center justify-center"
                      style={{
                        paddingVertical: 28,
                        borderWidth: 1.5,
                        borderColor: colors.divider,
                        borderStyle: 'dashed',
                      }}
                    >
                      <View
                        className="rounded-full items-center justify-center mb-3"
                        style={{ width: 48, height: 48, backgroundColor: colors.bg.screen, borderWidth: 1, borderColor: colors.divider }}
                      >
                        <Camera size={22} color={colors.text.tertiary} strokeWidth={2} />
                      </View>
                      <Text style={{ color: colors.text.primary }} className="text-base font-semibold">Upload Receipt</Text>
                      <Text style={{ color: colors.text.muted, marginTop: 4 }} className="text-sm">Tap to take a photo or choose file</Text>
                    </Pressable>
                  ) : (
                    <View style={{ gap: 8 }}>
                      {expenseReceiptAssets.map((asset, index) => (
                        <View
                          key={`${asset.uri}-${index}`}
                          className="rounded-xl flex-row items-center px-3"
                          style={{ height: 52, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.input }}
                        >
                          <View className="rounded-lg items-center justify-center" style={{ width: 36, height: 36, backgroundColor: colors.bg.screen, borderWidth: 1, borderColor: colors.divider }}>
                            <FileText size={16} color={colors.text.tertiary} strokeWidth={2} />
                          </View>
                          <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
                            <Text numberOfLines={1} style={{ color: colors.text.primary, fontSize: 14 }} className="font-medium">{asset.name}</Text>
                          </View>
                          <Pressable
                            onPress={() => {
                              setExpenseReceiptAssets((previous) => previous.filter((_, assetIndex) => assetIndex !== index));
                              setExpenseUploadError('');
                            }}
                            className="rounded-md items-center justify-center ml-2"
                            style={{ width: 30, height: 30 }}
                          >
                            <X size={16} color={colors.text.tertiary} strokeWidth={2} />
                          </Pressable>
                        </View>
                      ))}
                      <Pressable
                        onPress={pickExpenseReceipt}
                        className="rounded-xl items-center justify-center"
                        style={{
                          height: 44,
                          borderWidth: 1,
                          borderColor: colors.divider,
                          borderStyle: 'dashed',
                        }}
                      >
                        <Text style={{ color: colors.text.secondary }} className="text-sm font-semibold">+ Add Another File</Text>
                      </Pressable>
                    </View>
                  )}

                  {expenseReceiptAssets.length === 0 ? (
                    <Text style={{ color: colors.text.muted, fontSize: 12 }}>
                      Tip: images work best for AI parsing.
                    </Text>
                  ) : null}

                  {expenseUploadError ? (
                    <Text style={{ color: colors.danger }} className="text-xs">
                      {expenseUploadError}
                    </Text>
                  ) : null}

                  <View className="flex-row justify-end mt-4" style={{ gap: 10 }}>
                    <Pressable
                      onPress={() => {
                        setShowExpenseAiModal(false);
                        setExpenseUploadError('');
                        setIsGeneratingExpenseDraft(false);
                        setAiStep('choose');
                      }}
                      className="rounded-full px-6"
                      style={{ height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.divider }}
                    >
                      <Text style={{ color: colors.text.secondary }} className="font-semibold">Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => aiType === 'expense'
                        ? handleGenerateExpenseDraftWithAI()
                        : handleGenerateProcurementDraftWithAI()
                      }
                      disabled={isGeneratingExpenseDraft || expenseReceiptAssets.length === 0}
                      className="overflow-hidden"
                      style={{
                        height: 44,
                        borderRadius: 999,
                        opacity: isGeneratingExpenseDraft || expenseReceiptAssets.length === 0 ? 0.5 : 1,
                      }}
                    >
                      <LinearGradient
                        colors={aiType === 'procurement' ? ['#0369A1', '#0EA5E9', '#38BDF8'] : ['#7C3AED', '#9333EA', '#A855F7']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ height: 44, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Sparkles size={14} color="#FFFFFF" strokeWidth={2.5} />
                        <Text style={{ color: '#FFFFFF' }} className="font-semibold ml-1.5">
                          {isGeneratingExpenseDraft ? 'Analyzing...' : 'Parse & Continue'}
                        </Text>
                      </LinearGradient>
                    </Pressable>
                  </View>
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showRefundRequestModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRefundRequestModal(false)}
      >
        <Pressable
          className={isWebDesktop ? 'flex-1 items-center justify-center' : 'flex-1'}
          style={{ backgroundColor: isWebDesktop ? 'rgba(0, 0, 0, 0.6)' : colors.bg.screen }}
          onPress={() => setShowRefundRequestModal(false)}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              width: isWebDesktop ? '92%' : '100%',
              maxWidth: isWebDesktop ? 680 : undefined,
              height: isWebDesktop ? undefined : '100%',
              borderRadius: isWebDesktop ? 20 : 0,
              borderWidth: 1,
              borderColor: colors.divider,
              backgroundColor: colors.bg.card,
              padding: isWebDesktop ? 20 : 16,
              paddingTop: isWebDesktop ? 20 : insets.top + 16,
            }}
          >
            <View className="flex-row items-center justify-between">
              <Text
                style={{
                  color: colors.text.primary,
                  fontSize: editingRefundRequestId ? 18 : 20,
                  fontWeight: '700',
                }}
              >
                {editingRefundRequestId ? 'Edit Refund Request' : 'New Refund Request'}
              </Text>
              <Pressable
                onPress={() => setShowRefundRequestModal(false)}
                className="rounded-full items-center justify-center"
                style={{ backgroundColor: colors.bg.input, width: 40, height: 40 }}
              >
                <X size={20} color={colors.text.secondary} strokeWidth={2.5} />
              </Pressable>
            </View>
            <View
              style={{
                height: 1,
                backgroundColor: colors.divider,
                marginTop: 12,
                marginBottom: 4,
              }}
            />

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={isWebDesktop ? { maxHeight: 620 } : { flex: 1 }}
              contentContainerStyle={{ paddingBottom: 12 }}
            >
              <View className="mt-5" style={{ gap: 14 }}>
                <View>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs mb-1.5">Order</Text>
                  <TextInput
                    value={refundOrderSearchQuery}
                    onChangeText={(value) => {
                      if (isEditingPaidRefundRequest) return;
                      setRefundOrderSearchQuery(value);
                      if (!selectedRefundOrderId || !value.includes(selectedRefundOrder?.orderNumber ?? '')) {
                        setSelectedRefundOrderId(null);
                      }
                    }}
                    placeholder="Search by order number, customer, phone, or email"
                    placeholderTextColor={colors.text.muted}
                    editable={!isEditingPaidRefundRequest}
                    style={{
                      height: 52,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: formFieldBorder,
                      backgroundColor: formFieldBg,
                      color: colors.text.primary,
                      paddingHorizontal: 14,
                      fontSize: 15,
                      opacity: isEditingPaidRefundRequest ? 0.7 : 1,
                    }}
                  />
                  <View
                    style={{
                      marginTop: 10,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: colors.divider,
                      overflow: 'hidden',
                      backgroundColor: colors.bg.input,
                    }}
                  >
                    {refundOrderMatches.length === 0 ? (
                      <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
                        <Text style={{ color: colors.text.muted, fontSize: 13 }}>No matching orders</Text>
                      </View>
                    ) : refundOrderMatches.map((order) => {
                      const isSelected = selectedRefundOrderId === order.id;
                      const remainingRefundable = Math.max(0, order.totalAmount - (order.refund?.amount ?? 0));
                      return (
                        <Pressable
                          key={order.id}
                          onPress={() => {
                            if (isEditingPaidRefundRequest) return;
                            setSelectedRefundOrderId(order.id);
                            setRefundOrderSearchQuery(`${order.orderNumber} ${order.customerName}`);
                            if (!editingRefundRequestId) {
                              setRefundAmountDraft(String(remainingRefundable));
                            }
                          }}
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 12,
                            borderBottomWidth: order.id === refundOrderMatches[refundOrderMatches.length - 1]?.id ? 0 : 1,
                            borderBottomColor: colors.divider,
                            backgroundColor: isSelected ? colors.bg.card : 'transparent',
                          }}
                        >
                          <View className="flex-row items-center justify-between" style={{ gap: 12 }}>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                                {order.orderNumber}
                              </Text>
                              <Text style={{ color: colors.text.secondary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                                {order.customerName}
                              </Text>
                            </View>
                            <Text style={{ color: colors.text.secondary, fontSize: 12 }}>
                              {formatCurrency(remainingRefundable)}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                  {isEditingPaidRefundRequest ? (
                    <Text style={{ color: colors.text.muted, fontSize: 12, marginTop: 8 }}>
                      Paid refunds keep the original order and refund amount. Use notes or status updates for corrections.
                    </Text>
                  ) : null}
                </View>

                {selectedRefundOrder ? (
                  <View style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.input, padding: 14, gap: 6 }}>
                    <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '700' }}>{selectedRefundOrder.orderNumber}</Text>
                    <Text style={{ color: colors.text.secondary, fontSize: 13 }}>{selectedRefundOrder.customerName}</Text>
                    <Text style={{ color: colors.text.tertiary, fontSize: 12 }}>
                      Remaining refundable: {formatCurrency(Math.max(0, selectedRefundOrder.totalAmount - (selectedRefundOrder.refund?.amount ?? 0)))}
                    </Text>
                  </View>
                ) : null}

                <View>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs mb-1.5">Refund Amount</Text>
                  <TextInput
                    value={refundAmountDraft}
                    onChangeText={setRefundAmountDraft}
                    placeholder="0"
                    keyboardType="decimal-pad"
                    placeholderTextColor={colors.text.muted}
                    editable={!isEditingPaidRefundRequest}
                    style={{
                      height: 52,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: formFieldBorder,
                      backgroundColor: formFieldBg,
                      color: colors.text.primary,
                      paddingHorizontal: 14,
                      fontSize: 15,
                      opacity: isEditingPaidRefundRequest ? 0.7 : 1,
                    }}
                  />
                </View>

                <View
                  style={{
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: colors.divider,
                    backgroundColor: colors.bg.input,
                    padding: 14,
                    gap: 10,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ color: colors.text.tertiary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                      Transfer Charges
                    </Text>
                    <Pressable
                      onPress={() => setApplyRefundBankCharges((prev) => !prev)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                    >
                      <Text style={{ color: colors.text.tertiary, fontSize: 12 }}>Apply fees</Text>
                      <View style={{ width: 38, height: 22, borderRadius: 11, backgroundColor: applyRefundBankCharges ? toggleTrackOn : toggleTrackOff, justifyContent: 'center', paddingHorizontal: 2 }}>
                        <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: toggleKnobColor, marginLeft: applyRefundBankCharges ? 16 : 0 }} />
                      </View>
                    </Pressable>
                  </View>

                  {applyRefundBankCharges ? (
                    <>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: colors.text.tertiary, fontSize: 13 }}>
                          NIP fee + VAT ({(financeRules.vatRate * 100).toFixed(0)}%)
                        </Text>
                        <Text style={{ color: colors.text.secondary, fontSize: 13, fontWeight: '600' }}>
                          {formatCurrency(refundBankChargeAmount)}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: colors.text.tertiary, fontSize: 13 }}>
                          {`Stamp duty (CBN, ≥${STAMP_DUTY_THRESHOLD_LABEL})`}
                        </Text>
                        <Text style={{ color: colors.text.secondary, fontSize: 13, fontWeight: '600' }}>
                          {formatCurrency(refundStampDuty)}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <Text style={{ color: colors.text.muted, fontSize: 12 }}>
                      Bank charges are turned off for this refund.
                    </Text>
                  )}

                  <View
                    style={{
                      borderTopWidth: 1,
                      borderTopColor: colors.divider,
                      paddingTop: 10,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: colors.text.tertiary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                      Total Debit
                    </Text>
                    <Text style={{ color: colors.text.primary, fontSize: 15, fontWeight: '700' }}>
                      {formatCurrency(refundTotalDebit)}
                    </Text>
                  </View>
                </View>

                <View>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs mb-1.5">Requested Refund Date</Text>
                  {Platform.OS === 'web' ? (
                    <View
                      style={{
                        height: 52,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: formFieldBorder,
                        backgroundColor: formFieldBg,
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 14,
                      }}
                    >
                      <Calendar size={18} color={colors.text.tertiary} strokeWidth={2} />
                      <input
                        className="finance-date-input"
                        type="date"
                        value={refundRequestedDate}
                        onChange={(e: any) => setRefundRequestedDate(e.target.value)}
                        disabled={isEditingPaidRefundRequest}
                        style={{
                          flex: 1,
                          border: 'none',
                          outline: 'none',
                          background: 'transparent',
                          color: colors.text.primary,
                          fontSize: 15,
                          marginLeft: 10,
                          fontFamily: 'inherit',
                          colorScheme: isDarkMode ? 'dark' : 'light',
                        }}
                      />
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => {
                        if (isEditingPaidRefundRequest) return;
                        setShowRefundDatePicker(true);
                      }}
                      style={{
                        height: 52,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: formFieldBorder,
                        backgroundColor: formFieldBg,
                        paddingHorizontal: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        opacity: isEditingPaidRefundRequest ? 0.7 : 1,
                      }}
                    >
                      <Calendar size={18} color={colors.text.tertiary} strokeWidth={2} />
                      <Text style={{ color: colors.text.primary, fontSize: 15, marginLeft: 10 }}>
                        {refundRequestedDate || 'Select date'}
                      </Text>
                    </Pressable>
                  )}
                  {showRefundDatePicker && Platform.OS !== 'web' ? (
                    <DateTimePicker
                      value={refundRequestedDate ? new Date(refundRequestedDate + 'T00:00:00') : new Date()}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(_event: any, selectedDate?: Date) => {
                        setShowRefundDatePicker(Platform.OS === 'ios');
                        if (selectedDate) {
                          setRefundRequestedDate(selectedDate.toISOString().split('T')[0]);
                        }
                      }}
                    />
                  ) : null}
                </View>

                <View>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs mb-1.5">Reason</Text>
                  <TextInput
                    value={refundReasonDraft}
                    onChangeText={setRefundReasonDraft}
                    placeholder="Why is this refund needed?"
                    placeholderTextColor={colors.text.muted}
                    multiline
                    textAlignVertical="top"
                    editable={!isEditingPaidRefundRequest}
                    style={{
                      minHeight: 110,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: formFieldBorder,
                      backgroundColor: formFieldBg,
                      color: colors.text.primary,
                      paddingHorizontal: 14,
                      paddingVertical: 14,
                      fontSize: 15,
                      opacity: isEditingPaidRefundRequest ? 0.7 : 1,
                    }}
                  />
                </View>

                <View>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs mb-1.5">Internal Note (optional)</Text>
                  <TextInput
                    value={refundNoteDraft}
                    onChangeText={setRefundNoteDraft}
                    placeholder="Add payout or approval context"
                    placeholderTextColor={colors.text.muted}
                    multiline
                    textAlignVertical="top"
                    style={{
                      minHeight: 90,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: formFieldBorder,
                      backgroundColor: formFieldBg,
                      color: colors.text.primary,
                      paddingHorizontal: 14,
                      paddingVertical: 14,
                      fontSize: 15,
                    }}
                  />
                </View>

                <View>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs mb-1.5">Context screenshots (optional)</Text>
                  {refundAttachmentDrafts.length === 0 ? (
                    <Pressable
                      onPress={pickRefundRequestAttachments}
                      className="rounded-2xl items-center justify-center"
                      style={{
                        minHeight: 148,
                        borderWidth: 1,
                        borderStyle: 'dashed',
                        borderColor: colors.divider,
                        backgroundColor: colors.bg.input,
                        paddingHorizontal: 20,
                        paddingVertical: 24,
                      }}
                    >
                      <View
                        className="rounded-full items-center justify-center mb-3"
                        style={{ width: 48, height: 48, backgroundColor: colors.bg.screen, borderWidth: 1, borderColor: colors.divider }}
                      >
                        <Camera size={22} color={colors.text.tertiary} strokeWidth={2} />
                      </View>
                      <Text style={{ color: colors.text.primary, fontSize: 16, fontWeight: '600' }}>Upload screenshot</Text>
                      <Text style={{ color: colors.text.muted, fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                        Optional context for the refund reason. Refund proof is uploaded after approval.
                      </Text>
                    </Pressable>
                  ) : (
                    <View style={{ gap: 10 }}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 4 }}>
                        {refundAttachmentDrafts.map((attachment) => (
                          <View key={attachment.id} style={{ width: 110 }}>
                            <View
                              className="rounded-2xl overflow-hidden"
                              style={{
                                height: 110,
                                borderWidth: 1,
                                borderColor: colors.divider,
                                backgroundColor: colors.bg.input,
                                position: 'relative',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {attachment.localUri ? (
                                <Image
                                  source={{ uri: attachment.localUri }}
                                  style={{ width: '100%', height: '100%' }}
                                  resizeMode="cover"
                                />
                              ) : (
                                <View className="items-center justify-center px-3">
                                  <FileText size={24} color={colors.text.tertiary} strokeWidth={2} />
                                  <Text
                                    style={{ color: colors.text.secondary, fontSize: 11, marginTop: 8, textAlign: 'center' }}
                                    numberOfLines={2}
                                  >
                                    {attachment.fileName}
                                  </Text>
                                </View>
                              )}
                              <Pressable
                                onPress={() => removeRefundRequestAttachment(attachment.id)}
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
                            <Text
                              style={{ color: colors.text.secondary, fontSize: 11, marginTop: 6, textAlign: 'center' }}
                              numberOfLines={2}
                            >
                              {attachment.fileName}
                            </Text>
                          </View>
                        ))}
                      </ScrollView>

                      <Pressable
                        onPress={pickRefundRequestAttachments}
                        className="rounded-xl items-center justify-center"
                        style={{
                          height: 44,
                          borderWidth: 1,
                          borderStyle: 'dashed',
                          borderColor: colors.divider,
                        }}
                      >
                        <Text style={{ color: colors.text.secondary, fontSize: 13, fontWeight: '600' }}>+ Add Another Image</Text>
                      </Pressable>
                    </View>
                  )}

                  {refundAttachmentError ? (
                    <Text style={{ color: colors.danger, fontSize: 12, marginTop: 8 }}>
                      {refundAttachmentError}
                    </Text>
                  ) : null}
                </View>
              </View>
            </ScrollView>

            <View className="flex-row items-center justify-between mt-4" style={{ gap: 10 }}>
              <View style={{ minWidth: 44 }}>
                {editingRefundRequestId && canManageEditingRefundRequest ? (
                  <View style={{ position: 'relative' }}>
                    <Pressable
                      onPress={() => setRefundComposerActionMenuOpen((previous) => !previous)}
                      className="rounded-full items-center justify-center"
                      style={{
                        width: 44,
                        height: 44,
                        borderWidth: 1,
                        borderColor: colors.divider,
                        backgroundColor: refundComposerActionMenuOpen ? colors.bg.input : colors.bg.card,
                      }}
                    >
                      <MoreVertical size={16} color={colors.text.secondary} strokeWidth={2} />
                    </Pressable>
                    {refundComposerActionMenuOpen ? (
                      <View
                        style={{
                          position: 'absolute',
                          left: 0,
                          bottom: 50,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: colors.divider,
                          backgroundColor: colors.bg.card,
                          zIndex: 50,
                          minWidth: 160,
                          overflow: 'hidden',
                        }}
                      >
                        {editingRefundRequest?.status !== 'void' ? (
                          <Pressable
                            onPress={() => {
                              setRefundComposerActionMenuOpen(false);
                              void handleVoidRefundRequest(editingRefundRequestId, refundNoteDraft);
                              setShowRefundRequestModal(false);
                            }}
                            className="px-3 py-2.5"
                            style={{ borderBottomWidth: 1, borderBottomColor: colors.divider }}
                          >
                            <Text style={{ color: colors.danger }} className="text-sm font-medium">Mark Void</Text>
                          </Pressable>
                        ) : null}
                        <Pressable
                          onPress={() => {
                            setRefundComposerActionMenuOpen(false);
                            void handleDeleteRefundRequest(editingRefundRequestId);
                            setShowRefundRequestModal(false);
                          }}
                          className="px-3 py-2.5"
                        >
                          <Text style={{ color: colors.danger }} className="text-sm font-medium">Delete</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>

              <View className="flex-row items-center justify-end" style={{ gap: 10, flex: 1 }}>
                {isEditingDraftLikeRefundRequest ? (
                  <>
                    <Pressable
                      onPress={() => {
                        setRefundComposerActionMenuOpen(false);
                        handleSaveRefundRequestModal('save');
                      }}
                      className="rounded-full px-5"
                      style={{ height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.divider }}
                    >
                      <Text style={{ color: colors.text.secondary }} className="font-semibold">Save Draft</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setRefundComposerActionMenuOpen(false);
                        void handleSaveRefundRequestModal('submit');
                      }}
                      className="rounded-full px-5"
                      style={{ height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bar }}
                    >
                      <Text style={{ color: colors.bg.screen }} className="font-semibold">Submit</Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    onPress={() => {
                      setRefundComposerActionMenuOpen(false);
                      void handleSaveRefundRequestModal('save');
                    }}
                    className="rounded-full px-5"
                    style={{ height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bar }}
                  >
                    <Text style={{ color: colors.bg.screen }} className="font-semibold">Save Changes</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showRefundRequestDetailModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRefundRequestDetailModal(false)}
      >
        <Pressable
          className={isWebDesktop ? 'flex-1 items-center justify-center' : 'flex-1'}
          style={{ backgroundColor: isWebDesktop ? 'rgba(0, 0, 0, 0.6)' : colors.bg.screen }}
          onPress={() => setShowRefundRequestDetailModal(false)}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              width: isWebDesktop ? '92%' : '100%',
              maxWidth: isWebDesktop ? 620 : undefined,
              height: isWebDesktop ? undefined : '100%',
              borderRadius: isWebDesktop ? 20 : 0,
              borderWidth: 1,
              borderColor: colors.divider,
              backgroundColor: colors.bg.card,
              padding: isWebDesktop ? 20 : 16,
              paddingTop: isWebDesktop ? 20 : insets.top + 16,
            }}
          >
            <View
              className="flex-row items-center justify-between"
              style={{ borderBottomWidth: 1, borderBottomColor: colors.divider, paddingBottom: 12, marginBottom: 12, zIndex: 80, elevation: 28 }}
            >
              <View className="flex-row items-center" style={{ gap: 10 }}>
                <Pressable
                  onPress={() => {
                    setRefundDetailActionMenuOpen(false);
                    setShowRefundRequestDetailModal(false);
                  }}
                  style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.input, alignItems: 'center', justifyContent: 'center' }}
                >
                  <ArrowLeft size={20} color={colors.text.secondary} strokeWidth={2.4} />
                </Pressable>
                <Text style={{ color: colors.text.primary }} className="text-xl font-bold">Refund Details</Text>
              </View>
              {selectedRefundRequest ? renderRefundDetailHeaderActions(selectedRefundRequest, { closeModalOnEdit: true }) : <View style={{ width: 38, height: 38 }} />}
            </View>

            {selectedRefundRequest ? renderRefundRequestDetailBody(selectedRefundRequest, 'modal') : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showExpenseModal} transparent animationType="none" onRequestClose={() => setShowExpenseModal(false)}>
        <Pressable
          className={isWebDesktop ? 'flex-1 items-center justify-center' : 'flex-1'}
          style={{ backgroundColor: isWebDesktop ? 'rgba(0, 0, 0, 0.6)' : colors.bg.screen }}
          onPress={() => {
            setShowExpenseModal(false);
            setEditingExpenseId(null);
            setEditingExpenseRequestId(null);
            setShowExpenseCategoryDropdown(false);
            setShowExpenseMerchantDropdown(false);
            setShowExpenseTypeDropdown(false);
            setActiveBreakdownLineCategoryId(null);
            setBreakdownLineCategorySearch('');
            setExpenseReceiptAssets([]);
            setExpenseUploadError('');
            setIsGeneratingExpenseDraft(false);
            setIsSavingExpense(false);
          }}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              width: isWebDesktop ? '92%' : '100%',
              maxWidth: isWebDesktop ? 760 : undefined,
              height: isWebDesktop ? undefined : '100%',
              borderRadius: isWebDesktop ? 20 : 0,
              borderWidth: 1,
              borderColor: colors.divider,
              backgroundColor: colors.bg.card,
              overflow: 'visible',
              padding: isWebDesktop ? 20 : 16,
              paddingTop: isWebDesktop ? 20 : insets.top + 16,
            }}
          >
            <View className="flex-row items-center justify-between">
              <Text style={{ color: colors.text.primary }} className="text-xl font-bold">
                {expenseModalMode === 'edit' ? 'Edit Expense' : 'Add Expense'}
              </Text>
              <Pressable
                onPress={() => {
                  setShowExpenseModal(false);
                  setEditingExpenseId(null);
                  setEditingExpenseRequestId(null);
                  setShowExpenseCategoryDropdown(false);
                  setShowExpenseMerchantDropdown(false);
                  setShowExpenseTypeDropdown(false);
                  setActiveBreakdownLineCategoryId(null);
                  setBreakdownLineCategorySearch('');
                  setExpenseReceiptAssets([]);
                  setExpenseUploadError('');
                  setIsGeneratingExpenseDraft(false);
                  setIsSavingExpense(false);
                }}
                className="rounded-full items-center justify-center"
                style={{ backgroundColor: colors.bg.input, width: 40, height: 40 }}
              >
                <X size={20} color={colors.text.secondary} strokeWidth={2.5} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={isWebDesktop ? { maxHeight: 620 } : { flex: 1 }}
              contentContainerStyle={{ paddingBottom: 12 }}
            >
            <View className="mt-5" style={{ gap: 14 }}>
              <View>
                <Text style={{ color: colors.text.tertiary }} className="text-xs mb-1.5">Name</Text>
                <TextInput
                  value={expenseName}
                  onChangeText={setExpenseName}
                  placeholder="e.g. Office Rent"
                  placeholderTextColor={colors.text.muted}
                  style={{
                    height: 52,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: formFieldBorder,
                    backgroundColor: formFieldBg,
                    color: colors.text.primary,
                    paddingHorizontal: 14,
                    fontSize: 15,
                  }}
                />
              </View>

              <View>
                <Text style={{ color: colors.text.tertiary }} className="text-xs mb-1.5">Supplier / Merchant</Text>
                <Pressable
                  onPress={() => {
                    setShowExpenseMerchantDropdown((prev) => !prev);
                    setShowExpenseCategoryDropdown(false);
                    setShowExpenseTypeDropdown(false);
                    setActiveBreakdownLineCategoryId(null);
                    setBreakdownLineCategorySearch('');
                    setExpenseMerchantSearch(expenseMerchant);
                  }}
                  style={{
                    height: 52,
                    borderTopLeftRadius: 12,
                    borderTopRightRadius: 12,
                    borderBottomLeftRadius: showExpenseMerchantDropdown ? 0 : 12,
                    borderBottomRightRadius: showExpenseMerchantDropdown ? 0 : 12,
                    borderWidth: 1,
                    borderColor: showExpenseMerchantDropdown ? formFieldActiveBorder : formFieldBorder,
                    backgroundColor: formFieldBg,
                    paddingHorizontal: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{ color: expenseMerchant ? colors.text.primary : colors.text.muted, flex: 1, marginRight: 8, fontSize: 15 }}
                  >
                    {expenseMerchant || 'Select or search merchant'}
                  </Text>
                  <ChevronDown size={16} color={showExpenseMerchantDropdown ? formFieldActiveBorder : colors.text.tertiary} strokeWidth={2} />
                </Pressable>
                {showExpenseMerchantDropdown ? (
                  <View style={{ borderWidth: 1, borderTopWidth: 0, borderColor: formFieldActiveBorder, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, backgroundColor: colors.bg.card, overflow: 'hidden', maxHeight: 220 }}>
                    <View style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
                      <TextInput
                        value={expenseMerchantSearch}
                        onChangeText={setExpenseMerchantSearch}
                        placeholder="Search merchant..."
                        placeholderTextColor={colors.text.muted}
                        autoFocus
                        style={{ height: 40, borderRadius: 10, borderWidth: 1, borderColor: formFieldBorder, backgroundColor: formFieldBg, color: colors.text.primary, paddingHorizontal: 12, fontSize: 14 }}
                      />
                    </View>
                    <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                      <Pressable
                        onPress={() => { setExpenseMerchant(''); setExpenseMerchantSearch(''); setShowExpenseMerchantDropdown(false); }}
                        style={{ paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider, backgroundColor: expenseMerchant === '' ? colors.bg.input : colors.bg.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <Text style={{ color: colors.text.muted, fontSize: 14 }}>No merchant (optional)</Text>
                        {expenseMerchant === '' ? <Check size={14} color={colors.bar} strokeWidth={2.5} /> : null}
                      </Pressable>
                      {filteredExpenseMerchants.map((merchant) => (
                        <Pressable
                          key={merchant}
                          onPress={() => { setExpenseMerchant(merchant); setExpenseMerchantSearch(merchant); setShowExpenseMerchantDropdown(false); }}
                          style={{ paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider, backgroundColor: expenseMerchant === merchant ? colors.bg.input : colors.bg.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                        >
                          <Text style={{ color: colors.text.primary, fontSize: 14 }} className="font-medium">{merchant}</Text>
                          {expenseMerchant === merchant ? <Check size={14} color={colors.bar} strokeWidth={2.5} /> : null}
                        </Pressable>
                      ))}
                      {expenseMerchantSearch.trim() && !availableExpenseMerchants.some((m) => m.toLowerCase() === expenseMerchantSearch.trim().toLowerCase()) ? (
                        <Pressable
                          onPress={() => { const c = expenseMerchantSearch.trim(); upsertFinanceSupplierName(c); setExpenseMerchant(c); setExpenseMerchantSearch(c); setShowExpenseMerchantDropdown(false); }}
                          style={{ paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider, backgroundColor: colors.bg.card }}
                        >
                          <Text style={{ color: colors.bar, fontSize: 14 }} className="font-medium">Use "{expenseMerchantSearch.trim()}"</Text>
                        </Pressable>
                      ) : null}
                      {filteredExpenseMerchants.length === 0 && !expenseMerchantSearch.trim() ? (
                        <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
                          <Text style={{ color: colors.text.muted, fontSize: 13 }}>No merchants yet</Text>
                        </View>
                      ) : null}
                    </ScrollView>
                  </View>
                ) : null}
              </View>

              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.divider,
                  backgroundColor: colors.bg.card,
                  borderRadius: 16,
                  padding: 14,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text style={{ color: colors.text.tertiary, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>Payment Breakdown</Text>
                  <Pressable
                    onPress={() => setApplyBankCharges((prev) => !prev)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                  >
                    <Text style={{ color: colors.text.tertiary, fontSize: 12 }}>Apply fees</Text>
                    <View style={{ width: 38, height: 22, borderRadius: 11, backgroundColor: applyBankCharges ? toggleTrackOn : toggleTrackOff, justifyContent: 'center', paddingHorizontal: 2 }}>
                      <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: toggleKnobColor, marginLeft: applyBankCharges ? 16 : 0 }} />
                    </View>
                  </Pressable>
                </View>

                <View style={{ gap: 10 }}>
                  {expenseLineItems.map((line, index) => {
                    return (
                      <View key={line.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <TextInput
                          value={line.label}
                          onChangeText={(value) => setExpenseLineItems((previous) => previous.map((item) => item.id === line.id ? { ...item, label: value } : item))}
                          placeholder={index === 0 ? 'Base Amount' : 'Charge label'}
                          placeholderTextColor={colors.text.muted}
                          style={{ flex: 3, minWidth: 0, height: 44, borderRadius: 10, borderWidth: 1, borderColor: formFieldBorder, backgroundColor: formFieldBg, color: colors.text.primary, paddingHorizontal: 12, fontSize: 14 }}
                        />
                        <TextInput
                          value={line.amount}
                          onChangeText={(value) => setExpenseLineItems((previous) => previous.map((item) => item.id === line.id ? { ...item, amount: value } : item))}
                          placeholder="0"
                          keyboardType="decimal-pad"
                          placeholderTextColor={colors.text.muted}
                          style={{ flex: 2, minWidth: 0, height: 44, borderRadius: 10, borderWidth: 1, borderColor: formFieldBorder, backgroundColor: formFieldBg, color: colors.text.primary, paddingHorizontal: 12, fontSize: 14 }}
                        />
                        {index > 0 ? (
                          <Pressable
                            onPress={() => { setExpenseLineItems((previous) => previous.filter((item) => item.id !== line.id)); }}
                            style={{ width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: formFieldBorder, backgroundColor: formFieldBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                          >
                            <Trash2 size={14} color={colors.text.tertiary} strokeWidth={2} />
                          </Pressable>
                        ) : null}
                      </View>
                    );
                  })}
                </View>

                {applyBankCharges && bankChargeAmount > 0 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingHorizontal: 2 }}>
                    <View style={{ flex: 3, height: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.divider, borderStyle: 'dashed', backgroundColor: colors.bg.input, justifyContent: 'center', paddingHorizontal: 12 }}>
                      <Text style={{ color: colors.text.tertiary, fontSize: 13 }}>NIP fee + VAT ({(financeRules.vatRate * 100).toFixed(0)}%)</Text>
                    </View>
                    <View style={{ flex: 2, height: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.divider, borderStyle: 'dashed', backgroundColor: colors.bg.input, justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 12 }}>
                      <Text style={{ color: colors.text.secondary, fontSize: 13, fontWeight: '600' }}>{formatCurrency(bankChargeAmount)}</Text>
                    </View>
                  </View>
                ) : null}
                {applyBankCharges && expenseStampDuty > 0 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, paddingHorizontal: 2 }}>
                    <View style={{ flex: 3, height: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.divider, borderStyle: 'dashed', backgroundColor: colors.bg.input, justifyContent: 'center', paddingHorizontal: 12 }}>
                      <Text style={{ color: colors.text.tertiary, fontSize: 13 }}>{`Stamp duty (CBN, ≥${STAMP_DUTY_THRESHOLD_LABEL})`}</Text>
                    </View>
                    <View style={{ flex: 2, height: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.divider, borderStyle: 'dashed', backgroundColor: colors.bg.input, justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 12 }}>
                      <Text style={{ color: colors.text.secondary, fontSize: 13, fontWeight: '600' }}>{formatCurrency(expenseStampDuty)}</Text>
                    </View>
                  </View>
                ) : null}

                <Pressable
                  onPress={() => {
                    setActiveBreakdownLineCategoryId(null);
                    setBreakdownLineCategorySearch('');
                    setExpenseLineItems((previous) => [...previous, {
                      id: `line-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
                      label: '',
                      amount: '',
                      category: normalizeBreakdownCategory(expenseCategory || previous[0]?.category || 'General'),
                      kind: 'charge',
                    }]);
                  }}
                  className="rounded-xl items-center justify-center mt-3"
                  style={{ height: 40, borderWidth: 1, borderColor: formFieldBorder, borderStyle: 'dashed', backgroundColor: formDashedBg }}
                >
                  <Text style={{ color: colors.text.secondary }} className="font-semibold text-sm">+ Add Additional Fee / Expense</Text>
                </Pressable>

                <View className="flex-row items-center justify-between mt-3 pt-3" style={{ borderTopWidth: 1, borderTopColor: colors.divider }}>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase tracking-wider">Total to log</Text>
                  <Text style={{ color: colors.text.primary }} className="text-base font-bold">{formatCurrency(expenseLineItemsTotal)}</Text>
                </View>
              </View>

              <View>
                <Text style={{ color: colors.text.tertiary }} className="text-xs mb-1.5">Date</Text>
                {Platform.OS === 'web' ? (
                  <View
                    style={{
                      height: 52,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: formFieldBorder,
                      backgroundColor: formFieldBg,
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 14,
                    }}
                  >
                    <Calendar size={18} color={colors.text.tertiary} strokeWidth={2} />
                    <input
                      className="finance-date-input"
                      type="date"
                      value={expenseDate}
                      onChange={(e: any) => setExpenseDate(e.target.value)}
                      style={{
                        flex: 1,
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        color: colors.text.primary,
                        fontSize: 15,
                        marginLeft: 10,
                        fontFamily: 'inherit',
                        colorScheme: isDarkMode ? 'dark' : 'light',
                      }}
                    />
                  </View>
                ) : (
                  <Pressable
                    onPress={() => setShowExpenseDatePicker(true)}
                    style={{
                      height: 52,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: formFieldBorder,
                      backgroundColor: formFieldBg,
                      paddingHorizontal: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <Calendar size={18} color={colors.text.tertiary} strokeWidth={2} />
                    <Text style={{ color: colors.text.primary, fontSize: 15, marginLeft: 10 }}>
                      {expenseDate || 'Select date'}
                    </Text>
                  </Pressable>
                )}
                {showExpenseDatePicker && Platform.OS !== 'web' ? (
                  <DateTimePicker
                    value={expenseDate ? new Date(expenseDate + 'T00:00:00') : new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(_event: any, selectedDate?: Date) => {
                      setShowExpenseDatePicker(Platform.OS === 'ios');
                      if (selectedDate) {
                        setExpenseDate(selectedDate.toISOString().split('T')[0]);
                      }
                    }}
                  />
                ) : null}
              </View>

              <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 12 }}>
                {/* Category field */}
                <View style={{ flex: isMobile ? undefined : 1, width: '100%' }}>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs mb-1.5">Category</Text>
                  <Pressable
                    onPress={() => {
                      setShowExpenseCategoryDropdown((prev) => !prev);
                      setShowExpenseMerchantDropdown(false);
                      setShowExpenseTypeDropdown(false);
                      setActiveBreakdownLineCategoryId(null);
                      setBreakdownLineCategorySearch('');
                      setExpenseCategorySearch(expenseCategory);
                    }}
                    style={{
                      height: 52,
                      borderTopLeftRadius: 12,
                      borderTopRightRadius: 12,
                      borderBottomLeftRadius: showExpenseCategoryDropdown ? 0 : 12,
                      borderBottomRightRadius: showExpenseCategoryDropdown ? 0 : 12,
                      borderWidth: 1,
                      borderColor: showExpenseCategoryDropdown ? formFieldActiveBorder : formFieldBorder,
                      backgroundColor: formFieldBg,
                      paddingHorizontal: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text numberOfLines={1} style={{ color: expenseCategory ? colors.text.primary : colors.text.muted, flex: 1, marginRight: 8, fontSize: 15 }}>
                      {expenseCategory || 'Select category'}
                    </Text>
                    <ChevronDown size={16} color={showExpenseCategoryDropdown ? formFieldActiveBorder : colors.text.tertiary} strokeWidth={2} />
                  </Pressable>
                  {showExpenseCategoryDropdown ? (
                    <View style={{ borderWidth: 1, borderTopWidth: 0, borderColor: formFieldActiveBorder, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, backgroundColor: colors.bg.card, overflow: 'hidden', maxHeight: 220 }}>
                      <View style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
                        <TextInput
                          value={expenseCategorySearch}
                          onChangeText={setExpenseCategorySearch}
                          placeholder="Search category..."
                          placeholderTextColor={colors.text.muted}
                          autoFocus
                          style={{ height: 40, borderRadius: 10, borderWidth: 1, borderColor: formFieldBorder, backgroundColor: formFieldBg, color: colors.text.primary, paddingHorizontal: 12, fontSize: 14 }}
                        />
                      </View>
                      <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                        {filteredExpenseCategories.map((category) => (
                          <Pressable
                            key={category}
                            onPress={() => {
                              setExpenseCategory(category);
                              setExpenseCategorySearch(category);
                              setExpenseLineItems((previous) => (
                                previous.length === 0
                                  ? [createBaseBreakdownDraftItem(category)]
                                  : previous.map((line, idx) => idx === 0 ? { ...line, category } : line)
                              ));
                              setShowExpenseCategoryDropdown(false);
                            }}
                            style={{ paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: expenseCategory === category ? colors.bg.input : colors.bg.card }}
                          >
                            <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '500' }}>{category}</Text>
                            {expenseCategory === category ? <Check size={14} color={colors.bar} strokeWidth={2.5} /> : null}
                          </Pressable>
                        ))}
                        {expenseCategorySearch.trim() && !availableExpenseCategories.some((c) => c.toLowerCase() === expenseCategorySearch.trim().toLowerCase()) ? (
                          <Pressable
                            onPress={() => {
                              const custom = expenseCategorySearch.trim();
                              upsertExpenseCategoryName(custom);
                              setExpenseCategory(custom);
                              setExpenseCategorySearch(custom);
                              setExpenseLineItems((previous) => (
                                previous.length === 0
                                  ? [createBaseBreakdownDraftItem(custom)]
                                  : previous.map((line, idx) => idx === 0 ? { ...line, category: custom } : line)
                              ));
                              setShowExpenseCategoryDropdown(false);
                            }}
                            style={{ paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider, backgroundColor: colors.bg.card }}
                          >
                            <Text style={{ color: colors.bar, fontSize: 14, fontWeight: '500' }}>Use "{expenseCategorySearch.trim()}"</Text>
                          </Pressable>
                        ) : null}
                        {filteredExpenseCategories.length === 0 && !expenseCategorySearch.trim() ? (
                          <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
                            <Text style={{ color: colors.text.muted, fontSize: 13 }}>No categories yet</Text>
                          </View>
                        ) : null}
                      </ScrollView>
                    </View>
                  ) : null}
                </View>

                {/* Type field */}
                <View style={{ flex: isMobile ? undefined : 1, width: '100%' }}>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs mb-1.5">Type</Text>
                  <Pressable
                    onPress={() => {
                      setShowExpenseTypeDropdown((prev) => !prev);
                      setShowExpenseCategoryDropdown(false);
                      setShowExpenseMerchantDropdown(false);
                      setActiveBreakdownLineCategoryId(null);
                      setBreakdownLineCategorySearch('');
                    }}
                    style={{
                      height: 52,
                      borderTopLeftRadius: 12,
                      borderTopRightRadius: 12,
                      borderBottomLeftRadius: showExpenseTypeDropdown ? 0 : 12,
                      borderBottomRightRadius: showExpenseTypeDropdown ? 0 : 12,
                      borderWidth: 1,
                      borderColor: showExpenseTypeDropdown ? formFieldActiveBorder : formFieldBorder,
                      backgroundColor: formFieldBg,
                      paddingHorizontal: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text numberOfLines={1} style={{ color: colors.text.primary, flex: 1, marginRight: 8, fontSize: 15 }}>
                      {formatExpenseTypeLabel(expenseTypeDraft)}
                    </Text>
                    <ChevronDown size={16} color={showExpenseTypeDropdown ? formFieldActiveBorder : colors.text.tertiary} strokeWidth={2} />
                  </Pressable>
                  {showExpenseTypeDropdown ? (
                    <View style={{ borderWidth: 1, borderTopWidth: 0, borderColor: formFieldActiveBorder, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, backgroundColor: colors.bg.card, overflow: 'hidden' }}>
                      {expenseTypeOptions.map((option) => (
                        <Pressable
                          key={option}
                          onPress={() => { setExpenseTypeDraft(option); setShowExpenseTypeDropdown(false); if (option === 'one-time') setExpenseFrequencyDraft('Monthly'); }}
                          style={{ paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.divider, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: expenseTypeDraft === option ? colors.bg.input : colors.bg.card }}
                        >
                          <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '500' }}>{formatExpenseTypeLabel(option)}</Text>
                          {expenseTypeDraft === option ? <Check size={14} color={colors.bar} strokeWidth={2.5} /> : null}
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>

              {expenseTypeDraft !== 'one-time' ? (
                <View>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs mb-1.5">Frequency</Text>
                  <View className="flex-row" style={{ gap: 10 }}>
                    {expenseFrequencyOptions.map((option) => (
                      <FinanceFilterPill
                        key={option}
                        label={option}
                        active={expenseFrequencyDraft === option}
                        onPress={() => setExpenseFrequencyDraft(option)}
                        colors={colors}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              {/* Payment Status */}
              <View>
                <Text style={{ color: colors.text.tertiary }} className="text-xs mb-2">Payment Status</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {([
                    { key: 'draft' as ExpensePaymentStatus, label: 'Draft', color: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
                    { key: 'partial' as ExpensePaymentStatus, label: 'Partial', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
                    { key: 'paid' as ExpensePaymentStatus, label: 'Paid', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
                  ]).map((option) => (
                    <Pressable
                      key={option.key}
                      onPress={() => setExpenseStatusDraft(option.key)}
                      style={{
                        flex: 1,
                        height: 44,
                        borderRadius: 12,
                        borderWidth: 1.5,
                        borderColor: expenseStatusDraft === option.key ? option.color : colors.divider,
                        backgroundColor: expenseStatusDraft === option.key ? option.bg : colors.bg.input,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: expenseStatusDraft === option.key ? option.color : colors.text.tertiary, fontSize: 13, fontWeight: '600' }}>
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View>
                <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase tracking-wider mb-2">Evidence</Text>
                {expenseReceiptAssets.length === 0 && !expenseReceiptNameDraft ? (
                  <Pressable
                    onPress={pickExpenseReceipt}
                    className="rounded-2xl items-center justify-center"
                    style={{
                      paddingVertical: 28,
                      borderWidth: 1.5,
                      borderColor: colors.divider,
                      borderStyle: 'dashed',
                    }}
                  >
                    <View
                      className="rounded-full items-center justify-center mb-3"
                      style={{ width: 48, height: 48, backgroundColor: colors.bg.screen, borderWidth: 1, borderColor: colors.divider }}
                    >
                      <Camera size={22} color={colors.text.tertiary} strokeWidth={2} />
                    </View>
                    <Text style={{ color: colors.text.primary }} className="text-base font-semibold">Upload Receipt</Text>
                    <Text style={{ color: colors.text.muted, marginTop: 4 }} className="text-sm">Tap to take a photo or choose file</Text>
                  </Pressable>
                ) : (
                  <View style={{ gap: 10 }}>
                    {expenseReceiptAssets.map((asset, index) => (
                      <View
                        key={`${asset.uri}-${index}`}
                        className="rounded-xl flex-row items-center px-3"
                        style={{ height: 52, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.input }}
                      >
                        <View className="rounded-lg items-center justify-center" style={{ width: 36, height: 36, backgroundColor: colors.bg.screen, borderWidth: 1, borderColor: colors.divider }}>
                          <FileText size={16} color={colors.text.tertiary} strokeWidth={2} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
                          <Text numberOfLines={1} style={{ color: colors.text.primary, fontSize: 14 }} className="font-medium">{asset.name}</Text>
                        </View>
                        <Pressable
                          onPress={() => {
                            setExpenseReceiptAssets((previous) => previous.filter((_, assetIndex) => assetIndex !== index));
                            setExpenseUploadError('');
                          }}
                          className="rounded-md items-center justify-center ml-2"
                          style={{ width: 30, height: 30 }}
                        >
                          <X size={16} color={colors.text.tertiary} strokeWidth={2} />
                        </Pressable>
                      </View>
                    ))}
                    {expenseReceiptNameDraft && expenseReceiptAssets.length === 0 ? (
                      <View
                        className="rounded-xl flex-row items-center px-3"
                        style={{ height: 52, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.input }}
                      >
                        <View className="rounded-lg items-center justify-center" style={{ width: 36, height: 36, backgroundColor: colors.bg.screen, borderWidth: 1, borderColor: colors.divider }}>
                          <FileText size={16} color={colors.text.tertiary} strokeWidth={2} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
                          <Text numberOfLines={1} style={{ color: colors.text.primary, fontSize: 14 }} className="font-medium">{expenseReceiptNameDraft}</Text>
                        </View>
                        <Pressable
                          onPress={() => {
                            setExpenseReceiptPathDraft('');
                            setExpenseReceiptNameDraft('');
                            setExpenseUploadError('');
                          }}
                          className="rounded-md items-center justify-center ml-2"
                          style={{ width: 30, height: 30 }}
                        >
                          <X size={16} color={colors.text.tertiary} strokeWidth={2} />
                        </Pressable>
                      </View>
                    ) : null}
                    <Pressable
                      onPress={pickExpenseReceipt}
                      className="rounded-xl items-center justify-center"
                      style={{
                        height: 44,
                        borderWidth: 1,
                        borderColor: colors.divider,
                        borderStyle: 'dashed',
                      }}
                    >
                      <Text style={{ color: colors.text.secondary }} className="text-sm font-semibold">+ Add Another File</Text>
                    </Pressable>
                  </View>
                )}
                {expenseUploadError ? (
                  <Text style={{ color: colors.danger }} className="text-xs mt-2">
                    {expenseUploadError}
                  </Text>
                ) : null}
              </View>

              <View style={{ position: 'relative', zIndex: 1 }}>
                <Text style={{ color: colors.text.tertiary }} className="text-xs mb-1.5">Notes (optional)</Text>
                <TextInput
                  value={expenseNoteDraft}
                  onChangeText={setExpenseNoteDraft}
                  placeholder="Optional notes..."
                  placeholderTextColor={colors.text.muted}
                  multiline
                  numberOfLines={3}
                  style={{
                    minHeight: 84,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: formFieldBorder,
                    backgroundColor: formFieldBg,
                    color: colors.text.primary,
                    paddingHorizontal: 14,
                    paddingTop: 12,
                    textAlignVertical: 'top',
                    fontSize: 15,
                  }}
                />
              </View>
            </View>

            <View className="flex-row justify-end mt-6" style={{ gap: 10, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
              {canDeleteDraftExpenseRequestFromModal && editingExpenseRequestId ? (
                <Pressable
                  onPress={() => {
                    handleDeleteDraftExpenseRequest(editingExpenseRequestId);
                    setShowExpenseModal(false);
                    setEditingExpenseId(null);
                    setEditingExpenseRequestId(null);
                    setShowExpenseCategoryDropdown(false);
                    setShowExpenseMerchantDropdown(false);
                    setShowExpenseTypeDropdown(false);
                    setActiveBreakdownLineCategoryId(null);
                    setBreakdownLineCategorySearch('');
                    setExpenseReceiptAssets([]);
                    setExpenseUploadError('');
                    setIsGeneratingExpenseDraft(false);
                    setIsSavingExpense(false);
                  }}
                  className="rounded-full px-5"
                  style={{
                    height: 44,
                    flex: isMobile ? 1 : undefined,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: colors.danger,
                    backgroundColor: 'transparent',
                  }}
                >
                  <Text style={{ color: colors.danger }} className="font-semibold">
                    Delete
                  </Text>
                </Pressable>
              ) : null}
              {canRevokeExpenseRequestFromModal && editingExpenseRequestId ? (
                <Pressable
                  onPress={() => {
                    handleRevokeExpenseRequest(editingExpenseRequestId);
                    setShowExpenseModal(false);
                    setEditingExpenseId(null);
                    setEditingExpenseRequestId(null);
                    setShowExpenseCategoryDropdown(false);
                    setShowExpenseMerchantDropdown(false);
                    setShowExpenseTypeDropdown(false);
                    setActiveBreakdownLineCategoryId(null);
                    setBreakdownLineCategorySearch('');
                    setExpenseReceiptAssets([]);
                    setExpenseUploadError('');
                    setIsGeneratingExpenseDraft(false);
                    setIsSavingExpense(false);
                  }}
                  className="rounded-full px-5"
                  style={{
                    height: 44,
                    flex: isMobile ? 1 : undefined,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: colors.danger,
                    backgroundColor: colors.bg.card,
                  }}
                >
                  <Text style={{ color: colors.danger }} className="font-semibold">
                    Delete
                  </Text>
                </Pressable>
              ) : null}
              {!isFinanceApprover || Boolean(editingExpenseRequestId) ? (
                <>
                  <Pressable
                    onPress={() => handleSaveExpenseModal('save')}
                    disabled={!canSaveExpense || isSavingExpense}
                    className="rounded-full px-5"
                    style={{
                      height: 44,
                      flex: isMobile ? 1 : undefined,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: formFieldBorder,
                      backgroundColor: formFieldBg,
                      opacity: canSaveExpense && !isSavingExpense ? 1 : 0.5,
                    }}
                  >
                    <Text style={{ color: colors.text.primary }} className="font-semibold">
                      {isSavingExpense ? 'Saving...' : 'Save'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleSaveExpenseModal('submit')}
                    disabled={!canSaveExpense || isSavingExpense}
                    className="rounded-full px-5"
                    style={{
                      height: 44,
                      flex: isMobile ? 1 : undefined,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: canSaveExpense && !isSavingExpense ? colors.bar : colors.bg.input,
                    }}
                  >
                    <Text style={{ color: canSaveExpense && !isSavingExpense ? colors.bg.screen : colors.text.tertiary }} className="font-semibold">
                      {isSavingExpense ? 'Submitting...' : 'Submit'}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  onPress={() => handleSaveExpenseModal('save')}
                  disabled={!canSaveExpense || isSavingExpense}
                className="rounded-full px-5"
                style={{
                  height: 44,
                  flex: isMobile ? 1 : undefined,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: canSaveExpense && !isSavingExpense ? colors.bar : colors.bg.input,
                }}
              >
                  <Text style={{ color: canSaveExpense && !isSavingExpense ? colors.bg.screen : colors.text.tertiary }} className="font-semibold">
                    {isSavingExpense ? 'Saving...' : (expenseModalMode === 'edit' ? 'Update' : 'Save')}
                  </Text>
                </Pressable>
              )}
            </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!isWebDesktop && showExpenseApprovalWorkspace}
        transparent={false}
        animationType="slide"
        onRequestClose={() => {
          setShowExpenseApprovalWorkspace(false);
          setApprovalInfoRequestNote('');
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg.screen }}>
          <View style={{ flex: 1, paddingHorizontal: 14, paddingTop: insets.top + 8, paddingBottom: 12 }}>
            <View className="flex-row items-center justify-between" style={{ gap: 10 }}>
              <Text style={{ color: colors.text.primary }} className="text-xl font-bold">
                Pending Expense Approvals
              </Text>
              <Pressable
                onPress={() => {
                  setShowExpenseApprovalWorkspace(false);
                  setApprovalInfoRequestNote('');
                }}
                className="rounded-full items-center justify-center"
                style={{ width: 38, height: 38, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card }}
              >
                <X size={18} color={colors.text.secondary} strokeWidth={2.3} />
              </Pressable>
            </View>
            <View style={{ flex: 1, marginTop: 12 }}>
              {renderExpenseApprovalWorkspacePanels()}
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={Boolean(approvalDetailRequest)}
        transparent
        animationType={isWebDesktop ? 'fade' : 'slide'}
        onRequestClose={() => setApprovalDetailRequestId(null)}
      >
        <Pressable
          className={isWebDesktop ? 'flex-1 items-center justify-center' : 'flex-1'}
          style={{ backgroundColor: isWebDesktop ? 'rgba(0, 0, 0, 0.6)' : colors.bg.screen }}
          onPress={() => setApprovalDetailRequestId(null)}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              width: isWebDesktop ? '92%' : '100%',
              maxWidth: isWebDesktop ? 760 : undefined,
              height: isWebDesktop ? undefined : '100%',
              borderRadius: isWebDesktop ? 20 : 0,
              borderWidth: 1,
              borderColor: colors.divider,
              backgroundColor: colors.bg.card,
              overflow: 'hidden',
              padding: isWebDesktop ? 20 : 16,
              paddingTop: isWebDesktop ? 20 : insets.top + 16,
            }}
          >
            <View className="flex-row items-center justify-between">
              <Text style={{ color: colors.text.primary }} className="text-lg font-bold">
                Expense Request Details
              </Text>
              <Pressable
                onPress={() => setApprovalDetailRequestId(null)}
                className="rounded-full items-center justify-center"
                style={{ backgroundColor: colors.bg.input, width: 40, height: 40 }}
              >
                <X size={20} color={colors.text.secondary} strokeWidth={2.5} />
              </Pressable>
            </View>

            {approvalDetailRequest ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                style={isWebDesktop ? { maxHeight: 560 } : { flex: 1 }}
                contentContainerStyle={{ paddingBottom: 12 }}
              >
	                <View className="mt-4 rounded-xl p-4" style={{ borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.input }}>
	                  <View className="flex-row items-start justify-between" style={{ gap: 12 }}>
	                    <View style={{ flex: 1 }}>
	                      <Text style={{ color: colors.text.primary }} className="text-base font-semibold">
	                        {approvalDetailRequest.title}
                      </Text>
                      <Text style={{ color: colors.text.secondary }} className="text-xs mt-1">
                        {approvalDetailRequest.category} • {approvalDetailRequest.merchant || 'No merchant'}
                      </Text>
                      <Text style={{ color: colors.text.secondary }} className="text-xs mt-1">
                        {new Date(parseTimestamp(approvalDetailRequest.date) ?? Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} • {approvalDetailRequest.submittedByName || 'Team Member'}
                      </Text>
                    </View>
                    <Text style={{ color: colors.text.primary }} className="text-base font-bold">
                      {formatCurrency(approvalDetailRequest.amount)}
	                    </Text>
	                  </View>
	                </View>

	                <View className="mt-4 rounded-xl p-4" style={{ borderWidth: 1, borderColor: colors.divider }}>
	                  <Text style={{ color: colors.text.primary }} className="text-sm font-semibold mb-3">Request Timeline</Text>
	                  <View style={{ gap: 10 }}>
	                    <View className="flex-row items-center justify-between" style={{ gap: 12 }}>
	                      <Text style={{ color: colors.text.secondary }} className="text-sm">Expense date</Text>
	                      <Text style={{ color: colors.text.primary }} className="text-sm font-semibold">
	                        {new Date(parseTimestamp(approvalDetailRequest.date) ?? Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
	                      </Text>
	                    </View>
	                    <View className="flex-row items-center justify-between" style={{ gap: 12 }}>
	                      <Text style={{ color: colors.text.secondary }} className="text-sm">Submitted</Text>
	                      <Text style={{ color: colors.text.primary }} className="text-sm font-semibold">
	                        {new Date(parseTimestamp(approvalDetailRequest.submittedAt ?? approvalDetailRequest.createdAt) ?? Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
	                      </Text>
	                    </View>
	                  </View>
	                </View>

	                <View className="mt-4 rounded-xl p-4" style={{ borderWidth: 1, borderColor: colors.divider }}>
	                  <Text style={{ color: colors.text.primary }} className="text-sm font-semibold mb-3">Payment Breakdown</Text>
	                  <View style={{ gap: 10 }}>
	                    {approvalDetailLineItems.map((line) => (
                      <View key={line.id} className="flex-row items-start justify-between" style={{ gap: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.text.primary }} className="text-sm font-medium">{line.label}</Text>
                          <Text style={{ color: colors.text.tertiary }} className="text-xs mt-1">{line.category}</Text>
                        </View>
                        <Text style={{ color: colors.text.primary }} className="text-sm font-semibold">
                          {formatCurrency(line.amount)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View className="mt-4 rounded-xl p-4" style={{ borderWidth: 1, borderColor: colors.divider }}>
                  <Text style={{ color: colors.text.primary }} className="text-sm font-semibold mb-2">Note</Text>
                  <Text style={{ color: colors.text.secondary }} className="text-sm">
                    {approvalDetailRequest.note?.trim() || 'No notes provided.'}
                  </Text>
                </View>

                <View className="mt-4 rounded-xl p-4" style={{ borderWidth: 1, borderColor: colors.divider }}>
                  <Text style={{ color: colors.text.primary }} className="text-sm font-semibold mb-3">Evidence</Text>
                  {(approvalDetailRequest.receipts ?? []).length === 0 ? (
                    <Text style={{ color: colors.text.tertiary }} className="text-sm">No files attached.</Text>
                  ) : (
                    <View style={{ gap: 8 }}>
                      {(approvalDetailRequest.receipts ?? []).map((receipt) => (
                        <Pressable
                          key={receipt.id}
                          onPress={() => void handleOpenExpenseReceipt(receipt.storagePath)}
                          className="rounded-lg px-3 py-2.5 flex-row items-center justify-between"
                          style={{ borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.input }}
                        >
                          <Text style={{ color: colors.text.primary, flex: 1 }} className="text-sm" numberOfLines={1}>
                            {receipt.fileName}
                          </Text>
                          <Text style={{ color: colors.bar }} className="text-xs font-semibold ml-2">
                            Open
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              </ScrollView>
            ) : null}

            <View className="flex-row justify-end mt-5" style={{ gap: 10 }}>
              <Pressable
                onPress={() => {
                  if (!approvalDetailRequest) return;
                  handleRejectExpenseRequest(approvalDetailRequest.id);
                  setApprovalDetailRequestId(null);
                }}
                className="rounded-full px-5"
                style={{ height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.danger }}
              >
                <Text style={{ color: colors.danger }} className="font-semibold">Reject</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!approvalDetailRequest) return;
                  handleApproveExpenseRequest(approvalDetailRequest.id);
                  setApprovalDetailRequestId(null);
                }}
                className="rounded-full px-5"
                style={{ height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.success }}
              >
                <Text style={{ color: '#FFFFFF' }} className="font-semibold">Approve</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>



      <Modal
        visible={showProcurementModal}
        transparent
        animationType="none"
        onRequestClose={() => {
          setShowProcurementModal(false);
          setShowPoSupplierDropdown(false);
          setShowPoStatusDropdown(false);
        }}
      >
        <Pressable
          className={isWebDesktop ? 'flex-1 items-center justify-center' : 'flex-1'}
          style={{ backgroundColor: isWebDesktop ? 'rgba(0, 0, 0, 0.6)' : colors.bg.screen }}
          onPress={() => {
            setShowProcurementModal(false);
            setShowPoSupplierDropdown(false);
            setShowPoStatusDropdown(false);
          }}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              width: isWebDesktop ? '92%' : '100%',
              maxWidth: isWebDesktop ? 760 : undefined,
              height: isWebDesktop ? undefined : '100%',
              borderRadius: isWebDesktop ? 20 : 0,
              borderWidth: 1,
              borderColor: colors.divider,
              backgroundColor: colors.bg.card,
              overflow: 'visible',
              padding: isWebDesktop ? 20 : 16,
              paddingTop: isWebDesktop ? 20 : insets.top + 16,
            }}
          >
            <View className="flex-row items-center justify-between">
              <Text style={{ color: colors.text.primary }} className="text-lg font-bold">
                {procurementModalMode === 'edit' ? 'Edit Purchase Order' : 'New Purchase Order'}
              </Text>
              <Pressable
                onPress={() => {
                  setShowProcurementModal(false);
                  setEditingProcurementId(null);
                  setShowPoSupplierDropdown(false);
                  setShowPoStatusDropdown(false);
                }}
                className="rounded-full items-center justify-center"
                style={{ backgroundColor: colors.bg.input, width: 40, height: 40 }}
              >
                <X size={20} color={colors.text.secondary} strokeWidth={2.5} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={isWebDesktop ? { maxHeight: 620 } : { flex: 1 }}
              contentContainerStyle={{ paddingBottom: 12, overflow: 'visible' }}
            >
            <View className="mt-5" style={{ gap: 14, overflow: 'visible' }}>
              <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs mb-1.5">Procurement Name</Text>
                  <TextInput
                    value={poTitleDraft}
                    onChangeText={setPoTitleDraft}
                    placeholder="e.g. March Glasses Procurement"
                    placeholderTextColor={colors.text.muted}
                    style={{
                      height: 52,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: formFieldBorder,
                      backgroundColor: formFieldBg,
                      color: colors.text.primary,
                      paddingHorizontal: 14,
                      fontSize: 15,
                    }}
                  />
                </View>
                {!isMobile ? (
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs mb-1.5">Date Paid</Text>
                  {Platform.OS === 'web' ? (
                    <View
                      style={{
                        height: 52,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: formFieldBorder,
                        backgroundColor: formFieldBg,
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 14,
                      }}
                    >
                      <Calendar size={18} color={colors.text.tertiary} strokeWidth={2} />
                      <input
                        className="finance-date-input"
                        type="date"
                        value={poExpectedDateDraft}
                        onChange={(e: any) => setPoExpectedDateDraft(e.target.value)}
                        style={{
                          flex: 1,
                          border: 'none',
                          outline: 'none',
                          background: 'transparent',
                          color: colors.text.primary,
                          fontSize: 15,
                          marginLeft: 10,
                          fontFamily: 'inherit',
                          colorScheme: isDarkMode ? 'dark' : 'light',
                        }}
                      />
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => setShowPoDatePicker(true)}
                      style={{
                        height: 52,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: formFieldBorder,
                        backgroundColor: formFieldBg,
                        paddingHorizontal: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <Calendar size={18} color={colors.text.tertiary} strokeWidth={2} />
                      <Text style={{ color: colors.text.primary, fontSize: 15, marginLeft: 10 }}>
                        {poExpectedDateDraft || 'Select date'}
                      </Text>
                    </Pressable>
                  )}
                  {showPoDatePicker && Platform.OS !== 'web' ? (
                    <DateTimePicker
                      value={poExpectedDateDraft ? new Date(poExpectedDateDraft + 'T00:00:00') : new Date()}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(_event: any, selectedDate?: Date) => {
                        setShowPoDatePicker(Platform.OS === 'ios');
                        if (selectedDate) {
                          setPoExpectedDateDraft(selectedDate.toISOString().split('T')[0]);
                        }
                      }}
                    />
                  ) : null}
                </View>
                ) : null}
                {!isMobile ? (
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs mb-1.5">Date Received</Text>
                  {Platform.OS === 'web' ? (
                    <View
                      style={{
                        height: 52,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: formFieldBorder,
                        backgroundColor: formFieldBg,
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 14,
                      }}
                    >
                      <Calendar size={18} color={colors.text.tertiary} strokeWidth={2} />
                      <input
                        className="finance-date-input"
                        type="date"
                        value={poReceivedDateDraft}
                        onChange={(e: any) => setPoReceivedDateDraft(e.target.value)}
                        style={{
                          flex: 1,
                          border: 'none',
                          outline: 'none',
                          background: 'transparent',
                          color: colors.text.primary,
                          fontSize: 15,
                          marginLeft: 10,
                          fontFamily: 'inherit',
                          colorScheme: isDarkMode ? 'dark' : 'light',
                        }}
                      />
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => setShowPoReceivedDatePicker(true)}
                      style={{
                        height: 52,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: formFieldBorder,
                        backgroundColor: formFieldBg,
                        paddingHorizontal: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <Calendar size={18} color={colors.text.tertiary} strokeWidth={2} />
                      <Text style={{ color: colors.text.primary, fontSize: 15, marginLeft: 10 }}>
                        {poReceivedDateDraft || 'Select date'}
                      </Text>
                    </Pressable>
                  )}
                  {showPoReceivedDatePicker && Platform.OS !== 'web' ? (
                    <DateTimePicker
                      value={poReceivedDateDraft ? new Date(poReceivedDateDraft + 'T00:00:00') : new Date()}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(_event: any, selectedDate?: Date) => {
                        setShowPoReceivedDatePicker(Platform.OS === 'ios');
                        if (selectedDate) {
                          setPoReceivedDateDraft(selectedDate.toISOString().split('T')[0]);
                        }
                      }}
                    />
                  ) : null}
                </View>
                ) : null}
              </View>

              <View
                style={{
                  flexDirection: isMobile ? 'column' : 'row',
                  gap: 12,
                  zIndex: showPoSupplierDropdown || showPoStatusDropdown ? 2200 : 1,
                }}
              >
                <View style={{ flex: isMobile ? undefined : 1, width: '100%', position: 'relative', zIndex: showPoSupplierDropdown ? 2300 : 1 }}>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs mb-1.5">Supplier</Text>
                  <Pressable
                    onPress={() => {
                      setShowPoSupplierDropdown((prev) => !prev);
                      setShowPoStatusDropdown(false);
                      setPoSupplierSearch(poSupplierDraft);
                    }}
                    style={{
                      height: 52,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: showPoSupplierDropdown ? formFieldActiveBorder : formFieldBorder,
                      backgroundColor: formFieldBg,
                      paddingHorizontal: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{ color: poSupplierDraft ? colors.text.primary : colors.text.muted, flex: 1, marginRight: 8, fontSize: 15 }}
                    >
                      {poSupplierDraft || 'Select or search supplier'}
                    </Text>
                    <ChevronDown size={16} color={colors.text.tertiary} strokeWidth={2} />
                  </Pressable>

                  {showPoSupplierDropdown ? (
                    <View
                      style={{
                        position: 'absolute',
                        top: 78,
                        left: 0,
                        right: 0,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: colors.divider,
                        backgroundColor: colors.bg.card,
                        zIndex: 3200,
                        overflow: 'hidden',
                        maxHeight: 240,
                        elevation: 40,
                      }}
                    >
                      <View style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
                        <TextInput
                          value={poSupplierSearch}
                          onChangeText={setPoSupplierSearch}
                          placeholder="Search supplier..."
                          placeholderTextColor={colors.text.muted}
                          style={{
                            height: 40,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: formFieldBorder,
                            backgroundColor: formFieldBg,
                            color: colors.text.primary,
                            paddingHorizontal: 12,
                            fontSize: 14,
                          }}
                        />
                      </View>
                      <ScrollView showsVerticalScrollIndicator={false}>
                        {filteredProcurementSuppliers.map((supplier) => (
                          <Pressable
                            key={supplier}
                            onPress={() => {
                              setPoSupplierDraft(supplier);
                              setPoSupplierSearch(supplier);
                              setShowPoSupplierDropdown(false);
                            }}
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                              borderBottomWidth: 1,
                              borderBottomColor: colors.divider,
                              backgroundColor: poSupplierDraft === supplier ? colors.bg.input : colors.bg.card,
                            }}
                          >
                            <Text style={{ color: colors.text.primary, fontSize: 15 }} className="font-medium">{supplier}</Text>
                          </Pressable>
                        ))}
                        {poSupplierSearch.trim() && !availableProcurementSuppliers.some(
                          (supplier) => supplier.toLowerCase() === poSupplierSearch.trim().toLowerCase()
                        ) ? (
                          <Pressable
                            onPress={() => {
                              const customSupplier = poSupplierSearch.trim();
                              upsertFinanceSupplierName(customSupplier);
                              setPoSupplierDraft(customSupplier);
                              setPoSupplierSearch(customSupplier);
                              setShowPoSupplierDropdown(false);
                            }}
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                              borderBottomWidth: 1,
                              borderBottomColor: colors.divider,
                              backgroundColor: colors.bg.card,
                            }}
                          >
                            <Text style={{ color: colors.text.primary, fontSize: 15 }} className="font-medium">
                              Use "{poSupplierSearch.trim()}"
                            </Text>
                          </Pressable>
                        ) : null}
                        {filteredProcurementSuppliers.length === 0 && !poSupplierSearch.trim() ? (
                          <View style={{ paddingHorizontal: 12, paddingVertical: 12 }}>
                            <Text style={{ color: colors.text.muted }} className="text-sm">No suppliers yet</Text>
                          </View>
                        ) : null}
                      </ScrollView>
                    </View>
                  ) : null}
                </View>

                {!isMobile ? (
                <View style={{ flex: 1, width: '100%', position: 'relative', zIndex: showPoStatusDropdown ? 2300 : 1 }}>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs mb-1.5">Status</Text>
                  <>
                    <Pressable
                      onPress={() => {
                        setShowPoStatusDropdown((prev) => !prev);
                        setShowPoSupplierDropdown(false);
                      }}
                      style={{
                        height: 52,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: showPoStatusDropdown ? formFieldActiveBorder : formFieldBorder,
                        backgroundColor: formFieldBg,
                        paddingHorizontal: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Text
                        numberOfLines={1}
                        style={{ color: colors.text.primary, flex: 1, marginRight: 8, fontSize: 15 }}
                      >
                        {poStatusDraft}
                      </Text>
                      <ChevronDown size={16} color={colors.text.tertiary} strokeWidth={2} />
                    </Pressable>

                    {showPoStatusDropdown ? (
                      <View
                        style={{
                          position: 'absolute',
                          top: 78,
                          left: 0,
                          right: 0,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: colors.divider,
                          backgroundColor: colors.bg.card,
                          zIndex: 3200,
                          overflow: 'hidden',
                          maxHeight: 220,
                          elevation: 40,
                        }}
                      >
                        <ScrollView showsVerticalScrollIndicator={false}>
                          {procurementFilterOptions
                            .filter((option) => option.key !== 'all')
                            .map((option) => (
                              <Pressable
                                key={option.key}
                                onPress={() => {
                                  setPoStatusDraft(option.key as ProcurementStatus);
                                  setShowPoStatusDropdown(false);
                                }}
                                style={{
                                  paddingHorizontal: 12,
                                  paddingVertical: 10,
                                  borderBottomWidth: 1,
                                  borderBottomColor: colors.divider,
                                  backgroundColor: poStatusDraft === option.key ? colors.bg.input : colors.bg.card,
                                }}
                              >
                                <Text style={{ color: colors.text.primary, fontSize: 15 }} className="font-medium">
                                  {option.label}
                                </Text>
                              </Pressable>
                            ))}
                        </ScrollView>
                      </View>
                    ) : null}
                  </>
                </View>
                ) : null}
              </View>

              {isMobile ? (
                <View>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs mb-1.5">Date Paid</Text>
                  {Platform.OS === 'web' ? (
                    <View
                      style={{
                        height: 52,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: formFieldBorder,
                        backgroundColor: formFieldBg,
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 14,
                      }}
                    >
                      <Calendar size={18} color={colors.text.tertiary} strokeWidth={2} />
                      <input
                        className="finance-date-input"
                        type="date"
                        value={poExpectedDateDraft}
                        onChange={(e: any) => setPoExpectedDateDraft(e.target.value)}
                        style={{
                          flex: 1,
                          border: 'none',
                          outline: 'none',
                          background: 'transparent',
                          color: colors.text.primary,
                          fontSize: 15,
                          marginLeft: 10,
                          fontFamily: 'inherit',
                          colorScheme: isDarkMode ? 'dark' : 'light',
                        }}
                      />
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => setShowPoDatePicker(true)}
                      style={{
                        height: 52,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: formFieldBorder,
                        backgroundColor: formFieldBg,
                        paddingHorizontal: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <Calendar size={18} color={colors.text.tertiary} strokeWidth={2} />
                      <Text style={{ color: colors.text.primary, fontSize: 15, marginLeft: 10 }}>
                        {poExpectedDateDraft || 'Select date'}
                      </Text>
                    </Pressable>
                  )}
                  {showPoDatePicker && Platform.OS !== 'web' ? (
                    <DateTimePicker
                      value={poExpectedDateDraft ? new Date(poExpectedDateDraft + 'T00:00:00') : new Date()}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(_event: any, selectedDate?: Date) => {
                        setShowPoDatePicker(Platform.OS === 'ios');
                        if (selectedDate) {
                          setPoExpectedDateDraft(selectedDate.toISOString().split('T')[0]);
                        }
                      }}
                    />
                  ) : null}
                </View>
              ) : null}

              {/* Purchase Lines */}
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ color: colors.text.tertiary, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>Purchase Lines</Text>
                  {!isMobile ? (
                    <Pressable
                      onPress={() => setPoPurchaseLines((prev) => [...prev, { id: `l${Date.now().toString(36)}`, description: '', amount: '' }])}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.divider }}
                    >
                      <Plus size={12} color={colors.text.secondary} strokeWidth={2.5} />
                      <Text style={{ color: colors.text.secondary, fontSize: 12, fontWeight: '600' }}>Add Line</Text>
                    </Pressable>
                  ) : null}
                </View>

                {poPurchaseLines.map((line, index) => (
                  <View key={line.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <TextInput
                      value={line.description}
                      onChangeText={(text) => setPoPurchaseLines((prev) => prev.map((l) => l.id === line.id ? { ...l, description: text } : l))}
                      placeholder={`Line ${index + 1} description`}
                      placeholderTextColor={colors.text.muted}
                      style={{
                        flex: 1,
                        height: 46,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: formFieldBorder,
                        backgroundColor: formFieldBg,
                        color: colors.text.primary,
                        paddingHorizontal: 12,
                        fontSize: 14,
                      }}
                    />
                    <TextInput
                      value={line.amount}
                      onChangeText={(text) => setPoPurchaseLines((prev) => prev.map((l) => l.id === line.id ? { ...l, amount: text } : l))}
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                      placeholderTextColor={colors.text.muted}
                      style={{
                        width: 100,
                        height: 46,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: formFieldBorder,
                        backgroundColor: formFieldBg,
                        color: colors.text.primary,
                        paddingHorizontal: 12,
                        fontSize: 14,
                      }}
                    />
                    {poPurchaseLines.length > 1 && (
                      <Pressable
                        onPress={() => setPoPurchaseLines((prev) => prev.filter((l) => l.id !== line.id))}
                        style={{ width: 36, height: 46, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <X size={16} color="#EF4444" strokeWidth={2} />
                      </Pressable>
                    )}
                  </View>
                ))}

                {poPurchaseLines.some((l) => parseFloat(l.amount) > 0) && (
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.divider, marginTop: 2 }}>
                    <Text style={{ color: colors.text.muted, fontSize: 13 }}>Total:</Text>
                    <Text style={{ color: colors.text.primary, fontSize: 15, fontWeight: '700' }}>
                      {formatCurrency(poPurchaseLines.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0))}
                    </Text>
                  </View>
                )}

                {isMobile ? (
                  <View style={{ alignItems: 'center', marginTop: 10 }}>
                    <Pressable
                      onPress={() => setPoPurchaseLines((prev) => [...prev, { id: `l${Date.now().toString(36)}`, description: '', amount: '' }])}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        minWidth: 140,
                        height: 36,
                        paddingHorizontal: 14,
                        borderRadius: 999,
                        backgroundColor: colors.bg.input,
                        borderWidth: 1,
                        borderColor: colors.divider,
                      }}
                    >
                      <Plus size={14} color={colors.text.secondary} strokeWidth={2.5} />
                      <Text style={{ color: colors.text.secondary, fontSize: 13, fontWeight: '600' }}>Add Line</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>

              {!isMobile ? (
                <View>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs mb-1.5">Notes (optional)</Text>
                  <TextInput
                    value={poNoteDraft}
                    onChangeText={setPoNoteDraft}
                    placeholder="Optional notes..."
                    placeholderTextColor={colors.text.muted}
                    multiline
                    numberOfLines={3}
                    style={{
                      minHeight: 84,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: formFieldBorder,
                      backgroundColor: formFieldBg,
                      color: colors.text.primary,
                      paddingHorizontal: 14,
                      paddingTop: 12,
                      textAlignVertical: 'top',
                      fontSize: 15,
                    }}
                  />
                </View>
              ) : null}

              {/* Attachments */}
              <View>
                <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase tracking-wider mb-2">Attachments</Text>
                {poAttachmentsDraft.length === 0 ? (
                  <Pressable
                    onPress={pickPoAttachment}
                    disabled={isPickingPoFile}
                    className="rounded-2xl items-center justify-center"
                    style={{
                      paddingVertical: 28,
                      borderWidth: 1.5,
                      borderColor: colors.divider,
                      borderStyle: 'dashed',
                    }}
                  >
                    <View
                      className="rounded-full items-center justify-center mb-3"
                      style={{ width: 48, height: 48, backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.divider }}
                    >
                      <Paperclip size={22} color={colors.text.tertiary} strokeWidth={2} />
                    </View>
                    <Text style={{ color: colors.text.primary }} className="text-base font-semibold">
                      {isPickingPoFile ? 'Picking...' : 'Attach Files'}
                    </Text>
                    <Text style={{ color: colors.text.muted, marginTop: 4 }} className="text-sm">Tap to attach invoices, receipts, or docs</Text>
                  </Pressable>
                ) : (
                  <View style={{ gap: 10 }}>
                    {poAttachmentsDraft.map((att) => (
                      <View
                        key={att.uri}
                        className="rounded-xl flex-row items-center px-3"
                        style={{ height: 52, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.input }}
                      >
                        <View className="rounded-lg items-center justify-center" style={{ width: 36, height: 36, backgroundColor: colors.bg.screen, borderWidth: 1, borderColor: colors.divider }}>
                          {att.mimeType?.startsWith('image/') ? (
                            <ImageIcon size={16} color={colors.text.tertiary} strokeWidth={1.5} />
                          ) : (
                            <FileText size={16} color={colors.text.tertiary} strokeWidth={2} />
                          )}
                        </View>
                        <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
                          <Text numberOfLines={1} style={{ color: colors.text.primary, fontSize: 14 }} className="font-medium">{att.name}</Text>
                        </View>
                        <Pressable
                          onPress={() => setPoAttachmentsDraft((prev) => prev.filter((a) => a.uri !== att.uri))}
                          className="rounded-md items-center justify-center ml-2"
                          style={{ width: 30, height: 30 }}
                        >
                          <X size={16} color={colors.text.tertiary} strokeWidth={2} />
                        </Pressable>
                      </View>
                    ))}
                    <Pressable
                      onPress={pickPoAttachment}
                      disabled={isPickingPoFile}
                      className="rounded-xl items-center justify-center"
                      style={{
                        height: 44,
                        borderWidth: 1,
                        borderColor: colors.divider,
                        borderStyle: 'dashed',
                      }}
                    >
                      <Text style={{ color: colors.text.secondary }} className="text-sm font-semibold">
                        {isPickingPoFile ? 'Picking...' : '+ Add Another File'}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>

              {isMobile ? (
                <View>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs mb-1.5">Date Received</Text>
                  {Platform.OS === 'web' ? (
                    <View
                      style={{
                        height: 52,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: formFieldBorder,
                        backgroundColor: formFieldBg,
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 14,
                      }}
                    >
                      <Calendar size={18} color={colors.text.tertiary} strokeWidth={2} />
                      <input
                        className="finance-date-input"
                        type="date"
                        value={poReceivedDateDraft}
                        onChange={(e: any) => setPoReceivedDateDraft(e.target.value)}
                        style={{
                          flex: 1,
                          border: 'none',
                          outline: 'none',
                          background: 'transparent',
                          color: colors.text.primary,
                          fontSize: 15,
                          marginLeft: 10,
                          fontFamily: 'inherit',
                          colorScheme: isDarkMode ? 'dark' : 'light',
                        }}
                      />
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => setShowPoReceivedDatePicker(true)}
                      style={{
                        height: 52,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: formFieldBorder,
                        backgroundColor: formFieldBg,
                        paddingHorizontal: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <Calendar size={18} color={colors.text.tertiary} strokeWidth={2} />
                      <Text style={{ color: colors.text.primary, fontSize: 15, marginLeft: 10 }}>
                        {poReceivedDateDraft || 'Select date'}
                      </Text>
                    </Pressable>
                  )}
                  {showPoReceivedDatePicker && Platform.OS !== 'web' ? (
                    <DateTimePicker
                      value={poReceivedDateDraft ? new Date(poReceivedDateDraft + 'T00:00:00') : new Date()}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(_event: any, selectedDate?: Date) => {
                        setShowPoReceivedDatePicker(Platform.OS === 'ios');
                        if (selectedDate) {
                          setPoReceivedDateDraft(selectedDate.toISOString().split('T')[0]);
                        }
                      }}
                    />
                  ) : null}
                </View>
              ) : null}

              {isMobile ? (
                <View>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs mb-1.5">Status</Text>
                  <View style={{ gap: 8 }}>
                    {effectiveProcurementStatusOptions.map((option) => {
                      const isSelected = poStatusDraft.trim().toLowerCase() === option.name.trim().toLowerCase();
                      const tone = getStatusTone(option.name, colors);
                      return (
                        <Pressable
                          key={option.id}
                          onPress={() => {
                            setPoStatusDraft(option.name);
                            setShowPoSupplierDropdown(false);
                            setShowPoStatusDropdown(false);
                          }}
                          className="rounded-full px-3.5"
                          style={{
                            width: '100%',
                            minHeight: 38,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: tone.bg,
                            borderWidth: isSelected ? 1.5 : 1,
                            borderColor: isSelected ? tone.text : colors.divider,
                          }}
                        >
                          <Text style={{ color: tone.text, fontSize: 13, fontWeight: isSelected ? '700' : '600' }}>
                            {option.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {isMobile ? (
                <View>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs mb-1.5">Notes (optional)</Text>
                  <TextInput
                    value={poNoteDraft}
                    onChangeText={setPoNoteDraft}
                    placeholder="Optional notes..."
                    placeholderTextColor={colors.text.muted}
                    multiline
                    numberOfLines={3}
                    style={{
                      minHeight: 84,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: formFieldBorder,
                      backgroundColor: formFieldBg,
                      color: colors.text.primary,
                      paddingHorizontal: 14,
                      paddingTop: 12,
                      textAlignVertical: 'top',
                      fontSize: 15,
                    }}
                  />
                </View>
              ) : null}
            </View>

            <View className="flex-row justify-end mt-6" style={{ gap: 10 }}>
              <Pressable
                onPress={() => {
                  setShowProcurementModal(false);
                  setEditingProcurementId(null);
                  setShowPoSupplierDropdown(false);
                  setShowPoStatusDropdown(false);
                }}
                className="rounded-full px-5"
                style={{ height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.divider }}
              >
                <Text style={{ color: colors.text.secondary }} className="font-semibold">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveProcurementModal}
                disabled={!canSaveProcurement}
                className="rounded-full px-5"
                style={{
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: canSaveProcurement ? colors.bar : colors.bg.input,
                }}
              >
                <Text style={{ color: canSaveProcurement ? colors.bg.screen : colors.text.tertiary }} className="font-semibold">
                  {!isFinanceApprover
                    ? (procurementModalMode === 'edit' ? 'Resubmit for Approval' : 'Submit for Approval')
                    : (procurementModalMode === 'edit' ? 'Update' : 'Save')}
                </Text>
              </Pressable>
            </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={isWebDesktop && showSupplierModal} transparent animationType="fade" onRequestClose={() => setShowSupplierModal(false)}>
        <Pressable
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          onPress={() => setShowSupplierModal(false)}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              width: '92%',
              maxWidth: 620,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: colors.divider,
              backgroundColor: colors.bg.card,
              padding: 20,
            }}
          >
            <View className="flex-row items-center justify-between">
              <Text style={{ color: colors.text.primary }} className="text-lg font-bold">
                {editingSupplierId ? 'Edit Supplier' : 'Add Supplier'}
              </Text>
              <Pressable
                onPress={() => setShowSupplierModal(false)}
                className="rounded-full items-center justify-center"
                style={{ backgroundColor: colors.bg.input, width: 40, height: 40 }}
              >
                <X size={20} color={colors.text.secondary} strokeWidth={2.5} />
              </Pressable>
            </View>

            <View className="mt-5" style={{ gap: 12 }}>
              <View>
                <Text style={{ color: colors.text.tertiary }} className="text-xs mb-1.5">Supplier Name</Text>
                <TextInput
                  value={supplierNameDraft}
                  onChangeText={setSupplierNameDraft}
                  placeholder="e.g. Global Parts Co"
                  placeholderTextColor={colors.text.muted}
                  style={{ height: 48, borderRadius: 12, borderWidth: 1, borderColor: formFieldBorder, backgroundColor: formFieldBg, color: colors.text.primary, paddingHorizontal: 14, fontSize: 15 }}
                />
              </View>
              <View className="flex-row" style={{ gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs mb-1.5">Contact Name</Text>
                  <TextInput
                    value={supplierContactDraft}
                    onChangeText={setSupplierContactDraft}
                    placeholder="e.g. James Wu"
                    placeholderTextColor={colors.text.muted}
                    style={{ height: 48, borderRadius: 12, borderWidth: 1, borderColor: formFieldBorder, backgroundColor: formFieldBg, color: colors.text.primary, paddingHorizontal: 14, fontSize: 15 }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs mb-1.5">Payment Terms</Text>
                  <TextInput
                    value={supplierTermsDraft}
                    onChangeText={setSupplierTermsDraft}
                    placeholder="e.g. Net 30"
                    placeholderTextColor={colors.text.muted}
                    style={{ height: 48, borderRadius: 12, borderWidth: 1, borderColor: formFieldBorder, backgroundColor: formFieldBg, color: colors.text.primary, paddingHorizontal: 14, fontSize: 15 }}
                  />
                </View>
              </View>
              <View>
                <Text style={{ color: colors.text.tertiary }} className="text-xs mb-1.5">Email</Text>
                <TextInput
                  value={supplierEmailDraft}
                  onChangeText={setSupplierEmailDraft}
                  placeholder="name@company.com"
                  autoCapitalize="none"
                  placeholderTextColor={colors.text.muted}
                  style={{ height: 48, borderRadius: 12, borderWidth: 1, borderColor: formFieldBorder, backgroundColor: formFieldBg, color: colors.text.primary, paddingHorizontal: 14, fontSize: 15 }}
                />
              </View>
            </View>

            <View className="flex-row justify-end mt-6" style={{ gap: 10 }}>
              <Pressable onPress={() => setShowSupplierModal(false)} className="rounded-xl px-5" style={{ height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.divider }}>
                <Text style={{ color: colors.text.secondary }} className="font-semibold">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={saveSupplierModal}
                disabled={!canSaveSupplier}
                className="rounded-xl px-5"
                style={{ height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: canSaveSupplier ? colors.bar : colors.bg.input }}
              >
                <Text style={{ color: canSaveSupplier ? colors.bg.screen : colors.text.tertiary }} className="font-semibold">
                  {editingSupplierId ? 'Update' : 'Save'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={isWebDesktop && showCategoryModal} transparent animationType="fade" onRequestClose={() => setShowCategoryModal(false)}>
        <Pressable className="flex-1 items-center justify-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }} onPress={() => setShowCategoryModal(false)}>
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{ width: '92%', maxWidth: 520, borderRadius: 20, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, padding: 20 }}
          >
            <View className="flex-row items-center justify-between">
              <Text style={{ color: colors.text.primary }} className="text-lg font-bold">
                {editingCategoryId ? 'Edit Expense Category' : 'Add Expense Category'}
              </Text>
              <Pressable
                onPress={() => setShowCategoryModal(false)}
                className="rounded-full items-center justify-center"
                style={{ backgroundColor: colors.bg.input, width: 40, height: 40 }}
              >
                <X size={20} color={colors.text.secondary} strokeWidth={2.5} />
              </Pressable>
            </View>
            <View className="mt-5">
              <Text style={{ color: colors.text.tertiary }} className="text-xs mb-1.5">Category Name</Text>
              <TextInput
                value={categoryNameDraft}
                onChangeText={setCategoryNameDraft}
                placeholder="e.g. Logistics"
                placeholderTextColor={colors.text.muted}
                style={{ height: 48, borderRadius: 12, borderWidth: 1, borderColor: formFieldBorder, backgroundColor: formFieldBg, color: colors.text.primary, paddingHorizontal: 14, fontSize: 15 }}
              />
            </View>
            <View className="flex-row justify-end mt-6" style={{ gap: 10 }}>
              <Pressable onPress={() => setShowCategoryModal(false)} className="rounded-xl px-5" style={{ height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.divider }}>
                <Text style={{ color: colors.text.secondary }} className="font-semibold">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={saveCategoryModal}
                disabled={!canSaveCategory}
                className="rounded-xl px-5"
                style={{ height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: canSaveCategory ? colors.bar : colors.bg.input }}
              >
                <Text style={{ color: canSaveCategory ? colors.bg.screen : colors.text.tertiary }} className="font-semibold">
                  {editingCategoryId ? 'Update' : 'Save'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={isWebDesktop && showStatusModal} transparent animationType="fade" onRequestClose={() => setShowStatusModal(false)}>
        <Pressable className="flex-1 items-center justify-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }} onPress={() => setShowStatusModal(false)}>
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{ width: '92%', maxWidth: 520, borderRadius: 20, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, padding: 20 }}
          >
            <View className="flex-row items-center justify-between">
              <Text style={{ color: colors.text.primary }} className="text-lg font-bold">
                {editingStatusId ? 'Edit Procurement Status' : 'Add Procurement Status'}
              </Text>
              <Pressable
                onPress={() => setShowStatusModal(false)}
                className="rounded-full items-center justify-center"
                style={{ backgroundColor: colors.bg.input, width: 40, height: 40 }}
              >
                <X size={20} color={colors.text.secondary} strokeWidth={2.5} />
              </Pressable>
            </View>
            <View className="mt-5">
              <Text style={{ color: colors.text.tertiary }} className="text-xs mb-1.5">Status Name</Text>
              <TextInput
                value={statusNameDraft}
                onChangeText={setStatusNameDraft}
                placeholder="e.g. In Transit"
                placeholderTextColor={colors.text.muted}
                style={{ height: 48, borderRadius: 12, borderWidth: 1, borderColor: formFieldBorder, backgroundColor: formFieldBg, color: colors.text.primary, paddingHorizontal: 14, fontSize: 15 }}
              />
            </View>
            <View className="flex-row justify-end mt-6" style={{ gap: 10 }}>
              <Pressable onPress={() => setShowStatusModal(false)} className="rounded-xl px-5" style={{ height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.divider }}>
                <Text style={{ color: colors.text.secondary }} className="font-semibold">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={saveStatusModal}
                disabled={!canSaveProcurementStatus}
                className="rounded-xl px-5"
                style={{ height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: canSaveProcurementStatus ? colors.bar : colors.bg.input }}
              >
                <Text style={{ color: canSaveProcurementStatus ? colors.bg.screen : colors.text.tertiary }} className="font-semibold">
                  {editingStatusId ? 'Update' : 'Save'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={isWebDesktop && showFixedCostModal} transparent animationType="fade" onRequestClose={() => setShowFixedCostModal(false)}>
        <Pressable
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          onPress={() => {
            setShowFixedCostModal(false);
            setShowFixedCostCategoryDropdown(false);
            setShowFixedCostSupplierDropdown(false);
            setShowFixedCostFrequencyDropdown(false);
          }}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              width: '92%',
              maxWidth: 760,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: colors.divider,
              backgroundColor: colors.bg.card,
              overflow: 'visible',
              padding: 20,
            }}
          >
            <View className="flex-row items-center justify-between">
              <Text style={{ color: colors.text.primary }} className="text-lg font-bold">
                {editingFixedCostId ? 'Edit Fixed Cost' : 'Add Fixed Cost'}
              </Text>
              <Pressable
                onPress={() => {
                  setShowFixedCostModal(false);
                  setShowFixedCostCategoryDropdown(false);
                  setShowFixedCostSupplierDropdown(false);
                  setShowFixedCostFrequencyDropdown(false);
                }}
                className="rounded-full items-center justify-center"
                style={{ backgroundColor: colors.bg.input, width: 40, height: 40 }}
              >
                <X size={20} color={colors.text.secondary} strokeWidth={2.5} />
              </Pressable>
            </View>

            <View className="mt-5" style={{ gap: 12, overflow: 'visible' }}>
              <View>
                <Text style={{ color: colors.text.tertiary }} className="text-xs mb-1.5">Name</Text>
                <TextInput
                  value={fixedCostNameDraft}
                  onChangeText={setFixedCostNameDraft}
                  placeholder="e.g. Office Rent"
                  placeholderTextColor={colors.text.muted}
                  style={{ height: 48, borderRadius: 12, borderWidth: 1, borderColor: formFieldBorder, backgroundColor: formFieldBg, color: colors.text.primary, paddingHorizontal: 14, fontSize: 15 }}
                />
              </View>

              <View className="flex-row" style={{ gap: 12, zIndex: showFixedCostCategoryDropdown || showFixedCostFrequencyDropdown ? 2200 : 1 }}>
                <View style={{ flex: 1, position: 'relative', zIndex: showFixedCostCategoryDropdown ? 2300 : 1 }}>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs mb-1.5">Category</Text>
                  <Pressable
                    onPress={() => {
                      setShowFixedCostCategoryDropdown((prev) => !prev);
                      setShowFixedCostSupplierDropdown(false);
                      setShowFixedCostFrequencyDropdown(false);
                      setFixedCostCategorySearch(fixedCostCategoryDraft);
                    }}
                    style={{
                      height: 48,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: showFixedCostCategoryDropdown ? formFieldActiveBorder : formFieldBorder,
                      backgroundColor: formFieldBg,
                      paddingHorizontal: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text numberOfLines={1} style={{ color: fixedCostCategoryDraft ? colors.text.primary : colors.text.muted, flex: 1, marginRight: 8, fontSize: 15 }}>
                      {fixedCostCategoryDraft || 'Select or search category'}
                    </Text>
                    <ChevronDown size={16} color={colors.text.tertiary} strokeWidth={2} />
                  </Pressable>

                  {showFixedCostCategoryDropdown ? (
                    <View
                      style={{
                        position: 'absolute',
                        top: 78,
                        left: 0,
                        right: 0,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: colors.divider,
                        backgroundColor: colors.bg.card,
                        zIndex: 3200,
                        overflow: 'hidden',
                        maxHeight: 240,
                        elevation: 40,
                      }}
                    >
                      <View style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
                        <TextInput
                          value={fixedCostCategorySearch}
                          onChangeText={setFixedCostCategorySearch}
                          placeholder="Search category..."
                          placeholderTextColor={colors.text.muted}
                          style={{ height: 40, borderRadius: 10, borderWidth: 1, borderColor: formFieldBorder, backgroundColor: formFieldBg, color: colors.text.primary, paddingHorizontal: 12, fontSize: 14 }}
                        />
                      </View>
                      <ScrollView showsVerticalScrollIndicator={false}>
                        {filteredFixedCostCategories.map((category) => (
                          <Pressable
                            key={category}
                            onPress={() => {
                              setFixedCostCategoryDraft(category);
                              setFixedCostCategorySearch(category);
                              setShowFixedCostCategoryDropdown(false);
                            }}
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                              borderBottomWidth: 1,
                              borderBottomColor: colors.divider,
                              backgroundColor: fixedCostCategoryDraft === category ? colors.bg.input : colors.bg.card,
                            }}
                          >
                            <Text style={{ color: colors.text.primary, fontSize: 15 }} className="font-medium">{category}</Text>
                          </Pressable>
                        ))}
                        {fixedCostCategorySearch.trim() && !availableExpenseCategories.some(
                          (category) => category.toLowerCase() === fixedCostCategorySearch.trim().toLowerCase()
                        ) ? (
                          <Pressable
                            onPress={() => {
                              const customCategory = fixedCostCategorySearch.trim();
                              upsertExpenseCategoryName(customCategory);
                              setFixedCostCategoryDraft(customCategory);
                              setFixedCostCategorySearch(customCategory);
                              setShowFixedCostCategoryDropdown(false);
                            }}
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                              borderBottomWidth: 1,
                              borderBottomColor: colors.divider,
                              backgroundColor: colors.bg.card,
                            }}
                          >
                            <Text style={{ color: colors.text.primary, fontSize: 15 }} className="font-medium">Use "{fixedCostCategorySearch.trim()}"</Text>
                          </Pressable>
                        ) : null}
                      </ScrollView>
                    </View>
                  ) : null}
                </View>

                <View style={{ flex: 1, position: 'relative', zIndex: showFixedCostFrequencyDropdown ? 2300 : 1 }}>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs mb-1.5">Frequency</Text>
                  <Pressable
                    onPress={() => {
                      setShowFixedCostFrequencyDropdown((prev) => !prev);
                      setShowFixedCostCategoryDropdown(false);
                      setShowFixedCostSupplierDropdown(false);
                    }}
                    style={{
                      height: 48,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: showFixedCostFrequencyDropdown ? formFieldActiveBorder : formFieldBorder,
                      backgroundColor: formFieldBg,
                      paddingHorizontal: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text numberOfLines={1} style={{ color: colors.text.primary, flex: 1, marginRight: 8, fontSize: 15 }}>
                      {fixedCostFrequencyDraft}
                    </Text>
                    <ChevronDown size={16} color={colors.text.tertiary} strokeWidth={2} />
                  </Pressable>

                  {showFixedCostFrequencyDropdown ? (
                    <View
                      style={{
                        position: 'absolute',
                        top: 78,
                        left: 0,
                        right: 0,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: colors.divider,
                        backgroundColor: colors.bg.card,
                        zIndex: 3200,
                        overflow: 'hidden',
                        elevation: 40,
                      }}
                    >
                      {fixedCostFrequencyOptions.map((option) => (
                        <Pressable
                          key={option}
                          onPress={() => {
                            setFixedCostFrequencyDraft(option);
                            setShowFixedCostFrequencyDropdown(false);
                          }}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            borderBottomWidth: 1,
                            borderBottomColor: colors.divider,
                            backgroundColor: fixedCostFrequencyDraft === option ? colors.bg.input : colors.bg.card,
                          }}
                        >
                          <Text style={{ color: colors.text.primary, fontSize: 15 }} className="font-medium">{option}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>

              <View className="flex-row" style={{ gap: 12, zIndex: showFixedCostSupplierDropdown ? 2200 : 1 }}>
                <View style={{ flex: 1, position: 'relative', zIndex: showFixedCostSupplierDropdown ? 2300 : 1 }}>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs mb-1.5">Supplier / Merchant</Text>
                  <Pressable
                    onPress={() => {
                      setShowFixedCostSupplierDropdown((prev) => !prev);
                      setShowFixedCostCategoryDropdown(false);
                      setShowFixedCostFrequencyDropdown(false);
                      setFixedCostSupplierSearch(fixedCostSupplierDraft);
                    }}
                    style={{
                      height: 48,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: showFixedCostSupplierDropdown ? formFieldActiveBorder : formFieldBorder,
                      backgroundColor: formFieldBg,
                      paddingHorizontal: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text numberOfLines={1} style={{ color: fixedCostSupplierDraft ? colors.text.primary : colors.text.muted, flex: 1, marginRight: 8, fontSize: 15 }}>
                      {fixedCostSupplierDraft || 'Select or search supplier'}
                    </Text>
                    <ChevronDown size={16} color={colors.text.tertiary} strokeWidth={2} />
                  </Pressable>

                  {showFixedCostSupplierDropdown ? (
                    <View
                      style={{
                        position: 'absolute',
                        top: 78,
                        left: 0,
                        right: 0,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: colors.divider,
                        backgroundColor: colors.bg.card,
                        zIndex: 3200,
                        overflow: 'hidden',
                        maxHeight: 240,
                        elevation: 40,
                      }}
                    >
                      <View style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
                        <TextInput
                          value={fixedCostSupplierSearch}
                          onChangeText={setFixedCostSupplierSearch}
                          placeholder="Search supplier..."
                          placeholderTextColor={colors.text.muted}
                          style={{ height: 40, borderRadius: 10, borderWidth: 1, borderColor: formFieldBorder, backgroundColor: formFieldBg, color: colors.text.primary, paddingHorizontal: 12, fontSize: 14 }}
                        />
                      </View>
                      <ScrollView showsVerticalScrollIndicator={false}>
                        <Pressable
                          onPress={() => {
                            setFixedCostSupplierDraft('');
                            setFixedCostSupplierSearch('');
                            setShowFixedCostSupplierDropdown(false);
                          }}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            borderBottomWidth: 1,
                            borderBottomColor: colors.divider,
                            backgroundColor: fixedCostSupplierDraft === '' ? colors.bg.input : colors.bg.card,
                          }}
                        >
                          <Text style={{ color: colors.text.secondary, fontSize: 13 }}>No supplier (optional)</Text>
                        </Pressable>
                        {filteredFixedCostSuppliers.map((supplier) => (
                          <Pressable
                            key={supplier}
                            onPress={() => {
                              setFixedCostSupplierDraft(supplier);
                              setFixedCostSupplierSearch(supplier);
                              setShowFixedCostSupplierDropdown(false);
                            }}
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                              borderBottomWidth: 1,
                              borderBottomColor: colors.divider,
                              backgroundColor: fixedCostSupplierDraft === supplier ? colors.bg.input : colors.bg.card,
                            }}
                          >
                            <Text style={{ color: colors.text.primary, fontSize: 15 }} className="font-medium">{supplier}</Text>
                          </Pressable>
                        ))}
                        {fixedCostSupplierSearch.trim() && !availableExpenseMerchants.some(
                          (supplier) => supplier.toLowerCase() === fixedCostSupplierSearch.trim().toLowerCase()
                        ) ? (
                          <Pressable
                            onPress={() => {
                              const customSupplier = fixedCostSupplierSearch.trim();
                              upsertFinanceSupplierName(customSupplier);
                              setFixedCostSupplierDraft(customSupplier);
                              setFixedCostSupplierSearch(customSupplier);
                              setShowFixedCostSupplierDropdown(false);
                            }}
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                              borderBottomWidth: 1,
                              borderBottomColor: colors.divider,
                              backgroundColor: colors.bg.card,
                            }}
                          >
                            <Text style={{ color: colors.text.primary, fontSize: 15 }} className="font-medium">Use "{fixedCostSupplierSearch.trim()}"</Text>
                          </Pressable>
                        ) : null}
                      </ScrollView>
                    </View>
                  ) : null}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs mb-1.5">Amount (N)</Text>
                  <TextInput
                    value={fixedCostAmountDraft}
                    onChangeText={setFixedCostAmountDraft}
                    placeholder="0"
                    keyboardType="decimal-pad"
                    placeholderTextColor={colors.text.muted}
                    style={{ height: 48, borderRadius: 12, borderWidth: 1, borderColor: formFieldBorder, backgroundColor: formFieldBg, color: colors.text.primary, paddingHorizontal: 14, fontSize: 15 }}
                  />
                </View>
              </View>

              <View>
                <Text style={{ color: colors.text.tertiary }} className="text-xs mb-1.5">Notes (optional)</Text>
                <TextInput
                  value={fixedCostNotesDraft}
                  onChangeText={setFixedCostNotesDraft}
                  placeholder="Optional notes..."
                  placeholderTextColor={colors.text.muted}
                  multiline
                  numberOfLines={3}
                  style={{ minHeight: 84, borderRadius: 12, borderWidth: 1, borderColor: formFieldBorder, backgroundColor: formFieldBg, color: colors.text.primary, paddingHorizontal: 14, paddingTop: 12, textAlignVertical: 'top', fontSize: 15 }}
                />
              </View>
            </View>

            <View className="flex-row justify-end mt-6" style={{ gap: 10 }}>
              <Pressable
                onPress={() => {
                  setShowFixedCostModal(false);
                  setShowFixedCostCategoryDropdown(false);
                  setShowFixedCostSupplierDropdown(false);
                  setShowFixedCostFrequencyDropdown(false);
                }}
                className="rounded-xl px-5"
                style={{ height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.divider }}
              >
                <Text style={{ color: colors.text.secondary }} className="font-semibold">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={saveFixedCostModal}
                disabled={!canSaveFixedCost}
                className="rounded-xl px-5"
                style={{ height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: canSaveFixedCost ? colors.bar : colors.bg.input }}
              >
                <Text style={{ color: canSaveFixedCost ? colors.bg.screen : colors.text.tertiary }} className="font-semibold">
                  {editingFixedCostId ? 'Update' : 'Save'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showBankChargeTierModal} transparent animationType="fade" onRequestClose={() => setShowBankChargeTierModal(false)}>
        <Pressable
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)', padding: 20 }}
          onPress={() => setShowBankChargeTierModal(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 420, borderRadius: 20, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, padding: 24, gap: 18 }}
          >
            <View className="flex-row items-center justify-between">
              <Text style={{ color: colors.text.primary, fontSize: 18, fontWeight: '700' }}>
                {editingBankChargeTierId ? 'Edit Tier' : 'Add Tier'}
              </Text>
              <Pressable
                onPress={() => setShowBankChargeTierModal(false)}
                style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.bg.input, alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={18} color={colors.text.secondary} strokeWidth={2.5} />
              </Pressable>
            </View>

            {/* Catch-all toggle */}
            <Pressable
              onPress={() => setTierIsLastDraft((prev) => !prev)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <View style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: tierIsLastDraft ? toggleTrackOn : toggleTrackOff, justifyContent: 'center', paddingHorizontal: 3 }}>
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: toggleKnobColor, marginLeft: tierIsLastDraft ? 18 : 0 }} />
              </View>
              <Text style={{ color: colors.text.secondary, fontSize: 14 }}>Final catch-all tier (no upper limit)</Text>
            </Pressable>

            {!tierIsLastDraft ? (
              <View style={{ gap: 6 }}>
                <Text style={{ color: colors.text.tertiary, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>Max Amount (₦)</Text>
                <TextInput
                  value={tierMaxAmountDraft}
                  onChangeText={setTierMaxAmountDraft}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 5000"
                  placeholderTextColor={colors.text.muted}
                  style={{ height: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.input, color: colors.text.primary, paddingHorizontal: 14, fontSize: 15 }}
                />
                <Text style={{ color: colors.text.muted, fontSize: 12 }}>Applies to amounts up to this value.</Text>
              </View>
            ) : (
              <View style={{ padding: 12, borderRadius: 10, backgroundColor: colors.bg.input }}>
                <Text style={{ color: colors.text.secondary, fontSize: 13 }}>This tier applies to all amounts above the previous tier's limit.</Text>
              </View>
            )}

            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.text.tertiary, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>Fixed Fee (₦)</Text>
              <TextInput
                value={tierFixedFeeDraft}
                onChangeText={setTierFixedFeeDraft}
                keyboardType="decimal-pad"
                placeholder="e.g. 25"
                placeholderTextColor={colors.text.muted}
                style={{ height: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.input, color: colors.text.primary, paddingHorizontal: 14, fontSize: 15 }}
              />
              <Text style={{ color: colors.text.muted, fontSize: 12 }}>VAT ({(financeRules.vatRate * 100).toFixed(1)}%) will be added on top.</Text>
            </View>

            <View className="flex-row" style={{ gap: 10 }}>
              <Pressable
                onPress={() => setShowBankChargeTierModal(false)}
                style={{ flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.divider, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: colors.text.secondary, fontSize: 14, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const fee = Number.parseFloat(tierFixedFeeDraft);
                  if (!Number.isFinite(fee) || fee < 0) {
                    showSettingsToast('error', 'Enter a valid transfer fee.');
                    return;
                  }
                  const maxAmt = tierIsLastDraft ? null : Number.parseFloat(tierMaxAmountDraft.replace(/,/g, ''));
                  if (!tierIsLastDraft && (!Number.isFinite(maxAmt as number) || (maxAmt as number) <= 0)) {
                    showSettingsToast('error', 'Enter a valid max amount for this tier.');
                    return;
                  }
                  const tier: BankChargeTier = {
                    id: editingBankChargeTierId ?? `tier-${Date.now().toString(36)}`,
                    maxAmount: maxAmt,
                    fixedFee: fee,
                  };
                  const updated = editingBankChargeTierId
                    ? financeRules.bankChargeTiers.map((t) => t.id === editingBankChargeTierId ? tier : t)
                    : [...financeRules.bankChargeTiers, tier];
                  const sorted: BankChargeTier[] = [
                    ...updated.filter((t) => t.maxAmount !== null).sort((a, b) => (a.maxAmount ?? 0) - (b.maxAmount ?? 0)),
                    ...updated.filter((t) => t.maxAmount === null),
                  ];
                  handleSaveFinanceRules(
                    { bankChargeTiers: sorted },
                    settingsSavedMessage('Transfer fee tier')
                  );
                  setShowBankChargeTierModal(false);
                }}
                style={{ flex: 1, height: 46, borderRadius: 12, backgroundColor: colors.bar, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: colors.bg.screen, fontSize: 14, fontWeight: '600' }}>
                  {editingBankChargeTierId ? 'Save Changes' : 'Add Tier'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Revenue Rule Modal ── */}
      <Modal visible={showRevenueRuleModal} transparent animationType="fade">
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
          onPress={() => setShowRevenueRuleModal(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 400, borderRadius: 20, padding: 20, backgroundColor: colors.bg.card, gap: 14 }}
          >
            <Text style={{ color: colors.text.primary, fontSize: 17, fontWeight: '700' }}>
              {editingRevenueRuleId ? 'Edit Gateway Fee' : 'Add Gateway Fee'}
            </Text>

            {/* Rule Name */}
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.text.secondary, fontSize: 13, fontWeight: '600' }}>Name</Text>
              <TextInput
                value={revenueRuleNameDraft}
                onChangeText={setRevenueRuleNameDraft}
                placeholder="e.g. Paystack Fee"
                placeholderTextColor={colors.text.muted}
                style={{ height: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.input, color: colors.text.primary, paddingHorizontal: 14, fontSize: 15 }}
              />
            </View>

            {/* Payment method picker */}
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.text.secondary, fontSize: 13, fontWeight: '600' }}>Which payment method does this apply to?</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
                <View className="flex-row" style={{ gap: 8, paddingBottom: 2 }}>
                  {['All Payment Methods', ...gatewayFeePaymentMethodOptions].map((ch) => {
                    const active = revenueRuleChannelDraft === ch;
                    return (
                      <Pressable
                        key={ch}
                        onPress={() => setRevenueRuleChannelDraft(ch)}
                        style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: active ? colors.bar : colors.divider, backgroundColor: active ? colors.bar : colors.bg.input }}
                      >
                        <Text style={{ color: active ? colors.bg.screen : colors.text.secondary, fontSize: 13, fontWeight: '600' }}>{ch}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
              <Text style={{ color: colors.text.muted, fontSize: 12 }}>"All Payment Methods" means every order regardless of payment method.</Text>
            </View>

            {/* % Fee + Flat Fee row */}
            <View className="flex-row" style={{ gap: 10 }}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ color: colors.text.secondary, fontSize: 13, fontWeight: '600' }}>% Fee</Text>
                <TextInput
                  value={revenueRulePercentDraft}
                  onChangeText={setRevenueRulePercentDraft}
                  placeholder="1.5"
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.text.muted}
                  style={{ height: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.input, color: colors.text.primary, paddingHorizontal: 14, fontSize: 15 }}
                />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ color: colors.text.secondary, fontSize: 13, fontWeight: '600' }}>Flat Fee (₦)</Text>
                <TextInput
                  value={revenueRuleFlatDraft}
                  onChangeText={setRevenueRuleFlatDraft}
                  placeholder="100"
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.text.muted}
                  style={{ height: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.input, color: colors.text.primary, paddingHorizontal: 14, fontSize: 15 }}
                />
              </View>
            </View>
            <Text style={{ color: colors.text.muted, fontSize: 12, marginTop: -8 }}>
              Paystack example: 1.5% + ₦100 flat. Leave % or flat at 0 if it doesn't apply.
            </Text>

            <View className="flex-row" style={{ gap: 10 }}>
              <Pressable
                onPress={() => setShowRevenueRuleModal(false)}
                style={{ flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.divider, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: colors.text.secondary, fontSize: 14, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const name = revenueRuleNameDraft.trim();
                  const channel = revenueRuleChannelDraft.trim();
                  if (!name) {
                    showSettingsToast('error', 'Enter a gateway fee name (e.g. Paystack).');
                    return;
                  }
                  if (!channel) {
                    showSettingsToast('error', 'Select a payment method.');
                    return;
                  }

                  const pctInput = revenueRulePercentDraft.replace(/,/g, '').trim();
                  const flatInput = revenueRuleFlatDraft.replace(/,/g, '').trim();
                  const parsedPct = pctInput ? Number.parseFloat(pctInput) : 0;
                  const parsedFlat = flatInput ? Number.parseFloat(flatInput) : 0;

                  if ((pctInput && !Number.isFinite(parsedPct)) || (flatInput && !Number.isFinite(parsedFlat))) {
                    showSettingsToast('error', 'Enter valid numbers for fee values.');
                    return;
                  }

                  const pct = Number.isFinite(parsedPct) ? parsedPct : 0;
                  const flat = Number.isFinite(parsedFlat) ? parsedFlat : 0;
                  if (pct < 0 || flat < 0) {
                    showSettingsToast('error', 'Fee values cannot be negative.');
                    return;
                  }
                  if (pct === 0 && flat === 0) {
                    showSettingsToast('error', 'Set at least % fee or flat fee.');
                    return;
                  }

                  if (editingRevenueRuleId) {
                    updateRevenueRule(editingRevenueRuleId, { name, channel, percentFee: pct, flatFee: flat });
                    notifySettingsSaved(settingsSavedMessage('Gateway fee'));
                  } else {
                    addRevenueRule({ id: `rrule-${Date.now().toString(36)}`, name, channel, percentFee: pct, flatFee: flat, enabled: true });
                    notifySettingsSaved(settingsSavedMessage('Gateway fee'));
                  }
                  setShowRevenueRuleModal(false);
                }}
                style={{ flex: 1, height: 46, borderRadius: 12, backgroundColor: colors.bar, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: colors.bg.screen, fontSize: 14, fontWeight: '600' }}>
                  {editingRevenueRuleId ? 'Save' : 'Add Fee'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {canAccessFinance ? (
        <FyllAiAssistantDrawer
          visible={showFinanceAiPanel}
          onClose={() => setShowFinanceAiPanel(false)}
          title="Fyll AI Finance"
          subtitle="Ask questions about performance, costs, and next actions"
          openingMessage={financeAiOpeningMessage}
          contextBadges={financeAiContextBadges}
          quickPrompts={financeAiQuickPrompts}
          recommendations={financeAiRecommendations}
          colors={colors}
          placeholder="Ask about profit, fees, or expenses..."
          onAsk={handleAskFinanceAi}
        />
      ) : null}

      {settingsToast ? (
        <View
          className="absolute left-5 right-5 items-center"
          style={{ top: Math.max(12, insets.top + 12), pointerEvents: 'none' }}
        >
          <View
            className="flex-row items-center px-5 py-4 rounded-xl"
            style={{ backgroundColor: settingsToast.type === 'success' ? '#111111' : '#EF4444' }}
          >
            <View className="w-8 h-8 rounded-full items-center justify-center mr-3 bg-white">
              {settingsToast.type === 'success' ? (
                <Check size={18} color="#111111" strokeWidth={2.5} />
              ) : (
                <X size={18} color="#EF4444" strokeWidth={2.5} />
              )}
            </View>
            <Text className="text-white font-semibold text-sm">{settingsToast.message}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
