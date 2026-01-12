import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { storage } from "@/lib/storage";
import { createUserWithEmailAndPassword, deleteUser, signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../firebase/firebaseConfig";
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
          const isOfflineCode = (code?: string) =>
            code === 'failed-precondition' || code === 'unavailable' || code === 'deadline-exceeded';
          const withTimeout = async <T,>(promise: Promise<T>, ms: number) => {
            const timeout = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('timeout')), ms)
            );
            return Promise.race([promise, timeout]) as Promise<T>;
          };

          // Authenticate with Firebase
          const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);

          console.log('🔐 User authenticated with UID:', credential.user.uid);
          console.log('📧 Email:', normalizedEmail);

          let userData: AuthUser | null = null;
          let businessId: string | null = null;
          let businessName: string | null = null;
          let isOfflineError = false;

          try {
            console.log('🔍 Attempting to fetch user data from Firestore...');
            const userRef = doc(db, 'users', credential.user.uid);
            const userSnap = await withTimeout(getDoc(userRef), 5000); // Reduced to 5s for faster failure

            if (userSnap.exists()) {
              console.log('✅ User data found in Firestore');
              const data = userSnap.data() as AuthUser;
              userData = data;
              businessId = data.businessId;
              console.log('🏢 BusinessId from Firestore:', businessId);

              if (businessId) {
                setDoc(
                  doc(db, `businesses/${businessId}/team`, credential.user.uid),
                  { lastLogin: new Date().toISOString() },
                  { merge: true }
                ).catch(() => {});
              }
            } else {
              console.log('⚠️ User document does not exist in Firestore');
            }
          } catch (firestoreError) {
            const code = (firestoreError as { code?: string })?.code;
            const isTimeout = (firestoreError as Error).message === 'timeout';
            isOfflineError = isOfflineCode(code) || isTimeout;

            console.error('❌ Firestore connection error:', firestoreError);
            console.error('Error code:', code, '| Is timeout:', isTimeout);

            // If timeout on first attempt, try to proceed with fallback immediately
            if (isTimeout) {
              console.log('⚡ Timeout detected - will try fallback methods');
            }
          }

          if (!userData && !isOfflineError) {
            try {
              const emailQuery = await withTimeout(
                getDocs(query(collection(db, 'users'), where('email', '==', normalizedEmail))),
                10000
              );
              const emailDoc = emailQuery.docs[0];
              if (emailDoc) {
                const data = emailDoc.data() as AuthUser;
                businessId = data.businessId;
                userData = {
                  id: credential.user.uid,
                  email: data.email ?? credential.user.email ?? normalizedEmail,
                  name: data.name ?? credential.user.displayName ?? normalizedEmail.split('@')[0],
                  role: data.role ?? 'admin',
                  businessId: data.businessId,
                };
                await setDoc(doc(db, 'users', credential.user.uid), userData, { merge: true });
              }
            } catch (lookupError) {
              const code = (lookupError as { code?: string })?.code;
              isOfflineError =
                isOfflineError || isOfflineCode(code) || (lookupError as Error).message === 'timeout';
              console.warn('Could not lookup user by email:', lookupError);
            }
          }

          if (!userData && !isOfflineError) {
            try {
              const businessSnap = await withTimeout(
                getDocs(query(collection(db, 'businesses'), where('ownerUid', '==', credential.user.uid))),
                10000
              );
              const businessDoc = businessSnap.docs[0];
              if (businessDoc) {
                const data = businessDoc.data() as { name?: string };
                businessId = businessDoc.id;
                businessName = data?.name ?? null;
                userData = {
                  id: credential.user.uid,
                  email: credential.user.email || normalizedEmail,
                  name: credential.user.displayName || normalizedEmail.split('@')[0],
                  role: 'admin',
                  businessId,
                };
                await setDoc(doc(db, 'users', credential.user.uid), userData, { merge: true });
              }
            } catch (fallbackError) {
              const code = (fallbackError as { code?: string })?.code;
              isOfflineError =
                isOfflineError || isOfflineCode(code) || (fallbackError as Error).message === 'timeout';
              console.warn('Could not recover business profile:', fallbackError);
            }
          }

          if (!userData) {
            try {
              console.log('🔧 Auto-provisioning user profile...');
              const createdAt = new Date().toISOString();
              businessId = `business-${credential.user.uid.substring(0, 8)}`;
              businessName = credential.user.displayName
                ? `${credential.user.displayName}'s Business`
                : `${normalizedEmail.split('@')[0]}'s Business`;
              console.log('🆕 Creating NEW businessId:', businessId);
              console.log('👤 For user UID:', credential.user.uid);
              userData = {
                id: credential.user.uid,
                email: credential.user.email || normalizedEmail,
                name: credential.user.displayName || normalizedEmail.split('@')[0],
                role: 'admin',
                businessId,
              };

              // Try to provision with short timeout - if it fails, continue anyway
              try {
                await Promise.race([
                  Promise.all([
                    setDoc(doc(db, 'businesses', businessId), {
                      id: businessId,
                      name: businessName,
                      ownerUid: credential.user.uid,
                      createdAt,
                    }),
                    setDoc(doc(db, 'users', credential.user.uid), {
                      ...userData,
                      createdAt,
                    }),
                    setDoc(doc(db, `businesses/${businessId}/team`, credential.user.uid), {
                      id: credential.user.uid,
                      email: userData.email,
                      name: userData.name,
                      role: userData.role,
                      createdAt,
                      lastLogin: createdAt,
                    }),
                  ]),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('provision-timeout')), 3000))
                ]);
                console.log('✅ User profile provisioned successfully');
              } catch (writeError) {
                console.warn('⚠️ Could not write to Firestore, but continuing with login:', writeError);
                // Continue anyway - user will still be logged in
              }
            } catch (provisionError) {
              console.warn('Could not provision missing user profile:', provisionError);
            }
          }

          if (!userData && isOfflineError) {
            const cachedProfile = await storage.getItem(profileKey);
            if (cachedProfile) {
              const parsed = JSON.parse(cachedProfile) as { businessId?: string; name?: string };
              businessId = parsed.businessId ?? null;
              userData = {
                id: credential.user.uid,
                email: credential.user.email || normalizedEmail,
                name: parsed.name ?? credential.user.displayName ?? normalizedEmail.split('@')[0],
                role: 'admin',
                businessId: businessId ?? '',
              };
            } else {
              userData = {
                id: credential.user.uid,
                email: credential.user.email || normalizedEmail,
                name: credential.user.displayName || normalizedEmail.split('@')[0],
                role: 'admin',
                businessId: '',
              };
            }
          }

          // CRITICAL: Require businessId - don't allow broken offline login
          if (!userData || !businessId) {
            await signOut(auth);
            set({ isAuthLoading: false });
            return {
              success: false,
              error: isOfflineError
                ? 'Cannot reach Firebase. Please check your internet connection and try again.'
                : 'Account data not found. Please create a new account or contact support.',
            };
          }

          set({
            isAuthenticated: true,
            currentUser: userData,
            businessId: businessId,
            isOfflineMode: false, // If we got businessId, we're not offline
            isAuthLoading: false,
          });

          if (businessId && !isOfflineError) {
            try {
              const businessSnap = await getDoc(doc(db, 'businesses', businessId));
              if (businessSnap.exists()) {
                const data = businessSnap.data() as { name?: string };
                businessName = data?.name ?? businessName;
              }
              if (businessName) {
                await storage.setItem(
                  `fyll_business_settings:${businessId}`,
                  JSON.stringify({ businessName })
                );
              }
            } catch (settingsError) {
              console.warn('Could not sync business settings:', settingsError);
            }
          }

          if (businessId) {
            storage.setItem(
              profileKey,
              JSON.stringify({ businessId, name: userData.name })
            ).catch(() => {});
          }

          if (!isOfflineError) {
            get()
              .refreshTeamData()
              .catch((refreshError) => {
                console.warn('Could not refresh team data:', refreshError);
              });
          }

          return { success: true };
        } catch (error) {
          set({ isAuthLoading: false });
          console.error('Login failed:', error);
          return { success: false, error: getAuthErrorMessage(error, 'Login failed. Please try again.') };
        }
      },

      signup: async ({ businessName, name, email, password }) => {
        let createdUser: typeof auth.currentUser | null = null;
        try {
          set({ isAuthLoading: true });

          // Check if user already exists in Firestore
          try {
            const existingUserQuery = query(
              collection(db, 'users'),
              where('email', '==', email.trim().toLowerCase())
            );
            const existingUserSnap = await getDocs(existingUserQuery);

            if (!existingUserSnap.empty) {
              const existingUser = existingUserSnap.docs[0].data() as AuthUser;
              set({ isAuthLoading: false });
              return {
                success: false,
                error: `This email is already registered. Please sign in instead. (Business: ${existingUser.businessId})`
              };
            }
          } catch (checkError) {
            console.warn('Could not check for existing user:', checkError);
            // Continue with signup if check fails
          }

          const normalizedEmail = email.trim().toLowerCase();
          const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
          createdUser = credential.user;
          const businessId = createBusinessId(businessName);
          const createdAt = new Date().toISOString();

          console.log('🆕 Creating new account:', {
            email: normalizedEmail,
            businessId,
            uid: credential.user.uid,
          });

          // Try to write to Firestore with timeout and fallback
          try {
            const firestoreTimeout = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Firestore timeout')), 10000)
            );

            await Promise.race([
              Promise.all([
                setDoc(doc(db, 'businesses', businessId), {
                  id: businessId,
                  name: businessName.trim(),
                  ownerUid: credential.user.uid,
                  createdAt,
                }),
                setDoc(doc(db, 'users', credential.user.uid), {
                  id: credential.user.uid,
                  email: normalizedEmail,
                  name: name.trim(),
                  role: 'admin',
                  businessId,
                  createdAt,
                }),
                setDoc(doc(db, `businesses/${businessId}/team`, credential.user.uid), {
                  id: credential.user.uid,
                  email: normalizedEmail,
                  name: name.trim(),
                  role: 'admin',
                  createdAt,
                  lastLogin: createdAt,
                }),
              ]),
              firestoreTimeout,
            ]);

            console.log('Firestore signup data saved successfully');
          } catch (firestoreError) {
            console.warn('Firestore unavailable during signup, continuing with auth-only mode:', firestoreError);
            // Continue without Firestore - user is still created in Firebase Auth
          }

          set({
            isAuthenticated: true,
            currentUser: {
              id: credential.user.uid,
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
          if (createdUser) {
            try {
              await deleteUser(createdUser);
            } catch (cleanupError) {
              console.error('Cleanup failed after signup error:', cleanupError);
            }
          }
          set({ isAuthLoading: false });
          console.error('Signup failed:', error);
          return { success: false, error: getAuthErrorMessage(error, 'Unable to create account. Please try again.') };
        }
      },

      logout: async () => {
        try {
          await Promise.race([
            signOut(auth),
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

        const teamSnap = await getDocs(collection(db, `businesses/${businessId}/team`));
        const members = teamSnap.docs.map((docSnap) => docSnap.data() as TeamMember);

        const invitesSnap = await getDocs(
          query(collection(db, 'invites'), where('businessId', '==', businessId))
        );
        const now = new Date();
        const invites = invitesSnap.docs
          .map((docSnap) => docSnap.data() as PendingInvite)
          .filter((invite) => new Date(invite.expiresAt) > now);

        set({ teamMembers: members, pendingInvites: invites });
      },

      updateTeamMember: async (id, updates) => {
        const businessId = get().businessId;
        if (!businessId) return;

        await updateDoc(doc(db, `businesses/${businessId}/team`, id), updates);
        await updateDoc(doc(db, 'users', id), updates);

        set({
          teamMembers: get().teamMembers.map((member) =>
            member.id === id ? { ...member, ...updates } : member
          ),
        });
      },

      removeTeamMember: async (id) => {
        const businessId = get().businessId;
        if (!businessId) return;

        await deleteDoc(doc(db, `businesses/${businessId}/team`, id));
        await deleteDoc(doc(db, 'users', id));

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

        // Save to Firestore; invite must exist for other devices
        try {
          const firestoreTimeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Firestore timeout')), 5000)
          );

          await Promise.race([
            setDoc(doc(db, 'invites', invite.id), invite),
            firestoreTimeout,
          ]);
          console.log('Invite saved to Firestore');
        } catch (firestoreError) {
          const code = (firestoreError as { code?: string })?.code;
          console.warn('Firestore unavailable, invite not created:', firestoreError);
          if (code === 'permission-denied') {
            throw new Error('Permission denied. Check Firestore rules for invites.');
          }
          if (code === 'unavailable' || code === 'failed-precondition') {
            throw new Error('Network issue. Please check your connection and try again.');
          }
          throw new Error('Invite could not be created. Please try again.');
        }

        // Update local state after Firestore succeeds
        set({ pendingInvites: [...get().pendingInvites, invite] });

        return invite;
      },

      cancelInvite: async (inviteId) => {
        await deleteDoc(doc(db, 'invites', inviteId));
        set({
          pendingInvites: get().pendingInvites.filter((invite) => invite.id !== inviteId),
        });
      },

      getInviteByCode: async (inviteCode) => {
        const inviteSnap = await getDocs(
          query(collection(db, 'invites'), where('inviteCode', '==', inviteCode))
        );

        const invite = inviteSnap.docs.map((docSnap) => docSnap.data() as PendingInvite)[0];
        if (!invite) return undefined;
        if (new Date(invite.expiresAt) < new Date()) return undefined;
        return invite;
      },

      acceptInvite: async (inviteCode, name, password) => {
        let createdUser: typeof auth.currentUser | null = null;
        try {
          set({ isAuthLoading: true });
          const invite = await get().getInviteByCode(inviteCode);

          if (!invite) {
            set({ isAuthLoading: false });
            return { success: false, error: 'Invalid or expired invite code' };
          }

          const credential = await createUserWithEmailAndPassword(auth, invite.email, password);
          createdUser = credential.user;
          const createdAt = new Date().toISOString();

          await setDoc(doc(db, 'users', credential.user.uid), {
            id: credential.user.uid,
            email: invite.email,
            name: name.trim(),
            role: invite.role,
            businessId: invite.businessId,
            createdAt,
          });

          await setDoc(doc(db, `businesses/${invite.businessId}/team`, credential.user.uid), {
            id: credential.user.uid,
            email: invite.email,
            name: name.trim(),
            role: invite.role,
            createdAt,
            lastLogin: createdAt,
          });

          await deleteDoc(doc(db, 'invites', invite.id));

          set({
            isAuthenticated: true,
            currentUser: {
              id: credential.user.uid,
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
          if (createdUser) {
            try {
              await deleteUser(createdUser);
            } catch (cleanupError) {
              console.error('Cleanup failed after invite error:', cleanupError);
            }
          }
          set({ isAuthLoading: false });
          console.error('Invite signup failed:', error);
          return { success: false, error: getAuthErrorMessage(error, 'Failed to create account.') };
        }
      },

      setUserPassword: () => {
        // Password changes are handled by Firebase Auth and are not implemented yet.
      },
    }),
    {
      name: "fyll-auth-storage",
      storage: createJSONStorage(() => storage),
    }
  )
);

export default useAuthStore;
