import React from 'react';
import { View, Text } from 'react-native';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react-native';

interface MetricTileProps {
  label: string;
  value: string;
  change?: number;
  backgroundColor?: string;
  textColor?: string;
  secondaryTextColor?: string;
}

export function MetricTile({
  label,
  value,
  change,
  backgroundColor = '#161616',
  textColor = '#FFFFFF',
  secondaryTextColor = '#666666',
}: MetricTileProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  const isNeutral = change === undefined || change === 0;

  // Muted colors for indicators
  const changeColor = isPositive ? '#4ADE80' : isNegative ? '#F87171' : secondaryTextColor;

  return (
    <View
      className="flex-1 rounded-2xl p-4"
      style={{ backgroundColor, minWidth: 80 }}
    >
      <Text style={{ color: secondaryTextColor }} className="text-xs font-medium mb-1" numberOfLines={1}>
        {label}
      </Text>
      <Text style={{ color: textColor }} className="text-lg font-bold" numberOfLines={1}>
        {value}
      </Text>
      {change !== undefined && (
        <View className="flex-row items-center mt-1">
          {isPositive && <TrendingUp size={12} color={changeColor} strokeWidth={2.5} />}
          {isNegative && <TrendingDown size={12} color={changeColor} strokeWidth={2.5} />}
          {isNeutral && <Minus size={12} color={changeColor} strokeWidth={2.5} />}
          <Text style={{ color: changeColor }} className="text-xs font-medium ml-1">
            {isPositive && '+'}
            {change.toFixed(1)}%
          </Text>
        </View>
      )}
    </View>
  );
}
