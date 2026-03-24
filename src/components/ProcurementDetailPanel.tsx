import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { X, MoreVertical, Truck, Package, User, Calendar, Clock, Paperclip, FileText, Image as ImageIcon, CheckCircle, XCircle, Send, PlusCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import useFyllStore, { type Procurement, formatCurrency } from '@/lib/state/fyll-store';
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

const resolvePONumber = (procurement: Procurement): string => {
  const meta = extractMetadataValue(procurement.notes, 'po');
  if (meta) return meta.toUpperCase();
  return `PO-${procurement.id.slice(-4).toUpperCase().padStart(4, '0')}`;
};

const resolveStatus = (procurement: Procurement): string => {
  const meta = extractMetadataValue(procurement.notes, 'status');
  if (meta) return meta;
  const src = (procurement.notes ?? '').toLowerCase();
  if (src.includes('cancelled') || src.includes('canceled')) return 'Cancelled';
  if (src.includes('draft')) return 'Draft';
  if (src.includes('sent')) return 'Sent';
  if (src.includes('confirm')) return 'Confirmed';
  return 'Received';
};

const resolvePaidDate = (procurement: Procurement): string => {
  const paidDate = extractMetadataValue(procurement.notes, 'paid_date');
  if (paidDate) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) {
      const [year, month, day] = paidDate.split('-').map(Number);
      return new Date(year, (month ?? 1) - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    const parsed = new Date(paidDate).getTime();
    if (!isNaN(parsed)) return new Date(parsed).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const legacyExpected = extractMetadataValue(procurement.notes, 'expected');
  if (legacyExpected) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(legacyExpected)) {
      const [year, month, day] = legacyExpected.split('-').map(Number);
      return new Date(year, (month ?? 1) - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    const parsed = new Date(legacyExpected).getTime();
    if (!isNaN(parsed)) return new Date(parsed).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const created = new Date(procurement.createdAt).getTime();
  const fallback = isNaN(created) ? Date.now() : created;
  return new Date(fallback).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const resolveReceivedDate = (procurement: Procurement): string => {
  const receivedDate = extractMetadataValue(procurement.notes, 'received_date');
  if (receivedDate) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(receivedDate)) {
      const [year, month, day] = receivedDate.split('-').map(Number);
      return new Date(year, (month ?? 1) - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    const parsed = new Date(receivedDate).getTime();
    if (!isNaN(parsed)) return new Date(parsed).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const legacyExpected = extractMetadataValue(procurement.notes, 'expected');
  if (legacyExpected) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(legacyExpected)) {
      const [year, month, day] = legacyExpected.split('-').map(Number);
      return new Date(year, (month ?? 1) - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    const parsed = new Date(legacyExpected).getTime();
    if (!isNaN(parsed)) return new Date(parsed).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return resolvePaidDate(procurement);
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft:     { bg: 'rgba(0,0,0,0.07)',          text: '#555555' },
  sent:      { bg: 'rgba(59, 130, 246, 0.16)',  text: '#3B82F6' },
  confirmed: { bg: 'rgba(139, 92, 246, 0.16)', text: '#8B5CF6' },
  received:  { bg: 'rgba(16, 185, 129, 0.16)', text: '#10B981' },
  cancelled: { bg: 'rgba(239, 68, 68, 0.16)',  text: '#EF4444' },
};

// ── props ──

interface ProcurementDetailPanelProps {
  procurementId: string;
  compact?: boolean;
  onClose: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ProcurementDetailPanel({ procurementId, compact = false, onClose, onEdit, onDelete }: ProcurementDetailPanelProps) {
  const colors = useStatsColors();
  const procurements = useFyllStore((s) => s.procurements);
  const products = useFyllStore((s) => s.products);
  const [showActionMenu, setShowActionMenu] = useState<boolean>(false);

  const procurement = useMemo(() => procurements.find((p) => p.id === procurementId) ?? null, [procurements, procurementId]);
  const poNumber = useMemo(() => procurement ? resolvePONumber(procurement) : '', [procurement]);
  const poName = useMemo(() => {
    const explicitTitle = procurement?.title?.trim();
    if (explicitTitle) return explicitTitle;
    const supplierName = procurement?.supplierName?.trim();
    if (supplierName) return supplierName;
    return 'Purchase Order';
  }, [procurement]);
  const status = useMemo(() => procurement ? resolveStatus(procurement) : '', [procurement]);
  const paidDate = useMemo(() => procurement ? resolvePaidDate(procurement) : '', [procurement]);
  const receivedDate = useMemo(() => procurement ? resolveReceivedDate(procurement) : '', [procurement]);
  const createdAt = useMemo(() => {
    if (!procurement) return '';
    const ts = new Date(procurement.createdAt).getTime();
    return isNaN(ts) ? '' : new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, [procurement]);

  const statusColors = STATUS_COLORS[status.toLowerCase()] ?? { bg: 'rgba(0,0,0,0.07)', text: '#555555' };
  const heroPadding = compact ? 16 : 20;
  const heroAmountFontSize = compact ? 30 : 36;
  const heroAmountLineHeight = compact ? 36 : 42;
  const detailValueFontSize = compact ? 12 : 13;

  useEffect(() => {
    setShowActionMenu(false);
  }, [procurementId]);

  const itemRows = useMemo(() => {
    if (!procurement) return [];
    return procurement.items.map((item) => {
      // Prefer stored names (set at creation time) over live lookup
      const storedName = item.productName;
      const storedVariant = item.variantName ?? '';

      const product = products.find((p) => p.id === item.productId);
      const variant = product?.variants.find((v) => v.id === item.variantId);
      const resolvedName = product?.name;
      const resolvedVariant = variant ? Object.values(variant.variableValues ?? {}).join(', ') : '';

      const name = storedName ?? resolvedName ?? null;
      const variantLabel = storedVariant || resolvedVariant;

      return {
        id: `${item.productId}-${item.variantId}`,
        name: name ? (variantLabel ? `${name} — ${variantLabel}` : name) : null,
        costAtPurchase: item.costAtPurchase,
        total: item.costAtPurchase,
      };
    // Only show rows where we have a valid name
    }).filter((row) => row.name !== null) as { id: string; name: string; costAtPurchase: number; total: number }[];
  }, [procurement, products]);

  const cleanNotes = useMemo(
    () => (procurement?.notes ?? '').replace(/\[([a-z_]+):([^\]]+)\]/gi, '').trim(),
    [procurement]
  );

  type ProcActivityEventType = 'create' | 'submit' | 'approve' | 'reject';
  const activityEvents = useMemo<{ label: string; actor: string; ts: string; type: ProcActivityEventType }[]>(() => {
    if (!procurement) return [];
    const events: { label: string; actor: string; ts: string; type: ProcActivityEventType }[] = [];
    events.push({
      label: 'PO created',
      actor: extractMetadataValue(procurement.notes, 'submitted_by_name') || procurement.createdBy || 'Admin',
      ts: procurement.createdAt,
      type: 'create',
    });
    const approvalStatus = extractMetadataValue(procurement.notes, 'approval_status');
    const submittedByName = extractMetadataValue(procurement.notes, 'submitted_by_name');
    const submittedAt = extractMetadataValue(procurement.notes, 'submitted_at');
    const reviewedByName = extractMetadataValue(procurement.notes, 'reviewed_by_name');
    const reviewedAt = extractMetadataValue(procurement.notes, 'reviewed_at');
    if (approvalStatus === 'submitted' || approvalStatus === 'approved' || approvalStatus === 'rejected') {
      events.push({ label: 'Submitted for approval', actor: submittedByName || 'Team member', ts: submittedAt || procurement.createdAt, type: 'submit' });
    }
    if (approvalStatus === 'approved') {
      events.push({ label: 'PO approved', actor: reviewedByName || 'Admin', ts: reviewedAt || '', type: 'approve' });
    } else if (approvalStatus === 'rejected') {
      events.push({ label: 'PO declined', actor: reviewedByName || 'Admin', ts: reviewedAt || '', type: 'reject' });
    }
    return events;
  }, [procurement]);

  if (!procurement) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: colors.text.muted, fontSize: 15 }}>Purchase order not found</Text>
      </View>
    );
  }

  const getFileIcon = (mimeType?: string) => {
    if (!mimeType) return <FileText size={15} color={colors.text.tertiary} strokeWidth={1.5} />;
    if (mimeType.startsWith('image/')) return <ImageIcon size={15} color={colors.text.tertiary} strokeWidth={1.5} />;
    return <FileText size={15} color={colors.text.tertiary} strokeWidth={1.5} />;
  };

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
            <Truck size={15} color={colors.text.tertiary} strokeWidth={2} />
          </View>
          <Text style={{ color: colors.text.primary, fontSize: compact ? 15 : 16, fontWeight: '700' }}>PO Details</Text>
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
                    onEdit(procurementId);
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
                    onDelete(procurementId);
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

        {/* Hero card */}
        <View style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.divider }}>
          <View style={{ padding: heroPadding, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
            <Text style={{ color: colors.text.muted, fontSize: 11, fontWeight: '400', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
              {poName}
            </Text>
            <Text style={{ color: colors.text.primary, fontSize: heroAmountFontSize, fontWeight: '500', lineHeight: heroAmountLineHeight }}>
              {formatCurrency(procurement.totalCost)}
            </Text>
            <Text style={{ color: colors.text.muted, fontSize: compact ? 12 : 13, fontWeight: '500', marginTop: 4 }}>
              {poNumber}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 }}>
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, backgroundColor: statusColors.bg }}>
                <Text style={{ color: statusColors.text, fontSize: 11, fontWeight: '600' }}>{status}</Text>
              </View>
              <Text style={{ color: colors.text.secondary, fontSize: compact ? 12 : 13 }}>{paidDate}</Text>
            </View>
          </View>

          {/* Cost / qty summary */}
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1, paddingHorizontal: 20, paddingVertical: 14 }}>
              <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>PO Number</Text>
              <Text style={{ color: colors.text.primary, fontSize: compact ? 14 : 16, fontWeight: '700', marginTop: 3 }}>{poNumber}</Text>
            </View>
            <View style={{ width: 1, backgroundColor: colors.divider }} />
            <View style={{ flex: 1, paddingHorizontal: 20, paddingVertical: 14 }}>
              <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>Line Items</Text>
              <Text style={{ color: colors.text.primary, fontSize: compact ? 14 : 16, fontWeight: '700', marginTop: 3 }}>
                {procurement.items.length}
              </Text>
            </View>
          </View>
        </View>

        {/* Details */}
        <View style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.divider }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
            <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>Details</Text>
          </View>
          {([
            { icon: <FileText size={15} color={colors.text.tertiary} strokeWidth={2} />, label: 'PO Name', value: poName },
            { icon: <User size={15} color={colors.text.tertiary} strokeWidth={2} />, label: 'Supplier', value: procurement.supplierName || '—' },
            { icon: <Calendar size={15} color={colors.text.tertiary} strokeWidth={2} />, label: 'Date Paid', value: paidDate },
            { icon: <Calendar size={15} color={colors.text.tertiary} strokeWidth={2} />, label: 'Date Received', value: receivedDate },
            { icon: <Clock size={15} color={colors.text.tertiary} strokeWidth={2} />, label: 'Created', value: createdAt || '—' },
          ] as const).map((row, index) => (
            <View
              key={row.label}
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: index === 0 ? 1 : 0, borderTopColor: colors.divider, gap: 12 }}
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

        {/* Items */}
        {itemRows.length > 0 ? (
          <View style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.divider }}>
            <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
              <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>Items</Text>
            </View>
            {itemRows.map((item) => (
              <View
                key={item.id}
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.divider, gap: 12 }}
              >
                <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.divider }}>
                  <Package size={15} color={colors.text.tertiary} strokeWidth={2} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: colors.text.primary, fontSize: detailValueFontSize, fontWeight: '600' }} numberOfLines={1}>{item.name}</Text>
                  <Text style={{ color: colors.text.muted, fontSize: 11, marginTop: 1 }}>Line amount</Text>
                </View>
                <Text style={{ color: colors.text.primary, fontSize: compact ? 13 : 14, fontWeight: '600' }}>{formatCurrency(item.total)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Attachments */}
        {(procurement.attachments?.length ?? 0) > 0 ? (
          <View style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.divider }}>
            <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
              <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>Attachments</Text>
            </View>
            {procurement.attachments!.map((attachment, index) => (
              <Pressable
                key={`${attachment.storagePath ?? attachment.uri}-${index}`}
                onPress={() => {
                  void openAttachmentPath(attachment.storagePath ?? attachment.uri).catch(() => null);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: index === 0 ? 1 : 0, borderTopColor: colors.divider, gap: 12 }}
              >
                <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.divider }}>
                  {getFileIcon(attachment.mimeType)}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: colors.text.primary, fontSize: detailValueFontSize, fontWeight: '600' }} numberOfLines={1}>{attachment.name}</Text>
                  {attachment.mimeType ? (
                    <Text style={{ color: colors.text.muted, fontSize: 11, marginTop: 1 }}>{attachment.mimeType}</Text>
                  ) : null}
                </View>
                <Paperclip size={14} color={colors.text.muted} strokeWidth={1.5} />
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* Notes */}
        {cleanNotes ? (
          <View style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.divider, padding: 16 }}>
            <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Notes</Text>
            <Text style={{ color: colors.text.primary, fontSize: detailValueFontSize, lineHeight: compact ? 18 : 20 }}>{cleanNotes}</Text>
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
