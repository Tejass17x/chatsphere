// Root Layout - Navigation & Auth State Management

import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { PresenceProvider } from '@/contexts/PresenceContext';

/**
 * Watches auth state and keeps the navigator pointed at the right stack.
 * Individual screens redirecting on their own is fragile -- a logout that
 * happens anywhere else (token revoked, session cleared) leaves the user
 * sitting on a protected screen. This is the single source of truth.
 */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)/chats');
    }
  }, [user, loading, segments, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <PresenceProvider>
            <NotificationProvider>
              <AuthGuard>
                <StatusBar style="dark" />
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen
                    name="chat/[chatId]"
                    options={{ presentation: 'card', animation: 'slide_from_right' }}
                  />
                  <Stack.Screen
                    name="notifications"
                    options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
                  />
                  <Stack.Screen name="+not-found" />
                </Stack>
              </AuthGuard>
            </NotificationProvider>
          </PresenceProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}