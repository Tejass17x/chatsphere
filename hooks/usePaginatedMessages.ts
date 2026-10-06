// usePaginatedMessages
//
// Merges two sources into one chronologically-ordered list:
//
//   live tail   subscribeToMessages() holds the newest MESSAGE_PAGE_SIZE
//               messages and keeps them live
//   history     loadOlderMessages() walks backwards through the cursor on
//               demand when the user scrolls to the top
//
// The two are merged rather than kept as separate arrays because read receipts
// and status changes can land on messages in *either* set, and a message that
// ages out of the live tail must keep its already-loaded history entry instead
// of vanishing and reappearing.
//
// Ordering uses createdAt, then id as a tie-break. Several messages can share a
// millisecond timestamp (notably optimistic sends), and without a stable
// tie-break the list would reshuffle on every snapshot.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  subscribeToMessages,
  loadOlderMessages,
  MESSAGE_PAGE_SIZE,
} from '@/services/firestore';
import { Message } from '@/types';

function compare(a: Message, b: Message): number {
  const diff = a.createdAt.getTime() - b.createdAt.getTime();
  if (diff !== 0) return diff;
  // Stable tie-break so equal timestamps never reorder between renders.
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function usePaginatedMessages(chatId: string | undefined, enabled: boolean) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // State, not a ref: the screen reads this to decide whether to keep
  // attaching onEndReached, so it has to trigger a render when it flips.
  const [hasMore, setHasMore] = useState(true);

  // Cursor for the oldest message currently held. Lives in a ref because it
  // is only ever read inside loadOlder and must not itself trigger re-renders.
  const cursorRef = useRef<Date | null>(null);
  // Guards against overlapping loads when the user flicks past the top twice
  // before the first page resolves.
  const loadingRef = useRef(false);

  useEffect(() => {
    if (!chatId || !enabled) return;

    cursorRef.current = null;
    setHasMore(true);
    setMessages([]);

    return subscribeToMessages(
      chatId,
      (live) => {
        setMessages((prev) => {
          if (prev.length === 0) {
            cursorRef.current = live.length > 0 ? live[0].createdAt : null;
            return live;
          }

          const merged = new Map<string, Message>();
          // Older entries first so the live snapshot wins on status/readAt
          // conflicts — it is the fresher read of the same message.
          for (const message of prev) merged.set(message.id, message);
          for (const message of live) merged.set(message.id, message);

          return Array.from(merged.values()).sort(compare);
        });
        setError(null);
      },
      (err) => {
        console.error('messages subscription failed', err);
        setError('Messages failed to load. Pull to refresh.');
      },
      MESSAGE_PAGE_SIZE
    );
  }, [chatId, enabled]);

  const loadOlder = useCallback(async () => {
    if (!chatId || loadingRef.current) return;
    loadingRef.current = true;
    setLoadingOlder(true);
    try {
      const page = await loadOlderMessages(chatId, cursorRef.current, MESSAGE_PAGE_SIZE);
      setHasMore(page.hasMore);
      if (page.messages.length > 0) {
        cursorRef.current = page.oldest;
        setMessages((prev) => {
          const merged = new Map<string, Message>();
          for (const message of page.messages) merged.set(message.id, message);
          for (const message of prev) merged.set(message.id, message);
          return Array.from(merged.values()).sort(compare);
        });
      } else {
        // An empty page means we've reached the beginning of the chat.
        setHasMore(false);
      }
      setError(null);
    } catch (err) {
      console.error('loadOlderMessages failed', err);
      setError('Could not load earlier messages.');
    } finally {
      loadingRef.current = false;
      setLoadingOlder(false);
    }
  }, [chatId]);

  return { messages, loadingOlder, hasMore, error, loadOlder };
}

export default usePaginatedMessages;