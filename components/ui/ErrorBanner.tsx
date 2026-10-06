// Inline, dismissible error banner.
//
// Screens used to surface failures with Alert.alert, which is a no-op on
// react-native-web: the promise rejects, nothing renders, and the control the
// user pressed simply looks broken. A banner renders identically on web, iOS
// and Android, so a failure is always visible.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LucideIcon } from '@/components/ui/LucideIcon';
import { COLORS, SPACING, BORDER_RADIUS } from '@/utils/constants';

interface ErrorBannerProps {
  message: string;
  /** Optional trailing action, e.g. "Try again". Rendered as a compact pill. */
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  style?: object;
}

export const ErrorBanner = ({
  message,
  actionLabel,
  onAction,
  onDismiss,
  style,
}: ErrorBannerProps) => (
  <View style={[styles.container, style]} accessibilityRole="alert" accessibilityLiveRegion="polite">
    <LucideIcon name="alert-circle" size={16} color={COLORS.danger} />
    <Text style={styles.message}>{message}</Text>

    {actionLabel && onAction ? (
      <TouchableOpacity onPress={onAction} style={styles.action} accessibilityRole="button">
        <Text style={styles.actionText}>{actionLabel}</Text>
      </TouchableOpacity>
    ) : null}

    {onDismiss ? (
      <TouchableOpacity
        onPress={onDismiss}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Dismiss error"
        style={styles.dismiss}
      >
        <LucideIcon name="x" size={16} color={COLORS.textSecondary} />
      </TouchableOpacity>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.danger + '14',
    borderWidth: 1,
    borderColor: COLORS.danger + '33',
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
  },
  message: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.danger,
  },
  action: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.danger + '1F',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.danger,
  },
  dismiss: {
    padding: 2,
  },
});

export default ErrorBanner;
