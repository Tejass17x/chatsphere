// Loading Components

import React from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Text,
  Image,
} from 'react-native';
import { COLORS, SPACING, ANIMATION } from '@/utils/constants';

interface LoadingProps {
  size?: 'small' | 'large';
  color?: string;
  text?: string;
  fullScreen?: boolean;
  overlay?: boolean;
}

export const Loading = ({
  size = 'large',
  color = COLORS.primary,
  text,
  fullScreen = false,
  overlay = false,
}: LoadingProps) => {
  const containerStyle = [
    styles.container,
    fullScreen && styles.fullScreen,
    overlay && styles.overlay,
  ];

  return (
    <View style={containerStyle}>
      <ActivityIndicator size={size} color={color} />
      {text && <Text style={styles.text}>{text}</Text>}
    </View>
  );
};

// Skeleton loader for placeholders
export const Skeleton = ({
  width,
  height,
  borderRadius = 8,
  style,
}: {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: any;
}) => {
  return (
    <View
      style={[
        styles.skeleton,
        { width, height, borderRadius },
        style,
      ]}
    />
  );
};

// Skeleton for user list item
export const UserSkeleton = () => (
  <View style={styles.userSkeleton}>
    <Skeleton width={48} height={48} borderRadius={24} />
    <View style={styles.skeletonContent}>
      <Skeleton width="60%" height={16} />
      <Skeleton width="40%" height={12} />
    </View>
  </View>
);

// Skeleton for chat list item
export const ChatSkeleton = () => (
  <View style={styles.chatSkeleton}>
    <Skeleton width={56} height={56} borderRadius={28} />
    <View style={styles.skeletonContent}>
      <View style={styles.skeletonHeader}>
        <Skeleton width="70%" height={16} />
        <Skeleton width={60} height={12} />
      </View>
      <Skeleton width="80%" height={14} />
    </View>
  </View>
);

// Skeleton for message
export const MessageSkeleton = ({ isOwn = false }: { isOwn?: boolean }) => (
  <View style={[styles.messageSkeleton, isOwn && styles.messageSkeletonOwn]}>
    <Skeleton width={isOwn ? '60%' : '70%'} height={16} borderRadius={12} />
    <Skeleton width={isOwn ? '40%' : '50%'} height={16} borderRadius={12} />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  fullScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.background,
    zIndex: 100,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 50,
  },
  text: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  skeleton: {
    backgroundColor: COLORS.surfaceVariant,
    overflow: 'hidden',
  },
  userSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    gap: SPACING.md,
  },
  chatSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    gap: SPACING.md,
  },
  messageSkeleton: {
    maxWidth: '80%',
    alignSelf: 'flex-start',
    gap: SPACING.xs,
  },
  messageSkeletonOwn: {
    alignSelf: 'flex-end',
  },
  skeletonContent: {
    flex: 1,
    gap: SPACING.xs,
  },
  skeletonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

export default Loading;