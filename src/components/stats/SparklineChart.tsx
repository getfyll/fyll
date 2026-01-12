import React from 'react';
import { View, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface SparklineChartProps {
  data: number[];
  width?: number;
  height?: number;
  strokeColor?: string;
  strokeWidth?: number;
  showGradient?: boolean;
}

export function SparklineChart({
  data,
  width = 80,
  height = 40,
  strokeColor = '#FFFFFF',
  strokeWidth = 2,
  showGradient = true,
}: SparklineChartProps) {
  if (data.length < 2) return null;

  const padding = 4;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const minValue = Math.min(...data);
  const maxValue = Math.max(...data);
  const range = maxValue - minValue || 1;

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((value - minValue) / range) * chartHeight;
    return { x, y };
  });

  const pathData = points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;

    // Create smooth curves
    const prev = points[index - 1];
    const cpx1 = prev.x + (point.x - prev.x) / 3;
    const cpx2 = prev.x + (2 * (point.x - prev.x)) / 3;
    return `${path} C ${cpx1} ${prev.y} ${cpx2} ${point.y} ${point.x} ${point.y}`;
  }, '');

  // Area fill path
  const areaPath = `${pathData} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        {showGradient && (
          <Defs>
            <LinearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={strokeColor} stopOpacity="0.3" />
              <Stop offset="1" stopColor={strokeColor} stopOpacity="0" />
            </LinearGradient>
          </Defs>
        )}
        {showGradient && (
          <Path d={areaPath} fill="url(#sparklineGradient)" />
        )}
        <Path
          d={pathData}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}
