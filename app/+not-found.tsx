// 404 Not Found Screen

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Link, Stack } from 'expo-router';
import { LucideIcon } from '@/components/ui/LucideIcon';
import { Button } from '@/components/ui/Button';
import { COLORS, SPACING } from '@/utils/constants';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <LucideIcon name="search" size={64} color={COLORS.textTertiary} />
        <Text style={styles.title}>This screen doesn't exist.</Text>
        <Link href="/" asChild>
          <Button title="Go to home screen" />
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: SPACING.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
});