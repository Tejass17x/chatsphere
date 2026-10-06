// Auth Context Provider

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile as updateFirebaseProfile,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth, db } from '@/services/firebase';
import {
  doc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { COLLECTIONS } from '@/utils/constants';
import { UserProfile } from '@/types';
import { getFirebaseErrorMessage } from '@/utils/firebaseErrors';
import { subscribeToUserProfile } from '@/services/firestore';

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  patchUser: (partial: Partial<UserProfile>) => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUserProfile = useCallback(async (uid: string) => {
    const { getDoc } = await import('firebase/firestore');
    const userRef = doc(db, COLLECTIONS.USERS, uid);
    let snap = await getDoc(userRef);

    if (!snap.exists()) {
      const currentUser = auth.currentUser;
      if (!currentUser || currentUser.uid !== uid || !currentUser.email) {
        throw new Error('Your account profile could not be found. Please sign in again.');
      }

      await setDoc(userRef, {
        uid,
        email: currentUser.email,
        displayName: currentUser.displayName || currentUser.email.split('@')[0],
        photoURL: currentUser.photoURL || null,
        bio: '',
        followers: [],
        following: [],
        followRequests: [],
        sentRequests: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastActive: serverTimestamp(),
        fcmToken: null,
      });
      snap = await getDoc(userRef);
    }

    if (!snap.exists()) {
      throw new Error('Your account profile could not be loaded. Please try again.');
    }

    const data = snap.data();
    const profile: UserProfile = {
      uid,
      email: data.email,
      displayName: data.displayName,
      photoURL: data.photoURL ?? null,
      bio: data.bio ?? '',
      followers: data.followers ?? [],
      following: data.following ?? [],
      followRequests: data.followRequests ?? [],
      sentRequests: data.sentRequests ?? [],
      createdAt: data.createdAt?.toDate?.() ?? new Date(),
      updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
      lastActive: data.lastActive?.toDate?.() ?? new Date(),
      fcmToken: data.fcmToken ?? null,
    };

    setUser(profile);
    setError(null);
    return profile;
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (!fbUser) {
        setUser(null);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!firebaseUser) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    const unsubscribe = subscribeToUserProfile(
      firebaseUser.uid,
      async (profile) => {
        if (cancelled) return;
        if (profile) {
          setUser(profile);
          setError(null);
          setLoading(false);
          return;
        }

        try {
          await loadUserProfile(firebaseUser.uid);
        } catch (err) {
          if (!cancelled) {
            setUser(null);
            setError(getFirebaseErrorMessage(err, 'Failed to load account profile.'));
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      },
      (err) => {
        if (cancelled) return;
        setError(getFirebaseErrorMessage(err, 'Failed to load account profile.'));
        setLoading(false);
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [firebaseUser, loadUserProfile]);

  const clearError = useCallback(() => setError(null), []);

  const login = async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      await loadUserProfile(credential.user.uid);
    } catch (err: unknown) {
      setError(getFirebaseErrorMessage(err, 'Login failed.'));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string, displayName: string) => {
    setError(null);
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      await updateFirebaseProfile(userCredential.user, { displayName });

      const userRef = doc(db, COLLECTIONS.USERS, userCredential.user.uid);
      await setDoc(
        userRef,
        {
          uid: userCredential.user.uid,
          email: normalizedEmail,
          displayName: displayName.trim(),
          photoURL: null,
          bio: '',
          followers: [],
          following: [],
          followRequests: [],
          sentRequests: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastActive: serverTimestamp(),
          fcmToken: null,
        },
        { merge: true }
      );
      await loadUserProfile(userCredential.user.uid);
    } catch (err: unknown) {
      setError(getFirebaseErrorMessage(err, 'Registration failed.'));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setError(null);
    setLoading(true);
    try {
      await signOut(auth);
      // State is cleared by the onAuthStateChanged listener above, which always
      // fires after signOut resolves. Clearing it here too would race with that
      // listener and can leave a stale user behind.
      setUser(null);
      setFirebaseUser(null);
    } catch (err: unknown) {
      setError(getFirebaseErrorMessage(err, 'Logout failed.'));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err: unknown) {
      setError(getFirebaseErrorMessage(err, 'Password reset failed.'));
      throw err;
    }
  };

  const refreshProfile = async () => {
    if (firebaseUser) {
      await loadUserProfile(firebaseUser.uid);
    }
  };

  const patchUser = useCallback((partial: Partial<UserProfile>) => {
    setUser((prev) => (prev ? { ...prev, ...partial, updatedAt: new Date() } : prev));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        error,
        login,
        register,
        logout,
        resetPassword,
        refreshProfile,
        patchUser,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}