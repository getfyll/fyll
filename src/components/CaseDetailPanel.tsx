import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, Image, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import {
  FileText,
  Calendar,
  User as UserIcon,
  Package,
  Tag,
  MessageSquare,
  Check,
  DollarSign,
  ChevronLeft,
  Edit2,
  Trash2,
  X,
  ExternalLink,
  Clock,
  Flag,
  RefreshCcw,
  Undo2,
  Zap,
  ShieldCheck,
  HelpCircle,
  Mail,
  Phone,
  Globe,
  Store,
  Plus,
  History,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeInLeft } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '@/lib/theme';
import useFyllStore, {
  Case,
  CaseType,
  CaseSource,
  CaseTimelineEntry,
  CASE_STATUS_COLORS,
  CASE_PRIORITY_COLORS,
  formatCurrency,
} from '@/lib/state/fyll-store';
import useAuthStore from '@/lib/state/auth-store';
import { CaseForm } from './CaseForm';

// Get icon for case type
const getCaseTypeIcon = (type: CaseType, color: string, size: number = 20) => {
  const props = { size, color, strokeWidth: 1.5 };
  switch (type) {
    case 'Repair': return <RefreshCcw {...props} />;
    case 'Replacement': return <Undo2 {...props} />;
    case 'Refund': return <DollarSign {...props} />;
    case 'Partial Refund': return <Zap {...props} />;
    case 'Goodwill': return <ShieldCheck {...props} />;
    default: return <HelpCircle {...props} />;
  }
};

// Get icon for case source
const getCaseSourceIcon = (source: CaseSource | undefined, color: string, size: number = 16) => {
  const props = { size, color, strokeWidth: 1.5 };
  switch (source) {
    case 'Email': return <Mail {...props} />;
    case 'Phone': return <Phone {...props} />;
    case 'Chat': return <MessageSquare {...props} />;
    case 'Web': return <Globe {...props} />;
    case 'In-Store': return <Store {...props} />;
    default: return <HelpCircle {...props} />;
  }
};

interface CaseDetailPanelProps {
  caseId: string;
  onClose?: () => void;
  onNavigateToOrder?: (orderId: string) => void;
  showBackButton?: boolean;
}

