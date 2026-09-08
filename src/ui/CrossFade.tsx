/**
 * Cross-fades a new presentation state without inspecting its contents.
 *
 * The key is opaque by design. A screen can pass a formatted integer amount,
 * but this component never parses, interpolates, or calculates it.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { timingConfig, useMotionPlan } from './motion';
import type { MotionPlan } from './motion-plan';

export interface CrossFadeProps {
  children: ReactNode;
  stateKey: string;
  intent?: 'crossFade' | 'heroRecount';
}

interface Layer {
  id: number;
  children: ReactNode;
}

interface Presentation {
  key: string;
  nextId: number;
  current: Layer;
  outgoing: Layer[];
}

interface CrossFadeLayerProps {
  layer: Layer;
  phase: 'visible' | 'entering' | 'exiting';
  plan: MotionPlan;
  onFinished: (id: number) => void;
}

function CrossFadeLayer({ layer, phase, plan, onFinished }: CrossFadeLayerProps) {
  const { id, children } = layer;
  const outgoing = phase === 'exiting';
  const opacity = useSharedValue(phase === 'entering' && plan.kind !== 'instant' ? 0 : 1);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  useEffect(() => {
    if (plan.kind === 'instant') {
      opacity.value = 1;
      return;
    }

    if (phase === 'visible') return;

    const target = outgoing ? 0 : 1;
    opacity.value = withTiming(target, timingConfig(plan), (finished) => {
      if (finished && outgoing) {
        scheduleOnRN(onFinished, id);
      }
    });

    return () => cancelAnimation(opacity);
  }, [id, phase, outgoing, opacity, onFinished, plan.kind, plan.duration]);

  return (
    <Animated.View
      style={[animatedStyle, outgoing && styles.outgoing]}
      pointerEvents={outgoing ? 'none' : 'auto'}
      accessible={false}
      accessibilityElementsHidden={outgoing}
      importantForAccessibility={outgoing ? 'no-hide-descendants' : 'auto'}
    >
      {children}
    </Animated.View>
  );
}

export function CrossFade({ children, stateKey, intent = 'crossFade' }: CrossFadeProps) {
  const plan = useMotionPlan(intent);
  const mounted = useRef(true);
  const [presentation, setPresentation] = useState<Presentation>(() => ({
    key: stateKey,
    nextId: 1,
    current: { id: 0, children },
    outgoing: [],
  }));

  // Update before committing so the old content never flashes as the new state.
  if (presentation.key !== stateKey) {
    setPresentation({
      key: stateKey,
      nextId: presentation.nextId + 1,
      current: { id: presentation.nextId, children },
      outgoing: plan.kind === 'instant'
        ? []
        : [...presentation.outgoing, presentation.current],
    });
  } else if (
    presentation.current.children !== children ||
    (plan.kind === 'instant' && presentation.outgoing.length > 0)
  ) {
    setPresentation({
      ...presentation,
      current: { ...presentation.current, children },
      outgoing: plan.kind === 'instant' ? [] : presentation.outgoing,
    });
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const removeLayer = useCallback((id: number) => {
    if (!mounted.current) return;
    setPresentation((current) => ({
      ...current,
      outgoing: current.outgoing.filter((layer) => layer.id !== id),
    }));
  }, []);

  return (
    <Animated.View style={styles.container}>
      {[...presentation.outgoing, presentation.current].map((layer) => (
        <CrossFadeLayer
          key={layer.id}
          layer={layer}
          phase={layer.id !== presentation.current.id ? 'exiting' : layer.id === 0 ? 'visible' : 'entering'}
          plan={plan}
          onFinished={removeLayer}
        />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative' },
  outgoing: { position: 'absolute', top: 0, left: 0, right: 0 },
});
