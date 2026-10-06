const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/invalid-login-credentials': 'Email or password is incorrect.',
  'auth/user-not-found': 'No account exists for this email. Create an account first.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/email-already-in-use': 'An account already exists for this email. Sign in instead.',
  'auth/weak-password': 'Choose a password with at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
  'auth/network-request-failed': 'Could not reach Firebase. Check your internet connection.',
  'auth/operation-not-allowed': 'Email/password sign-in is disabled. Enable it in Firebase Authentication settings.',
  'auth/invalid-api-key': 'Firebase rejected the API key. Check the Firebase values in .env.',
  'auth/app-not-authorized': 'This app is not authorized for the Firebase project. Check its registered app and authorized domains.',
  'permission-denied': 'Firestore denied access. Publish the current firestore.rules to this Firebase project.',
  'unavailable': 'Firebase is temporarily unreachable. Check your connection and try again.',
};

export function getFirebaseErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== 'object' || error === null) return fallback;

  const firebaseError = error as { code?: unknown; message?: unknown };
  const code = typeof firebaseError.code === 'string' ? firebaseError.code : '';
  if (code && AUTH_ERROR_MESSAGES[code]) return AUTH_ERROR_MESSAGES[code];

  if (typeof firebaseError.message === 'string' && firebaseError.message.length > 0) {
    return firebaseError.message;
  }

  return fallback;
}
