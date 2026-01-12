import React from 'react';
import { View, Text } from 'react-native';

interface HorizontalBarData {
  label: string;
  value: number;
  percentage?: number;
}

interface HorizontalBarChartProps {
  data: HorizontalBarData[];
  barColor?: string;
  backgroundColor?: string;
  textColor?: string;
  secondaryTextColor?: string;
  showPercentage?: boolean;
  formatValue?: (value: number) => string;
}

export function HorizontalBarChart({
  data,
  barColor = '#FFFFFF',
  backgroundColor = '#2A2A2A',
  textColor = '#FFFFFF',
  secondaryTextColor = '#666666',
  showPercentage = true,
  formatValue,
}: HorizontalBarChartProps) {
  if (data.length === 0) return null;

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <View className="space-y-3">
      {data.map((item, index) => {
        const percentage = item.percentage ?? (item.value / maxValue) * 100;
        const displayValue = formatValue ? formatValue(item.value) : item.value.toString();

        return (
          <View key={index} className="mb-3">
            <View className="flex-row items-center justify-between mb-1.5">
              <Text style={{ color: textColor }} className="text-sm font-medium">
                {item.label}
              </Text>
              <View className="flex-row items-center">
                <Text style={{ color: textColor }} className="text-sm font-semibold">
                  {displayValue}
                </Text>
                {showPercentage && (
                  <Text style={{ color: secondaryTextColor }} className="text-xs ml-2">
                    {percentage.toFixed(0)}%
                  </Text>
                )}
              </View>
            </View>
            <View
              className="h-3 rounded-full overflow-hidden"
              style={{ backgroundColor }}
            >
              <View
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(percentage, 100)}%`,
                  backgroundColor: barColor,
                }}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}