export function CaseDetailPanel({
  caseId,
  onClose,
  onNavigateToOrder,
  showBackButton = false,
}: CaseDetailPanelProps) {
  const colors = useThemeColors();
  const router = useRouter();
  const businessId = useAuthStore((s) => s.businessId);
  const currentUser = useAuthStore((s) => s.currentUser);
  const userName = currentUser?.name || 'Unknown';

  const cases = useFyllStore((s) => s.cases);
  const updateCase = useFyllStore((s) => s.updateCase);
  const deleteCase = useFyllStore((s) => s.deleteCase);
  const caseStatuses = useFyllStore((s) => s.caseStatuses);
  const statusColorMap = caseStatuses.reduce<Record<string, string>>((map, option) => {
    map[option.name] = option.color;
    return map;
  }, {});
  Object.entries(CASE_STATUS_COLORS).forEach(([name, color]) => {
    if (!statusColorMap[name]) {
      statusColorMap[name] = color;
    }
  });
  const sortedCaseStatuses = caseStatuses
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));

  const caseItem = useMemo(
    () => cases.find((c) => c.id === caseId),
    [cases, caseId]
  );

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState('');

  if (!caseItem) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.bg.primary }}>
        <FileText size={48} color={colors.text.muted} strokeWidth={1} />
        <Text style={{ color: colors.text.muted }} className="mt-4 text-lg">
          Case not found
        </Text>
      </View>
    );
  }

  const statusColor = statusColorMap[caseItem.status] ?? colors.text.muted;
  const selectedStatusOption = caseStatuses.find((option) => option.name === caseItem.status);

  const formattedCreatedDate = new Date(caseItem.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const formattedResolvedDate = caseItem.resolution?.resolvedAt
    ? new Date(caseItem.resolution.resolvedAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  const handleStatusChange = async (newStatus: typeof caseItem.status) => {
    Haptics.selectionAsync();
    const now = new Date().toISOString();
    const newTimelineEntry: CaseTimelineEntry = {
      id: Math.random().toString(36).slice(2),
      date: now,
      action: `Status changed to ${newStatus}`,
      user: userName || 'System',
    };
    const updatedTimeline = [newTimelineEntry, ...(caseItem.timeline || [])];
    await updateCase(
      caseItem.id,
      { status: newStatus, updatedBy: userName || undefined, timeline: updatedTimeline },
      businessId
    );
    setShowStatusModal(false);
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const now = new Date().toISOString();
    const newTimelineEntry: CaseTimelineEntry = {
      id: Math.random().toString(36).slice(2),
      date: now,
      action: `Note added: ${noteText.trim()}`,
      user: userName || 'System',
    };
    const updatedTimeline = [newTimelineEntry, ...(caseItem.timeline || [])];
    await updateCase(
      caseItem.id,
      { updatedBy: userName || undefined, timeline: updatedTimeline },
      businessId
    );
    setNoteText('');
    setShowNoteModal(false);
  };

  const handleDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    deleteCase(caseItem.id, businessId);
    setShowDeleteModal(false);
    if (onClose) {
      onClose();
    } else {
      router.back();
    }
  };

  const handleSaveEdit = async (updatedCase: Case) => {
    await updateCase(caseItem.id, updatedCase, businessId);
    setShowEditForm(false);
  };

  const handleViewOrder = () => {
    Haptics.selectionAsync();
    if (onNavigateToOrder) {
      onNavigateToOrder(caseItem.orderId);
    } else {
      router.push(`/order/${caseItem.orderId}`);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
      {/* Header */}
      {showBackButton && (
        <View
          className="flex-row items-center px-5 py-4"
          style={{ borderBottomWidth: 1, borderBottomColor: colors.border.light }}
        >
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              onClose ? onClose() : router.back();
            }}
            className="p-2 -ml-2 active:opacity-70"
          >
            <ChevronLeft size={24} color={colors.text.primary} strokeWidth={1.5} />
          </Pressable>
          <Text style={{ color: colors.text.primary }} className="text-xl font-bold ml-2">
            Case Details
          </Text>
        </View>
      )}

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.springify()} className="px-5 py-4">
          {/* Case Header Card */}
          <View
            className="p-6 rounded-[28px] mb-4"
            style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}
          >
            <View className="flex-row justify-between items-start mb-4">
              <View className="flex-1">
                <Text style={{ color: colors.text.primary }} className="text-2xl font-bold tracking-tight">
                  {caseItem.customerName}
                </Text>
                <View className="flex-row items-center gap-2 mt-2 flex-wrap">
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setShowStatusModal(true);
                    }}
                    className="px-3 py-1.5 rounded-lg active:opacity-70"
                    style={{ backgroundColor: statusColor + '20', borderWidth: 1, borderColor: statusColor + '30' }}
                  >
                    <Text style={{ color: statusColor }} className="text-[10px] font-bold uppercase tracking-wider">
                      {caseItem.status}
                    </Text>
                  </Pressable>
                  <Text style={{ color: colors.text.secondary }} className="text-sm font-semibold">
                    {caseItem.caseNumber}
                  </Text>
                </View>
              </View>
              <View
                className="w-14 h-14 rounded-2xl items-center justify-center"
                style={{ backgroundColor: colors.bg.tertiary }}
              >
                {getCaseTypeIcon(caseItem.type, colors.text.primary, 26)}
              </View>
            </View>

            {/* Priority and Source Row */}
            <View className="flex-row gap-3 pt-4" style={{ borderTopWidth: 1, borderTopColor: colors.border.light }}>
              {caseItem.priority && (
                <View className="flex-1">
                  <Text style={{ color: colors.text.muted }} className="text-[9px] font-bold uppercase tracking-widest mb-1.5">
                    Priority
                  </Text>
                  <View className="flex-row items-center gap-1.5">
                    <Flag size={14} color={CASE_PRIORITY_COLORS[caseItem.priority]} strokeWidth={2} />
                    <Text style={{ color: CASE_PRIORITY_COLORS[caseItem.priority] }} className="text-sm font-bold">
                      {caseItem.priority}
                    </Text>
                  </View>
                </View>
              )}
              {caseItem.source && (
                <View className="flex-1">
                  <Text style={{ color: colors.text.muted }} className="text-[9px] font-bold uppercase tracking-widest mb-1.5">
                    Source
                  </Text>
                  <View className="flex-row items-center gap-1.5">
                    {getCaseSourceIcon(caseItem.source, colors.text.secondary, 14)}
                    <Text style={{ color: colors.text.secondary }} className="text-sm font-semibold">
                      {caseItem.source}
                    </Text>
                  </View>
                </View>
              )}
              <View className="flex-1">
                <Text style={{ color: colors.text.muted }} className="text-[9px] font-bold uppercase tracking-widest mb-1.5">
                  Logged On
                </Text>
                <View className="flex-row items-center gap-1.5">
                  <Clock size={14} color={colors.text.secondary} strokeWidth={1.5} />
                  <Text style={{ color: colors.text.secondary }} className="text-sm font-semibold">
                    {formattedCreatedDate}
                  </Text>
                </View>
              </View>
            </View>

            {/* Created By */}
            {caseItem.createdBy && (
              <View className="flex-row items-center gap-1.5 mt-3">
                <UserIcon size={12} color={colors.text.muted} strokeWidth={1.5} />
                <Text style={{ color: colors.text.muted }} className="text-xs">
                  Created by {caseItem.createdBy}
                </Text>
              </View>
            )}
          </View>

          {/* Order Info Section */}
          <View
            className="p-4 rounded-2xl mb-4"
            style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}
          >
            <View className="flex-row items-center justify-between mb-3">
              <Text style={{ color: colors.text.muted }} className="text-xs uppercase font-semibold">
                Linked Order
              </Text>
              <Pressable
                onPress={handleViewOrder}
                className="px-4 py-2 rounded-full flex-row items-center gap-1 active:opacity-80"
                style={{ backgroundColor: colors.accent.primary }}
              >
                <ExternalLink size={14} color="#fff" strokeWidth={1.5} />
                <Text className="text-sm font-semibold text-white">View Order</Text>
              </Pressable>
            </View>
            <View className="flex-row items-center gap-3">
              <View
                className="w-10 h-10 rounded-xl items-center justify-center"
                style={{ backgroundColor: colors.bg.secondary }}
              >
                <Package size={20} color={colors.text.secondary} strokeWidth={1.5} />
              </View>
              <View className="flex-1">
                <Text style={{ color: colors.text.primary }} className="font-semibold">
                  {caseItem.orderNumber}
                </Text>
                <View className="flex-row items-center gap-1 mt-0.5">
                  <UserIcon size={12} color={colors.text.muted} strokeWidth={1.5} />
                  <Text style={{ color: colors.text.secondary }} className="text-sm">
                    {caseItem.customerName}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Case Type Section */}
          <View
            className="p-4 rounded-2xl mb-4"
            style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}
          >
            <Text style={{ color: colors.text.muted }} className="text-xs uppercase font-semibold mb-3">
              Case Type
            </Text>
            <View className="flex-row items-center gap-2">
              <View
                className="w-10 h-10 rounded-xl items-center justify-center"
                style={{ backgroundColor: colors.bg.secondary }}
              >
                <Tag size={20} color={colors.text.secondary} strokeWidth={1.5} />
              </View>
              <Text style={{ color: colors.text.primary }} className="font-semibold text-lg">
                {caseItem.type}
              </Text>
            </View>
          </View>

          {/* Issue Summary Section */}
          <View
            className="p-4 rounded-2xl mb-4"
            style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}
          >
            <Text style={{ color: colors.text.muted }} className="text-xs uppercase font-semibold mb-3">
              Issue Summary
            </Text>
            <Text style={{ color: colors.text.primary }} className="text-base leading-6">
              {caseItem.issueSummary}
            </Text>
          </View>

          {/* Original Customer Message */}
          {caseItem.originalCustomerMessage && (
            <View
              className="p-4 rounded-2xl mb-4"
              style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}
            >
              <View className="flex-row items-center gap-2 mb-3">
                <MessageSquare size={16} color={colors.text.muted} strokeWidth={1.5} />
                <Text style={{ color: colors.text.muted }} className="text-xs uppercase font-semibold">
                  Original Customer Message
                </Text>
              </View>
              <View
                className="p-3 rounded-xl"
                style={{ backgroundColor: colors.bg.secondary }}
              >
                <Text style={{ color: colors.text.secondary }} className="text-sm leading-5 italic">
                  "{caseItem.originalCustomerMessage}"
                </Text>
              </View>
            </View>
          )}

          {/* Proof Images */}
          {caseItem.attachments && caseItem.attachments.length > 0 && (
            <View
              className="p-4 rounded-2xl mb-4"
              style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}
            >
              <Text style={{ color: colors.text.muted }} className="text-xs uppercase font-semibold mb-3">
                Proof Images
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 4 }}
              >
                {caseItem.attachments.map((attachment) => (
                  <View key={attachment.id} className="mr-3">
                    <View
                      className="rounded-2xl overflow-hidden"
                      style={{ borderWidth: 1, borderColor: colors.border.light }}
                    >
                      <Image
                        source={{ uri: attachment.preview ?? attachment.uri }}
                        style={{ width: 140, height: 120 }}
                        resizeMode="cover"
                      />
                    </View>
                    <Text
                      style={{ color: colors.text.secondary }}
                      className="text-[11px] mt-2"
                    >
                      {attachment.label}
                    </Text>
                    <Text
                      style={{ color: colors.text.tertiary }}
                      className="text-[9px]"
                    >
                      {new Date(
                        attachment.uploadedAt || caseItem.createdAt
                      ).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Resolution Section */}
          {caseItem.resolution && (
            <View
              className="p-4 rounded-2xl mb-4"
              style={{
                backgroundColor: CASE_STATUS_COLORS['Resolved'] + '10',
                borderWidth: 1,
                borderColor: CASE_STATUS_COLORS['Resolved'] + '30',
              }}
            >
              <View className="flex-row items-center gap-2 mb-3">
                <Check size={16} color={CASE_STATUS_COLORS['Resolved']} strokeWidth={2} />
                <Text style={{ color: CASE_STATUS_COLORS['Resolved'] }} className="text-xs uppercase font-semibold">
                  Resolution
                </Text>
              </View>
              <View className="gap-3">
                <View className="flex-row items-center justify-between">
                  <Text style={{ color: colors.text.secondary }} className="text-sm">
                    Resolution Type
                  </Text>
                  <Text style={{ color: colors.text.primary }} className="font-semibold">
                    {caseItem.resolution.type}
                  </Text>
                </View>
                {caseItem.resolution.value && (
                  <View className="flex-row items-center justify-between">
                    <Text style={{ color: colors.text.secondary }} className="text-sm">
                      Value
                    </Text>
                    <View className="flex-row items-center gap-1">
                      <DollarSign size={14} color={colors.text.primary} strokeWidth={1.5} />
                      <Text style={{ color: colors.text.primary }} className="font-semibold">
                        {formatCurrency(caseItem.resolution.value)}
                      </Text>
                    </View>
                  </View>
                )}
                {formattedResolvedDate && (
                  <View className="flex-row items-center justify-between">
                    <Text style={{ color: colors.text.secondary }} className="text-sm">
                      Resolved On
                    </Text>
                    <Text style={{ color: colors.text.primary }} className="font-medium">
                      {formattedResolvedDate}
                    </Text>
                  </View>
                )}
                {caseItem.resolution.notes && (
                  <View className="mt-2">
                    <Text style={{ color: colors.text.secondary }} className="text-sm mb-1">
                      Notes
                    </Text>
                    <Text style={{ color: colors.text.primary }} className="text-sm leading-5">
                      {caseItem.resolution.notes}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Audit History / Timeline Section */}
          {(caseItem.timeline && caseItem.timeline.length > 0) && (
            <View className="mb-4">
              <View className="flex-row items-center gap-2 mb-4">
                <History size={16} color={colors.text.muted} strokeWidth={1.5} />
                <Text style={{ color: colors.text.muted }} className="text-[10px] font-bold uppercase tracking-[0.2em]">
                  Audit History
                </Text>
              </View>
              <View className="relative pl-4">
                {/* Vertical line */}
                <View
                  className="absolute left-[5px] top-2 bottom-2 w-[2px]"
                  style={{ backgroundColor: colors.border.light }}
                />
                {caseItem.timeline.map((entry, index) => {
                  const isNote = entry.action.startsWith('Note added:');
                  const entryDate = new Date(entry.date);
                  const formattedEntryDate = `${entryDate.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}, ${entryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                  return (
                    <Animated.View
                      key={entry.id}
                      entering={FadeInLeft.delay(index * 50).springify()}
                      className="flex-row gap-4 mb-4"
                    >
                      <View
                        className="w-3 h-3 rounded-full z-10"
                        style={{
                          backgroundColor: isNote ? colors.accent.primary : colors.bg.card,
                          borderWidth: isNote ? 0 : 3,
                          borderColor: colors.border.medium,
                        }}
                      />
                      <View className="flex-1 -mt-0.5">
                        <Text
                          style={{ color: isNote ? colors.accent.primary : colors.text.primary }}
                          className="text-sm font-semibold leading-5"
                        >
                          {entry.action}
                        </Text>
                        <Text style={{ color: colors.text.muted }} className="text-[10px] font-bold uppercase tracking-tighter mt-1">
                          {entry.user} • {formattedEntryDate}
                        </Text>
                      </View>
                    </Animated.View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Status Update Buttons */}
          <View className="mb-4">
            <Text style={{ color: colors.text.muted }} className="text-xs uppercase font-semibold mb-3">
              Update Status
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {sortedCaseStatuses.map((statusOption) => {
                const statusName = statusOption.name;
                const isSelected = statusName === caseItem.status;
                const color = statusColorMap[statusName] ?? colors.text.muted;
                return (
                  <Pressable
                    key={statusName}
                    onPress={() => handleStatusChange(statusName)}
                    className="px-4 py-2 rounded-full active:opacity-70"
                    style={{
                      backgroundColor: isSelected ? color : color + '15',
                      borderWidth: isSelected ? 0 : 1,
                      borderColor: color + '30',
                    }}
                  >
                    <Text
                      style={{ color: isSelected ? '#fff' : color }}
                      className="text-sm font-medium"
                    >
                      {statusName}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Action Buttons */}
          <View className="gap-3 mb-8">
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowNoteModal(true);
                }}
                className="flex-1 flex-row items-center justify-center py-4 rounded-2xl active:opacity-80"
                style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}
              >
                <Plus size={18} color={colors.text.primary} strokeWidth={2} />
                <Text style={{ color: colors.text.primary }} className="font-semibold ml-2">Add Note</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowStatusModal(true);
                }}
                className="flex-1 flex-row items-center justify-center py-4 rounded-2xl active:opacity-80"
                style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}
              >
                <RefreshCcw size={18} color={colors.text.primary} strokeWidth={2} />
                <Text style={{ color: colors.text.primary }} className="font-semibold ml-2">Status</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setShowEditForm(true);
              }}
              className="flex-row items-center justify-center py-4 rounded-2xl active:opacity-80"
              style={{ backgroundColor: '#111111' }}
            >
              <Edit2 size={18} color="#fff" strokeWidth={2} />
              <Text className="text-white font-semibold ml-2">Edit Case</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setShowDeleteModal(true);
              }}
              className="flex-row items-center justify-center py-4 rounded-2xl active:opacity-80"
              style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: '#EF4444' + '40' }}
            >
              <Trash2 size={18} color="#EF4444" strokeWidth={2} />
              <Text style={{ color: '#EF4444' }} className="font-semibold ml-2">
                Delete Case
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Status Modal */}
      <Modal visible={showStatusModal} transparent animationType="fade">
        <Pressable
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onPress={() => setShowStatusModal(false)}
        >
          <View
            className="w-80 rounded-2xl p-4"
            style={{ backgroundColor: colors.bg.card }}
          >
            <Text style={{ color: colors.text.primary }} className="text-lg font-bold mb-4 text-center">
              Update Status
            </Text>
            {sortedCaseStatuses.map((statusOption) => {
              const statusName = statusOption.name;
              const color = statusColorMap[statusName] ?? colors.text.muted;
              const isSelected = statusName === caseItem.status;
              return (
                <Pressable
                  key={statusName}
                  onPress={() => handleStatusChange(statusName)}
                  className="flex-row items-center py-3 px-4 rounded-xl mb-2 active:opacity-70"
                  style={{
                    backgroundColor: isSelected ? color + '20' : colors.bg.secondary,
                  }}
                >
                  <View
                    className="w-3 h-3 rounded-full mr-3"
                    style={{ backgroundColor: color }}
                  />
                  <Text
                    style={{ color: isSelected ? color : colors.text.primary }}
                    className="font-medium flex-1"
                  >
                    {statusName}
                  </Text>
                  {isSelected && <Check size={18} color={color} strokeWidth={2} />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={showDeleteModal} transparent animationType="fade">
        <Pressable
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onPress={() => setShowDeleteModal(false)}
        >
          <View
            className="w-80 rounded-2xl p-5"
            style={{ backgroundColor: colors.bg.card }}
          >
            <Text style={{ color: colors.text.primary }} className="text-lg font-bold mb-2 text-center">
              Delete Case?
            </Text>
            <Text style={{ color: colors.text.secondary }} className="text-center mb-6">
              This action cannot be undone. The case will be permanently deleted.
            </Text>
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setShowDeleteModal(false)}
                className="flex-1 py-4 rounded-2xl active:opacity-80"
                style={{ backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.light }}
              >
                <Text style={{ color: colors.text.secondary }} className="text-center font-semibold">
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleDelete}
                className="flex-1 py-4 rounded-2xl active:opacity-80"
                style={{ backgroundColor: '#EF4444' }}
              >
                <Text className="text-white text-center font-semibold">Delete</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Add Note Modal */}
      <Modal visible={showNoteModal} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 items-center justify-center px-6"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <Pressable
            className="absolute inset-0"
            onPress={() => {
              setShowNoteModal(false);
              setNoteText('');
            }}
          />
          <View
            className="w-full max-w-md rounded-[28px] p-6"
            style={{ backgroundColor: colors.bg.card }}
          >
            <Text style={{ color: colors.text.primary }} className="text-xl font-bold mb-5 tracking-tight">
              Add Internal Note
            </Text>
            <TextInput
              autoFocus
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Type your notes here..."
              placeholderTextColor={colors.text.muted}
              multiline
              numberOfLines={4}
              className="rounded-2xl p-4 text-sm mb-5"
              style={{
                backgroundColor: colors.bg.secondary,
                color: colors.text.primary,
                borderWidth: 1,
                borderColor: colors.border.light,
                minHeight: 120,
                textAlignVertical: 'top',
              }}
            />
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => {
                  setShowNoteModal(false);
                  setNoteText('');
                }}
                className="flex-1 py-4 rounded-2xl active:opacity-80"
                style={{ backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.light }}
              >
                <Text style={{ color: colors.text.secondary }} className="text-center font-semibold">
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleAddNote}
                className="flex-1 py-4 rounded-2xl active:opacity-80"
                style={{ backgroundColor: '#111111' }}
              >
                <Text className="text-white text-center font-semibold">
                  Post Note
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Form */}
      <CaseForm
        visible={showEditForm}
        onClose={() => setShowEditForm(false)}
        onSave={handleSaveEdit}
        orderId={caseItem.orderId}
        orderNumber={caseItem.orderNumber}
        customerId={caseItem.customerId}
        customerName={caseItem.customerName}
        existingCase={caseItem}
        createdBy={userName || undefined}
      />
    </View>
  );
}

export default CaseDetailPanel;
