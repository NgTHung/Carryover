/**
 * Shows reminder controls only after the native service has observed an
 * unknown draft. Permission is requested from the explicit button action.
 */
import { useEffect, useState } from 'react';
import { Linking, Text, View } from 'react-native';

import { getDraftNudgeService } from '../../notifications/draft-nudge-access';
import type {
  DraftNudgeServiceState,
} from '../../notifications/draft-nudge-contract';
import type { DraftNudgeService } from '../../notifications/draft-nudge-service';
import { Button } from '../Button';

function settingsErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function DraftNudgeControl({
  service = getDraftNudgeService(),
}: {
  service?: DraftNudgeService;
}) {
  const [state, setState] = useState<DraftNudgeServiceState>(service.getState());
  const [actionError, setActionError] = useState<string>();

  useEffect(() => {
    setState(service.getState());
    return service.subscribe(setState);
  }, [service]);

  const openSettings = () => {
    setActionError(undefined);
    void Linking.openSettings().catch((error: unknown) => {
      setActionError(`Could not open notification settings: ${settingsErrorMessage(error)}`);
    });
  };

  const retry = () => {
    setActionError(undefined);
    void service.retry().catch((error: unknown) => {
      setActionError(`Could not retry the daily reminder: ${settingsErrorMessage(error)}`);
    });
  };

  const requestPermission = () => {
    setActionError(undefined);
    void service.requestPermission().catch((error: unknown) => {
      setActionError(`Could not enable the daily reminder: ${settingsErrorMessage(error)}`);
    });
  };

  if (state.status === 'idle') return null;

  if (state.status === 'checking') {
    return (
      <View testID="draft-nudge-control" className="gap-1 rounded-control border border-faint-light bg-surface-light p-4 dark:border-faint-dark dark:bg-surface-dark">
        <Text className="text-body text-muted-light dark:text-muted-dark">Checking daily reminder…</Text>
      </View>
    );
  }

  if (state.status === 'permission-required') {
    return (
      <View testID="draft-nudge-control" className="gap-3 rounded-control border border-faint-light bg-surface-light p-4 dark:border-faint-dark dark:bg-surface-dark">
        <View className="gap-1">
          <Text className="text-body font-semibold text-ink-light dark:text-ink-dark">Daily reminders are off</Text>
          <Text className="text-detail text-muted-light dark:text-muted-dark">
            Remind me at 20:00 while drafts have an unknown amount.
          </Text>
        </View>
        <Button onPress={requestPermission}>Enable daily reminder</Button>
        {actionError ? <Text accessibilityRole="alert" className="text-detail text-error-light dark:text-error-dark">{actionError}</Text> : null}
      </View>
    );
  }

  if (state.status === 'enabled') {
    return (
      <View testID="draft-nudge-control" className="gap-3 rounded-control border border-faint-light bg-surface-light p-4 dark:border-faint-dark dark:bg-surface-dark">
        <Text className="text-body font-semibold text-ink-light dark:text-ink-dark">
          {state.permission.quiet
            ? 'Daily reminders are on, but delivery may be quiet.'
            : 'Daily reminders are on'}
        </Text>
        <Button variant="secondary" onPress={openSettings}>Open notification settings</Button>
        {actionError ? <Text accessibilityRole="alert" className="text-detail text-error-light dark:text-error-dark">{actionError}</Text> : null}
      </View>
    );
  }

  if (state.status === 'denied') {
    return (
      <View testID="draft-nudge-control" className="gap-3 rounded-control border border-faint-light bg-surface-light p-4 dark:border-faint-dark dark:bg-surface-dark">
        <Text className="text-body font-semibold text-ink-light dark:text-ink-dark">Daily reminders are off</Text>
        <Button variant="secondary" onPress={openSettings}>Open notification settings</Button>
        {actionError ? <Text accessibilityRole="alert" className="text-detail text-error-light dark:text-error-dark">{actionError}</Text> : null}
      </View>
    );
  }

  return (
    <View testID="draft-nudge-control" className="gap-3 rounded-control border border-error-light bg-surface-light p-4 dark:border-error-dark dark:bg-surface-dark">
      <View className="gap-1">
        <Text accessibilityRole="alert" className="text-body font-semibold text-error-light dark:text-error-dark">
          Daily reminder unavailable
        </Text>
        <Text className="text-detail text-muted-light dark:text-muted-dark">{state.message}</Text>
      </View>
      <Button onPress={retry}>Try again</Button>
      {actionError ? <Text accessibilityRole="alert" className="text-detail text-error-light dark:text-error-dark">{actionError}</Text> : null}
    </View>
  );
}
