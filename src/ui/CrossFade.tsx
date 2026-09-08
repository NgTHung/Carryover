/**
 * Cross-fades a new presentation state without inspecting its contents.
 *
 * The key is opaque by design. A screen can pass a formatted integer amount,
 * but this component never parses, interpolates, or calculates it.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { animatePresentation, useMotionPlan } from './motion';

export interface CrossFadeProps {
  children: ReactNode;
  stateKey: string;
  intent?: 'crossFade' | 'heroRecount';
}

export function CrossFade({ children, stateKey, intent = 'crossFade' }: CrossFadeProps) {
  const opacity = useSharedValue(1);
  const previousKey = useRef(stateKey);
  const plan = useMotionPlan(intent);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  useEffect(() => {
    if (previousKey.current === stateKey) return;

    previousKey.current = stateKey;
    opacity.value = 0;
    animatePresentation(opacity, plan);
  }, [opacity, plan, stateKey]);

  return (
    <Animated.View style={animatedStyle}>
      {children}
    </Animated.View>
  );
}
