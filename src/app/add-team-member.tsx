import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, User, Shield, Mail, Lock, UserCog } from 'lucide-react-native';
import { useThemeColors } from '@/lib/theme';
import useAuthStore, { TeamRole } from '@/lib/state/auth-store';
import * as Haptics from 'expo-haptics';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

const roleLabels: Record<TeamRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  staff: 'Staff',
};

const roleDescriptions: Record<TeamRole, string> = {
  admin: 'Full access to Revenue, Insights, Team, and Settings',
  manager: 'Manage Inventory, Restocks, and Order History. No Insights tab.',
  staff: 'Scan QR, Inventory Checks, and Add Orders only',
};

const roleColors: Record<TeamRole, string> = {
  admin: '#EF4444',
  manager: '#F59E0B',
  staff: '#3B82F6',
};

export default function AddTeamMemberScreen() {
  const router = useRouter();
  const colors = useThemeColors();

  const currentUser = useAuthStore((s) => s.currentUser);
  const createInvite = useAuthStore((s) => s.createInvite);

  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<TeamRole>('staff');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteCreated, setInviteCreated] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  const handleCreateInvite = async () => {
    if (!email.trim()) {
      setError('Email is required');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const invite = await createInvite(email.trim(), selectedRole, currentUser?.name || 'Admin');
      setInviteCode(invite.inviteCode);
      setInviteCreated(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invite. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    setIsSubmitting(false);
  };

  if (inviteCreated) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
        <SafeAreaView className="flex-1" edges={['top']}>
          {/* Header */}
          <View
            className="px-5 pt-4 pb-4 flex-row items-center"
            style={{ borderBottomWidth: 1, borderBottomColor: colors.border.light }}
          >
            <Pressable
              onPress={() => router.back()}
              className="w-10 h-10 rounded-xl items-center justify-center mr-3 active:opacity-50"
              style={{ backgroundColor: colors.bg.secondary }}
            >
              <ChevronLeft size={20} color={colors.text.primary} strokeWidth={2} />
            </Pressable>
            <Text style={{ color: colors.text.primary }} className="text-xl font-bold">Invite Sent</Text>
          </View>

          <View className="flex-1 items-center justify-center px-6">
            <View
              className="w-20 h-20 rounded-full items-center justify-center mb-6"
              style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)' }}
            >
              <Mail size={40} color="#22C55E" strokeWidth={1.5} />
            </View>
            <Text style={{ color: colors.text.primary }} className="text-2xl font-bold text-center mb-2">
              Invite Created!
            </Text>
            <Text style={{ color: colors.text.tertiary }} className="text-center mb-6">
              Share this code with {email}
            </Text>

            <View
              className="w-full rounded-xl p-6 items-center mb-6"
              style={{ backgroundColor: colors.bg.secondary }}
            >
              <Text style={{ color: colors.text.tertiary }} className="text-xs mb-2">INVITE CODE</Text>
              <Text
                style={{ color: colors.text.primary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}
                className="text-3xl font-bold tracking-widest"
              >
                {inviteCode}
              </Text>
            </View>

            <Pressable
              onPress={() => router.back()}
              className="w-full rounded-xl items-center justify-center active:opacity-80"
              style={{ backgroundColor: '#111111', height: 56 }}
            >
              <Text className="text-white font-semibold text-base">Done</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <View
          className="px-5 pt-4 pb-4 flex-row items-center"
          style={{ borderBottomWidth: 1, borderBottomColor: colors.border.light }}
        >
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 rounded-xl items-center justify-center mr-3 active:opacity-50"
            style={{ backgroundColor: colors.bg.secondary }}
          >
            <ChevronLeft size={20} color={colors.text.primary} strokeWidth={2} />
          </Pressable>
          <Text style={{ color: colors.text.primary }} className="text-xl font-bold">Invite Member</Text>
        </View>

        <KeyboardAwareScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
          bottomOffset={20}
        >
          {/* Email Input */}
          <View className="mt-6 mb-6">
            <Text style={{ color: colors.text.secondary }} className="text-sm font-medium mb-2">
              Email Address
            </Text>
            <View
              className="flex-row items-center rounded-xl px-4"
              style={{
                backgroundColor: colors.input.bg,
                borderWidth: 1,
                borderColor: error ? '#EF4444' : colors.input.border,
                height: 56,
              }}
            >
              <Mail size={20} color={colors.text.tertiary} strokeWidth={1.5} />
              <TextInput
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setError('');
                }}
                placeholder="Enter team member's email"
                placeholderTextColor={colors.text.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={{ flex: 1, color: colors.text.primary, fontSize: 16, marginLeft: 12 }}
                selectionColor={colors.text.primary}
              />
            </View>
          </View>

          {/* Role Selection */}
          <View className="mb-6">
            <Text style={{ color: colors.text.secondary }} className="text-sm font-medium mb-3">
              Select Role
            </Text>

            {(['admin', 'manager', 'staff'] as TeamRole[]).map((role) => (
              <Pressable
                key={role}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedRole(role);
                }}
                className="flex-row items-center p-4 rounded-xl mb-3"
                style={{
                  backgroundColor: selectedRole === role ? `${roleColors[role]}10` : colors.bg.secondary,
                  borderWidth: selectedRole === role ? 2 : 1,
                  borderColor: selectedRole === role ? roleColors[role] : colors.border.light,
                }}
              >
                <View
                  className="w-12 h-12 rounded-full items-center justify-center mr-4"
                  style={{ backgroundColor: `${roleColors[role]}15` }}
                >
                  {role === 'admin' && <Shield size={24} color={roleColors[role]} strokeWidth={2} />}
                  {role === 'manager' && <UserCog size={24} color={roleColors[role]} strokeWidth={2} />}
                  {role === 'staff' && <User size={24} color={roleColors[role]} strokeWidth={2} />}
                </View>
                <View className="flex-1">
                  <Text
                    style={{ color: selectedRole === role ? roleColors[role] : colors.text.primary }}
                    className="font-semibold text-base"
                  >
                    {roleLabels[role]}
                  </Text>
                  <Text style={{ color: colors.text.tertiary }} className="text-xs mt-0.5">
                    {roleDescriptions[role]}
                  </Text>
                </View>
                {selectedRole === role && (
                  <View
                    className="w-6 h-6 rounded-full items-center justify-center"
                    style={{ backgroundColor: roleColors[role] }}
                  >
                    <View className="w-2.5 h-2.5 rounded-full bg-white" />
                  </View>
                )}
              </Pressable>
            ))}
          </View>

          {/* Error */}
          {error ? (
            <View className="mb-6 p-4 rounded-xl" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
              <Text className="text-red-500 text-sm text-center">{error}</Text>
            </View>
          ) : null}

          {/* Submit Button */}
          <Pressable
            onPress={handleCreateInvite}
            disabled={isSubmitting}
            className="rounded-xl items-center justify-center active:opacity-80 mb-8"
            style={{
              backgroundColor: '#111111',
              height: 56,
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            <Text className="text-white font-semibold text-base">
              {isSubmitting ? 'Creating Invite...' : 'Send Invite'}
            </Text>
          </Pressable>
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </View>
  );
}
