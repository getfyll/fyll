import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, addMonths, addWeeks, addYears, format, isPast, isToday, isTomorrow, isYesterday, parseISO, startOfToday } from 'date-fns';
import { useRouter } from 'expo-router';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { ArrowLeft, ArrowUpDown, Calendar, Check, CheckCircle2, ChevronDown, Circle, Clock3, Flag, Funnel, MessageSquare, MoreHorizontal, MoreVertical, Pencil, Plus, Repeat, Search, Send, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { collaborationData, type CollaborationComment } from '@/lib/supabase/collaboration';
import { useResolvedThemeMode, useThemeColors } from '@/lib/theme';
import { useBreakpoint } from '@/lib/useBreakpoint';
import { DESKTOP_PAGE_HEADER_GUTTER, DESKTOP_PAGE_HEADER_MIN_HEIGHT, getStandardPageHeadingStyle } from '@/lib/page-heading';
import useAuthStore, { type TeamMember } from '@/lib/state/auth-store';
import { supabase } from '@/lib/supabase';
import { taskData, type CreateTaskInput, type Task, type TaskPriority, type TaskRecurrenceFrequency, type UpdateTaskInput, type CompleteTaskResult } from '@/lib/supabase/tasks';
import { sendTaskAssignmentNotification, sendTaskCompletionNotification, triggerTaskDueReminders } from '@/hooks/useWebPushNotifications';

type TaskFilter = 'all' | 'pending' | 'done';
type TaskKpiScope = 'all' | 'due_today' | 'overdue' | 'completed_today';

interface TaskFormState {
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: Date | null;
  assigneeUserIds: string[];
  recurrenceFrequency: TaskRecurrenceFrequency | null;
  recurrenceInterval: number;
}

interface TaskActivityFeedProps {
  businessId: string;
  taskId: string;
  task: Task;
  teamMembers: TeamMember[];
  compact?: boolean;
}

interface TaskWorkspaceProps {
  mode: 'list' | 'detail';
  taskId?: string;
}

interface TaskPeopleBadgesProps {
  overdue: number;
  completed: number;
  upcoming: number;
}

interface TaskToastState {
  title: string;
  message: string | null;
  icon: 'check' | 'repeat';
  accent: string;
  accentSoft: string;
}

interface TaskToastConfettiPieceDefinition {
  x: number;
  y: number;
  rotate: number;
  width: number;
  height: number;
  color: string;
}

const FILTERS: Array<{ id: TaskFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'done', label: 'Done' },
];

const RECURRENCE_OPTIONS: Array<{ id: TaskRecurrenceFrequency | null; label: string }> = [
  { id: null, label: 'No' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'bi_weekly', label: 'Bi-weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'yearly', label: 'Yearly' },
];

const PRIORITY_META: Record<TaskPriority, { label: string; color: string; soft: string }> = {
  low: { label: 'Low', color: '#64748B', soft: 'rgba(100,116,139,0.08)' },
  medium: { label: 'Medium', color: '#2563EB', soft: 'rgba(37,99,235,0.08)' },
  high: { label: 'High', color: '#EF4444', soft: 'rgba(239,68,68,0.09)' },
  urgent: { label: 'Urgent', color: '#B91C1C', soft: 'rgba(185,28,28,0.10)' },
};

const OVERVIEW_CARD_VISIBLE_ROWS = 5;
const OVERVIEW_CARD_ROW_HEIGHT = 56;
const OVERVIEW_CARD_LIST_MAX_HEIGHT = OVERVIEW_CARD_VISIBLE_ROWS * OVERVIEW_CARD_ROW_HEIGHT;
const TASK_MODAL_MAX_WIDTH = 560;
const TASK_MODAL_MAX_HEIGHT = '92%' as const;
const TASK_MODAL_RADIUS = 24;
const TASK_MODAL_HEADER_HORIZONTAL_PADDING = 20;
const TASK_MODAL_HEADER_VERTICAL_PADDING = 16;
const TASK_MODAL_BODY_PADDING = 18;
const TASK_MODAL_BODY_GAP = 14;
const TASK_MODAL_FOOTER_HORIZONTAL_PADDING = 18;
const TASK_MODAL_FOOTER_BOTTOM_PADDING = 18;
const TASK_MODAL_FOOTER_GAP = 8;
const TASK_TOAST_CONFETTI_PIECES: TaskToastConfettiPieceDefinition[] = [
  { x: -22, y: -18, rotate: -32, width: 5, height: 11, color: '#F97316' },
  { x: -11, y: -26, rotate: -14, width: 4, height: 10, color: '#2563EB' },
  { x: 4, y: -28, rotate: 12, width: 5, height: 11, color: '#FACC15' },
  { x: 18, y: -18, rotate: 28, width: 4, height: 10, color: '#EC4899' },
  { x: -19, y: -4, rotate: -18, width: 4, height: 9, color: '#10B981' },
  { x: 22, y: -2, rotate: 18, width: 4, height: 9, color: '#8B5CF6' },
];

const statusLabel = (status: Task['status']) => {
  if (status === 'in_progress') return 'In Progress';
  if (status === 'done') return 'Completed';
  return 'Pending';
};

const recurrenceLabel = (frequency?: string | null) => {
  if (!frequency) return 'One-off';
  const normalized = frequency.trim().toLowerCase().replace('-', '_');
  if (normalized === 'daily') return 'Daily';
  if (normalized === 'weekly') return 'Weekly';
  if (normalized === 'bi_weekly') return 'Bi-weekly';
  if (normalized === 'monthly') return 'Monthly';
  if (normalized === 'quarterly') return 'Quarterly';
  if (normalized === 'yearly') return 'Yearly';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const recurrenceTone = (frequency?: string | null) => {
  const normalized = frequency?.trim().toLowerCase().replace('-', '_') ?? '';
  if (normalized === 'daily') {
    return { text: '#1D4ED8', background: 'rgba(29,78,216,0.10)' };
  }
  if (normalized === 'weekly') {
    return { text: '#7C3AED', background: 'rgba(124,58,237,0.10)' };
  }
  if (normalized === 'bi_weekly') {
    return { text: '#4338CA', background: 'rgba(67,56,202,0.10)' };
  }
  if (normalized === 'monthly') {
    return { text: '#0F766E', background: 'rgba(15,118,110,0.10)' };
  }
  if (normalized === 'quarterly') {
    return { text: '#0369A1', background: 'rgba(3,105,161,0.10)' };
  }
  if (normalized === 'yearly') {
    return { text: '#B45309', background: 'rgba(180,83,9,0.10)' };
  }
  return { text: '#64748B', background: 'rgba(100,116,139,0.10)' };
};

const formatDueDate = (value?: string | null) => {
  if (!value) return 'No due date';
  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) return 'No due date';
  return format(parsed, 'EEE, MMM d');
};

const formatDueDateLong = (value?: string | null) => {
  if (!value) return 'No due date';
  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) return 'No due date';
  return format(parsed, 'EEEE, MMM d');
};

const formatDueDateRelative = (value?: string | null) => {
  if (!value) return 'No date';
  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) return 'No date';
  if (isYesterday(parsed)) return 'Yesterday';
  if (isToday(parsed)) return 'Today';
  if (isTomorrow(parsed)) return 'Tomorrow';
  return format(parsed, 'EEEE');
};

