/**
 * One-tap quality choice for need, want, or regret.
 *
 * Labels remain visible in every state because quality cannot be encoded by
 * color alone for VoiceOver or color-blind users.
 */
import { useEffect, useRef } from 'react';
import { Pressable, Text, type PressableProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { tv, type VariantProps } from 'tailwind-variants';

import type { TransactionQuality } from '../data/transaction-validation';
import { animatePresentation, useMotionPlan } from './motion';

const qualityChipStyles = tv({
  slots: {
    root: 'min-h-touch min-w-touch flex-row items-center justify-center rounded-chip border px-3 active:opacity-80',
    label: 'text-body font-semibold',
  },
  variants: {
    quality: {
      need: {
        root: 'border-need-light dark:border-need-dark',
        label: 'text-need-light dark:text-need-dark',
      },
      want: {
        root: 'border-want-light dark:border-want-dark',
        label: 'text-want-light dark:text-want-dark',
      },
      regret: {
        root: 'border-regret-light dark:border-regret-dark',
        label: 'text-regret-light dark:text-regret-dark',
      },
    },
    selected: {
      true: {
        root: 'border-transparent bg-ink-light dark:bg-ink-dark',
        label: 'text-ground-light dark:text-ground-dark',
      },
      false: { root: 'bg-transparent' },
    },
  },
  defaultVariants: {
    selected: false,
  },
});

type QualityChipVariantProps = VariantProps<typeof qualityChipStyles>;

export type QualityChipProps = Omit<PressableProps, 'children' | 'style'> &
  QualityChipVariantProps & {
    quality: TransactionQuality;
    selected?: boolean;
    className?: string;
  };

export function QualityChip({
  quality,
  selected = false,
  className,
  accessibilityLabel,
  ...pressableProps
}: QualityChipProps) {
  const styles = qualityChipStyles({ quality, selected });
  const progress = useSharedValue(1);
  const previousSelected = useRef(selected);
  const plan = useMotionPlan('qualityChip');
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.88 + progress.value * 0.12,
    transform: [{ scale: 0.98 + progress.value * 0.02 }],
  }));

  useEffect(() => {
    if (previousSelected.current === selected) return;

    previousSelected.current = selected;
    progress.value = 0;
    animatePresentation(progress, plan);
  }, [plan, progress, selected]);

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        {...pressableProps}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? quality}
        accessibilityState={{ selected }}
        className={styles.root({ className })}
      >
        <Text className={styles.label()}>{quality}</Text>
      </Pressable>
    </Animated.View>
  );
}
