// Utility helper functions

import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { COLORS, AVATAR_SIZES } from './constants';

/**
 * Format a date for chat timestamps
 */
export function formatChatTime(date: Date): string {
  if (isToday(date)) {
    return format(date, 'HH:mm');
  } else if (isYesterday(date)) {
    return 'Yesterday';
  } else {
    return format(date, 'MMM d, yyyy');
  }
}

/**
 * Format a date for relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date): string {
  return formatDistanceToNow(date, { addSuffix: true });
}

/**
 * Label for a day separator between groups of chat messages.
 * "Today" / "Yesterday" / "Monday" for the last week / "12 Mar" beyond that.
 */
export function dayLabel(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  const daysAgo = (Date.now() - date.getTime()) / 86_400_000;
  if (daysAgo < 7) return format(date, 'EEEE');
  if (date.getFullYear() === new Date().getFullYear()) return format(date, 'd MMM');
  return format(date, 'd MMM yyyy');
}

/**
 * True when a day separator should be drawn above `current` — i.e. it is the
 * first message, or the first message of a new calendar day.
 */
export function shouldShowDateSeparator(current: Date, previous?: Date | null): boolean {
  if (!previous) return true;
  return (
    current.getFullYear() !== previous.getFullYear() ||
    current.getMonth() !== previous.getMonth() ||
    current.getDate() !== previous.getDate()
  );
}

/**
 * Get initials from a display name
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Generate a consistent color from a string (for avatar backgrounds)
 */
export function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = hash % 360;
  return `hsl(${hue}, 70%, 40%)`;
}

/**
 * Get avatar background color from name
 */
export function getAvatarColor(name: string): string {
  return stringToColor(name);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate password strength (min 6 chars)
 */
export function isValidPassword(password: string): boolean {
  return password.length >= 6;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Generate a random ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if two arrays have the same elements (order independent)
 */
export function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every(item => setA.has(item));
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Capitalize first letter of each word
 */
export function capitalizeWords(text: string): string {
  return text.replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Validate image file
 */
export function validateImageFile(uri: string, maxSizeMB: number = 5): { valid: boolean; error?: string } {
  // In a real app, you'd check the actual file size
  // This is a placeholder for the validation logic
  return { valid: true };
}

/**
 * Get status color
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'sent':
      return COLORS.textTertiary;
    case 'delivered':
      return COLORS.info;
    case 'read':
      return COLORS.primary;
    default:
      return COLORS.textTertiary;
  }
}

/**
 * Sleep/delay utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries) {
        await sleep(baseDelay * Math.pow(2, i));
      }
    }
  }

  throw lastError!;
}

/**
 * Create a debounced search function
 */
export function createDebouncedSearch<T>(
  searchFn: (query: string) => Promise<T[]>,
  delay: number = 300
) {
  let timeout: NodeJS.Timeout | null = null;
  let latestQuery = '';

  return (query: string): Promise<T[]> => {
    latestQuery = query;

    return new Promise((resolve) => {
      if (timeout) clearTimeout(timeout);

      timeout = setTimeout(async () => {
        if (query === latestQuery) {
          const results = await searchFn(query);
          resolve(results);
        }
      }, delay);
    });
  };
}

/**
 * Format notification time
 */
export function formatNotificationTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return format(date, 'MMM d');
}

/**
 * Check if user is mutual follower
 */
export function isMutualFollow(
  currentUserFollowing: string[],
  targetUserFollowers: string[],
  currentUserId: string,
  targetUserId: string
): boolean {
  return currentUserFollowing.includes(targetUserId) &&
         targetUserFollowers.includes(currentUserId);
}

/**
 * Sort chats by last message time (newest first)
 */
export function sortChatsByLastMessage<T extends { lastMessageAt: Date }>(chats: T[]): T[] {
  return [...chats].sort((a, b) =>
    b.lastMessageAt.getTime() - a.lastMessageAt.getTime()
  );
}

/**
 * Get other participant in a 2-person chat
 */
export function getOtherParticipant(
  participants: string[],
  currentUserId: string
): string | null {
  return participants.find(id => id !== currentUserId) || null;
}