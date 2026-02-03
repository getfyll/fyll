import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus, TrendingUp, TrendingDown, Receipt, Truck, Lock } from 'lucide-react-native';
import useFyllStore, { Expense, Procurement, formatCurrency } from '@/lib/state/fyll-store';
import { cn } from '@/lib/cn';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { GlassCard } from '@/components/GlassCard';
import * as Haptics from 'expo-haptics';

type TabType = 'overview' | 'expenses' | 'procurement';

interface ExpenseRowProps {
  expense: Expense;
  delay?: number;
}

function ExpenseRow({ expense, delay = 0 }: ExpenseRowProps) {
  const date = new Date(expense.date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <Animated.View
      entering={FadeInRight.delay(delay).springify()}
      className="flex-row items-center py-3"
      style={{ borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}
    >
      <View className="w-10 h-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: '#FEE2E2' }}>
        <Receipt size={18} color="#EF4444" strokeWidth={2} />
      </View>
      <View className="flex-1">
        <Text className="text-gray-800 font-semibold text-sm">{expense.description}</Text>
        <Text className="text-gray-400 text-xs">{expense.category}</Text>
      </View>
      <View className="items-end">
        <Text className="text-red-500 font-bold text-sm">-{formatCurrency(expense.amount)}</Text>
        <Text className="text-gray-400 text-xs">{date}</Text>
      </View>
    </Animated.View>
  );
}

interface ProcurementRowProps {
  procurement: Procurement;
  delay?: number;
}

function ProcurementRow({ procurement, delay = 0 }: ProcurementRowProps) {
  const date = new Date(procurement.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  const itemCount = procurement.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Animated.View
      entering={FadeInRight.delay(delay).springify()}
      className="flex-row items-center py-3"
      style={{ borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}
    >
      <View className="w-10 h-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: '#DBEAFE' }}>
        <Truck size={18} color="#3B82F6" strokeWidth={2} />
      </View>
      <View className="flex-1">
        <Text className="text-gray-800 font-semibold text-sm">{procurement.supplierName}</Text>
        <Text className="text-gray-400 text-xs">{itemCount} items received</Text>
      </View>
      <View className="items-end">
        <Text className="text-blue-600 font-bold text-sm">{formatCurrency(procurement.totalCost)}</Text>
        <Text className="text-gray-400 text-xs">{date}</Text>
      </View>
    </Animated.View>
  );
}

export default function FinanceScreen() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const orders = useFyllStore((s) => s.orders);
  const expenses = useFyllStore((s) => s.expenses);
  const procurements = useFyllStore((s) => s.procurements);
  const userRole = useFyllStore((s) => s.userRole);

  const isOwner = userRole === 'owner';
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const financials = useMemo(() => {
    const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);

    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const totalProcurement = procurements.reduce((sum, p) => sum + p.totalCost, 0);
    const netProfit = totalRevenue - totalExpenses;

    const expenseByCategory = expenses.reduce((acc, expense) => {
      acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalRevenue,
      totalExpenses,
      totalProcurement,
      netProfit,
      expenseByCategory,
      profitMargin: totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0',
    };
  }, [orders, expenses, procurements]);

  const recentExpenses = useMemo(() => {
    return [...expenses]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [expenses]);

  const recentProcurements = useMemo(() => {
    return [...procurements]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [procurements]);

  if (!isOwner) {
    return (
      <View className="flex-1 bg-gray-50">
        <SafeAreaView className="flex-1 items-center justify-center" edges={['top']}>
          <View
            className="w-20 h-20 rounded-2xl items-center justify-center mb-4 bg-gray-100"
          >
            <Lock size={40} color="#9CA3AF" strokeWidth={1.5} />
          </View>
          <Text className="text-gray-600 text-lg font-semibold">Access Restricted</Text>
          <Text className="text-gray-400 text-sm mt-1">Financial data is only visible to owners</Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <View className="px-5 pt-6 pb-3 bg-white border-b border-gray-100">
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-gray-400 text-xs font-medium uppercase tracking-wider">Analytics</Text>
              <Text className="text-gray-900 text-2xl font-bold">Finance</Text>
            </View>
          </View>

          {/* Tab Switcher */}
          <View className="flex-row rounded-xl p-1 bg-gray-100">
            {(['overview', 'expenses', 'procurement'] as TabType[]).map((tab) => (
              <Pressable
                key={tab}
                onPress={() => {
                  Haptics.selectionAsync();
                  setActiveTab(tab);
                }}
                className="flex-1 py-2.5 rounded-lg items-center"
                style={{
                  backgroundColor: activeTab === tab ? '#FFFFFF' : 'transparent'
                }}
              >
                <Text
                  className={cn(
                    'font-semibold text-sm capitalize',
                    activeTab === tab ? 'text-emerald-600' : 'text-gray-400'
                  )}
                >
                  {tab}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
        >
          {activeTab === 'overview' && (
            <View className="pt-4">
              {/* Net Profit Hero */}
              <Animated.View entering={FadeInDown.springify()} className="mb-4">
                <View className="rounded-2xl overflow-hidden">
                  <LinearGradient
                    colors={financials.netProfit >= 0 ? ['#059669', '#10B981'] : ['#EF4444', '#DC2626']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ padding: 24, borderRadius: 20 }}
                  >
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-white/70 text-sm font-medium">Net Profit</Text>
                      <View className="flex-row items-center bg-white/20 px-2 py-1 rounded-full">
                        {financials.netProfit >= 0 ? (
                          <TrendingUp size={14} color="#FFFFFF" strokeWidth={2.5} />
                        ) : (
                          <TrendingDown size={14} color="#FFFFFF" strokeWidth={2.5} />
                        )}
                        <Text className="text-white text-xs font-bold ml-1">{financials.profitMargin}%</Text>
                      </View>
                    </View>
                    <Text className="text-white text-4xl font-bold tracking-tight">
                      {formatCurrency(Math.abs(financials.netProfit))}
                    </Text>
                    <Text className="text-white/60 text-sm mt-1">After all expenses</Text>
                  </LinearGradient>
                </View>
              </Animated.View>

              {/* P&L Breakdown */}
              <Animated.View entering={FadeInDown.delay(100).springify()}>
                <GlassCard>
                  <Text className="text-gray-800 font-bold text-base mb-4">Profit & Loss</Text>

                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-gray-500 text-sm">Total Revenue</Text>
                    <Text className="text-emerald-600 font-bold text-lg">{formatCurrency(financials.totalRevenue)}</Text>
                  </View>

                  <View className="flex-row items-center justify-between">
                    <Text className="text-gray-500 text-sm">Operating Expenses</Text>
                    <Text className="text-red-500 font-semibold">-{formatCurrency(financials.totalExpenses)}</Text>
                  </View>
                </GlassCard>
              </Animated.View>

              {/* Expense Breakdown */}
              <Animated.View entering={FadeInDown.delay(200).springify()} className="mt-4">
                <GlassCard>
                  <Text className="text-gray-800 font-bold text-base mb-4">Expense Breakdown</Text>
                  {Object.entries(financials.expenseByCategory).map(([category, amount]) => (
                    <View key={category} className="flex-row items-center justify-between mb-3">
                      <Text className="text-gray-500 text-sm">{category}</Text>
                      <Text className="text-gray-800 font-semibold">{formatCurrency(amount)}</Text>
                    </View>
                  ))}
                  {Object.keys(financials.expenseByCategory).length === 0 && (
                    <Text className="text-gray-400 text-sm text-center py-4">No expenses recorded</Text>
                  )}
                </GlassCard>
              </Animated.View>
            </View>
          )}

          {activeTab === 'expenses' && (
            <View className="pt-4">
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push('/new-expense');
                }}
                className="mb-4 rounded-xl overflow-hidden active:opacity-80"
              >
                <LinearGradient
                  colors={['#EF4444', '#DC2626']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
                >
                  <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
                  <Text className="text-white font-semibold ml-2">Add Expense</Text>
                </LinearGradient>
              </Pressable>

              <GlassCard>
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-gray-800 font-bold text-base">Recent Expenses</Text>
                  <Text className="text-gray-400 text-sm">Total: {formatCurrency(financials.totalExpenses)}</Text>
                </View>
                {recentExpenses.length === 0 ? (
                  <Text className="text-gray-400 text-sm text-center py-8">No expenses yet</Text>
                ) : (
                  recentExpenses.map((expense, index) => (
                    <ExpenseRow key={expense.id} expense={expense} delay={index * 50} />
                  ))
                )}
              </GlassCard>
            </View>
          )}

          {activeTab === 'procurement' && (
            <View className="pt-4">
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push('/new-procurement');
                }}
                className="mb-4 rounded-xl overflow-hidden active:opacity-80"
              >
                <LinearGradient
                  colors={['#3B82F6', '#2563EB']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
                >
                  <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
                  <Text className="text-white font-semibold ml-2">Record Procurement</Text>
                </LinearGradient>
              </Pressable>

              <GlassCard>
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-gray-800 font-bold text-base">Recent Procurements</Text>
                  <Text className="text-gray-400 text-sm">Total: {formatCurrency(financials.totalProcurement)}</Text>
                </View>
                {recentProcurements.length === 0 ? (
                  <Text className="text-gray-400 text-sm text-center py-8">No procurements yet</Text>
                ) : (
                  recentProcurements.map((procurement, index) => (
                    <ProcurementRow key={procurement.id} procurement={procurement} delay={index * 50} />
                  ))
                )}
              </GlassCard>
            </View>
          )}

          <View className="h-24" />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
