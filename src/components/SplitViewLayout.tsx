import React, { useState, useCallback, ReactNode } from 'react';
import { View, ScrollView, Pressable, Text, Image, Modal, Platform } from 'react-native';
import { useBreakpoint } from '@/lib/useBreakpoint';
import { useThemeColors } from '@/lib/theme';
import { X, ChevronRight, PanelLeftClose, PanelLeftOpen, Package } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut, SlideInRight, SlideOutRight } from 'react-native-reanimated';

interface SplitViewLayoutProps {
  children: ReactNode;
  detailContent: ReactNode | null;
  detailTitle?: string;
  onCloseDetail?: () => void;
  showDetailOnMobile?: boolean;
}

/**
 * SplitViewLayout - Responsive layout component for master-detail views
 *
 * - Mobile (<768px): Full width master pane, detail shows as modal/navigation
 * - Tablet (>=768px): Split view with collapsible detail panel
 * - Desktop (>=1024px): Split view with persistent detail panel
 */
export function SplitViewLayout({
  children,
  detailContent,
  detailTitle,
  onCloseDetail,
  showDetailOnMobile = false,
}: SplitViewLayoutProps) {
  const { isMobile, isTablet, isDesktop, width } = useBreakpoint();
  const colors = useThemeColors();
  const [isDetailCollapsed, setIsDetailCollapsed] = useState(false);

  const toggleDetailPanel = useCallback(() => {
    setIsDetailCollapsed((prev) => !prev);
  }, []);

  // Calculate pane widths
  const masterWidth = isDesktop
    ? isDetailCollapsed ? width : Math.min(440, width * 0.38)
    : isTablet
      ? isDetailCollapsed ? width : Math.min(360, width * 0.45)
      : width;

  const detailWidth = isDesktop
    ? width - masterWidth
    : isTablet
      ? width - masterWidth
      : width;

  const hasDetail = detailContent !== null;

  // Mobile: Show detail as full screen modal
  if (isMobile) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
        {children}
        {/* Mobile detail modal - controlled by parent via navigation */}
      </View>
    );
  }

  // Tablet/Desktop: Split view layout
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.bg.secondary }}>
      {/* Master Pane */}
      <View
        style={{
          width: hasDetail && !isDetailCollapsed ? masterWidth : '100%',
          borderRightWidth: hasDetail && !isDetailCollapsed ? 1 : 0,
          borderRightColor: colors.border.light,
          backgroundColor: colors.bg.primary,
        }}
      >
        {children}
      </View>

      {/* Detail Pane */}
      {hasDetail && !isDetailCollapsed && (
        <Animated.View
          entering={SlideInRight.duration(200)}
          exiting={SlideOutRight.duration(200)}
          style={{
            flex: 1,
            backgroundColor: colors.bg.secondary,
            minWidth: 320,
            maxWidth: isDesktop ? 600 : 480,
          }}
        >
          {/* Detail Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.border.light,
              backgroundColor: colors.bg.card,
            }}
          >
            <Text
              style={{ color: colors.text.primary, fontSize: 18, fontWeight: '700' }}
              numberOfLines={1}
            >
              {detailTitle || 'Details'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {isTablet && (
                <Pressable
                  onPress={toggleDetailPanel}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: colors.bg.secondary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <PanelLeftClose size={18} color={colors.text.tertiary} strokeWidth={2} />
                </Pressable>
              )}
              {onCloseDetail && (
                <Pressable
                  onPress={onCloseDetail}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: colors.bg.secondary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={18} color={colors.text.tertiary} strokeWidth={2} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Detail Content */}
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            {detailContent}
          </ScrollView>
        </Animated.View>
      )}

      {/* Collapsed State - Show Toggle Button */}
      {hasDetail && isDetailCollapsed && isTablet && (
        <Pressable
          onPress={toggleDetailPanel}
          style={{
            width: 48,
            backgroundColor: colors.bg.card,
            borderLeftWidth: 1,
            borderLeftColor: colors.border.light,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <PanelLeftOpen size={20} color={colors.text.tertiary} strokeWidth={2} />
        </Pressable>
      )}
    </View>
  );
}

// ============================================================================
// Detail Pane Components - For building detail views
// ============================================================================

interface DetailSectionProps {
  title?: string;
  children: ReactNode;
}

export function DetailSection({ title, children }: DetailSectionProps) {
  const colors = useThemeColors();

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
      {title && (
        <Text
          style={{
            color: colors.text.tertiary,
            fontSize: 12,
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 12,
          }}
        >
          {title}
        </Text>
      )}
      <View
        style={{
          backgroundColor: colors.bg.card,
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.border.light,
        }}
      >
        {children}
      </View>
    </View>
  );
}

interface DetailImagePreviewProps {
  imageUrl?: string;
  onPress?: () => void;
}

