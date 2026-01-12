import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Platform } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { LayoutDashboard, Package, ShoppingCart, Settings, BarChart3, Users, LogOut, Activity } from 'lucide-react-native';
import { useThemeColors } from '@/lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAuthStore, { ROLE_PERMISSIONS } from '@/lib/state/auth-store';
import * as Haptics from 'expo-haptics';
import { firestoreDiagnostics } from '@/lib/firebase/diagnostics';

type PermissionKey = keyof typeof ROLE_PERMISSIONS['admin'];

interface NavItem {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  requiresPermission?: PermissionKey;
}

const navItems: NavItem[] = [
  { name: 'Home', href: '/', icon: LayoutDashboard },
  { name: 'Inventory', href: '/inventory', icon: Package },
  { name: 'Orders', href: '/orders', icon: ShoppingCart },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Insights', href: '/insights', icon: BarChart3, requiresPermission: 'canViewInsights' },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function DesktopSidebar() {
  const colors = useThemeColors();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const isDark = colors.bg.primary === '#111111';

  const currentUser = useAuthStore((s) => s.currentUser);
  const businessId = useAuthStore((s) => s.businessId);
  const logout = useAuthStore((s) => s.logout);
  const userRole = currentUser?.role ?? 'staff';

  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);

  const handleNavigation = (href: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Map routes to tab routes
    const routeMap: Record<string, string> = {
      '/': '/(tabs)',
      '/inventory': '/(tabs)/inventory',
      '/orders': '/(tabs)/orders',
      '/insights': '/(tabs)/insights',
      '/settings': '/(tabs)/settings',
    };

    const targetRoute = routeMap[href] || href;
    router.push(targetRoute as any);
  };

  const handleLogout = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    await logout();
    router.replace('/login');
  };

  const handleRunDiagnostics = async () => {
    if (!businessId || isRunningDiagnostics) return;

    setIsRunningDiagnostics(true);
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔧 FIRESTORE DIAGNOSTICS STARTING');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');

    try {
      const results = await firestoreDiagnostics.testConnectivity(businessId);

      console.log('');
      console.log('═══════════════════════════════════════════════════════');
      console.log('📊 FINAL RESULTS:');
      console.log('   ✓ Can Read:', results.canRead ? 'YES' : 'NO');
      console.log('   ✓ Can Write:', results.canWrite ? 'YES');
      console.log('   ✗ Error:', results.error?.code || 'None');
      console.log('═══════════════════════════════════════════════════════');
      console.log('');

      if (results.error?.code === 'permission-denied') {
        alert('⚠️ Firestore Security Rules Error\n\nYour Firestore security rules are blocking access. Check the console for instructions on how to fix this.');
      } else if (!results.canRead || !results.canWrite) {
        alert('⚠️ Firestore Connectivity Issue\n\nCannot reach Firestore server. Check the console for details.');
      } else {
        alert('✅ Firestore Working!\n\nFirestore is properly connected and working.');
      }
    } catch (error) {
      console.error('❌ Diagnostics failed:', error);
      alert('❌ Diagnostics Failed\n\nCheck the console for error details.');
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/index';
    }
    // Check if current path starts with the nav item href
    return pathname.includes(href.replace('/', ''));
  };

  return (
    <View
      style={{
        width: 260,
        backgroundColor: colors.bg.primary,
        borderRightWidth: 1,
        borderRightColor: colors.border.light,
        paddingTop: insets.top || 20,
        paddingBottom: insets.bottom || 20,
      }}
    >
      {/* Logo/Brand */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border.light,
          marginBottom: 8,
        }}
      >
        <Text
          style={{
            fontSize: 24,
            fontWeight: '800',
            color: colors.text.primary,
            letterSpacing: -0.5,
          }}
        >
          FYLL
        </Text>
        <Text
          style={{
            fontSize: 12,
            color: colors.text.muted,
            marginTop: 2,
          }}
        >
          Inventory Management
        </Text>
      </View>

      {/* Navigation Items */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 8 }}
      >
        {navItems.map((item) => {
          // Check permission if required
          if (item.requiresPermission) {
            const permissions = ROLE_PERMISSIONS[userRole];
            const hasPermission = permissions ? permissions[item.requiresPermission] : false;
            if (!hasPermission) return null;
          }

          const active = isActive(item.href);
          const Icon = item.icon;

          return (
            <Pressable
              key={item.href}
              onPress={() => handleNavigation(item.href)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginHorizontal: 12,
                marginVertical: 2,
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: active ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)') : 'transparent',
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: active
                    ? colors.accent.primary
                    : isDark
                      ? 'rgba(255,255,255,0.05)'
                      : 'rgba(0,0,0,0.03)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Icon
                  size={20}
                  color={active ? (isDark ? '#000000' : '#FFFFFF') : colors.text.tertiary}
                  strokeWidth={active ? 2.5 : 2}
                />
              </View>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: active ? '600' : '500',
                  color: active ? colors.text.primary : colors.text.secondary,
                }}
              >
                {item.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* User Section */}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: colors.border.light,
          paddingTop: 12,
          paddingHorizontal: 12,
        }}
      >
        {currentUser && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 10,
              marginBottom: 8,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.bg.tertiary,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: colors.text.primary,
                }}
              >
                {currentUser.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: colors.text.primary,
                }}
                numberOfLines={1}
              >
                {currentUser.name}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.text.muted,
                  textTransform: 'capitalize',
                }}
              >
                {currentUser.role}
              </Text>
            </View>
          </View>
        )}

        <Pressable
          onPress={handleRunDiagnostics}
          disabled={isRunningDiagnostics}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: 12,
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            marginBottom: 8,
            opacity: isRunningDiagnostics ? 0.5 : 1,
          }}
        >
          <Activity size={18} color="#3B82F6" strokeWidth={2} />
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: '#3B82F6',
              marginLeft: 12,
            }}
          >
            {isRunningDiagnostics ? 'Running...' : 'Test Firestore'}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleLogout}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: 12,
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
          }}
        >
          <LogOut size={18} color="#EF4444" strokeWidth={2} />
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: '#EF4444',
              marginLeft: 12,
            }}
          >
            Sign Out
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
