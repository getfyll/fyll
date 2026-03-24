import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Bell, BellOff, Bookmark, ChevronRight, Lock, Pin, Unlock } from 'lucide-react-native';
import { useResolvedThemeMode, useThemeColors } from '@/lib/theme';

interface ThreadInfoSettingsSectionProps {
  pinnedCount: number;
  savedCount: number;
  isMuted: boolean;
  isAdmin: boolean;
  hasThreadId: boolean;
  isClosed: boolean;
  isCloseThreadPending?: boolean;
  onOpenPinned: () => void;
  onOpenSaved: () => void;
  onToggleMuted: () => void;
  onToggleClosed: () => void;
  compact?: boolean;
}

export function ThreadInfoSettingsSection({
  pinnedCount,
  savedCount,
  isMuted,
  isAdmin,
  hasThreadId,
  isClosed,
  isCloseThreadPending = false,
  onOpenPinned,
  onOpenSaved,
  onToggleMuted,
  onToggleClosed,
  compact = false,
}: ThreadInfoSettingsSectionProps) {
  const colors = useThemeColors();
  const isDark = useResolvedThemeMode() === 'dark';
  const showCloseThreadAction = isAdmin && hasThreadId;

  const rowHorizontal = compact ? 14 : 16;
  const rowVertical = compact ? 12 : 14;
  const rowGap = compact ? 12 : 14;
  const iconContainerSize = compact ? 30 : 32;
  const iconSize = compact ? 16 : 17;
  const labelFontSize = compact ? 14 : 15;
  const metaFontSize = compact ? 13 : 14;
  const chevronSize = compact ? 14 : 16;
  const toggleWidth = compact ? 40 : 44;
  const toggleHeight = compact ? 24 : 26;
  const toggleKnobSize = compact ? 20 : 22;

  return (
    <View
      style={{
        backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
        marginHorizontal: compact ? 12 : 16,
        marginBottom: compact ? 10 : 16,
        borderRadius: compact ? 12 : 14,
        overflow: 'hidden',
      }}
    >
      <Pressable
        onPress={onOpenPinned}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: rowHorizontal,
          paddingVertical: rowVertical,
          gap: rowGap,
          borderBottomWidth: 0.5,
          borderBottomColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
        }}
      >
        <View
          style={{
            width: iconContainerSize,
            height: iconContainerSize,
            borderRadius: 8,
            backgroundColor: '#F97316',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Pin size={iconSize} color="#FFFFFF" strokeWidth={2} />
        </View>
        <Text style={{ color: colors.text.primary, fontSize: labelFontSize, flex: 1 }}>Pinned messages</Text>
        <Text style={{ color: colors.text.muted, fontSize: metaFontSize }}>{pinnedCount > 0 ? pinnedCount : ''}</Text>
        <ChevronRight size={chevronSize} color={colors.text.muted} strokeWidth={2} />
      </Pressable>

      <Pressable
        onPress={onOpenSaved}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: rowHorizontal,
          paddingVertical: rowVertical,
          gap: rowGap,
          borderBottomWidth: 0.5,
          borderBottomColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
        }}
      >
        <View
          style={{
            width: iconContainerSize,
            height: iconContainerSize,
            borderRadius: 8,
            backgroundColor: '#3B82F6',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Bookmark size={iconSize} color="#FFFFFF" strokeWidth={2} />
        </View>
        <Text style={{ color: colors.text.primary, fontSize: labelFontSize, flex: 1 }}>Saved messages</Text>
        <Text style={{ color: colors.text.muted, fontSize: metaFontSize }}>{savedCount > 0 ? savedCount : ''}</Text>
        <ChevronRight size={chevronSize} color={colors.text.muted} strokeWidth={2} />
      </Pressable>

      <Pressable
        onPress={onToggleMuted}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: rowHorizontal,
          paddingVertical: rowVertical,
          gap: rowGap,
          borderBottomWidth: compact ? 0.5 : 0,
          borderBottomColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
        }}
      >
        <View
          style={{
            width: iconContainerSize,
            height: iconContainerSize,
            borderRadius: 8,
            backgroundColor: '#F59E0B',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isMuted ? (
            <BellOff size={iconSize} color="#FFFFFF" strokeWidth={2} />
          ) : (
            <Bell size={iconSize} color="#FFFFFF" strokeWidth={2} />
          )}
        </View>
        <Text style={{ color: colors.text.primary, fontSize: labelFontSize, flex: 1 }}>Mute notifications</Text>
        <View
          style={{
            width: toggleWidth,
            height: toggleHeight,
            borderRadius: toggleHeight / 2,
            backgroundColor: isMuted ? '#22C55E' : (isDark ? '#3A3A3C' : '#D1D1D6'),
            justifyContent: 'center',
            paddingHorizontal: 2,
          }}
        >
          <View
            style={{
              width: toggleKnobSize,
              height: toggleKnobSize,
              borderRadius: toggleKnobSize / 2,
              backgroundColor: '#FFFFFF',
              alignSelf: isMuted ? 'flex-end' : 'flex-start',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.2,
              shadowRadius: 2,
              elevation: 2,
            }}
          />
        </View>
      </Pressable>

      {!compact && showCloseThreadAction && (
        <View style={{ height: 0.5, backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }} />
      )}

      {showCloseThreadAction && (
        <Pressable
          onPress={onToggleClosed}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: rowHorizontal,
            paddingVertical: rowVertical,
            gap: rowGap,
          }}
        >
          <View
            style={{
              width: iconContainerSize,
              height: iconContainerSize,
              borderRadius: 8,
              backgroundColor: isClosed ? '#10B981' : '#EF4444',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isClosed ? (
              <Unlock size={iconSize} color="#FFFFFF" strokeWidth={2} />
            ) : (
              <Lock size={iconSize} color="#FFFFFF" strokeWidth={2} />
            )}
          </View>
          <Text
            style={{
              color: isClosed ? colors.status.green : colors.accent.danger,
              fontSize: labelFontSize,
              fontWeight: '600',
              flex: 1,
            }}
          >
            {isClosed ? 'Reopen Thread' : 'Close Thread'}
          </Text>
          {!compact && isCloseThreadPending && (
            <Text style={{ color: colors.text.muted, fontSize: 12 }}>Saving…</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}
