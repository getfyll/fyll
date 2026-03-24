import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Platform, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Receipt, Pencil, Trash2, FileText, Download, Tag, Calendar, Clock, User, MoreVertical } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import useFyllStore, { type Expense, type ExpenseRequestReceipt, formatCurrency } from '@/lib/state/fyll-store';
import useAuthStore from '@/lib/state/auth-store';
import { useStatsColors } from '@/lib/theme';
import { useBreakpoint } from '@/lib/useBreakpoint';
import { openAttachmentPath } from '@/lib/storage-attachments';

// ── helpers (duplicated from finance.tsx to keep this file self-contained) ──

type ExpenseType = 'one-time' | 'recurring';

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

const normalizeBreakdownCategory = (value: string): string => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : 'General';
};

const decodeMetadataJson = <T, >(value: string | null): T | null => {
  if (!value) return null;
  try { return JSON.parse(decodeURIComponent(value)) as T; } catch { return null; }
};

type LineItem = { id: string; label: string; amount: number; category: string; kind: 'base' | 'charge' };

const parseLineItems = (description: string | undefined, fallbackCategory: string, fallbackAmount: number): LineItem[] => {
  const encoded = extractMetadataValue(description, 'line_items');
  const parsed = decodeMetadataJson<{ label?: string; amount?: number; category?: string; kind?: 'base' | 'charge' }[]>(encoded);
  if (parsed && parsed.length > 0) {
    const normalized = parsed.map((line, i) => ({
      id: `line-${i + 1}`,
      label: (line.label ?? '').trim() || (i === 0 ? 'Base Amount' : 'Additional Charge'),
      amount: Number.isFinite(Number(line.amount)) ? Number(line.amount) : 0,
      category: normalizeBreakdownCategory(line.category ?? fallbackCategory),
      kind: (line.kind === 'charge' ? 'charge' : (i === 0 ? 'base' : 'charge')) as 'base' | 'charge',
    })).filter((l) => l.amount >= 0);
    if (normalized.length > 0) return normalized;
  }
  return [{ id: 'line-base', label: 'Base Amount', amount: Number.isFinite(fallbackAmount) ? fallbackAmount : 0, category: normalizeBreakdownCategory(fallbackCategory), kind: 'base' }];
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

const formatExpenseTypeLabel = (value: ExpenseType) => value === 'one-time' ? 'One-Time' : 'Recurring';

// ── component ──

export default function ExpenseDetailScreen() {
  const router = useRouter();
  const colors = useStatsColors();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useBreakpoint();
  const isWebDesktop = Platform.OS === 'web' && isDesktop;
  const { id } = useLocalSearchParams<{ id: string }>();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const expenses = useFyllStore((s) => s.expenses);
  const deleteExpense = useFyllStore((s) => s.deleteExpense);
  const businessId = useAuthStore((s) => s.businessId ?? s.currentUser?.businessId ?? null);

  const expense = useMemo(() => expenses.find((e) => e.id === id) ?? null, [expenses, id]);

  const expenseType = useMemo(() => expense ? inferExpenseType(expense) : 'one-time', [expense]);
  const merchant = useMemo(() => extractMetadataValue(expense?.description, 'merchant') ?? '', [expense]);
  const name = useMemo(() => expense ? (stripMetadata(expense.description) || expense.description) : '', [expense]);
  const date = useMemo(() => {
    if (!expense) return '';
    const ts = new Date(expense.date).getTime();
    return Number.isFinite(ts) ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : expense.date;
  }, [expense]);
  const lineItems = useMemo(() => expense ? parseLineItems(expense.description, expense.category || 'General', expense.amount) : [], [expense]);
  const receipts = useMemo(() => parseReceipts(expense?.description), [expense]);
  const note = useMemo(() => extractMetadataValue(expense?.description, 'note') ?? '', [expense]);

  const handleOpenReceipt = async (storagePath: string) => {
    const path = storagePath.trim();
    if (!path) return;
    try {
      await openAttachmentPath(path, 60 * 10);
    } catch (err) {
      console.warn('Open receipt failed:', err);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleDelete = () => {
    if (!expense || !businessId) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    deleteExpense(expense.id, businessId);
    router.back();
  };

  const handleEdit = () => {
    if (!expense) return;
    router.replace(`/(tabs)/finance?section=expenses&editExpenseId=${encodeURIComponent(expense.id)}` as any);
  };

  if (!expense) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.bg.screen }}>
        <Text style={{ color: colors.text.muted }} className="text-base">Expense not found</Text>
        <Pressable onPress={() => router.back()} className="mt-4 rounded-xl px-6 py-3" style={{ backgroundColor: colors.bg.input }}>
          <Text style={{ color: colors.text.primary }} className="font-semibold">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  // ── badge component ──
  const TypeBadge = () => {
    const badgeColors = expenseType === 'recurring'
      ? { bg: 'rgba(139, 92, 246, 0.16)', text: '#8B5CF6' }
      : { bg: 'rgba(59, 130, 246, 0.16)', text: '#3B82F6' };
    return (
      <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: badgeColors.bg }}>
        <Text className="text-xs font-semibold" style={{ color: badgeColors.text }}>{formatExpenseTypeLabel(expenseType)}</Text>
      </View>
    );
  };

  // ── metadata row ──
  const MetaRow = ({ icon, label, value, extra }: { icon: React.ReactNode; label: string; value: string; extra?: React.ReactNode }) => (
    <View className="flex-row items-center py-4" style={{ borderTopWidth: 1, borderTopColor: colors.divider, paddingLeft: 20, paddingRight: 16 }}>
      <View className="rounded-xl items-center justify-center" style={{ width: 42, height: 42, backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.divider }}>
        {icon}
      </View>
      <View style={{ marginLeft: 14, flex: 1, minWidth: 0 }}>
        <Text style={{ color: colors.text.muted }} className="text-xs">{label}</Text>
        <View className="flex-row items-center mt-0.5" style={{ gap: 8 }}>
          <Text style={{ color: colors.text.primary }} className="text-sm font-semibold" numberOfLines={1}>{value}</Text>
          {extra}
        </View>
      </View>
    </View>
  );

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.screen }}>
      {/* Delete confirmation modal */}
      <Modal visible={showDeleteConfirm} transparent animationType="fade" onRequestClose={() => setShowDeleteConfirm(false)}>
        <Pressable className="flex-1 items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setShowDeleteConfirm(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ width: 300, borderRadius: 20, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.divider, padding: 24, alignItems: 'center' }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(239,68,68,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Trash2 size={22} color="#EF4444" strokeWidth={2} />
            </View>
            <Text style={{ color: colors.text.primary, fontSize: 17, fontWeight: '700', marginBottom: 6 }}>Delete Expense?</Text>
            <Text style={{ color: colors.text.muted, fontSize: 14, textAlign: 'center', marginBottom: 22 }}>This action cannot be undone.</Text>
            <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
              <Pressable onPress={() => setShowDeleteConfirm(false)} style={{ flex: 1, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.divider, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.text.secondary, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleDelete} style={{ flex: 1, height: 44, borderRadius: 22, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Delete</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <View
          className="flex-row items-center justify-between px-5"
          style={{
            paddingTop: isWebDesktop ? 14 : 24,
            paddingBottom: isWebDesktop ? 14 : 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.divider,
          }}
        >
          <Pressable onPress={() => router.back()} className="flex-row items-center" style={{ gap: 10 }}>
            <ArrowLeft size={22} color={colors.text.primary} strokeWidth={2} />
            <Text style={{ color: colors.text.primary }} className="text-lg font-bold">Expense Details</Text>
          </Pressable>
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <Pressable
              onPress={handleEdit}
              className="rounded-full flex-row items-center px-4"
              style={{ height: 38, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, gap: 6 }}
            >
              <Pencil size={14} color={colors.text.secondary} strokeWidth={2} />
              <Text style={{ color: colors.text.secondary }} className="font-semibold text-sm">Edit</Text>
            </Pressable>
            <Pressable
              onPress={() => setShowDeleteConfirm(true)}
              style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, alignItems: 'center', justifyContent: 'center' }}
            >
              <MoreVertical size={18} color={colors.text.secondary} strokeWidth={2} />
            </Pressable>
          </View>
        </View>

        {/* Content */}
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: isWebDesktop ? 20 : 16,
            paddingTop: isWebDesktop ? 20 : 16,
            paddingBottom: insets.bottom + 32,
          }}
        >
          {isWebDesktop ? (
            /* ── Desktop: Two-column layout ── */
            <View className="flex-row" style={{ gap: 16 }}>
              {/* Left Column (financials + evidence) */}
              <View style={{ flex: 2 }}>
                {/* Total + Breakdown Card */}
                <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, overflow: 'hidden' }}>
                  <View className="px-6 pt-6 pb-5" style={{ borderBottomWidth: 1, borderBottomColor: colors.divider }}>
                    <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase tracking-wider mb-1">{name}</Text>
                    <Text style={{ color: colors.text.primary, fontSize: 42, lineHeight: 48 }} className="font-medium">{formatCurrency(expense.amount)}</Text>
                    <Text style={{ color: colors.text.secondary, marginTop: 4 }} className="text-sm">Paid on {date}</Text>
                  </View>
                  <View className="px-6 py-4">
                    <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase tracking-wider mb-4">Payment Breakdown</Text>
                    {lineItems.map((line, i) => (
                      <View key={line.id} className="flex-row items-center justify-between" style={{ paddingVertical: 10, borderBottomWidth: i === lineItems.length - 1 ? 0 : 1, borderBottomColor: colors.divider }}>
                        <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                          <Text style={{ color: i === 0 ? colors.text.primary : colors.text.secondary }} className="text-sm font-medium">{line.label}</Text>
                          <Text style={{ color: colors.text.muted, fontSize: 12, marginTop: 2 }}>{line.category}</Text>
                        </View>
                        <Text style={{ color: colors.text.primary, fontSize: 15 }} className="font-semibold">{formatCurrency(line.amount)}</Text>
                      </View>
                    ))}
                    <View className="flex-row items-center justify-between mt-3 pt-3" style={{ borderTopWidth: 2, borderTopColor: colors.divider }}>
                      <Text style={{ color: colors.text.primary }} className="text-base font-bold">Total Logged</Text>
                      <Text style={{ color: colors.text.primary, fontSize: 18 }} className="font-medium">{formatCurrency(expense.amount)}</Text>
                    </View>
                  </View>
                </View>

                {/* Receipts */}
                {receipts.length > 0 ? (
                  <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, overflow: 'hidden', marginTop: 16 }}>
                    <View className="px-6 pt-4 pb-3">
                      <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase tracking-wider">Receipts & Evidence</Text>
                    </View>
                    {receipts.map((r) => (
                      <Pressable key={r.id} onPress={() => { void handleOpenReceipt(r.storagePath); }} className="flex-row items-center px-6 py-3" style={{ borderTopWidth: 1, borderTopColor: colors.divider }}>
                        <View className="rounded-xl items-center justify-center" style={{ width: 48, height: 48, backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.divider }}>
                          <FileText size={20} color={colors.text.tertiary} strokeWidth={2} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
                          <Text style={{ color: colors.text.primary }} className="text-sm font-semibold" numberOfLines={1}>{r.fileName}</Text>
                          <Text style={{ color: colors.text.muted }} className="text-xs mt-0.5">Click to view receipt</Text>
                        </View>
                        <Download size={18} color={colors.text.tertiary} strokeWidth={2} />
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>

              {/* Right Column (metadata) */}
              <View style={{ flex: 1 }}>
                <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, overflow: 'hidden' }}>
                  <View className="px-5 pt-4 pb-3">
                    <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase tracking-wider">Details</Text>
                  </View>
                  <MetaRow icon={<User size={18} color={colors.text.tertiary} strokeWidth={2} />} label="Supplier / Merchant" value={merchant || '-'} />
                  <MetaRow icon={<Tag size={18} color={colors.text.tertiary} strokeWidth={2} />} label="Category" value={expense.category || 'General'} extra={<TypeBadge />} />
                  <MetaRow icon={<Calendar size={18} color={colors.text.tertiary} strokeWidth={2} />} label="Date" value={date} />
                  <MetaRow
                    icon={<Clock size={18} color={colors.text.tertiary} strokeWidth={2} />}
                    label="Created"
                    value={expense.createdAt ? new Date(expense.createdAt).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                  />
                </View>

                {/* Notes */}
                <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, overflow: 'hidden', marginTop: 16 }}>
                  <View className="px-5 pt-4 pb-3">
                    <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase tracking-wider">Notes</Text>
                  </View>
                  <View className="px-5 pb-4">
                    <Text style={{ color: colors.text.primary, lineHeight: 22 }} className="text-sm">{note || 'No notes added.'}</Text>
                  </View>
                </View>
              </View>
            </View>
          ) : (
            /* ── Mobile: Single-column layout ── */
            <View style={{ gap: 12 }}>
              {/* Hero card */}
              <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, padding: 20 }}>
                <View className="items-center">
                  <View className="rounded-2xl items-center justify-center mb-3" style={{ width: 54, height: 54, backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.divider }}>
                    <Receipt size={22} color={colors.text.tertiary} strokeWidth={2.2} />
                  </View>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase tracking-wider mb-1">{name}</Text>
                  <Text style={{ color: colors.text.primary, fontSize: 44, lineHeight: 48 }} className="font-medium">{formatCurrency(expense.amount)}</Text>
                  <Text style={{ color: colors.text.secondary }} className="text-sm mt-1">Paid on {date}</Text>
                </View>
              </View>

              {/* Payment Breakdown */}
              <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, padding: 16 }}>
                <Text style={{ color: colors.text.tertiary }} className="text-xs uppercase font-semibold mb-3">Payment Breakdown</Text>
                {lineItems.map((line, i) => (
                  <View key={line.id} className="flex-row items-center justify-between" style={{ marginBottom: i === lineItems.length - 1 ? 0 : 10 }}>
                    <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                      <Text numberOfLines={1} style={{ color: i === 0 ? colors.text.primary : colors.text.secondary }} className="text-sm font-medium">{line.label}</Text>
                      <Text numberOfLines={1} style={{ color: colors.text.muted, fontSize: 12 }} className="mt-0.5">{line.category}</Text>
                    </View>
                    <Text style={{ color: colors.text.primary }} className="text-sm font-semibold">{formatCurrency(line.amount)}</Text>
                  </View>
                ))}
                <View className="flex-row items-center justify-between mt-3 pt-3" style={{ borderTopWidth: 1, borderTopColor: colors.divider }}>
                  <Text style={{ color: colors.text.secondary }} className="text-base font-semibold">Total Logged</Text>
                  <Text style={{ color: colors.text.primary }} className="text-base font-medium">{formatCurrency(expense.amount)}</Text>
                </View>
              </View>

              {/* Metadata */}
              <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, padding: 16 }}>
                <View className="flex-row items-center justify-between">
                  <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                    <Text style={{ color: colors.text.tertiary }} className="text-xs uppercase font-semibold mb-1">Supplier / Merchant</Text>
                    <Text style={{ color: colors.text.primary }} className="text-lg font-semibold">{merchant || '-'}</Text>
                  </View>
                  <TypeBadge />
                </View>
                <View className="mt-3 pt-3" style={{ borderTopWidth: 1, borderTopColor: colors.divider }}>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs uppercase font-semibold mb-1">Primary Category</Text>
                  <Text style={{ color: colors.text.primary }} className="text-lg font-semibold">{expense.category || 'General'}</Text>
                </View>
              </View>

              {/* Notes */}
              {note ? (
                <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, padding: 16 }}>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs uppercase font-semibold mb-1">Notes</Text>
                  <Text style={{ color: colors.text.primary }} className="text-sm">{note}</Text>
                </View>
              ) : null}

              {/* Receipts */}
              {receipts.length > 0 ? (
                <View style={{ gap: 10 }}>
                  {receipts.map((r) => (
                    <Pressable key={r.id} onPress={() => { void handleOpenReceipt(r.storagePath); }} style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' }}>
                      <View className="rounded-xl items-center justify-center" style={{ width: 42, height: 42, backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.divider }}>
                        <Receipt size={18} color={colors.text.tertiary} strokeWidth={2} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
                        <Text style={{ color: colors.text.primary }} className="text-base font-semibold" numberOfLines={1}>{r.fileName}</Text>
                        <Text style={{ color: colors.text.secondary }} className="text-sm" numberOfLines={1}>Tap to view receipt</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
