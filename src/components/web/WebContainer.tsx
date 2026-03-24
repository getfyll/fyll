import React from 'react';
import { View, type ViewProps } from 'react-native';
import { cn } from '@/lib/cn';

export function WebContainer({
  className,
  style,
  ...props
}: ViewProps & { className?: string }) {
  return (
    <View
      {...props}
      className={cn(className)}
      style={[
        {
          width: '100%',
          // Keep a consistent 28px gutter, while preserving a 1400px content area.
          // (Matches Orders/Inventory/Customers tables on web.)
          maxWidth: 1456,
          alignSelf: 'flex-start',
          paddingHorizontal: 28,
        },
        style,
      ]}
    />
  );
}
