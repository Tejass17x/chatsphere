// Chats Tab Screen

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { LucideIcon } from '@/components/ui/LucideIcon';
import {
  getUserChats,
  subscribeToUserChats,
  markMessagesAsRead,
} from '@/services/firestore';
import { Avatar } from '@/components/ui/Avatar';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ChatSkeleton } from '@/components/ui/Loading';
import { AppHeader } from '@/components/ui/AppHeader';
import { formatChatTime, getOtherParticipant } from '@/utils/helpers';
import { COLORS, SPACING, BORDER_RADIUS } from '@/utils/constants';
import { Chat } from '@/types';

/**
 * TEMPORARY diagnostic — renders the raw Firebase error on screen.
 *
 * The chat list is the first place this app exercises a composite index
 * (`participants array-contains` + `lastMessageAt desc`), so the failure we
 * need to see is almost certainly FAILED_PRECONDITION carrying Firebase's
 * "create this index" console URL. A generic message hides exactly the one
 * piece of information that identifies the cause, which is why this is here.
 *
 * `error.code` is the field that actually discriminates between the two
 * candidate causes:
 *   'permission-denied'      → the deployed rules rejected the query
 *   'failed-precondition'    → a required composite index is missing
 *
 * Delete this helper and both call sites once the cause is confirmed.
 */
function describeFirestoreError(error: unknown): string {
  const err = error as { code?: string; message?: string } | undefined;
  const code = err?.code ?? 'unknown-code';
  const message = err?.message ?? String(error);
  // Pull out the index-creation link if there is one; it is long and would
  // otherwise be truncated off-screen.
  const indexLink = message.match(/https:\/\/console\.firebase\.google\.com\/\S+/);
  return indexLink ? `${code}\n${indexLink[0]}` : `${code}\n${message}`;
}

