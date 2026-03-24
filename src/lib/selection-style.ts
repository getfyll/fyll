import type { ViewStyle } from 'react-native';
import type { ThemeColors } from './theme';

interface ActiveSplitCardStyleArgs {
  isSelected?: boolean;
  showSplitView?: boolean;
  isDark: boolean;
  colors: ThemeColors;
}

export const getActiveSplitCardStyle = ({
  isSelected,
  showSplitView,
  isDark,
  colors,
}: ActiveSplitCardStyleArgs): ViewStyle => {
  if (!isSelected || !showSplitView) {
    return {};
  }

  return {
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,17,17,0.04)',
    borderColor: colors.accent.primary,
    borderWidth: 1.25,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent.primary,
  };
};
