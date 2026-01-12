// Fyll Design System - Light/Dark Theme Support
import useFyllStore from './state/fyll-store';

export const lightColors = {
  // Core Background - Light Mode (flat, modern card-based layout)
  bg: {
    primary: '#F7F7F7',    // Light neutral grey background
    secondary: '#F0F0F0',
    tertiary: '#EBEBEB',
    card: '#FFFFFF',       // White cards
    elevated: '#FFFFFF',
  },

  // Text - High contrast Black for legibility
  text: {
    primary: '#111111',
    secondary: '#333333',
    tertiary: '#666666',
    muted: '#999999',
  },

  // Borders - Subtle borders for card separation
  border: {
    light: '#E6E6E6',      // Subtle border for cards
    medium: '#CCCCCC',
    dark: '#333333',
  },

  // Input
  input: {
    bg: '#FFFFFF',
    border: '#444444',
    text: '#111111',
    placeholder: '#999999',
  },

  // Accent Colors
  accent: {
    primary: '#111111',
    secondary: '#666666',
    warning: '#F59E0B',
    danger: '#EF4444',
    success: '#22C55E',
  },

  // Status Colors (for order statuses)
  status: {
    amber: '#F59E0B',
    blue: '#3B82F6',
    purple: '#8B5CF6',
    teal: '#10B981',
    green: '#059669',
    pink: '#EC4899',
  },

  // Tab bar
  tabBar: {
    bg: '#FFFFFF',
    border: '#E5E5E5',
    active: '#111111',
    inactive: '#999999',
  },
};

export const darkColors = {
  // Core Background - Dark Mode
  bg: {
    primary: '#111111',
    secondary: '#1A1A1A',
    tertiary: '#222222',
    card: '#1A1A1A',
    elevated: '#222222',
  },

  // Text
  text: {
    primary: '#FFFFFF',
    secondary: '#CCCCCC',
    tertiary: '#888888',
    muted: '#666666',
  },

  // Borders
  border: {
    light: '#333333',
    medium: '#444444',
    dark: '#555555',
  },

  // Input
  input: {
    bg: '#1A1A1A',
    border: '#444444',
    text: '#FFFFFF',
    placeholder: '#666666',
  },

  // Accent Colors
  accent: {
    primary: '#FFFFFF',
    secondary: '#888888',
    warning: '#F59E0B',
    danger: '#EF4444',
    success: '#22C55E',
  },

  // Status Colors
  status: {
    amber: '#F59E0B',
    blue: '#3B82F6',
    purple: '#8B5CF6',
    teal: '#10B981',
    green: '#059669',
    pink: '#EC4899',
  },

  // Tab bar
  tabBar: {
    bg: '#111111',
    border: '#222222',
    active: '#FFFFFF',
    inactive: '#666666',
  },
};

export type ThemeColors = typeof lightColors;

export const useThemeColors = (): ThemeColors => {
  const themeMode = useFyllStore((s) => s.themeMode);
  return themeMode === 'light' ? lightColors : darkColors;
};

// Stats-specific colors derived from theme (for Insights screens)
export function useStatsColors() {
  const themeMode = useFyllStore((s) => s.themeMode);
  const theme = useThemeColors();
  const isLight = themeMode === 'light';

  return {
    bg: {
      screen: theme.bg.primary,
      card: theme.bg.card,
      cardAlt: theme.bg.secondary,
      input: theme.bg.tertiary,
    },
    text: {
      primary: theme.text.primary,
      secondary: theme.text.secondary,
      tertiary: theme.text.tertiary,
      muted: theme.text.muted,
    },
    bar: theme.accent.primary,
    barBg: theme.border.light,
    border: theme.border.light,
    divider: theme.border.light,
    success: theme.accent.success,
    warning: theme.accent.warning,
    danger: theme.accent.danger,
    accent: theme.status.blue,
    // Light mode specific: cards use border instead of shadow
    card: {
      borderWidth: isLight ? 1 : 0,
      borderColor: isLight ? '#E6E6E6' : 'transparent',
      shadowOpacity: isLight ? 0 : 0.3,
    },
    // Helper to get full card style object
    getCardStyle: () => ({
      backgroundColor: theme.bg.card,
      borderWidth: isLight ? 1 : 0,
      borderColor: isLight ? '#E6E6E6' : 'transparent',
    }),
  };
}

export type StatsColors = ReturnType<typeof useStatsColors>;

// Legacy exports for backwards compatibility
export const colors = lightColors;

export const buttonStyles = {
  primary: {
    backgroundColor: '#111111',
    textColor: '#FFFFFF',
  },
  secondary: {
    backgroundColor: '#FFFFFF',
    textColor: '#111111',
    borderColor: '#333333',
  },
};

export const inputStyles = {
  borderColor: '#444444',
  backgroundColor: '#FFFFFF',
  textColor: '#111111',
  placeholderColor: '#999999',
  cursorColor: '#111111',
  height: 52,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
};