export default function ChatsScreen() {
  const router = useRouter();
  const { user, firebaseUser } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadChats = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const { chats: userChats } = await getUserChats(firebaseUser.uid);
      setChats(userChats);
      setError(null);
    } catch (err) {
      // Silently failing here would leave the user staring at an empty list
      // that looks identical to "you have no conversations".
      // TEMPORARY: surface the raw error instead of a generic message.
      console.error('[chats] loadChats failed:', err);
      setError(describeFirestoreError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) return;

    loadChats();

    const unsubscribe = subscribeToUserChats(
      firebaseUser.uid,
      (updatedChats) => {
        setChats(updatedChats);
        setLoading(false);
        setRefreshing(false);
        setError(null);
      },
      (err) => {
        // TEMPORARY: surface the raw error. A missing composite index arrives
        // here as failed-precondition and carries the console link that fixes
        // it; a rules rejection arrives as permission-denied.
        console.error('[chats] subscribeToUserChats failed:', err);
        setError(describeFirestoreError(err));
      }
    );

    return unsubscribe;
  }, [firebaseUser, loadChats]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadChats();
  };

  // The partner's uid as well as their cached details — the uid is what the
  // presence dot subscribes to, and participantDetails is a denormalised copy
  // that may be stale.
  const getChatPartner = (
    chat: Chat
  ): { details: Chat['participantDetails'][string]; uid: string } | null => {
    if (!user) return null;
    const otherId = getOtherParticipant(chat.participants, user.uid);
    if (!otherId) return null;
    const details = chat.participantDetails[otherId];
    if (!details) return null;
    return { details, uid: otherId };
  };

  const getUnreadCount = (chat: Chat): number => {
    if (!user) return 0;
    return chat.unreadCount[user.uid] || 0;
  };

  const renderChat = ({ item: chat }: { item: Chat }) => {
    const partner = getChatPartner(chat);
    const unreadCount = getUnreadCount(chat);
    const lastMessage = chat.lastMessage;
    const hasUnread = unreadCount > 0;

    if (!partner) return null;

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => {
          if (lastMessage) {
            markMessagesAsRead(chat.id, user!.uid);
          }
          router.push(`/chat/${chat.id}`);
        }}
        activeOpacity={0.8}
      >
        <Avatar
          source={partner.details.photoURL ? { uri: partner.details.photoURL } : null}
          name={partner.details.displayName}
          size="lg"
          presenceUid={partner.uid}
        />
        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <Text
              style={[styles.chatName, hasUnread && styles.chatNameUnread]}
              numberOfLines={1}
            >
              {partner.details.displayName}
            </Text>
            <Text style={[styles.chatTime, hasUnread && styles.chatTimeUnread]}>
              {lastMessage ? formatChatTime(lastMessage.createdAt) : ''}
            </Text>
          </View>
          <View style={styles.chatPreview}>
            <Text
              style={[styles.chatMessage, hasUnread && styles.chatMessageUnread]}
              numberOfLines={1}
            >
              {lastMessage
                ? lastMessage.type === 'image'
                  ? '📷 Photo'
                  : lastMessage.senderId === user?.uid
                    ? `You: ${lastMessage.text}`
                    : lastMessage.text
                : 'No messages yet'}
            </Text>
            {hasUnread && <Badge count={unreadCount} size="sm" variant="primary" />}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSeparator = () => (
    <View style={styles.separator} />
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <AppHeader title="Chats" />
        <FlatList
          data={Array.from({ length: 5 })}
          renderItem={() => <ChatSkeleton />}
          ItemSeparatorComponent={renderSeparator}
          keyExtractor={(_, i) => `skeleton-${i}`}
          ListHeaderComponent={<View style={styles.listHeader} />}
          ListFooterComponent={<View style={styles.listFooter} />}
        />
      </View>
    );
  }

  if (error && chats.length === 0) {
    return (
      <View style={styles.container}>
        <AppHeader title="Chats" />
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}>
            <LucideIcon name="wifi-off" size={28} color={COLORS.danger} />
          </View>
          <Text style={styles.emptyTitle}>Something went wrong</Text>
          {/* TEMPORARY: diagnostic text. selectable so the index URL can be
              copied straight out of the screen. */}
          <Text style={styles.diagError} selectable>
            {error}
          </Text>
          <Button
            title="Try again"
            onPress={handleRefresh}
            loading={refreshing}
            variant="outline"
          />
        </View>
      </View>
    );
  }

  if (chats.length === 0) {
    return (
      <View style={styles.container}>
        <AppHeader title="Chats" />
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}>
            <LucideIcon name="message-circle" size={30} color={COLORS.primary} />
          </View>
          <Text style={styles.emptyTitle}>No chats yet</Text>
          <Text style={styles.emptySubtitle}>
            Find people in Search and follow them to start a conversation.
          </Text>
          <Button
            title="Find people"
            onPress={() => router.push('/(tabs)/search')}
            leftIcon={<LucideIcon name="search" size={16} color={COLORS.textInverse} />}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader
        title="Chats"
        subtitle={
          chats.length === 1 ? '1 conversation' : `${chats.length} conversations`
        }
      />
      <FlatList
        data={chats}
        renderItem={renderChat}
        ItemSeparatorComponent={renderSeparator}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.primary]}
          />
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {error ? (
              <ErrorBanner
                message={error}
                actionLabel="Retry"
                onAction={handleRefresh}
                style={styles.listBanner}
              />
            ) : null}
          </View>
        }
        ListFooterComponent={<View style={styles.listFooter} />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContainer: {
    flex: 1,
  },
  listHeader: {
    paddingTop: SPACING.md,
  },
  listBanner: {
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: SPACING.sm,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryLight,
    marginBottom: SPACING.xs,
  },
  listFooter: {
    paddingBottom: SPACING.xl + 80, // Account for tab bar
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
    backgroundColor: COLORS.background,
  },
  chatContent: {
    flex: 1,
    minWidth: 0,
    gap: SPACING.xs,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
    marginRight: SPACING.sm,
  },
  chatNameUnread: {
    fontWeight: '700',
  },
  chatTime: {
    fontSize: 12,
    color: COLORS.textTertiary,
    flexShrink: 0,
  },
  chatTimeUnread: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  chatPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  chatMessage: {
    fontSize: 14,
    color: COLORS.textSecondary,
    flex: 1,
    flexShrink: 1,
  },
  chatMessageUnread: {
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  separator: {
    height: 0.5,
    backgroundColor: COLORS.border,
    marginLeft: 72, // Avatar size + gap
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
  // TEMPORARY diagnostic style — remove with describeFirestoreError.
  diagError: {
    fontSize: 11,
    color: COLORS.textTertiary,
    textAlign: 'center',
    lineHeight: 15,
    // A Firebase index-creation URL is a long unbroken token; without this it
    // overflows the screen instead of wrapping onto the next line.
    flexShrink: 1,
  },
});