const toSentenceCase = (value?: string | null) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) return '';
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1).toLowerCase()}`;
};

const normalizeMentionToken = (value: string) =>
  value.replace(/^@/, '').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');

const mentionHandleFromMember = (member: TeamMember) => {
  const emailLocalPart = member.email.split('@')[0] ?? '';
  const base = emailLocalPart || member.name || member.id;
  return normalizeMentionToken(base.replace(/\s+/g, '')) || normalizeMentionToken(member.id);
};

const formatBadgeCount = (count: number) => (count > 99 ? '99+' : String(count));

function TaskPeopleBadges({ overdue, completed, upcoming }: TaskPeopleBadgesProps) {
  const colors = useThemeColors();
  const badges = [
    {
      key: 'overdue',
      count: overdue,
      bg: 'rgba(239,68,68,0.10)',
      border: 'rgba(185,28,28,0.18)',
      text: '#B91C1C',
    },
    {
      key: 'completed',
      count: completed,
      bg: 'rgba(16,185,129,0.10)',
      border: 'rgba(5,150,105,0.18)',
      text: '#059669',
    },
    {
      key: 'upcoming',
      count: upcoming,
      bg: colors.bg.secondary,
      border: colors.border.light,
      text: colors.text.tertiary,
    },
  ].filter((badge) => badge.count > 0);

  if (badges.length === 0) return null;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      {badges.map((badge) => (
        <View
          key={badge.key}
          style={{
            minWidth: 22,
            height: 22,
            borderRadius: 999,
            paddingHorizontal: badge.count > 9 ? 7 : 0,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: badge.bg,
            borderWidth: 1,
            borderColor: badge.border,
          }}
        >
          <Text style={{ color: badge.text, fontSize: 11, fontWeight: '700' }}>
            {formatBadgeCount(badge.count)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function TaskToastConfettiPiece({
  progress,
  piece,
}: {
  progress: Animated.SharedValue<number>;
  piece: TaskToastConfettiPieceDefinition;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [
      { translateX: piece.x * progress.value },
      { translateY: piece.y * progress.value + (8 * progress.value) },
      { rotate: `${piece.rotate * progress.value}deg` },
      { scale: 1 - (0.35 * progress.value) },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: 23,
          top: 23,
          width: piece.width,
          height: piece.height,
          borderRadius: 999,
          backgroundColor: piece.color,
        },
        animatedStyle,
      ]}
    />
  );
}

function TaskToastConfetti() {
  const progress = useSharedValue<number>(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress]);

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -8,
        left: -8,
        width: 58,
        height: 58,
      }}
    >
      {TASK_TOAST_CONFETTI_PIECES.map((piece, index) => (
        <TaskToastConfettiPiece key={`${piece.color}-${index}`} progress={progress} piece={piece} />
      ))}
    </View>
  );
}

const buildMentionAliasMap = (teamMembers: TeamMember[]) => {
  const aliasMap = new Map<string, string>();
  teamMembers.forEach((member) => {
    const userId = member.id;
    const aliases = new Set<string>();

    aliases.add(normalizeMentionToken(member.id));
    aliases.add(normalizeMentionToken(member.name.replace(/\s+/g, '')));
    aliases.add(normalizeMentionToken(member.name.split(' ')[0] ?? ''));
    aliases.add(normalizeMentionToken(mentionHandleFromMember(member)));
    aliases.add(normalizeMentionToken(member.email.split('@')[0] ?? ''));

    aliases.forEach((alias) => {
      if (alias && !aliasMap.has(alias)) aliasMap.set(alias, userId);
    });
  });

  return aliasMap;
};

const isTaskOverdue = (task: Task) => {
  if (!task.due_date || task.status === 'done') return false;
  const due = parseISO(`${task.due_date}T23:59:59`);
  return isPast(due) && !isToday(due);
};

const isTaskCompletedToday = (task: Task) => {
  if (task.status !== 'done' || !task.completed_at) return false;
  const completedAt = parseISO(task.completed_at);
  if (Number.isNaN(completedAt.getTime())) return false;
  return isToday(completedAt);
};

const formatMessageTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

const toTaskFormState = (task: Task): TaskFormState => ({
  title: task.title,
  description: task.description ?? '',
  priority: task.priority,
  dueDate: task.due_date ? parseISO(task.due_date) : null,
  assigneeUserIds: task.assignee_user_ids ?? [],
  recurrenceFrequency: task.recurrence_frequency ?? null,
  recurrenceInterval: task.recurrence_interval ?? 1,
});

const blankTaskForm = (): TaskFormState => ({
  title: '',
  description: '',
  priority: 'medium',
  dueDate: startOfToday(),
  assigneeUserIds: [],
  recurrenceFrequency: null,
  recurrenceInterval: 1,
});

function UserAvatar({ member, name, size = 26 }: { member?: TeamMember; name?: string; size?: number }) {
  const resolvedName = member?.name?.trim() || name?.trim() || 'Member';
  const initial = resolvedName.charAt(0).toUpperCase();
  const palette = ['#111827', '#2563EB', '#0F766E', '#9333EA', '#C2410C'];
  let hash = 0;
  for (let i = 0; i < resolvedName.length; i += 1) {
    hash = (hash + resolvedName.charCodeAt(i) * (i + 1)) % 10000;
  }
  const color = palette[hash % palette.length];

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: color,
      }}
    >
      <Text style={{ color: '#FFFFFF', fontSize: size <= 20 ? 9 : 11, fontWeight: '700' }}>
        {initial}
      </Text>
    </View>
  );
}

function AssigneePicker({
  teamMembers,
  selectedUserIds,
  currentUserId,
  onToggleAssignee,
  placeholder,
}: {
  teamMembers: TeamMember[];
  selectedUserIds: string[];
  currentUserId?: string | null;
  onToggleAssignee: (userId: string) => void;
  placeholder: string;
}) {
  const colors = useThemeColors();
  const themeMode = useResolvedThemeMode();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const fieldBorder = colors.border.light;
  const fieldActiveBorder = themeMode === 'light' ? '#94A3B8' : colors.border.medium;
  const fieldBg = colors.bg.card;

  useEffect(() => {
    if (!isOpen) setSearchQuery('');
  }, [isOpen]);

  const selectedMembers = useMemo(
    () => teamMembers.filter((member) => selectedUserIds.includes(member.id)),
    [selectedUserIds, teamMembers]
  );

  const summaryLabel = useMemo(() => {
    if (selectedMembers.length === 0) return placeholder;
    const first = selectedMembers[0];
    const firstLabel = first?.id === currentUserId ? 'Myself' : first?.name ?? 'Assignee';
    if (selectedMembers.length === 1) return firstLabel;
    return `${firstLabel} +${selectedMembers.length - 1}`;
  }, [currentUserId, placeholder, selectedMembers]);

  const filteredMembers = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) return teamMembers;
    return teamMembers.filter((member) => {
      const label = member.id === currentUserId ? 'myself' : member.name.toLowerCase();
      return label.includes(normalized) || member.email.toLowerCase().includes(normalized);
    });
  }, [currentUserId, searchQuery, teamMembers]);

  return (
    <View style={{ zIndex: isOpen ? 40 : 1 }}>
      <Pressable
        onPress={() => setIsOpen((current) => !current)}
        style={{
          height: 46,
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          borderBottomLeftRadius: isOpen ? 0 : 12,
          borderBottomRightRadius: isOpen ? 0 : 12,
          borderWidth: 1,
          borderColor: isOpen ? fieldActiveBorder : fieldBorder,
          backgroundColor: fieldBg,
          paddingHorizontal: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text style={{ color: selectedMembers.length > 0 ? colors.text.primary : colors.text.tertiary, fontSize: 14, fontWeight: '400' }}>
          {summaryLabel}
        </Text>
        <ArrowUpDown size={14} color={isOpen ? fieldActiveBorder : colors.text.tertiary} strokeWidth={2.2} />
      </Pressable>

      {isOpen ? (
        <View style={{ borderWidth: 1, borderTopWidth: 0, borderColor: fieldActiveBorder, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, backgroundColor: fieldBg, overflow: 'hidden', maxHeight: 250 }}>
          <View style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: fieldBorder }}>
            <View style={{ height: 38, borderRadius: 10, borderWidth: 1, borderColor: fieldBorder, backgroundColor: fieldBg, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center' }}>
              <Search size={14} color={colors.text.tertiary} strokeWidth={2.2} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search assignee..."
                placeholderTextColor={colors.input.placeholder}
                style={{ flex: 1, marginLeft: 8, color: colors.text.primary, fontSize: 13, fontWeight: '400' }}
                selectionColor={colors.text.primary}
              />
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {filteredMembers.map((member) => {
              const selected = selectedUserIds.includes(member.id);
              const assigneeLabel = member.id === currentUserId ? 'Myself' : member.name;
              return (
                <Pressable
                  key={member.id}
                  onPress={() => onToggleAssignee(member.id)}
                  style={{
                    minHeight: 44,
                    paddingHorizontal: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: fieldBorder,
                    backgroundColor: selected ? 'rgba(37,99,235,0.08)' : fieldBg,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                    <UserAvatar member={member} size={22} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '500' }} numberOfLines={1}>{assigneeLabel}</Text>
                      <Text style={{ color: colors.text.tertiary, fontSize: 11 }} numberOfLines={1}>{member.email}</Text>
                    </View>
                  </View>
                  {selected ? <Check size={14} color="#2563EB" strokeWidth={2.6} /> : null}
                </Pressable>
              );
            })}
            {filteredMembers.length === 0 ? (
              <View style={{ paddingHorizontal: 12, paddingVertical: 12 }}>
                <Text style={{ color: colors.text.tertiary, fontSize: 12 }}>No assignees found.</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function PriorityDropdown({
  value,
  onChange,
}: {
  value: TaskPriority;
  onChange: (priority: TaskPriority) => void;
}) {
  const colors = useThemeColors();
  const themeMode = useResolvedThemeMode();
  const [isOpen, setIsOpen] = useState(false);
  const fieldBorder = colors.border.light;
  const fieldActiveBorder = themeMode === 'light' ? '#94A3B8' : colors.border.medium;
  const selectedMeta = PRIORITY_META[value];

  return (
    <View style={{ zIndex: isOpen ? 35 : 1 }}>
      <Pressable
        onPress={() => setIsOpen((current) => !current)}
        style={{
          height: 46,
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          borderBottomLeftRadius: isOpen ? 0 : 12,
          borderBottomRightRadius: isOpen ? 0 : 12,
          borderWidth: 1,
          borderColor: isOpen ? fieldActiveBorder : fieldBorder,
          backgroundColor: colors.bg.card,
          paddingHorizontal: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text style={{ color: selectedMeta.color, fontSize: 14, fontWeight: '500' }}>
          {selectedMeta.label}
        </Text>
        <ArrowUpDown size={14} color={isOpen ? fieldActiveBorder : colors.text.tertiary} strokeWidth={2.2} />
      </Pressable>
      {isOpen ? (
        <View style={{ borderWidth: 1, borderTopWidth: 0, borderColor: fieldActiveBorder, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, backgroundColor: colors.bg.card, overflow: 'hidden' }}>
          {(Object.keys(PRIORITY_META) as TaskPriority[]).map((priority) => {
            const meta = PRIORITY_META[priority];
            const selected = priority === value;
            return (
              <Pressable
                key={priority}
                onPress={() => {
                  onChange(priority);
                  setIsOpen(false);
                }}
                style={{
                  minHeight: 42,
                  paddingHorizontal: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: fieldBorder,
                  backgroundColor: selected ? meta.soft : colors.bg.card,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={{ color: meta.color, fontSize: 13, fontWeight: '500' }}>{meta.label}</Text>
                {selected ? <Check size={14} color={meta.color} strokeWidth={2.6} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function RecurrenceDropdown({
  value,
  onChange,
}: {
  value: TaskRecurrenceFrequency | null;
  onChange: (frequency: TaskRecurrenceFrequency | null) => void;
}) {
  const colors = useThemeColors();
  const themeMode = useResolvedThemeMode();
  const [isOpen, setIsOpen] = useState(false);
  const fieldBorder = colors.border.light;
  const fieldActiveBorder = themeMode === 'light' ? '#94A3B8' : colors.border.medium;
  const selectedOption = RECURRENCE_OPTIONS.find((option) => option.id === value) ?? RECURRENCE_OPTIONS[0];

  return (
    <View style={{ zIndex: isOpen ? 34 : 1 }}>
      <Pressable
        onPress={() => setIsOpen((current) => !current)}
        style={{
          height: 46,
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          borderBottomLeftRadius: isOpen ? 0 : 12,
          borderBottomRightRadius: isOpen ? 0 : 12,
          borderWidth: 1,
          borderColor: isOpen ? fieldActiveBorder : fieldBorder,
          backgroundColor: colors.bg.card,
          paddingHorizontal: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '500' }}>
          {selectedOption.label}
        </Text>
        <ArrowUpDown size={14} color={isOpen ? fieldActiveBorder : colors.text.tertiary} strokeWidth={2.2} />
      </Pressable>
      {isOpen ? (
        <View style={{ borderWidth: 1, borderTopWidth: 0, borderColor: fieldActiveBorder, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, backgroundColor: colors.bg.card, overflow: 'hidden' }}>
          {RECURRENCE_OPTIONS.map((option) => {
            const selected = option.id === value;
            return (
              <Pressable
                key={option.label}
                onPress={() => {
                  onChange(option.id);
                  setIsOpen(false);
                }}
                style={{
                  minHeight: 42,
                  paddingHorizontal: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: fieldBorder,
                  backgroundColor: selected ? 'rgba(37,99,235,0.10)' : colors.bg.card,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={{ color: selected ? '#1D4ED8' : colors.text.secondary, fontSize: 13, fontWeight: '500' }}>
                  {option.label}
                </Text>
                {selected ? <Check size={14} color="#1D4ED8" strokeWidth={2.6} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function PriorityPills({
  value,
  onChange,
}: {
  value: TaskPriority;
  onChange: (priority: TaskPriority) => void;
}) {
  const colors = useThemeColors();

  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {(Object.keys(PRIORITY_META) as TaskPriority[]).map((priority) => {
        const meta = PRIORITY_META[priority];
        const selected = priority === value;
        const selectedBackground = priority === 'low' ? 'rgba(245,158,11,0.16)' : meta.soft;
        const selectedTextColor = priority === 'low' ? '#B45309' : meta.color;
        return (
          <Pressable
            key={priority}
            onPress={() => onChange(priority)}
            style={{
              flex: 1,
              minWidth: 0,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 999,
              minHeight: 38,
              paddingHorizontal: 10,
              paddingVertical: 8,
              backgroundColor: selected ? selectedBackground : colors.bg.secondary,
            }}
          >
            <Text style={{ color: selected ? selectedTextColor : colors.text.secondary, fontSize: 12, fontWeight: '500' }}>
              {meta.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TaskCreateModal({
  visible,
  form,
  teamMembers,
  currentUserId,
  onChange,
  onToggleAssignee,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  visible: boolean;
  form: TaskFormState;
  teamMembers: TeamMember[];
  currentUserId?: string | null;
  onChange: (patch: Partial<TaskFormState>) => void;
  onToggleAssignee: (userId: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}) {
  const colors = useThemeColors();
  const themeMode = useResolvedThemeMode();
  const { isDesktop } = useBreakpoint();
  const isMobileModal = !isDesktop;
  const [showDatePicker, setShowDatePicker] = useState(false);
  const fieldBorder = colors.border.light;
  const fieldBg = colors.bg.card;

  return (
    <Modal
      visible={visible}
      transparent={!isMobileModal}
      animationType={isMobileModal ? 'slide' : 'fade'}
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: isMobileModal ? colors.bg.card : 'rgba(15,23,42,0.45)',
          alignItems: isMobileModal ? 'stretch' : 'center',
          justifyContent: isMobileModal ? 'flex-start' : 'center',
          padding: isMobileModal ? 0 : 18,
        }}
      >
        <View
          style={{
            width: '100%',
            flex: isMobileModal ? 1 : undefined,
            maxWidth: isMobileModal ? undefined : TASK_MODAL_MAX_WIDTH,
            maxHeight: isMobileModal ? undefined : TASK_MODAL_MAX_HEIGHT,
            backgroundColor: colors.bg.card,
            borderRadius: isMobileModal ? 0 : TASK_MODAL_RADIUS,
            borderWidth: isMobileModal ? 0 : 1,
            borderColor: colors.border.light,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              paddingHorizontal: TASK_MODAL_HEADER_HORIZONTAL_PADDING,
              paddingVertical: TASK_MODAL_HEADER_VERTICAL_PADDING,
              borderBottomWidth: 1,
              borderBottomColor: colors.border.light,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ color: colors.text.primary, fontSize: 20, fontWeight: '600' }}>Create Task</Text>
            <Pressable onPress={onClose} style={{ width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.secondary }}>
              <X size={18} color={colors.text.secondary} strokeWidth={2.2} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: TASK_MODAL_BODY_PADDING, gap: TASK_MODAL_BODY_GAP }}
            showsVerticalScrollIndicator={false}
          >
            <View>
              <Text style={{ color: colors.text.tertiary, fontSize: 11, fontWeight: '500', marginBottom: 6 }}>Task title</Text>
              <TextInput
                value={form.title}
                onChangeText={(value) => onChange({ title: value })}
                placeholder="What needs to be done?"
                placeholderTextColor={colors.input.placeholder}
                style={{
                  backgroundColor: fieldBg,
                  borderWidth: 1,
                  borderColor: fieldBorder,
                  color: colors.input.text,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 14,
                  fontWeight: '400',
                }}
                selectionColor={colors.text.primary}
              />
            </View>

            {isMobileModal ? (
              <View>
                <Text style={{ color: colors.text.tertiary, fontSize: 11, fontWeight: '500', marginBottom: 6 }}>Due date</Text>
                {Platform.OS === 'web' ? (
                  <View
                    style={{
                      minHeight: 46,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: fieldBorder,
                      backgroundColor: fieldBg,
                      paddingHorizontal: 12,
                      alignItems: 'center',
                      flexDirection: 'row',
                    }}
                  >
                    <Calendar size={15} color={colors.text.tertiary} strokeWidth={2} />
                    <input
                      type="date"
                      value={form.dueDate ? format(form.dueDate, 'yyyy-MM-dd') : ''}
                      onChange={(event: any) => {
                        const next = String(event?.target?.value ?? '');
                        if (!next) {
                          onChange({ dueDate: null });
                          return;
                        }
                        const parsed = parseISO(`${next}T00:00:00`);
                        if (!Number.isNaN(parsed.getTime())) {
                          onChange({ dueDate: parsed });
                        }
                      }}
                      style={{
                        flex: 1,
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        color: colors.input.text,
                        marginLeft: 10,
                        fontSize: 13,
                        fontWeight: 400,
                        fontFamily: 'inherit',
                        colorScheme: themeMode === 'dark' ? 'dark' : 'light',
                      }}
                    />
                  </View>
                ) : (
                  <Pressable
                    onPress={() => setShowDatePicker((current) => !current)}
                    style={{
                      minHeight: 46,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: fieldBorder,
                      backgroundColor: fieldBg,
                      paddingHorizontal: 12,
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text style={{ color: colors.input.text, fontSize: 13, fontWeight: '400' }}>
                      {form.dueDate ? format(form.dueDate, 'yyyy-MM-dd') : 'Set date'}
                    </Text>
                    <Calendar size={15} color={colors.text.tertiary} strokeWidth={2} />
                  </Pressable>
                )}
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text.tertiary, fontSize: 11, fontWeight: '500', marginBottom: 6 }}>Due date</Text>
                  {Platform.OS === 'web' ? (
                    <View
                      style={{
                        minHeight: 46,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: fieldBorder,
                        backgroundColor: fieldBg,
                        paddingHorizontal: 12,
                        alignItems: 'center',
                        flexDirection: 'row',
                      }}
                    >
                      <Calendar size={15} color={colors.text.tertiary} strokeWidth={2} />
                      <input
                        type="date"
                        value={form.dueDate ? format(form.dueDate, 'yyyy-MM-dd') : ''}
                        onChange={(event: any) => {
                          const next = String(event?.target?.value ?? '');
                          if (!next) {
                            onChange({ dueDate: null });
                            return;
                          }
                          const parsed = parseISO(`${next}T00:00:00`);
                          if (!Number.isNaN(parsed.getTime())) {
                            onChange({ dueDate: parsed });
                          }
                        }}
                        style={{
                          flex: 1,
                          border: 'none',
                          outline: 'none',
                          background: 'transparent',
                          color: colors.input.text,
                          marginLeft: 10,
                          fontSize: 13,
                          fontWeight: 400,
                          fontFamily: 'inherit',
                          colorScheme: themeMode === 'dark' ? 'dark' : 'light',
                        }}
                      />
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => setShowDatePicker((current) => !current)}
                      style={{
                        minHeight: 46,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: fieldBorder,
                        backgroundColor: fieldBg,
                        paddingHorizontal: 12,
                        alignItems: 'center',
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Text style={{ color: colors.input.text, fontSize: 13, fontWeight: '400' }}>
                        {form.dueDate ? format(form.dueDate, 'yyyy-MM-dd') : 'Set date'}
                      </Text>
                      <Calendar size={15} color={colors.text.tertiary} strokeWidth={2} />
                    </Pressable>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text.tertiary, fontSize: 11, fontWeight: '500', marginBottom: 6 }}>Priority</Text>
                  <PriorityDropdown value={form.priority} onChange={(priority) => onChange({ priority })} />
                </View>
              </View>
            )}

            {showDatePicker && Platform.OS !== 'web' ? (
              <DateTimePicker
                value={form.dueDate ?? startOfToday()}
                mode="date"
                minimumDate={startOfToday()}
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
                  if (event.type === 'dismissed') return;
                  if (selectedDate) onChange({ dueDate: selectedDate });
                  if (Platform.OS !== 'ios') setShowDatePicker(false);
                }}
              />
            ) : null}

            <View>
              <Text style={{ color: colors.text.tertiary, fontSize: 11, fontWeight: '500', marginBottom: 6 }}>Assignee</Text>
              <AssigneePicker
                teamMembers={teamMembers}
                selectedUserIds={form.assigneeUserIds}
                currentUserId={currentUserId}
                onToggleAssignee={onToggleAssignee}
                placeholder="Select assignees"
              />
            </View>

            {isMobileModal ? (
              <View>
                <Text style={{ color: colors.text.tertiary, fontSize: 11, fontWeight: '500', marginBottom: 6 }}>Recurring</Text>
                <RecurrenceDropdown
                  value={form.recurrenceFrequency}
                  onChange={(recurrenceFrequency) => onChange({ recurrenceFrequency })}
                />
              </View>
            ) : (
              <View>
                <Text style={{ color: colors.text.tertiary, fontSize: 11, fontWeight: '500', marginBottom: 6 }}>Recurring</Text>
                <RecurrenceDropdown
                  value={form.recurrenceFrequency}
                  onChange={(recurrenceFrequency) => onChange({ recurrenceFrequency })}
                />
              </View>
            )}

            {isMobileModal ? (
              <View>
                <Text style={{ color: colors.text.tertiary, fontSize: 11, fontWeight: '500', marginBottom: 6 }}>Priority</Text>
                <PriorityPills value={form.priority} onChange={(priority) => onChange({ priority })} />
              </View>
            ) : null}

            <View>
              <Text style={{ color: colors.text.tertiary, fontSize: 11, fontWeight: '500', marginBottom: 6 }}>Details (optional)</Text>
              <TextInput
                value={form.description}
                onChangeText={(value) => onChange({ description: value })}
                multiline
                placeholder="Add any instructions for the assignee"
                placeholderTextColor={colors.input.placeholder}
                style={{
                  minHeight: 92,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: fieldBorder,
                  backgroundColor: fieldBg,
                  color: colors.input.text,
                  paddingHorizontal: 12,
                  paddingTop: 10,
                  textAlignVertical: 'top',
                  fontWeight: '400',
                }}
                selectionColor={colors.text.primary}
              />
            </View>
          </ScrollView>

          <View
            style={{
              paddingHorizontal: TASK_MODAL_FOOTER_HORIZONTAL_PADDING,
              paddingBottom: TASK_MODAL_FOOTER_BOTTOM_PADDING,
              flexDirection: 'row',
              justifyContent: 'flex-end',
              gap: TASK_MODAL_FOOTER_GAP,
            }}
          >
            <Pressable onPress={onClose} style={{ paddingHorizontal: 16, height: 42, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.secondary }}>
              <Text style={{ color: colors.text.secondary, fontWeight: '500' }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onSubmit}
              disabled={isSubmitting || form.title.trim().length === 0 || form.assigneeUserIds.length === 0}
              style={{
                paddingHorizontal: 18,
                height: 42,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isSubmitting || form.title.trim().length === 0 || form.assigneeUserIds.length === 0
                  ? colors.border.medium
                  : colors.text.primary,
              }}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.bg.primary} />
              ) : (
                <Text style={{ color: colors.bg.primary, fontWeight: '500' }}>Create Task</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function TaskActivityFeed({ businessId, taskId, task, teamMembers, compact = false }: TaskActivityFeedProps) {
  const colors = useThemeColors();
  const themeMode = useResolvedThemeMode();
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.currentUser?.id ?? null);
  const teamMap = useMemo(() => new Map(teamMembers.map((member) => [member.id, member])), [teamMembers]);
  const mentionAliasMap = useMemo(() => buildMentionAliasMap(teamMembers), [teamMembers]);
  const [messageText, setMessageText] = useState('');
  const [replyTarget, setReplyTarget] = useState<CollaborationComment | null>(null);
  const [activeTab, setActiveTab] = useState<'comments' | 'activity'>('comments');
  const uiLabelTextStyle = { fontSize: 12, fontWeight: '600' as const };
  const metaTextStyle = { fontSize: 12, fontWeight: '500' as const };
  const bodyTextStyle = { fontSize: 14, fontWeight: '500' as const, lineHeight: 20 };
  const activeMentionQuery = useMemo(() => {
    const match = messageText.match(/(^|\s)@([A-Za-z0-9_.-]*)$/);
    return match ? match[2].toLowerCase() : null;
  }, [messageText]);
  const filteredMentionMembers = useMemo(() => {
    if (activeMentionQuery === null) return [];
    return teamMembers
      .filter((member) => {
        const handle = mentionHandleFromMember(member);
        return (
          member.name.toLowerCase().includes(activeMentionQuery)
          || member.email.toLowerCase().includes(activeMentionQuery)
          || member.id.toLowerCase().includes(activeMentionQuery)
          || handle.includes(activeMentionQuery)
        );
      })
      .slice(0, 5);
  }, [activeMentionQuery, teamMembers]);

  const threadQuery = useQuery({
    queryKey: ['task-thread', businessId, taskId],
    enabled: Boolean(businessId) && Boolean(taskId),
    queryFn: () => collaborationData.getOrCreateThread(businessId, 'task', taskId),
    retry: 0,
  });

  const threadId = threadQuery.data?.id ?? null;

  const commentsQuery = useQuery({
    queryKey: ['task-thread-comments', businessId, threadId],
    enabled: Boolean(businessId) && Boolean(threadId),
    queryFn: () => collaborationData.listThreadComments(businessId, threadId as string),
    retry: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!businessId || !threadId) return;

    const channel: RealtimeChannel = supabase
      .channel(`task-activity-${threadId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'collaboration_comments',
          filter: `thread_id=eq.${threadId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['task-thread-comments', businessId, threadId] });
          void queryClient.invalidateQueries({ queryKey: ['collaboration-thread-counts', businessId, 'task'] });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [businessId, queryClient, threadId]);

  const markSeenMutation = useMutation({
    mutationFn: async () => {
      if (!threadId) return;
      await collaborationData.markThreadAsSeen(businessId, threadId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['collaboration-thread-counts', businessId, 'task'] });
      await queryClient.invalidateQueries({ queryKey: ['collaboration-notifications-unread', businessId] });
    },
  });

  useEffect(() => {
    if (!threadId) return;
    markSeenMutation.mutate();
  }, [threadId]);

  const createCommentMutation = useMutation({
    mutationFn: async ({ body, parentCommentId }: { body: string; parentCommentId?: string | null }) => {
      if (!threadId) return;
      const mentionIds = Array.from(new Set(
        (body.match(/@([A-Za-z0-9_.-]+)/g) ?? [])
          .map((token) => normalizeMentionToken(token))
          .map((token) => mentionAliasMap.get(token))
          .filter((id): id is string => Boolean(id))
      ));

      await collaborationData.createComment({
        businessId,
        threadId,
        body,
        parentCommentId: parentCommentId ?? null,
        mentionUserIds: mentionIds,
      });
    },
    onSuccess: async () => {
      setMessageText('');
      setReplyTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['task-thread-comments', businessId, threadId] });
      await queryClient.invalidateQueries({ queryKey: ['collaboration-thread-counts', businessId, 'task'] });
      await queryClient.invalidateQueries({ queryKey: ['collaboration-notifications-unread', businessId] });
      markSeenMutation.mutate();
    },
  });

  const comments = commentsQuery.data ?? [];
  const activityEntries = useMemo(() => {
    const entries: Array<{ id: string; label: string; at: string; tone?: 'neutral' | 'success' }> = [];
    const createdByName = teamMap.get(task.created_by)?.name?.trim();
    const updatedByName = task.last_updated_by ? teamMap.get(task.last_updated_by)?.name?.trim() : '';
    const completedByUserId = task.completed_by ?? task.last_updated_by ?? null;
    const completedByName = completedByUserId ? teamMap.get(completedByUserId)?.name?.trim() : '';

    entries.push({
      id: `created-${task.id}`,
      label: createdByName ? `${createdByName} created this task` : 'Task created',
      at: task.created_at,
      tone: 'neutral',
    });

    const shouldShowUpdatedEntry = Boolean(
      task.updated_at
      && task.updated_at !== task.created_at
      && (!task.completed_at || task.updated_at !== task.completed_at)
    );
    if (shouldShowUpdatedEntry) {
      entries.push({
        id: `updated-${task.id}`,
        label: updatedByName ? `${updatedByName} updated this task` : 'Task updated',
        at: task.updated_at,
        tone: 'neutral',
      });
    }
    if (task.completed_at) {
      entries.push({
        id: `completed-${task.id}`,
        label: completedByName ? `${completedByName} marked this task complete` : 'Task marked complete',
        at: task.completed_at,
        tone: 'success',
      });
    }
    comments.forEach((comment) => {
      const member = teamMap.get(comment.author_user_id);
      entries.push({
        id: `comment-${comment.id}`,
        label: `${member?.name?.split(' ')[0] ?? 'Team member'} commented`,
        at: comment.created_at,
        tone: 'neutral',
      });
    });

    return entries.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }, [
    comments,
    task.completed_at,
    task.completed_by,
    task.created_at,
    task.created_by,
    task.id,
    task.last_updated_by,
    task.updated_at,
    teamMap,
  ]);

  const activitySurface = themeMode === 'light' ? '#FFFFFF' : colors.bg.secondary;
  const commentBubbleBg = themeMode === 'light' ? '#EEF0F3' : 'rgba(148,163,184,0.14)';
  const composerBorderColor = themeMode === 'light' ? '#D1D5DB' : colors.input.border;
  const sectionHorizontalPadding = compact ? 18 : 0;
  const contentColumnHorizontalPadding = compact ? 0 : 14;
  const hasMessage = messageText.trim().length > 0;
  const activeSendButtonBg = themeMode === 'dark' ? '#FFFFFF' : '#111827';
  const activeSendIconColor = themeMode === 'dark' ? '#111827' : '#FFFFFF';
  const disabledSendIconColor = themeMode === 'dark' ? '#0F172A' : '#FFFFFF';
  const sendIconColor = hasMessage ? activeSendIconColor : disabledSendIconColor;
  const sendSpinnerColor = sendIconColor;

  return (
    <View style={{ flex: 1, minHeight: compact ? 360 : undefined, borderTopWidth: 0.5, borderTopColor: colors.border.light, backgroundColor: activitySurface }}>
      <View style={{ paddingHorizontal: sectionHorizontalPadding, paddingTop: 12, backgroundColor: activitySurface }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border.light, paddingHorizontal: contentColumnHorizontalPadding }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 18 }}>
            <Pressable
              onPress={() => setActiveTab('comments')}
              style={{ paddingBottom: 10, marginBottom: -1, borderBottomWidth: activeTab === 'comments' ? 3 : 0, borderBottomColor: colors.text.secondary }}
            >
              <Text style={{ color: activeTab === 'comments' ? colors.text.primary : colors.text.tertiary, fontSize: 12, fontWeight: activeTab === 'comments' ? '600' : '500' }}>
                Comments
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('activity')}
              style={{ paddingBottom: 10, marginBottom: -1, borderBottomWidth: activeTab === 'activity' ? 3 : 0, borderBottomColor: colors.text.secondary }}
            >
              <Text style={{ color: activeTab === 'activity' ? colors.text.primary : colors.text.tertiary, fontSize: 12, fontWeight: activeTab === 'activity' ? '600' : '500' }}>
                All activity
              </Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 10 }}>
            <ArrowUpDown size={14} color={colors.text.tertiary} strokeWidth={2.2} />
            <Text style={{ color: colors.text.tertiary, fontSize: 12, fontWeight: '600' }}>
              Oldest
            </Text>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1, backgroundColor: activitySurface }} contentContainerStyle={{ paddingHorizontal: sectionHorizontalPadding, paddingTop: 22, paddingBottom: 16, gap: 14 }}>
        {activeTab === 'comments' && (threadQuery.isPending || commentsQuery.isPending) ? (
          <Text style={{ color: colors.text.tertiary, fontSize: 12, fontWeight: '600', textAlign: 'center', paddingVertical: 24, paddingHorizontal: contentColumnHorizontalPadding }}>
            Loading activity...
          </Text>
        ) : null}
        {activeTab === 'comments' && (threadQuery.isError || commentsQuery.isError) ? (
          <Text style={{ color: '#B91C1C', fontSize: 12, fontWeight: '600', textAlign: 'center', paddingVertical: 12, paddingHorizontal: contentColumnHorizontalPadding }}>
            Could not load activity right now.
          </Text>
        ) : null}
        {activeTab === 'comments' && comments.length === 0 ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 44, paddingHorizontal: contentColumnHorizontalPadding }}>
            <Text style={{ color: colors.text.secondary, fontSize: 14, fontWeight: '600' }}>No updates yet</Text>
            <Text style={{ color: colors.text.tertiary, marginTop: 4, ...metaTextStyle }}>
              Add an update, ask for status, or mention someone.
            </Text>
          </View>
        ) : null}
        {activeTab === 'comments' ? (
          comments.map((comment) => {
            const author = teamMap.get(comment.author_user_id);
            const replyTo = comment.parent_comment_id
              ? comments.find((item) => item.id === comment.parent_comment_id)
              : null;
            const isOwn = comment.author_user_id === currentUserId;
            const ownBubbleBg = themeMode === 'light' ? '#1C1C1E' : 'rgba(255,255,255,0.12)';

            return (
              <View key={comment.id} style={{ flexDirection: isOwn ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: contentColumnHorizontalPadding }}>
                {!isOwn && (
                  <View style={{ paddingTop: 2 }}>
                    <UserAvatar member={author} size={26} />
                  </View>
                )}
                <View style={{ flex: 1, gap: 4, alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                  <View style={{ flexDirection: isOwn ? 'row-reverse' : 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {!isOwn && (
                      <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '600' }}>
                        {author?.name ?? 'Member'}
                      </Text>
                    )}
                    <Text style={{ color: colors.text.tertiary, ...metaTextStyle }}>
                      {formatMessageTime(comment.created_at)}
                    </Text>
                  </View>

                  {replyTo ? (
                    <Text style={{ color: colors.text.tertiary, ...metaTextStyle }} numberOfLines={1}>
                      Replying to {teamMap.get(replyTo.author_user_id)?.name ?? 'member'}: {replyTo.body}
                    </Text>
                  ) : null}

                  <View style={{ alignSelf: isOwn ? 'flex-end' : 'flex-start', maxWidth: '86%', borderRadius: 12, backgroundColor: isOwn ? ownBubbleBg : commentBubbleBg, paddingHorizontal: 10, paddingVertical: 8 }}>
                    <Text style={{ color: isOwn ? (themeMode === 'light' ? '#FFFFFF' : colors.text.primary) : colors.text.secondary, ...bodyTextStyle }}>
                      {comment.body}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Pressable onPress={() => setReplyTarget(comment)}>
                      <Text style={{ color: colors.text.tertiary, ...uiLabelTextStyle }}>Reply</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })
        ) : null}

        {activeTab === 'activity' ? (
          activityEntries.length > 0 ? (
            activityEntries.map((entry) => {
              const isSuccess = entry.tone === 'success';
              return (
                <View key={entry.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border.light, paddingBottom: 10, paddingHorizontal: contentColumnHorizontalPadding }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isSuccess ? '#10B981' : colors.text.muted }} />
                    <Text style={{ color: colors.text.secondary, fontSize: 12, fontWeight: '500' }} numberOfLines={1}>
                      {entry.label}
                    </Text>
                  </View>
                  <Text style={{ color: colors.text.muted, ...metaTextStyle }}>
                    {formatMessageTime(entry.at)}
                  </Text>
                </View>
              );
            })
          ) : (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 44, paddingHorizontal: contentColumnHorizontalPadding }}>
              <Text style={{ color: colors.text.secondary, fontSize: 14, fontWeight: '600' }}>No activity yet</Text>
            </View>
          )
        ) : null}
      </ScrollView>

      {activeTab === 'comments' ? (
      <View style={{ borderTopWidth: 1, borderTopColor: colors.border.light, paddingHorizontal: sectionHorizontalPadding, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 20 : 12, backgroundColor: activitySurface }}>
        <View style={{ paddingHorizontal: contentColumnHorizontalPadding }}>
          {activeMentionQuery !== null ? (
            <View
              style={{
                marginBottom: 8,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border.light,
                backgroundColor: colors.bg.secondary,
                overflow: 'hidden',
              }}
            >
              {filteredMentionMembers.length === 0 ? (
                <View style={{ paddingHorizontal: 12, paddingVertical: 9 }}>
                  <Text style={{ color: colors.text.muted, fontSize: 12, fontWeight: '500' }}>
                    No team member match.
                  </Text>
                </View>
              ) : (
                filteredMentionMembers.map((member) => {
                  const handle = mentionHandleFromMember(member);
                  return (
                    <Pressable
                      key={`task-mention-match-${member.id}`}
                      onPress={() => {
                        setMessageText((current) =>
                          current.replace(/(^|\s)@([A-Za-z0-9_.-]*)$/, (_full, prefix) => `${prefix}@${handle} `)
                        );
                      }}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 9,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <UserAvatar member={member} size={20} />
                      <Text style={{ color: colors.text.primary, fontSize: 12, fontWeight: '600' }}>
                        @{handle}
                      </Text>
                      <Text style={{ color: colors.text.muted, fontSize: 12, fontWeight: '500', flex: 1 }} numberOfLines={1}>
                        {member.name}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </View>
          ) : null}
          {replyTarget ? (
            <View style={{ marginBottom: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.bg.secondary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.text.secondary, flex: 1, ...uiLabelTextStyle }} numberOfLines={1}>
                Replying to {teamMap.get(replyTarget.author_user_id)?.name ?? 'member'}
              </Text>
              <Pressable onPress={() => setReplyTarget(null)}>
                <X size={13} color={colors.text.tertiary} strokeWidth={2.3} />
              </Pressable>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TextInput
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Type an update or reply..."
              placeholderTextColor={colors.input.placeholder}
              style={{
                flex: 1,
                minHeight: 44,
                maxHeight: 110,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: composerBorderColor,
                backgroundColor: colors.input.bg,
                color: colors.input.text,
                paddingHorizontal: 14,
                paddingVertical: 10,
                fontSize: 14,
                fontWeight: '500',
              }}
              multiline
              selectionColor={colors.text.primary}
            />
            <Pressable
              onPress={() => {
                const trimmed = messageText.trim();
                if (!trimmed || createCommentMutation.isPending) return;
                createCommentMutation.mutate({
                  body: trimmed,
                  parentCommentId: replyTarget?.id ?? null,
                });
              }}
              disabled={!hasMessage || createCommentMutation.isPending}
              style={{
                width: 40,
                height: 40,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: hasMessage ? activeSendButtonBg : colors.border.medium,
              }}
            >
              {createCommentMutation.isPending ? (
                <ActivityIndicator color={sendSpinnerColor} size="small" />
              ) : (
                <Send size={15} color={sendIconColor} strokeWidth={2.6} />
              )}
            </Pressable>
          </View>
        </View>
      </View>
      ) : null}
    </View>
  );
}

function TaskCard({
  task,
  selected,
  unreadCount,
  commentCount,
  assignees,
  onSelect,
  onToggleDone,
}: {
  task: Task;
  selected: boolean;
  unreadCount: number;
  commentCount: number;
  assignees: TeamMember[];
  onSelect: () => void;
  onToggleDone: () => void;
}) {
  const colors = useThemeColors();
  const themeMode = useResolvedThemeMode();
  const isCompleted = task.status === 'done';
  const overdue = isTaskOverdue(task);
  const displayTitle = toSentenceCase(task.title);
  const recurrenceText = recurrenceLabel(task.recurrence_frequency as unknown as string | null);
  const recurrenceBaseTone = recurrenceTone(task.recurrence_frequency as unknown as string | null);
  const recurrenceChipTone = isCompleted
    ? { text: colors.text.muted, background: colors.bg.secondary }
    : recurrenceBaseTone;
  const visibleAssignees = assignees.slice(0, 2);
  const additionalAssigneeCount = assignees.length > visibleAssignees.length ? assignees.length - visibleAssignees.length : 0;
  const assigneeLine = assignees.length > 0
    ? visibleAssignees.map((member) => member.name.split(' ')[0] ?? member.name).join(', ')
    : 'Unassigned';
  const dueText = task.due_date ? format(parseISO(task.due_date), 'MMM d') : 'No due date';
  const cardBackgroundColor = isCompleted ? colors.bg.secondary : colors.bg.card;
  const cardBorderColor = isCompleted ? 'rgba(148,163,184,0.18)' : colors.border.light;
  const cardBorderWidth = isCompleted ? 0.6 : 1;
  const completedCheckColor = colors.text.muted;
  const pendingCheckOutlineColor = themeMode === 'light' ? 'rgba(100,116,139,0.42)' : 'rgba(148,163,184,0.52)';
  const assigneeChipBg = isCompleted ? colors.bg.primary : colors.bg.secondary;
  const assigneeChipTextColor = isCompleted ? colors.text.muted : colors.text.secondary;
  const assigneeChipTextStyle = { color: assigneeChipTextColor, fontSize: 11, fontWeight: '500' as const };
  const priorityFlagColor = (() => {
    if (isCompleted) return colors.text.muted;
    if (task.priority === 'urgent' || task.priority === 'high') return '#DC2626';
    if (task.priority === 'medium') return '#D97706';
    return '#2563EB';
  })();
  const selectedBorderColor = selected ? '#BFDBFE' : cardBorderColor;

  return (
    <Pressable
      onPress={onSelect}
      style={{
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 14,
        backgroundColor: cardBackgroundColor,
        borderWidth: cardBorderWidth,
        borderColor: selectedBorderColor,
        shadowColor: selected ? '#1D4ED8' : '#000000',
        shadowOpacity: selected ? 0.08 : 0,
        shadowRadius: selected ? 8 : 0,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable
          onPress={onToggleDone}
          hitSlop={8}
          style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}
        >
          {isCompleted ? (
            <CheckCircle2 size={22} color={completedCheckColor} strokeWidth={2.1} />
          ) : (
            <Circle size={22} color={pendingCheckOutlineColor} strokeWidth={2.1} />
          )}
        </Pressable>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              color: task.status === 'done' ? colors.text.muted : colors.text.primary,
              fontSize: 15,
              fontWeight: '500',
              textDecorationLine: task.status === 'done' ? 'line-through' : 'none',
            }}
            numberOfLines={2}
          >
            {displayTitle}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <View
              style={{
                maxWidth: '72%',
                flexShrink: 1,
                borderRadius: 999,
                paddingHorizontal: 8,
                paddingVertical: 4,
                backgroundColor: assigneeChipBg,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 2 }}>
                {visibleAssignees.length > 0 ? (
                  visibleAssignees.map((member, index) => (
                    <View
                      key={`${task.id}-${member.id}`}
                      style={{
                        marginLeft: index === 0 ? 0 : -6,
                        borderWidth: 1,
                        borderColor: assigneeChipBg,
                        borderRadius: 999,
                      }}
                    >
                      <UserAvatar member={member} size={16} />
                    </View>
                  ))
                ) : (
                  <UserAvatar name="Unassigned" size={16} />
                )}
              </View>
              <Text style={{ ...assigneeChipTextStyle, flexShrink: 1 }} numberOfLines={1}>
                {assigneeLine}
              </Text>
              {additionalAssigneeCount > 0 ? (
                <Text style={assigneeChipTextStyle}>
                  +{additionalAssigneeCount}
                </Text>
              ) : null}
            </View>
            <Text style={{ color: colors.text.muted, fontSize: 11, fontWeight: '500' }}>•</Text>
            <Text style={{ color: isCompleted ? colors.text.muted : (overdue ? '#B91C1C' : colors.text.tertiary), fontSize: 11, fontWeight: '500' }} numberOfLines={1}>
              {dueText}
            </Text>
          </View>
        </View>

        <View style={{ alignItems: 'flex-end', gap: 8 }}>
          <View
            style={{
              borderRadius: 999,
              paddingHorizontal: 8,
              paddingVertical: 4,
              backgroundColor: recurrenceChipTone.background,
            }}
          >
            <Text style={{ color: recurrenceChipTone.text, fontSize: 11, fontWeight: '600' }}>
              {recurrenceText}
            </Text>
          </View>
          <View style={{ width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}>
            <Flag size={13} color={priorityFlagColor} strokeWidth={2.3} />
          </View>
        </View>
      </View>

      {unreadCount > 0 ? (
        <View style={{ position: 'absolute', right: 8, top: 8, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DC2626', paddingHorizontal: 4 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function TaskTableRow({
  task,
  selected,
  unreadCount,
  commentCount,
  assignees,
  showActivityColumn,
  onSelect,
  onToggleDone,
}: {
  task: Task;
  selected: boolean;
  unreadCount: number;
  commentCount: number;
  assignees: TeamMember[];
  showActivityColumn: boolean;
  onSelect: () => void;
  onToggleDone: () => void;
}) {
  const colors = useThemeColors();
  const themeMode = useResolvedThemeMode();
  const isCompleted = task.status === 'done';
  const priority = PRIORITY_META[task.priority];
  const overdue = isTaskOverdue(task);
  const dueLabel = task.due_date ? format(parseISO(task.due_date), 'MMM d, yyyy') : 'No due date';
  const displayTitle = task.title.length > 0
    ? `${task.title.charAt(0).toUpperCase()}${task.title.slice(1)}`
    : task.title;
  const frequencyText = recurrenceLabel(task.recurrence_frequency as unknown as string | null);
  const frequencyTone = recurrenceTone(task.recurrence_frequency as unknown as string | null);

  const statusTone = (() => {
    if (task.status === 'done') {
      return { text: '#10B981', background: 'rgba(16,185,129,0.10)' };
    }
    if (task.status === 'in_progress') {
      return { text: '#2563EB', background: 'rgba(37,99,235,0.11)' };
    }
    return { text: '#F59E0B', background: 'rgba(245,158,11,0.11)' };
  })();
  const rowBackgroundColor = isCompleted
    ? (selected ? 'rgba(148,163,184,0.20)' : colors.bg.secondary)
    : (selected ? 'rgba(59,130,246,0.08)' : colors.bg.card);
  const completedCheckColor = colors.text.primary;
  const pendingCheckOutlineColor = themeMode === 'light' ? 'rgba(100,116,139,0.42)' : 'rgba(148,163,184,0.52)';
  const firstAssignee = assignees[0];
  const additionalAssigneeCount = assignees.length > 1 ? assignees.length - 1 : 0;
  const isCompactTable = !showActivityColumn;
  const nameColumnFlex = isCompactTable ? 3.2 : 1.9;
  const priorityColumnWidth = isCompactTable ? 82 : 110;
  const assigneeColumnWidth = isCompactTable ? 136 : 170;
  const dueColumnWidth = isCompactTable ? 108 : 126;
  const frequencyColumnWidth = isCompactTable ? 92 : 108;
  const statusColumnWidth = isCompactTable ? 94 : 118;
  const assigneeDisplayName = firstAssignee
    ? (isCompactTable ? (firstAssignee.name.split(' ')[0] ?? firstAssignee.name) : firstAssignee.name)
    : '';

  return (
    <Pressable
      onPress={onSelect}
      style={{
        minHeight: 62,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: colors.border.light,
        backgroundColor: rowBackgroundColor,
      }}
    >
      <View style={{ flex: nameColumnFlex, minWidth: 0, paddingLeft: 12, paddingRight: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable onPress={onToggleDone} hitSlop={6}>
          {task.status === 'done' ? (
            <CheckCircle2 size={18} color={completedCheckColor} strokeWidth={2.3} />
          ) : (
            <Circle size={18} color={pendingCheckOutlineColor} strokeWidth={2.1} />
          )}
        </Pressable>
        <Text
          numberOfLines={1}
          style={{
            color: task.status === 'done' ? colors.text.muted : colors.text.primary,
            fontSize: 12,
            fontWeight: '400',
            textDecorationLine: task.status === 'done' ? 'line-through' : 'none',
            flex: 1,
          }}
        >
          {displayTitle}
        </Text>
        {isCompactTable && unreadCount > 0 ? (
          <View style={{ minWidth: 18, height: 18, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DC2626', paddingHorizontal: 4, flexShrink: 0 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
          </View>
        ) : isCompactTable && commentCount > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 0 }}>
            <MessageSquare size={11} color={colors.text.muted} strokeWidth={2} />
            <Text style={{ color: colors.text.muted, fontSize: 11, fontWeight: '400' }}>{commentCount}</Text>
          </View>
        ) : null}
      </View>

      <View style={{ width: priorityColumnWidth, paddingRight: 8 }}>
        <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: priority.soft, alignSelf: 'flex-start' }}>
          <Text style={{ color: priority.color, fontSize: 11, fontWeight: '500' }}>{priority.label}</Text>
        </View>
      </View>

      <View style={{ width: assigneeColumnWidth, paddingRight: 8 }}>
        {firstAssignee ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <UserAvatar member={firstAssignee} size={18} />
            <Text style={{ color: colors.text.secondary, fontSize: isCompactTable ? 13 : 14, fontWeight: '400', flexShrink: 1 }} numberOfLines={1}>
              {assigneeDisplayName}
            </Text>
            {additionalAssigneeCount > 0 ? (
              <Text style={{ color: colors.text.tertiary, fontSize: isCompactTable ? 11 : 12, fontWeight: '500' }}>
                +{additionalAssigneeCount}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text style={{ color: colors.text.secondary, fontSize: 14, fontWeight: '400' }} numberOfLines={1}>
            Unassigned
          </Text>
        )}
      </View>

      <View style={{ width: dueColumnWidth, paddingRight: 8 }}>
        <Text style={{ color: overdue ? '#B91C1C' : colors.text.secondary, fontSize: 12, fontWeight: '400' }} numberOfLines={1}>
          {dueLabel}
        </Text>
      </View>

      <View style={{ width: frequencyColumnWidth, paddingRight: 8 }}>
        <View style={{ borderRadius: 999, backgroundColor: frequencyTone.background, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ color: frequencyTone.text, fontSize: 11, fontWeight: '500' }}>
            {frequencyText}
          </Text>
        </View>
      </View>

      <View style={{ width: statusColumnWidth, paddingRight: 8 }}>
        <View style={{ borderRadius: 999, backgroundColor: statusTone.background, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ color: statusTone.text, fontSize: 11, fontWeight: '500' }}>
            {statusLabel(task.status)}
          </Text>
        </View>
      </View>

      {showActivityColumn ? (
        <View style={{ width: 104, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 6, paddingRight: 10 }}>
          <MessageSquare size={12} color={colors.text.muted} strokeWidth={2} />
          <Text style={{ color: colors.text.muted, fontSize: 12, fontWeight: '400' }}>
            {commentCount}
          </Text>
          {unreadCount > 0 ? (
            <View style={{ minWidth: 18, height: 18, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DC2626', paddingHorizontal: 4 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

function TaskDetailPanel({
  task,
  businessId,
  teamMembers,
  currentUserId,
  commentCount = 0,
  onSaved,
  onDeleted,
  onStatusChange,
  onClose,
}: {
  task: Task;
  businessId: string;
  teamMembers: TeamMember[];
  currentUserId?: string | null;
  commentCount?: number;
  onSaved: () => Promise<void>;
  onDeleted: () => Promise<void>;
  onStatusChange: (next: 'todo' | 'in_progress' | 'done') => Promise<void>;
  onClose?: () => void;
}) {
  const colors = useThemeColors();
  const themeMode = useResolvedThemeMode();
  const { isDesktop } = useBreakpoint();
  const isMobileDetail = !isDesktop;
  const showBackButton = isMobileDetail && Boolean(onClose);
  const showCloseButton = isDesktop && Boolean(onClose);
  const [isEditing, setIsEditing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [showDetailActionMenu, setShowDetailActionMenu] = useState(false);
  const [form, setForm] = useState<TaskFormState>(toTaskFormState(task));
  const formFieldBorder = colors.border.light;
  const formFieldBg = colors.bg.card;

  useEffect(() => {
    setForm(toTaskFormState(task));
    setIsEditing(false);
    setShowEditModal(false);
    setShowEditDatePicker(false);
    setShowDetailActionMenu(false);
  }, [task.id, task.updated_at]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const previousAssignees = new Set((task.assignee_user_ids ?? []).map((value) => value.trim()).filter(Boolean));
      const normalizedNextAssignees = Array.from(
        new Set(form.assigneeUserIds.map((value) => value.trim()).filter(Boolean))
      );
      const newlyAssignedUserIds = normalizedNextAssignees.filter((userId) => !previousAssignees.has(userId));
      const payload: UpdateTaskInput = {
        title: form.title,
        description: form.description,
        priority: form.priority,
        dueDate: form.dueDate ? format(form.dueDate, 'yyyy-MM-dd') : null,
        assigneeUserIds: form.assigneeUserIds,
        recurrenceFrequency: form.recurrenceFrequency,
        recurrenceInterval: form.recurrenceInterval,
      };
      await taskData.updateTask(businessId, task.id, payload);
      return {
        newlyAssignedUserIds,
        updatedTitle: form.title.trim(),
        updatedDueDate: form.dueDate ? format(form.dueDate, 'yyyy-MM-dd') : null,
      };
    },
    onSuccess: async (result) => {
      if (result.newlyAssignedUserIds.length > 0) {
        void sendTaskAssignmentNotification({
          businessId,
          recipientUserIds: result.newlyAssignedUserIds,
          senderUserId: currentUserId ?? null,
          assignerName: teamMembers.find((member) => member.id === currentUserId)?.name ?? null,
          taskId: task.id,
          taskTitle: result.updatedTitle || task.title,
          dueDate: result.updatedDueDate,
          isReassignment: true,
        });
      }
      setIsEditing(false);
      setShowEditModal(false);
      await onSaved();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await taskData.deleteTask(businessId, task.id);
    },
    onSuccess: async () => {
      await onDeleted();
    },
  });

  const assigneeMap = new Map(teamMembers.map((member) => [member.id, member]));
  const taskAssignees = (task.assignee_user_ids ?? [])
    .map((id) => assigneeMap.get(id))
    .filter(Boolean) as TeamMember[];
  const taskPriorityMeta = PRIORITY_META[task.priority];
  const taskStatusTone = (() => {
    if (task.status === 'done') {
      return { text: '#10B981', background: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.20)' };
    }
    if (task.status === 'in_progress') {
      return { text: '#2563EB', background: 'rgba(37,99,235,0.10)', border: 'rgba(37,99,235,0.20)' };
    }
    return { text: '#F59E0B', background: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.20)' };
  })();
  const taskFrequencyTone = recurrenceTone(task.recurrence_frequency as unknown as string | null);
  const taskFrequencyLabel = recurrenceLabel(task.recurrence_frequency as unknown as string | null);
  const displayTaskTitle = task.title.length > 0
    ? `${task.title.charAt(0).toUpperCase()}${task.title.slice(1)}`
    : task.title;
  const displayTaskDescription = task.description.length > 0
    ? `${task.description.charAt(0).toUpperCase()}${task.description.slice(1)}`
    : task.description;
  const infoSurface = themeMode === 'light' ? '#FFFFFF' : colors.bg.card;
  const detailCardStyle = {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: formFieldBorder,
    backgroundColor: formFieldBg,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
  } as const;
  const detailLabelStyle = {
    color: colors.text.muted,
    fontSize: isMobileDetail ? 13 : 11,
    fontWeight: '400' as const,
  };
  const detailValueStyle = {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: isMobileDetail ? '500' as const : '400' as const,
  };
  const detailValuePrimaryStyle = {
    color: colors.text.primary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: isMobileDetail ? '500' as const : '400' as const,
  };
  const detailHintStyle = {
    color: colors.text.tertiary,
    fontSize: isMobileDetail ? 13 : 11,
    fontWeight: '400' as const,
  };
  const detailChipTextStyle = {
    fontSize: isMobileDetail ? 13 : 11,
    fontWeight: isMobileDetail ? '500' as const : '400' as const,
  };
  const detailHeaderHorizontalPadding = isMobileDetail ? 16 : 0;
  const detailBodyHorizontalPadding = isMobileDetail ? 20 : 0;
  const renderEditForm = (onCancel: () => void, options?: { stretch?: boolean }) => (
    <>
      <ScrollView
        style={options?.stretch ? { flex: 1 } : undefined}
        contentContainerStyle={{ padding: TASK_MODAL_BODY_PADDING, gap: TASK_MODAL_BODY_GAP }}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text style={{ color: colors.text.tertiary, fontSize: 11, fontWeight: '500', marginBottom: 6 }}>Task title</Text>
          <TextInput
            value={form.title}
            onChangeText={(value) => setForm((current) => ({ ...current, title: value }))}
            placeholder="What needs to be done?"
            placeholderTextColor={colors.input.placeholder}
            style={{
              backgroundColor: formFieldBg,
              borderWidth: 1,
              borderColor: formFieldBorder,
              color: colors.input.text,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 14,
              fontWeight: '400',
            }}
            selectionColor={colors.text.primary}
          />
        </View>

        {isMobileDetail ? (
          <View>
            <Text style={{ color: colors.text.tertiary, fontSize: 11, fontWeight: '500', marginBottom: 6 }}>Due date</Text>
            {Platform.OS === 'web' ? (
              <View
                style={{
                  minHeight: 46,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: formFieldBorder,
                  backgroundColor: formFieldBg,
                  paddingHorizontal: 12,
                  alignItems: 'center',
                  flexDirection: 'row',
                }}
              >
                <Calendar size={15} color={colors.text.tertiary} strokeWidth={2} />
                <input
                  type="date"
                  value={form.dueDate ? format(form.dueDate, 'yyyy-MM-dd') : ''}
                  onChange={(event: any) => {
                    const next = String(event?.target?.value ?? '');
                    if (!next) {
                      setForm((current) => ({ ...current, dueDate: null }));
                      return;
                    }
                    const parsed = parseISO(`${next}T00:00:00`);
                    if (!Number.isNaN(parsed.getTime())) {
                      setForm((current) => ({ ...current, dueDate: parsed }));
                    }
                  }}
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    color: colors.input.text,
                    marginLeft: 10,
                    fontSize: 13,
                    fontWeight: 400,
                    fontFamily: 'inherit',
                    colorScheme: themeMode === 'dark' ? 'dark' : 'light',
                  }}
                />
              </View>
            ) : (
              <Pressable
                onPress={() => setShowEditDatePicker((current) => !current)}
                style={{
                  minHeight: 46,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: formFieldBorder,
                  backgroundColor: formFieldBg,
                  paddingHorizontal: 12,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={{ color: colors.input.text, fontSize: 13, fontWeight: '400' }}>
                  {form.dueDate ? format(form.dueDate, 'yyyy-MM-dd') : 'Set date'}
                </Text>
                <Calendar size={15} color={colors.text.tertiary} strokeWidth={2} />
              </Pressable>
            )}
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text.tertiary, fontSize: 11, fontWeight: '500', marginBottom: 6 }}>Due date</Text>
              {Platform.OS === 'web' ? (
                <View
                  style={{
                    minHeight: 46,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: formFieldBorder,
                    backgroundColor: formFieldBg,
                    paddingHorizontal: 12,
                    alignItems: 'center',
                    flexDirection: 'row',
                  }}
                >
                  <Calendar size={15} color={colors.text.tertiary} strokeWidth={2} />
                  <input
                    type="date"
                    value={form.dueDate ? format(form.dueDate, 'yyyy-MM-dd') : ''}
                    onChange={(event: any) => {
                      const next = String(event?.target?.value ?? '');
                      if (!next) {
                        setForm((current) => ({ ...current, dueDate: null }));
                        return;
                      }
                      const parsed = parseISO(`${next}T00:00:00`);
                      if (!Number.isNaN(parsed.getTime())) {
                        setForm((current) => ({ ...current, dueDate: parsed }));
                      }
                    }}
                    style={{
                      flex: 1,
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      color: colors.input.text,
                      marginLeft: 10,
                      fontSize: 13,
                      fontWeight: 400,
                      fontFamily: 'inherit',
                      colorScheme: themeMode === 'dark' ? 'dark' : 'light',
                    }}
                  />
                </View>
              ) : (
                <Pressable
                  onPress={() => setShowEditDatePicker((current) => !current)}
                  style={{
                    minHeight: 46,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: formFieldBorder,
                    backgroundColor: formFieldBg,
                    paddingHorizontal: 12,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text style={{ color: colors.input.text, fontSize: 13, fontWeight: '400' }}>
                    {form.dueDate ? format(form.dueDate, 'yyyy-MM-dd') : 'Set date'}
                  </Text>
                  <Calendar size={15} color={colors.text.tertiary} strokeWidth={2} />
                </Pressable>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text.tertiary, fontSize: 11, fontWeight: '500', marginBottom: 6 }}>Priority</Text>
              <PriorityDropdown value={form.priority} onChange={(priority) => setForm((current) => ({ ...current, priority }))} />
            </View>
          </View>
        )}

        {showEditDatePicker && Platform.OS !== 'web' ? (
          <DateTimePicker
            value={form.dueDate ?? startOfToday()}
            mode="date"
            minimumDate={startOfToday()}
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={(event: DateTimePickerEvent, value?: Date) => {
              if (event.type === 'dismissed') return;
              if (value) setForm((current) => ({ ...current, dueDate: value }));
              if (Platform.OS !== 'ios') setShowEditDatePicker(false);
            }}
          />
        ) : null}

        <View>
          <Text style={{ color: colors.text.tertiary, fontSize: 11, fontWeight: '500', marginBottom: 6 }}>Assignee</Text>
          <AssigneePicker
            teamMembers={teamMembers}
            selectedUserIds={form.assigneeUserIds}
            currentUserId={currentUserId}
            onToggleAssignee={(userId) =>
              setForm((current) => ({
                ...current,
                assigneeUserIds: current.assigneeUserIds.includes(userId)
                  ? current.assigneeUserIds.filter((id) => id !== userId)
                  : [...current.assigneeUserIds, userId],
              }))
            }
            placeholder="Select assignees"
          />
        </View>

        {isMobileDetail ? (
          <View>
            <Text style={{ color: colors.text.tertiary, fontSize: 11, fontWeight: '500', marginBottom: 6 }}>Recurring</Text>
            <RecurrenceDropdown
              value={form.recurrenceFrequency}
              onChange={(recurrenceFrequency) => setForm((current) => ({ ...current, recurrenceFrequency }))}
            />
          </View>
        ) : (
          <View>
            <Text style={{ color: colors.text.tertiary, fontSize: 11, fontWeight: '500', marginBottom: 6 }}>Recurring</Text>
            <RecurrenceDropdown
              value={form.recurrenceFrequency}
              onChange={(recurrenceFrequency) => setForm((current) => ({ ...current, recurrenceFrequency }))}
            />
          </View>
        )}

        {isMobileDetail ? (
          <View>
            <Text style={{ color: colors.text.tertiary, fontSize: 11, fontWeight: '500', marginBottom: 6 }}>Priority</Text>
            <PriorityPills
              value={form.priority}
              onChange={(priority) => setForm((current) => ({ ...current, priority }))}
            />
          </View>
        ) : null}

        <View>
          <Text style={{ color: colors.text.tertiary, fontSize: 11, fontWeight: '500', marginBottom: 6 }}>Details (optional)</Text>
          <TextInput
            value={form.description}
            onChangeText={(value) => setForm((current) => ({ ...current, description: value }))}
            multiline
            placeholder="Add any instructions for the assignee"
            placeholderTextColor={colors.input.placeholder}
            style={{
              minHeight: 92,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: formFieldBorder,
              backgroundColor: formFieldBg,
              color: colors.input.text,
              paddingHorizontal: 12,
              paddingTop: 10,
              textAlignVertical: 'top',
              fontWeight: '400',
            }}
            selectionColor={colors.text.primary}
          />
        </View>
      </ScrollView>

      <View
        style={{
          paddingHorizontal: TASK_MODAL_FOOTER_HORIZONTAL_PADDING,
          paddingBottom: TASK_MODAL_FOOTER_BOTTOM_PADDING,
          flexDirection: 'row',
          justifyContent: 'flex-end',
          gap: TASK_MODAL_FOOTER_GAP,
        }}
      >
        <Pressable onPress={onCancel} style={{ paddingHorizontal: 16, height: 42, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.secondary }}>
          <Text style={{ color: colors.text.secondary, fontWeight: '500' }}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || form.title.trim().length === 0 || form.assigneeUserIds.length === 0}
          style={{
            paddingHorizontal: 18,
            height: 42,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: saveMutation.isPending || form.title.trim().length === 0 || form.assigneeUserIds.length === 0
              ? colors.border.medium
              : colors.text.primary,
          }}
        >
          {saveMutation.isPending ? (
            <ActivityIndicator color={colors.bg.primary} />
          ) : (
            <Text style={{ color: colors.bg.primary, fontWeight: '500' }}>Save Changes</Text>
          )}
        </Pressable>
      </View>
    </>
  );

  const openTaskEditor = () => {
    setShowDetailActionMenu(false);
    if (isMobileDetail || Platform.OS === 'web') {
      setShowEditModal(true);
      return;
    }
    setIsEditing(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.card, overflow: 'hidden', position: 'relative' }}>
      <View
        style={{
          paddingHorizontal: isMobileDetail ? 0 : 18,
          paddingTop: 18,
          paddingBottom: 16,
          backgroundColor: colors.bg.primary,
          position: 'relative',
          zIndex: 120,
          elevation: 20,
        }}
      >
        {!isEditing ? (
          <View style={{ gap: 0 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                paddingHorizontal: detailHeaderHorizontalPadding,
                paddingBottom: 12,
                borderBottomWidth: 0.5,
                borderBottomColor: colors.border.light,
              }}
            >
              <View style={{ flex: 1, minWidth: 0, paddingTop: 2, paddingRight: 8 }}>
                {showBackButton ? (
                  <Pressable
                    onPress={() => {
                      setShowDetailActionMenu(false);
                      onClose?.();
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}
                  >
                    <ArrowLeft size={22} color={colors.text.primary} strokeWidth={2} />
                    <Text style={{ color: colors.text.primary, fontSize: 16, fontWeight: '700', lineHeight: 22, flex: 1 }} numberOfLines={1}>
                      Task Details
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={{ color: colors.text.primary, fontSize: 16, fontWeight: '500', lineHeight: 22, flex: 1 }}>
                    {displayTaskTitle}
                  </Text>
                )}
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, position: 'relative', zIndex: 130 }}>
                {!isMobileDetail && commentCount > 0 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.bg.secondary, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }}>
                    <MessageSquare size={12} color={colors.text.muted} strokeWidth={2} />
                    <Text style={{ color: colors.text.muted, fontSize: 11, fontWeight: '600' }}>{commentCount}</Text>
                  </View>
                ) : null}
                {isMobileDetail ? (
                  <Pressable
                    onPress={openTaskEditor}
                    style={{
                      height: 38,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: colors.border.light,
                      backgroundColor: colors.bg.card,
                      paddingHorizontal: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Pencil size={14} color={colors.text.secondary} strokeWidth={2.1} />
                    <Text style={{ color: colors.text.secondary, fontSize: 13, fontWeight: '600' }}>Edit</Text>
                  </Pressable>
                ) : null}
                <View style={{ position: 'relative', zIndex: 140 }}>
                  <Pressable
                    onPress={() => setShowDetailActionMenu((current) => !current)}
                    style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border.light, backgroundColor: colors.bg.card }}
                  >
                    <MoreVertical size={18} color={colors.text.secondary} strokeWidth={2} />
                  </Pressable>
                </View>
                {showCloseButton ? (
                  <Pressable
                    onPress={() => {
                      setShowDetailActionMenu(false);
                      onClose?.();
                    }}
                    style={{ width: 34, height: 34, borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border.light, backgroundColor: colors.bg.secondary }}
                  >
                    <X size={16} color={colors.text.secondary} strokeWidth={2.3} />
                  </Pressable>
                ) : null}
              </View>
            </View>

            <View style={{ paddingHorizontal: detailBodyHorizontalPadding, paddingTop: 12, paddingBottom: 10, gap: 8 }}>
              {isMobileDetail ? (
                <Text style={{ color: colors.text.primary, fontSize: 20, lineHeight: 25, fontWeight: '600' }}>
                  {displayTaskTitle}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Clock3 size={13} color={colors.text.tertiary} strokeWidth={2.2} />
                  <Text style={{ color: colors.text.tertiary, fontSize: isMobileDetail ? 13 : 12, fontWeight: '400' }}>
                    Updated {format(parseISO(task.updated_at), 'MMM d, yyyy')}
                  </Text>
                </View>
                {isTaskOverdue(task) ? (
                  <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(185,28,28,0.10)' }}>
                    <Text style={{ color: '#B91C1C', ...detailChipTextStyle }}>Overdue</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={{ marginTop: isMobileDetail ? 6 : 2, marginHorizontal: detailBodyHorizontalPadding, borderRadius: 8, borderWidth: 1, borderColor: colors.border.light, backgroundColor: infoSurface, overflow: 'hidden', position: 'relative', zIndex: 1 }}>
              <View style={{ minHeight: 50, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderBottomWidth: 1, borderBottomColor: colors.border.light }}>
                <Text style={[detailLabelStyle, { width: 92 }]}>Assignee</Text>
                <View style={{ flex: 1, alignItems: 'flex-end', minWidth: 0 }}>
                  {taskAssignees.length > 0 ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 6 }}>
                      {taskAssignees.map((member) => (
                        <View
                          key={member.id}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 5,
                            borderRadius: 999,
                            backgroundColor: colors.bg.secondary,
                            paddingHorizontal: 7,
                            paddingVertical: 4,
                          }}
                        >
                          <UserAvatar member={member} size={16} />
                          <Text style={{ color: colors.text.primary, fontSize: isMobileDetail ? 13 : 11, fontWeight: '500' }}>
                            {member.name}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={detailValuePrimaryStyle}>Unassigned</Text>
                  )}
                </View>
              </View>

              <View style={{ minHeight: 50, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderBottomWidth: 1, borderBottomColor: colors.border.light }}>
                <Text style={[detailLabelStyle, { width: 92 }]}>Due date</Text>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={detailValuePrimaryStyle}>
                    {formatDueDateLong(task.due_date)}
                  </Text>
                </View>
              </View>

              <View style={{ minHeight: 50, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderBottomWidth: 1, borderBottomColor: colors.border.light }}>
                <Text style={[detailLabelStyle, { width: 92 }]}>Status</Text>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Pressable
                    onPress={() => onStatusChange(task.status === 'done' ? 'todo' : 'done')}
                    style={{ borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: taskStatusTone.background, borderWidth: 1, borderColor: taskStatusTone.border }}
                  >
                    <Text style={{ color: taskStatusTone.text, ...detailChipTextStyle }}>
                      {statusLabel(task.status)}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={{ minHeight: 50, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderBottomWidth: 1, borderBottomColor: colors.border.light }}>
                <Text style={[detailLabelStyle, { width: 92 }]}>Priority</Text>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <View style={{ borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: taskPriorityMeta.soft }}>
                    <Text style={{ color: taskPriorityMeta.color, ...detailChipTextStyle }}>
                      {taskPriorityMeta.label}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={{ minHeight: 50, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderBottomWidth: 1, borderBottomColor: colors.border.light }}>
                <Text style={[detailLabelStyle, { width: 92 }]}>Frequency</Text>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <View style={{ borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: taskFrequencyTone.background }}>
                    <Text style={{ color: taskFrequencyTone.text, ...detailChipTextStyle }}>
                      {taskFrequencyLabel}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: isMobileDetail ? 20 : 12, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <Text style={[detailLabelStyle, { width: 92, paddingTop: 2 }]}>Description</Text>
                <Text style={[displayTaskDescription ? detailValuePrimaryStyle : detailHintStyle, { flex: 1, textAlign: 'right' }]}>
                  {displayTaskDescription || 'No additional context has been added yet.'}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          renderEditForm(() => setIsEditing(false))
        )}
      </View>

      <Modal
        visible={showDetailActionMenu}
        transparent
        animationType="none"
        onRequestClose={() => setShowDetailActionMenu(false)}
      >
        <View style={{ flex: 1 }}>
          <Pressable
            onPress={() => setShowDetailActionMenu(false)}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
          />
          <View
            style={{
              position: 'absolute',
              top: Platform.OS === 'web' ? 76 : 64,
              right: showCloseButton ? 60 : 18,
              minWidth: 170,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border.light,
              backgroundColor: colors.bg.card,
              overflow: 'hidden',
              shadowColor: '#000000',
              shadowOpacity: 0.14,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: 30,
            }}
          >
            <Pressable
              onPress={openTaskEditor}
              style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border.light }}
            >
              <Text style={{ color: colors.text.primary, fontSize: 12, fontWeight: '500' }}>Edit task</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setShowDetailActionMenu(false);
                deleteMutation.mutate();
              }}
              style={{ paddingHorizontal: 12, paddingVertical: 10 }}
            >
              <Text style={{ color: '#DC2626', fontSize: 12, fontWeight: '500' }}>
                {deleteMutation.isPending ? 'Deleting...' : 'Delete task'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showEditModal}
        transparent={!isMobileDetail}
        animationType={isMobileDetail ? 'slide' : 'fade'}
        onRequestClose={() => setShowEditModal(false)}
      >
        {isMobileDetail ? (
          <View style={{ flex: 1, backgroundColor: colors.bg.card }}>
            <View
              style={{
                paddingHorizontal: TASK_MODAL_HEADER_HORIZONTAL_PADDING,
                paddingVertical: TASK_MODAL_HEADER_VERTICAL_PADDING,
                borderBottomWidth: 1,
                borderBottomColor: colors.border.light,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ color: colors.text.primary, fontSize: 20, fontWeight: '600' }}>Edit Task</Text>
              <Pressable
                onPress={() => setShowEditModal(false)}
                style={{ width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.secondary }}
              >
                <X size={18} color={colors.text.secondary} strokeWidth={2.2} />
              </Pressable>
            </View>
            {renderEditForm(() => setShowEditModal(false), { stretch: true })}
          </View>
        ) : (
          <Pressable
            onPress={() => setShowEditModal(false)}
            style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', alignItems: 'center', justifyContent: 'center', padding: 18 }}
          >
            <Pressable
              onPress={(event) => event.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: TASK_MODAL_MAX_WIDTH,
                maxHeight: TASK_MODAL_MAX_HEIGHT,
                borderRadius: TASK_MODAL_RADIUS,
                borderWidth: 1,
                borderColor: colors.border.light,
                backgroundColor: colors.bg.card,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  paddingHorizontal: TASK_MODAL_HEADER_HORIZONTAL_PADDING,
                  paddingVertical: TASK_MODAL_HEADER_VERTICAL_PADDING,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border.light,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={{ color: colors.text.primary, fontSize: 20, fontWeight: '600' }}>Edit Task</Text>
                <Pressable
                  onPress={() => setShowEditModal(false)}
                  style={{ width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.secondary }}
                >
                  <X size={18} color={colors.text.secondary} strokeWidth={2.2} />
                </Pressable>
              </View>
              {renderEditForm(() => setShowEditModal(false))}
            </Pressable>
          </Pressable>
        )}
      </Modal>

      <View style={{ height: isDesktop ? 28 : 60 }} />
      <TaskActivityFeed businessId={businessId} taskId={task.id} task={task} teamMembers={teamMembers} compact={isDesktop} />
    </View>
  );
}

export function TaskWorkspace({ mode, taskId }: TaskWorkspaceProps) {
  const colors = useThemeColors();
  const themeMode = useResolvedThemeMode();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isDesktop, isMobile, width } = useBreakpoint();
  const pageHeadingStyle = getStandardPageHeadingStyle(isMobile);
  const businessId = useAuthStore((s) => s.businessId ?? s.currentUser?.businessId ?? null);
  const currentUserId = useAuthStore((s) => s.currentUser?.id ?? null);
  const currentUser = useAuthStore((s) => s.currentUser);
  const isOfflineMode = useAuthStore((s) => s.isOfflineMode);
  const teamMembers = useAuthStore((s) => s.teamMembers);
  const refreshTeamData = useAuthStore((s) => s.refreshTeamData);
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [kpiScope, setKpiScope] = useState<TaskKpiScope>('all');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMobileFilterModal, setShowMobileFilterModal] = useState(false);
  const [isMobileCompletedCollapsed, setIsMobileCompletedCollapsed] = useState(false);
  const [isDesktopCompletedCollapsed, setIsDesktopCompletedCollapsed] = useState(true);
  const [openCardMenu, setOpenCardMenu] = useState<'people' | 'assigned' | null>(null);
  const [createForm, setCreateForm] = useState<TaskFormState>(blankTaskForm());
  const [searchQuery, setSearchQuery] = useState('');
  const [taskToast, setTaskToast] = useState<TaskToastState | null>(null);
  const dueReminderTriggerKeyRef = useRef<string | null>(null);
  const taskToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    refreshTeamData().catch(() => undefined);
  }, [refreshTeamData]);

  useEffect(() => () => {
    if (taskToastTimerRef.current) clearTimeout(taskToastTimerRef.current);
  }, []);

  useEffect(() => {
    if (!businessId || isOfflineMode) return;
    const reminderKey = `${businessId}:${new Date().toISOString().slice(0, 10)}`;
    if (dueReminderTriggerKeyRef.current === reminderKey) return;
    dueReminderTriggerKeyRef.current = reminderKey;
    void triggerTaskDueReminders({ businessId }).catch((error) => {
      console.warn('Could not trigger task due reminders:', error);
    });
  }, [businessId, isOfflineMode]);

  const tasksQuery = useQuery({
    queryKey: ['tasks', businessId],
    enabled: Boolean(businessId) && !isOfflineMode,
    queryFn: () => taskData.listTasks(businessId as string),
    retry: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 30_000,
  });

  const unreadQuery = useQuery({
    queryKey: ['collaboration-thread-counts', businessId, 'task'],
    enabled: Boolean(businessId) && !isOfflineMode,
    queryFn: () => collaborationData.getUnreadNotificationCountsByEntity(businessId as string, 'task'),
    retry: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 20_000,
  });

  const commentCountsQuery = useQuery({
    queryKey: ['collaboration-thread-comment-counts', businessId, 'task'],
    enabled: Boolean(businessId) && !isOfflineMode,
    queryFn: () => collaborationData.getThreadCommentCountsByEntity(businessId as string, 'task'),
    retry: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 20_000,
  });

  const tasks = tasksQuery.data ?? [];
  const unreadCounts = unreadQuery.data ?? {};
  const commentCounts = commentCountsQuery.data ?? {};
  const membersWithCurrentUser = useMemo(() => {
    if (!currentUser?.id) return teamMembers;
    if (teamMembers.some((member) => member.id === currentUser.id)) return teamMembers;
    return [
      {
        id: currentUser.id,
        email: currentUser.email,
        name: currentUser.name || 'Myself',
        role: currentUser.role,
        createdAt: new Date().toISOString(),
      },
      ...teamMembers,
    ];
  }, [currentUser, teamMembers]);
  const teamMap = useMemo(
    () => new Map(membersWithCurrentUser.map((member) => [member.id, member])),
    [membersWithCurrentUser]
  );
  const tasksErrorMessage = useMemo(() => {
    const value = tasksQuery.error;
    if (!value) return 'Could not load tasks right now.';
    if (value instanceof Error && value.message) return value.message;
    return 'Could not load tasks right now.';
  }, [tasksQuery.error]);
  const todayDateKey = format(startOfToday(), 'yyyy-MM-dd');
  const filteredTasks = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const nextTasks = tasks.filter((task) => {
      const matchesSearch = normalizedSearch.length === 0
        ? true
        : (() => {
          const assigneeNames = (task.assignee_user_ids ?? [])
            .map((id) => teamMap.get(id)?.name?.toLowerCase() ?? '')
            .join(' ');
          const haystack = `${task.title} ${task.description ?? ''} ${statusLabel(task.status)} ${PRIORITY_META[task.priority].label} ${assigneeNames}`.toLowerCase();
          return haystack.includes(normalizedSearch);
        })();
      if (!matchesSearch) return false;
      if (kpiScope === 'due_today' && !(task.status !== 'done' && task.due_date === todayDateKey)) return false;
      if (kpiScope === 'overdue' && !isTaskOverdue(task)) return false;
      if (kpiScope === 'completed_today' && !isTaskCompletedToday(task)) return false;
      if (filter === 'pending') return task.status !== 'done';
      if (filter === 'done') return task.status === 'done';
      return true;
    });
    return [...nextTasks].sort((left, right) => {
      if (left.status !== right.status) {
        if (left.status === 'done') return 1;
        if (right.status === 'done') return -1;
      }
      const leftDue = left.due_date ? parseISO(left.due_date).getTime() : Number.MAX_SAFE_INTEGER;
      const rightDue = right.due_date ? parseISO(right.due_date).getTime() : Number.MAX_SAFE_INTEGER;
      if (leftDue !== rightDue) return leftDue - rightDue;
      return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
    });
  }, [filter, kpiScope, searchQuery, tasks, teamMap, todayDateKey]);

  useEffect(() => {
    if (mode === 'detail') return;
    if (!isDesktop) return;
    if (filteredTasks.length === 0) {
      setSelectedTaskId(null);
      return;
    }
    if (selectedTaskId && !filteredTasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(null);
    }
  }, [filteredTasks, isDesktop, mode, selectedTaskId]);

  const selectedTask = useMemo(() => {
    if (mode === 'detail') {
      return tasks.find((task) => task.id === taskId) ?? null;
    }
    return filteredTasks.find((task) => task.id === selectedTaskId) ?? null;
  }, [filteredTasks, mode, selectedTaskId, taskId, tasks]);

  const invalidateTaskQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['tasks', businessId] }),
      queryClient.invalidateQueries({ queryKey: ['collaboration-thread-counts', businessId, 'task'] }),
      queryClient.invalidateQueries({ queryKey: ['collaboration-thread-comment-counts', businessId, 'task'] }),
      queryClient.invalidateQueries({ queryKey: ['task-thread', businessId] }),
      queryClient.invalidateQueries({ queryKey: ['task-thread-comments', businessId] }),
    ]);
  };

  const showTaskToast = (toast: TaskToastState) => {
    if (taskToastTimerRef.current) clearTimeout(taskToastTimerRef.current);
    setTaskToast(toast);
    taskToastTimerRef.current = setTimeout(() => setTaskToast(null), 3600);
  };

  const createMutation = useMutation({
    mutationFn: async (input: CreateTaskInput) => taskData.createTask(input),
    onSuccess: async (createdTask) => {
      if ((createdTask.assignee_user_ids ?? []).length > 0) {
        void sendTaskAssignmentNotification({
          businessId: createdTask.business_id,
          recipientUserIds: createdTask.assignee_user_ids,
          senderUserId: currentUserId ?? null,
          assignerName: currentUser?.name ?? null,
          taskId: createdTask.id,
          taskTitle: createdTask.title,
          dueDate: createdTask.due_date ?? null,
          isReassignment: false,
        });
      }
      setShowCreateModal(false);
      setCreateForm(blankTaskForm());
      await invalidateTaskQueries();
      if (isDesktop) {
        setSelectedTaskId(createdTask.id);
      } else {
        router.push(`/task/${createdTask.id}` as any);
      }
      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
    onError: (error) => {
      console.warn('Task create failed:', error);
    },
  });

  const quickStatusMutation = useMutation({
    mutationFn: async ({ task, next }: { task: Task; next: 'todo' | 'done' | 'in_progress' }): Promise<CompleteTaskResult | undefined> => {
      if (!businessId) return;
      if (next === 'done') {
        return await taskData.completeTask(businessId, task);
      } else if (next === 'todo') {
        await taskData.reopenTask(businessId, task.id);
      } else {
        await taskData.updateTask(businessId, task.id, { status: 'in_progress' });
      }
    },
    onSuccess: async (result, variables) => {
      if (variables.next === 'done' && businessId) {
        if (Platform.OS !== 'web') {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        const recipientUserIds = Array.from(
          new Set(
            [
              ...(variables.task.assignee_user_ids ?? []),
              variables.task.created_by,
            ].filter(Boolean)
          )
        );

        void sendTaskCompletionNotification({
          businessId,
          recipientUserIds,
          senderUserId: currentUserId ?? null,
          completedByName: currentUser?.name ?? null,
          taskId: variables.task.id,
          taskTitle: variables.task.title,
          completedAt: new Date().toISOString(),
        });

        // Recurring task: show next-date toast and notify assignees
        const recurringFreq = variables.task.recurrence_frequency;
        const notAlreadyGenerated = !variables.task.recurrence_generated_at;
        if (recurringFreq && notAlreadyGenerated) {
          const currentDue = variables.task.due_date ? new Date(variables.task.due_date) : new Date();
          const freq = String(recurringFreq).toLowerCase().replace('-', '_');
          const interval = variables.task.recurrence_interval ?? 1;
          const nextDueDateObj: Date = (() => {
            if (freq === 'daily') return addDays(currentDue, interval);
            if (freq === 'weekly') return addWeeks(currentDue, interval);
            if (freq === 'bi_weekly') return addDays(currentDue, 14 * interval);
            if (freq === 'quarterly') return addMonths(currentDue, 3 * interval);
            if (freq === 'yearly') return addYears(currentDue, interval);
            return addMonths(currentDue, interval);
          })();
          const nextDueDate = nextDueDateObj.toISOString().slice(0, 10);
          const formatted = nextDueDateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
          showTaskToast({
            title: 'Task complete',
            message: `Next one lands ${formatted}`,
            icon: 'repeat',
            accent: '#2563EB',
            accentSoft: 'rgba(37,99,235,0.14)',
          });

          const assignees = (variables.task.assignee_user_ids ?? []).filter(Boolean);
          const nextTaskId = result?.nextTaskId;
          if (assignees.length > 0 && nextTaskId) {
            void sendTaskAssignmentNotification({
              businessId,
              recipientUserIds: assignees,
              senderUserId: currentUserId ?? null,
              assignerName: currentUser?.name ?? null,
              taskId: nextTaskId,
              taskTitle: variables.task.title,
              dueDate: nextDueDate,
              isReassignment: false,
            });
          }
        } else {
          showTaskToast({
            title: 'Task complete',
            message: variables.task.title,
            icon: 'check',
            accent: '#10B981',
            accentSoft: 'rgba(16,185,129,0.15)',
          });
        }
      }
      await invalidateTaskQueries();
    },
  });

  const dueTodayCount = tasks.filter((task) => task.status !== 'done' && task.due_date === todayDateKey).length;
  const completedTodayCount = tasks.filter(isTaskCompletedToday).length;
  const pendingCount = tasks.filter((task) => task.status !== 'done').length;
  const completedCount = tasks.filter((task) => task.status === 'done').length;
  const overdueCount = tasks.filter((task) => task.status !== 'done' && isTaskOverdue(task)).length;
  const activeKpiScopeLabel = kpiScope === 'due_today'
    ? 'Due today'
    : kpiScope === 'overdue'
      ? 'Overdue'
      : kpiScope === 'completed_today'
        ? 'Completed today'
        : null;
  const applyKpiScope = (nextScope: Exclude<TaskKpiScope, 'all'>) => {
    setKpiScope((current) => {
      const shouldActivate = current !== nextScope;
      if (shouldActivate) {
        setFilter(nextScope === 'completed_today' ? 'done' : 'pending');
      }
      return shouldActivate ? nextScope : 'all';
    });
  };
  const mobileOpenTasks = useMemo(
    () => filteredTasks.filter((task) => task.status !== 'done'),
    [filteredTasks]
  );
  const mobileCompletedTasks = useMemo(
    () => filteredTasks.filter((task) => task.status === 'done'),
    [filteredTasks]
  );
  const desktopOpenTasks = useMemo(
    () => filteredTasks.filter((task) => task.status !== 'done'),
    [filteredTasks]
  );
  const desktopCompletedTasks = useMemo(
    () => filteredTasks.filter((task) => task.status === 'done'),
    [filteredTasks]
  );
  const peopleRows = useMemo(() => {
    return [...teamMembers]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((member) => {
        let overdue = 0;
        let completed = 0;
        let upcoming = 0;

        tasks.forEach((task) => {
          if (!(task.assignee_user_ids ?? []).includes(member.id)) return;
          if (task.status === 'done') {
            completed += 1;
            return;
          }
          if (isTaskOverdue(task)) {
            overdue += 1;
            return;
          }
          upcoming += 1;
        });

        return {
          member,
          overdue,
          completed,
          upcoming,
        };
      });
  }, [tasks, teamMembers]);
  const assignedTaskRows = useMemo(() => {
    if (!currentUserId) return [];
    return [...tasks]
      .filter((task) => (
        task.created_by === currentUserId
        && !(task.assignee_user_ids ?? []).includes(currentUserId)
      ))
      .sort((left, right) => {
        if (left.status !== right.status) {
          if (left.status === 'done') return 1;
          if (right.status === 'done') return -1;
        }
        const leftDue = left.due_date ? parseISO(left.due_date).getTime() : Number.MAX_SAFE_INTEGER;
        const rightDue = right.due_date ? parseISO(right.due_date).getTime() : Number.MAX_SAFE_INTEGER;
        if (leftDue !== rightDue) return leftDue - rightDue;
        return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
      })
      .map((task) => ({
        task,
        primaryAssignee: (task.assignee_user_ids?.[0] ? teamMap.get(task.assignee_user_ids[0]) : undefined),
      }));
  }, [currentUserId, tasks, teamMap]);
  const isDetailOpen = isDesktop && Boolean(selectedTask);
  const isWebDesktop = Platform.OS === 'web' && isDesktop;
  const desktopHeaderMinHeight = DESKTOP_PAGE_HEADER_MIN_HEIGHT;
  const webDesktopHeaderGutter = isWebDesktop ? DESKTOP_PAGE_HEADER_GUTTER : 0;
  const shouldUseDesktopCardsAndTable = isDesktop;
  const isWebMobileTableView = Platform.OS === 'web' && !isDesktop;
  const isIpadProView = isDesktop && width <= 1366;
  const showActivityColumn = !isIpadProView && !isWebMobileTableView;
  const taskDetailPanelWidth = useMemo(() => {
    if (!isDesktop) return 0;
    if (isIpadProView) {
      return Math.min(430, Math.max(340, Math.round(width * 0.34)));
    }
    return Math.min(520, Math.max(360, Math.round(width * 0.32)));
  }, [isDesktop, isIpadProView, width]);
  const taskDetailPanelMinWidth = isIpadProView ? 340 : 360;
  const taskDetailPanelMaxWidth = isIpadProView ? 430 : 520;
  const peopleCardSubtitle = isIpadProView
    ? 'Track who is on track and who needs support.'
    : 'See who is on track and who needs support at a glance.';
  const assignedCardSubtitle = isIpadProView
    ? 'Track delegated work that needs prioritizing.'
    : 'Track work you\'ve delegated so you can see what needs prioritizing.';
  const splitDividerColor = themeMode === 'light' ? 'rgba(15,23,42,0.10)' : colors.border.light;
  const splitDividerWidth = Platform.OS === 'web' ? 0.5 : 1;
  const forceDesktopCompletedOpen = filter === 'done' || kpiScope === 'completed_today';
  const desktopCompletedCollapsed = forceDesktopCompletedOpen ? false : isDesktopCompletedCollapsed;
  const renderTaskTable = (rows: Task[], emptyMessage: string) => (
    <View style={{ borderWidth: 1, borderColor: colors.border.light, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.bg.card }}>
      <View style={{ minHeight: 40, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border.light }}>
        <Text style={{ flex: showActivityColumn ? 1.9 : 3.2, paddingLeft: 16, paddingRight: 10, color: colors.text.muted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase' }}>Name</Text>
        <Text style={{ width: showActivityColumn ? 110 : 82, paddingRight: 8, color: colors.text.muted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase' }}>Priority</Text>
        <Text style={{ width: showActivityColumn ? 170 : 136, paddingRight: 8, color: colors.text.muted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase' }}>Assignee</Text>
        <Text style={{ width: showActivityColumn ? 126 : 108, paddingRight: 8, color: colors.text.muted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase' }}>Due</Text>
        <Text style={{ width: showActivityColumn ? 108 : 92, paddingRight: 8, color: colors.text.muted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase' }}>Frequency</Text>
        <Text style={{ width: showActivityColumn ? 118 : 94, paddingRight: 8, color: colors.text.muted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase' }}>Status</Text>
        {showActivityColumn ? (
          <Text style={{ width: 104, paddingRight: 10, color: colors.text.muted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase' }}>Activity</Text>
        ) : null}
      </View>

      {tasksQuery.isPending ? (
        <Text style={{ color: colors.text.tertiary, fontSize: 12, fontWeight: '400', textAlign: 'center', paddingVertical: 18 }}>
          Loading tasks...
        </Text>
      ) : null}
      {tasksQuery.isError ? (
        <Text style={{ color: '#B91C1C', fontSize: 12, fontWeight: '400', textAlign: 'center', paddingVertical: 12 }}>
          {tasksErrorMessage}
        </Text>
      ) : null}
      {rows.length === 0 ? (
        <View style={{ paddingVertical: 34, alignItems: 'center' }}>
          <Text style={{ color: colors.text.tertiary, fontWeight: '400' }}>{emptyMessage}</Text>
        </View>
      ) : (
        rows.map((task) => (
          <TaskTableRow
            key={task.id}
            task={task}
            selected={task.id === selectedTaskId}
            unreadCount={unreadCounts[task.id] ?? 0}
            commentCount={commentCounts[task.id] ?? 0}
            assignees={(task.assignee_user_ids ?? []).map((id) => teamMap.get(id)).filter(Boolean) as TeamMember[]}
            showActivityColumn={showActivityColumn}
            onSelect={() => {
              if (!isDesktop) {
                router.push(`/task/${task.id}` as any);
                return;
              }
              setSelectedTaskId((current) => (current === task.id ? null : task.id));
            }}
            onToggleDone={() => quickStatusMutation.mutate({ task, next: task.status === 'done' ? 'todo' : 'done' })}
          />
        ))
      )}
    </View>
  );
  const renderTaskToast = () => {
    if (!taskToast) return null;

    return (
      <View
        style={{
          position: 'absolute',
          top: isDesktop ? 24 : 16,
          left: 0,
          right: 0,
          alignItems: 'center',
          zIndex: 9999,
          pointerEvents: 'none',
          paddingHorizontal: 16,
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 360,
            backgroundColor: colors.bg.card,
            borderRadius: 22,
            paddingHorizontal: 16,
            paddingVertical: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            borderWidth: 1,
            borderColor: taskToast.accentSoft,
            shadowColor: '#000',
            shadowOpacity: themeMode === 'dark' ? 0.22 : 0.14,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 10 },
            elevation: 8,
          }}
        >
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: taskToast.accentSoft,
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {taskToast.icon === 'check' ? <TaskToastConfetti /> : null}
            {taskToast.icon === 'repeat' ? (
              <Repeat size={18} color={taskToast.accent} />
            ) : (
              <CheckCircle2 size={20} color={taskToast.accent} />
            )}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '800' }}>
              {taskToast.title}
            </Text>
            {taskToast.message ? (
              <Text style={{ color: colors.text.secondary, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
                {taskToast.message}
              </Text>
            ) : null}
          </View>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: taskToast.accentSoft,
            }}
          >
            <Text style={{ color: taskToast.accent, fontSize: 11, fontWeight: '800', letterSpacing: 0.3 }}>
              Done
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (!businessId) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.primary }}>
        <Text style={{ color: colors.text.secondary, fontWeight: '700' }}>Tasks unavailable</Text>
      </View>
    );
  }

  if (mode === 'detail') {
    return (
      <View
        style={{
          flex: 1,
          paddingHorizontal: isDesktop ? 12 : 0,
          paddingVertical: isDesktop ? 12 : 0,
          backgroundColor: colors.bg.primary,
        }}
      >
        {tasksQuery.isPending ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 24 }}>
            <Text style={{ color: colors.text.tertiary, fontWeight: '600' }}>Loading task...</Text>
          </View>
        ) : null}
        {tasksQuery.isError ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 24 }}>
            <Text style={{ color: '#B91C1C', fontWeight: '700', textAlign: 'center' }}>{tasksErrorMessage}</Text>
          </View>
        ) : null}
        {selectedTask ? (
          <TaskDetailPanel
            task={selectedTask}
            businessId={businessId}
            teamMembers={membersWithCurrentUser}
            currentUserId={currentUserId}
            commentCount={commentCounts[selectedTask.id] ?? 0}
            onClose={() => router.back()}
            onSaved={invalidateTaskQueries}
            onDeleted={async () => {
              await invalidateTaskQueries();
              router.back();
            }}
            onStatusChange={async (next) => {
              await quickStatusMutation.mutateAsync({ task: selectedTask, next });
            }}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.text.secondary, fontWeight: '700' }}>Task not found</Text>
          </View>
        )}
        {renderTaskToast()}
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg.primary,
        ...(Platform.OS === 'web' ? { alignItems: 'flex-start' } : null),
      }}
    >
      <View
        style={{
          flex: 1,
          width: '100%',
          flexDirection: isDesktop ? 'row' : 'column',
          backgroundColor: colors.bg.primary,
        }}
      >
        <View
          style={{
            width: isDesktop ? undefined : '100%',
            flex: 1,
            minWidth: shouldUseDesktopCardsAndTable && isDesktop ? (isDetailOpen ? undefined : 680) : undefined,
            borderRightWidth: 0,
            borderRightColor: splitDividerColor,
            backgroundColor: colors.bg.primary,
          }}
        >
          {shouldUseDesktopCardsAndTable ? (
            <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border.light, paddingHorizontal: webDesktopHeaderGutter }}>
              <View
                style={{
                  width: '100%',
                  maxWidth: isWebDesktop ? 1400 : undefined,
                  alignSelf: isWebDesktop ? 'flex-start' : undefined,
                  paddingLeft: 20,
                  paddingRight: 20,
                  paddingTop: isWebDesktop ? 20 : 18,
                  paddingBottom: 16,
                  minHeight: isWebDesktop ? desktopHeaderMinHeight : undefined,
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: colors.text.primary, ...pageHeadingStyle }}>Tasks</Text>
                  <Text style={{ color: colors.text.tertiary, fontSize: 13, fontWeight: '500', marginTop: 2 }}>Operations</Text>
                </View>
                <Pressable
                  onPress={() => setShowCreateModal(true)}
                  style={{
                    height: 40,
                    borderRadius: 999,
                    backgroundColor: themeMode === 'dark' ? '#FFFFFF' : colors.bg.card,
                    borderWidth: 1,
                    borderColor: themeMode === 'dark' ? '#FFFFFF' : colors.border.light,
                    paddingHorizontal: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 7,
                  }}
                >
                  <Plus size={16} color={themeMode === 'dark' ? '#111111' : colors.text.primary} strokeWidth={2.8} />
                  <Text style={{ color: themeMode === 'dark' ? '#111111' : colors.text.primary, fontSize: 14, fontWeight: '700' }}>Add Task</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={shouldUseDesktopCardsAndTable
              ? {
                paddingLeft: 20,
                paddingRight: 20,
                paddingTop: 24,
                paddingBottom: 24,
                width: '100%',
                maxWidth: isWebDesktop ? 1400 : undefined,
                alignSelf: isWebDesktop ? 'flex-start' : undefined,
              }
              : { padding: 12, gap: 8 }}
          >
            {shouldUseDesktopCardsAndTable ? (
              <>
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 10 }}>
                  <Pressable
                    onPress={() => applyKpiScope('due_today')}
                    style={{
                      flex: 1,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: kpiScope === 'due_today' ? colors.text.primary : colors.border.light,
                      backgroundColor: kpiScope === 'due_today' ? colors.bg.secondary : colors.bg.card,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                    }}
                  >
                    <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>Due today</Text>
                    <Text style={{ color: colors.text.primary, fontSize: 30, lineHeight: 34, fontWeight: '700', marginTop: 4 }}>{dueTodayCount}</Text>
                    <Text style={{ color: colors.text.tertiary, fontSize: 12, marginTop: 1 }}>{pendingCount} pending</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => applyKpiScope('overdue')}
                    style={{
                      flex: 1,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: kpiScope === 'overdue' ? colors.text.primary : colors.border.light,
                      backgroundColor: kpiScope === 'overdue' ? colors.bg.secondary : colors.bg.card,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                    }}
                  >
                    <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>Overdue</Text>
                    <Text style={{ color: colors.text.primary, fontSize: 30, lineHeight: 34, fontWeight: '700', marginTop: 4 }}>{overdueCount}</Text>
                    <Text style={{ color: colors.text.tertiary, fontSize: 12, marginTop: 1 }}>Needs immediate action</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => applyKpiScope('completed_today')}
                    style={{
                      flex: 1,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: kpiScope === 'completed_today' ? colors.text.primary : colors.border.light,
                      backgroundColor: kpiScope === 'completed_today' ? colors.bg.secondary : colors.bg.card,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                    }}
                  >
                    <Text style={{ color: colors.text.muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>Completed today</Text>
                    <Text style={{ color: colors.text.primary, fontSize: 30, lineHeight: 34, fontWeight: '700', marginTop: 4 }}>{completedTodayCount}</Text>
                    <Text style={{ color: colors.text.tertiary, fontSize: 12, marginTop: 1 }}>{completedCount} total completed</Text>
                  </Pressable>
                </View>
                {activeKpiScopeLabel ? (
                  <View style={{ marginBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <Text style={{ color: colors.text.tertiary, fontSize: 12 }}>
                      KPI focus: {activeKpiScopeLabel}
                    </Text>
                    <Pressable
                      onPress={() => setKpiScope('all')}
                      style={{
                        height: 28,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: colors.border.light,
                        backgroundColor: colors.bg.card,
                        paddingHorizontal: 10,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: colors.text.secondary, fontSize: 11, fontWeight: '600' }}>Clear KPI focus</Text>
                    </Pressable>
                  </View>
                ) : null}

                <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 12, marginBottom: 14 }}>
                  <View style={{ flex: isDesktop ? 1 : undefined, borderRadius: 14, borderWidth: 1, borderColor: colors.border.light, backgroundColor: colors.bg.card, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 }}>
                    {openCardMenu === 'people' ? (
                      <>
                        <Pressable
                          onPress={() => setOpenCardMenu(null)}
                          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 10 }}
                        />
                        <View
                          style={{
                            position: 'absolute',
                            top: 46,
                            right: 12,
                            width: 188,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: colors.border.light,
                            backgroundColor: colors.bg.card,
                            padding: 6,
                            shadowColor: '#000000',
                            shadowOpacity: 0.12,
                            shadowRadius: 12,
                            shadowOffset: { width: 0, height: 6 },
                            zIndex: 20,
                          }}
                        >
                          <Pressable
                            onPress={() => {
                              setOpenCardMenu(null);
                              router.push('/add-team-member' as any);
                            }}
                            style={{
                              height: 34,
                              borderRadius: 8,
                              paddingHorizontal: 10,
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <Text style={{ color: colors.text.primary, fontSize: 12, fontWeight: '600' }}>
                              Invite a teammate
                            </Text>
                            <Plus size={13} color={colors.text.secondary} strokeWidth={2.4} />
                          </Pressable>
                        </View>
                      </>
                    ) : null}
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ color: colors.text.primary, fontSize: 14, lineHeight: 18, fontWeight: '700' }}>People</Text>
                        <Text
                          numberOfLines={1}
                          ellipsizeMode="tail"
                          style={{ color: colors.text.tertiary, fontSize: isIpadProView ? 10 : 12, marginTop: 2 }}
                        >
                          {peopleCardSubtitle}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => setOpenCardMenu('people')}
                        style={{ width: 30, height: 30, borderRadius: 999, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <MoreHorizontal size={18} color={colors.text.tertiary} strokeWidth={2.1} />
                      </Pressable>
                    </View>

                    <View style={{ marginTop: 8 }}>
                      {peopleRows.length === 0 ? (
                        <Text style={{ color: colors.text.tertiary, fontSize: 12, paddingVertical: 12 }}>No team members yet.</Text>
                      ) : (
                        <ScrollView
                          style={{ maxHeight: OVERVIEW_CARD_LIST_MAX_HEIGHT, flexGrow: 0 }}
                          contentContainerStyle={{ paddingRight: 2 }}
                          nestedScrollEnabled
                          showsVerticalScrollIndicator={peopleRows.length > OVERVIEW_CARD_VISIBLE_ROWS}
                        >
                          {peopleRows.map((row, index) => {
                            return (
                              <View
                                key={row.member.id}
                                style={{
                                  minHeight: OVERVIEW_CARD_ROW_HEIGHT,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 10,
                                  borderTopWidth: index === 0 ? 0 : 1,
                                  borderTopColor: colors.border.light,
                                }}
                              >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                                  <UserAvatar member={row.member} size={24} />
                                  <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '500', flex: 1 }} numberOfLines={1}>
                                    {row.member.name}
                                  </Text>
                                </View>
                                <TaskPeopleBadges overdue={row.overdue} completed={row.completed} upcoming={row.upcoming} />
                              </View>
                            );
                          })}
                        </ScrollView>
                      )}
                    </View>
                  </View>

                  <View style={{ flex: isDesktop ? 1 : undefined, borderRadius: 14, borderWidth: 1, borderColor: colors.border.light, backgroundColor: colors.bg.card, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 }}>
                    {openCardMenu === 'assigned' ? (
                      <>
                        <Pressable
                          onPress={() => setOpenCardMenu(null)}
                          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 10 }}
                        />
                        <View
                          style={{
                            position: 'absolute',
                            top: 46,
                            right: 12,
                            width: 188,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: colors.border.light,
                            backgroundColor: colors.bg.card,
                            padding: 6,
                            shadowColor: '#000000',
                            shadowOpacity: 0.12,
                            shadowRadius: 12,
                            shadowOffset: { width: 0, height: 6 },
                            zIndex: 20,
                          }}
                        >
                          <Pressable
                            onPress={() => {
                              setOpenCardMenu(null);
                              router.push('/add-team-member' as any);
                            }}
                            style={{
                              height: 34,
                              borderRadius: 8,
                              paddingHorizontal: 10,
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <Text style={{ color: colors.text.primary, fontSize: 12, fontWeight: '600' }}>
                              Invite a teammate
                            </Text>
                            <Plus size={13} color={colors.text.secondary} strokeWidth={2.4} />
                          </Pressable>
                        </View>
                      </>
                    ) : null}
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ color: colors.text.primary, fontSize: 14, lineHeight: 18, fontWeight: '700' }}>Tasks I&apos;ve assigned</Text>
                        <Text
                          numberOfLines={1}
                          ellipsizeMode="tail"
                          style={{ color: colors.text.tertiary, fontSize: isIpadProView ? 10 : 12, marginTop: 2 }}
                        >
                          {assignedCardSubtitle}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => setOpenCardMenu('assigned')}
                        style={{ width: 30, height: 30, borderRadius: 999, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <MoreHorizontal size={18} color={colors.text.tertiary} strokeWidth={2.1} />
                      </Pressable>
                    </View>

                    <View style={{ marginTop: 8 }}>
                      {assignedTaskRows.length === 0 ? (
                        <Text style={{ color: colors.text.tertiary, fontSize: 12, paddingVertical: 12 }}>No assigned tasks yet.</Text>
                      ) : (
                        <ScrollView
                          style={{ maxHeight: OVERVIEW_CARD_LIST_MAX_HEIGHT, flexGrow: 0 }}
                          contentContainerStyle={{ paddingRight: 2 }}
                          nestedScrollEnabled
                          showsVerticalScrollIndicator={assignedTaskRows.length > OVERVIEW_CARD_VISIBLE_ROWS}
                        >
                          {assignedTaskRows.map((row, index) => {
                            const dueLabel = formatDueDateRelative(row.task.due_date);
                            const dueColor = row.task.status === 'done'
                              ? colors.text.muted
                              : isTaskOverdue(row.task)
                                ? '#B91C1C'
                                : (dueLabel === 'Today' || dueLabel === 'Tomorrow')
                                  ? '#059669'
                                  : colors.text.tertiary;
                            const isCompleted = row.task.status === 'done';

                            return (
                              <View
                                key={row.task.id}
                                style={{
                                  minHeight: OVERVIEW_CARD_ROW_HEIGHT,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 10,
                                  borderTopWidth: index === 0 ? 0 : 1,
                                  borderTopColor: colors.border.light,
                                  opacity: isCompleted ? 0.58 : 1,
                                }}
                              >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                                  {row.task.status === 'done' ? (
                                    <CheckCircle2 size={18} color={colors.text.muted} strokeWidth={2.2} />
                                  ) : (
                                    <Circle size={18} color={colors.text.muted} strokeWidth={2.0} />
                                  )}
                                  <Text
                                    style={{
                                      color: row.task.status === 'done' ? colors.text.muted : colors.text.primary,
                                      fontSize: 13,
                                      fontWeight: '500',
                                      textDecorationLine: row.task.status === 'done' ? 'underline line-through' : 'none',
                                    }}
                                    numberOfLines={1}
                                  >
                                    {toSentenceCase(row.task.title)}
                                  </Text>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                  <Text style={{ color: dueColor, fontSize: 12, fontWeight: '500', textDecorationLine: isCompleted ? 'underline line-through' : 'none' }}>{dueLabel}</Text>
                                  <UserAvatar member={row.primaryAssignee} size={24} />
                                </View>
                              </View>
                            );
                          })}
                        </ScrollView>
                      )}
                    </View>
                  </View>
                </View>

                {isWebMobileTableView ? (
                  <View style={{ marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ flex: 1, height: 44, borderRadius: 999, borderWidth: 1, borderColor: colors.border.light, backgroundColor: colors.bg.card, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }}>
                      <Search size={16} color={colors.text.tertiary} strokeWidth={2.2} />
                      <TextInput
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Search tasks"
                        placeholderTextColor={colors.input.placeholder}
                        style={{ flex: 1, marginLeft: 8, color: colors.text.primary, fontSize: 14 }}
                        selectionColor={colors.text.primary}
                      />
                    </View>
                    <Pressable
                      onPress={() => setShowMobileFilterModal(true)}
                      style={{
                        height: 44,
                        width: 44,
                        borderRadius: 22,
                        borderWidth: 1,
                        borderColor: colors.border.light,
                        backgroundColor: colors.bg.card,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Funnel size={16} color={colors.text.secondary} strokeWidth={2.2} />
                    </Pressable>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 18, marginBottom: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                      <View style={{ width: 340, height: 44, borderRadius: 999, borderWidth: 1, borderColor: colors.border.light, backgroundColor: colors.bg.card, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }}>
                        <Search size={16} color={colors.text.tertiary} strokeWidth={2.2} />
                        <TextInput
                          value={searchQuery}
                          onChangeText={setSearchQuery}
                          placeholder="Search tasks"
                          placeholderTextColor={colors.input.placeholder}
                          style={{ flex: 1, marginLeft: 8, color: colors.text.primary, fontSize: 14 }}
                          selectionColor={colors.text.primary}
                        />
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {FILTERS.map((item) => {
                          const active = filter === item.id;
                          return (
                            <Pressable
                              key={item.id}
                              onPress={() => {
                                setKpiScope('all');
                                setFilter(item.id);
                              }}
                              style={{
                                borderRadius: 999,
                                borderWidth: 1,
                                borderColor: active ? colors.text.primary : colors.border.light,
                                backgroundColor: active ? colors.text.primary : colors.bg.card,
                                paddingHorizontal: 14,
                                height: 36,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Text style={{ color: active ? colors.bg.primary : colors.text.secondary, fontSize: 12, fontWeight: '600' }}>
                                {item.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 16 }}>
                      <Text style={{ color: colors.text.primary, fontSize: 20, lineHeight: 24, fontWeight: '700' }}>
                        {filteredTasks.length}
                      </Text>
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: colors.border.light,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: colors.bg.card,
                        }}
                      >
                        <Funnel size={16} color={colors.text.tertiary} strokeWidth={2.2} />
                      </View>
                    </View>
                  </View>
                )}

                {forceDesktopCompletedOpen ? null : renderTaskTable(
                  desktopOpenTasks,
                  filteredTasks.length === 0 ? 'No tasks found.' : 'No open tasks found.'
                )}

                {desktopCompletedTasks.length > 0 || forceDesktopCompletedOpen ? (
                  <View style={{ marginTop: forceDesktopCompletedOpen || !desktopOpenTasks.length ? 0 : 12 }}>
                    <Pressable
                      onPress={() => {
                        if (forceDesktopCompletedOpen) return;
                        setIsDesktopCompletedCollapsed((current) => !current);
                      }}
                      style={{
                        borderRadius: desktopCompletedCollapsed ? 14 : 14,
                        borderWidth: 1,
                        borderColor: colors.border.light,
                        backgroundColor: colors.bg.card,
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View
                          style={{
                            transform: [{ rotate: desktopCompletedCollapsed ? '-90deg' : '0deg' }],
                          }}
                        >
                          <ChevronDown size={16} color={colors.text.primary} strokeWidth={2.2} />
                        </View>
                        <Text style={{ color: colors.text.primary, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                          Completed
                        </Text>
                      </View>
                      <View
                        style={{
                          minWidth: 28,
                          height: 28,
                          borderRadius: 999,
                          backgroundColor: colors.bg.secondary,
                          borderWidth: 1,
                          borderColor: colors.border.light,
                          alignItems: 'center',
                          justifyContent: 'center',
                          paddingHorizontal: 8,
                        }}
                      >
                        <Text style={{ color: colors.text.secondary, fontSize: 12, fontWeight: '700' }}>
                          {desktopCompletedTasks.length}
                        </Text>
                      </View>
                    </Pressable>

                    {!desktopCompletedCollapsed ? (
                      <View style={{ marginTop: 10 }}>
                        {renderTaskTable(desktopCompletedTasks, 'No completed tasks found.')}
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </>
            ) : (
              <>
                <View style={{ paddingHorizontal: 6, paddingTop: 14, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ color: colors.text.primary, ...pageHeadingStyle }}>Tasks</Text>
                    <Text style={{ color: colors.text.tertiary, fontSize: 11, marginTop: 2 }}>{pendingCount} pending</Text>
                  </View>
                  <Pressable
                    onPress={() => setShowCreateModal(true)}
                    style={{
                      height: 38,
                      borderRadius: 999,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: themeMode === 'dark' ? '#FFFFFF' : '#111111',
                      paddingHorizontal: 14,
                      flexDirection: 'row',
                      gap: 6,
                    }}
                  >
                    <Plus size={15} color={themeMode === 'dark' ? '#111111' : '#FFFFFF'} strokeWidth={2.8} />
                    <Text style={{ color: themeMode === 'dark' ? '#111111' : '#FFFFFF', fontSize: 13, fontWeight: '700' }}>
                      Create Task
                    </Text>
                  </Pressable>
                </View>

                <View style={{ marginHorizontal: 6, marginTop: 6, marginBottom: 10, flexDirection: 'row', gap: 12 }}>
                  <View
                    style={{
                      flex: 1,
                      borderRadius: 16,
                      paddingHorizontal: 14,
                      paddingVertical: 14,
                      backgroundColor: colors.bg.card,
                      borderWidth: 1,
                      borderColor: colors.border.light,
                    }}
                  >
                    <Text style={{ color: colors.text.tertiary, fontSize: 10, fontWeight: '600', marginBottom: 6 }}>
                      Pending
                    </Text>
                    <Text style={{ color: colors.text.primary, fontSize: 19, lineHeight: 22, fontWeight: '700' }}>
                      {pendingCount.toLocaleString()}
                    </Text>
                    <Text style={{ color: colors.text.muted, fontSize: 11, marginTop: 6 }}>
                      Open tasks
                    </Text>
                  </View>

                  <View
                    style={{
                      flex: 1,
                      borderRadius: 16,
                      paddingHorizontal: 14,
                      paddingVertical: 14,
                      backgroundColor: colors.bg.card,
                      borderWidth: 1,
                      borderColor: colors.border.light,
                    }}
                  >
                    <Text style={{ color: colors.text.tertiary, fontSize: 10, fontWeight: '600', marginBottom: 6 }}>
                      Completed
                    </Text>
                    <Text style={{ color: colors.text.primary, fontSize: 19, lineHeight: 22, fontWeight: '700' }}>
                      {completedCount.toLocaleString()}
                    </Text>
                    <Text style={{ color: colors.text.muted, fontSize: 11, marginTop: 6 }}>
                      {overdueCount} overdue
                    </Text>
                  </View>
                </View>

                <View
                  style={{ marginHorizontal: 6, marginBottom: 8, gap: 10 }}
                >
                  <View
                    style={{
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: colors.border.light,
                      backgroundColor: colors.bg.card,
                      paddingHorizontal: 14,
                      paddingTop: 12,
                      paddingBottom: 12,
                    }}
                  >
                    <Text style={{ color: colors.text.primary, fontSize: 14, lineHeight: 18, fontWeight: '700' }}>People</Text>
                    <Text style={{ color: colors.text.tertiary, fontSize: 11, marginTop: 2 }}>
                      {peopleCardSubtitle}
                    </Text>

                    <View style={{ marginTop: 8 }}>
                      {peopleRows.length === 0 ? (
                        <Text style={{ color: colors.text.tertiary, fontSize: 12, paddingVertical: 12 }}>No team members yet.</Text>
                      ) : (
                        <ScrollView
                          style={{ maxHeight: OVERVIEW_CARD_LIST_MAX_HEIGHT, flexGrow: 0 }}
                          contentContainerStyle={{ paddingRight: 2 }}
                          nestedScrollEnabled
                          showsVerticalScrollIndicator={peopleRows.length > OVERVIEW_CARD_VISIBLE_ROWS}
                        >
                          {peopleRows.map((row, index) => {
                            return (
                              <View
                                key={row.member.id}
                                style={{
                                  minHeight: OVERVIEW_CARD_ROW_HEIGHT,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 10,
                                  borderTopWidth: index === 0 ? 0 : 1,
                                  borderTopColor: colors.border.light,
                                }}
                              >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                                  <UserAvatar member={row.member} size={24} />
                                  <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '500', flex: 1 }} numberOfLines={1}>
                                    {row.member.name}
                                  </Text>
                                </View>
                                <TaskPeopleBadges overdue={row.overdue} completed={row.completed} upcoming={row.upcoming} />
                              </View>
                            );
                          })}
                        </ScrollView>
                      )}
                    </View>
                  </View>

                  <View
                    style={{
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: colors.border.light,
                      backgroundColor: colors.bg.card,
                      paddingHorizontal: 14,
                      paddingTop: 12,
                      paddingBottom: 12,
                    }}
                  >
                    <Text style={{ color: colors.text.primary, fontSize: 14, lineHeight: 18, fontWeight: '700' }}>Tasks I&apos;ve assigned</Text>
                    <Text style={{ color: colors.text.tertiary, fontSize: 11, marginTop: 2 }}>
                      {assignedCardSubtitle}
                    </Text>

                    <View style={{ marginTop: 8 }}>
                      {assignedTaskRows.length === 0 ? (
                        <Text style={{ color: colors.text.tertiary, fontSize: 12, paddingVertical: 12 }}>No assigned tasks yet.</Text>
                      ) : (
                        <ScrollView
                          style={{ maxHeight: OVERVIEW_CARD_LIST_MAX_HEIGHT, flexGrow: 0 }}
                          contentContainerStyle={{ paddingRight: 2 }}
                          nestedScrollEnabled
                          showsVerticalScrollIndicator={assignedTaskRows.length > OVERVIEW_CARD_VISIBLE_ROWS}
                        >
                          {assignedTaskRows.map((row, index) => {
                            const dueLabel = formatDueDateRelative(row.task.due_date);
                            const dueColor = row.task.status === 'done'
                              ? colors.text.muted
                              : isTaskOverdue(row.task)
                                ? '#B91C1C'
                                : (dueLabel === 'Today' || dueLabel === 'Tomorrow')
                                  ? '#059669'
                                  : colors.text.tertiary;
                            const isCompleted = row.task.status === 'done';

                            return (
                              <View
                                key={row.task.id}
                                style={{
                                  minHeight: OVERVIEW_CARD_ROW_HEIGHT,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 10,
                                  borderTopWidth: index === 0 ? 0 : 1,
                                  borderTopColor: colors.border.light,
                                  opacity: isCompleted ? 0.58 : 1,
                                }}
                              >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                                  {row.task.status === 'done' ? (
                                    <CheckCircle2 size={18} color={colors.text.muted} strokeWidth={2.2} />
                                  ) : (
                                    <Circle size={18} color={colors.text.muted} strokeWidth={2.0} />
                                  )}
                                  <Text
                                    style={{
                                      color: row.task.status === 'done' ? colors.text.muted : colors.text.primary,
                                      fontSize: 13,
                                      fontWeight: '500',
                                      textDecorationLine: row.task.status === 'done' ? 'underline line-through' : 'none',
                                    }}
                                    numberOfLines={1}
                                  >
                                    {toSentenceCase(row.task.title)}
                                  </Text>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                  <Text style={{ color: dueColor, fontSize: 12, fontWeight: '500', textDecorationLine: isCompleted ? 'underline line-through' : 'none' }}>{dueLabel}</Text>
                                  <UserAvatar member={row.primaryAssignee} size={24} />
                                </View>
                              </View>
                            );
                          })}
                        </ScrollView>
                      )}
                    </View>
                  </View>
                </View>

                <View style={{ marginHorizontal: 6, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ flex: 1, height: 40, borderRadius: 999, borderWidth: 1, borderColor: colors.border.light, backgroundColor: colors.bg.card, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' }}>
                    <Search size={14} color={colors.text.tertiary} strokeWidth={2.2} />
                    <TextInput
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      placeholder="Search tasks"
                      placeholderTextColor={colors.input.placeholder}
                      style={{ flex: 1, marginLeft: 8, color: colors.text.primary, fontSize: 13 }}
                      selectionColor={colors.text.primary}
                    />
                  </View>
                  <Pressable
                    onPress={() => setShowMobileFilterModal(true)}
                    style={{
                      height: 40,
                      width: 40,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: colors.border.light,
                      backgroundColor: colors.bg.card,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Funnel size={14} color={colors.text.secondary} strokeWidth={2.2} />
                  </Pressable>
                </View>
                {filteredTasks.length === 0 ? (
                  <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                    <Text style={{ color: colors.text.tertiary, fontWeight: '700' }}>No tasks found.</Text>
                  </View>
                ) : (
                  <>
                    {mobileOpenTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        selected={false}
                        unreadCount={unreadCounts[task.id] ?? 0}
                        commentCount={commentCounts[task.id] ?? 0}
                        assignees={(task.assignee_user_ids ?? []).map((id) => teamMap.get(id)).filter(Boolean) as TeamMember[]}
                        onSelect={() => router.push(`/task/${task.id}` as any)}
                        onToggleDone={() => quickStatusMutation.mutate({ task, next: task.status === 'done' ? 'todo' : 'done' })}
                      />
                    ))}

                    {mobileCompletedTasks.length > 0 ? (
                      <View style={{ marginTop: 8 }}>
                        <Pressable
                          onPress={() => setIsMobileCompletedCollapsed((current) => !current)}
                          style={{
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: colors.border.light,
                            backgroundColor: colors.bg.secondary,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View
                              style={{
                                transform: [{ rotate: isMobileCompletedCollapsed ? '-90deg' : '0deg' }],
                              }}
                            >
                              <ChevronDown size={14} color={colors.text.primary} strokeWidth={2.2} />
                            </View>
                            <Text
                              style={{
                                color: colors.text.primary,
                                fontSize: 11,
                                fontWeight: '700',
                                letterSpacing: 0.8,
                                textTransform: 'uppercase',
                              }}
                            >
                              Completed
                            </Text>
                          </View>
                          <View
                            style={{
                              minWidth: 24,
                              height: 24,
                              borderRadius: 999,
                              backgroundColor: colors.bg.card,
                              borderWidth: 1,
                              borderColor: colors.border.light,
                              alignItems: 'center',
                              justifyContent: 'center',
                              paddingHorizontal: 6,
                            }}
                          >
                            <Text style={{ color: colors.text.secondary, fontSize: 12, fontWeight: '700' }}>
                              {mobileCompletedTasks.length}
                            </Text>
                          </View>
                        </Pressable>
                      </View>
                    ) : null}

                    {!isMobileCompletedCollapsed ? mobileCompletedTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        selected={false}
                        unreadCount={unreadCounts[task.id] ?? 0}
                        commentCount={commentCounts[task.id] ?? 0}
                        assignees={(task.assignee_user_ids ?? []).map((id) => teamMap.get(id)).filter(Boolean) as TeamMember[]}
                        onSelect={() => router.push(`/task/${task.id}` as any)}
                        onToggleDone={() => quickStatusMutation.mutate({ task, next: task.status === 'done' ? 'todo' : 'done' })}
                      />
                    )) : null}
                  </>
                )}
              </>
            )}
          </ScrollView>
        </View>

        {isDetailOpen ? (
          <View
            style={{
              width: taskDetailPanelWidth,
              minWidth: taskDetailPanelMinWidth,
              maxWidth: taskDetailPanelMaxWidth,
              flexShrink: 0,
              borderLeftWidth: splitDividerWidth,
              borderLeftColor: splitDividerColor,
              backgroundColor: colors.bg.card,
            }}
          >
            <TaskDetailPanel
              task={selectedTask as Task}
              businessId={businessId}
              teamMembers={membersWithCurrentUser}
              currentUserId={currentUserId}
              commentCount={commentCounts[(selectedTask as Task).id] ?? 0}
              onClose={() => setSelectedTaskId(null)}
              onSaved={invalidateTaskQueries}
              onDeleted={async () => {
                await invalidateTaskQueries();
                setSelectedTaskId(null);
              }}
              onStatusChange={async (next) => {
                await quickStatusMutation.mutateAsync({ task: selectedTask as Task, next });
              }}
            />
          </View>
        ) : null}
      </View>

      <TaskCreateModal
        visible={showCreateModal}
        form={createForm}
        teamMembers={membersWithCurrentUser}
        currentUserId={currentUserId}
        onChange={(patch) => setCreateForm((current) => ({ ...current, ...patch }))}
        onToggleAssignee={(userId) => {
          setCreateForm((current) => ({
            ...current,
            assigneeUserIds: current.assigneeUserIds.includes(userId)
              ? current.assigneeUserIds.filter((id) => id !== userId)
              : [...current.assigneeUserIds, userId],
          }));
        }}
        onClose={() => setShowCreateModal(false)}
        isSubmitting={createMutation.isPending}
        onSubmit={() => {
          createMutation.mutate({
            businessId,
            title: createForm.title.trim(),
            description: createForm.description.trim(),
            priority: createForm.priority,
            dueDate: createForm.dueDate ? format(createForm.dueDate, 'yyyy-MM-dd') : null,
            assigneeUserIds: createForm.assigneeUserIds,
            recurrenceFrequency: createForm.recurrenceFrequency,
            recurrenceInterval: createForm.recurrenceInterval,
          });
        }}
      />

      <Modal
        visible={showMobileFilterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMobileFilterModal(false)}
      >
        <Pressable
          onPress={() => setShowMobileFilterModal(false)}
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              width: '100%',
              maxHeight: '72%',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              backgroundColor: colors.bg.primary,
              overflow: 'hidden',
            }}
          >
            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
              <View style={{ width: 40, height: 4, borderRadius: 999, backgroundColor: colors.border.light }} />
            </View>

            <View
              style={{
                paddingHorizontal: 20,
                paddingBottom: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottomWidth: 1,
                borderBottomColor: colors.border.light,
              }}
            >
              <Text style={{ color: colors.text.primary, fontSize: 18, fontWeight: '700' }}>
                Filter Tasks
              </Text>
              <Pressable
                onPress={() => setShowMobileFilterModal(false)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.bg.secondary,
                }}
              >
                <X size={18} color={colors.text.tertiary} strokeWidth={2} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 }}>
                <Text style={{ color: colors.text.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                  Filter
                </Text>

                {[
                  { id: 'all' as TaskFilter, label: 'All tasks', description: 'Show all task statuses', icon: Funnel },
                  { id: 'pending' as TaskFilter, label: 'Pending only', description: 'Todo and in progress', icon: Clock3 },
                  { id: 'done' as TaskFilter, label: 'Completed only', description: 'Finished tasks only', icon: CheckCircle2 },
                ].map((option) => {
                  const Icon = option.icon;
                  const active = filter === option.id;
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => {
                        setKpiScope('all');
                        setFilter(option.id);
                      }}
                      style={{
                        minHeight: 54,
                        paddingVertical: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <Icon size={18} color={active ? colors.text.primary : colors.text.muted} strokeWidth={2} />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '600' }}>
                          {option.label}
                        </Text>
                        <Text style={{ color: colors.text.muted, fontSize: 12, marginTop: 1 }}>
                          {option.description}
                        </Text>
                      </View>
                      {active ? (
                        <View style={{ width: 20, height: 20, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.text.primary }}>
                          <Check size={12} color={colors.bg.primary} strokeWidth={2.8} />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16, gap: 10 }}>
                <Pressable
                  onPress={() => {
                    setKpiScope('all');
                    setFilter('all');
                  }}
                  style={{
                    height: 42,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border.light,
                    backgroundColor: colors.bg.secondary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '600' }}>
                    Clear filters
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setShowMobileFilterModal(false)}
                  style={{
                    height: 48,
                    borderRadius: 12,
                    backgroundColor: colors.text.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: colors.bg.primary, fontSize: 14, fontWeight: '700' }}>
                    Apply
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {renderTaskToast()}

    </View>
  );
}
