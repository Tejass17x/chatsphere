// Notifications Screen

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useNotifications } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  getUserProfile,
  acceptFollowRequest,
  rejectFollowRequest,
  getOrCreateChat,
} from '@/services/firestore';
import { Avatar } from '@/components/ui/Avatar';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Button } from '@/components/ui/Button';
import { LucideIcon } from '@/components/ui/LucideIcon';
import { formatNotificationTime } from '@/utils/helpers';
import { COLORS, SPACING, BORDER_RADIUS } from '@/utils/constants';
import { Notification, UserProfile } from '@/types';

export default function NotificationsScreen() {
  const router = useRouter();
  const { user, firebaseUser } = useAuth();
  const { notifications, loading, markAsRead, notifyFollowAccepted } = useNotifications();
  const [actingOn, setActingOn] = useState<string | null>(null);
  // Shown inline because Alert.alert is a no-op on react-native-web, which
  // would make a failed accept/decline look like the button did nothing.
  const [actionError, setActionError] = useState<string | null>(null);

  const handleNotificationPress = useCallback(
    async (notification: Notification) => {
      if (!user || !firebaseUser) return;

      await markAsRead(notification.id);

      const fromUid = notification.data.fromUserId;
      if (!fromUid) return;

      try {
        const fromUser = await getUserProfile(fromUid);
        if (!fromUser) return;

        const isMutual =
          user.following.includes(fromUid) && fromUser.following.includes(user.uid);

        if (isMutual) {
          const chat = await getOrCreateChat(user.uid, fromUid);
          router.push(`/chat/${chat.id}`);
        } else {
          // Navigate to search where the user can follow back
          router.push('/(tabs)/search');
        }
      } catch (error) {
        console.error('Navigation failed:', error);
      }
    },
    [user, firebaseUser, markAsRead, router]
  );

  const handleAccept = async (notification: Notification) => {
    if (!user) return;
    setActingOn(notification.id);
    setActionError(null);
    try {
      const fromUid = notification.data.fromUserId;
      await acceptFollowRequest(fromUid, user.uid);
      try {
        await notifyFollowAccepted(fromUid, user.displayName || 'Someone');
      } catch (error) {
        console.error('Request accepted, but notification could not be sent:', error);
      }
      try {
        await markAsRead(notification.id);
      } catch (error) {
        console.error('Request accepted, but notification could not be marked as read:', error);
      }
    } catch (error) {
      console.error('Accept failed:', error);
      setActionError(
        error instanceof Error ? error.message : 'Failed to accept request. Please try again.'
      );
    } finally {
      setActingOn(null);
    }
  };

  const handleReject = async (notification: Notification) => {
    if (!user) return;
    setActingOn(notification.id);
    setActionError(null);
    try {
      const fromUid = notification.data.fromUserId;
      await rejectFollowRequest(fromUid, user.uid);
      await markAsRead(notification.id);
    } catch (error) {
      console.error('Reject failed:', error);
      setActionError(
        error instanceof Error ? error.message : 'Failed to decline the request. Please try again.'
      );
    } finally {
      setActingOn(null);
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => (
    <NotificationItem
      notification={item}
      onPress={() => handleNotificationPress(item)}
      onAccept={() => handleAccept(item)}
      onReject={() => handleReject(item)}
      acting={actingOn === item.id}
    />
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Notifications',
          headerBackTitle: 'Back',
        }}
      />

      {actionError ? (
        <ErrorBanner message={actionError} onDismiss={() => setActionError(null)} />
      ) : null}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : notifications.length === 0 ? (

        <View style={styles.emptyContainer}>
          <LucideIcon name="bell" size={64} color={COLORS.textTertiary} />
          <Text style={styles.emptyTitle}>No Notifications</Text>
          <Text style={styles.emptySubtitle}>
            Follow requests and activity will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// Individual notification item
function NotificationItem({
  notification,
  onPress,
  onAccept,
  onReject,
  acting,
}: {
  notification: Notification;
  onPress: () => void;
  onAccept: () => void;
  onReject: () => void;
  acting: boolean;
}) {
  const { user } = useAuth();
  const [fromUser, setFromUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { getUserProfile } = await import('@/services/firestore');
        const profile = await getUserProfile(notification.data.fromUserId);
        if (!cancelled) setFromUser(profile);
      } catch (e) {
        // ignore
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [notification.data.fromUserId]);

  const isRequest = notification.type === 'follow_request';
  const isIncomingRequest =
    isRequest && user
      ? user.followRequests.includes(notification.data.fromUserId)
      : false;

  const getIcon = () => {
    switch (notification.type) {
      case 'follow_request':
        return { name: 'user-check', color: COLORS.primary };
      case 'follow_accepted':
        return { name: 'check-circle', color: COLORS.success };
      case 'new_message':
        return { name: 'message-circle', color: COLORS.info };
      default:
        return { name: 'bell', color: COLORS.textSecondary };
    }
  };

  const icon = getIcon();

  return (
    <View style={[styles.item, !notification.read && styles.itemUnread]}>
      <TouchableOpacity
        style={styles.itemPressable}
        onPress={onPress}
        activeOpacity={0.7}
        disabled={isIncomingRequest}
      >
        <View style={styles.itemAvatarWrap}>
          <Avatar
            source={fromUser?.photoURL ? { uri: fromUser.photoURL } : null}
            name={fromUser?.displayName || 'User'}
            size="md"
          />
          <View style={[styles.typeIcon, { backgroundColor: icon.color }]}>
            <LucideIcon name={icon.name} size={11} color={COLORS.textInverse} />
          </View>
        </View>

        <View style={styles.itemContent}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemTitle} numberOfLines={1}>
              {notification.title}
            </Text>
            <Text style={styles.itemTime}>
              {formatNotificationTime(notification.createdAt)}
            </Text>
          </View>
          <Text style={styles.itemBody} numberOfLines={2}>
            {notification.body}
          </Text>

          {isIncomingRequest && (
            <View style={styles.actionRow}>
              <Button
                title="Accept"
                onPress={onAccept}
                variant="primary"
                size="sm"
                loading={acting}
                style={styles.actionButton}
              />
              <Button
                title="Decline"
                onPress={onReject}
                variant="outline"
                size="sm"
                disabled={acting}
                style={styles.actionButton}
              />
            </View>
          )}
        </View>

        {!notification.read && !isIncomingRequest && (
          <View style={styles.unreadDot} />
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingVertical: SPACING.sm,
  },
  item: {
    backgroundColor: COLORS.background,
  },
  itemUnread: {
    backgroundColor: COLORS.primaryLight,
  },
  itemPressable: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  itemAvatarWrap: {
    position: 'relative',
  },
  typeIcon: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  itemContent: {
    flex: 1,
    gap: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
    marginRight: SPACING.sm,
  },
  itemTime: {
    fontSize: 11,
    color: COLORS.textTertiary,
    flexShrink: 0,
  },
  itemBody: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 19,
  },
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  actionButton: {
    minWidth: 100,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginTop: 6,
  },
  separator: {
    height: 0.5,
    backgroundColor: COLORS.border,
    marginLeft: 68,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  emptySubtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});