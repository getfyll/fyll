import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { storage } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import useFyllStore from "./fyll-store";

export type TeamRole = 'admin' | 'manager' | 'staff';

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: TeamRole;
  createdAt: string;
  lastLogin?: string;
}

export interface PendingInvite {
  id: string;
  email: string;
  role: TeamRole;
  inviteCode: string;
  invitedBy: string;
  invitedAt: string;
  expiresAt: string;
  businessId: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: TeamRole;
  businessId: string;
  isOffline?: boolean;
}

// Role permissions
export const ROLE_PERMISSIONS = {
  admin: {
    canViewInsights: true,
    canViewRevenue: true,
    canViewAnalytics: true,
    canDeleteData: true,
    canManageTeam: true,
    canEditInventory: true,
    canProcessOrders: true,
    canRestock: true,
    canScanQR: true,
    canDoInventoryChecks: true,
  },
  manager: {
    canViewInsights: false,
    canViewRevenue: false,
    canViewAnalytics: false,
    canDeleteData: false,
    canManageTeam: false,
    canEditInventory: true,
    canProcessOrders: true,
    canRestock: true,
    canScanQR: true,
    canDoInventoryChecks: true,
  },
  staff: {
    canViewInsights: false,
    canViewRevenue: false,
    canViewAnalytics: false,
    canDeleteData: false,
    canManageTeam: false,
    canEditInventory: false,
    canProcessOrders: true,
    canRestock: false,
    canScanQR: true,
    canDoInventoryChecks: true,
  },
} as const;

interface AuthStore {
  // Auth state
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  isOfflineMode: boolean;
  currentUser: AuthUser | null;
  businessId: string | null;

  // Team management
  teamMembers: TeamMember[];
  pendingInvites: PendingInvite[];

  // Actions
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (input: { businessName: string; name: string; email: string; password: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (name: string, email: string) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  enableOfflineMode: (input?: { businessName?: string; name?: string; email?: string }) => void;

  // Team actions (admin only)
  refreshTeamData: () => Promise<void>;
  updateTeamMember: (id: string, updates: Partial<TeamMember>) => Promise<void>;
  removeTeamMember: (id: string) => Promise<void>;

  // Invite actions
  createInvite: (email: string, role: TeamRole, invitedBy: string) => Promise<PendingInvite>;
  cancelInvite: (inviteId: string) => Promise<void>;
  acceptInvite: (inviteCode: string, name: string, password: string) => Promise<{ success: boolean; error?: string }>;
  getInviteByCode: (inviteCode: string) => Promise<PendingInvite | undefined>;

  // Legacy (no-op for now)
  setUserPassword: (email: string, password: string) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 12);
const generateInviteCode = () => Math.random().toString(36).substring(2, 10).toUpperCase();

const slugify = (value: string) => value
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)+/g, '');

const createBusinessId = (businessName: string) => {
  const base = slugify(businessName) || 'business';
  return `${base}-${Math.random().toString(36).substring(2, 8)}`;
};

const getAuthErrorMessage = (error: unknown, fallback: string) => {
  const message = (error as { message?: string })?.message;
  if (message) {
    if (message.toLowerCase().includes('invalid login credentials')) {
      return 'Invalid email or password. Please check and try again.';
    }
    if (message.toLowerCase().includes('email not confirmed')) {
      return 'Please verify your email before signing in.';
    }
    if (message.toLowerCase().includes('user already registered')) {
      return 'This email is already registered. Please sign in instead.';
    }
    if (message.toLowerCase().includes('password') && message.toLowerCase().includes('weak')) {
      return 'Password must be at least 6 characters.';
    }
  }

  const code = (error as { code?: string })?.code;
  if (!code) return fallback;

  switch (code) {
    case 'auth/email-already-in-use':
      return 'This email is already in use.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/user-not-found':
      return 'No account found for this email.';
    case 'auth/wrong-password':
      return 'Incorrect password.';
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please check and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';
    default:
      return fallback;
  }
};

const normalizeRole = (value?: string | null): TeamRole => {
  if (value === 'admin' || value === 'manager' || value === 'staff') {
    return value;
  }
  return 'admin';
};

