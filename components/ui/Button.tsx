// Button Component

import React from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  TextStyle,
  TouchableOpacityProps,
} from 'react-native';
import { ButtonProps } from '@/types';
import { COLORS, SPACING, BORDER_RADIUS, ANIMATION } from '@/utils/constants';
import { shadow } from '@/utils/shadows';

export const Button = React.forwardRef<TouchableOpacity, ButtonProps>(
  (
    {
      title,
      onPress,
      variant = 'primary',
      size = 'md',
      disabled = false,
      loading = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      children,
      style,
      ...props
    },
    ref
  ) => {
    const baseStyles = styles.base;
    const variantStyles = styles[variant];
    const sizeStyles = styles[size];
    const widthStyle = fullWidth ? styles.fullWidth : {};

    const isDisabled = disabled || loading;

    return (
      <TouchableOpacity
        ref={ref}
        style={[
          baseStyles,
          variantStyles,
          sizeStyles,
          widthStyle,
          isDisabled && styles.disabled,
          style,
        ]}
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={isDisabled ? 1 : 0.85}
        {...props}
      >
        {loading ? (
          <ActivityIndicator
            color={variant === 'primary' ? COLORS.textInverse : COLORS.primary}
            size="small"
          />
        ) : (
          <>
            {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
            {children ? (
              children
            ) : (
              <Text
                style={[
                  VARIANT_TEXT[variant],
                  SIZE_TEXT[size],
                  leftIcon && styles.textWithLeftIcon,
                  rightIcon && styles.textWithRightIcon,
                ]}
              >
                {title}
              </Text>
            )}
            {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
          </>
        )}
      </TouchableOpacity>
    );
  }
);

Button.displayName = 'Button';

const VARIANT_TEXT: Record<NonNullable<ButtonProps['variant']>, TextStyle> = {
  primary: { color: COLORS.textInverse },
  secondary: { color: COLORS.textInverse },
  outline: { color: COLORS.primary },
  ghost: { color: COLORS.primary },
  danger: { color: COLORS.textInverse },
};

const SIZE_TEXT: Record<NonNullable<ButtonProps['size']>, TextStyle> = {
  sm: { fontSize: 13, fontWeight: '600' },
  md: { fontSize: 15, fontWeight: '600' },
  lg: { fontSize: 17, fontWeight: '600' },
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.md,
    ...shadow({ color: COLORS.shadow, offset: { width: 0, height: 1 }, opacity: 0.1, radius: 2, elevation: 2 }),
  },
  primary: {
    backgroundColor: COLORS.primary,
  },
  secondary: {
    backgroundColor: COLORS.secondary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: COLORS.danger,
  },
  disabled: {
    opacity: 0.5,
  },
  fullWidth: {
    width: '100%',
  },
  sm: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  md: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  lg: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  iconLeft: {
    marginRight: SPACING.xs,
  },
  iconRight: {
    marginLeft: SPACING.xs,
  },
  textWithLeftIcon: {
    // marginLeft handled by iconLeft
  },
  textWithRightIcon: {
    // marginRight handled by iconRight
  },
});

export default Button;