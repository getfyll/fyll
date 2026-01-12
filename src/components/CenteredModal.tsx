import React from 'react';
import { View, Text, Modal, Pressable, KeyboardAvoidingView, Platform, ScrollView, TextInput } from 'react-native';
import { X } from 'lucide-react-native';

interface CenteredModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxHeight?: `${number}%` | number;
}

export function CenteredModal({ visible, onClose, title, children, maxHeight = '80%' }: CenteredModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        keyboardVerticalOffset={0}
      >
        <Pressable
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          onPress={onClose}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="w-[90%] rounded-2xl overflow-hidden"
            style={{
              backgroundColor: '#111111',
              maxHeight,
              maxWidth: 400,
            }}
          >
            {/* Header */}
            <View
              className="flex-row items-center justify-between px-5 py-4 border-b"
              style={{ borderBottomColor: '#333333' }}
            >
              <Text className="text-white font-bold text-lg">{title}</Text>
              <Pressable
                onPress={onClose}
                className="w-8 h-8 rounded-full items-center justify-center active:opacity-50"
                style={{ backgroundColor: '#222222' }}
              >
                <X size={18} color="#888888" strokeWidth={2} />
              </Pressable>
            </View>

            {/* Content */}
            <ScrollView
              className="px-5 py-4"
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {children}
              <View className="h-4" />
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Dark themed input field component
interface DarkInputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: 'default' | 'numeric' | 'phone-pad' | 'email-address' | 'decimal-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  multiline?: boolean;
  numberOfLines?: number;
  autoFocus?: boolean;
  height?: number;
  prefix?: string;
}

export function DarkInput({
  label,
  placeholder,
  value,
  onChangeText,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  multiline = false,
  numberOfLines = 1,
  autoFocus = false,
  height = 52,
  prefix,
}: DarkInputProps) {
  return (
    <View className="mb-4">
      {label && (
        <Text className="text-white text-sm font-medium mb-2">{label}</Text>
      )}
      <View
        className="rounded-xl px-4 flex-row items-center"
        style={{
          backgroundColor: '#000000',
          borderWidth: 1,
          borderColor: '#444444',
          height: multiline ? undefined : height,
          minHeight: multiline ? height : undefined,
        }}
      >
        {prefix && (
          <Text style={{ color: '#888888', fontSize: 14, marginRight: 4 }}>{prefix}</Text>
        )}
        <View className="flex-1" style={{ justifyContent: multiline ? 'flex-start' : 'center', paddingVertical: multiline ? 12 : 0 }}>
          <TextInput
            placeholder={placeholder}
            placeholderTextColor="#888888"
            value={value}
            onChangeText={onChangeText}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            multiline={multiline}
            numberOfLines={numberOfLines}
            autoFocus={autoFocus}
            style={{
              color: '#FFFFFF',
              fontSize: 14,
              textAlignVertical: multiline ? 'top' : 'center',
              flex: multiline ? 1 : undefined,
            }}
            selectionColor="#FFFFFF"
            cursorColor="#FFFFFF"
          />
        </View>
      </View>
    </View>
  );
}
