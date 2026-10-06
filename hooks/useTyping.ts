// useTyping
//
// Owns the whole typing-indicator lifecycle for one chat so screens don't have
// to think about it:
//
//   outbound  throttle the write to one per TYPING_THROTTLE_MS, clear the flag
//             when the input empties, on send, and on unmount
//   inbound   subscribe to who is typing, drop stale entries, and expire the
//             flag if the clearing write never arrives
//
// The inbound expiry matters: if the other app is killed mid-keystroke the
// delete never fires and the indicator would otherwise stick forever.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  subscribeToTyping,
  createTypingSignal,
  TYPING_TTL_MS,
} from '@/services/presence';

export function useTyping(chatId: string | undefined, uid: string | undefined) {
  const [typingUids, setTypingUids] = useState<string[]>([]);
  const signalRef = useRef<ReturnType<typeof createTypingSignal> | null>(null);

  // Outbound: one signal object per (chat, user) pair.
  useEffect(() => {
    if (!chatId || !uid) return;
    const signal = createTypingSignal(chatId, uid);
    signalRef.current = signal;
    return () => {
      // Close over the signal rather than reading the ref, so a re-run of
      // this effect can't dispose the newer signal instead of this one.
      signal.dispose();
      signalRef.current = null;
    };
  }, [chatId, uid]);

  // Inbound.
  useEffect(() => {
    if (!chatId || !uid) return;
    const unsubscribe = subscribeToTyping(chatId, uid, setTypingUids);
    return unsubscribe;
  }, [chatId, uid]);

  // Belt-and-braces expiry. subscribeToTyping filters stale documents, but
  // only re-evaluates when the snapshot changes; if the other side dies without
  // a delete, we need a local timer to clear the flag.
  const hasTyping = typingUids.length > 0;
  useEffect(() => {
    if (!hasTyping) return;
    const timer = setTimeout(() => setTypingUids([]), TYPING_TTL_MS);
    return () => clearTimeout(timer);
  }, [hasTyping, typingUids]);

  /** Safe to call on every keystroke. Pass false when the input empties so the
   *  flag clears instead of lingering until the TTL lapses. */
  const notifyTyping = useCallback((isTyping: boolean) => {
    const signal = signalRef.current;
    if (!signal) return;
    if (isTyping) signal.started();
    else signal.stopped();
  }, []);

  return { typingUids, isPartnerTyping: hasTyping, notifyTyping };
}