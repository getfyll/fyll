import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, Trash2, Tag } from 'lucide-react-native';
import useFyllStore from '@/lib/state/fyll-store';
import { useThemeColors } from '@/lib/theme';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import * as Haptics from 'expo-haptics';

// Hairline separator colors
const SEPARATOR_LIGHT = '#EEEEEE';
const SEPARATOR_DARK = '#333333';

export default function CategoryManagerScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const isDark = colors.bg.primary === '#111111';
  const separatorColor = isDark ? SEPARATOR_DARK : SEPARATOR_LIGHT;

  const categories = useFyllStore((s) => s.categories);
  const addCategory = useFyllStore((s) => s.addCategory);
  const deleteCategory = useFyllStore((s) => s.deleteCategory);

  const [newCategoryName, setNewCategoryName] = useState('');

  const handleAddCategory = () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;

    if (categories.includes(trimmed)) {
      Alert.alert('Duplicate', 'This category already exists.');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addCategory(trimmed);
    setNewCategoryName('');
  };

  const handleDeleteCategory = (category: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${category}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            deleteCategory(category);
          },
        },
      ]
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 py-4" style={{ borderBottomWidth: 0.5, borderBottomColor: separatorColor }}>
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 rounded-xl items-center justify-center active:opacity-50"
            style={{ backgroundColor: colors.bg.secondary }}
          >
            <ArrowLeft size={20} color={colors.text.primary} strokeWidth={2} />
          </Pressable>
          <Text style={{ color: colors.text.primary }} className="text-lg font-bold">Categories</Text>
          <View className="w-10" />
        </View>

        <KeyboardAwareScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} enableOnAndroid extraScrollHeight={100}>
          {/* Add New Category */}
          <View className="rounded-xl p-4 mt-4" style={{ backgroundColor: colors.bg.card, borderWidth: 0.5, borderColor: separatorColor }}>
            <Text style={{ color: colors.text.primary }} className="font-bold text-sm mb-3">Add New Category</Text>
            <View className="flex-row gap-3">
              <View className="flex-1 rounded-xl px-4" style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 52, justifyContent: 'center' }}>
                <TextInput
                  placeholder="Category name"
                  placeholderTextColor={colors.input.placeholder}
                  value={newCategoryName}
                  onChangeText={setNewCategoryName}
                  onSubmitEditing={handleAddCategory}
                  style={{ color: colors.input.text, fontSize: 14 }}
                  selectionColor={colors.text.primary}
                />
              </View>
              <Pressable
                onPress={handleAddCategory}
                disabled={!newCategoryName.trim()}
                className="w-14 rounded-xl items-center justify-center active:opacity-80"
                style={{ backgroundColor: newCategoryName.trim() ? colors.accent.primary : colors.border.light, height: 52 }}
              >
                <Plus size={22} color={newCategoryName.trim() ? (isDark ? '#000000' : '#FFFFFF') : colors.text.muted} strokeWidth={2.5} />
              </Pressable>
            </View>
          </View>

          {/* Info Card */}
          <View className="rounded-xl p-4 mt-4" style={{ backgroundColor: colors.bg.secondary, borderWidth: 0.5, borderColor: separatorColor }}>
            <Text style={{ color: colors.text.tertiary }} className="text-sm leading-5">
              Categories are shared across all products. Add categories here to use them when creating or editing products.
            </Text>
          </View>

          {/* Categories List */}
          <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase mt-6 mb-3 tracking-wider">
            All Categories ({categories.length})
          </Text>

          {categories.length === 0 ? (
            <View className="rounded-xl p-6 items-center" style={{ backgroundColor: colors.bg.card, borderWidth: 0.5, borderColor: separatorColor }}>
              <View
                className="w-16 h-16 rounded-2xl items-center justify-center mb-4"
                style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)' }}
              >
                <Tag size={32} color="#3B82F6" strokeWidth={1.5} />
              </View>
              <Text style={{ color: colors.text.tertiary }} className="text-base mb-1">No categories yet</Text>
              <Text style={{ color: colors.text.muted }} className="text-sm text-center px-4">
                Add your first category above to organize your products
              </Text>
            </View>
          ) : (
            categories.map((category) => (
              <View
                key={category}
                className="mb-2"
              >
                <View
                  className="rounded-xl px-4 flex-row items-center justify-between"
                  style={{ backgroundColor: colors.bg.card, borderWidth: 0.5, borderColor: separatorColor, height: 56 }}
                >
                  <View className="flex-row items-center flex-1">
                    <View
                      className="w-8 h-8 rounded-lg items-center justify-center mr-3"
                      style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
                    >
                      <Tag size={16} color="#3B82F6" strokeWidth={2} />
                    </View>
                    <Text style={{ color: colors.text.primary }} className="font-medium text-sm">{category}</Text>
                  </View>
                  <Pressable
                    onPress={() => handleDeleteCategory(category)}
                    className="w-10 h-10 rounded-lg items-center justify-center active:opacity-50"
                    style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
                  >
                    <Trash2 size={18} color="#EF4444" strokeWidth={2} />
                  </Pressable>
                </View>
              </View>
            ))
          )}

          <View className="h-24" />
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </View>
  );
}
