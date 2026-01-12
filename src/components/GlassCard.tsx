import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  style?: ViewStyle;
  noPadding?: boolean;
  gradient?: boolean;
}

export function GlassCard({
  children,
  className = '',
  style,
  noPadding = false,
  gradient = false,
}: GlassCardProps) {
  return (
    <View
      className={className}
      style={[
        styles.container,
        !noPadding && styles.padding,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  padding: {
    padding: 16,
  },
});
