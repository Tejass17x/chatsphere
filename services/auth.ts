// Authentication service

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  User as FirebaseUser,
  onAuthStateChanged,
  UserCredential,
} from 'firebase/auth';
import { auth } from './firebase';
import { UserProfile, LoginCredentials, RegisterData } from '@/types';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { COLLECTIONS } from '@/utils/constants';

// Convert Firebase user to our UserProfile
export async function createUserProfile(
  firebaseUser: FirebaseUser,
  displayName: string
): Promise<UserProfile> {
  const userProfile: Omit<UserProfile, 'uid'> = {
    email: firebaseUser.email!,
    displayName,
    photoURL: null,
    bio: '',
    followers: [],
    following: [],
    followRequests: [],
    sentRequests: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    lastActive: new Date(),
    fcmToken: null,
  };

  const userRef = doc(db, COLLECTIONS.USERS, firebaseUser.uid);
  await setDoc(userRef, {
    ...userProfile,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastActive: serverTimestamp(),
  });

  return { uid: firebaseUser.uid, ...userProfile };
}

// Register new user
export async function registerUser(data: RegisterData): Promise<UserCredential> {
  const userCredential = await createUserWithEmailAndPassword(
    auth,
    data.email,
    data.password
  );

  // Update display name in Firebase Auth
  await updateProfile(userCredential.user, {
    displayName: data.displayName,
  });

  // Create user profile in Firestore
  await createUserProfile(userCredential.user, data.displayName);

  return userCredential;
}

// Login user
export async function loginUser(credentials: LoginCredentials): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, credentials.email, credentials.password);
}

// Logout user
export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

// Send password reset email
export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

// Get current user profile from Firestore
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const userRef = doc(db, COLLECTIONS.USERS, uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    return null;
  }

  const data = userSnap.data();
  return {
    uid,
    ...data,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
    lastActive: data.lastActive?.toDate() || new Date(),
  } as UserProfile;
}

// Update user profile
export async function updateUserProfile(
  uid: string,
  updates: Partial<UserProfile>
): Promise<void> {
  const userRef = doc(db, COLLECTIONS.USERS, uid);
  await setDoc(userRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  const current = auth.currentUser;
  if (current && current.uid === uid && updates.displayName) {
    await updateProfile(current, { displayName: updates.displayName });
  }
}

// Update last active timestamp
export async function updateLastActive(uid: string): Promise<void> {
  const userRef = doc(db, COLLECTIONS.USERS, uid);
  await setDoc(userRef, {
    lastActive: serverTimestamp(),
  }, { merge: true });
}

// Update FCM token
export async function updateFCMToken(uid: string, token: string): Promise<void> {
  const userRef = doc(db, COLLECTIONS.USERS, uid);
  await setDoc(userRef, {
    fcmToken: token,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// Auth state listener
export function onAuthStateChange(
  callback: (user: FirebaseUser | null) => void
): () => void {
  return onAuthStateChanged(auth, callback);
}

// Get current Firebase user
export function getCurrentUser(): FirebaseUser | null {
  return auth.currentUser;
}
