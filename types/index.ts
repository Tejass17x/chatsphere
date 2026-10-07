// Core TypeScript types for the chat application

import type {
  StyleProp,
  TextInputProps,
  TextStyle,
  TouchableOpacityProps,
  ViewStyle,
} from 'react-native';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  bio: string;
  followers: string[];
  following: string[];
  followRequests: string[];
  sentRequests: string[];
  createdAt: Date;
  updatedAt: Date;
  lastActive: Date;
  fcmToken: string | null;
  /** Live presence flag, heartbeated by the client. Optional so documents
   *  written before this feature still parse. */
  online?: boolean;
}

export type FollowStatus =
  | 'none'
  | 'requested'
  | 'incoming'
  | 'following'
  | 'follower'
  | 'mutual';

export interface Chat {
  id: string;
  participants: string[];
  participantDetails: {
    [uid: string]: {
      displayName: string;
      photoURL: string | null;
    };
  };
  lastMessage: Message | null;
  lastMessageAt: Date;
  unreadCount: { [uid: string]: number };
  createdAt: Date;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  imageUrl: string | null;
  type: 'text' | 'image';
  status: 'sent' | 'delivered' | 'read';
  createdAt: Date;
  readAt: Date | null;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'follow_request' | 'follow_accepted' | 'new_message';
  title: string;
  body: string;
  data: {
    fromUserId: string;
    chatId?: string;
    messageId?: string;
  };
  read: boolean;
  createdAt: Date;
}

// Auth related types
export interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData extends LoginCredentials {
  displayName: string;
}

// Navigation types
export type RootStackParamList = {
  '(auth)': undefined;
  '(tabs)': undefined;
  'chat/[chatId]': { chatId: string };
  'notifications': undefined;
  '+not-found': undefined;
};

export type AuthStackParamList = {
  'login': undefined;
  'register': undefined;
};

export type TabsParamList = {
  'chats': undefined;
  'search': undefined;
  'profile': undefined;
};

// UI Component props
export type ButtonProps = {
  title?: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
} & Omit<TouchableOpacityProps, 'style' | 'children' | 'onPress'>;

export type InputProps = {
  label?: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  error?: string;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: string;
  textContentType?: TextInputProps['textContentType'];
  returnKeyType?: 'done' | 'next' | 'go' | 'search' | 'send';
  onSubmitEditing?: () => void;
  multiline?: boolean;
  numberOfLines?: number;
  maxLength?: number;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
} & Omit<TextInputProps, 'style' | 'onChangeText' | 'placeholder'>;


export interface AvatarProps {
  source?: { uri: string } | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  onPress?: () => void;
  editable?: boolean;
  /** When set, the avatar subscribes to this user's presence and shows a
   *  green dot while they are online. Omit to skip the subscription entirely. */
  presenceUid?: string | null;
  style?: StyleProp<ViewStyle>;
}

export interface BadgeProps {
  count: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  style?: StyleProp<ViewStyle>;
}

// Firestore converters
export type FirestoreUserProfile = Omit<UserProfile, 'createdAt' | 'updatedAt' | 'lastActive'> & {
  createdAt: any; // Firestore Timestamp
  updatedAt: any;
  lastActive: any;
};

export type FirestoreChat = Omit<Chat, 'createdAt' | 'lastMessageAt'> & {
  createdAt: any;
  lastMessageAt: any;
  lastMessage: FirestoreMessage | null;
};

export type FirestoreMessage = Omit<Message, 'createdAt' | 'readAt'> & {
  createdAt: any;
  readAt: any | null;
};

export type FirestoreNotification = Omit<Notification, 'createdAt'> & {
  createdAt: any;
};