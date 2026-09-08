/**
 * Shared text input with a label and explicit validation state.
 *
 * The input reports validation without owning form state, so screens can keep
 * their draft values local and submit them through the data boundary.
 */
import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { tv, type VariantProps } from 'tailwind-variants';

const inputStyles = tv({
  slots: {
    wrapper: 'gap-1',
    label: 'text-body font-semibold text-ink-light dark:text-ink-dark',
    input:
      'min-h-touch rounded-control border bg-surface-light px-3 text-body text-ink-light dark:bg-surface-dark dark:text-ink-dark',
    error: 'text-detail text-error-light dark:text-error-dark',
  },
  variants: {
    state: {
      default: { input: 'border-faint-light dark:border-faint-dark' },
      invalid: { input: 'border-error-light dark:border-error-dark' },
      disabled: { input: 'border-faint-light opacity-40 dark:border-faint-dark' },
    },
  },
  defaultVariants: {
    state: 'default',
  },
});

type InputVariantProps = VariantProps<typeof inputStyles>;

export type InputProps = Omit<TextInputProps, 'placeholderTextColor'> &
  InputVariantProps & {
    label?: string;
    error?: string;
    className?: string;
    inputClassName?: string;
  };

export function Input({
  label,
  error,
  state,
  className,
  inputClassName,
  editable = true,
  accessibilityLabel,
  ...textInputProps
}: InputProps) {
  const resolvedState = editable === false ? 'disabled' : state ?? (error ? 'invalid' : 'default');
  const resolvedEditable = resolvedState !== 'disabled';
  const styles = inputStyles({ state: resolvedState });

  return (
    <View className={styles.wrapper({ className })}>
      {label ? <Text className={styles.label()}>{label}</Text> : null}
      <TextInput
        {...textInputProps}
        editable={resolvedEditable}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={error}
        className={styles.input({ className: inputClassName })}
        placeholderTextColor="#8A9A96"
      />
      {error ? <Text className={styles.error()}>{error}</Text> : null}
    </View>
  );
}
