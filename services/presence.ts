// Real-time presence & typing indicators
//
// Both features live in subcollections under a chat document so Firestore
// security rules can scope them to chat participants:
//
//   chats/{chatId}/typing/{uid}      -> { uid, at }
//   chats/{chatId}/presence/{uid}    -> { uid, online, lastSeen }
//
// Writes are throttled: presence flips at most every few seconds and typing is
// only re-stamped when the "is typing" state actually changes, so a fast
// typist does not generate hundreds of writes.

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { COLLECTIONS } from '@/utils/constants';

// ─────────────────────────── TYPING ───────────────────────────

/** A typing flag older than this is treated as stale even if the
 *  clearing write never arrived (app killed mid-keystroke). */
export const TYPING_TTL_MS = 6000;

/** Fire at most one write per this many ms while continuously typing. */
const TYPING_THROTTLE_MS = 2500;

export interface TypingUser {
  uid: string;
}

export async function setTyping(chatId: string, uid: string, isTyping: boolean): Promise<void> {
  if (!chatId || !uid) return;
  const ref = doc(db, COLLECTIONS.CHATS, chatId, 'typing', uid);
  try {
    if (isTyping) {
      await setDoc(ref, { uid, at: serverTimestamp() }, { merge: true });
    } else {
      await deleteDoc(ref);
    }
  } catch (error) {
    // Typing hints are best-effort. A failure here must never surface as a
    // user-facing error or block sending a message.
    console.warn('typing update failed', error);
  }
}

/**
 * Subscribe to who is currently typing in a chat.
 * Automatically filters out stale entries and the current user.
 */
export function subscribeToTyping(
  chatId: string,
  currentUid: string,
  callback: (typingUids: string[]) => void
): () => void {
  if (!chatId || !currentUid) return () => {};

  const typingRef = collection(db, COLLECTIONS.CHATS, chatId, 'typing');

  return onSnapshot(
    typingRef,
    (snapshot) => {
      const now = Date.now();
      const active = snapshot.docs
        .map((d) => d.data() as { uid?: string; at?: Timestamp | null })
        .filter((data) => {
          if (!data.uid || data.uid === currentUid) return false;
          // Drop entries whose TTL expired — the sender may have been killed
          // before it could clear the flag.
          const at = data.at?.toMillis?.() ?? null;
          return at !== null && now - at < TYPING_TTL_MS;
        })
        .map((data) => data.uid as string);

      callback(active);
    },
    (error) => {
      console.warn('typing subscription failed', error);
      callback([]);
    }
  );
}

/**
 * Throttled "user started typing" marker. Returns a stop function that
 * clears the flag. Safe to call on every keystroke.
 */
export function createTypingSignal(chatId: string, uid: string) {
  let lastWrite = 0;
  let stopped = false;

  const write = async (isTyping: boolean) => {
    const now = Date.now();
    if (!stopped && (isTyping ? now - lastWrite >= TYPING_THROTTLE_MS : true)) {
      lastWrite = now;
      await setTyping(chatId, uid, isTyping);
    }
  };

  return {
    started: () => write(true),
    stopped: () => write(false),
    dispose: () => {
      stopped = true;
      void setTyping(chatId, uid, false);
    },
  };
}

// ─────────────────────────── PRESENCE ───────────────────────────

/** Presence is "online" if seen within this window. */
export const PRESENCE_TTL_MS = 90_000;

/** Throttle presence writes so reconnects don't spam the collection. */
const PRESENCE_THROTTLE_MS = 15_000;

export interface PresenceState {
  online: boolean;
  lastSeen: Date | null;
}

export function isOnline(lastSeen: Date | null): boolean {
  if (!lastSeen) return false;
  return Date.now() - lastSeen.getTime() < PRESENCE_TTL_MS;
}

export async function setPresence(uid: string, online: boolean): Promise<void> {
  if (!uid) return;
  try {
    // Written to the user document (not a chat subcollection) so presence is
    // readable from anywhere — search results, chat headers, profile.
    // `lastActive` is reused as the heartbeat timestamp because it is already
    // part of the validated user schema in firestore.rules.
    await setDoc(
      doc(db, COLLECTIONS.USERS, uid),
      { online, lastActive: serverTimestamp() },
      { merge: true }
    );
  } catch (error) {
    console.warn('presence update failed', error);
  }
}

/** Subscribe to a chat partner's presence. Returns a live-updating snapshot. */
export function subscribeToPresence(
  uid: string,
  callback: (state: PresenceState) => void
): () => void {
  if (!uid) return () => {};

  return onSnapshot(
    doc(db, COLLECTIONS.USERS, uid),
    (snap: DocumentSnapshot) => {
      const data = snap.data() as { online?: boolean; lastActive?: Timestamp | null } | undefined;
      const lastSeen = data?.lastActive?.toDate?.() ?? null;
      // Prefer the explicit flag, but fall back to the timestamp so users
      // whose last write predates this feature still show as online.
      const online = data?.online ?? isOnline(lastSeen);
      callback({ online, lastSeen });
    },
    (error) => {
      console.warn('presence subscription failed', error);
      callback({ online: false, lastSeen: null });
    }
  );
}

/**
 * Keeps the current user's presence fresh while the app is foregrounded and
 * marks them offline on background. Lives in contexts/PresenceContext so this
 * module stays free of React.
 */
export const PRESENCE_HEARTBEAT_MS = PRESENCE_THROTTLE_MS;