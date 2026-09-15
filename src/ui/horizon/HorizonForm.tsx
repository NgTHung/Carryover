/**
 * Edits one stored horizon without owning route loading or publication.
 *
 * The field stays local until the existing month-config write succeeds. This
 * keeps a failed write visible and retryable without inventing a budget value.
 */
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { MonthConfig } from '../../data/month-config-validation';
import { updateHorizonInputSchema } from '../../data/month-config-validation';
import { formatPeriod, type Period } from '../../data/period';
import { Button, Input } from '../index';
import type { HorizonEditorData } from './horizon-editor-contract';

type HorizonMutationState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'failed'; message: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function validationMessage(input: unknown): string {
  const parsed = updateHorizonInputSchema.safeParse(input);
  if (parsed.success) return '';
  const issue = parsed.error.issues.find(
    ({ path }) => path[0] === 'horizonDate'
  );
  return issue?.message ?? 'Enter a valid horizon date.';
}

export function HorizonForm({
  period,
  config,
  data,
  onCancel,
  onSaved,
  onWritePending,
  navigationError,
}: {
  period: Period;
  config: MonthConfig;
  data: HorizonEditorData;
  onCancel: () => void;
  onSaved: () => void;
  onWritePending?: (pending: boolean) => void;
  navigationError?: string;
}) {
  const [horizonDate, setHorizonDate] = useState(config.horizonDate);
  const [fieldError, setFieldError] = useState<string>();
  const [mutation, setMutation] = useState<HorizonMutationState>({ status: 'idle' });
  const initializedPeriodRef = useRef(period);
  const submissionLockedRef = useRef(false);

  useEffect(() => {
    if (initializedPeriodRef.current === period) return;
    initializedPeriodRef.current = period;
    setHorizonDate(config.horizonDate);
    setFieldError(undefined);
    setMutation({ status: 'idle' });
  }, [config.horizonDate, period]);

  const saving = mutation.status === 'saving';

  const submit = async () => {
    if (saving || submissionLockedRef.current) return;

    const input = { period, horizonDate };
    const validation = updateHorizonInputSchema.safeParse(input);
    if (!validation.success) {
      setFieldError(validationMessage(input));
      return;
    }

    submissionLockedRef.current = true;
    onWritePending?.(true);
    setFieldError(undefined);
    setMutation({ status: 'saving' });

    try {
      await data.updateHorizon(validation.data);
    } catch (error: unknown) {
      setMutation({ status: 'failed', message: errorMessage(error) });
      submissionLockedRef.current = false;
      onWritePending?.(false);
      return;
    }

    setMutation({ status: 'idle' });
    submissionLockedRef.current = false;
    onWritePending?.(false);
    onSaved();
  };

  const failedMessage = mutation.status === 'failed'
    ? `Could not save horizon. ${mutation.message} Try again.`
    : undefined;

  return (
    <SafeAreaView className="flex-1 bg-ground-light dark:bg-ground-dark" edges={['top', 'bottom']}>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerClassName="gap-5 bg-ground-light px-5 pb-16 pt-16 dark:bg-ground-dark"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-1">
          <Text className="text-eyebrow font-semibold tracking-widest text-need-light dark:text-need-dark">
            BUDGET
          </Text>
          <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">
            Change horizon
          </Text>
          <Text className="text-body text-muted-light dark:text-muted-dark">
            {`Period: ${formatPeriod(period)}`}
          </Text>
          <Text className="text-body text-muted-light dark:text-muted-dark">
            The horizon can extend beyond the selected period.
          </Text>
        </View>

        {failedMessage ? (
          <Text accessibilityRole="alert" className="text-detail text-error-light dark:text-error-dark">
            {failedMessage}
          </Text>
        ) : null}
        {navigationError ? (
          <Text accessibilityRole="alert" className="text-detail text-error-light dark:text-error-dark">
            {navigationError}
          </Text>
        ) : null}

        <Input
          label="Horizon"
          value={horizonDate}
          error={fieldError}
          editable={!saving}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="numbers-and-punctuation"
          placeholder="YYYY-MM-DD"
          onChangeText={(value) => {
            setHorizonDate(value);
            setFieldError(undefined);
            if (mutation.status === 'failed') setMutation({ status: 'idle' });
          }}
        />
        <Text className="text-detail text-muted-light dark:text-muted-dark">
          Format: YYYY-MM-DD
        </Text>

        <View className="gap-2">
          <Button fullWidth disabled={saving} onPress={() => void submit()}>
            Save horizon
          </Button>
          <Button
            fullWidth
            variant="secondary"
            disabled={saving}
            onPress={onCancel}
          >
            Cancel
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
