// App constants and configuration

export const APP_NAME = 'ChatSphere';
export const APP_SCHEME = 'chatapp';

// Firestore collection names
export const COLLECTIONS = {
  USERS: 'users',
  CHATS: 'chats',
  MESSAGES: 'messages',
  NOTIFICATIONS: 'notifications',
} as const;

// Pagination
export const PAGINATION = {
  CHATS_PER_PAGE: 20,
  MESSAGES_PER_PAGE: 50,
  USERS_PER_PAGE: 20,
} as const;

// UI Constants
export const AVATAR_SIZES = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const BORDER_RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

// Colors (will be extended with theme)
export const COLORS = {
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  primaryLight: '#EEF2FF',
  secondary: '#EC4899',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',

  background: '#FFFFFF',
  surface: '#F9FAFB',
  surfaceVariant: '#F3F4F6',

  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textInverse: '#FFFFFF',

  border: '#E5E7EB',
  borderFocus: '#6366F1',

  overlay: 'rgba(0, 0, 0, 0.5)',
  shadow: 'rgba(0, 0, 0, 0.1)',
} as const;

// Animation durations
export const ANIMATION = {
  fast: 150,
  normal: 250,
  slow: 350,
} as const;

// Regex patterns
export const PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  password: /^.{6,}$/, // Minimum 6 characters
  displayName: /^.{2,30}$/,
} as const;

// Error messages
export const ERROR_MESSAGES = {
  auth: {
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
  },
  generic: {
    required: 'This field is required.',
    invalidEmail: 'Please enter a valid email address.',
    passwordTooShort: 'Password must be at least 6 characters.',
    namesDontMatch: 'Passwords do not match.',
  },
} as const;

// Success messages
export const SUCCESS_MESSAGES = {
  registration: 'Account created successfully!',
  login: 'Welcome back!',
  profileUpdated: 'Profile updated successfully.',
  imageUploaded: 'Image uploaded successfully.',
  followRequestSent: 'Follow request sent.',
  followRequestAccepted: 'You are now following each other!',
  followRequestRejected: 'Follow request declined.',
  unfollowed: 'You unfollowed this user.',
} as const;