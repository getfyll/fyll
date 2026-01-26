import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, TextInput, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Building2, Camera, X, Check, Phone, Globe, MapPin } from 'lucide-react-native';
import { useThemeColors } from '@/lib/theme';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { compressImage } from '@/lib/image-compression';

export default function BusinessSettingsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { businessName, businessLogo, businessPhone, businessWebsite, returnAddress, isLoading, saveSettings } = useBusinessSettings();

  const [name, setName] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form with current values
  useEffect(() => {
    if (!isLoading) {
      setName(businessName);
      setLogo(businessLogo);
      setPhone(businessPhone);
      setWebsite(businessWebsite);
      setAddress(returnAddress);
    }
  }, [isLoading, businessName, businessLogo, businessPhone, businessWebsite, returnAddress]);

  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photo library to upload a logo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const compressedUri = await compressImage(result.assets[0].uri);
        setLogo(compressedUri);
      }
    } catch {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleRemoveLogo = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLogo(null);
  };

  const handleSave = async () => {
    setError(null);
    setIsSaving(true);

    try {
      const result = await saveSettings({
        businessLogo: logo,
        businessPhone: phone.trim(),
        businessWebsite: website.trim(),
        returnAddress: address.trim(),
      });

      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
      } else {
        setError(result.error || 'Failed to save settings');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch {
      setError('Failed to save settings');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = logo !== businessLogo || phone !== businessPhone || website !== businessWebsite || address !== returnAddress;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.bg.primary }}>
        <ActivityIndicator size="large" color={colors.text.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <View className="px-5 pt-4 pb-3 flex-row items-center justify-between" style={{ borderBottomWidth: 1, borderBottomColor: colors.border.light }}>
          <View className="flex-row items-center">
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.back();
              }}
              className="w-10 h-10 rounded-xl items-center justify-center mr-3 active:opacity-50"
              style={{ backgroundColor: colors.bg.secondary }}
            >
              <ChevronLeft size={20} color={colors.text.primary} strokeWidth={2} />
            </Pressable>
            <Text style={{ color: colors.text.primary }} className="text-xl font-bold">Business Settings</Text>
          </View>

          {hasChanges && (
            <Pressable
              onPress={handleSave}
              disabled={isSaving}
              className="px-4 h-10 rounded-xl items-center justify-center active:opacity-80"
              style={{ backgroundColor: '#111111' }}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <View className="flex-row items-center">
                  <Check size={16} color="#FFFFFF" strokeWidth={2} />
                  <Text className="text-white font-semibold text-sm ml-1">Save</Text>
                </View>
              )}
            </Pressable>
          )}
        </View>

        <KeyboardAwareScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false} enableOnAndroid extraScrollHeight={100}>
          {/* Business Logo */}
          <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase mb-3 tracking-wider">Business Logo</Text>

          <View className="rounded-xl p-4 mb-6" style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
            <View className="items-center">
              {logo ? (
                <View className="relative">
                  <Image
                    source={{ uri: logo }}
                    className="w-24 h-24 rounded-2xl"
                    resizeMode="cover"
                  />
                  <Pressable
                    onPress={handleRemoveLogo}
                    className="absolute -top-2 -right-2 w-7 h-7 rounded-full items-center justify-center active:opacity-70"
                    style={{ backgroundColor: '#EF4444' }}
                  >
                    <X size={14} color="#FFFFFF" strokeWidth={2.5} />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={handlePickImage}
                  className="w-24 h-24 rounded-2xl items-center justify-center active:opacity-80"
                  style={{ backgroundColor: colors.bg.secondary, borderWidth: 2, borderColor: colors.border.light, borderStyle: 'dashed' }}
                >
                  <Camera size={28} color={colors.text.tertiary} strokeWidth={1.5} />
                </Pressable>
              )}

              <Pressable
                onPress={handlePickImage}
                className="mt-3 px-4 py-2 rounded-lg active:opacity-70"
                style={{ backgroundColor: colors.bg.secondary }}
              >
                <Text style={{ color: colors.text.secondary }} className="text-sm font-medium">
                  {logo ? 'Change Logo' : 'Upload Logo'}
                </Text>
              </Pressable>

              <Text style={{ color: colors.text.muted }} className="text-xs mt-2 text-center">
                Optional. Square images work best.
              </Text>
            </View>
          </View>

          {/* Business Information */}
          <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase mb-3 tracking-wider">Business Information</Text>

          <View className="rounded-xl p-4 mb-6" style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
            {/* Business Name */}
            <View className="mb-4">
              <View className="flex-row items-center mb-2">
                <Building2 size={16} color={colors.text.tertiary} strokeWidth={2} />
                <Text style={{ color: colors.text.secondary }} className="text-sm font-medium ml-2">Business Name</Text>
                <Text style={{ color: colors.text.muted }} className="text-xs ml-2">Locked</Text>
              </View>

              <View
                className="rounded-xl px-4"
                style={{
                  backgroundColor: colors.bg.secondary,
                  borderWidth: 1,
                  borderColor: colors.input.border,
                  height: 50,
                  justifyContent: 'center'
                }}
              >
                <TextInput
                  value={name}
                  placeholder="Enter your business name"
                  placeholderTextColor={colors.input.placeholder}
                  style={{ color: colors.text.primary, fontSize: 14 }}
                  selectionColor={colors.text.primary}
                  editable={false}
                  selectTextOnFocus={false}
                />
              </View>

              <Text style={{ color: colors.text.muted }} className="text-xs mt-2">
                Business name is fixed after setup.
              </Text>
            </View>

            {/* Business Phone */}
            <View className="mb-4">
              <View className="flex-row items-center mb-2">
                <Phone size={16} color={colors.text.tertiary} strokeWidth={2} />
                <Text style={{ color: colors.text.secondary }} className="text-sm font-medium ml-2">Phone Number</Text>
              </View>

              <View
                className="rounded-xl px-4"
                style={{
                  backgroundColor: colors.input.bg,
                  borderWidth: 1,
                  borderColor: colors.input.border,
                  height: 50,
                  justifyContent: 'center'
                }}
              >
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="e.g. +234 800 123 4567"
                  placeholderTextColor={colors.input.placeholder}
                  keyboardType="phone-pad"
                  style={{ color: colors.input.text, fontSize: 14 }}
                  selectionColor={colors.text.primary}
                />
              </View>
            </View>

            {/* Business Website */}
            <View>
              <View className="flex-row items-center mb-2">
                <Globe size={16} color={colors.text.tertiary} strokeWidth={2} />
                <Text style={{ color: colors.text.secondary }} className="text-sm font-medium ml-2">Website</Text>
              </View>

              <View
                className="rounded-xl px-4"
                style={{
                  backgroundColor: colors.input.bg,
                  borderWidth: 1,
                  borderColor: colors.input.border,
                  height: 50,
                  justifyContent: 'center'
                }}
              >
                <TextInput
                  value={website}
                  onChangeText={setWebsite}
                  placeholder="e.g. www.yourbusiness.com"
                  placeholderTextColor={colors.input.placeholder}
                  keyboardType="url"
                  autoCapitalize="none"
                  style={{ color: colors.input.text, fontSize: 14 }}
                  selectionColor={colors.text.primary}
                />
              </View>
            </View>
          </View>

          {/* Return Address (for Shipping Labels) */}
          <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase mb-3 tracking-wider">Return Address</Text>

          <View className="rounded-xl p-4 mb-6" style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
            <View className="flex-row items-center mb-2">
              <MapPin size={16} color={colors.text.tertiary} strokeWidth={2} />
              <Text style={{ color: colors.text.secondary }} className="text-sm font-medium ml-2">Address for Shipping Labels</Text>
            </View>

            <View
              className="rounded-xl px-4 py-3"
              style={{
                backgroundColor: colors.input.bg,
                borderWidth: 1,
                borderColor: colors.input.border,
                minHeight: 100
              }}
            >
              <TextInput
                value={address}
                onChangeText={setAddress}
                placeholder="Enter your business return address&#10;e.g. 123 Main Street&#10;Lagos, Nigeria"
                placeholderTextColor={colors.input.placeholder}
                multiline
                numberOfLines={4}
                style={{ color: colors.input.text, fontSize: 14, textAlignVertical: 'top' }}
                selectionColor={colors.text.primary}
              />
            </View>

            <Text style={{ color: colors.text.muted }} className="text-xs mt-2">
              This address will appear on shipping labels.
            </Text>
          </View>

          {error ? (
            <Text className="text-red-500 text-xs text-center mb-4">{error}</Text>
          ) : null}

          {/* Save Button (for bottom of screen) */}
          <Pressable
            onPress={handleSave}
            disabled={isSaving || !hasChanges}
            className="rounded-xl items-center active:opacity-80"
            style={{
              backgroundColor: hasChanges ? '#111111' : colors.bg.secondary,
              height: 54,
              justifyContent: 'center'
            }}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={hasChanges ? '#FFFFFF' : colors.text.tertiary} />
            ) : (
              <Text
                style={{ color: hasChanges ? '#FFFFFF' : colors.text.tertiary }}
                className="font-semibold text-base"
              >
                Save Changes
              </Text>
            )}
          </Pressable>

          <View className="h-24" />
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </View>
  );
}
