import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Alert, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, Trash2, Edit3, Check, X, Palette, Tag } from 'lucide-react-native';
import useFyllStore, { ProductVariable } from '@/lib/state/fyll-store';
import Animated, { FadeInDown, FadeInRight, FadeOutRight, Layout, SlideInRight } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { cn } from '@/lib/cn';
import { Button } from '@/components/Button';

// Force Light Theme Colors
const colors = {
  bg: {
    primary: '#FFFFFF',
    secondary: '#F9F9F9',
    card: '#FFFFFF',
  },
  text: {
    primary: '#111111',
    secondary: '#333333',
    tertiary: '#666666',
    muted: '#999999',
  },
  border: {
    light: '#E5E5E5',
    medium: '#CCCCCC',
  },
  input: {
    bg: '#FFFFFF',
    border: '#444444',
  },
};

export default function ProductVariablesScreen() {
  const router = useRouter();
  const productVariables = useFyllStore((s) => s.productVariables);
  const addProductVariable = useFyllStore((s) => s.addProductVariable);
  const updateProductVariable = useFyllStore((s) => s.updateProductVariable);
  const deleteProductVariable = useFyllStore((s) => s.deleteProductVariable);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newVariableName, setNewVariableName] = useState('');
  const [editingValueId, setEditingValueId] = useState<string | null>(null);
  const [editingValueText, setEditingValueText] = useState('');
  const [addingValueToId, setAddingValueToId] = useState<string | null>(null);
  const [newValueText, setNewValueText] = useState('');

  const handleAddVariable = () => {
    if (!newVariableName.trim()) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const newVariable: ProductVariable = {
      id: Math.random().toString(36).substring(2, 15),
      name: newVariableName.trim(),
      values: [],
    };

    addProductVariable(newVariable);
    setNewVariableName('');
    setShowAddModal(false);
  };

  const handleDeleteVariable = (variable: ProductVariable) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Delete Variable',
      `Are you sure you want to delete "${variable.name}"? This will remove all its values.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            deleteProductVariable(variable.id);
          },
        },
      ]
    );
  };

  const handleAddValue = (variableId: string) => {
    if (!newValueText.trim()) return;

    const variable = productVariables.find((v) => v.id === variableId);
    if (!variable) return;

    // Check for duplicates
    if (variable.values.includes(newValueText.trim())) {
      Alert.alert('Duplicate Value', 'This value already exists.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateProductVariable(variableId, {
      values: [...variable.values, newValueText.trim()],
    });

    setNewValueText('');
    setAddingValueToId(null);
  };

  const handleEditValue = (variableId: string, oldValue: string) => {
    if (!editingValueText.trim()) return;

    const variable = productVariables.find((v) => v.id === variableId);
    if (!variable) return;

    // Check for duplicates (excluding the current value)
    if (variable.values.filter(v => v !== oldValue).includes(editingValueText.trim())) {
      Alert.alert('Duplicate Value', 'This value already exists.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateProductVariable(variableId, {
      values: variable.values.map((v) => v === oldValue ? editingValueText.trim() : v),
    });

    setEditingValueId(null);
    setEditingValueText('');
  };

  const handleDeleteValue = (variableId: string, value: string) => {
    const variable = productVariables.find((v) => v.id === variableId);
    if (!variable) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Delete Value',
      `Are you sure you want to delete "${value}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            updateProductVariable(variableId, {
              values: variable.values.filter((v) => v !== value),
            });
          },
        },
      ]
    );
  };

  const startEditingValue = (variableId: string, value: string) => {
    setEditingValueId(`${variableId}-${value}`);
    setEditingValueText(value);
  };

  const getVariableIcon = (name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('color') || lowerName.includes('colour')) {
      return <Palette size={20} color="#A855F7" strokeWidth={2} />;
    }
    return <Tag size={20} color="#3B82F6" strokeWidth={2} />;
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 py-4 border-b" style={{ borderBottomColor: colors.border.light, backgroundColor: colors.bg.primary }}>
            <Pressable
              onPress={() => router.back()}
              className="w-10 h-10 rounded-xl items-center justify-center active:opacity-50"
              style={{ backgroundColor: colors.bg.secondary }}
            >
              <ArrowLeft size={20} color={colors.text.primary} strokeWidth={2} />
            </Pressable>
            <Text style={{ color: colors.text.primary }} className="text-lg font-bold">Product Variables</Text>
            <View className="w-10" />
          </View>

          <ScrollView className="flex-1 px-5" style={{ backgroundColor: colors.bg.secondary }} showsVerticalScrollIndicator={false}>
            {/* Info Card */}
            <Animated.View entering={FadeInDown.springify()}>
              <View className="rounded-xl p-4 mt-4 border" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.light }}>
                <Text style={{ color: colors.text.tertiary }} className="text-sm leading-5">
                  Product variables define attributes like Color, Size, or Material. Each variable can have multiple values that you can assign to product variants.
                </Text>
              </View>
            </Animated.View>

            {/* Add New Variable Button */}
            <Animated.View entering={FadeInDown.delay(50).springify()}>
              <Button
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowAddModal(true);
                }}
                icon={<Plus size={20} color="#FFFFFF" strokeWidth={2.5} />}
                className="mt-4"
              >
                Add Variable
              </Button>
            </Animated.View>

            {/* Variables List */}
            {productVariables.length === 0 ? (
              <Animated.View entering={FadeInDown.delay(100).springify()}>
                <View className="rounded-xl p-6 mt-4 border items-center" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.light }}>
                  <View
                    className="w-16 h-16 rounded-2xl items-center justify-center mb-4"
                    style={{ backgroundColor: 'rgba(168, 85, 247, 0.15)' }}
                  >
                    <Tag size={32} color="#A855F7" strokeWidth={1.5} />
                  </View>
                  <Text style={{ color: colors.text.tertiary }} className="text-base mb-1">No variables yet</Text>
                  <Text style={{ color: colors.text.muted }} className="text-sm text-center px-4">
                    Add variables like Color or Size to create product variants
                  </Text>
                </View>
              </Animated.View>
            ) : (
              productVariables.map((variable, index) => (
                <Animated.View
                  key={variable.id}
                  entering={FadeInDown.delay(100 + index * 50).springify()}
                  layout={Layout.springify()}
                  className="mt-4"
                >
                  <View className="rounded-xl p-4 border" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.light }}>
                    {/* Variable Header */}
                    <View className="flex-row items-center justify-between mb-4">
                      <View className="flex-row items-center">
                        <View
                          className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                          style={{ backgroundColor: 'rgba(168, 85, 247, 0.15)' }}
                        >
                          {getVariableIcon(variable.name)}
                        </View>
                        <View>
                          <Text style={{ color: colors.text.primary }} className="font-bold text-base">{variable.name}</Text>
                          <Text style={{ color: colors.text.muted }} className="text-xs">
                            {variable.values.length} value{variable.values.length !== 1 ? 's' : ''}
                          </Text>
                        </View>
                      </View>
                      <Pressable
                        onPress={() => handleDeleteVariable(variable)}
                        className="w-9 h-9 rounded-lg items-center justify-center active:opacity-50"
                        style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
                      >
                        <Trash2 size={18} color="#EF4444" strokeWidth={2} />
                      </Pressable>
                    </View>

                    {/* Values List */}
                    <View className="mb-3">
                      {variable.values.length === 0 ? (
                        <Text style={{ color: colors.text.muted }} className="text-sm italic">No values added yet</Text>
                      ) : (
                        variable.values.map((value) => {
                          const isEditing = editingValueId === `${variable.id}-${value}`;

                          return (
                            <Animated.View
                              key={`${variable.id}-${value}`}
                              entering={SlideInRight.springify()}
                              exiting={FadeOutRight.springify()}
                              layout={Layout.springify()}
                              className="mb-2"
                            >
                              {isEditing ? (
                                <View
                                  className="flex-row items-center rounded-xl px-3"
                                  style={{ backgroundColor: colors.bg.secondary, height: 48 }}
                                >
                                  <TextInput
                                    value={editingValueText}
                                    onChangeText={setEditingValueText}
                                    autoFocus
                                    style={{ flex: 1, color: colors.text.primary, fontSize: 14 }}
                                    selectionColor={colors.text.primary}
                                  />
                                  <Pressable
                                    onPress={() => {
                                      setEditingValueId(null);
                                      setEditingValueText('');
                                    }}
                                    className="w-8 h-8 rounded-lg items-center justify-center ml-2"
                                    style={{ backgroundColor: colors.border.light }}
                                  >
                                    <X size={16} color={colors.text.muted} strokeWidth={2} />
                                  </Pressable>
                                  <Pressable
                                    onPress={() => handleEditValue(variable.id, value)}
                                    className="w-8 h-8 rounded-lg items-center justify-center ml-1"
                                    style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)' }}
                                  >
                                    <Check size={16} color="#22C55E" strokeWidth={2} />
                                  </Pressable>
                                </View>
                              ) : (
                                <View
                                  className="flex-row items-center justify-between rounded-xl px-4"
                                  style={{ backgroundColor: colors.bg.secondary, height: 48 }}
                                >
                                  <Text style={{ color: colors.text.primary }} className="text-sm font-medium">{value}</Text>
                                  <View className="flex-row items-center gap-1">
                                    <Pressable
                                      onPress={() => startEditingValue(variable.id, value)}
                                      className="w-8 h-8 rounded-lg items-center justify-center active:opacity-50"
                                      style={{ backgroundColor: colors.border.light }}
                                    >
                                      <Edit3 size={14} color={colors.text.muted} strokeWidth={2} />
                                    </Pressable>
                                    <Pressable
                                      onPress={() => handleDeleteValue(variable.id, value)}
                                      className="w-8 h-8 rounded-lg items-center justify-center active:opacity-50"
                                      style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
                                    >
                                      <Trash2 size={14} color="#EF4444" strokeWidth={2} />
                                    </Pressable>
                                  </View>
                                </View>
                              )}
                            </Animated.View>
                          );
                        })
                      )}
                    </View>

                    {/* Add Value */}
                    {addingValueToId === variable.id ? (
                      <View
                        className="flex-row items-center rounded-xl px-3"
                        style={{ backgroundColor: colors.bg.secondary, height: 48 }}
                      >
                        <TextInput
                          placeholder="Enter new value..."
                          placeholderTextColor={colors.text.muted}
                          value={newValueText}
                          onChangeText={setNewValueText}
                          autoFocus
                          style={{ flex: 1, color: colors.text.primary, fontSize: 14 }}
                          selectionColor={colors.text.primary}
                          onSubmitEditing={() => handleAddValue(variable.id)}
                        />
                        <Pressable
                          onPress={() => {
                            setAddingValueToId(null);
                            setNewValueText('');
                          }}
                          className="w-8 h-8 rounded-lg items-center justify-center ml-2"
                          style={{ backgroundColor: colors.border.light }}
                        >
                          <X size={16} color={colors.text.muted} strokeWidth={2} />
                        </Pressable>
                        <Pressable
                          onPress={() => handleAddValue(variable.id)}
                          disabled={!newValueText.trim()}
                          className="w-8 h-8 rounded-lg items-center justify-center ml-1"
                          style={{
                            backgroundColor: 'rgba(34, 197, 94, 0.15)',
                            opacity: newValueText.trim() ? 1 : 0.5
                          }}
                        >
                          <Check size={16} color="#22C55E" strokeWidth={2} />
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => {
                          Haptics.selectionAsync();
                          setAddingValueToId(variable.id);
                        }}
                        className="flex-row items-center justify-center py-2.5 rounded-xl active:opacity-70"
                        style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.2)', borderStyle: 'dashed' }}
                      >
                        <Plus size={16} color="#3B82F6" strokeWidth={2.5} />
                        <Text className="text-blue-500 font-medium text-sm ml-1.5">Add Value</Text>
                      </Pressable>
                    )}
                  </View>
                </Animated.View>
              ))
            )}

            <View className="h-24" />
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Add Variable Modal - Centered */}
        <Modal
          visible={showAddModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowAddModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1"
          >
            <Pressable
              className="flex-1 items-center justify-center"
              style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
              onPress={() => setShowAddModal(false)}
            >
              <Pressable
                onPress={(e) => e.stopPropagation()}
                className="w-[90%] rounded-2xl overflow-hidden"
                style={{ backgroundColor: colors.bg.primary, maxWidth: 400 }}
              >
                {/* Header */}
                <View className="flex-row items-center justify-between px-5 py-4 border-b" style={{ borderBottomColor: colors.border.light }}>
                  <Text style={{ color: colors.text.primary }} className="font-bold text-lg">New Variable</Text>
                  <Pressable
                    onPress={() => setShowAddModal(false)}
                    className="w-8 h-8 rounded-full items-center justify-center active:opacity-50"
                    style={{ backgroundColor: colors.bg.secondary }}
                  >
                    <X size={18} color={colors.text.muted} strokeWidth={2} />
                  </Pressable>
                </View>

                <View className="px-5 py-4">
                  {/* Variable Name Input */}
                  <View className="mb-4">
                    <Text style={{ color: colors.text.primary }} className="text-sm font-medium mb-2">Variable Name</Text>
                    <View
                      className="rounded-xl px-4"
                      style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.input.border, height: 52, justifyContent: 'center' }}
                    >
                      <TextInput
                        placeholder="e.g. Size, Material, Color"
                        placeholderTextColor={colors.text.muted}
                        value={newVariableName}
                        onChangeText={setNewVariableName}
                        autoFocus
                        style={{ color: colors.text.primary, fontSize: 14 }}
                        selectionColor={colors.text.primary}
                      />
                    </View>
                  </View>

                  {/* Buttons */}
                  <View className="flex-row gap-3">
                    <Button
                      onPress={() => {
                        setShowAddModal(false);
                        setNewVariableName('');
                      }}
                      variant="secondary"
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onPress={handleAddVariable}
                      disabled={!newVariableName.trim()}
                      className="flex-1"
                    >
                      Create
                    </Button>
                  </View>
                </View>
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </View>
  );
}
