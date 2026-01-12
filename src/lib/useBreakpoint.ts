import { useWindowDimensions } from 'react-native';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

interface BreakpointInfo {
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
  height: number;
}

/**
 * Hook to detect current screen breakpoint for responsive layouts
 *
 * Breakpoints:
 * - Mobile: < 768px
 * - Tablet: >= 768px and < 1024px
 * - Desktop: >= 1024px
 */
export function useBreakpoint(): BreakpointInfo {
  const { width, height } = useWindowDimensions();

  const breakpoint: Breakpoint =
    width >= 1024 ? 'desktop' :
    width >= 768 ? 'tablet' :
    'mobile';

  return {
    breakpoint,
    isMobile: breakpoint === 'mobile',
    isTablet: breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop',
    width,
    height,
  };
}

/**
 * Returns true if split view should be enabled (tablet or desktop)
 */
export function useShouldShowSplitView(): boolean {
  const { isMobile } = useBreakpoint();
  return !isMobile;
}

/**
 * Returns true if sidebar navigation should be shown (desktop only)
 */
export function useShouldShowSidebar(): boolean {
  const { isDesktop } = useBreakpoint();
  return isDesktop;
}
