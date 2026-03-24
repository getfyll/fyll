import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Building2, ChevronLeft, Check, Mail, Shield, UserCog, User as UserIcon, Sparkles, Wand2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '@/lib/theme';
import { FyllLogo } from '@/components/FyllLogo';
import { supabase } from '@/lib/supabase';
import { storage } from '@/lib/storage';
import useAuthStore, { type TeamRole } from '@/lib/state/auth-store';

const ONBOARDING_STORAGE_KEY = 'fyll_onboarding_complete';
const BOTTLENECK_OPTIONS = [
  'Inventory management',
  'Customer complaints and disputes',
  'Team communication',
  'Order management',
] as const;

type OnboardingStep = 1 | 2 | 3 | 4;
type BottleneckOption = (typeof BOTTLENECK_OPTIONS)[number];

const roleLabels: Record<TeamRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  staff: 'Staff',
};

const roleColors: Record<TeamRole, string> = {
  admin: '#EF4444',
  manager: '#F59E0B',
  staff: '#3B82F6',
};

const buildStages = [
  'Creating your workspace shell',
  'Configuring your operations profile',
  'Preparing invite permissions',
  'Finalizing your dashboard',
] as const;

function StepPill({ index, active, completed }: { index: number; active: boolean; completed: boolean }) {
  const colors = useThemeColors();

  return (
    <View
      className="h-9 w-9 rounded-full items-center justify-center"
      style={{
        backgroundColor: completed ? '#111111' : active ? colors.bg.secondary : colors.bg.card,
        borderWidth: 1,
        borderColor: completed ? '#111111' : colors.border.light,
      }}
    >
      {completed ? (
        <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
      ) : (
        <Text style={{ color: active ? colors.text.primary : colors.text.tertiary }} className="text-sm font-semibold">
          {index}
        </Text>
      )}
    </View>
  );
}