export function DetailImagePreview({ imageUrl, onPress }: DetailImagePreviewProps) {
  const colors = useThemeColors();
  const [showFullImage, setShowFullImage] = useState(false);

  if (!imageUrl) {
    return (
      <View
        style={{
          marginHorizontal: 20,
          marginTop: 16,
          height: 200,
          borderRadius: 16,
          backgroundColor: colors.bg.tertiary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Package size={48} color={colors.text.muted} strokeWidth={1.5} />
        <Text style={{ color: colors.text.muted, fontSize: 14, marginTop: 8 }}>
          No image
        </Text>
      </View>
    );
  }

  return (
    <>
      <Pressable
        onPress={() => setShowFullImage(true)}
        style={{
          marginHorizontal: 20,
          marginTop: 16,
          height: 200,
          borderRadius: 16,
          overflow: 'hidden',
          backgroundColor: colors.bg.tertiary,
        }}
      >
        <Image
          source={{ uri: imageUrl }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
        <View
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 8,
            backgroundColor: 'rgba(0,0,0,0.6)',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>
            Tap to enlarge
          </Text>
        </View>
      </Pressable>

      {/* Full Image Modal */}
      <Modal
        visible={showFullImage}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFullImage(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.9)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onPress={() => setShowFullImage(false)}
        >
          <Image
            source={{ uri: imageUrl }}
            style={{ width: '90%', height: '70%' }}
            resizeMode="contain"
          />
          <Pressable
            onPress={() => setShowFullImage(false)}
            style={{
              position: 'absolute',
              top: 60,
              right: 20,
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: 'rgba(255,255,255,0.2)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={24} color="#FFFFFF" strokeWidth={2} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

interface DetailActionButtonProps {
  label: string;
  icon?: ReactNode;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
}

export function DetailActionButton({
  label,
  icon,
  onPress,
  variant = 'primary',
}: DetailActionButtonProps) {
  const colors = useThemeColors();
  const isDark = colors.bg.primary === '#111111';

  const bgColor =
    variant === 'danger'
      ? 'rgba(239, 68, 68, 0.15)'
      : variant === 'secondary'
        ? colors.bg.secondary
        : colors.accent.primary;

  const textColor =
    variant === 'danger'
      ? '#EF4444'
      : variant === 'secondary'
        ? colors.text.primary
        : isDark
          ? '#000000'
          : '#FFFFFF';

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 48,
        borderRadius: 12,
        backgroundColor: bgColor,
        paddingHorizontal: 16,
        gap: 8,
      }}
    >
      {icon}
      <Text style={{ color: textColor, fontSize: 15, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}

interface DetailKeyValueProps {
  label: string;
  value: string | number;
  valueColor?: string;
}

export function DetailKeyValue({ label, value, valueColor }: DetailKeyValueProps) {
  const colors = useThemeColors();

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
      }}
    >
      <Text style={{ color: colors.text.tertiary, fontSize: 14 }}>{label}</Text>
      <Text
        style={{
          color: valueColor || colors.text.primary,
          fontSize: 14,
          fontWeight: '600',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

// ============================================================================
// List Item Components - For selectable list items in split view
// ============================================================================

interface SplitViewListItemProps {
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  rightText?: string;
  rightSubtext?: string;
  isSelected?: boolean;
  onPress: () => void;
  leftContent?: ReactNode;
}

export function SplitViewListItem({
  title,
  subtitle,
  badge,
  badgeColor,
  rightText,
  rightSubtext,
  isSelected,
  onPress,
  leftContent,
}: SplitViewListItemProps) {
  const colors = useThemeColors();
  const { isMobile } = useBreakpoint();

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: isSelected && !isMobile ? colors.bg.tertiary : 'transparent',
        borderLeftWidth: isSelected && !isMobile ? 3 : 0,
        borderLeftColor: colors.accent.primary,
      }}
    >
      {leftContent && <View style={{ marginRight: 12 }}>{leftContent}</View>}

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text
            style={{
              color: colors.text.primary,
              fontSize: 15,
              fontWeight: '600',
            }}
            numberOfLines={1}
          >
            {title}
          </Text>
          {badge && (
            <View
              style={{
                marginLeft: 8,
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 6,
                backgroundColor: badgeColor ? `${badgeColor}20` : colors.bg.tertiary,
              }}
            >
              <Text
                style={{
                  color: badgeColor || colors.text.tertiary,
                  fontSize: 11,
                  fontWeight: '600',
                }}
              >
                {badge}
              </Text>
            </View>
          )}
        </View>
        {subtitle && (
          <Text
            style={{
              color: colors.text.tertiary,
              fontSize: 13,
              marginTop: 2,
            }}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
      </View>

      <View style={{ alignItems: 'flex-end', marginLeft: 12 }}>
        {rightText && (
          <Text
            style={{
              color: colors.text.primary,
              fontSize: 15,
              fontWeight: '700',
            }}
          >
            {rightText}
          </Text>
        )}
        {rightSubtext && (
          <Text
            style={{
              color: colors.text.muted,
              fontSize: 12,
              marginTop: 2,
            }}
          >
            {rightSubtext}
          </Text>
        )}
      </View>

      {isMobile && (
        <ChevronRight
          size={18}
          color={colors.text.muted}
          strokeWidth={2}
          style={{ marginLeft: 8 }}
        />
      )}
    </Pressable>
  );
}
