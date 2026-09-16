/**
 * Renders the app's budget publication and its stable home actions.
 * The view accepts a discriminated store state so unavailable data never looks
 * like a zero-valued budget.
 */
import { Link } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { SnapshotState } from '../../budget/snapshot-store';
import { Button } from '../Button';
import { CrossFade } from '../CrossFade';
import {
  formatCarryoverBalance,
  formatDiscretionary,
  formatPerDay,
  formatReceivable,
  formatRunway,
  formatUnknownDrafts,
  homeAccessibilityLabel,
} from './home-presentation';

export type HomeSnapshotViewProps = {
  state: SnapshotState;
  onRetry?: () => void;
  onChangeHorizon?: () => void;
  onCapture?: () => void;
  previewNotice?: string;
};

export function HomeSnapshotView({
  state,
  onRetry,
  onChangeHorizon,
  onCapture,
  previewNotice,
}: HomeSnapshotViewProps) {
  return (
    <SafeAreaView className="flex-1 bg-ground-light dark:bg-ground-dark" edges={['top', 'bottom']}>
      <ScrollView
        contentContainerClassName="grow gap-8 px-5 pb-5 pt-4"
        alwaysBounceVertical={false}
      >
        <View className="gap-6">
          <View className="gap-1">
            <Text className="text-eyebrow font-semibold tracking-widest text-need-light dark:text-need-dark">
              CARRYOVER
            </Text>
            <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">
              Home
            </Text>
          </View>

          {previewNotice ? (
            <Text className="rounded-surface border border-faint-light bg-surface-light p-3 text-detail text-muted-light dark:border-faint-dark dark:bg-surface-dark dark:text-muted-dark">
              {previewNotice}
            </Text>
          ) : null}

          <HomeState
            state={state}
            onRetry={onRetry}
            onChangeHorizon={onChangeHorizon}
          />
        </View>

        <View className="mt-auto gap-4">
          <View className="flex-row flex-wrap gap-2">
            <Link href={'/transactions' as never} asChild>
              <Button variant="secondary" fullWidth className="flex-1">
                Transactions
              </Button>
            </Link>
            <Link href={'/drafts' as never} asChild>
              <Button variant="secondary" fullWidth className="flex-1">
                Drafts
              </Button>
            </Link>
            <Link href={'/summary' as never} asChild>
              <Button variant="secondary" fullWidth className="flex-1">
                Summary
              </Button>
            </Link>
            <Link href={'/settings/accounts' as never} asChild>
              <Button variant="secondary" fullWidth className="flex-1">
                Accounts
              </Button>
            </Link>
            <Link href={'/settings/commitments' as never} asChild>
              <Button variant="secondary" fullWidth className="flex-1">
                Commitments
              </Button>
            </Link>
          </View>

          <Button
            disabled={onCapture === undefined}
            onPress={onCapture}
            accessibilityLabel="Capture"
            accessibilityHint={
              onCapture === undefined
                ? 'Capture is not available yet.'
                : 'Open the camera to capture a purchase photo.'
            }
            className="min-h-16 min-w-28 self-end rounded-chip px-6"
          >
            Capture
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function HomeState({
  state,
  onRetry,
  onChangeHorizon,
}: {
  state: SnapshotState;
  onRetry?: () => void;
  onChangeHorizon?: () => void;
}) {
  if (state.status === 'loading') {
    return (
      <View className="gap-2">
        <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">
          Per day
        </Text>
        <Text className="text-body text-muted-light dark:text-muted-dark">
          Preparing your per day…
        </Text>
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View className="gap-3">
        <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">
          Per day unavailable
        </Text>
        <Text accessibilityRole="alert" className="text-body text-error-light dark:text-error-dark">
          {state.error.message}
        </Text>
        {onRetry ? <Button onPress={onRetry}>Try again</Button> : null}
      </View>
    );
  }

  const { snapshot } = state;
  return (
    <View testID="home-ready" className="gap-6">
      <CrossFade stateKey={snapshot.updatedAt} intent="heroRecount">
        <View accessible accessibilityLabel={homeAccessibilityLabel(snapshot)} className="gap-1">
          <Text testID="home-hero" className="text-hero font-semibold tabular-nums text-ink-light dark:text-ink-dark">
            {formatPerDay(snapshot)}
          </Text>
          <Text className="text-body text-muted-light dark:text-muted-dark">
            to spend today
          </Text>
        </View>
      </CrossFade>

      <View className="gap-2">
        <HomeStat label="Carryover balance" value={formatCarryoverBalance(snapshot)} />
        <View className="flex-row flex-wrap items-baseline gap-x-3 gap-y-1">
        <HomeStat label="Discretionary" value={formatDiscretionary(snapshot)} />
          {snapshot.owedToYou !== 0 ? (
            <Text className="text-body tabular-nums text-muted-light dark:text-muted-dark">
              {formatReceivable(snapshot)} receivable
            </Text>
          ) : null}
        </View>
        <HomeStat label="Runway" value={formatRunway(snapshot)} />
        <HomeStat label="Horizon" value={snapshot.horizonDate} />
      </View>

      {onChangeHorizon ? (
        <Button variant="secondary" onPress={onChangeHorizon}>
          Change horizon
        </Button>
      ) : null}

      {snapshot.unloggedDrafts !== 0 ? (
        <Link href={'/drafts' as never} asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Drafts"
            testID="home-unknown"
            className="self-start rounded-chip border border-faint-light px-3 py-2 dark:border-faint-dark"
          >
          <Text className="text-body font-semibold text-muted-light dark:text-muted-dark">
            {formatUnknownDrafts(snapshot)}
          </Text>
          </Pressable>
        </Link>
      ) : null}
    </View>
  );
}

function HomeStat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row flex-wrap items-baseline gap-x-3">
      <Text className="text-body text-muted-light dark:text-muted-dark">{label}</Text>
      <Text className="text-body font-semibold tabular-nums text-ink-light dark:text-ink-dark">
        {value}
      </Text>
    </View>
  );
}
