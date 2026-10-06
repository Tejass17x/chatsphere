// Presence Context
//
// Responsibilities are split deliberately:
//   - PresenceProvider heartbeats the *current* user's online flag and clears it
//     when the app backgrounds.
//   - useUserPresence(uid) subscribes to *another* user's presence for exactly
//     as long as the calling component is mounted.
//
// Each call site owns one listener and tears it down on unmount, so there is no
// shared cache to keep in sync and no chance of leaking a stale "online" dot.

import React, { useEffect, useState, ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { setPresence, subscribeToPresence, PresenceState } from '@/services/presence';

const OFFLINE: PresenceState = { online: false, lastSeen: null };

/** How often we refresh lastActive while foregrounded. Presence elsewhere is
 *  considered stale after PRESENCE_TTL_MS, so this stays comfortably below it. */
const HEARTBEAT_MS = 45_000;

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid ?? null;

  useEffect(() => {
    if (!uid) return;

    const goOnline = () => {
      void setPresence(uid, true);
    };
    const goOffline = () => {
      void setPresence(uid, false);
    };

    goOnline();
    const interval = setInterval(goOnline, HEARTBEAT_MS);

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      // Backgrounding is the strongest signal we get that the user stepped away.
      if (state === 'active') goOnline();
      else goOffline();
    });

    return () => {
      clearInterval(interval);
      sub.remove();
      // Best-effort, so others don't see a stale "online" until the TTL lapses.
      goOffline();
    };
  }, [uid]);

  return <>{children}</>;
}

/** Live presence for a single user. Pass the current uid only if you want a
 *  dot on yourself; for chat headers pass the *partner's* uid. */
export function useUserPresence(uid: string | null | undefined): PresenceState {
  const [state, setState] = useState<PresenceState>(OFFLINE);

  useEffect(() => {
    if (!uid) {
      setState(OFFLINE);
      return;
    }
    return subscribeToPresence(uid, setState);
  }, [uid]);

  return state;
}

/** The current user's own presence — mostly useful for debugging and for
 *  gating the "typing…" affordance on your own messages. */
export function useMyPresence(): PresenceState {
  const { firebaseUser } = useAuth();
  return useUserPresence(firebaseUser?.uid);
}

export type { PresenceState };
export default PresenceProvider;