import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MoreVertical, X } from 'lucide-react-native';
import { useResolvedThemeMode, useThemeColors } from '@/lib/theme';

interface ThreadInfoTopBarProps {
  onClose: () => void;
  onToggleMenu: () => void;
  compact?: boolean;
  safeTopInset?: number;
  title?: string;
}

export function ThreadInfoTopBar({
  onClose,
  onToggleMenu,
  compact = false,
  safeTopInset = 20,
  title = 'Thread Info',
}: ThreadInfoTopBarProps) {
  const colors = useThemeColors();
  const isDark = useResolvedThemeMode() === 'dark';

  return (
    <View
      style={{
        backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
        paddingTop: compact ? 16 : safeTopInset + 8,
        paddingBottom: compact ? 12 : 14,
        paddingHorizontal: compact ? 14 : 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
      }}
    >
      <Pressable
        onPress={onClose}
        style={{
          width: compact ? 28 : 32,
          height: compact ? 28 : 32,
          borderRadius: compact ? 14 : 16,
          backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: compact ? 10 : 12,
        }}
      >
        <X size={compact ? 16 : 18} color={colors.text.primary} strokeWidth={2.5} />
      </Pressable>
      <Text style={{ color: colors.text.primary, fontSize: compact ? 15 : 17, fontWeight: '700', flex: 1 }}>
        {title}
      </Text>
      <Pressable
        onPress={onToggleMenu}
        style={{
          width: compact ? 28 : 32,
          height: compact ? 28 : 32,
          borderRadius: compact ? 14 : 16,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MoreVertical size={compact ? 18 : 20} color={colors.text.secondary} strokeWidth={2} />
      </Pressable>
    </View>
  );
}
