// Auth Stack Layout

import { Stack } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { COLORS } from '@/utils/constants';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: styles.content,
      }}
    >
      <Stack.Screen name="login" options={{ presentation: 'modal' }} />
      <Stack.Screen name="register" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  content: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
});