// Badge Component

import React from 'react';
import { View, Text, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { BadgeProps } from '@/types';
import { COLORS, SPACING, BORDER_RADIUS } from '@/utils/constants';
import { shadow } from '@/utils/shadows';

export const Badge = ({
  count,
  max = 99,
  size = 'md',
  variant = 'default',
  style,
}: BadgeProps) => {
  if (count <= 0) return null;

  const displayCount = count > max ? `${max}+` : count.toString();
  const isLarge = displayCount.length > 2;

  const containerStyle = [
    styles.container,
    sizeStyles[size],
    variantStyles[variant],
    isLarge && styles.large,
    style,
  ];

  return (
    <View style={containerStyle}>
      <Text style={[styles.text, TEXT_SIZE[size], isLarge && styles.textLarge]}>
        {displayCount}
      </Text>
    </View>
  );
};

const sizeStyles: Record<NonNullable<BadgeProps['size']>, ViewStyle> = {
  sm: { minWidth: 16, height: 16, paddingHorizontal: 4 },
  md: { minWidth: 18, height: 18, paddingHorizontal: 5 },
  lg: { minWidth: 22, height: 22, paddingHorizontal: 6 },
};

const TEXT_SIZE: Record<NonNullable<BadgeProps['size']>, TextStyle> = {
  sm: { fontSize: 10, fontWeight: '700' },
  md: { fontSize: 11, fontWeight: '700' },
  lg: { fontSize: 12, fontWeight: '700' },
};

const variantStyles = {
  default: { backgroundColor: COLORS.danger },
  primary: { backgroundColor: COLORS.primary },
  success: { backgroundColor: COLORS.success },
  warning: { backgroundColor: COLORS.warning },
  danger: { backgroundColor: COLORS.danger },
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow({ color: COLORS.shadow, offset: { width: 0, height: 1 }, opacity: 0.2, radius: 2, elevation: 3 }),
  },
  large: {
    borderRadius: BORDER_RADIUS.md,
  },
  text: {
    color: COLORS.textInverse,
  },
  textLarge: {
    // Additional styles for large numbers
  },
});

export default Badge;