/**
 * Shared action control for app screens.
 *
 * Tailwind Variants keeps the visual weight of primary and secondary actions
 * consistent while NativeWind applies the tokens on every platform.
 */
import { forwardRef, type ComponentRef, type ReactNode } from 'react';
import { Pressable, Text, type PressableProps } from 'react-native';
import { tv, type VariantProps } from 'tailwind-variants';

const buttonStyles = tv({
  slots: {
    root: 'min-h-touch flex-row items-center justify-center rounded-control px-4 active:opacity-80 disabled:opacity-40',
    label: 'font-semibold text-body',
  },
  variants: {
    variant: {
      primary: {
        root: 'bg-need-light dark:bg-need-dark',
        label: 'text-ground-dark',
      },
      secondary: {
        root: 'border border-faint-light bg-surface-light dark:border-faint-dark dark:bg-surface-dark',
        label: 'text-ink-light dark:text-ink-dark',
      },
    },
    size: {
      compact: { root: 'px-3' },
      regular: { root: 'px-4' },
    },
    fullWidth: {
      true: { root: 'self-stretch' },
      false: { root: 'self-start' },
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'regular',
    fullWidth: false,
  },
});

type ButtonVariantProps = VariantProps<typeof buttonStyles>;

export type ButtonProps = Omit<PressableProps, 'children'> &
  ButtonVariantProps & {
    children: ReactNode;
    className?: string;
    labelClassName?: string;
  };

export const Button = forwardRef<ComponentRef<typeof Pressable>, ButtonProps>(
  function Button(
    {
      children,
      className,
      labelClassName,
      variant,
      size,
      fullWidth,
      accessibilityRole,
      ...pressableProps
    },
    ref
  ) {
    const styles = buttonStyles({ variant, size, fullWidth });

    return (
      <Pressable
        ref={ref}
        {...pressableProps}
        accessibilityRole={accessibilityRole ?? 'button'}
        className={styles.root({ className })}
      >
        <Text className={styles.label({ className: labelClassName })}>{children}</Text>
      </Pressable>
    );
  }
);
