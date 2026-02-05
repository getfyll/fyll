import React from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  FileText,
  ChevronRight,
  RefreshCcw,
  Undo2,
  DollarSign,
  Zap,
  ShieldCheck,
  HelpCircle,
  Flag,
} from 'lucide-react-native';
import { useThemeColors } from '@/lib/theme';
import useFyllStore, { CASE_STATUS_COLORS, CASE_PRIORITY_COLORS, CaseType, CasePriority } from '@/lib/state/fyll-store';
import type { Case } from '@/lib/state/fyll-store';

// Get icon for case type
const getCaseTypeIcon = (type: CaseType, color: string, size: number = 16) => {
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

interface CaseListItemProps {
  caseItem: Case;
  onPress: () => void;
  index?: number;
  compact?: boolean;
}

export function CaseListItem({ caseItem, onPress, index = 0, compact = false }: CaseListItemProps) {
  const colors = useThemeColors();
  const caseStatuses = useFyllStore((s) => s.caseStatuses);
  const matchedStatus = caseStatuses.find((status) => status.name === caseItem.status);
  const statusColor = matchedStatus?.color ?? CASE_STATUS_COLORS[caseItem.status] ?? colors.text.muted;

  const formattedDate = new Date(caseItem.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: compact ? undefined : 'numeric',
  });

  if (compact) {
    const compactDate = new Date(caseItem.createdAt).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const priorityColor = caseItem.priority ? CASE_PRIORITY_COLORS[caseItem.priority] : null;

    return (
      <Pressable
        onPress={onPress}
        className="rounded-3xl px-5 py-4 mb-3 border active:opacity-80"
        style={{
          backgroundColor: colors.bg.card,
          borderColor: colors.border.light,
        }}
      >
        {/* Top row: Status badge and Case ID */}
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-2">
            <View
              className="px-2.5 py-1 rounded-lg"
              style={{ backgroundColor: statusColor + '20', borderWidth: 1, borderColor: statusColor + '30' }}
            >
              <Text
                style={{ color: statusColor }}
                className="text-[9px] font-bold uppercase tracking-wider"
              >
                {caseItem.status}
              </Text>
            </View>
            <Text style={{ color: colors.text.muted }} className="text-[10px] font-bold tracking-tight">
              {caseItem.caseNumber}
            </Text>
          </View>
          {caseItem.priority && priorityColor && (
            <View className="flex-row items-center gap-1">
              <Flag size={10} color={priorityColor} strokeWidth={2} />
              <Text style={{ color: priorityColor }} className="text-[9px] font-bold uppercase">
                {caseItem.priority}
              </Text>
            </View>
          )}
        </View>

        {/* Main content row */}
        <View className="flex-row justify-between items-end">
          <View className="flex-1">
            <Text style={{ color: colors.text.primary }} className="text-lg font-bold leading-tight">
              {caseItem.customerName}
            </Text>
            <View className="flex-row items-center gap-2 mt-2">
              <View
                className="p-1.5 rounded-lg"
                style={{ backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.light }}
              >
                {getCaseTypeIcon(caseItem.type, colors.text.secondary, 14)}
              </View>
              <Text style={{ color: colors.text.secondary }} className="text-xs font-bold">
                {caseItem.type}
              </Text>
            </View>
          </View>
          <View className="items-end">
            <Text style={{ color: colors.text.muted }} className="text-[10px] font-bold uppercase tracking-tighter">
              Order {caseItem.orderNumber}
            </Text>
            <Text style={{ color: colors.text.tertiary }} className="text-[10px] font-bold mt-0.5">
              {compactDate}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  }

  const priorityColor = caseItem.priority ? CASE_PRIORITY_COLORS[caseItem.priority] : null;

  return (
    <View    >
      <Pressable
        onPress={onPress}
        className="rounded-3xl px-5 py-4 mb-3 active:opacity-80"
        style={{
          backgroundColor: colors.bg.card,
          borderWidth: 1,
          borderColor: colors.border.light,
        }}
      >
        {/* Top row: Status and ID */}
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-2">
            <View
              className="px-2.5 py-1 rounded-lg"
              style={{ backgroundColor: statusColor + '20', borderWidth: 1, borderColor: statusColor + '30' }}
            >
              <Text
                style={{ color: statusColor }}
                className="text-[9px] font-bold uppercase tracking-wider"
              >
                {caseItem.status}
              </Text>
            </View>
            <Text style={{ color: colors.text.muted }} className="text-[10px] font-bold">
              {caseItem.caseNumber}
            </Text>
          </View>
          {caseItem.priority && priorityColor && (
            <View className="flex-row items-center gap-1">
              <Flag size={10} color={priorityColor} strokeWidth={2} />
              <Text style={{ color: priorityColor }} className="text-[9px] font-bold uppercase">
                {caseItem.priority}
              </Text>
            </View>
          )}
        </View>

        {/* Main content */}
        <View className="flex-row justify-between items-start">
          <View className="flex-1 pr-4">
            <Text style={{ color: colors.text.primary }} className="text-lg font-bold leading-tight">
              {caseItem.customerName}
            </Text>
            <View className="flex-row items-center gap-2 mt-2">
              <View
                className="p-1.5 rounded-lg"
                style={{ backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.light }}
              >
                {getCaseTypeIcon(caseItem.type, colors.text.secondary, 14)}
              </View>
              <Text style={{ color: colors.text.secondary }} className="text-xs font-bold">
                {caseItem.type}
              </Text>
            </View>
            <Text
              style={{ color: colors.text.secondary }}
              className="text-sm mt-2 leading-5"
              numberOfLines={2}
            >
              {caseItem.issueSummary}
            </Text>
          </View>

          {/* Type icon badge (large) */}
          <View
            className="w-12 h-12 rounded-2xl items-center justify-center"
            style={{ backgroundColor: colors.bg.tertiary }}
          >
            {getCaseTypeIcon(caseItem.type, colors.text.primary, 22)}
          </View>
        </View>

        {/* Bottom row */}
        <View className="flex-row items-center justify-between mt-3 pt-3" style={{ borderTopWidth: 1, borderTopColor: colors.border.light }}>
          <Text style={{ color: colors.text.muted }} className="text-[10px] font-bold uppercase tracking-tighter">
            Order {caseItem.orderNumber}
          </Text>
          <Text style={{ color: colors.text.tertiary }} className="text-[10px] font-bold">
            {formattedDate}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

export default CaseListItem;
