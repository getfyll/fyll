import React from 'react';
import { View, type ViewProps } from 'react-native';
import { useThemeColors } from '@/lib/theme';
import { cn } from '@/lib/cn';

export function WebCard({
  className,
  style,
  ...props
}: ViewProps & { className?: string }) {
  const colors = useThemeColors();

  return (
    <View
      {...props}
      className={cn('rounded-2xl', className)}
      style={[
        {
          backgroundColor: colors.bg.card,
          borderWidth: 1,
          borderColor: colors.border.light,
        },
        style,
      ]}
    />
  );
}

