// Firestore service for database operations

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  endBefore,
  onSnapshot,
  serverTimestamp,
  runTransaction,
  writeBatch,
  arrayUnion,
  arrayRemove,
  increment,
  documentId,
  Timestamp,
  DocumentSnapshot,
  QueryDocumentSnapshot,
  type FieldValue,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  UserProfile,
  Chat,
  Message,
  Notification,
  FollowStatus,
  FirestoreUserProfile,
  FirestoreChat,
  FirestoreMessage,
  FirestoreNotification,
} from '@/types';
import { COLLECTIONS } from '@/utils/constants';
import { formatChatTime } from '@/utils/helpers';

// ============ USER OPERATIONS ============

// Convert Firestore doc to UserProfile
function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function docToUserProfile(doc: DocumentSnapshot): UserProfile | null {
  if (!doc.exists()) return null;
  const data = doc.data() as FirestoreUserProfile;
  return {
    ...data,
    uid: doc.id,
    photoURL: data.photoURL ?? null,
    bio: data.bio ?? '',
    followers: asStringArray(data.followers),
    following: asStringArray(data.following),
    followRequests: asStringArray(data.followRequests),
    sentRequests: asStringArray(data.sentRequests),
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
    lastActive: data.lastActive?.toDate() || new Date(),
    fcmToken: data.fcmToken ?? null,
  };
}

// Get user profile by UID
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const userRef = doc(db, COLLECTIONS.USERS, uid);
  const userSnap = await getDoc(userRef);
  return docToUserProfile(userSnap);
}

// Get multiple user profiles by UIDs
export async function getUserProfiles(uids: string[]): Promise<UserProfile[]> {
  if (uids.length === 0) return [];
  const unique = [...new Set(uids)];
  const usersRef = collection(db, COLLECTIONS.USERS);
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 10) {
    chunks.push(unique.slice(i, i + 10));
  }
  const snapshots = await Promise.all(
    chunks.map((chunk) => getDocs(query(usersRef, where(documentId(), 'in', chunk))))
  );
  return snapshots.flatMap(
    (snapshot) => snapshot.docs.map(docToUserProfile).filter(Boolean) as UserProfile[]
  );
}

// Search users by display name
export async function searchUsers(
  searchTerm: string,
  currentUserId: string,
  pageSize: number = 20,
  lastDoc?: QueryDocumentSnapshot
): Promise<{ users: UserProfile[]; lastDoc: QueryDocumentSnapshot | null }> {
  const usersRef = collection(db, COLLECTIONS.USERS);
  const normalizedTerm = searchTerm.trim().toLowerCase();
  if (!normalizedTerm || pageSize <= 0) return { users: [], lastDoc: null };

  // Scan ordered pages so profiles without the optional displayNameLower
  // field (older accounts) are searchable too.
  const scanPageSize = 100;
  const matches: { user: UserProfile; snapshot: QueryDocumentSnapshot }[] = [];
  let cursor = lastDoc;
  let reachedEnd = false;

  while (matches.length <= pageSize && !reachedEnd) {
    let q = query(usersRef, orderBy('displayName'), limit(scanPageSize));
    if (cursor) {
      q = query(q, startAfter(cursor));
    }

    const snapshot = await getDocs(q);
    if (snapshot.empty) break;

    for (const userDoc of snapshot.docs) {
      const user = docToUserProfile(userDoc);
      if (
        user
        && user.uid !== currentUserId
        && user.displayName.trim().toLowerCase().startsWith(normalizedTerm)
      ) {
        matches.push({ user, snapshot: userDoc });
        if (matches.length > pageSize) break;
      }
    }

    cursor = snapshot.docs[snapshot.docs.length - 1];
    reachedEnd = snapshot.docs.length < scanPageSize;
  }

  const hasMore = matches.length > pageSize;
  const results = matches.slice(0, pageSize);
  return {
    users: results.map(({ user }) => user),
    lastDoc: hasMore ? results[pageSize - 1].snapshot : null,
  };
}

