import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Download } from 'lucide-react-native';
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
      style={{ backgroundColor: colors.bg.screen }}
    >
      <View className="flex-row items-center flex-1">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: colors.bg.card }}
        >
          <ChevronLeft size={24} color={colors.text.primary} strokeWidth={2} />
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
