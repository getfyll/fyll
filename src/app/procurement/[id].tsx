import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Platform, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Truck, Pencil, Trash2, FileText, User, Calendar, Clock, Package, Paperclip, Image as ImageIcon, MoreVertical } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import useFyllStore, { type Procurement, formatCurrency } from '@/lib/state/fyll-store';
import useAuthStore from '@/lib/state/auth-store';
import { useStatsColors } from '@/lib/theme';
import { useBreakpoint } from '@/lib/useBreakpoint';
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

const resolvePONumber = (procurement: Procurement): string => {
  const meta = extractMetadataValue(procurement.notes, 'po');
  if (meta) return meta.toUpperCase();
  return `PO-${procurement.id.slice(-4).toUpperCase().padStart(4, '0')}`;
};

const resolveStatus = (procurement: Procurement): string => {
  const meta = extractMetadataValue(procurement.notes, 'status');
  if (meta) return meta.charAt(0).toUpperCase() + meta.slice(1);
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

export default function ProcurementDetailScreen() {
  const router = useRouter();
  const colors = useStatsColors();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useBreakpoint();
  const isWebDesktop = Platform.OS === 'web' && isDesktop;
  const { id } = useLocalSearchParams<{ id: string }>();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const procurements = useFyllStore((s) => s.procurements);
  const products = useFyllStore((s) => s.products);
  const deleteProcurement = useFyllStore((s) => s.deleteProcurement);
  const businessId = useAuthStore((s) => s.businessId ?? s.currentUser?.businessId ?? null);

  const procurement = useMemo(() => procurements.find((p) => p.id === id) ?? null, [procurements, id]);
  const poNumber = useMemo(() => procurement ? resolvePONumber(procurement) : '', [procurement]);
  const status = useMemo(() => procurement ? resolveStatus(procurement) : '', [procurement]);
  const paidDate = useMemo(() => procurement ? resolvePaidDate(procurement) : '', [procurement]);
  const receivedDate = useMemo(() => procurement ? resolveReceivedDate(procurement) : '', [procurement]);
  const createdAt = useMemo(() => {
    if (!procurement) return '';
    const ts = new Date(procurement.createdAt).getTime();
    return isNaN(ts) ? '' : new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, [procurement]);

  const statusColors = STATUS_COLORS[status.toLowerCase()] ?? { bg: 'rgba(0,0,0,0.07)', text: '#555555' };
  const cleanNotes = useMemo(() => stripMetadata(procurement?.notes), [procurement]);

  const itemRows = useMemo(() => {
    if (!procurement) return [];
    return procurement.items.map((item) => {
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
    }).filter((r) => r.name !== null) as { id: string; name: string; costAtPurchase: number; total: number }[];
  }, [procurement, products]);

  const handleDelete = () => {
    if (!procurement) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    deleteProcurement(procurement.id, businessId);
    router.back();
  };

  const handleEdit = () => {
    if (!procurement) return;
    router.replace(`/(tabs)/finance?section=procurement&editProcurementId=${encodeURIComponent(procurement.id)}` as any);
  };

  if (!procurement) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.bg.screen }}>
        <Text style={{ color: colors.text.muted }} className="text-base">Purchase order not found</Text>
        <Pressable onPress={() => router.back()} className="mt-4 rounded-xl px-6 py-3" style={{ backgroundColor: colors.bg.input }}>
          <Text style={{ color: colors.text.primary }} className="font-semibold">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const StatusBadge = () => (
    <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: statusColors.bg }}>
      <Text className="text-xs font-semibold" style={{ color: statusColors.text }}>{status}</Text>
    </View>
  );

  const MetaRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
    <View className="flex-row items-center py-4" style={{ borderTopWidth: 1, borderTopColor: colors.divider, paddingHorizontal: 16 }}>
      <View className="rounded-xl items-center justify-center" style={{ width: 42, height: 42, backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.divider }}>
        {icon}
      </View>
      <View style={{ marginLeft: 14, flex: 1, minWidth: 0 }}>
        <Text style={{ color: colors.text.muted }} className="text-xs">{label}</Text>
        <Text style={{ color: colors.text.primary }} className="text-sm font-semibold mt-0.5" numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );

  const cardStyle = { borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.bg.card };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.screen }}>
      {/* Delete confirmation modal */}
      <Modal visible={showDeleteConfirm} transparent animationType="fade" onRequestClose={() => setShowDeleteConfirm(false)}>
        <Pressable className="flex-1 items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setShowDeleteConfirm(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ width: 300, borderRadius: 20, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.divider, padding: 24, alignItems: 'center' }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(239,68,68,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Trash2 size={22} color="#EF4444" strokeWidth={2} />
            </View>
            <Text style={{ color: colors.text.primary, fontSize: 17, fontWeight: '700', marginBottom: 6 }}>Delete Purchase Order?</Text>
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
            <Text style={{ color: colors.text.primary }} className="text-lg font-bold">PO Details</Text>
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

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: insets.bottom + 32,
            gap: 12,
          }}
        >
          {/* Hero card */}
          <View style={cardStyle}>
            <View style={{ padding: 20, alignItems: 'center' }}>
              <View className="rounded-2xl items-center justify-center mb-3" style={{ width: 54, height: 54, backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.divider }}>
                <Truck size={22} color={colors.text.tertiary} strokeWidth={2.2} />
              </View>
              {procurement.title ? (
                <>
                  <Text style={{ color: colors.text.primary, fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 2 }}>
                    {procurement.title}
                  </Text>
                  {!isWebDesktop ? (
                    <Text style={{ color: colors.text.secondary, fontSize: 15, fontWeight: '600', marginBottom: 3 }}>
                      {procurement.supplierName || '—'}
                    </Text>
                  ) : null}
                  <Text style={{ color: colors.text.muted, fontSize: 13, marginBottom: 6 }}>{poNumber}</Text>
                </>
              ) : (
                <>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase tracking-wider mb-1">
                  {poNumber}
                </Text>
                  {!isWebDesktop ? (
                    <Text style={{ color: colors.text.secondary, fontSize: 15, fontWeight: '600', marginBottom: 4 }}>
                      {procurement.supplierName || '—'}
                    </Text>
                  ) : null}
                </>
              )}
              <Text style={{ color: colors.text.primary, fontSize: 44, lineHeight: 48, textAlign: 'center' }} className="font-bold">
                {formatCurrency(procurement.totalCost)}
              </Text>
              {isWebDesktop ? (
                <>
                  <Text style={{ color: colors.text.secondary }} className="text-sm mt-1">
                    Paid on {paidDate}
                  </Text>
                  <View style={{ marginTop: 8 }}>
                    <StatusBadge />
                  </View>
                </>
              ) : null}
            </View>
          </View>

          {/* Summary grid */}
          <View style={{ ...cardStyle, padding: 16 }}>
            {isWebDesktop ? (
              <View className="flex-row items-center justify-between">
                <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs uppercase font-semibold mb-1">Supplier</Text>
                  <Text style={{ color: colors.text.primary }} className="text-lg font-semibold" numberOfLines={1}>
                    {procurement.supplierName || '—'}
                  </Text>
                </View>
                <StatusBadge />
              </View>
            ) : null}
            <View className={`${isWebDesktop ? 'mt-3 pt-3' : ''} flex-row items-center justify-between`} style={{ borderTopWidth: isWebDesktop ? 1 : 0, borderTopColor: colors.divider }}>
              <View>
                <Text style={{ color: colors.text.tertiary }} className="text-xs uppercase font-semibold mb-1">Total Cost</Text>
                <Text style={{ color: colors.text.primary }} className="text-base font-semibold">{formatCurrency(procurement.totalCost)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: colors.text.tertiary }} className="text-xs uppercase font-semibold mb-1">Line Items</Text>
                <Text style={{ color: colors.text.primary }} className="text-base font-semibold">{procurement.items.length}</Text>
              </View>
            </View>
          </View>

          {isWebDesktop ? (
            <>
              {/* Details */}
              <View style={cardStyle}>
                <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
                  <Text style={{ color: colors.text.muted }} className="text-xs font-semibold uppercase tracking-wider">Details</Text>
                </View>
                <MetaRow icon={<User size={18} color={colors.text.tertiary} strokeWidth={2} />} label="Supplier" value={procurement.supplierName || '—'} />
                <MetaRow icon={<Calendar size={18} color={colors.text.tertiary} strokeWidth={2} />} label="Date Paid" value={paidDate} />
                <MetaRow icon={<Calendar size={18} color={colors.text.tertiary} strokeWidth={2} />} label="Date Received" value={receivedDate} />
                <MetaRow icon={<Clock size={18} color={colors.text.tertiary} strokeWidth={2} />} label="Created" value={createdAt || '—'} />
              </View>

              {/* Items */}
              {itemRows.length > 0 ? (
                <View style={cardStyle}>
                  <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
                    <Text style={{ color: colors.text.muted }} className="text-xs font-semibold uppercase tracking-wider">Items</Text>
                  </View>
                  {itemRows.map((item, index) => (
                    <View
                      key={item.id}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: index === 0 ? 1 : 0, borderTopColor: colors.divider, gap: 12 }}
                    >
                      <View style={{ width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.divider }}>
                        <Package size={16} color={colors.text.tertiary} strokeWidth={2} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{item.name}</Text>
                        <Text style={{ color: colors.text.muted, fontSize: 11, marginTop: 1 }}>Line amount</Text>
                      </View>
                      <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '600' }}>{formatCurrency(item.total)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <>
              {/* Items */}
              {itemRows.length > 0 ? (
                <View style={cardStyle}>
                  <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
                    <Text style={{ color: colors.text.muted }} className="text-xs font-semibold uppercase tracking-wider">Items</Text>
                  </View>
                  {itemRows.map((item, index) => (
                    <View
                      key={item.id}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: index === 0 ? 1 : 0, borderTopColor: colors.divider, gap: 12 }}
                    >
                      <View style={{ width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.divider }}>
                        <Package size={16} color={colors.text.tertiary} strokeWidth={2} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{item.name}</Text>
                        <Text style={{ color: colors.text.muted, fontSize: 11, marginTop: 1 }}>Line amount</Text>
                      </View>
                      <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '600' }}>{formatCurrency(item.total)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Status & Timeline */}
              <View style={cardStyle}>
                <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
                  <Text style={{ color: colors.text.muted }} className="text-xs font-semibold uppercase tracking-wider">Status & Timeline</Text>
                </View>
                <View className="flex-row items-center py-4" style={{ borderTopWidth: 1, borderTopColor: colors.divider, paddingHorizontal: 16 }}>
                  <View className="rounded-xl items-center justify-center" style={{ width: 42, height: 42, backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.divider }}>
                    <Truck size={18} color={colors.text.tertiary} strokeWidth={2} />
                  </View>
                  <View style={{ marginLeft: 14, flex: 1, minWidth: 0 }}>
                    <Text style={{ color: colors.text.muted }} className="text-xs">Status</Text>
                    <View style={{ marginTop: 5, alignSelf: 'flex-start' }}>
                      <StatusBadge />
                    </View>
                  </View>
                </View>
                <MetaRow icon={<Calendar size={18} color={colors.text.tertiary} strokeWidth={2} />} label="Date Paid" value={paidDate} />
                <MetaRow icon={<Calendar size={18} color={colors.text.tertiary} strokeWidth={2} />} label="Date Received" value={receivedDate} />
                <MetaRow icon={<Clock size={18} color={colors.text.tertiary} strokeWidth={2} />} label="Created" value={createdAt || '—'} />
              </View>
            </>
          )}

          {/* Notes */}
          {cleanNotes ? (
            <View style={{ ...cardStyle, padding: 16 }}>
              <Text style={{ color: colors.text.tertiary }} className="text-xs uppercase font-semibold mb-2">Notes</Text>
              <Text style={{ color: colors.text.primary, lineHeight: 22 }} className="text-sm">{cleanNotes}</Text>
            </View>
          ) : null}

          {/* Attachments */}
          {(procurement.attachments?.length ?? 0) > 0 ? (
            <View style={cardStyle}>
              <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
                <Text style={{ color: colors.text.muted }} className="text-xs font-semibold uppercase tracking-wider">Attachments</Text>
              </View>
              {procurement.attachments!.map((attachment, index) => (
                <Pressable
                  key={`${attachment.storagePath ?? attachment.uri}-${index}`}
                  onPress={() => {
                    void openAttachmentPath(attachment.storagePath ?? attachment.uri).catch(() => null);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: index === 0 ? 1 : 0, borderTopColor: colors.divider, gap: 12 }}
                >
                  <View style={{ width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.divider }}>
                    {attachment.mimeType?.startsWith('image/') ? (
                      <ImageIcon size={16} color={colors.text.tertiary} strokeWidth={1.5} />
                    ) : (
                      <FileText size={16} color={colors.text.tertiary} strokeWidth={1.5} />
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{attachment.name}</Text>
                    {attachment.mimeType ? <Text style={{ color: colors.text.muted, fontSize: 11, marginTop: 1 }}>{attachment.mimeType}</Text> : null}
                  </View>
                  <Paperclip size={14} color={colors.text.muted} strokeWidth={1.5} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