// Get all users (for search)
export async function getAllUsers(
  currentUserId: string,
  pageSize: number = 20,
  lastDoc?: QueryDocumentSnapshot
): Promise<{ users: UserProfile[]; lastDoc: QueryDocumentSnapshot | null }> {
  const usersRef = collection(db, COLLECTIONS.USERS);

  let q = query(usersRef, orderBy('displayName'), limit(pageSize + 1));

  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }

  const snapshot = await getDocs(q);
  const users = snapshot.docs
    .map(docToUserProfile)
    .filter((u): u is UserProfile => u !== null && u.uid !== currentUserId);

  const hasMore = users.length > pageSize;
  const results = hasMore ? users.slice(0, pageSize) : users;
  const newLastDoc = hasMore ? snapshot.docs[pageSize - 1] : null;

  return { users: results, lastDoc: newLastDoc };
}

// Subscribe to user profile changes
export function subscribeToUserProfile(
  uid: string,
  callback: (profile: UserProfile | null) => void,
  onError?: (error: Error) => void
): () => void {
  const userRef = doc(db, COLLECTIONS.USERS, uid);
  return onSnapshot(
    userRef,
    (snap) => {
      callback(docToUserProfile(snap));
    },
    (error) => {
      onError?.(error);
    }
  );
}

// ============ FOLLOW OPERATIONS ============

export function computeFollowStatus(
  // sentRequests/followRequests are optional because asStringArray() already
  // treats a missing or malformed array as empty; callers holding a partial
  // user document must still be able to call this.
  currentUser: Pick<UserProfile, 'uid' | 'following' | 'followers'> &
    Partial<Pick<UserProfile, 'sentRequests' | 'followRequests'>>,
  targetUser: Pick<UserProfile, 'uid' | 'following' | 'followers'> &
    Partial<Pick<UserProfile, 'sentRequests' | 'followRequests'>>
): FollowStatus {
  if (!currentUser || !targetUser || currentUser.uid === targetUser.uid) return 'none';

  const currentFollowsTarget = asStringArray(currentUser.following).includes(targetUser.uid);
  const targetFollowsCurrent = asStringArray(targetUser.following).includes(currentUser.uid);

  if (currentFollowsTarget && targetFollowsCurrent) return 'mutual';
  if (currentFollowsTarget) return 'following';
  if (targetFollowsCurrent) return 'follower';
  const incomingRequest =
    asStringArray(currentUser.followRequests).includes(targetUser.uid) ||
    asStringArray(targetUser.sentRequests).includes(currentUser.uid);
  if (incomingRequest) return 'incoming';
  const outgoingRequest =
    asStringArray(currentUser.sentRequests).includes(targetUser.uid) ||
    asStringArray(targetUser.followRequests).includes(currentUser.uid);
  if (outgoingRequest) return 'requested';
  return 'none';
}

export function canMessage(
  currentUser: Pick<UserProfile, 'uid' | 'following' | 'followers'>,
  targetUser: Pick<UserProfile, 'uid' | 'following' | 'followers'>
): boolean {
  return computeFollowStatus(currentUser, targetUser) === 'mutual';
}

