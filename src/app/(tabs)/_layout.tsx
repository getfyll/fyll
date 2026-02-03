import React from 'react';
import { Tabs } from 'expo-router';
import { View, Platform } from 'react-native';
import { LayoutDashboard, Package, ShoppingCart, MoreHorizontal, BarChart3, Users } from 'lucide-react-native';
import { useThemeColors } from '@/lib/theme';
import { useBreakpoint } from '@/lib/useBreakpoint';
import { DesktopSidebar } from '@/components/DesktopSidebar';
import useAuthStore, { ROLE_PERMISSIONS } from '@/lib/state/auth-store';

function TabBarIcon({
  Icon,
  color,
  focused,
  offsetY = 0,
}: {
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  color: string;
  focused: boolean;
  offsetY?: number;
}) {
  const colors = useThemeColors();
  return (
    <View
      className="items-center justify-center"
      style={{
        width: 50,
        height: 32,
        marginTop: 2,
        borderRadius: 16,
        backgroundColor: focused ? (colors.bg.primary === '#FFFFFF' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.1)') : 'transparent',
      }}
    >
      <View style={{ transform: [{ translateY: offsetY }] }}>
        <Icon size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
      </View>
    </View>
  );
}

export default function TabLayout() {
  const colors = useThemeColors();
  const { isDesktop, isMobile } = useBreakpoint();
  const currentUser = useAuthStore((s) => s.currentUser);
  const userRole = currentUser?.role ?? 'staff';
  const canViewInsights = ROLE_PERMISSIONS[userRole]?.canViewInsights ?? false;

  const isWeb = Platform.OS === 'web';
  const tabBarHeight = isWeb ? 80 : (Platform.OS === 'ios' ? 88 : 70);

  // On desktop, show sidebar instead of bottom tabs
  const tabBarStyle = isDesktop
    ? { display: 'none' as const }
    : {
        backgroundColor: colors.tabBar.bg,
        borderTopWidth: 1,
        borderTopColor: colors.tabBar.border,
        height: tabBarHeight,
        paddingTop: isWeb ? 6 : 8,
        paddingBottom: isWeb ? 10 : (Platform.OS === 'ios' ? 28 : 12),
      };

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      {/* Desktop Sidebar */}
      {isDesktop && <DesktopSidebar />}

      {/* Main Content with Tabs */}
      <View style={{ flex: 1 }}>
        <Tabs
          screenOptions={{
            tabBarActiveTintColor: colors.tabBar.active,
            tabBarInactiveTintColor: colors.tabBar.inactive,
            tabBarStyle,
            tabBarLabelStyle: {
              fontSize: isWeb ? 10 : 11,
              fontWeight: '600',
              marginTop: isWeb ? 2 : 2,
              lineHeight: isWeb ? 12 : 13,
              paddingBottom: isWeb ? 0 : 0,
              height: isWeb ? 12 : undefined,
            },
            tabBarItemStyle: {
              paddingVertical: isWeb ? 0 : 0,
              paddingTop: isWeb ? 0 : 0,
              paddingBottom: isWeb ? 0 : 0,
              height: isWeb ? 55 : undefined,
              maxHeight: isWeb ? 55 : undefined,
              justifyContent: 'center',
              alignItems: 'center',
            },
            tabBarIconStyle: {
              marginTop: 0,
              marginBottom: 0,
              height: isWeb ? 32 : undefined,
            },
            headerStyle: {
              backgroundColor: colors.bg.primary,
            },
            headerTitleStyle: {
              color: colors.text.primary,
              fontSize: 18,
              fontWeight: '700',
            },
            headerShadowVisible: false,
          }}
        >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => <TabBarIcon Icon={LayoutDashboard} color={color} focused={focused} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Inventory',
          tabBarIcon: ({ color, focused }) => <TabBarIcon Icon={Package} color={color} focused={focused} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, focused }) => <TabBarIcon Icon={ShoppingCart} color={color} focused={focused} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: 'Customers',
          tabBarIcon: ({ color, focused }) => <TabBarIcon Icon={Users} color={color} focused={focused} />,
          headerShown: false,
          href: isMobile ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color, focused }) => <TabBarIcon Icon={BarChart3} color={color} focused={focused} />,
          headerShown: false,
          href: canViewInsights ? '/insights' : null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'More',
          tabBarIcon: ({ color, focused }) => <TabBarIcon Icon={MoreHorizontal} color={color} focused={focused} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          href: null,
        }}
      />
        </Tabs>
      </View>
    </View>
  );
}
