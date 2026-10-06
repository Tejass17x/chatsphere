// Main Tabs Layout

import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { LucideIcon } from '@/components/ui/LucideIcon';
import { COLORS, SPACING } from '@/utils/constants';
import { useAuth } from '@/contexts/AuthContext';
import { shadow } from '@/utils/shadows';

export default function TabsLayout() {
  const { user } = useAuth();

  const tabBarActiveTintColor = COLORS.primary;
  const tabBarInactiveTintColor = COLORS.textTertiary;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor,
        tabBarInactiveTintColor,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: styles.tabBarItem,
      }}
    >
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chats',
          tabBarIcon: ({ focused, color }) => (
            <LucideIcon
              name={focused ? 'message-circle' : 'message-circle'}
              size={24}
              color={color}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ focused, color }) => (
            <LucideIcon
              name={focused ? 'search' : 'search'}
              size={24}
              color={color}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused, color }) => (
            <LucideIcon
              name={focused ? 'user' : 'user'}
              size={24}
              color={color}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: Platform.OS === 'ios' ? 80 : 65,
    paddingBottom: Platform.OS === 'ios' ? 20 : 5,
    backgroundColor: COLORS.background,
    borderTopWidth: 0,
    ...shadow({ color: COLORS.shadow, offset: { width: 0, height: -2 }, opacity: 0.1, radius: 4, elevation: 8 }),
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  tabBarIndicator: {
    height: 0,
  },
  tabBarItem: {
    paddingVertical: 4,
  },
});