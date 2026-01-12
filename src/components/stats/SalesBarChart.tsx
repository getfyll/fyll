import React from 'react';
import { View, Text, Dimensions } from 'react-native';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';

interface BarChartData {
  label: string;
  value: number;
}

interface SalesBarChartProps {
  data: BarChartData[];
  height?: number;
  barColor?: string;
  gridColor?: string;
  textColor?: string;
  showTopValue?: boolean;
}

const { width: screenWidth } = Dimensions.get('window');

export function SalesBarChart({
  data,
  height = 200,
  barColor = '#FFFFFF',
  gridColor = '#2A2A2A',
  textColor = '#666666',
  showTopValue = true,
}: SalesBarChartProps) {
  if (data.length === 0) return null;

  const chartWidth = screenWidth - 80; // Account for padding and y-axis
  const chartHeight = height - 40; // Account for x-axis labels
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 30;

  const availableWidth = chartWidth - paddingLeft - paddingRight;
  const availableHeight = chartHeight;

  // Bar sizing - thick bars with spacing
  const barWidth = 20;
  const totalBarsWidth = data.length * barWidth;
  const totalSpacing = availableWidth - totalBarsWidth;
  const barSpacing = totalSpacing / (data.length + 1);

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const roundedMax = Math.ceil(maxValue / 100) * 100;

  // Find the index of max value for highlighting
  const maxIndex = data.findIndex((d) => d.value === maxValue);

  // Y-axis labels
  const yLabels = [0, roundedMax * 0.5, roundedMax].map((v) =>
    v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toString()
  );

  // Gridlines (3 horizontal lines)
  const gridLines = [0, 0.5, 1];

  return (
    <View style={{ width: chartWidth + 10, height: height + 10 }}>
      <Svg width={chartWidth + 10} height={height + 10}>
        {/* Gridlines */}
        {gridLines.map((ratio, index) => {
          const y = paddingTop + availableHeight * (1 - ratio);
          return (
            <Line
              key={`grid-${index}`}
              x1={paddingLeft}
              y1={y}
              x2={chartWidth}
              y2={y}
              stroke={gridColor}
              strokeWidth={1}
              strokeDasharray="4,4"
            />
          );
        })}

        {/* Y-axis labels */}
        {yLabels.map((label, index) => {
          const y = paddingTop + availableHeight * (1 - index * 0.5);
          return (
            <SvgText
              key={`y-label-${index}`}
              x={paddingLeft - 8}
              y={y + 4}
              fill={textColor}
              fontSize={11}
              fontWeight="500"
              textAnchor="end"
            >
              {label}
            </SvgText>
          );
        })}

        {/* Bars */}
        {data.map((item, index) => {
          const barHeight = (item.value / roundedMax) * availableHeight;
          const x = paddingLeft + barSpacing + index * (barWidth + barSpacing);
          const y = paddingTop + availableHeight - barHeight;
          const isMax = index === maxIndex && showTopValue;

          return (
            <React.Fragment key={`bar-${index}`}>
              {/* Bar with rounded top */}
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={barColor}
                rx={6}
                ry={6}
              />
              {/* Value label on top of max bar */}
              {isMax && item.value > 0 && (
                <SvgText
                  x={x + barWidth / 2}
                  y={y - 8}
                  fill={barColor}
                  fontSize={12}
                  fontWeight="700"
                  textAnchor="middle"
                >
                  {item.value >= 1000
                    ? `${(item.value / 1000).toFixed(0)}k`
                    : item.value.toString()}
                </SvgText>
              )}
            </React.Fragment>
          );
        })}

        {/* X-axis labels */}
        {data.map((item, index) => {
          const x = paddingLeft + barSpacing + index * (barWidth + barSpacing) + barWidth / 2;
          return (
            <SvgText
              key={`x-label-${index}`}
              x={x}
              y={paddingTop + availableHeight + 18}
              fill={textColor}
              fontSize={10}
              fontWeight="500"
              textAnchor="middle"
            >
              {item.label}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}