export async function sendFollowRequest(
  fromUid: string,
  toUid: string
): Promise<void> {
  if (fromUid === toUid) throw new Error('You cannot follow yourself.');

  const fromRef = doc(db, COLLECTIONS.USERS, fromUid);
  const toRef = doc(db, COLLECTIONS.USERS, toUid);

  await runTransaction(db, async (transaction) => {
    const [fromSnapshot, toSnapshot] = await Promise.all([
      transaction.get(fromRef),
      transaction.get(toRef),
    ]);
    if (!fromSnapshot.exists() || !toSnapshot.exists()) {
      throw new Error('The account you are trying to follow no longer exists.');
    }

    const from = fromSnapshot.data() as FirestoreUserProfile;
    const to = toSnapshot.data() as FirestoreUserProfile;
    const outgoingRequests = asStringArray(from.sentRequests);
    const incomingRequests = asStringArray(to.followRequests);
    const outgoingAlreadyExists =
      outgoingRequests.includes(toUid) && incomingRequests.includes(fromUid);

    if (asStringArray(from.following).includes(toUid)) return;

    const targetFollowsCurrent = asStringArray(to.following).includes(fromUid);
    const reverseRequestExists =
      asStringArray(to.sentRequests).includes(fromUid) &&
      asStringArray(from.followRequests).includes(toUid);

    if (targetFollowsCurrent || reverseRequestExists) {
      const fromUpdates: Record<string, FieldValue> = {
        following: arrayUnion(toUid),
        sentRequests: arrayRemove(toUid),
        followRequests: arrayRemove(toUid),
        updatedAt: serverTimestamp(),
      };
      const toUpdates: Record<string, FieldValue> = {
        followers: arrayUnion(fromUid),
        sentRequests: arrayRemove(fromUid),
        followRequests: arrayRemove(fromUid),
        updatedAt: serverTimestamp(),
      };
      if (reverseRequestExists) {
        fromUpdates.followers = arrayUnion(toUid);
        toUpdates.following = arrayUnion(fromUid);
      }
      transaction.update(fromRef, fromUpdates);
      transaction.update(toRef, toUpdates);
      return;
    }

    if (outgoingAlreadyExists) return;

    transaction.update(fromRef, {
      sentRequests: arrayUnion(toUid),
      updatedAt: serverTimestamp(),
    });
    transaction.update(toRef, {
      followRequests: arrayUnion(fromUid),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function followUser(fromUid: string, toUid: string): Promise<void> {
  if (fromUid === toUid) throw new Error('You cannot follow yourself.');
  const fromRef = doc(db, COLLECTIONS.USERS, fromUid);
  const toRef = doc(db, COLLECTIONS.USERS, toUid);

  await runTransaction(db, async (transaction) => {
    const [fromSnapshot, toSnapshot] = await Promise.all([
      transaction.get(fromRef),
      transaction.get(toRef),
    ]);
    if (!fromSnapshot.exists() || !toSnapshot.exists()) {
      throw new Error('The account you are trying to follow no longer exists.');
    }
    const target = toSnapshot.data() as FirestoreUserProfile;
    const current = fromSnapshot.data() as FirestoreUserProfile;
    if (
      asStringArray(current.following).includes(toUid) &&
      asStringArray(target.followers).includes(fromUid)
    ) return;
    if (
      !asStringArray(target.following).includes(fromUid)
    ) {
      throw new Error('This follow-back is no longer available. Refresh and try again.');
    }

    transaction.update(fromRef, {
      following: arrayUnion(toUid),
      sentRequests: arrayRemove(toUid),
      followRequests: arrayRemove(toUid),
      updatedAt: serverTimestamp(),
    });
    transaction.update(toRef, {
      followers: arrayUnion(fromUid),
      followRequests: arrayRemove(fromUid),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function acceptFollowRequest(
  fromUid: string,
  toUid: string
): Promise<void> {
  if (fromUid === toUid) throw new Error('A follow request cannot come from the same account.');
  const fromRef = doc(db, COLLECTIONS.USERS, fromUid);
  const toRef = doc(db, COLLECTIONS.USERS, toUid);

  await runTransaction(db, async (transaction) => {
    const [fromSnapshot, toSnapshot] = await Promise.all([
      transaction.get(fromRef),
      transaction.get(toRef),
    ]);
    if (!fromSnapshot.exists() || !toSnapshot.exists()) {
      throw new Error('This follow request is no longer available.');
    }

    const from = fromSnapshot.data() as FirestoreUserProfile;
    const to = toSnapshot.data() as FirestoreUserProfile;
    const pending =
      asStringArray(to.followRequests).includes(fromUid) ||
      asStringArray(from.sentRequests).includes(toUid);
    const alreadyAccepted =
      asStringArray(from.following).includes(toUid) &&
      asStringArray(to.followers).includes(fromUid);

    if (alreadyAccepted) return;
    if (!pending) throw new Error('This follow request is no longer pending.');

    // Accepting is deliberately one-directional (Instagram-style): the
    // requester already follows `to`, so we only record them as a follower.
    // `to` does NOT auto-follow back — they press "Follow Back" if they want a
    // mutual relationship, which is what makes the Chat button appear.
    transaction.update(fromRef, {
      following: arrayUnion(toUid),
      sentRequests: arrayRemove(toUid),
      updatedAt: serverTimestamp(),
    });
    transaction.update(toRef, {
      followers: arrayUnion(fromUid),
      followRequests: arrayRemove(fromUid),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function cancelFollowRequest(
  fromUid: string,
  toUid: string
): Promise<void> {
  return rejectFollowRequest(fromUid, toUid);
}

export async function rejectFollowRequest(
  fromUid: string,
  toUid: string
): Promise<void> {
  if (fromUid === toUid) throw new Error('A follow request cannot come from the same account.');
  const fromRef = doc(db, COLLECTIONS.USERS, fromUid);
  const toRef = doc(db, COLLECTIONS.USERS, toUid);

  await runTransaction(db, async (transaction) => {
    const [fromSnapshot, toSnapshot] = await Promise.all([
      transaction.get(fromRef),
      transaction.get(toRef),
    ]);
    if (!fromSnapshot.exists() || !toSnapshot.exists()) {
      throw new Error('This follow request is no longer available.');
    }
    const from = fromSnapshot.data() as FirestoreUserProfile;
    const to = toSnapshot.data() as FirestoreUserProfile;
    if (
      !asStringArray(from.sentRequests).includes(toUid) &&
      !asStringArray(to.followRequests).includes(fromUid)
    ) return;

    transaction.update(fromRef, {
      sentRequests: arrayRemove(toUid),
      updatedAt: serverTimestamp(),
    });
    transaction.update(toRef, {
      followRequests: arrayRemove(fromUid),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function unfollowUser(
  fromUid: string,
  toUid: string
): Promise<void> {
  if (fromUid === toUid) throw new Error('You cannot unfollow yourself.');
  const fromRef = doc(db, COLLECTIONS.USERS, fromUid);
  const toRef = doc(db, COLLECTIONS.USERS, toUid);

  await runTransaction(db, async (transaction) => {
    const [fromSnapshot, toSnapshot] = await Promise.all([
      transaction.get(fromRef),
      transaction.get(toRef),
    ]);
    if (!fromSnapshot.exists() || !toSnapshot.exists()) {
      throw new Error('The account you are trying to unfollow no longer exists.');
    }
    const from = fromSnapshot.data() as FirestoreUserProfile;
    const to = toSnapshot.data() as FirestoreUserProfile;
    if (
      !asStringArray(from.following).includes(toUid) &&
      !asStringArray(from.sentRequests).includes(toUid) &&
      !asStringArray(to.followers).includes(fromUid) &&
      !asStringArray(to.followRequests).includes(fromUid)
    ) return;

    transaction.update(fromRef, {
      following: arrayRemove(toUid),
      sentRequests: arrayRemove(toUid),
      updatedAt: serverTimestamp(),
    });
    transaction.update(toRef, {
      followers: arrayRemove(fromUid),
      followRequests: arrayRemove(fromUid),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function getFollowStatus(
  currentUserId: string,
  targetUserId: string
): Promise<FollowStatus> {
  const [currentUser, targetUser] = await Promise.all([
    getUserProfile(currentUserId),
    getUserProfile(targetUserId),
  ]);

  if (!currentUser || !targetUser) return 'none';
  return computeFollowStatus(currentUser, targetUser);
}

// Get followers list
export async function getFollowers(uid: string): Promise<UserProfile[]> {
  const profile = await getUserProfile(uid);
  if (!profile || profile.followers.length === 0) return [];
  return getUserProfiles(profile.followers);
}

// Get following list
export async function getFollowing(uid: string): Promise<UserProfile[]> {
  const profile = await getUserProfile(uid);
  if (!profile || profile.following.length === 0) return [];
  return getUserProfiles(profile.following);
}

// Get follow requests
export async function getFollowRequests(uid: string): Promise<UserProfile[]> {
  const profile = await getUserProfile(uid);
  if (!profile || profile.followRequests.length === 0) return [];
  return getUserProfiles(profile.followRequests);
}

// ============ CHAT OPERATIONS ============

function docToChat(doc: DocumentSnapshot): Chat | null {
  if (!doc.exists()) return null;
  const data = doc.data() as FirestoreChat;
  return {
    ...data,
    id: doc.id,
    createdAt: data.createdAt?.toDate() || new Date(),
    lastMessageAt: data.lastMessageAt?.toDate() || new Date(),
    lastMessage: data.lastMessage ? {
      ...data.lastMessage,
      createdAt: data.lastMessage.createdAt?.toDate() || new Date(),
      readAt: data.lastMessage.readAt?.toDate() || null,
    } : null,
  };
}

function docToMessage(doc: DocumentSnapshot): Message | null {
  if (!doc.exists()) return null;
  const data = doc.data() as FirestoreMessage;
  return {
    ...data,
    id: doc.id,
    createdAt: data.createdAt?.toDate() || new Date(),
    readAt: data.readAt?.toDate() || null,
  };
}

// Get or create chat between two users
export async function getOrCreateChat(
  userId1: string,
  userId2: string
): Promise<Chat> {
  if (userId1 === userId2) {
    throw new Error('You cannot start a chat with yourself.');
  }

  const participants = [userId1, userId2].sort();
  const chatId = participants.join('_');
  const chatRef = doc(db, COLLECTIONS.CHATS, chatId);
  const userRef1 = doc(db, COLLECTIONS.USERS, userId1);
  const userRef2 = doc(db, COLLECTIONS.USERS, userId2);

  return runTransaction(db, async (transaction) => {
    const chatSnap = await transaction.get(chatRef);

    // Returning an existing conversation is independent of the current follow
    // relationship. Only creation of a new conversation requires mutual follows.
    if (chatSnap.exists()) {
      const existingChat = docToChat(chatSnap);
      if (!existingChat) throw new Error('This conversation could not be loaded.');
      if (!participants.every((uid) => existingChat.participants.includes(uid))) {
        throw new Error('This conversation does not belong to these users.');
      }
      return existingChat;
    }

    const [userSnap1, userSnap2] = await Promise.all([
      transaction.get(userRef1),
      transaction.get(userRef2),
    ]);
    const user1 = docToUserProfile(userSnap1);
    const user2 = docToUserProfile(userSnap2);
    if (!user1 || !user2) {
      throw new Error('One or both users were not found.');
    }
    if (!canMessage(user1, user2)) {
      throw new Error('Follow each other before starting a chat.');
    }

    const newChat: Omit<Chat, 'id'> = {
      participants,
      participantDetails: {
        [userId1]: { displayName: user1.displayName, photoURL: user1.photoURL },
        [userId2]: { displayName: user2.displayName, photoURL: user2.photoURL },
      },
      lastMessage: null,
      lastMessageAt: new Date(),
      unreadCount: { [userId1]: 0, [userId2]: 0 },
      createdAt: new Date(),
    };

    transaction.set(chatRef, {
      ...newChat,
      createdAt: serverTimestamp(),
      lastMessageAt: serverTimestamp(),
    });

    return { id: chatId, ...newChat };
  });
}

// Get user's chats
export async function getUserChats(
  userId: string,
  pageSize: number = 20,
  lastDoc?: QueryDocumentSnapshot
): Promise<{ chats: Chat[]; lastDoc: QueryDocumentSnapshot | null }> {
  const chatsRef = collection(db, COLLECTIONS.CHATS);

  let q = query(
    chatsRef,
    where('participants', 'array-contains', userId),
    orderBy('lastMessageAt', 'desc'),
    limit(pageSize + 1)
  );

  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }

  const snapshot = await getDocs(q);
  const chats = snapshot.docs.map(docToChat).filter(Boolean) as Chat[];

  const hasMore = chats.length > pageSize;
  const results = hasMore ? chats.slice(0, pageSize) : chats;
  const newLastDoc = hasMore ? snapshot.docs[pageSize - 1] : null;

  return { chats: results, lastDoc: newLastDoc };
}

// Subscribe to user's chats
export function subscribeToUserChats(
  userId: string,
  callback: (chats: Chat[]) => void,
  onError?: (error: Error) => void
): () => void {
  const chatsRef = collection(db, COLLECTIONS.CHATS);
  const q = query(
    chatsRef,
    where('participants', 'array-contains', userId),
    orderBy('lastMessageAt', 'desc')
  );

  // NOTE: this query requires the composite index declared in
  // firestore.indexes.json. Without it Firestore rejects the listener with
  // FAILED_PRECONDITION, and an onSnapshot with no error callback fails
  // *silently* — the UI just shows an empty chat list forever.
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snapshot) => {
      const chats = snapshot.docs.map(docToChat).filter(Boolean) as Chat[];
      callback(chats);
    },
    (error) => {
      onError?.(error);
    }
  );
}

// Get chat by ID
export async function getChat(chatId: string): Promise<Chat | null> {
  const chatRef = doc(db, COLLECTIONS.CHATS, chatId);
  const chatSnap = await getDoc(chatRef);
  return docToChat(chatSnap);
}

// Subscribe to single chat
export function subscribeToChat(
  chatId: string,
  callback: (chat: Chat | null) => void
): () => void {
  const chatRef = doc(db, COLLECTIONS.CHATS, chatId);
  return onSnapshot(chatRef, (snap) => {
    callback(docToChat(snap));
  });
}

// ============ MESSAGE OPERATIONS ============

// Send message (local write first — no transaction so it feels instant)
export function createMessageId(chatId: string): string {
  return doc(collection(db, COLLECTIONS.CHATS, chatId, COLLECTIONS.MESSAGES)).id;
}

export async function sendMessage(
  chatId: string,
  senderId: string,
  text: string,
  imageDataUri?: string,
  existingId?: string
): Promise<Message> {
  const messagesRef = collection(db, COLLECTIONS.CHATS, chatId, COLLECTIONS.MESSAGES);
  const chatRef = doc(db, COLLECTIONS.CHATS, chatId);
  const messageRef = existingId ? doc(messagesRef, existingId) : doc(messagesRef);
  const otherUserId = chatId.split('_').find((id) => id !== senderId);
  const createdAt = Timestamp.now();

  const newMessage: Message = {
    id: messageRef.id,
    chatId,
    senderId,
    text,
    imageUrl: imageDataUri || null,
    type: imageDataUri ? 'image' : 'text',
    status: 'sent',
    createdAt: createdAt.toDate(),
    readAt: null,
  };

  const storedMessage = {
    id: messageRef.id,
    chatId,
    senderId,
    text,
    imageUrl: imageDataUri || null,
    type: imageDataUri ? 'image' : 'text',
    status: 'sent',
    createdAt,
    readAt: null,
  };

  await setDoc(messageRef, storedMessage);
  updateDoc(chatRef, {
    lastMessage: storedMessage,
    lastMessageAt: createdAt,
    ...(otherUserId ? { [`unreadCount.${otherUserId}`]: increment(1) } : {}),
  }).catch((error) => {
    console.error('Failed to update chat preview:', error);
  });

  return newMessage;
}

// Get messages for a chat
export async function getMessages(
  chatId: string,
  pageSize: number = 50,
  lastDoc?: QueryDocumentSnapshot
): Promise<{ messages: Message[]; lastDoc: QueryDocumentSnapshot | null }> {
  const messagesRef = collection(db, COLLECTIONS.CHATS, chatId, COLLECTIONS.MESSAGES);

  let q = query(
    messagesRef,
    orderBy('createdAt', 'desc'),
    limit(pageSize + 1)
  );

  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }

  const snapshot = await getDocs(q);
  const messages = snapshot.docs.map(docToMessage).filter(Boolean) as Message[];

  const hasMore = messages.length > pageSize;
  const results = hasMore ? messages.slice(0, pageSize).reverse() : messages.reverse();
  const newLastDoc = hasMore ? snapshot.docs[pageSize - 1] : null;

  return { messages: results, lastDoc: newLastDoc };
}

// ============ MESSAGES ============

/** How many messages the live subscription holds in memory. */
export const MESSAGE_PAGE_SIZE = 50;

/**
 * Subscribe to the *newest* PAGE_SIZE messages of a chat, kept sorted
 * oldest-to-newest for rendering.
 *
 * The ordering here is load-bearing. Querying ascending with a limit would
 * return the OLDEST N messages, so any chat longer than the limit would render
 * its history and never show what was just sent. We therefore query descending
 * to grab the tail, then flip the array back for the list.
 */
export function subscribeToMessages(
  chatId: string,
  callback: (messages: Message[]) => void,
  onError?: (error: Error) => void,
  pageSize: number = MESSAGE_PAGE_SIZE
): () => void {
  const messagesRef = collection(db, COLLECTIONS.CHATS, chatId, COLLECTIONS.MESSAGES);
  const q = query(
    messagesRef,
    orderBy('createdAt', 'desc'),
    limit(pageSize)
  );

  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snapshot) => {
      const messages = snapshot.docs
        .map(docToMessage)
        .filter(Boolean)
        .reverse() as Message[];
      callback(messages);
    },
    (error) => {
      onError?.(error);
    }
  );
}

/**
 * Fetch one page of messages older than `before`.
 *
 * Paging is cursor-based on the createdAt timestamp rather than offset-based:
 * offsets get slower the deeper you go and shift under you whenever a message
 * with an identical timestamp lands in the middle of the page.
 *
 * Takes and returns plain Dates so callers never handle Firestore Timestamps;
 * the conversion happens here.
 *
 * Returns the messages already in render order (oldest first), the createdAt of
 * the oldest message returned (pass back as `before` next time), and whether
 * another page exists.
 */
export async function loadOlderMessages(
  chatId: string,
  before: Date | null,
  pageSize: number = MESSAGE_PAGE_SIZE
): Promise<{ messages: Message[]; oldest: Date | null; hasMore: boolean }> {
  const messagesRef = collection(db, COLLECTIONS.CHATS, chatId, COLLECTIONS.MESSAGES);

  // Ask for one extra to detect whether more history exists, then drop it.
  // endBefore is the cursor meaning "strictly older than" in a descending query
  // — Firestore has no startBefore.
  let q = query(messagesRef, orderBy('createdAt', 'desc'), limit(pageSize + 1));
  if (before) {
    q = query(q, endBefore(Timestamp.fromDate(before)));
  }

  const snapshot = await getDocs(q);
  const hasMore = snapshot.docs.length > pageSize;
  const page = snapshot.docs.slice(0, pageSize);

  const messages = page.map(docToMessage).filter(Boolean).reverse() as Message[];

  const oldestRaw = page.length > 0 ? page[page.length - 1].data().createdAt : null;
  const oldest = oldestRaw?.toDate?.() ?? null;

  return { messages, oldest, hasMore };
}

export async function markMessagesAsRead(
  chatId: string,
  userId: string,
  incoming: Message[] = []
): Promise<void> {
  const chatRef = doc(db, COLLECTIONS.CHATS, chatId);
  const unreadIncoming = incoming.filter(
    (message) => message.senderId !== userId && message.status !== 'read'
  );

  const batch = writeBatch(db);
  batch.update(chatRef, { [`unreadCount.${userId}`]: 0 });

  unreadIncoming.slice(0, 400).forEach((message) => {
    const messageRef = doc(db, COLLECTIONS.CHATS, chatId, COLLECTIONS.MESSAGES, message.id);
    batch.update(messageRef, {
      status: 'read',
      readAt: serverTimestamp(),
    });
  });

  await batch.commit();
}

// ============ NOTIFICATION OPERATIONS ============

function docToNotification(doc: DocumentSnapshot): Notification | null {
  if (!doc.exists()) return null;
  const data = doc.data() as FirestoreNotification;
  return {
    ...data,
    id: doc.id,
    createdAt: data.createdAt?.toDate() || new Date(),
  };
}

// Create notification
export async function createNotification(
  userId: string,
  type: Notification['type'],
  title: string,
  body: string,
  data: Notification['data']
): Promise<string> {
  const notificationsRef = collection(db, COLLECTIONS.NOTIFICATIONS);
  const notificationRef = doc(notificationsRef);

  await setDoc(notificationRef, {
    id: notificationRef.id,
    userId,
    type,
    title,
    body,
    data: {
      fromUserId: data.fromUserId,
      chatId: data.chatId ?? null,
    },
    read: false,
    createdAt: serverTimestamp(),
  });

  return notificationRef.id;
}

// Get user notifications
export async function getUserNotifications(
  userId: string,
  pageSize: number = 20,
  lastDoc?: QueryDocumentSnapshot
): Promise<{ notifications: Notification[]; lastDoc: QueryDocumentSnapshot | null }> {
  const notificationsRef = collection(db, COLLECTIONS.NOTIFICATIONS);

  let q = query(
    notificationsRef,
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(pageSize + 1)
  );

  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }

  const snapshot = await getDocs(q);
  const notifications = snapshot.docs.map(docToNotification).filter(Boolean) as Notification[];

  const hasMore = notifications.length > pageSize;
  const results = hasMore ? notifications.slice(0, pageSize) : notifications;
  const newLastDoc = hasMore ? snapshot.docs[pageSize - 1] : null;

  return { notifications: results, lastDoc: newLastDoc };
}

// Subscribe to user notifications
export function subscribeToUserNotifications(
  userId: string,
  callback: (notifications: Notification[]) => void,
  onError?: (error: Error) => void
): () => void {
  const notificationsRef = collection(db, COLLECTIONS.NOTIFICATIONS);
  const q = query(
    notificationsRef,
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const notifications = snapshot.docs.map(docToNotification).filter(Boolean) as Notification[];
      callback(notifications);
    },
    (error) => {
      onError?.(error);
    }
  );
}

// Mark notification as read
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const notificationRef = doc(db, COLLECTIONS.NOTIFICATIONS, notificationId);
  await updateDoc(notificationRef, { read: true });
}

// Mark all notifications as read
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  const notificationsRef = collection(db, COLLECTIONS.NOTIFICATIONS);
  const q = query(
    notificationsRef,
    where('userId', '==', userId),
    where('read', '==', false)
  );

  const snapshot = await getDocs(q);
  const batch = writeBatch(db);

  snapshot.docs.forEach(doc => {
    batch.update(doc.ref, { read: true });
  });

  await batch.commit();
}

// Get unread notification count
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const notificationsRef = collection(db, COLLECTIONS.NOTIFICATIONS);
  const q = query(
    notificationsRef,
    where('userId', '==', userId),
    where('read', '==', false)
  );

  const snapshot = await getDocs(q);
  return snapshot.size;
}