/**
 * Reanimated adapters for presentation-only transitions.
 *
 * Callers animate opacity, scale, or another visual property. This module has
 * no amount or budget input, so motion cannot become a second money engine.
 */
import {
  Easing,
  ReduceMotion,
  useReducedMotion,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { getMotionPlan, type MotionIntent, type MotionPlan } from './motion-plan';

type TimingConfig = NonNullable<Parameters<typeof withTiming>[1]>;

export function useMotionPlan(intent: MotionIntent): MotionPlan {
  return getMotionPlan(intent, useReducedMotion());
}

export function timingConfig(plan: MotionPlan): TimingConfig {
  if (plan.kind === 'crossFade') {
    return {
      duration: plan.duration,
      easing: Easing.out(Easing.quad),
      reduceMotion: ReduceMotion.Never,
    };
  }

  return {
    duration: plan.duration,
    easing: Easing.out(Easing.quad),
    reduceMotion: plan.kind === 'instant' ? ReduceMotion.Always : ReduceMotion.System,
  };
}

export function animatePresentation(
  progress: SharedValue<number>,
  plan: MotionPlan
): void {
  progress.value = withTiming(1, timingConfig(plan));
}
