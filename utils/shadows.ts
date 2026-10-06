// Use CSS shadows on web, native shadows on iOS, and elevation on Android.
import { Platform, ViewStyle } from 'react-native';

type ShadowTokens = {
  color: string;
  offset: { width: number; height: number };
  opacity: number;
  radius: number;
  elevation: number;
};

type CrossPlatformViewStyle = ViewStyle & { boxShadow?: string };

export function shadow(tokens: ShadowTokens): CrossPlatformViewStyle {
  if (Platform.OS === 'web') {
    const color = `color-mix(in srgb, ${tokens.color} ${tokens.opacity * 100}%, transparent)`;
    return {
      boxShadow: `${tokens.offset.width}px ${tokens.offset.height}px ${tokens.radius}px ${color}`,
    };
  }
  if (Platform.OS === 'android') {
    return { elevation: tokens.elevation };
  }
  return {
    shadowColor: tokens.color,
    shadowOffset: tokens.offset,
    shadowOpacity: tokens.opacity,
    shadowRadius: tokens.radius,
  };
}

// Prebuilt shadows for common cases
export const shadows = {
  sm: shadow({ color: '#000', offset: { width: 0, height: 1 }, opacity: 0.1, radius: 2, elevation: 2 }),
  md: shadow({ color: '#000', offset: { width: 0, height: 2 }, opacity: 0.1, radius: 4, elevation: 4 }),
  lg: shadow({ color: '#000', offset: { width: 0, height: 4 }, opacity: 0.15, radius: 8, elevation: 8 }),
  primary: shadow({ color: '#6366F1', offset: { width: 0, height: 4 }, opacity: 0.3, radius: 8, elevation: 8 }),
  colored: (color: string, opacity = 0.3) =>
    shadow({ color, offset: { width: 0, height: 0 }, opacity, radius: 10, elevation: 10 }),
} as const;