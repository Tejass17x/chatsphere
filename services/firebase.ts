// Firebase configuration and initialization

import { initializeApp, getApps, getApp, FirebaseApp, FirebaseError } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  Auth,
} from 'firebase/auth';
import { getReactNativePersistence } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  Firestore,
} from 'firebase/firestore';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase config from environment variables
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Validate config
const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'messagingSenderId', 'appId'];
const missingKeys = requiredKeys.filter(key => !firebaseConfig[key as keyof typeof firebaseConfig]);

// Initialize Firebase app (singleton)
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    if (missingKeys.length > 0) {
      throw new Error(
        `Missing Firebase config values: ${missingKeys.join(', ')}. ` +
        'Set the EXPO_PUBLIC_FIREBASE_* values in .env and restart Expo.'
      );
    }
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    const firebaseApp = getFirebaseApp();
    if (Platform.OS === 'web') {
      auth = getAuth(firebaseApp);
    } else {
      try {
        auth = initializeAuth(firebaseApp, {
          persistence: getReactNativePersistence(AsyncStorage),
        });
      } catch (error) {
        // Fast refresh can re-evaluate this module while Auth remains initialized.
        if (!(error instanceof FirebaseError) || error.code !== 'auth/already-initialized') {
          throw error;
        }
        auth = getAuth(firebaseApp);
      }
    }
  }
  return auth;
}

export function getFirestoreDb(): Firestore {
  if (!db) {
    const firebaseApp = getFirebaseApp();
    try {
      db = initializeFirestore(firebaseApp, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      });
    } catch {
      db = getFirestore(firebaseApp);
    }
  }
  return db;
}

// Initialize on module load
getFirebaseApp();
getFirebaseAuth();
getFirestoreDb();

// Export initialized instances
export { app, auth, db };

// Helper to check if Firebase is properly configured
export function isFirebaseConfigured(): boolean {
  return missingKeys.length === 0;
}