import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useResolvedThemeMode, useThemeColors } from '@/lib/theme';

export interface ThreadInfoMediaItem {
  id: string;
  fileName: string;
  uri: string;
}

interface ThreadInfoMediaSectionProps {
  items: ThreadInfoMediaItem[];
  onPressItem: (item: ThreadInfoMediaItem) => void;
  compact?: boolean;
}

export function ThreadInfoMediaSection({
  items,
  onPressItem,
  compact = false,
}: ThreadInfoMediaSectionProps) {
  const colors = useThemeColors();
  const isDark = useResolvedThemeMode() === 'dark';

  if (items.length === 0) return null;

  return (
    <View
      style={{
        backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
        marginHorizontal: compact ? 0 : 16,
        marginBottom: compact ? 8 : 16,
        borderRadius: compact ? 0 : 14,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: compact ? 14 : 16,
          paddingTop: compact ? 12 : 16,
          paddingBottom: compact ? 8 : 12,
        }}
      >
        <Text style={{ color: colors.text.primary, fontSize: compact ? 13 : 14, fontWeight: '700' }}>
          Media
        </Text>
        <Text style={{ color: colors.accent.primary, fontSize: compact ? 12 : 13, fontWeight: '600' }}>
          {items.length}
        </Text>
      </View>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          paddingHorizontal: compact ? 10 : 14,
          paddingBottom: compact ? 12 : 16,
          gap: compact ? 3 : 6,
        }}
      >
        {items.slice(0, 6).map((item) => (
          <Pressable
            key={item.id}
            onPress={() => onPressItem(item)}
            style={{
              width: compact ? 88 : 100,
              height: compact ? 72 : 80,
              borderRadius: compact ? 6 : 10,
              overflow: 'hidden',
            }}
          >
            <Image source={{ uri: item.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
