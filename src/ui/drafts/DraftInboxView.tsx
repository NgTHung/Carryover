/**
 * Renders every inbox state and keeps the route reachable while data loads.
 *
 * Rows own photo resolution, so a slow or missing file cannot block the
 * SQLite read, list interaction, or explicit empty and error states.
 */
import { FlatList, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { DraftTransaction } from '../../data/transaction-validation';
import { Button } from '../Button';
import { PhotoThumbnail, type PhotoThumbnailResolver } from '../photos/PhotoThumbnail';
import { DraftInboxRow } from './DraftInboxRow';
import type { DraftInboxLoadState } from './draft-inbox-contract';

function NavigationActions() {
  return (
    <View className="flex-row gap-2">
      <Link href="/" asChild>
        <Button variant="secondary" fullWidth className="flex-1">Home</Button>
      </Link>
      <Link href="/transactions" asChild>
        <Button variant="secondary" fullWidth className="flex-1">Transactions</Button>
      </Link>
    </View>
  );
}

function Header() {
  return (
    <View className="gap-4 bg-ground-light px-5 pb-4 pt-4 dark:bg-ground-dark">
      <View className="gap-1">
        <Text className="text-eyebrow font-semibold tracking-widest text-need-light dark:text-need-dark">CAPTURE</Text>
        <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">Drafts</Text>
      </View>
      <NavigationActions />
    </View>
  );
}

function Message({
  state,
  onRetry,
}: {
  state: Extract<DraftInboxLoadState, { status: 'loading' | 'error' }>;
  onRetry: () => void;
}) {
  return (
    <SafeAreaView className="flex-1 bg-ground-light dark:bg-ground-dark" edges={['top', 'bottom']}>
      <Header />
      <View className="flex-1 gap-3 px-5 py-8">
        {state.status === 'loading' ? (
          <Text className="text-body text-muted-light dark:text-muted-dark">Loading drafts…</Text>
        ) : (
          <>
            <Text accessibilityRole="alert" className="text-body text-error-light dark:text-error-dark">
              {state.message}
            </Text>
            <Button onPress={onRetry}>Try again</Button>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

export function DraftInboxView({
  state,
  resolvePhoto,
  revision = 0,
  onOpenDraft,
  onRetry,
}: {
  state: DraftInboxLoadState;
  resolvePhoto: PhotoThumbnailResolver;
  revision?: number;
  onOpenDraft: (draftId: string) => void;
  onRetry: () => void;
}) {
  if (state.status === 'loading' || state.status === 'error') {
    return <Message state={state} onRetry={onRetry} />;
  }

  return (
    <SafeAreaView className="flex-1 bg-ground-light dark:bg-ground-dark" edges={['top', 'bottom']}>
      <FlatList<DraftTransaction>
        testID="draft-inbox"
        data={state.drafts}
        keyExtractor={(draft) => draft.id}
        contentContainerClassName="gap-2 bg-ground-light pb-8 dark:bg-ground-dark"
        ListHeaderComponent={<Header />}
        ListEmptyComponent={
          <View className="gap-3 px-5 py-8">
            <Text className="text-body text-muted-light dark:text-muted-dark">No active drafts.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <DraftInboxRow
            draft={item}
            resolvePhoto={resolvePhoto}
            revision={revision}
            onOpen={onOpenDraft}
          />
        )}
      />
    </SafeAreaView>
  );
}
