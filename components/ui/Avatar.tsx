// Avatar Component

import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  TouchableOpacityProps,
} from 'react-native';
import { AvatarProps } from '@/types';
import { COLORS, AVATAR_SIZES, BORDER_RADIUS } from '@/utils/constants';
import { useUserPresence } from '@/contexts/PresenceContext';
import { getInitials, getAvatarColor } from '@/utils/helpers';
import { shadow } from '@/utils/shadows';

export const Avatar = React.forwardRef<TouchableOpacity, AvatarProps>(
  (
    {
      source,
      name = 'User',
      size = 'md',
      onPress,
      editable = false,
      style,
      presenceUid,
      ...props
    },
    ref
  ) => {
    const dimension = AVATAR_SIZES[size];
    const borderRadius = size === 'xl' ? BORDER_RADIUS.xl : BORDER_RADIUS.full;

    const backgroundColor = getAvatarColor(name);
    const initials = getInitials(name);

    // Only subscribes when a uid is passed; passing none keeps the component
    // free of the presence listener, which matters in long lists.
    const { online } = useUserPresence(presenceUid);

    const imageStyle = {
      width: dimension,
      height: dimension,
      borderRadius,
    };

    const containerStyle = [
      styles.container,
      { width: dimension, height: dimension, borderRadius },
      style,
    ];

    const content = source?.uri ? (
      <Image source={source} style={imageStyle} resizeMode="cover" />
    ) : (
      <View style={[imageStyle, styles.initialsContainer, { backgroundColor }]}>
        <Text style={[styles.initials, sizeStyles[size]]}>{initials}</Text>
      </View>
    );

    const overlays = (
      <>
        {presenceUid && online ? (
          <View
            style={[
              styles.presenceDot,
              {
                width: presenceDotSizes[size],
                height: presenceDotSizes[size],
                borderRadius: presenceDotSizes[size] / 2,
              },
            ]}
          />
        ) : null}
        {editable && (
          <View style={styles.editBadge}>
            <Text style={styles.editIcon}>✎</Text>
          </View>
        )}
      </>
    );

    if (onPress || editable) {
      return (
        <TouchableOpacity
          ref={ref}
          style={containerStyle}
          onPress={onPress}
          activeOpacity={0.8}
          {...props}
        >
          {content}
          {overlays}
        </TouchableOpacity>
      );
    }

    return (
      <View style={containerStyle} {...props}>
        {content}
        {overlays}
      </View>
    );
  }
);

Avatar.displayName = 'Avatar';

const sizeStyles = {
  xs: { fontSize: 8 },
  sm: { fontSize: 11 },
  md: { fontSize: 14 },
  lg: { fontSize: 20 },
  xl: { fontSize: 28 },
};

// Proportional to the avatar so the dot reads the same at every size.
const presenceDotSizes = {
  xs: 8,
  sm: 10,
  md: 12,
  lg: 14,
  xl: 18,
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
    ...shadow({ color: COLORS.shadow, offset: { width: 0, height: 1 }, opacity: 0.1, radius: 2, elevation: 2 }),
  },
  initialsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: COLORS.textInverse,
    fontWeight: '600',
  },
  presenceDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.success,
    // White ring separates the dot from the avatar, so it stays legible on a
    // dark photo as well as on a light one.
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  editIcon: {
    color: COLORS.textInverse,
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default Avatar;