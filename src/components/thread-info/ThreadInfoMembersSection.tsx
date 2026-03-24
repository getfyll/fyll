import React from 'react';
import { Text, View } from 'react-native';
import { useResolvedThemeMode, useThemeColors } from '@/lib/theme';

interface ThreadInfoMemberLike {
  id: string;
  name: string;
  role: string;
}

interface CurrentUserLike {
  id?: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
}

interface ThreadInfoMembersSectionProps {
  currentUser: CurrentUserLike | null;
  mentionableMembers: ThreadInfoMemberLike[];
  memberCount: number;
  compact?: boolean;
}

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
};

export function ThreadInfoMembersSection({
  currentUser,
  mentionableMembers,
  memberCount,
  compact = false,
}: ThreadInfoMembersSectionProps) {
  const colors = useThemeColors();
  const isDark = useResolvedThemeMode() === 'dark';

  const containerHorizontal = compact ? 12 : 16;
  const containerBottom = compact ? 24 : 16;
  const containerRadius = compact ? 12 : 14;
  const headerHorizontal = compact ? 14 : 16;
  const headerFontSize = compact ? 11 : 12;
  const headerLetterSpacing = compact ? 0.8 : 0.8;
  const rowHorizontal = compact ? 14 : 16;
  const rowVertical = compact ? 9 : 10;
  const rowGap = compact ? 10 : 12;
  const avatarSize = compact ? 36 : 40;
  const nameFontSize = compact ? 14 : 15;
  const roleFontSize = compact ? 11 : 12;
  const tagHorizontal = compact ? 7 : 8;
  const tagVertical = compact ? 2 : 3;
  const tagRadius = compact ? 5 : 6;
  const tagFontSize = compact ? 10 : 11;
  const palette = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444'];

  return (
    <View
      style={{
        backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
        marginHorizontal: containerHorizontal,
        marginBottom: containerBottom,
        borderRadius: containerRadius,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          paddingHorizontal: headerHorizontal,
          paddingTop: 16,
          paddingBottom: compact ? 6 : 8,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text
          style={{
            color: colors.text.muted,
            fontSize: headerFontSize,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: headerLetterSpacing,
          }}
        >
          {memberCount} Members
        </Text>
      </View>

      {currentUser && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: rowHorizontal,
            paddingVertical: rowVertical,
            gap: rowGap,
            borderBottomWidth: 0.5,
            borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
          }}
        >
          <View
            style={{
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
              backgroundColor: colors.accent.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: isDark ? '#000000' : '#FFFFFF', fontSize: compact ? 13 : 14, fontWeight: '800' }}>
              {getInitials(currentUser.name ?? currentUser.email ?? 'Me')}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text.primary, fontSize: nameFontSize, fontWeight: '600' }}>
              {currentUser.name ?? 'You'}
            </Text>
            <Text style={{ color: colors.text.muted, fontSize: roleFontSize }}>
              {currentUser.role ?? 'Member'}
            </Text>
          </View>
          <View
            style={{
              backgroundColor: isDark ? '#2C2C2E' : '#F3F4F6',
              paddingHorizontal: tagHorizontal,
              paddingVertical: tagVertical,
              borderRadius: tagRadius,
            }}
          >
            <Text style={{ color: colors.text.muted, fontSize: tagFontSize, fontWeight: '700' }}>You</Text>
          </View>
        </View>
      )}

      {mentionableMembers.map((member, idx) => {
        const memberColor = palette[idx % palette.length] ?? '#3B82F6';
        return (
          <View
            key={member.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: rowHorizontal,
              paddingVertical: rowVertical,
              gap: rowGap,
              borderBottomWidth: idx < mentionableMembers.length - 1 ? 0.5 : 0,
              borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
            }}
          >
            <View
              style={{
                width: avatarSize,
                height: avatarSize,
                borderRadius: avatarSize / 2,
                backgroundColor: memberColor,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: compact ? 13 : 14, fontWeight: '800' }}>
                {getInitials(member.name)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text.primary, fontSize: nameFontSize, fontWeight: '600' }}>
                {member.name}
              </Text>
              <Text style={{ color: colors.text.muted, fontSize: roleFontSize, textTransform: 'capitalize' }}>
                {member.role}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
