import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Eye, EyeOff, Mail, Lock, UserPlus, ChevronLeft, User, Key } from 'lucide-react-native';
import { useThemeColors } from '@/lib/theme';
import useAuthStore from '@/lib/state/auth-store';
import * as Haptics from 'expo-haptics';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase/firebaseConfig';
import { FyllLogo } from '@/components/FyllLogo';
import Constants from 'expo-constants';

type AuthMode = 'login' | 'invite' | 'signup';

export default function LoginScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const login = useAuthStore((s) => s.login);
  const signup = useAuthStore((s) => s.signup);
  const enableOfflineMode = useAuthStore((s) => s.enableOfflineMode);
  const getInviteByCode = useAuthStore((s) => s.getInviteByCode);
  const acceptInvite = useAuthStore((s) => s.acceptInvite);
  const isOfflineMode = useAuthStore((s) => s.isOfflineMode);
  const businessId = useAuthStore((s) => s.businessId);
  const projectId = Constants.expoConfig?.extra?.firebaseProjectId ?? process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '';

  const [mode, setMode] = useState<AuthMode>('login');

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  // Invite form state
  const [inviteCode, setInviteCode] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteConfirmPassword, setInviteConfirmPassword] = useState('');
  const [showInvitePassword, setShowInvitePassword] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');

  // Signup form state
  const [businessName, setBusinessName] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [signupError, setSignupError] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter email and password');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsLoading(true);
    setError('');
    setResetMessage('');

    const result = await login(email.trim(), password);

    setIsLoading(false);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } else {
      setError(result.error || 'Login failed');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      setError('Enter your email first');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsResetting(true);
    setError('');
    setResetMessage('');

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setResetMessage('Password reset email sent. Check your inbox.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('Password reset failed:', err);
      setError('Failed to send reset email. Check your email and try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsResetting(false);
    }
  };

  const handleOfflineMode = () => {
    enableOfflineMode({
      businessName: businessName || 'Offline Business',
      name: signupName || 'Offline User',
      email: email || signupEmail,
    });
    router.replace('/(tabs)');
  };

  const handleVerifyCode = async () => {
    if (!inviteCode.trim()) {
      setInviteError('Please enter the invite code');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsLoading(true);
    setInviteError('');

    try {
      const invite = await Promise.race([
        getInviteByCode(inviteCode.trim().toUpperCase()),
        new Promise<undefined>((_, reject) =>
          setTimeout(() => reject(new Error('Invite lookup timeout')), 10000)
        ),
      ]);

      if (!invite) {
        setInviteError('Invalid or expired invite code');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        setInviteEmail(invite.email);
        setInviteError('');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Invite verification error:', error);
      setInviteError('Could not verify invite code. Please check your connection and try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!inviteName.trim()) {
      setInviteError('Please enter your name');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (!invitePassword.trim()) {
      setInviteError('Please create a password');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (invitePassword.length < 6) {
      setInviteError('Password must be at least 6 characters');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (invitePassword !== inviteConfirmPassword) {
      setInviteError('Passwords do not match');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsLoading(true);
    setInviteError('');

    const result = await acceptInvite(inviteCode.trim().toUpperCase(), inviteName.trim(), invitePassword);

    setIsLoading(false);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } else {
      setInviteError(result.error || 'Failed to create account');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const resetInviteForm = () => {
    setInviteCode('');
    setInviteName('');
    setInvitePassword('');
    setInviteConfirmPassword('');
    setInviteEmail('');
    setInviteError('');
  };

  const resetSignupForm = () => {
    setBusinessName('');
    setSignupName('');
    setSignupEmail('');
    setSignupPassword('');
    setSignupConfirmPassword('');
    setSignupError('');
  };

  const handleSignup = async () => {
    if (!businessName.trim() || !signupName.trim() || !signupEmail.trim() || !signupPassword.trim()) {
      setSignupError('Please fill all fields');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (!signupEmail.includes('@')) {
      setSignupError('Invalid email address');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (signupPassword.length < 6) {
      setSignupError('Password must be at least 6 characters');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (signupPassword !== signupConfirmPassword) {
      setSignupError('Passwords do not match');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsLoading(true);
    setSignupError('');

    const result = await signup({
      businessName: businessName.trim(),
      name: signupName.trim(),
      email: signupEmail.trim(),
      password: signupPassword,
    });

    setIsLoading(false);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/welcome');
    } else {
      setSignupError(result.error || 'Failed to create account');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  if (mode === 'invite') {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
        <SafeAreaView className="flex-1">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1"
          >
            <ScrollView
              className="flex-1"
              contentContainerStyle={{ paddingBottom: 32 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View className="flex-1 px-6 pt-4">
                {/* Back Button */}
                <Pressable
                  onPress={() => {
                    setMode('login');
                    resetInviteForm();
                  }}
                  className="w-10 h-10 rounded-xl items-center justify-center mb-6 active:opacity-50"
                  style={{ backgroundColor: colors.bg.secondary }}
                >
                  <ChevronLeft size={20} color={colors.text.primary} strokeWidth={2} />
                </Pressable>

                {/* Header */}
                <View className="items-center mb-8">
                  <FyllLogo width={50} color={colors.text.primary} />
                  <Text style={{ color: colors.text.primary }} className="text-2xl font-bold mt-4">
                    Join Your Team
                  </Text>
                  <Text style={{ color: colors.text.tertiary }} className="text-base text-center mt-2">
                    Enter your invite code to create an account
                  </Text>
                </View>

                {!inviteEmail ? (
                  // Step 1: Enter invite code
                  <View>
                    <View className="mb-4">
                      <Text style={{ color: colors.text.secondary }} className="text-sm font-medium mb-2">
                        Invite Code
                      </Text>
                      <View
                        className="flex-row items-center rounded-xl px-4"
                        style={{
                          backgroundColor: colors.input.bg,
                          borderWidth: 1,
                          borderColor: inviteError ? '#EF4444' : colors.input.border,
                          height: 56,
                        }}
                      >
                        <Key size={20} color={colors.text.tertiary} strokeWidth={1.5} />
                        <TextInput
                          value={inviteCode}
                          onChangeText={(text) => {
                            setInviteCode(text.toUpperCase());
                            setInviteError('');
                          }}
                          placeholder="Enter code (e.g. ABC123XY)"
                          placeholderTextColor={colors.input.placeholder}
                          autoCapitalize="characters"
                          autoCorrect={false}
                          style={{
                            flex: 1,
                            color: colors.input.text,
                            fontSize: 16,
                            marginLeft: 12,
                            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                            letterSpacing: 2,
                          }}
                          selectionColor={colors.text.primary}
                        />
                      </View>
                    </View>

                    {inviteError ? (
                      <View className="mb-4 p-3 rounded-xl" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                        <Text className="text-red-500 text-sm text-center">{inviteError}</Text>
                      </View>
                    ) : null}

                    <Pressable
                      onPress={handleVerifyCode}
                      className="rounded-xl items-center justify-center active:opacity-80"
                      style={{ backgroundColor: '#111111', height: 56 }}
                    >
                      <Text className="text-white font-semibold text-base">Verify Code</Text>
                    </Pressable>
                  </View>
                ) : (
                  // Step 2: Create account
                  <View>
                    {/* Email display */}
                    <View className="mb-4 p-4 rounded-xl" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', borderWidth: 1, borderColor: 'rgba(34, 197, 94, 0.2)' }}>
                      <Text style={{ color: colors.text.tertiary }} className="text-xs mb-1">Your email</Text>
                      <Text style={{ color: '#22C55E' }} className="font-semibold">{inviteEmail}</Text>
                    </View>

                    {/* Name Input */}
                    <View className="mb-4">
                      <Text style={{ color: colors.text.secondary }} className="text-sm font-medium mb-2">
                        Your Name
                      </Text>
                      <View
                        className="flex-row items-center rounded-xl px-4"
                        style={{
                          backgroundColor: colors.input.bg,
                          borderWidth: 1,
                          borderColor: colors.input.border,
                          height: 56,
                        }}
                      >
                        <User size={20} color={colors.text.tertiary} strokeWidth={1.5} />
                        <TextInput
                          value={inviteName}
                          onChangeText={(text) => {
                            setInviteName(text);
                            setInviteError('');
                          }}
                          placeholder="Enter your full name"
                          placeholderTextColor={colors.input.placeholder}
                          style={{ flex: 1, color: colors.input.text, fontSize: 16, marginLeft: 12 }}
                          selectionColor={colors.text.primary}
                        />
                      </View>
                    </View>

                    {/* Password Input */}
                    <View className="mb-4">
                      <Text style={{ color: colors.text.secondary }} className="text-sm font-medium mb-2">
                        Create Password
                      </Text>
                      <View
                        className="flex-row items-center rounded-xl px-4"
                        style={{
                          backgroundColor: colors.input.bg,
                          borderWidth: 1,
                          borderColor: inviteError ? '#EF4444' : colors.input.border,
                          height: 56,
                        }}
                      >
                        <Lock size={20} color={colors.text.tertiary} strokeWidth={1.5} />
                        <TextInput
                          value={invitePassword}
                          onChangeText={(text) => {
                            setInvitePassword(text);
                            setInviteError('');
                          }}
                          placeholder="Create a password"
                          placeholderTextColor={colors.input.placeholder}
                          secureTextEntry={!showInvitePassword}
                          style={{ flex: 1, color: colors.input.text, fontSize: 16, marginLeft: 12 }}
                          selectionColor={colors.text.primary}
                        />
                        <Pressable onPress={() => setShowInvitePassword(!showInvitePassword)}>
                          {showInvitePassword ? (
                            <EyeOff size={20} color={colors.text.tertiary} />
                          ) : (
                            <Eye size={20} color={colors.text.tertiary} />
                          )}
                        </Pressable>
                      </View>
                    </View>

                    {/* Confirm Password */}
                    <View className="mb-6">
                      <Text style={{ color: colors.text.secondary }} className="text-sm font-medium mb-2">
                        Confirm Password
                      </Text>
                      <View
                        className="flex-row items-center rounded-xl px-4"
                        style={{
                          backgroundColor: colors.input.bg,
                          borderWidth: 1,
                          borderColor: inviteError ? '#EF4444' : colors.input.border,
                          height: 56,
                        }}
                      >
                        <Lock size={20} color={colors.text.tertiary} strokeWidth={1.5} />
                        <TextInput
                          value={inviteConfirmPassword}
                          onChangeText={(text) => {
                            setInviteConfirmPassword(text);
                            setInviteError('');
                          }}
                          placeholder="Confirm password"
                          placeholderTextColor={colors.input.placeholder}
                          secureTextEntry={!showInvitePassword}
                          style={{ flex: 1, color: colors.input.text, fontSize: 16, marginLeft: 12 }}
                          selectionColor={colors.text.primary}
                        />
                      </View>
                    </View>

                    {inviteError ? (
                      <View className="mb-4 p-3 rounded-xl" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                        <Text className="text-red-500 text-sm text-center">{inviteError}</Text>
                      </View>
                    ) : null}

                    <Pressable
                      onPress={handleCreateAccount}
                      disabled={isLoading}
                      className="rounded-xl items-center justify-center active:opacity-80 flex-row"
                      style={{ backgroundColor: '#111111', height: 56, opacity: isLoading ? 0.7 : 1 }}
                    >
                      {isLoading && (
                        <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                      )}
                      <Text className="text-white font-semibold text-base">
                        {isLoading ? 'Creating Account...' : 'Create Account'}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    );
  }

  if (mode === 'signup') {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
        <SafeAreaView className="flex-1">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1"
          >
            <ScrollView
              className="flex-1"
              contentContainerStyle={{ paddingBottom: 32 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View className="flex-1 px-6 pt-4">
                {/* Back Button */}
                <Pressable
                  onPress={() => {
                    setMode('login');
                    resetSignupForm();
                  }}
                  className="w-10 h-10 rounded-xl items-center justify-center mb-6 active:opacity-50"
                  style={{ backgroundColor: colors.bg.secondary }}
                >
                  <ChevronLeft size={20} color={colors.text.primary} strokeWidth={2} />
                </Pressable>

                {/* Header */}
                <View className="items-center mb-8">
                  <FyllLogo width={50} color={colors.text.primary} />
                  <Text style={{ color: colors.text.primary }} className="text-2xl font-bold mt-4">
                    Create Your Account
                  </Text>
                  <Text style={{ color: colors.text.tertiary }} className="text-base text-center mt-2">
                    Set up your business in minutes
                  </Text>
                </View>

                {/* Business Name */}
                <View className="mb-4">
                  <Text style={{ color: colors.text.secondary }} className="text-sm font-medium mb-2">
                    Business Name
                  </Text>
                  <View
                    className="flex-row items-center rounded-xl px-4"
                    style={{
                      backgroundColor: colors.input.bg,
                      borderWidth: 1,
                      borderColor: signupError ? '#EF4444' : colors.input.border,
                      height: 56,
                    }}
                  >
                    <UserPlus size={20} color={colors.text.tertiary} strokeWidth={1.5} />
                    <TextInput
                      value={businessName}
                      onChangeText={(text) => {
                        setBusinessName(text);
                        setSignupError('');
                      }}
                      placeholder="Business name"
                      placeholderTextColor={colors.input.placeholder}
                      style={{ flex: 1, color: colors.input.text, fontSize: 16, marginLeft: 12 }}
                      selectionColor={colors.text.primary}
                    />
                  </View>
                </View>

                {/* Name */}
                <View className="mb-4">
                  <Text style={{ color: colors.text.secondary }} className="text-sm font-medium mb-2">
                    Your Name
                  </Text>
                  <View
                    className="flex-row items-center rounded-xl px-4"
                    style={{
                      backgroundColor: colors.input.bg,
                      borderWidth: 1,
                      borderColor: signupError ? '#EF4444' : colors.input.border,
                      height: 56,
                    }}
                  >
                    <User size={20} color={colors.text.tertiary} strokeWidth={1.5} />
                    <TextInput
                      value={signupName}
                      onChangeText={(text) => {
                        setSignupName(text);
                        setSignupError('');
                      }}
                      placeholder="Your full name"
                      placeholderTextColor={colors.input.placeholder}
                      style={{ flex: 1, color: colors.input.text, fontSize: 16, marginLeft: 12 }}
                      selectionColor={colors.text.primary}
                    />
                  </View>
                </View>

                {/* Email */}
                <View className="mb-4">
                  <Text style={{ color: colors.text.secondary }} className="text-sm font-medium mb-2">
                    Email Address
                  </Text>
                  <View
                    className="flex-row items-center rounded-xl px-4"
                    style={{
                      backgroundColor: colors.input.bg,
                      borderWidth: 1,
                      borderColor: signupError ? '#EF4444' : colors.input.border,
                      height: 56,
                    }}
                  >
                    <Mail size={20} color={colors.text.tertiary} strokeWidth={1.5} />
                    <TextInput
                      value={signupEmail}
                      onChangeText={(text) => {
                        setSignupEmail(text);
                        setSignupError('');
                      }}
                      placeholder="you@business.com"
                      placeholderTextColor={colors.input.placeholder}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={{ flex: 1, color: colors.input.text, fontSize: 16, marginLeft: 12 }}
                      selectionColor={colors.text.primary}
                    />
                  </View>
                </View>

                {/* Password */}
                <View className="mb-4">
                  <Text style={{ color: colors.text.secondary }} className="text-sm font-medium mb-2">
                    Password
                  </Text>
                  <View
                    className="flex-row items-center rounded-xl px-4"
                    style={{
                      backgroundColor: colors.input.bg,
                      borderWidth: 1,
                      borderColor: signupError ? '#EF4444' : colors.input.border,
                      height: 56,
                    }}
                  >
                    <Lock size={20} color={colors.text.tertiary} strokeWidth={1.5} />
                    <TextInput
                      value={signupPassword}
                      onChangeText={(text) => {
                        setSignupPassword(text);
                        setSignupError('');
                      }}
                      placeholder="Create a password"
                      placeholderTextColor={colors.input.placeholder}
                      secureTextEntry={!showPassword}
                      style={{ flex: 1, color: colors.input.text, fontSize: 16, marginLeft: 12 }}
                      selectionColor={colors.text.primary}
                    />
                    <Pressable onPress={() => setShowPassword(!showPassword)}>
                      {showPassword ? (
                        <EyeOff size={20} color={colors.text.tertiary} />
                      ) : (
                        <Eye size={20} color={colors.text.tertiary} />
                      )}
                    </Pressable>
                  </View>
                </View>

                {/* Confirm Password */}
                <View className="mb-6">
                  <Text style={{ color: colors.text.secondary }} className="text-sm font-medium mb-2">
                    Confirm Password
                  </Text>
                  <View
                    className="flex-row items-center rounded-xl px-4"
                    style={{
                      backgroundColor: colors.input.bg,
                      borderWidth: 1,
                      borderColor: signupError ? '#EF4444' : colors.input.border,
                      height: 56,
                    }}
                  >
                    <Lock size={20} color={colors.text.tertiary} strokeWidth={1.5} />
                    <TextInput
                      value={signupConfirmPassword}
                      onChangeText={(text) => {
                        setSignupConfirmPassword(text);
                        setSignupError('');
                      }}
                      placeholder="Confirm password"
                      placeholderTextColor={colors.input.placeholder}
                      secureTextEntry={!showPassword}
                      style={{ flex: 1, color: colors.input.text, fontSize: 16, marginLeft: 12 }}
                      selectionColor={colors.text.primary}
                    />
                  </View>
                </View>

                {signupError ? (
                  <View className="mb-4 p-3 rounded-xl" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                    <Text className="text-red-500 text-sm text-center">{signupError}</Text>
                  </View>
                ) : null}

                <Pressable
                  onPress={handleSignup}
                  disabled={isLoading}
                  className="rounded-xl items-center justify-center active:opacity-80 flex-row"
                  style={{ backgroundColor: '#111111', height: 56, opacity: isLoading ? 0.7 : 1 }}
                >
                  {isLoading && (
                    <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                  )}
                  <Text className="text-white font-semibold text-base">
                    {isLoading ? 'Creating Account...' : 'Create Account'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleOfflineMode}
                  className="mt-4 rounded-xl items-center justify-center active:opacity-80"
                  style={{ borderWidth: 1, borderColor: colors.border.light, height: 56 }}
                >
                  <Text style={{ color: colors.text.primary }} className="font-semibold text-base">
                    Continue Offline
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
      <SafeAreaView className="flex-1">
        <View className="px-6 pt-3">
          <View
            className="self-start rounded-lg px-3 py-2"
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)' }}
          >
            <Text style={{ color: '#EF4444' }} className="text-xs font-semibold">
              Debug
            </Text>
            <Text style={{ color: colors.text.secondary }} className="text-xs">
              Project: {projectId || 'unknown'}
            </Text>
            <Text style={{ color: colors.text.secondary }} className="text-xs">
              Business: {businessId || 'none'}
            </Text>
            <Text style={{ color: colors.text.secondary }} className="text-xs">
              Offline: {isOfflineMode ? 'yes' : 'no'}
            </Text>
          </View>
        </View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 32 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View className="flex-1 px-6 pt-10">
              {/* Logo */}
              <View className="items-center mb-10">
                <FyllLogo width={50} color={colors.text.primary} />
                <Text style={{ color: colors.text.primary }} className="text-2xl font-bold mt-4">
                  Welcome Back
                </Text>
                <Text style={{ color: colors.text.tertiary }} className="text-base text-center mt-2">
                  Sign in to manage your business
                </Text>
              </View>

              {/* Email Input */}
              <View className="mb-4">
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
                    placeholder="you@business.com"
                    placeholderTextColor={colors.input.placeholder}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={{ flex: 1, color: colors.input.text, fontSize: 16, marginLeft: 12 }}
                    selectionColor={colors.text.primary}
                  />
                </View>
              </View>

              {/* Password Input */}
              <View className="mb-3">
                <Text style={{ color: colors.text.secondary }} className="text-sm font-medium mb-2">
                  Password
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
                  <Lock size={20} color={colors.text.tertiary} strokeWidth={1.5} />
                  <TextInput
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      setError('');
                    }}
                    placeholder="Enter your password"
                    placeholderTextColor={colors.input.placeholder}
                    secureTextEntry={!showPassword}
                    style={{ flex: 1, color: colors.input.text, fontSize: 16, marginLeft: 12 }}
                    selectionColor={colors.text.primary}
                  />
                  <Pressable onPress={() => setShowPassword(!showPassword)}>
                    {showPassword ? (
                      <EyeOff size={20} color={colors.text.tertiary} />
                    ) : (
                      <Eye size={20} color={colors.text.tertiary} />
                    )}
                  </Pressable>
                </View>
              </View>

              {/* Error */}
              {error ? (
                <View className="mb-4 p-3 rounded-xl" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                  <Text className="text-red-500 text-sm text-center">{error}</Text>
                </View>
              ) : null}

              {resetMessage ? (
                <View className="mb-4 p-3 rounded-xl" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)' }}>
                  <Text style={{ color: '#22C55E' }} className="text-sm text-center">{resetMessage}</Text>
                </View>
              ) : null}

              {/* Login Button */}
              <Pressable
                onPress={handleLogin}
                disabled={isLoading}
                className="rounded-xl items-center justify-center active:opacity-80 flex-row"
                style={{ backgroundColor: '#111111', height: 56, opacity: isLoading ? 0.7 : 1 }}
              >
                {isLoading && (
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                )}
                <Text className="text-white font-semibold text-base">
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </Text>
              </Pressable>

              {/* Reset Password */}
              <Pressable
                onPress={handlePasswordReset}
                disabled={isResetting}
                className="mt-4 items-center"
              >
                <Text style={{ color: colors.text.tertiary }} className="text-sm">
                  {isResetting ? 'Sending reset email...' : 'Forgot password?'}
                </Text>
              </Pressable>

              {/* Divider */}
              <View className="flex-row items-center my-6">
                <View className="flex-1 h-px" style={{ backgroundColor: colors.border.light }} />
                <Text style={{ color: colors.text.tertiary }} className="text-xs px-3">OR</Text>
                <View className="flex-1 h-px" style={{ backgroundColor: colors.border.light }} />
              </View>

              {/* Create Account */}
              <Pressable
                onPress={() => {
                  setMode('signup');
                  resetSignupForm();
                }}
                className="rounded-xl items-center justify-center active:opacity-80"
                style={{ borderWidth: 1, borderColor: colors.border.light, height: 56 }}
              >
                <Text style={{ color: colors.text.primary }} className="font-semibold text-base">
                  Create New Account
                </Text>
              </Pressable>

              {/* Invite */}
              <Pressable
                onPress={() => {
                  setMode('invite');
                  resetInviteForm();
                }}
                className="mt-4 rounded-xl items-center justify-center active:opacity-80"
                style={{ borderWidth: 1, borderColor: colors.border.light, height: 56 }}
              >
                <Text style={{ color: colors.text.primary }} className="font-semibold text-base">
                  Join With Invite Code
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
