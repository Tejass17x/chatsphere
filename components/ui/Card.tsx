// Card Component

import React from 'react';
import { View, StyleSheet, StyleProp, TouchableOpacity, ViewStyle } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '@/utils/constants';
import { shadow } from '@/utils/shadows';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'outlined' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onPress?: () => void;
}

export const Card = ({
  children,
  style,
  variant = 'default',
  padding = 'md',
  onPress,
}: CardProps) => {
  const containerStyle = [
    styles.container,
    variantStyles[variant],
    paddingStyles[padding],
    onPress && styles.pressable,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        style={containerStyle}
        activeOpacity={0.9}
        onPress={onPress}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={containerStyle}>{children}</View>;
};

const variantStyles = {
  default: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  outlined: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  elevated: {
    backgroundColor: COLORS.background,
    borderWidth: 0,
    ...shadow({ color: COLORS.shadow, offset: { width: 0, height: 2 }, opacity: 0.1, radius: 4, elevation: 4 }),
  },
};

const paddingStyles = {
  none: {},
  sm: { padding: SPACING.sm },
  md: { padding: SPACING.md },
  lg: { padding: SPACING.lg },
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  pressable: {
    // Additional press styles if needed
  },
});

export default Card;