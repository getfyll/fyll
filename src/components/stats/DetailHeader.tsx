import React from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { getInlineCloseHandler } from '@/lib/inline-navigation';
import { ArrowLeft, Download } from 'lucide-react-native';
import { useStatsColors } from '@/lib/theme';

interface DetailHeaderProps {
  title: string;
  subtitle?: string;
  showExport?: boolean;
  onExport?: () => void;
}

export function DetailHeader({
  title,
  subtitle,
  showExport = true,
  onExport,
}: DetailHeaderProps) {
  const router = useRouter();
  const colors = useStatsColors();

  const handleExport = () => {
    if (onExport) {
      onExport();
    } else {
      // Placeholder for CSV export
      console.log('Export to CSV - coming soon');
    }
  };

  return (
    <View
      className="flex-row items-center justify-between px-5 py-4"
      style={{
        backgroundColor: colors.bg.screen,
        borderBottomWidth: 1,
        borderBottomColor: colors.divider,
      }}
    >
      <View className="flex-row items-center flex-1">
        <Pressable
          onPress={() => {
            const inline = getInlineCloseHandler();
            if (Platform.OS === 'web' && inline) {
              inline();
            } else {
              router.back();
            }
          }}
          className="active:opacity-70 mr-3"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: colors.bg.card,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowLeft size={18} color={colors.text.primary} strokeWidth={2} />
        </Pressable>
        <View className="flex-1">
          <Text
            style={{ color: colors.text.primary }}
            className="text-xl font-bold"
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle && (
            <Text
              style={{ color: colors.text.tertiary }}
              className="text-sm mt-0.5"
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          )}
        </View>
      </View>

      {showExport && (
        <Pressable
          onPress={handleExport}
          className="flex-row items-center px-4 py-2 rounded-full"
          style={{ backgroundColor: colors.bg.card }}
        >
          <Download size={16} color={colors.text.secondary} strokeWidth={2} />
          <Text
            style={{ color: colors.text.secondary }}
            className="text-sm font-medium ml-2"
          >
            Export
          </Text>
        </Pressable>
      )}
    </View>
  );
}
