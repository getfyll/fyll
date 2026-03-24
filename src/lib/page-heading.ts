import type { TextStyle } from 'react-native';

export const DESKTOP_PAGE_HEADER_MIN_HEIGHT = 92;
export const DESKTOP_PAGE_HEADER_GUTTER = 8;

export const getStandardPageHeadingStyle = (isMobile: boolean): TextStyle => ({
  fontSize: isMobile ? 24 : 28,
  lineHeight: isMobile ? 30 : 34,
  fontWeight: '700',
});

export const getDashboardHeadingStyle = (isMobile: boolean): TextStyle => ({
  fontSize: isMobile ? 28 : 30,
  lineHeight: isMobile ? 34 : 36,
  fontWeight: '700',
});
