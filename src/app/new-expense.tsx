import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X, Calendar } from 'lucide-react-native';
import useFyllStore from '@/lib/state/fyll-store';
import { cn } from '@/lib/cn';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function NewExpenseScreen() {
  const router = useRouter();
  const expenseCategories = useFyllStore((s) => s.expenseCategories);
  const addExpense = useFyllStore((s) => s.addExpense);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(expenseCategories[0]?.name || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const handleSubmit = () => {
    if (!description.trim() || !amount || !category) return;

    addExpense({
      id: Math.random().toString(36).substring(2, 15),
      category,
      description: description.trim(),
      amount: parseFloat(amount) || 0,
      date: new Date(date).toISOString(),
      createdAt: new Date().toISOString(),
    });

    router.back();
  };

  const isValid = description.trim() && amount && parseFloat(amount) > 0 && category;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100">
          <Pressable onPress={() => router.back()} className="active:opacity-50">
            <X size={24} color="#111111" strokeWidth={2} />
          </Pressable>
          <Text className="text-lg font-bold text-gray-900">New Expense</Text>
          <Pressable
            onPress={handleSubmit}
            disabled={!isValid}
            className={cn(
              'px-4 py-2 rounded-xl',
              isValid ? 'bg-gray-900 active:opacity-80' : 'bg-gray-200'
            )}
          >
            <Text className={cn('font-semibold text-sm', isValid ? 'text-white' : 'text-gray-400')}>
              Add
            </Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
          {/* Amount */}
          <Animated.View entering={FadeInDown.duration(400)} className="mt-6 items-center">
            <Text className="text-gray-500 text-sm font-medium mb-2">Amount</Text>
            <View className="flex-row items-center">
              <Text className="text-gray-900 text-4xl font-bold mr-1">$</Text>
              <TextInput
                placeholder="0"
                placeholderTextColor="#D1D5DB"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                className="text-gray-900 text-5xl font-bold min-w-16"
                style={{ fontSize: 48 }}
              />
            </View>
          </Animated.View>

          {/* Category */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)} className="mt-8">
            <Text className="text-gray-900 font-bold text-base mb-3">Category</Text>
            <View className="flex-row flex-wrap gap-2">
              {expenseCategories.map((cat) => (
                <Pressable
                  key={cat.id}
                  onPress={() => setCategory(cat.name)}
                  className={cn(
                    'px-4 py-2.5 rounded-xl',
                    category === cat.name ? 'bg-gray-900' : 'bg-gray-100'
                  )}
                >
                  <Text
                    className={cn(
                      'font-semibold text-sm',
                      category === cat.name ? 'text-white' : 'text-gray-600'
                    )}
                  >
                    {cat.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {/* Description */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)} className="mt-6">
            <Text className="text-gray-900 font-bold text-base mb-3">Description</Text>
            <TextInput
              placeholder="What was this expense for?"
              placeholderTextColor="#9CA3AF"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900 text-sm"
              style={{ minHeight: 100 }}
            />
          </Animated.View>

          {/* Date */}
          <Animated.View entering={FadeInDown.delay(300).duration(400)} className="mt-6">
            <Text className="text-gray-900 font-bold text-base mb-3">Date</Text>
            <View className="bg-gray-100 rounded-xl px-4 py-3 flex-row items-center">
              <Calendar size={20} color="#6B7280" strokeWidth={2} />
              <TextInput
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9CA3AF"
                value={date}
                onChangeText={setDate}
                className="flex-1 ml-3 text-gray-900 text-sm"
              />
            </View>
          </Animated.View>

          <View className="h-24" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
