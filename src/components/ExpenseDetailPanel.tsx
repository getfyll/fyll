import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { X, MoreVertical, Receipt, FileText, Download, User, Tag, Calendar, Clock, CheckCircle, XCircle, Send, PlusCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import useFyllStore, { type Expense, type ExpensePaymentStatus, type ExpenseRequestReceipt, formatCurrency } from '@/lib/state/fyll-store';
import { useStatsColors } from '@/lib/theme';
import { openAttachmentPath } from '@/lib/storage-attachments';

// ── helpers ──

const extractMetadataValue = (source: string | undefined, key: string): string | null => {
  if (!source) return null;
  const pattern = /\[([a-z_]+):([^\]]+)\]/gi;
  const keyLower = key.toLowerCase();
  let match = pattern.exec(source);
  while (match) {
    if (match[1]?.toLowerCase() === keyLower) return match[2]?.trim() ?? null;
    match = pattern.exec(source);
  }
  return null;
};

const stripMetadata = (source: string | undefined): string => {
  if (!source) return '';
  return source.replace(/\[([a-z_]+):([^\]]+)\]/gi, '').replace(/\s+/g, ' ').trim();
};

const decodeMetadataJson = <T, >(value: string | null): T | null => {
  if (!value) return null;
  try { return JSON.parse(decodeURIComponent(value)) as T; } catch { return null; }
};

type ExpenseType = 'one-time' | 'recurring';
type LineItem = { id: string; label: string; amount: number; category: string };

const parseLineItems = (description: string | undefined, fallbackCategory: string, fallbackAmount: number): LineItem[] => {
  const encoded = extractMetadataValue(description, 'line_items');
  const parsed = decodeMetadataJson<{ label?: string; amount?: number; category?: string; kind?: string }[]>(encoded);
  if (parsed && parsed.length > 0) {
    const normalized = parsed.map((line, i) => ({
      id: `line-${i + 1}`,
      label: (line.label ?? '').trim() || (i === 0 ? 'Base Amount' : 'Additional Charge'),
      amount: Number.isFinite(Number(line.amount)) ? Number(line.amount) : 0,
      category: (line.category ?? fallbackCategory).trim() || fallbackCategory,
    })).filter((l) => l.amount >= 0);
    if (normalized.length > 0) return normalized;
  }
  return [{ id: 'line-base', label: 'Base Amount', amount: Number.isFinite(fallbackAmount) ? fallbackAmount : 0, category: fallbackCategory || 'General' }];
};

const parseReceipts = (description: string | undefined): ExpenseRequestReceipt[] => {
  const encoded = extractMetadataValue(description, 'receipts');
  const parsed = decodeMetadataJson<{ id?: string; fileName?: string; storagePath?: string; mimeType?: string; fileSize?: number }[]>(encoded);
  if (parsed && parsed.length > 0) {
    return parsed.filter((r) => Boolean(r.storagePath)).map((r, i) => ({
      id: r.id || `receipt-${i + 1}`, fileName: r.fileName || `Receipt ${i + 1}`, storagePath: r.storagePath || '', mimeType: r.mimeType, fileSize: Number.isFinite(Number(r.fileSize)) ? Number(r.fileSize) : undefined,
    })).filter((r) => r.storagePath.length > 0);
  }
  const legacyPath = extractMetadataValue(description, 'receipt_path');
  if (!legacyPath) return [];
  return [{ id: 'receipt-legacy', fileName: extractMetadataValue(description, 'receipt_name') || 'Receipt', storagePath: legacyPath }];
};

const inferExpenseType = (expense: Expense): ExpenseType => {
  const metaType = extractMetadataValue(expense.description, 'type')?.toLowerCase();
  if (metaType === 'one-time') return 'one-time';
  if (metaType === 'recurring' || metaType === 'fixed') return 'recurring';
  const source = `${expense.category} ${expense.description}`.toLowerCase();
  if (/rent|salary|payroll|utility|insurance|lease/.test(source)) return 'recurring';
  if (/subscription|recurring|ads|marketing|internet|delivery|logistics/.test(source)) return 'recurring';
  return 'one-time';
};

// ── props ──

