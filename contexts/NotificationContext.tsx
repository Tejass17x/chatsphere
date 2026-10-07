// Notifications Context - real-time notification state + badge count

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  subscribeToUserNotifications,
  createNotification,
} from '@/services/firestore';
import { Notification } from '@/types';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  refresh: () => void;
  markAsRead: (notificationId: string) => Promise<void>;
  notifyFollowRequest: (toUid: string, fromName: string) => Promise<void>;
  notifyFollowAccepted: (toUid: string, fromName: string) => Promise<void>;
  notifyNewMessage: (
    toUid: string,
    fromName: string,
    chatId: string,
    messageId: string
  ) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { firebaseUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUser) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToUserNotifications(firebaseUser.uid, (items) => {
      setNotifications(items);
      setLoading(false);
    });

    return unsubscribe;
  }, [firebaseUser]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const refresh = useCallback(() => {
    // The real-time subscription handles refresh automatically
  }, []);

  const markAsRead = async (notificationId: string) => {
    const { markNotificationAsRead } = await import('@/services/firestore');
    await markNotificationAsRead(notificationId);
  };

  const notifyFollowRequest = async (toUid: string, fromName: string) => {
    await createNotification(
      toUid,
      'follow_request',
      'New Follow Request',
      `${fromName} wants to follow you`,
      { fromUserId: firebaseUser?.uid || '' }
    );
  };

  const notifyFollowAccepted = async (toUid: string, fromName: string) => {
    await createNotification(
      toUid,
      'follow_accepted',
      'Follow Request Accepted',
      `${fromName} accepted your follow request. Follow them back to start a chat.`,
      { fromUserId: firebaseUser?.uid || '' }
    );
  };

  const notifyNewMessage = async (
    toUid: string,
    fromName: string,
    chatId: string,
    messageId: string
  ) => {
    await createNotification(
      toUid,
      'new_message',
      'New Message',
      `${fromName} sent you a message`,
      { fromUserId: firebaseUser?.uid || '', chatId, messageId }
    );
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        refresh,
        markAsRead,
        notifyFollowRequest,
        notifyFollowAccepted,
        notifyNewMessage,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}