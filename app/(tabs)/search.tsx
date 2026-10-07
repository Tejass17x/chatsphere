// Search Tab Screen

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Keyboard,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import {
  searchUsers,
  getAllUsers,
  computeFollowStatus,
  getOrCreateChat,
  sendFollowRequest,
  acceptFollowRequest,
  rejectFollowRequest,
  unfollowUser,
  followUser,
  getUserProfile,
} from '@/services/firestore';
import { Avatar } from '@/components/ui/Avatar';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Button } from '@/components/ui/Button';
import { LucideIcon } from '@/components/ui/LucideIcon';
import { AppHeader } from '@/components/ui/AppHeader';
import { Loading, UserSkeleton } from '@/components/ui/Loading';
import { COLORS, SPACING, BORDER_RADIUS, PATTERNS } from '@/utils/constants';
import { FollowStatus, UserProfile } from '@/types';

interface UserWithStatus extends UserProfile {
  followStatus: FollowStatus;
}

interface SearchBarProps {
  query: string;
  error: string | null;
  actionError: string | null;
  onChangeText: (text: string) => void;
  onRetry: () => void;
  onClearError: () => void;
  onClearActionError: () => void;
}

function SearchBar({
  query,
  error,
  actionError,
  onChangeText,
  onRetry,
  onClearError,
  onClearActionError,
}: SearchBarProps) {
  return (
    <View>
      <View style={styles.searchContainer}>
        <LucideIcon name="search" size={20} color={COLORS.textTertiary} style={styles.searchIcon} />
        <TextInput
          placeholder="Search users..."
          value={query}
          onChangeText={onChangeText}
          style={styles.searchInput}
          placeholderTextColor={COLORS.textTertiary}
          autoCapitalize="none"
          autoComplete="off"
        />
        {query ? (
          <TouchableOpacity
            onPress={() => onChangeText('')}
            style={styles.clearButton}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <LucideIcon name="x" size={20} color={COLORS.textTertiary} />
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? (
        <ErrorBanner
          message={error}
          actionLabel="Retry"
          onAction={onRetry}
          onDismiss={onClearError}
        />
      ) : null}
      {actionError ? (
        <ErrorBanner message={actionError} onDismiss={onClearActionError} />
      ) : null}
    </View>
  );
}

export default function SearchScreen() {
  const router = useRouter();
  const { user, firebaseUser, patchUser, refreshProfile } = useAuth();
  const { notifyFollowRequest, notifyFollowAccepted } = useNotifications();
  const userRef = useRef(user);
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<UserWithStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [actingOn, setActingOn] = useState<Record<string, boolean>>({});
  // Opening a chat is a network round-trip, so it needs its own busy flag;
  // `actingOn` covers follow/unfollow writes, not navigation.
  const [openingChat, setOpeningChat] = useState<string | null>(null);
  const openingChatRef = useRef<string | null>(null);
  // Errors are shown inline rather than through Alert.alert, which is a no-op
  // on react-native-web and would leave failures completely invisible.
  const [actionError, setActionError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestRef = useRef(0);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const withStatus = useCallback(
    (list: UserProfile[]): UserWithStatus[] => {
      const currentUser = userRef.current;
      if (!currentUser) return list.map((u) => ({ ...u, followStatus: 'none' as FollowStatus }));
      return list.map((u) => ({ ...u, followStatus: computeFollowStatus(currentUser, u) }));
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        Keyboard.dismiss();
        router.replace('/(tabs)/chats');
        return true;
      });

      return () => subscription.remove();
    }, [router])
  );

  useEffect(() => {
    if (!user) return;
    setUsers((prev) =>
      prev.map((u) => ({ ...u, followStatus: computeFollowStatus(user, u) }))
    );
  }, [user]);

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string) => {
    const requestId = ++searchRequestRef.current;
    if (!firebaseUser) {
      setLoading(false);
      setInitialLoad(false);
      return;
    }

    setLoading(true);
    setLoadingMore(false);
    setSearchError(null);
    setUsers([]);
    setLastDoc(null);
    setHasMore(true);

    try {
      let result;
      if (searchQuery.trim()) {
        result = await searchUsers(searchQuery.trim(), firebaseUser.uid);
      } else {
        result = await getAllUsers(firebaseUser.uid);
      }

      if (requestId !== searchRequestRef.current) return;
      setUsers(withStatus(result.users));
      setLastDoc(result.lastDoc);
      setHasMore(!!result.lastDoc);
    } catch (error) {
      console.error('Search failed:', error);
      if (requestId === searchRequestRef.current) {
        setSearchError(
          error instanceof Error
            ? error.message
            : 'Could not search users. Check your connection and try again.'
        );
      }
    } finally {
      if (requestId === searchRequestRef.current) {
        setLoading(false);
        setInitialLoad(false);
      }
    }
  }, [firebaseUser, withStatus]);

  // Load more users
  const loadMore = useCallback(async () => {
    if (!firebaseUser || loadingMore || !hasMore || !lastDoc) return;

    setLoadingMore(true);
    const requestId = searchRequestRef.current;

    try {
      // Both branches share this exact shape, so name it explicitly rather
      // than leaving `result` to be inferred as `any`.
      let result: Awaited<ReturnType<typeof searchUsers>>;
      if (query.trim()) {
        result = await searchUsers(query.trim(), firebaseUser.uid, 20, lastDoc);
      } else {
        result = await getAllUsers(firebaseUser.uid, 20, lastDoc);
      }

      if (requestId !== searchRequestRef.current) return;
      setUsers((prev) => [...prev, ...withStatus(result.users)]);
      setLastDoc(result.lastDoc);
      setHasMore(!!result.lastDoc);
    } catch (error) {
      console.error('Load more failed:', error);
      if (requestId === searchRequestRef.current) {
        setSearchError(
          error instanceof Error
            ? error.message
            : 'Could not load more users. Check your connection and try again.'
        );
      }
    } finally {
      if (requestId === searchRequestRef.current) {
        setLoadingMore(false);
      }
    }
  }, [firebaseUser, query, loadingMore, hasMore, lastDoc, withStatus]);

  // Handle search input
  const handleSearchChange = (text: string) => {
    setQuery(text);
    setSearchError(null);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    searchRequestRef.current += 1;
    debounceRef.current = setTimeout(() => {
      performSearch(text);
    }, 300);
  };

  // Initial load
  useEffect(() => {
    performSearch('');
    return () => {
      searchRequestRef.current += 1;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [performSearch]);

  const patchTarget = (targetId: string, updater: (u: UserWithStatus) => UserWithStatus) => {
    setUsers((prev) => prev.map((u) => (u.uid === targetId ? updater(u) : u)));
  };

  /**
   * Re-read one profile from the server and recompute its follow status.
   *
   * The optimistic patch above is what makes the button feel instant, but it is
   * a guess about what the transaction did. Re-reading afterwards means a row
   * can never claim "mutual" (and show a Chat button) when the stored data
   * disagrees — which is what left the Chat button silently failing.
   */
  const syncTarget = useCallback(async (targetId: string) => {
    try {
      const fresh = await getUserProfile(targetId);
      if (!fresh) return;
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === targetId
            ? { ...fresh, followStatus: user ? computeFollowStatus(user, fresh) : 'none' }
            : u
        )
      );
    } catch (error) {
      console.error('Failed to refresh profile after follow action:', error);
    }
  }, [user]);

  const handleFollowAction = async (
    targetUser: UserWithStatus,
    action?: 'follow' | 'cancel' | 'accept' | 'decline' | 'unfollow'
  ) => {
    if (!firebaseUser || !user || actingOn[targetUser.uid]) return;

    const { followStatus, uid: targetId } = targetUser;
    const resolved =
      action ||
      (followStatus === 'none' || followStatus === 'follower'
        ? 'follow'
        : followStatus === 'requested'
          ? 'cancel'
          : followStatus === 'incoming'
            ? 'accept'
            : 'unfollow');

    const prevUser = user;
    const prevTarget = targetUser;

    setActingOn((prev) => ({ ...prev, [targetId]: true }));
    setActionError(null);

    try {
      switch (resolved) {
        case 'follow': {
          if (followStatus === 'follower') {
            patchUser({
              following: user.following.includes(targetId)
                ? user.following
                : [...user.following, targetId],
              followRequests: user.followRequests.filter((id) => id !== targetId),
            });
            patchTarget(targetId, (u) => ({
              ...u,
              followers: u.followers.includes(firebaseUser.uid)
                ? u.followers
                : [...u.followers, firebaseUser.uid],
              followStatus: 'mutual',
            }));
            await followUser(firebaseUser.uid, targetId);
          } else {
            patchUser({
              sentRequests: user.sentRequests.includes(targetId)
                ? user.sentRequests
                : [...user.sentRequests, targetId],
            });
            patchTarget(targetId, (u) => ({ ...u, followStatus: 'requested' }));
            await sendFollowRequest(firebaseUser.uid, targetId);
            try {
              await notifyFollowRequest(targetId, user.displayName || 'Someone');
            } catch (error) {
              console.error('Follow request sent, but notification could not be sent:', error);
            }
          }
          break;
        }
        case 'cancel':
          patchUser({
            sentRequests: user.sentRequests.filter((id) => id !== targetId),
          });
          patchTarget(targetId, (u) => ({ ...u, followStatus: 'none' }));
          await rejectFollowRequest(firebaseUser.uid, targetId);
          break;
        case 'decline':
          patchUser({
            followRequests: user.followRequests.filter((id) => id !== targetId),
          });
          patchTarget(targetId, (u) => ({ ...u, followStatus: 'none' }));
          await rejectFollowRequest(targetId, firebaseUser.uid);
          break;
        case 'accept': {
          const wasAlreadyFollowing = user.following.includes(targetId);
          patchUser({
            ...(wasAlreadyFollowing
              ? { followers: [...new Set([...user.followers, targetId])] }
              : {}),
            followRequests: user.followRequests.filter((id) => id !== targetId),
          });
          patchTarget(targetId, (u) => ({
            ...u,
            following: u.following.includes(firebaseUser.uid)
              ? u.following
              : [...u.following, firebaseUser.uid],
            followers: wasAlreadyFollowing
              ? [...new Set([...u.followers, firebaseUser.uid])]
              : u.followers,
            followStatus: wasAlreadyFollowing ? 'mutual' : 'follower',
          }));
          await acceptFollowRequest(targetId, firebaseUser.uid);
          try {
            await notifyFollowAccepted(targetId, user.displayName || 'Someone');
          } catch (error) {
            console.error('Follow accepted, but notification could not be sent:', error);
          }
          break;
        }
        case 'unfollow': {
          const stillFollowsMe =
            targetUser.following.includes(firebaseUser.uid);
          patchUser({
            following: user.following.filter((id) => id !== targetId),
            sentRequests: user.sentRequests.filter((id) => id !== targetId),
          });
          patchTarget(targetId, (u) => ({
            ...u,
            followers: u.followers.filter((id) => id !== firebaseUser.uid),
            followStatus: stillFollowsMe ? 'follower' : 'none',
          }));
          await unfollowUser(firebaseUser.uid, targetId);
          break;
        }
      }
    } catch (error) {
      console.error('Follow action failed:', error);
      patchUser(prevUser);
      patchTarget(targetId, () => prevTarget);
      setActionError(
        error instanceof Error ? error.message : 'Failed to process request. Please try again.'
      );
    } finally {
      setActingOn((prev) => {
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
      // Reconcile against the server regardless of outcome. On success this
      // confirms the transition; on failure it discards the optimistic patch.
      refreshProfile().catch(() => {});
      syncTarget(targetId);
    }
  };

  const openChat = async (targetId: string) => {
    if (!firebaseUser || openingChatRef.current === targetId) return;

    openingChatRef.current = targetId;
    setOpeningChat(targetId);
    setActionError(null);
    try {
      const chat = await getOrCreateChat(firebaseUser.uid, targetId);
      router.push(`/chat/${chat.id}`);
    } catch (error) {
      // Alert.alert() is a no-op on react-native-web, so the failure would
      // otherwise be invisible and the button would just look dead — the same
      // bug that made the logout button appear broken.
      console.error('Open chat failed:', error);
      setActionError(
        error instanceof Error ? error.message : 'Could not open this chat. Please try again.'
      );
    } finally {
      openingChatRef.current = null;
      setOpeningChat(null);
    }
  };

  const renderUser = ({ item: userItem }: { item: UserWithStatus }) => (
    <View style={styles.userItem}>
      <Avatar
        source={userItem.photoURL ? { uri: userItem.photoURL } : null}
        name={userItem.displayName}
        size="md"
        presenceUid={userItem.uid}
      />
      <View style={styles.userInfo}>
        <Text style={styles.userName} numberOfLines={1}>
          {userItem.displayName}
        </Text>
        <Text style={styles.userEmail} numberOfLines={1}>
          @{userItem.email.split('@')[0]}
        </Text>
      </View>
      <View style={styles.userAction}>
        {renderFollowButton(userItem)}
      </View>
    </View>
  );

  const renderFollowButton = (target: UserWithStatus) => {
    const busy = !!actingOn[target.uid];
    const chatBusy = openingChat === target.uid;
    // Either kind of write disables both buttons on the row, so a follow and a
    // chat-open can't race each other on the same relationship.
    const locked = busy || openingChat !== null;
    const status = target.followStatus;

    // While a write is in flight the label is replaced by a spinner. The
    // button is already disabled, so this reads as progress on the row the
    // user actually touched rather than a global spinner.
    const label = (text: string, light?: boolean, spin?: boolean) =>
      busy || spin ? (
        <ActivityIndicator
          size="small"
          color={light ? COLORS.textSecondary : COLORS.textInverse}
        />
      ) : (
        <Text style={[styles.pillText, light && styles.pillTextLight]}>{text}</Text>
      );

    if (status === 'incoming') {
      return (
        <View style={styles.incomingActions}>
          <TouchableOpacity
            style={[styles.pill, styles.pillPrimary]}
            onPress={() => handleFollowAction(target, 'accept')}
            disabled={locked}
            accessibilityState={{ disabled: locked }}
          >
            {label('Accept')}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pill, styles.pillSubtle]}
            onPress={() => handleFollowAction(target, 'decline')}
            disabled={locked}
            accessibilityState={{ disabled: locked }}
          >
            {label('Decline', true)}
          </TouchableOpacity>
        </View>
      );
    }

    if (status === 'mutual') {
      return (
        <View style={styles.incomingActions}>
          <TouchableOpacity
            style={[styles.pill, styles.pillSuccess]}
            onPress={() => openChat(target.uid)}
            disabled={locked}
            accessibilityState={{ disabled: locked, busy: chatBusy }}
          >
            {label('Chat', false, chatBusy)}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pill, styles.pillSubtle]}
            onPress={() => handleFollowAction(target, 'unfollow')}
            disabled={locked}
            accessibilityState={{ disabled: locked }}
          >
            {label('Unfollow', true)}
          </TouchableOpacity>
        </View>
      );
    }

    const config: Record<
      Exclude<FollowStatus, 'incoming' | 'mutual'>,
      { label: string; style: object; light?: boolean }
    > = {
      none: { label: 'Follow', style: styles.pillPrimary },
      requested: { label: 'Requested', style: styles.pillMuted, light: true },
      following: { label: 'Unfollow', style: styles.pillSubtle, light: true },
      follower: { label: 'Follow Back', style: styles.pillPrimary },
    };

    const item = config[status];
    return (
      <TouchableOpacity
        style={[styles.pill, item.style]}
        onPress={() => handleFollowAction(target)}
        disabled={locked}
        accessibilityState={{ disabled: locked }}
      >
        {label(item.label, item.light)}
      </TouchableOpacity>
    );
  };

  const renderSeparator = () => (
    <View style={styles.separator} />
  );

  return (
    <View style={styles.container}>
      <AppHeader title="Search" subtitle="Find people to connect with" />
      <SearchBar
        query={query}
        error={searchError}
        actionError={actionError}
        onChangeText={handleSearchChange}
        onRetry={() => performSearch(query)}
        onClearError={() => setSearchError(null)}
        onClearActionError={() => setActionError(null)}
      />
      <View style={styles.resultsContainer}>
        {initialLoad && loading ? (
          <FlatList
            data={Array.from({ length: 5 })}
            renderItem={() => <UserSkeleton />}
            ItemSeparatorComponent={renderSeparator}
            keyExtractor={(_, i) => `skeleton-${i}`}
            ListFooterComponent={<View style={styles.listFooter} />}
          />
        ) : users.length === 0 && !loading && !searchError ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <LucideIcon
                name={query ? 'search' : 'users'}
                size={30}
                color={COLORS.primary}
              />
            </View>
            <Text style={styles.emptyTitle}>
              {query ? 'No matches' : 'No users yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {query
                ? `Nobody matches "${query}". Try a different name.`
                : 'Once people create accounts they will show up here.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={users}
            renderItem={renderUser}
            ItemSeparatorComponent={renderSeparator}
            keyExtractor={(item) => item.uid}
            ListFooterComponent={
              <View style={styles.listFooter}>
                {loadingMore && (
                  <View style={styles.loadMore}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                    <Text style={styles.loadMoreText}>Loading more...</Text>
                  </View>
                )}
                {!hasMore && users.length > 0 && (
                  <Text style={styles.endOfList}>End of list</Text>
                )}
              </View>
            }
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  resultsContainer: {
    flex: 1,
  },
  listContainer: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    height: 48,
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  clearButton: {
    padding: SPACING.xs,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
    backgroundColor: COLORS.background,
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  userAction: {
    flexShrink: 0,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  userEmail: {
    fontSize: 13,
    color: COLORS.textTertiary,
  },
  incomingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    minWidth: 76,
    alignItems: 'center',
  },
  pillPrimary: {
    backgroundColor: COLORS.primary,
  },
  pillSuccess: {
    backgroundColor: COLORS.success,
  },
  pillMuted: {
    backgroundColor: COLORS.surfaceVariant,
  },
  pillSubtle: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textInverse,
  },
  pillTextLight: {
    color: COLORS.textSecondary,
  },
  separator: {
    height: 0.5,
    backgroundColor: COLORS.border,
    marginLeft: 60,
  },
  listFooter: {
    paddingVertical: SPACING.lg,
    paddingBottom: SPACING.xl + 80,
    alignItems: 'center',
  },
  loadMore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  loadMoreText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  endOfList: {
    fontSize: 14,
    color: COLORS.textTertiary,
    marginTop: SPACING.md,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
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