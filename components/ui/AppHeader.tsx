// App Header with title, subtitle and notification bell

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LucideIcon } from '@/components/ui/LucideIcon';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { useNotifications } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import { COLORS, SPACING, BORDER_RADIUS } from '@/utils/constants';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  showBell?: boolean;
  showAvatar?: boolean;
}

export const AppHeader = ({
  title,
  subtitle,
  showBell = true,
  showAvatar = true,
}: AppHeaderProps) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { unreadCount } = useNotifications();
  const { user } = useAuth();

  return (
    <View style={[styles.container, { paddingTop: insets.top + SPACING.sm }]}>
      <View style={styles.left}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>

      <View style={styles.right}>
        {showBell && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/notifications')}
            activeOpacity={0.7}
          >
            <LucideIcon name="bell" size={22} color={COLORS.textPrimary} />
            {unreadCount > 0 && (
              <View style={styles.badgeContainer}>
                <Badge count={unreadCount} size="sm" variant="danger" />
              </View>
            )}
          </TouchableOpacity>
        )}

        {showAvatar && user && (
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Open your profile"
            style={styles.avatarButton}
          >
            {/* No presenceUid: this is the viewer's own avatar, and a green
                dot on yourself would be meaningless. */}
            <Avatar
              source={user.photoURL ? { uri: user.photoURL } : null}
              name={user.displayName}
              size="sm"
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  left: {
    flex: 1,
    marginRight: SPACING.md,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.full,
    position: 'relative',
  },
  badgeContainer: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  avatarButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.full,
  },
});

export default AppHeader;