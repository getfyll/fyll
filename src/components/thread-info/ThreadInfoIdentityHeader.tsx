import React from 'react';
import { Text, View } from 'react-native';
import { Hash } from 'lucide-react-native';
import { useResolvedThemeMode, useThemeColors } from '@/lib/theme';

interface ThreadInfoIdentityHeaderProps {
  threadName: string;
  memberCount: number;
  onlineCount: number;
  compact?: boolean;
}

const getInitials = (value: string) => (
  value
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
);

export function ThreadInfoIdentityHeader({
  threadName,
  memberCount,
  onlineCount,
  compact = false,
}: ThreadInfoIdentityHeaderProps) {
  const colors = useThemeColors();
  const isDark = useResolvedThemeMode() === 'dark';
  const initials = getInitials(threadName);
  const memberLabel = memberCount === 1 ? 'member' : 'members';
  const subtitle = `${memberCount} ${memberLabel}${onlineCount >= 1 ? ` · ${onlineCount} online` : ''}`;

  return (
    <View
      style={{
        backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
        paddingVertical: compact ? 20 : 36,
        paddingHorizontal: compact ? 16 : 24,
        alignItems: 'center',
        marginBottom: compact ? 8 : 16,
      }}
    >
      <View
        style={{
          width: compact ? 64 : 88,
          height: compact ? 64 : 88,
          borderRadius: compact ? 32 : 44,
          backgroundColor: colors.accent.primary,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: compact ? 10 : 16,
        }}
      >
        {initials ? (
          <Text
            style={{
              color: isDark ? '#000000' : '#FFFFFF',
              fontSize: compact ? 22 : 30,
              fontWeight: '800',
            }}
          >
            {initials}
          </Text>
        ) : (
          <Hash size={compact ? 26 : 34} color={isDark ? '#000000' : '#FFFFFF'} strokeWidth={2} />
        )}
      </View>
      <Text
        style={{
          color: colors.text.primary,
          fontSize: compact ? 18 : 24,
          fontWeight: '800',
          textAlign: 'center',
        }}
      >
        {threadName}
      </Text>
      <Text style={{ color: colors.text.muted, fontSize: compact ? 12 : 14, marginTop: compact ? 4 : 6 }}>
        {subtitle}
      </Text>
    </View>
  );
}
