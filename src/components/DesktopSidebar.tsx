import React from 'react';
import { View, Text, Pressable, ScrollView, Platform } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { LayoutDashboard, Package, ShoppingCart, MoreHorizontal, BarChart3, Users, LogOut, Database } from 'lucide-react-native';
import { useThemeColors } from '@/lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAuthStore, { ROLE_PERMISSIONS } from '@/lib/state/auth-store';
import * as Haptics from 'expo-haptics';
import { SvgXml } from 'react-native-svg';

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
  { name: 'More', href: '/settings', icon: MoreHorizontal },
];

export function DesktopSidebar() {
  const colors = useThemeColors();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const isDark = colors.bg.primary === '#111111';

  const currentUser = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);
  const userRole = currentUser?.role ?? 'staff';

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
        <SvgXml
          xml={`<svg width="120" height="40" viewBox="0 0 344 195" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M27.2814 190.462V91.8673H78.4995H79.4995V90.8673V70.5023V69.5023H78.4995H27.2814V58.7533C27.2814 48.4452 29.5154 40.4114 33.8725 34.546L33.8726 34.546L33.8804 34.5351C38.1419 28.6347 45.6793 25.5504 56.829 25.5504C62.3428 25.5504 66.9479 26.068 70.6648 27.0817L70.6854 27.0873L70.7063 27.0921C74.5027 27.9549 77.3729 28.8909 79.3577 29.8834L80.5143 30.4617L80.7831 29.1968L85.2217 8.30955L85.3942 7.4978L84.6281 7.17862C82.4396 6.26676 78.6987 5.2942 73.4771 4.24979C68.3435 3.18796 62.1805 2.66317 55.0014 2.66317C36.5665 2.66317 22.8382 7.49247 14.0498 17.3545C5.30253 26.9965 1 40.6716 1 58.2311V190.462V191.462H2H26.2814H27.2814V190.462ZM101.618 167.36L100.5 166.852L100.229 168.049L95.7903 187.631L95.617 188.396L96.3183 188.747C97.0819 189.128 98.2703 189.582 99.8435 190.106L99.8579 190.111L99.8724 190.115C101.641 190.646 103.494 191.088 105.432 191.441C107.547 191.968 109.665 192.322 111.785 192.5C113.908 192.852 115.951 193.03 117.914 193.03C125.128 193.03 131.583 192.15 137.267 190.375C143.129 188.598 148.378 185.841 153.006 182.103C157.625 178.372 161.782 173.591 165.483 167.778C169.351 162.149 173.032 155.396 176.529 147.528L176.533 147.519C185.423 126.948 193.702 104.9 201.369 81.3759L201.37 81.3738C209.036 57.6773 216.005 33.0244 222.277 7.41531L222.58 6.17744H221.306H196.241H195.444L195.266 6.95389C190.918 25.9141 186.308 44.3515 181.438 62.2663C176.774 79.422 171.312 96.739 165.051 114.217C161.251 106.035 157.597 97.5585 154.089 88.7884C150.266 79.2297 146.703 69.6713 143.401 60.1134C140.099 50.5532 137.057 41.2547 134.277 32.2179C131.67 23.1809 129.411 14.755 127.501 6.93999L127.315 6.17744H126.53H100.421H99.1265L99.4532 7.42986C105.73 31.4914 113.576 55.2903 122.99 78.8265L122.994 78.8348C132.512 102.024 142.718 124.014 153.614 144.802C149.35 154.066 144.629 160.632 139.494 164.608L139.486 164.614L139.479 164.62C134.318 168.782 127.084 170.926 117.653 170.926C114.793 170.926 111.837 170.505 108.782 169.657L108.763 169.651L108.744 169.647C105.823 168.959 103.453 168.194 101.618 167.36ZM280.241 193.029L281.108 193.049L281.251 192.194L284.645 171.829L284.814 170.813L283.794 170.674C280.004 170.157 276.838 169.557 274.285 168.879C271.801 168.046 269.867 166.902 268.439 165.474C267.022 164.057 265.965 162.136 265.304 159.658C264.638 157.161 264.293 153.948 264.293 149.994V3V1.81327L263.124 2.01448L238.842 6.19192L238.012 6.33479V7.17744V153.91C238.012 166.933 241.179 176.732 247.714 183.086C254.253 189.443 265.186 192.679 280.241 193.029ZM337.583 191.462L338.45 191.482L338.592 190.627L341.986 170.262L342.156 169.246L341.135 169.106C337.346 168.59 334.18 167.99 331.627 167.311C329.142 166.479 327.208 165.335 325.781 163.907C324.363 162.49 323.306 160.569 322.646 158.09C321.98 155.593 321.635 152.381 321.635 148.427V3.00075V1.81402L320.465 2.01523L296.184 6.19267L295.354 6.33554V7.17819V152.343C295.354 165.366 298.52 175.165 305.056 181.519C311.594 187.876 322.527 191.112 337.583 191.462Z" fill="${colors.text.primary}" stroke="${colors.text.primary}" stroke-width="2"/>
          </svg>`}
          width={120}
          height={40}
        />
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
          onPress={() => router.push('/supabase-check')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: 12,
            backgroundColor: 'rgba(34, 197, 94, 0.12)',
            marginBottom: 8,
          }}
        >
          <Database size={18} color="#22C55E" strokeWidth={2} />
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: '#22C55E',
              marginLeft: 12,
            }}
          >
            Test Supabase
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
