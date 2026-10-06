// TypingIndicator
//
// Shows the classic three-dot "someone is typing" affordance. Two placements
// matter in a chat UI and both are covered here:
//
//   variant="inline"  a slim bar directly above the input, which is the
//                      standard, least-noisy placement (WhatsApp, iMessage)
//   variant="bubble"  a message-shaped bubble anchored to the partner's side
//                      of the message list
//
// Visibility is driven by the caller so the same component works whether the
// state comes from a Firestore listener or a local optimistic guess.

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '@/utils/constants';

type TypingIndicatorProps = {
  /** True while someone else is typing. */
  visible: boolean;
  /** Optional name, e.g. "Ava is typing…". Inline variant only. */
  name?: string;
  variant?: 'inline' | 'bubble';
};

export function TypingIndicator({
  visible,
  name,
  variant = 'inline',
}: TypingIndicatorProps) {
  // Nothing to animate when hidden — the dots animation is expensive enough
  // that we don't run it off-screen.
  if (!visible) return null;

  if (variant === 'bubble') {
    return (
      <View style={styles.bubbleRow}>
        <View style={styles.bubble}>
          <Dots />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.inlineRow} accessibilityLiveRegion="polite">
      <Dots />
      {name ? <Text style={styles.inlineLabel}>{name} is typing…</Text> : null}
    </View>
  );
}

function Dots() {
  return (
    <Animated.View style={styles.dotsRow}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} delay={i * 160} />
      ))}
    </Animated.View>
  );
}

/** One dot's bounce cycle. Each dot owns its own value so it can start at a
 *  different point in the cycle — that offset is what turns three independent
 *  bounces into a wave travelling left-to-right. */
function Dot({ delay }: { delay: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation;
    let startTimer: ReturnType<typeof setTimeout> | undefined;

    const start = () => {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 380,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 380,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
    };

    if (delay === 0) start();
    else startTimer = setTimeout(start, delay);

    // Stop on unmount so the animation doesn't keep the JS thread awake after
    // the chat screen is popped.
    return () => {
      if (startTimer) clearTimeout(startTimer);
      loop?.stop();
      anim.stopAnimation();
    };
  }, [anim, delay]);

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          opacity: anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.45, 1],
          }),
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [1, -4],
              }),
            },
          ],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xs,
    backgroundColor: COLORS.background,
  },
  inlineLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  bubbleRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  bubble: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    // Matches the minimum height of a text bubble so the list doesn't jump.
    minWidth: 56,
    minHeight: 36,
    justifyContent: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.textTertiary,
  },
});

export default TypingIndicator;