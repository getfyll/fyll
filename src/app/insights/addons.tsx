import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Package, DollarSign } from 'lucide-react-native';
import { DetailHeader } from '@/components/stats/DetailHeader';
import { BreakdownTable } from '@/components/stats/BreakdownTable';
import { HorizontalBarChart } from '@/components/stats/HorizontalBarChart';
import { useAnalytics } from '@/hooks/useAnalytics';
import { formatCurrency } from '@/lib/state/fyll-store';
import { TimeRange } from '@/lib/analytics-utils';
import { useStatsColors } from '@/lib/theme';

export default function AddonsInsightScreen() {
  const colors = useStatsColors();
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const analytics = useAnalytics(timeRange, 'sales');

  const timeRangeOptions: { key: TimeRange; label: string }[] = [
    { key: '7d', label: 'Last 7 days' },
    { key: '30d', label: 'Last 30 days' },
    { key: 'year', label: 'This Year' },
  ];

  // Add-ons table rows
  const addOnRows = analytics.topAddOns.map((item) => ({
    label: item.name,
    value: formatCurrency(item.revenue),
    subValue: `${item.count} orders`,
    percentage: undefined,
  }));

  // Add-ons for chart
  const addOnChartData = analytics.topAddOns.map((item) => ({
    label: item.name,
    value: item.revenue,
    percentage: Math.round(
      (item.revenue /
        (analytics.topAddOns.reduce((sum, a) => sum + a.revenue, 0) || 1)) *
        100
    ),
  }));

  // Calculate totals
  const totalAddOnRevenue = analytics.topAddOns.reduce(
    (sum, item) => sum + item.revenue,
    0
  );
  const totalAddOnOrders = analytics.topAddOns.reduce(
    (sum, item) => sum + item.count,
    0
  );

  // Top add-on
  const topAddOn = analytics.topAddOns[0];

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.screen }}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView className="flex-1" edges={['top']}>
        <DetailHeader
          title="Add-ons Analytics"
          subtitle="Service and add-on performance"
        />

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        >
          {/* Time Range Selector */}
          <View className="flex-row mt-4">
            {timeRangeOptions.map((option) => (
              <Pressable
                key={option.key}
                onPress={() => setTimeRange(option.key)}
                className="mr-2 px-4 py-2 rounded-full"
                style={{
                  backgroundColor:
                    timeRange === option.key ? colors.bar : colors.bg.input,
                }}
              >
                <Text
                  style={{
                    color:
                      timeRange === option.key
                        ? colors.bg.screen
                        : colors.text.tertiary,
                  }}
                  className="text-sm font-semibold"
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Total Add-on Revenue Card */}
          <View
            className="rounded-2xl p-5 mt-4"
            style={colors.getCardStyle()}
          >
            <View className="flex-row items-center mb-2">
              <DollarSign size={20} color={colors.text.tertiary} strokeWidth={2} />
              <Text
                style={{ color: colors.text.tertiary }}
                className="text-sm font-medium ml-2"
              >
                Total Add-on Revenue
              </Text>
            </View>
            <Text
              style={{ color: colors.text.primary }}
              className="text-4xl font-bold"
            >
              {formatCurrency(totalAddOnRevenue)}
            </Text>
            <Text
              style={{ color: colors.text.secondary }}
              className="text-base mt-1"
            >
              From {totalAddOnOrders} orders
            </Text>
          </View>

          {/* Top Add-on Card */}
          {topAddOn && (
            <View
              className="rounded-2xl p-5 mt-4"
              style={colors.getCardStyle()}
            >
              <View className="flex-row items-center mb-2">
                <Package size={20} color={colors.text.tertiary} strokeWidth={2} />
                <Text
                  style={{ color: colors.text.tertiary }}
                  className="text-sm font-medium ml-2"
                >
                  Top Add-on
                </Text>
              </View>
              <Text
                style={{ color: colors.text.primary }}
                className="text-2xl font-bold"
              >
                {topAddOn.name}
              </Text>
              <View className="flex-row items-center mt-2">
                <Text
                  style={{ color: colors.success }}
                  className="text-lg font-semibold"
                >
                  {formatCurrency(topAddOn.revenue)}
                </Text>
                <Text
                  style={{ color: colors.text.tertiary }}
                  className="text-sm ml-2"
                >
                  from {topAddOn.count} orders
                </Text>
              </View>
            </View>
          )}

          {/* Add-ons Revenue Chart */}
          {addOnChartData.length > 0 && (
            <View
              className="rounded-2xl p-5 mt-4"
              style={colors.getCardStyle()}
            >
              <Text
                style={{ color: colors.text.primary }}
                className="text-lg font-bold mb-4"
              >
                Revenue by Add-on
              </Text>
              <HorizontalBarChart
                data={addOnChartData}
                barColor={colors.bar}
                backgroundColor={colors.barBg}
                textColor={colors.text.primary}
                secondaryTextColor={colors.text.tertiary}
                formatValue={(v) => formatCurrency(v)}
              />
            </View>
          )}

          {/* Add-ons Breakdown Table */}
          <View className="mt-4">
            <BreakdownTable
              title="All Add-ons"
              data={addOnRows}
              columns={{
                label: 'Add-on',
                value: 'Revenue',
              }}
              showIndex={true}
              emptyMessage="No add-on data available"
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
