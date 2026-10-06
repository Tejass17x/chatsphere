// Chat Detail Screen

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/contexts/AuthContext';
import {
  subscribeToChat,
  sendMessage,
  createMessageId,
  markMessagesAsRead,
  subscribeToUserProfile,
} from '@/services/firestore';
import { usePaginatedMessages } from '@/hooks/usePaginatedMessages';
import { Avatar } from '@/components/ui/Avatar';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { TypingIndicator } from '@/components/ui/TypingIndicator';
import { useUserPresence } from '@/contexts/PresenceContext';
import { useTyping } from '@/hooks/useTyping';
import { LucideIcon } from '@/components/ui/LucideIcon';
import {
  formatChatTime,
  formatRelativeTime,
  dayLabel,
  shouldShowDateSeparator,
} from '@/utils/helpers';
import {
  MAX_CHAT_IMAGE_LENGTH,
  prepareImageForFirestore,
} from '@/utils/firestoreImages';
import { COLORS, SPACING, BORDER_RADIUS } from '@/utils/constants';
import { Message, Chat, UserProfile } from '@/types';

export default function ChatScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [chat, setChat] = useState<Chat | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<UserProfile | null>(null);
  const [input, setInput] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [optimistic, setOptimistic] = useState<Message[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const markedRef = useRef<Set<string>>(new Set());

  const {
    messages,
    loadingOlder,
    hasMore,
    error: messagesError,
    loadOlder,
  } = usePaginatedMessages(chatId, Boolean(chatId));

  const partnerId = chat?.participants.find((id) => id !== user?.uid);
  const partner = partnerId && chat ? chat.participantDetails[partnerId] : null;
  const partnerPhotoURL = partnerProfile?.photoURL ?? partner?.photoURL ?? null;
  const partnerName = partnerProfile?.displayName || partner?.displayName || 'Chat';

  const { isPartnerTyping, notifyTyping } = useTyping(chatId, user?.uid);
  const { online: partnerOnline, lastSeen: partnerLastSeen } =
    useUserPresence(partnerId);

  // Subtitle for the header: live typing beats online, online beats "last seen".
  const headerSubtitle = isPartnerTyping
    ? 'typing…'
    : partnerOnline
    ? 'Online'
    : partnerLastSeen
    ? `Last seen ${formatRelativeTime(partnerLastSeen)}`
    : '';

  useEffect(() => {
    if (!partnerId) return;
    return subscribeToUserProfile(partnerId, setPartnerProfile);
  }, [partnerId]);

  // Subscribe to the chat document. Messages are handled by usePaginatedMessages.
  useEffect(() => {
    if (!chatId) return;

    const unsubChat = subscribeToChat(chatId, (updatedChat) => {
      setChat(updatedChat);
      setLoading(false);
    });

    return () => unsubChat();
  }, [chatId]);

  const displayMessages = useMemo(() => {
    if (optimistic.length === 0) return messages;
    // Firestore will echo each optimistic message back with a server
    // timestamp; filter those out so the bubble isn't rendered twice.
    const ids = new Set(messages.map((message) => message.id));
    return [...messages, ...optimistic.filter((message) => !ids.has(message.id))];
  }, [messages, optimistic]);

  // Drop optimistic entries once Firestore echoes them back.
  useEffect(() => {
    if (optimistic.length === 0) return;
    setOptimistic((prev) =>
      prev.filter((pending) => !messages.some((msg) => msg.id === pending.id))
    );
  }, [messages]);

  useEffect(() => {
    if (!chatId || !user || displayMessages.length === 0) return;
    const unread = displayMessages.filter(
      (message) =>
        message.senderId !== user.uid &&
        message.status !== 'read' &&
        !message.id.startsWith('local_') &&
        !markedRef.current.has(message.id)
    );
    const chatUnread = chat?.unreadCount?.[user.uid] || 0;
    if (unread.length === 0 && chatUnread === 0) return;

    unread.forEach((message) => markedRef.current.add(message.id));
    const timer = setTimeout(() => {
      markMessagesAsRead(chatId, user.uid, unread).catch(() => {
        unread.forEach((message) => markedRef.current.delete(message.id));
      });
    }, 200);

    return () => clearTimeout(timer);
  }, [chatId, user, displayMessages, chat]);

  // Auto-scroll to the newest message — but only when the user is already near
  // the bottom. Otherwise loading older history would yank them away from
  // whatever they were reading.
  const wasNearBottomRef = useRef(true);
  const prevLengthRef = useRef(0);

  useEffect(() => {
    const grew = displayMessages.length > prevLengthRef.current;
    prevLengthRef.current = displayMessages.length;

    if (!grew || !wasNearBottomRef.current) return;
    if (!flatListRef.current) return;

    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    });
  }, [displayMessages.length]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement } = event.nativeEvent;
    currentOffsetRef.current = contentOffset.y;
    // 120px of slack so a slightly-short list still counts as "at the bottom".
    wasNearBottomRef.current =
      contentOffset.y + layoutMeasurement.height > displayMessagesHeightRef.current - 120;
  };

  // Tracked in refs so the callbacks above stay referentially stable.
  const currentOffsetRef = useRef(0);
  const displayMessagesHeightRef = useRef(0);
  const onContentSizeChange = useCallback(
    (_width: number, height: number) => {
      displayMessagesHeightRef.current = height;
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      });
    },
    []
  );

  const handleLoadOlder = useCallback(() => {
    // Capture the current scroll distance so we can restore it after the page
    // lands above; otherwise the content would jump upward dramatically.
    // FlatList's ref exposes the ScrollView methods but not its metrics
    // properties, so read the offset off the scroll event instead.
    const offset = currentOffsetRef.current;
    const height = displayMessagesHeightRef.current;

    loadOlder().then(() => {
      requestAnimationFrame(() => {
        const delta = displayMessagesHeightRef.current - height;
        if (delta !== 0) {
          flatListRef.current?.scrollToOffset({
            offset: offset + delta,
            animated: false,
          });
        }
      });
    });
  }, [loadOlder]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || !chatId || !user) return;

    const messageId = createMessageId(chatId);
    const localMessage: Message = {
      id: messageId,
      chatId,
      senderId: user.uid,
      text,
      imageUrl: null,
      type: 'text',
      status: 'sent',
      createdAt: new Date(),
      readAt: null,
    };

    setInput('');
    setSendError(null);
    // The message is away, so we're no longer typing.
    notifyTyping(false);
    setOptimistic((prev) => [...prev, localMessage]);

    try {
      await sendMessage(chatId, user.uid, text, undefined, messageId);
    } catch (error) {
      console.error('Send failed:', error);
      setOptimistic((prev) => prev.filter((message) => message.id !== messageId));
      setInput(text);
      // Not Alert.alert — that's a no-op on react-native-web, so the message
      // would vanish with no explanation on the platform the user is running.
      setSendError(error instanceof Error ? error.message : 'Failed to send message. Please try again.');
    }
  }, [input, chatId, user, notifyTyping]);

  const handleSendImage = async () => {
    if (!chatId || !user || uploadingImage) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      const image = result.assets?.[0];
      if (result.canceled || !image) return;

      setUploadingImage(true);
      const dataUri = await prepareImageForFirestore(
        image.uri,
        image.width,
        image.height,
        MAX_CHAT_IMAGE_LENGTH
      );
      const messageId = createMessageId(chatId);
      const localMessage: Message = {
        id: messageId,
        chatId,
        senderId: user.uid,
        text: '',
        imageUrl: dataUri,
        type: 'image',
        status: 'sent',
        createdAt: new Date(),
        readAt: null,
      };
      setOptimistic((prev) => [...prev, localMessage]);
      try {
        await sendMessage(chatId, user.uid, '', dataUri, messageId);
      } catch (sendError) {
        setOptimistic((prev) => prev.filter((message) => message.id !== messageId));
        throw sendError;
      }
    } catch (error) {
      console.error('Image message send failed:', error);
      setSendError(
        error instanceof Error ? error.message : 'Unable to send this photo. Please try another.'
      );
    } finally {
      setUploadingImage(false);
    }
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isOwn = item.senderId === user?.uid;
    const prev = displayMessages[index - 1];
    const next = displayMessages[index + 1];

    // A "run" is consecutive messages from the same sender. Only the last
    // bubble in a run gets the sharp tail corner; giving every bubble in the
    // run the same corner makes the tail look like a rendering artifact rather
    // than a pointer at the latest message.
    const startsRun = !prev || prev.senderId !== item.senderId;
    const endsRun = !next || next.senderId !== item.senderId;
    const showAvatar = !isOwn && startsRun;

    return (
      <View style={styles.messageWrapper}>
        {shouldShowDateSeparator(item.createdAt, prev?.createdAt) ? (
          <View style={styles.dateSeparator}>
            <Text style={styles.dateSeparatorText}>{dayLabel(item.createdAt)}</Text>
          </View>
        ) : null}

        <View
          style={[
            styles.messageRow,
            isOwn ? styles.messageRowOwn : styles.messageRowOther,
            startsRun && styles.messageRowRunStart,
            endsRun && styles.messageRowRunEnd,
          ]}
        >
          {!isOwn && (
            <View style={styles.avatarSpace}>
              {showAvatar && partner && (
                <Avatar
                  source={partnerPhotoURL ? { uri: partnerPhotoURL } : null}
                  name={partnerName}
                  size="xs"
                />
              )}
            </View>
          )}

          <View
            style={[
              styles.bubble,
              isOwn ? styles.bubbleOwn : styles.bubbleOther,
              // Tail corner only on the final bubble of a run.
              isOwn
                ? endsRun
                  ? styles.bubbleOwnTail
                  : styles.bubbleOwnFlush
                : endsRun
                  ? styles.bubbleOtherTail
                  : styles.bubbleOtherFlush,
            ]}
          >
            {item.type === 'image' && item.imageUrl && (
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.messageImage}
                resizeMode="cover"
              />
            )}

            {item.text ? (
              <Text style={[styles.messageText, isOwn && styles.messageTextOwn]}>
                {item.text}
              </Text>
            ) : null}

            <View style={styles.metaRow}>
              <Text style={[styles.messageTime, isOwn && styles.messageTimeOwn]}>
                {formatChatTime(item.createdAt)}
              </Text>
              {isOwn && (
                <LucideIcon
                  name={item.status === 'read' ? 'check-check' : 'check'}
                  size={14}
                  color={
                    item.status === 'read' ? COLORS.textInverse : 'rgba(255,255,255,0.75)'
                  }
                  style={styles.ticks}
                />
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // A chat we cannot read is different from a chat that is merely empty —
  // one is a bug (permissions, rules, missing doc), the other is just new.
  if (!chat) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: true, title: 'Chat', headerBackTitle: 'Back' }} />
        <View style={styles.emptyChat}>
          <View style={styles.emptyIconWrap}>
            <LucideIcon name="alert-circle" size={28} color={COLORS.danger} />
          </View>
          <Text style={styles.emptyText}>Conversation unavailable</Text>
          <Text style={styles.emptySubtitle}>
            This chat could not be loaded. It may have been removed, or you may no
            longer have access.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 56 : 0}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          title: partnerName,
          headerBackTitle: 'Back',
          // Rendered as a node rather than a plain string so the presence /
          // typing line can sit under the name.
          headerTitle: () => (
            <View style={styles.headerTitleBlock}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {partnerName}
              </Text>
              {headerSubtitle ? (
                <Text
                  style={[
                    styles.headerSubtitle,
                    (isPartnerTyping || partnerOnline) && styles.headerSubtitleActive,
                  ]}
                  numberOfLines={1}
                >
                  {headerSubtitle}
                </Text>
              ) : null}
            </View>
          ),
          headerRight: () => (
            <Avatar
              source={partnerPhotoURL ? { uri: partnerPhotoURL } : null}
              name={partnerName}
              size="sm"
              presenceUid={partnerId}
            />
          ),
        }}
      />

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={displayMessages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        extraData={displayMessages.map((message) => message.status).join(',')}
        contentContainerStyle={styles.messagesContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onScroll={handleScroll}
        scrollEventThrottle={64}
        onContentSizeChange={onContentSizeChange}
        // Reaching the top is "load older", which matches where the user's
        // thumb already is — no pull gesture needed.
        onEndReached={hasMore ? handleLoadOlder : undefined}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View>
            {loadingOlder ? (
              <View style={styles.historyLoader}>
                <ActivityIndicator size="small" color={COLORS.textTertiary} />
              </View>
            ) : null}
            {!loadingOlder && messagesError ? (
              <View style={styles.historyError}>
                <Text style={styles.historyErrorText}>{messagesError}</Text>
                <TouchableOpacity onPress={handleLoadOlder}>
                  <Text style={styles.historyRetry}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <View style={styles.emptyIconWrap}>
              <Avatar
                source={partnerPhotoURL ? { uri: partnerPhotoURL } : null}
                name={partnerName}
                size="xl"
                presenceUid={partnerId}
              />
            </View>
            <Text style={styles.emptyText}>{partnerName}</Text>
            <Text style={styles.emptySubtitle}>
              This is the start of your conversation. Say hello.
            </Text>
          </View>
        }
      />

      {sendError ? (
        <ErrorBanner message={sendError} onDismiss={() => setSendError(null)} style={styles.sendBanner} />
      ) : null}

      <TypingIndicator visible={isPartnerTyping} />

      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, SPACING.sm) }]}>
        <TouchableOpacity
          onPress={handleSendImage}
          style={styles.attachButton}
          disabled={uploadingImage}
          accessibilityLabel="Choose a photo to send"
        >
          {uploadingImage ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <LucideIcon name="image" size={24} color={COLORS.textSecondary} />
          )}
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor={COLORS.textTertiary}
          value={input}
          onChangeText={(text) => {
            setInput(text);
            // Fire on every keystroke; the signal throttles the actual writes.
            notifyTyping(text.length > 0);
          }}
          multiline
          maxLength={2000}
          blurOnSubmit={false}
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />

        <TouchableOpacity
          onPress={handleSend}
          style={[
            styles.sendButton,
            !input.trim() && styles.sendButtonDisabled,
          ]}
          disabled={!input.trim()}
        >
          <LucideIcon name="send" size={20} color={COLORS.textInverse} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  headerTitleBlock: {
    alignItems: 'center',
    // Expo Router's native header reserves space for the back button on the
    // left and the action slot on the right; matching those insets keeps the
    // title optically centred instead of drifting.
    maxWidth: 220,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  headerSubtitleActive: {
    color: COLORS.success,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  messagesContainer: {
    padding: SPACING.md,
    paddingBottom: SPACING.md,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  messageWrapper: {
    width: '100%',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  messageRowOwn: {
    justifyContent: 'flex-end',
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },
  // Bubbles inside a run hug together; the gap only appears between runs.
  messageRowRunEnd: {
    marginBottom: SPACING.xs,
  },
  messageRowRunStart: {
    marginTop: SPACING.sm,
  },
  avatarSpace: {
    width: 32,
    marginRight: SPACING.xs,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  bubbleOwn: {
    backgroundColor: COLORS.primary,
  },
  bubbleOther: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bubbleOwnTail: {
    borderBottomRightRadius: 4,
  },
  bubbleOwnFlush: {
    borderBottomRightRadius: BORDER_RADIUS.lg,
  },
  bubbleOtherTail: {
    borderBottomLeftRadius: 4,
  },
  bubbleOtherFlush: {
    borderBottomLeftRadius: BORDER_RADIUS.lg,
  },
  dateSeparator: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  dateSeparatorText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    backgroundColor: COLORS.surfaceVariant,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    color: COLORS.textPrimary,
  },
  messageTextOwn: {
    color: COLORS.textInverse,
  },
  messageImage: {
    width: 220,
    height: 220,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.xs,
    backgroundColor: COLORS.surfaceVariant,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 2,
    gap: 3,
  },
  messageTime: {
    fontSize: 10,
    color: COLORS.textTertiary,
  },
  messageTimeOwn: {
    color: 'rgba(255,255,255,0.7)',
  },
  ticks: {
    marginLeft: 1,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    gap: SPACING.sm,
  },
  attachButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 40,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.textTertiary,
    opacity: 0.5,
  },
  historyLoader: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  sendBanner: {
    // Sits directly above the input bar; no horizontal margin because it
    // spans the full width of the composer.
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
  },
  historyError: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.danger + '14',
    alignItems: 'center',
    gap: 4,
  },
  historyErrorText: {
    fontSize: 13,
    color: COLORS.danger,
    textAlign: 'center',
  },
  historyRetry: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  emptyChat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xl,
  },
  emptyIconWrap: {
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
});