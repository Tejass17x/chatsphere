// Input Component

import React, { forwardRef, useState } from 'react';
import {
  TextInput,
  View,
  Text,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
} from 'react-native';
import { InputProps } from '@/types';
import { COLORS, SPACING, BORDER_RADIUS } from '@/utils/constants';
import { LucideIcon } from '@/components/ui/LucideIcon';

export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      placeholder,
      value,
      onChangeText,
      secureTextEntry = false,
      keyboardType = 'default',
      error,
      disabled = false,
      leftIcon,
      rightIcon,
      autoCapitalize = 'sentences',
      autoComplete,
      returnKeyType = 'done',
      onSubmitEditing,
      multiline,
      numberOfLines,
      containerStyle,
      style,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(!secureTextEntry);
    const isSecure = secureTextEntry && !showPassword;

    const handleRightIconPress = () => {
      if (secureTextEntry) {
        setShowPassword(!showPassword);
      }
    };

    const hasError = !!error;

    return (
      <View style={[styles.container, containerStyle]}>
        {label && (
          <Text style={styles.label}>{label}</Text>
        )}
        <View
          style={[
            styles.inputWrapper,
            hasError && styles.inputWrapperError,
            disabled && styles.inputWrapperDisabled,
          ]}
        >
          {leftIcon && (
            <View style={styles.iconLeft}>
              {React.isValidElement(leftIcon)
                ? React.cloneElement(leftIcon as React.ReactElement, {
                    color: hasError ? COLORS.danger : COLORS.textTertiary,
                    size: 20,
                  })
                : leftIcon}
            </View>
          )}
          <TextInput
            ref={ref}
            placeholder={placeholder}
            value={value}
            onChangeText={onChangeText}
            secureTextEntry={isSecure}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            autoComplete={autoComplete}
            returnKeyType={returnKeyType}
            onSubmitEditing={onSubmitEditing}
            editable={!disabled}
            multiline={multiline}
            numberOfLines={numberOfLines}
            style={[
              styles.input,
              multiline && styles.inputMultiline,
              !!leftIcon && styles.inputWithLeftIcon,
              !!rightIcon && styles.inputWithRightIcon,
              style,
            ]}
            placeholderTextColor={COLORS.textTertiary}
            selectionColor={COLORS.primary}
            {...props}
          />
          {rightIcon && (
            <TouchableOpacity
              onPress={handleRightIconPress}
              style={styles.iconRight}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {React.isValidElement(rightIcon)
                ? React.cloneElement(rightIcon as React.ReactElement, {
                    color: hasError ? COLORS.danger : COLORS.textTertiary,
                    size: 20,
                  })
                : secureTextEntry ? (
                  showPassword ? (
                    <LucideIcon name="eye-off" color={COLORS.textTertiary} size={20} />
                  ) : (
                    <LucideIcon name="eye" color={COLORS.textTertiary} size={20} />
                  )
                ) : rightIcon}
            </TouchableOpacity>
          )}
        </View>
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    );
  }
);

Input.displayName = 'Input';

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: SPACING.xs,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
  },
  inputWrapperError: {
    borderColor: COLORS.danger,
  },
  inputWrapperDisabled: {
    backgroundColor: COLORS.surfaceVariant,
    borderColor: COLORS.border,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
    paddingVertical: SPACING.sm,
  },
  inputMultiline: {
    textAlignVertical: 'top',
    minHeight: 88,
    paddingTop: SPACING.md,
  },
  inputWithLeftIcon: {
    paddingLeft: 0,
  },
  inputWithRightIcon: {
    paddingRight: 0,
  },
  iconLeft: {
    marginRight: SPACING.sm,
  },
  iconRight: {
    marginLeft: SPACING.sm,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.danger,
    marginLeft: SPACING.xs,
  },
});

export default Input;