function RoleChip({ role, selected, onPress }: { role: TeamRole; selected: boolean; onPress: () => void }) {
  const colors = useThemeColors();
  const Icon = role === 'admin' ? Shield : role === 'manager' ? UserCog : UserIcon;

  return (
    <Pressable
      onPress={onPress}
      className="px-3 py-2 rounded-full flex-row items-center active:opacity-80"
      style={{
        backgroundColor: selected ? `${roleColors[role]}12` : colors.bg.secondary,
        borderWidth: 1,
        borderColor: selected ? roleColors[role] : colors.border.light,
      }}
    >
      <Icon size={14} color={selected ? roleColors[role] : colors.text.tertiary} strokeWidth={2} />
      <Text
        style={{ color: selected ? roleColors[role] : colors.text.secondary }}
        className="text-xs font-semibold ml-1.5"
      >
        {roleLabels[role]}
      </Text>
    </Pressable>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const currentUser = useAuthStore((s) => s.currentUser);
  const businessId = useAuthStore((s) => s.businessId);
  const pendingInvites = useAuthStore((s) => s.pendingInvites);
  const teamMembers = useAuthStore((s) => s.teamMembers);
  const createInvite = useAuthStore((s) => s.createInvite);
  const refreshTeamData = useAuthStore((s) => s.refreshTeamData);

  const [step, setStep] = useState<OnboardingStep>(1);
  const [businessName, setBusinessName] = useState('');
  const [businessNameError, setBusinessNameError] = useState('');
  const [teamInviteEmail, setTeamInviteEmail] = useState('');
  const [teamInviteRole, setTeamInviteRole] = useState<TeamRole>('staff');
  const [teamInviteError, setTeamInviteError] = useState('');
  const [isTeamInviteSubmitting, setIsTeamInviteSubmitting] = useState(false);
  const [selectedBottlenecks, setSelectedBottlenecks] = useState<BottleneckOption[]>([]);
  const [bottlenecksError, setBottlenecksError] = useState('');
  const [buildProgress, setBuildProgress] = useState(0);
  const [buildStageIndex, setBuildStageIndex] = useState(0);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [buildError, setBuildError] = useState('');

  const hasStartedBuild = useRef(false);

  const isAdmin = currentUser?.role === 'admin';
  const pendingInvitesFiltered = useMemo(
    () => pendingInvites.filter((invite) => !teamMembers.some((member) => member.email.toLowerCase() === invite.email.toLowerCase())),
    [pendingInvites, teamMembers]
  );

  useEffect(() => {
    refreshTeamData().catch(() => {});
  }, [refreshTeamData]);

  useEffect(() => {
    let cancelled = false;

    const loadBusinessName = async () => {
      if (!businessId) return;

      try {
        const cached = await storage.getItem(`fyll_business_settings:${businessId}`);
        if (!cancelled && cached) {
          const parsed = JSON.parse(cached) as { businessName?: string };
          if (parsed.businessName?.trim()) {
            setBusinessName(parsed.businessName.trim());
          }
        }
      } catch (error) {
        console.warn('Could not load cached business settings during onboarding:', error);
      }

      try {
        const { data, error } = await supabase
          .from('businesses')
          .select('name')
          .eq('id', businessId)
          .maybeSingle();
        if (!cancelled && !error && data?.name?.trim()) {
          setBusinessName(data.name.trim());
        }
      } catch (error) {
        console.warn('Could not load business name during onboarding:', error);
      }
    };

    void loadBusinessName();

    return () => {
      cancelled = true;
    };
  }, [businessId]);

  useEffect(() => {
    if (step !== 4 || hasStartedBuild.current) return;
    hasStartedBuild.current = true;

    let stageTimer: ReturnType<typeof setInterval> | null = null;
    let progressTimer: ReturnType<typeof setInterval> | null = null;

    progressTimer = setInterval(() => {
      setBuildProgress((prev) => {
        if (prev >= 94) return prev;
        const next = prev + Math.max(2, Math.round((100 - prev) / 14));
        return Math.min(next, 94);
      });
    }, 280);

    stageTimer = setInterval(() => {
      setBuildStageIndex((prev) => Math.min(prev + 1, buildStages.length - 1));
    }, 900);

    const runBuild = async () => {
      setIsFinalizing(true);
      setBuildError('');

      try {
        await Promise.all([
          persistBusinessName(),
          persistOnboardingState({
            onboardingStep: 4,
            onboardingBottlenecks: selectedBottlenecks,
            completedAt: new Date().toISOString(),
          }),
          storage.setItem(ONBOARDING_STORAGE_KEY, 'true'),
        ]);

        setBuildProgress(100);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        setTimeout(() => {
          router.replace('/(tabs)');
        }, 450);
      } catch (error) {
        console.error('Onboarding finalization failed:', error);
        setBuildError('We could not finish your workspace setup. Please try again.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setBuildProgress(0);
        setBuildStageIndex(0);
        hasStartedBuild.current = false;
        setStep(3);
      } finally {
        setIsFinalizing(false);
      }
    };

    void runBuild();

    return () => {
      if (stageTimer) clearInterval(stageTimer);
      if (progressTimer) clearInterval(progressTimer);
    };
    // step transition should trigger only once; selectedBottlenecks is captured at Step 3 submit time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const persistBusinessName = async () => {
    if (!businessId || !businessName.trim()) return;

    try {
      const { error } = await supabase
        .from('businesses')
        .update({ name: businessName.trim() })
        .eq('id', businessId);

      if (error) {
        console.warn('Business name update skipped during onboarding:', error.message);
      }
    } catch (error) {
      console.warn('Business name update failed during onboarding:', error);
    }

    try {
      const raw = await storage.getItem(`fyll_business_settings:${businessId}`);
      const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      await storage.setItem(
        `fyll_business_settings:${businessId}`,
        JSON.stringify({
          ...parsed,
          businessName: businessName.trim(),
        })
      );
    } catch (error) {
      console.warn('Could not cache onboarding business name:', error);
    }
  };

  const persistOnboardingState = async ({
    onboardingStep,
    onboardingBottlenecks,
    completedAt,
  }: {
    onboardingStep: number;
    onboardingBottlenecks?: BottleneckOption[];
    completedAt?: string;
  }) => {
    if (!businessId) return;

    const payload: {
      onboarding_step: number;
      onboarding_bottlenecks?: string[];
      onboarding_completed_at?: string;
    } = {
      onboarding_step: onboardingStep,
    };

    if (onboardingBottlenecks) {
      payload.onboarding_bottlenecks = onboardingBottlenecks;
    }

    if (completedAt) {
      payload.onboarding_completed_at = completedAt;
    }

    try {
      const { error } = await supabase
        .from('businesses')
        .update(payload)
        .eq('id', businessId);

      if (error) {
        // This will happen until the migration is run; keep onboarding usable.
        console.warn('Onboarding metadata update skipped:', error.message);
      }
    } catch (error) {
      console.warn('Onboarding metadata update failed:', error);
    }
  };

  const handleBusinessContinue = async () => {
    if (!businessName.trim()) {
      setBusinessNameError('Business name is required');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setBusinessNameError('');
    await persistBusinessName();
    await persistOnboardingState({ onboardingStep: 1 });
    Haptics.selectionAsync();
    setStep(2);
  };

  const handleAddTeamInvite = async () => {
    if (!isAdmin) {
      setTeamInviteError('Only admins can invite team members');
      return;
    }

    const normalizedEmail = teamInviteEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setTeamInviteError('Email is required');
      return;
    }
    if (!normalizedEmail.includes('@')) {
      setTeamInviteError('Enter a valid email address');
      return;
    }

    if (teamMembers.some((member) => member.email.toLowerCase() === normalizedEmail)) {
      setTeamInviteError('This user is already in your team');
      return;
    }

    if (pendingInvitesFiltered.some((invite) => invite.email.toLowerCase() === normalizedEmail)) {
      setTeamInviteError('An invite for this email is already pending');
      return;
    }

    try {
      setIsTeamInviteSubmitting(true);
      setTeamInviteError('');
      await createInvite(normalizedEmail, teamInviteRole, currentUser?.name ?? 'Admin');
      setTeamInviteEmail('');
      setTeamInviteRole('staff');
      await refreshTeamData();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setTeamInviteError(error instanceof Error ? error.message : 'Failed to create invite');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsTeamInviteSubmitting(false);
    }
  };

  const handleTeamContinue = async () => {
    await persistOnboardingState({ onboardingStep: 2 });
    Haptics.selectionAsync();
    setStep(3);
  };

  const toggleBottleneck = (option: BottleneckOption) => {
    setBottlenecksError('');
    setSelectedBottlenecks((prev) =>
      prev.includes(option) ? prev.filter((item) => item !== option) : [...prev, option]
    );
  };

  const handleSelectAllBottlenecks = () => {
    const allSelected = selectedBottlenecks.length === BOTTLENECK_OPTIONS.length;
    setBottlenecksError('');
    setSelectedBottlenecks(allSelected ? [] : [...BOTTLENECK_OPTIONS]);
    Haptics.selectionAsync();
  };

  const handleStartBuild = async () => {
    if (selectedBottlenecks.length === 0) {
      setBottlenecksError('Select at least one bottleneck to tailor your workspace');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    await persistOnboardingState({ onboardingStep: 3, onboardingBottlenecks: selectedBottlenecks });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep(4);
  };

  const { width: windowWidth } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isWideWeb = isWeb && windowWidth > 700;

  const headerTitle = step === 1
    ? 'Business Setup'
    : step === 2
      ? 'Team Assembly'
      : step === 3
        ? 'Bottleneck Configuration'
        : 'Building Workspace';

  const headerSubtitle = step === 1
    ? 'We will personalize FYLL for your business from the first screen.'
    : step === 2
      ? 'Invite your core team now and assign the right role from day one.'
      : step === 3
        ? 'Tell us what slows you down most so your dashboard prioritizes it.'
        : 'We are preparing your workspace with your selections and invite settings.';

  const currentStage = buildStages[Math.min(buildStageIndex, buildStages.length - 1)] ?? buildStages[0];

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg.primary }} edges={['top', 'bottom']}>
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32, alignItems: isWideWeb ? 'center' : undefined }} keyboardShouldPersistTaps="handled">
          <View className="px-5 pt-4" style={isWideWeb ? { width: '100%', maxWidth: 540 } : undefined}>
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                {step !== 4 ? (
                  <Pressable
                    onPress={() => {
                      if (step === 1) {
                        router.back();
                        return;
                      }
                      setStep((prev) => (prev === 1 ? 1 : ((prev - 1) as OnboardingStep)));
                    }}
                    className="w-10 h-10 rounded-xl items-center justify-center active:opacity-50 mr-3"
                    style={{ backgroundColor: colors.bg.secondary }}
                  >
                    <ChevronLeft size={20} color={colors.text.primary} strokeWidth={2} />
                  </Pressable>
                ) : (
                  <View className="w-10 h-10 mr-3" />
                )}
                <FyllLogo width={44} color={colors.text.primary} />
              </View>
              <View
                className="px-3 py-1.5 rounded-full"
                style={{ backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.light }}
              >
                <Text style={{ color: colors.text.secondary }} className="text-xs font-semibold">
                  {step === 4 ? 'Finalizing' : `Step ${step} of 4`}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center justify-between mb-5">
              {[1, 2, 3, 4].map((index) => (
                <View key={index} className="flex-row items-center flex-1">
                  <StepPill index={index} active={step === index} completed={step > index} />
                  {index < 4 ? (
                    <View
                      className="mx-2 h-[2px] flex-1"
                      style={{ backgroundColor: step > index ? '#111111' : colors.border.light }}
                    />
                  ) : null}
                </View>
              ))}
            </View>

            <View className="mb-5">
              <Text style={{ color: colors.text.primary }} className="text-2xl font-bold">
                {headerTitle}
              </Text>
              <Text style={{ color: colors.text.tertiary }} className="text-sm mt-2 leading-5">
                {headerSubtitle}
              </Text>
            </View>

            {step === 1 ? (
              <View>
                <LinearGradient
                  colors={[colors.bg.card, colors.bg.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.border.light }}
                >
                  <View className="flex-row items-center mb-3">
                    <View
                      className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                      style={{ backgroundColor: 'rgba(17,17,17,0.08)' }}
                    >
                      <Building2 size={18} color={colors.text.primary} strokeWidth={2} />
                    </View>
                    <View className="flex-1">
                      <Text style={{ color: colors.text.primary }} className="font-semibold">
                        Your business identity
                      </Text>
                      <Text style={{ color: colors.text.tertiary }} className="text-xs mt-0.5">
                        This name will power your workspace branding and team invites.
                      </Text>
                    </View>
                  </View>

                  <View
                    className="rounded-2xl px-4 flex-row items-center"
                    style={{
                      backgroundColor: colors.input.bg,
                      borderWidth: 1,
                      borderColor: businessNameError ? '#EF4444' : colors.input.border,
                      height: 56,
                    }}
                  >
                    <Building2 size={18} color={colors.text.tertiary} strokeWidth={1.8} />
                    <TextInput
                      value={businessName}
                      onChangeText={(text) => {
                        setBusinessName(text);
                        setBusinessNameError('');
                      }}
                      placeholder="e.g. Mint Atelier"
                      placeholderTextColor={colors.input.placeholder}
                      style={{ flex: 1, color: colors.input.text, fontSize: 16, marginLeft: 12 }}
                      selectionColor={colors.text.primary}
                      autoCorrect={false}
                      autoCapitalize="words"
                    />
                  </View>
                </LinearGradient>

                {businessNameError ? (
                  <View className="mt-4 p-3 rounded-xl" style={{ backgroundColor: 'rgba(239,68,68,0.1)' }}>
                    <Text className="text-red-500 text-sm text-center">{businessNameError}</Text>
                  </View>
                ) : null}

                <Pressable
                  onPress={handleBusinessContinue}
                  className="mt-5 rounded-full items-center justify-center active:opacity-80"
                  style={{ backgroundColor: '#111111', height: 54 }}
                >
                  <Text className="text-white font-semibold">Continue to Team Setup</Text>
                </Pressable>
              </View>
            ) : null}

            {step === 2 ? (
              <View>
                <View className="rounded-2xl p-4 mb-4" style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
                  <View className="flex-row items-center justify-between mb-3">
                    <Text style={{ color: colors.text.primary }} className="font-semibold">Invite team members</Text>
                    <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: colors.bg.secondary }}>
                      <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold">
                        {pendingInvitesFiltered.length} pending
                      </Text>
                    </View>
                  </View>

                  {!isAdmin ? (
                    <View className="p-3 rounded-xl" style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.16)' }}>
                      <Text className="text-red-500 text-sm text-center">Only admins can invite team members.</Text>
                    </View>
                  ) : (
                    <>
                      <View
                        className="rounded-xl px-4 flex-row items-center mb-3"
                        style={{
                          backgroundColor: colors.input.bg,
                          borderWidth: 1,
                          borderColor: teamInviteError ? '#EF4444' : colors.input.border,
                          height: 52,
                        }}
                      >
                        <Mail size={17} color={colors.text.tertiary} strokeWidth={1.8} />
                        <TextInput
                          value={teamInviteEmail}
                          onChangeText={(text) => {
                            setTeamInviteEmail(text);
                            setTeamInviteError('');
                          }}
                          placeholder="friend@company.com"
                          placeholderTextColor={colors.input.placeholder}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoCorrect={false}
                          style={{ flex: 1, color: colors.input.text, fontSize: 14, marginLeft: 10 }}
                          selectionColor={colors.text.primary}
                        />
                      </View>

                      <View className="flex-row mb-3" style={{ gap: 8 }}>
                        {(['admin', 'manager', 'staff'] as TeamRole[]).map((role) => (
                          <RoleChip
                            key={role}
                            role={role}
                            selected={teamInviteRole === role}
                            onPress={() => {
                              Haptics.selectionAsync();
                              setTeamInviteRole(role);
                            }}
                          />
                        ))}
                      </View>

                      <Pressable
                        onPress={handleAddTeamInvite}
                        disabled={isTeamInviteSubmitting}
                        className="rounded-full items-center justify-center active:opacity-80"
                        style={{ backgroundColor: '#111111', height: 48, opacity: isTeamInviteSubmitting ? 0.7 : 1 }}
                      >
                        {isTeamInviteSubmitting ? (
                          <View className="flex-row items-center">
                            <ActivityIndicator size="small" color="#FFFFFF" />
                            <Text className="text-white font-semibold ml-2">Creating Invite...</Text>
                          </View>
                        ) : (
                          <Text className="text-white font-semibold">Add Invite</Text>
                        )}
                      </Pressable>
                    </>
                  )}

                  {teamInviteError ? (
                    <View className="mt-3 p-3 rounded-xl" style={{ backgroundColor: 'rgba(239,68,68,0.1)' }}>
                      <Text className="text-red-500 text-sm text-center">{teamInviteError}</Text>
                    </View>
                  ) : null}
                </View>

                {pendingInvitesFiltered.length > 0 ? (
                  <View className="mb-4">
                    <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold uppercase tracking-wider mb-2">
                      Pending Invites
                    </Text>
                    {pendingInvitesFiltered.map((invite) => (
                      <View
                        key={invite.id}
                        className="rounded-xl p-3 mb-2"
                        style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}
                      >
                        <View className="flex-row items-center justify-between">
                          <View className="flex-1 mr-2">
                            <Text style={{ color: colors.text.primary }} className="font-medium text-sm">{invite.email}</Text>
                            <Text style={{ color: colors.text.muted }} className="text-xs mt-1">
                              Code: {invite.inviteCode}
                            </Text>
                          </View>
                          <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: `${roleColors[invite.role]}12` }}>
                            <Text style={{ color: roleColors[invite.role] }} className="text-xs font-semibold">
                              {roleLabels[invite.role]}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View className="mb-4 rounded-xl p-4" style={{ backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.light }}>
                    <Text style={{ color: colors.text.secondary }} className="text-sm font-medium text-center">No invites yet</Text>
                    <Text style={{ color: colors.text.tertiary }} className="text-xs text-center mt-1">
                      You can skip this step and invite your team later from Settings.
                    </Text>
                  </View>
                )}

                <Pressable
                  onPress={handleTeamContinue}
                  className="rounded-full items-center justify-center active:opacity-80"
                  style={{ backgroundColor: '#111111', height: 54 }}
                >
                  <Text className="text-white font-semibold">Continue to Bottlenecks</Text>
                </Pressable>
              </View>
            ) : null}

            {step === 3 ? (
              <View>
                <View className="rounded-2xl p-4 mb-4" style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
                  <View className="flex-row items-center justify-between mb-3">
                    <View>
                      <Text style={{ color: colors.text.primary }} className="font-semibold">What slows you down most?</Text>
                      <Text style={{ color: colors.text.tertiary }} className="text-xs mt-1">
                        Choose one or more. We will prioritize the workspace around these pain points.
                      </Text>
                    </View>
                    <Pressable
                      onPress={handleSelectAllBottlenecks}
                      className="px-3 py-2 rounded-full active:opacity-80"
                      style={{ backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.light }}
                    >
                      <Text style={{ color: colors.text.primary }} className="text-xs font-semibold">
                        {selectedBottlenecks.length === BOTTLENECK_OPTIONS.length ? 'Clear All' : 'Select All'}
                      </Text>
                    </Pressable>
                  </View>

                  {BOTTLENECK_OPTIONS.map((option) => {
                    const selected = selectedBottlenecks.includes(option);
                    return (
                      <Pressable
                        key={option}
                        onPress={() => toggleBottleneck(option)}
                        className="rounded-xl p-4 mb-2 active:opacity-80 flex-row items-center"
                        style={{
                          backgroundColor: selected ? 'rgba(17,17,17,0.05)' : colors.bg.secondary,
                          borderWidth: 1,
                          borderColor: selected ? '#111111' : colors.border.light,
                        }}
                      >
                        <View
                          className="w-6 h-6 rounded-md items-center justify-center mr-3"
                          style={{
                            backgroundColor: selected ? '#111111' : colors.bg.card,
                            borderWidth: 1,
                            borderColor: selected ? '#111111' : colors.border.light,
                          }}
                        >
                          {selected ? <Check size={14} color="#FFFFFF" strokeWidth={2.8} /> : null}
                        </View>
                        <Text style={{ color: colors.text.primary }} className="flex-1 font-medium text-sm">
                          {option}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {bottlenecksError ? (
                  <View className="mb-4 p-3 rounded-xl" style={{ backgroundColor: 'rgba(239,68,68,0.1)' }}>
                    <Text className="text-red-500 text-sm text-center">{bottlenecksError}</Text>
                  </View>
                ) : null}

                <Pressable
                  onPress={handleStartBuild}
                  className="rounded-full items-center justify-center active:opacity-80 flex-row"
                  style={{ backgroundColor: '#111111', height: 56 }}
                >
                  <Wand2 size={18} color="#FFFFFF" strokeWidth={2} />
                  <Text className="text-white font-semibold ml-2">Build My Workspace</Text>
                </Pressable>
              </View>
            ) : null}

            {step === 4 ? (
              <View>
                <LinearGradient
                  colors={['#0A0A0A', '#171717', '#222222']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ borderRadius: 24, padding: 18 }}
                >
                  <View className="rounded-2xl p-4" style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                    <View className="flex-row items-center mb-4">
                      <View className="w-12 h-12 rounded-2xl items-center justify-center mr-3" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                        <Sparkles size={22} color="#FFFFFF" strokeWidth={2} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-white text-base font-semibold">Building {businessName || 'your'} workspace</Text>
                        <Text className="text-white/70 text-xs mt-1">{currentStage}</Text>
                      </View>
                    </View>

                    <View className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                      <View
                        style={{
                          width: `${Math.max(6, buildProgress)}%`,
                          height: '100%',
                          backgroundColor: '#D4AF37',
                        }}
                      />
                    </View>

                    <View className="flex-row items-center justify-between mt-3">
                      <Text className="text-white/80 text-xs">{Math.round(buildProgress)}% complete</Text>
                      <View className="flex-row items-center">
                        <ActivityIndicator size="small" color="#FFFFFF" />
                        <Text className="text-white/70 text-xs ml-2">{isFinalizing ? 'Finalizing' : 'Preparing'}</Text>
                      </View>
                    </View>

                    <View className="mt-5">
                      {buildStages.map((stage, index) => {
                        const completed = buildProgress >= (index + 1) * 25;
                        const active = index === buildStageIndex;
                        return (
                          <View key={stage} className="flex-row items-center mb-2">
                            <View
                              className="w-6 h-6 rounded-full items-center justify-center mr-3"
                              style={{
                                backgroundColor: completed ? '#22C55E' : active ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.06)',
                                borderWidth: 1,
                                borderColor: completed ? '#22C55E' : active ? '#D4AF37' : 'rgba(255,255,255,0.08)',
                              }}
                            >
                              {completed ? (
                                <Check size={12} color="#FFFFFF" strokeWidth={3} />
                              ) : (
                                <Text className="text-white/80 text-[10px] font-semibold">{index + 1}</Text>
                              )}
                            </View>
                            <Text style={{ color: active || completed ? '#FFFFFF' : 'rgba(255,255,255,0.6)' }} className="text-sm">
                              {stage}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </LinearGradient>

                {buildError ? (
                  <View className="mt-4 p-3 rounded-xl" style={{ backgroundColor: 'rgba(239,68,68,0.12)' }}>
                    <Text className="text-red-400 text-sm text-center">{buildError}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <View className="h-10" />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