interface ExpenseDetailPanelProps {
  expenseId: string;
  compact?: boolean;
  onClose: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ExpenseDetailPanel({ expenseId, compact = false, onClose, onEdit, onDelete }: ExpenseDetailPanelProps) {
  const colors = useStatsColors();
  const expenses = useFyllStore((s) => s.expenses);
  const [showActionMenu, setShowActionMenu] = useState<boolean>(false);

  const expense = useMemo(() => expenses.find((e) => e.id === expenseId) ?? null, [expenses, expenseId]);

  const expenseType = useMemo(() => expense ? inferExpenseType(expense) : 'one-time', [expense]);
  const merchant = useMemo(() => extractMetadataValue(expense?.description, 'merchant') ?? '', [expense]);
  const name = useMemo(() => expense ? (stripMetadata(expense.description) || expense.description) : '', [expense]);
  const date = useMemo(() => {
    if (!expense) return '';
    const ts = new Date(expense.date).getTime();
    return Number.isFinite(ts) ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : expense.date;
  }, [expense]);
  const createdAt = useMemo(() => {
    if (!expense) return '';
    const ts = new Date(expense.createdAt).getTime();
    return Number.isFinite(ts) ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  }, [expense]);
  const lineItems = useMemo(() => expense ? parseLineItems(expense.description, expense.category || 'General', expense.amount) : [], [expense]);
  const receipts = useMemo(() => parseReceipts(expense?.description), [expense]);
  const note = useMemo(() => extractMetadataValue(expense?.description, 'note') ?? '', [expense]);

  const expenseRequests = useFyllStore((s) => s.expenseRequests);
  const linkedRequest = useMemo(
    () => expenseRequests.find((r) => r.approvedExpenseId === expenseId) ?? null,
    [expenseRequests, expenseId],
  );

  type ActivityEventType = 'create' | 'submit' | 'approve' | 'reject';
  const activityEvents = useMemo<{ label: string; actor: string; ts: string; type: ActivityEventType }[]>(() => {
    if (!expense) return [];
    if (linkedRequest) {
      const events: { label: string; actor: string; ts: string; type: ActivityEventType }[] = [
        { label: 'Expense requested', actor: linkedRequest.submittedByName || 'Team member', ts: linkedRequest.submittedAt || linkedRequest.createdAt, type: 'submit' },
      ];
      if (linkedRequest.status === 'approved') {
        events.push({ label: 'Approved & logged', actor: linkedRequest.reviewedByName || 'Admin', ts: linkedRequest.reviewedAt || expense.createdAt, type: 'approve' });
      } else if (linkedRequest.status === 'rejected') {
        events.push({ label: 'Declined', actor: linkedRequest.reviewedByName || 'Admin', ts: linkedRequest.reviewedAt || '', type: 'reject' });
      }
      return events;
    }
    return [{ label: 'Expense logged', actor: expense.createdBy || 'Admin', ts: expense.createdAt, type: 'create' }];
  }, [expense, linkedRequest]);

  const typeBadgeColors = expenseType === 'recurring'
    ? { bg: 'rgba(139, 92, 246, 0.16)', text: '#8B5CF6' }
    : { bg: 'rgba(59, 130, 246, 0.16)', text: '#3B82F6' };

  const STATUS_BADGE: Record<ExpensePaymentStatus, { label: string; bg: string; text: string }> = {
    draft:   { label: 'Draft',   bg: 'rgba(107,114,128,0.12)', text: '#6B7280' },
    partial: { label: 'Partial', bg: 'rgba(245,158,11,0.12)',  text: '#F59E0B' },
    paid:    { label: 'Paid',    bg: 'rgba(16,185,129,0.12)',  text: '#10B981' },
  };
  const statusBadge = expense?.status ? STATUS_BADGE[expense.status] : null;
  const heroPadding = compact ? 16 : 20;
  const heroAmountFontSize = compact ? 30 : 36;
  const heroAmountLineHeight = compact ? 36 : 42;
  const detailValueFontSize = compact ? 12 : 13;

  useEffect(() => {
    setShowActionMenu(false);
  }, [expenseId]);

  const handleOpenReceipt = async (storagePath: string) => {
    const path = storagePath.trim();
    if (!path) return;
    try {
      await openAttachmentPath(path, 60 * 10);
    } catch (err) {
      console.warn('Open receipt failed:', err);
    }
  };

  if (!expense) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: colors.text.muted, fontSize: 15 }}>Expense not found</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.screen }}>
      {showActionMenu ? (
        <Pressable
          onPress={() => setShowActionMenu(false)}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 30 }}
        />
      ) : null}
      {/* Panel header */}
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
          position: 'relative',
          zIndex: 40,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.divider }}>
            <Receipt size={15} color={colors.text.tertiary} strokeWidth={2} />
          </View>
          <Text style={{ color: colors.text.primary, fontSize: compact ? 15 : 16, fontWeight: '700' }}>Expense Details</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ position: 'relative' }}>
            <Pressable
              onPress={() => setShowActionMenu((current) => !current)}
              style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.divider, backgroundColor: showActionMenu ? colors.bg.input : colors.bg.card }}
            >
              <MoreVertical size={16} color={colors.text.secondary} strokeWidth={2} />
            </Pressable>
            {showActionMenu ? (
              <View
                style={{
                  position: 'absolute',
                  top: 40,
                  right: 0,
                  minWidth: 162,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.divider,
                  backgroundColor: colors.bg.card,
                  overflow: 'hidden',
                  shadowColor: '#000000',
                  shadowOpacity: 0.12,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 6 },
                  zIndex: 60,
                }}
              >
                <Pressable
                  onPress={() => {
                    setShowActionMenu(false);
                    onEdit(expenseId);
                  }}
                  className="px-3 py-2.5"
                  style={{ borderBottomWidth: 1, borderBottomColor: colors.divider }}
                >
                  <Text style={{ color: colors.text.primary }} className="text-sm font-medium">Edit</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setShowActionMenu(false);
                    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    onDelete(expenseId);
                  }}
                  className="px-3 py-2.5"
                >
                  <Text style={{ color: colors.danger }} className="text-sm font-medium">Delete</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
          <Pressable
            onPress={() => {
              setShowActionMenu(false);
              onClose();
            }}
            style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.divider }}
          >
            <X size={16} color={colors.text.secondary} strokeWidth={2.5} />
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32, gap: 12 }}>

        {/* Hero amount card */}
        <View style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.divider }}>
          <View style={{ padding: heroPadding, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
            <Text style={{ color: colors.text.muted, fontSize: 11, fontWeight: '400', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
              {name || expense.category}
            </Text>
            <Text style={{ color: colors.text.primary, fontSize: heroAmountFontSize, fontWeight: '500', lineHeight: heroAmountLineHeight }}>
              {formatCurrency(expense.amount)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 }}>
              <Text style={{ color: colors.text.secondary, fontSize: compact ? 12 : 13 }}>{date}</Text>
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, backgroundColor: typeBadgeColors.bg }}>
                <Text style={{ color: typeBadgeColors.text, fontSize: 11, fontWeight: '600' }}>
                  {expenseType === 'one-time' ? 'One-Time' : 'Recurring'}
                </Text>
              </View>
              {statusBadge ? (
                <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, backgroundColor: statusBadge.bg }}>
                  <Text style={{ color: statusBadge.text, fontSize: 11, fontWeight: '600' }}>{statusBadge.label}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Payment breakdown */}
          <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
            <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
              Payment Breakdown
            </Text>
            {lineItems.map((line, index) => (
              <View
                key={line.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 8,
                  borderBottomWidth: index === lineItems.length - 1 ? 0 : 1,
                  borderBottomColor: colors.divider,
                }}
              >
                <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                  <Text style={{ color: colors.text.primary, fontSize: compact ? 12 : 13, fontWeight: '500' }} numberOfLines={1}>{line.label}</Text>
                  <Text style={{ color: colors.text.muted, fontSize: 11, marginTop: 1 }}>{line.category}</Text>
                </View>
                <Text style={{ color: colors.text.primary, fontSize: compact ? 13 : 14, fontWeight: '600' }}>
                  {formatCurrency(line.amount)}
                </Text>
              </View>
            ))}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1.5, borderTopColor: colors.divider }}>
              <Text style={{ color: colors.text.primary, fontSize: compact ? 12 : 13, fontWeight: '700' }}>Total Logged</Text>
              <Text style={{ color: colors.text.primary, fontSize: compact ? 14 : 15, fontWeight: '500' }}>{formatCurrency(expense.amount)}</Text>
            </View>
          </View>
        </View>

        {/* Metadata card */}
        <View style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.divider }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
            <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>Details</Text>
          </View>

          {[
            { icon: <User size={15} color={colors.text.tertiary} strokeWidth={2} />, label: 'Supplier / Merchant', value: merchant || '—' },
            { icon: <Tag size={15} color={colors.text.tertiary} strokeWidth={2} />, label: 'Category', value: expense.category || '—' },
            { icon: <Calendar size={15} color={colors.text.tertiary} strokeWidth={2} />, label: 'Date', value: date },
            { icon: <Clock size={15} color={colors.text.tertiary} strokeWidth={2} />, label: 'Created', value: createdAt || '—' },
          ].map((row, index) => (
            <View
              key={row.label}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderTopWidth: index === 0 ? 1 : 0,
                borderTopColor: colors.divider,
                gap: 12,
              }}
            >
              <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.divider }}>
                {row.icon}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: colors.text.muted, fontSize: 11 }}>{row.label}</Text>
                <Text style={{ color: colors.text.primary, fontSize: detailValueFontSize, fontWeight: '600', marginTop: 1 }} numberOfLines={1}>{row.value}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Notes */}
        {note ? (
          <View style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.divider, padding: 16 }}>
            <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Notes</Text>
            <Text style={{ color: colors.text.primary, fontSize: detailValueFontSize, lineHeight: compact ? 18 : 20 }}>{note}</Text>
          </View>
        ) : null}

        {/* Receipts */}
        {receipts.length > 0 ? (
          <View style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.divider }}>
            <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
              <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>Receipts & Evidence</Text>
            </View>
            {receipts.map((receipt, index) => (
              <Pressable
                key={receipt.id}
                onPress={() => { void handleOpenReceipt(receipt.storagePath); }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderTopWidth: 1,
                  borderTopColor: colors.divider,
                  gap: 12,
                }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.divider }}>
                  <FileText size={17} color={colors.text.tertiary} strokeWidth={2} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{receipt.fileName}</Text>
                  <Text style={{ color: colors.text.muted, fontSize: 11, marginTop: 1 }}>Tap to view</Text>
                </View>
                <Download size={16} color={colors.text.muted} strokeWidth={2} />
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* Activity thread */}
        {activityEvents.length > 0 ? (
          <View style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.divider }}>
            <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 }}>
              <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>Activity</Text>
            </View>
            {activityEvents.map((event, index) => {
              const isLast = index === activityEvents.length - 1;
              const dotColor = event.type === 'approve' ? '#10B981' : event.type === 'reject' ? '#EF4444' : event.type === 'submit' ? '#3B82F6' : colors.text.muted;
              const dotBg = event.type === 'approve' ? 'rgba(16,185,129,0.12)' : event.type === 'reject' ? 'rgba(239,68,68,0.12)' : event.type === 'submit' ? 'rgba(59,130,246,0.12)' : colors.bg.input;
              const EventIcon = event.type === 'approve' ? CheckCircle : event.type === 'reject' ? XCircle : event.type === 'submit' ? Send : PlusCircle;
              const tsMs = new Date(event.ts).getTime();
              const tsLabel = (() => {
                if (!Number.isFinite(tsMs)) return '';
                const diffMs = Date.now() - tsMs;
                const mins = Math.floor(diffMs / 60000);
                if (mins < 1) return 'just now';
                if (mins < 60) return `${mins}m ago`;
                const hrs = Math.floor(mins / 60);
                if (hrs < 24) return `${hrs}h ago`;
                const days = Math.floor(hrs / 24);
                if (days < 7) return `${days}d ago`;
                return new Date(tsMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              })();
              return (
                <View key={index} style={{ flexDirection: 'row', paddingHorizontal: 16, paddingBottom: isLast ? 16 : 0 }}>
                  <View style={{ width: 32, alignItems: 'center', paddingTop: 2 }}>
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: dotBg, alignItems: 'center', justifyContent: 'center' }}>
                      <EventIcon size={13} color={dotColor} strokeWidth={2} />
                    </View>
                    {!isLast ? <View style={{ width: 1.5, flex: 1, backgroundColor: colors.divider, marginTop: 4 }} /> : null}
                  </View>
                  <View style={{ flex: 1, paddingLeft: 10, paddingTop: 4, paddingBottom: isLast ? 0 : 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <Text style={{ color: colors.text.primary, fontSize: compact ? 11 : 12, fontWeight: '600', flex: 1 }}>{event.label}</Text>
                      {tsLabel ? <Text style={{ color: colors.text.muted, fontSize: 10 }}>{tsLabel}</Text> : null}
                    </View>
                    <Text style={{ color: colors.text.tertiary, fontSize: 10, marginTop: 2 }}>{event.actor}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}