const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      isAuthLoading: false,
      isOfflineMode: false,
      currentUser: null,
      businessId: null,
      teamMembers: [],
      pendingInvites: [],

      login: async (email, password) => {
        try {
          set({ isAuthLoading: true });

          const normalizedEmail = email.trim().toLowerCase();
          const profileKey = `fyll_user_profile:${normalizedEmail}`;
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });

          if (authError || !authData.user) {
            throw authError ?? new Error('Login failed');
          }

          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, email, name, role, business_id, businessId')
            .eq('id', authData.user.id)
            .maybeSingle();

          if (profileError) {
            console.warn('Auth successful, but profile lookup failed:', profileError);
          }

          const businessId = profile?.business_id ?? profile?.businessId ?? null;

          if (!businessId) {
            await supabase.auth.signOut();
            set({ isAuthLoading: false });
            return {
              success: false,
              error: 'Account data not found. Please contact support.',
            };
          }

          const userData: AuthUser = {
            id: authData.user.id,
            email: profile?.email ?? authData.user.email ?? normalizedEmail,
            name: profile?.name ?? authData.user.email?.split('@')[0] ?? normalizedEmail.split('@')[0],
            role: normalizeRole(profile?.role),
            businessId,
          };

          supabase
            .from('team_members')
            .update({ last_login: new Date().toISOString() })
            .eq('user_id', authData.user.id)
            .eq('business_id', businessId)
            .then(() => {})
            .catch(() => {});

          set({
            isAuthenticated: true,
            currentUser: userData,
            businessId,
            isOfflineMode: false,
            isAuthLoading: false,
          });

          storage.setItem(
            profileKey,
            JSON.stringify({ businessId, name: userData.name })
          ).catch(() => {});

          supabase
            .from('businesses')
            .select('name')
            .eq('id', businessId)
            .maybeSingle()
            .then(({ data, error }) => {
              if (error || !data?.name) return;
              storage.setItem(
                `fyll_business_settings:${businessId}`,
                JSON.stringify({ businessName: data.name })
              ).catch(() => {});
            })
            .catch(() => {});

          get()
            .refreshTeamData()
            .catch((refreshError) => {
              console.warn('Could not refresh team data:', refreshError);
            });

          return { success: true };
        } catch (error) {
          set({ isAuthLoading: false });
          console.error('Login failed:', error);
          return { success: false, error: getAuthErrorMessage(error, 'Login failed. Please try again.') };
        }
      },

      signup: async ({ businessName, name, email, password }) => {
        let createdUserId: string | null = null;
        try {
          set({ isAuthLoading: true });

          const normalizedEmail = email.trim().toLowerCase();
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id, business_id, businessId')
            .eq('email', normalizedEmail)
            .maybeSingle();

          if (existingProfile) {
            set({ isAuthLoading: false });
            return {
              success: false,
              error: 'This email is already registered. Please sign in instead.',
            };
          }

          const { data: signupData, error: signupError } = await supabase.auth.signUp({
            email: normalizedEmail,
            password,
            options: {
              data: { name: name.trim() },
            },
          });

          if (signupError || !signupData.user) {
            throw signupError ?? new Error('Unable to create account');
          }

          createdUserId = signupData.user.id;
          const businessId = createBusinessId(businessName);
          const createdAt = new Date().toISOString();

          console.log('🆕 Creating new account:', {
            email: normalizedEmail,
            businessId,
            uid: createdUserId,
          });

          // Use upsert to handle cases where user was created but insert failed
          const { error: businessError } = await supabase
            .from('businesses')
            .upsert({
              id: businessId,
              name: businessName.trim(),
              owner_id: createdUserId,
              created_at: createdAt,
            }, {
              onConflict: 'id'
            });

          if (businessError) {
            throw businessError;
          }

          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: createdUserId,
              email: normalizedEmail,
              name: name.trim(),
              role: 'admin',
              business_id: businessId,
              created_at: createdAt,
            }, {
              onConflict: 'id'
            });

          if (profileError) {
            throw profileError;
          }

          // Try to insert team member, but don't fail if table doesn't exist
          try {
            const { error: teamError } = await supabase
              .from('team_members')
              .upsert({
                user_id: createdUserId,
                email: normalizedEmail,
                name: name.trim(),
                role: 'admin',
                business_id: businessId,
                created_at: createdAt,
                last_login: createdAt,
              }, {
                onConflict: 'user_id,business_id'
              });

            if (teamError) {
              console.warn('Could not upsert team member:', teamError);
            }
          } catch (teamInsertError) {
            console.warn('team_members table may not exist:', teamInsertError);
          }

          set({
            isAuthenticated: true,
            currentUser: {
              id: createdUserId,
              email: normalizedEmail,
              name: name.trim(),
              role: 'admin',
              businessId,
            },
            businessId,
            isAuthLoading: false,
          });

          // Clear demo data and save business name for new account
          try {
            // Reset store to clear Mint Eyewear demo data
            useFyllStore.getState().resetStore();
            console.log('Demo data cleared for new account');

            const businessSettings = {
              businessName: businessName.trim(),
              businessLogo: null,
              businessPhone: '',
              businessWebsite: '',
              returnAddress: '',
            };
            await storage.setItem(`fyll_business_settings:${businessId}`, JSON.stringify(businessSettings));
            await storage.setItem(
              `fyll_user_profile:${normalizedEmail}`,
              JSON.stringify({ businessId, name: name.trim() })
            );
            console.log('Business settings saved:', businessName.trim());
          } catch (settingsError) {
            console.warn('Could not save business settings:', settingsError);
          }

          // Try to refresh team data, but don't fail if it doesn't work
          try {
            await get().refreshTeamData();
          } catch (teamError) {
            console.warn('Could not refresh team data:', teamError);
          }

          return { success: true };
        } catch (error) {
          set({ isAuthLoading: false });
          console.error('Signup failed:', error);
          return { success: false, error: getAuthErrorMessage(error, 'Unable to create account. Please try again.') };
        }
      },

      logout: async () => {
        try {
          await Promise.race([
            supabase.auth.signOut(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
          ]);
        } catch (error) {
          console.warn('Logout failed, clearing local session anyway:', error);
        }

        try {
          await storage.removeItem('fyll-auth-storage');
        } catch (storageError) {
          console.warn('Could not clear auth storage:', storageError);
        }

        set({
          isAuthenticated: false,
          isOfflineMode: false,
          currentUser: null,
          businessId: null,
          teamMembers: [],
          pendingInvites: [],
        });
      },

      updateProfile: async (name, email) => {
        const currentUser = get().currentUser;
        if (!currentUser) {
          throw new Error('Not signed in');
        }

        const normalizedEmail = email.trim().toLowerCase();

        const { error: authError } = await supabase.auth.updateUser({
          email: normalizedEmail,
          data: { name: name.trim() },
        });

        if (authError) {
          throw authError;
        }

        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            name: name.trim(),
            email: normalizedEmail,
          })
          .eq('id', currentUser.id);

        if (profileError) {
          throw profileError;
        }

        const { error: teamError } = await supabase
          .from('team_members')
          .update({
            name: name.trim(),
            email: normalizedEmail,
          })
          .eq('user_id', currentUser.id);

        if (teamError) {
          throw teamError;
        }

        const updatedUser = {
          ...currentUser,
          name: name.trim(),
          email: normalizedEmail,
        };

        set({ currentUser: updatedUser });

        const oldProfileKey = `fyll_user_profile:${currentUser.email}`;
        const newProfileKey = `fyll_user_profile:${normalizedEmail}`;

        if (currentUser.businessId) {
          storage.setItem(
            newProfileKey,
            JSON.stringify({ businessId: currentUser.businessId, name: updatedUser.name })
          ).catch(() => {});
        }

        if (oldProfileKey !== newProfileKey) {
          storage.removeItem(oldProfileKey).catch(() => {});
        }
      },

      updatePassword: async (currentPassword, newPassword) => {
        const currentUser = get().currentUser;
        if (!currentUser?.email) {
          return { success: false, error: 'Not signed in.' };
        }

        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email: currentUser.email,
          password: currentPassword,
        });

        if (verifyError) {
          return { success: false, error: 'Current password is incorrect.' };
        }

        const { error: updateError } = await supabase.auth.updateUser({
          password: newPassword,
        });

        if (updateError) {
          return { success: false, error: getAuthErrorMessage(updateError, 'Failed to update password.') };
        }

        return { success: true };
      },

      enableOfflineMode: (input) => {
        const businessId = createBusinessId(input?.businessName ?? 'Offline Business');
        const name = input?.name?.trim() || input?.email?.split('@')[0] || 'Offline User';
        const email = input?.email?.trim().toLowerCase() || 'offline@local';
        const offlineUser: AuthUser = {
          id: `offline-${Date.now()}`,
          email,
          name,
          role: 'admin',
          businessId,
          isOffline: true,
        };

        set({
          isAuthenticated: true,
          isOfflineMode: true,
          currentUser: offlineUser,
          businessId,
          teamMembers: [
            {
              id: offlineUser.id,
              email: offlineUser.email,
              name: offlineUser.name,
              role: offlineUser.role,
              createdAt: new Date().toISOString(),
              lastLogin: new Date().toISOString(),
            },
          ],
          pendingInvites: [],
        });

        storage.setItem(
          `fyll_business_settings:${businessId}`,
          JSON.stringify({
            businessName: input?.businessName?.trim() || 'Offline Business',
            businessLogo: null,
            businessPhone: '',
            businessWebsite: '',
            returnAddress: '',
          })
        ).catch(() => {});
      },

      refreshTeamData: async () => {
        const businessId = get().businessId;
        if (!businessId) return;

        const { data: teamRows, error: teamError } = await supabase
          .from('team_members')
          .select('*')
          .eq('business_id', businessId);

        if (teamError) {
          throw teamError;
        }

        const members = (teamRows ?? []).map((row) => ({
          id: row.user_id ?? row.id,
          email: row.email,
          name: row.name,
          role: normalizeRole(row.role),
          createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
          lastLogin: row.last_login ?? row.lastLogin,
        })) as TeamMember[];

        const { data: inviteRows, error: inviteError } = await supabase
          .from('invites')
          .select('*')
          .eq('business_id', businessId);

        if (inviteError) {
          throw inviteError;
        }

        const now = new Date();
        const invites = (inviteRows ?? [])
          .map((row) => ({
            id: row.id,
            email: row.email,
            role: normalizeRole(row.role),
            inviteCode: row.invite_code ?? row.inviteCode,
            invitedBy: row.invited_by ?? row.invitedBy,
            invitedAt: row.invited_at ?? row.invitedAt ?? new Date().toISOString(),
            expiresAt: row.expires_at ?? row.expiresAt ?? new Date().toISOString(),
            businessId: row.business_id ?? row.businessId,
          }))
          .filter((invite) => new Date(invite.expiresAt) > now) as PendingInvite[];

        set({ teamMembers: members, pendingInvites: invites });
      },

      updateTeamMember: async (id, updates) => {
        const businessId = get().businessId;
        if (!businessId) return;

        const updatePayload: Record<string, unknown> = {};
        if (updates.name) updatePayload.name = updates.name;
        if (updates.email) updatePayload.email = updates.email;
        if (updates.role) updatePayload.role = updates.role;
        if (updates.lastLogin) updatePayload.last_login = updates.lastLogin;

        const { error: teamError } = await supabase
          .from('team_members')
          .update(updatePayload)
          .eq('user_id', id)
          .eq('business_id', businessId);

        if (teamError) {
          throw teamError;
        }

        const profilePayload: Record<string, unknown> = {};
        if (updates.name) profilePayload.name = updates.name;
        if (updates.email) profilePayload.email = updates.email;
        if (updates.role) profilePayload.role = updates.role;

        if (Object.keys(profilePayload).length > 0) {
          const { error: profileError } = await supabase
            .from('profiles')
            .update(profilePayload)
            .eq('id', id);

          if (profileError) {
            throw profileError;
          }
        }

        set({
          teamMembers: get().teamMembers.map((member) =>
            member.id === id ? { ...member, ...updates } : member
          ),
        });
      },

      removeTeamMember: async (id) => {
        const businessId = get().businessId;
        if (!businessId) return;

        const { error: teamError } = await supabase
          .from('team_members')
          .delete()
          .eq('user_id', id)
          .eq('business_id', businessId);

        if (teamError) {
          throw teamError;
        }

        set({
          teamMembers: get().teamMembers.filter((member) => member.id !== id),
        });
      },

      createInvite: async (email, role, invitedBy) => {
        if (get().isOfflineMode) {
          throw new Error('You appear to be offline. Connect to the internet and try again.');
        }

        const businessId = get().businessId;
        if (!businessId) {
          throw new Error('No business selected');
        }

        const normalizedEmail = email.toLowerCase();
        const existingMember = get().teamMembers.find(
          (member) => member.email.toLowerCase() === normalizedEmail
        );
        if (existingMember) {
          throw new Error('User already exists');
        }

        const invite: PendingInvite = {
          id: generateId(),
          email: normalizedEmail,
          role,
          inviteCode: generateInviteCode(),
          invitedBy,
          invitedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          businessId,
        };

        const { data: inviteRow, error: inviteError } = await supabase
          .from('invites')
          .insert({
            email: invite.email,
            role: invite.role,
            invite_code: invite.inviteCode,
            invited_by: invite.invitedBy,
            invited_at: invite.invitedAt,
            expires_at: invite.expiresAt,
            business_id: invite.businessId,
          })
          .select()
          .single();

        if (inviteError) {
          console.warn('Supabase invite creation failed:', inviteError);
          throw new Error('Invite could not be created. Please try again.');
        }

        const savedInvite: PendingInvite = {
          ...invite,
          id: inviteRow?.id ?? invite.id,
        };

        set({ pendingInvites: [...get().pendingInvites, savedInvite] });

        return savedInvite;
      },

      cancelInvite: async (inviteId) => {
        const { error: inviteError } = await supabase
          .from('invites')
          .delete()
          .eq('id', inviteId);

        if (inviteError) {
          throw inviteError;
        }
        set({
          pendingInvites: get().pendingInvites.filter((invite) => invite.id !== inviteId),
        });
      },

      getInviteByCode: async (inviteCode) => {
        const { data: inviteRows, error: inviteError } = await supabase
          .from('invites')
          .select('*')
          .eq('invite_code', inviteCode)
          .limit(1);

        if (inviteError) {
          throw inviteError;
        }

        const row = inviteRows?.[0];
        const invite = row
          ? {
            id: row.id,
            email: row.email,
            role: normalizeRole(row.role),
            inviteCode: row.invite_code ?? row.inviteCode,
            invitedBy: row.invited_by ?? row.invitedBy,
            invitedAt: row.invited_at ?? row.invitedAt ?? new Date().toISOString(),
            expiresAt: row.expires_at ?? row.expiresAt ?? new Date().toISOString(),
            businessId: row.business_id ?? row.businessId,
          }
          : undefined;
        if (!invite) return undefined;
        if (new Date(invite.expiresAt) < new Date()) return undefined;
        return invite;
      },

      acceptInvite: async (inviteCode, name, password) => {
        try {
          set({ isAuthLoading: true });
          const invite = await get().getInviteByCode(inviteCode);

          if (!invite) {
            set({ isAuthLoading: false });
            return { success: false, error: 'Invalid or expired invite code' };
          }

          const { data: signupData, error: signupError } = await supabase.auth.signUp({
            email: invite.email,
            password,
            options: {
              data: { name: name.trim() },
            },
          });

          if (signupError || !signupData.user) {
            throw signupError ?? new Error('Invite signup failed');
          }

          const createdUserId = signupData.user.id;
          const createdAt = new Date().toISOString();

          const { error: profileError } = await supabase.from('profiles').insert({
            id: createdUserId,
            email: invite.email,
            name: name.trim(),
            role: invite.role,
            business_id: invite.businessId,
            created_at: createdAt,
          });

          if (profileError) {
            throw profileError;
          }

          const { error: teamError } = await supabase.from('team_members').insert({
            user_id: createdUserId,
            email: invite.email,
            name: name.trim(),
            role: invite.role,
            business_id: invite.businessId,
            created_at: createdAt,
            last_login: createdAt,
          });

          if (teamError) {
            throw teamError;
          }

          const { error: inviteError } = await supabase
            .from('invites')
            .delete()
            .eq('id', invite.id);

          if (inviteError) {
            throw inviteError;
          }

          set({
            isAuthenticated: true,
            currentUser: {
              id: createdUserId,
              email: invite.email,
              name: name.trim(),
              role: invite.role,
              businessId: invite.businessId,
            },
            businessId: invite.businessId,
            isAuthLoading: false,
          });

          await get().refreshTeamData();
          return { success: true };
        } catch (error) {
          set({ isAuthLoading: false });
          console.error('Invite signup failed:', error);
          return { success: false, error: getAuthErrorMessage(error, 'Failed to create account.') };
        }
      },

      setUserPassword: () => {
        // Password changes are handled through Supabase Auth.
      },
    }),
    {
      name: "fyll-auth-storage",
      storage: createJSONStorage(() => storage),
    }
  )
);

export default useAuthStore;
