/** Native draft inbox route after the migration gate. */
import { router, type Href } from 'expo-router';

import { resolvePhoto as nativeResolvePhoto } from '../photos/photo-access';
import {
  getDraftInboxData,
  subscribeLedgerChanges,
} from '../ui/ledger-access';
import { DraftInboxView } from '../ui/drafts/DraftInboxView';
import type { PhotoThumbnailResolver } from '../ui/photos/PhotoThumbnail';
import type { DraftInboxData } from '../data/draft-inbox';
import {
  useDraftInbox,
  type DraftInboxAppState,
  type DraftInboxSubscription,
} from '../ui/drafts/useDraftInbox';

export default function DraftsRoute({
  data = getDraftInboxData(),
  subscribe = subscribeLedgerChanges,
  resolvePhoto = nativeResolvePhoto,
  appState,
}: {
  data?: DraftInboxData<'sync'>;
  subscribe?: DraftInboxSubscription;
  resolvePhoto?: PhotoThumbnailResolver;
  appState?: DraftInboxAppState;
}) {
  const { state, photoRevision, retry } = useDraftInbox({ data, subscribe, appState });

  return (
    <DraftInboxView
      state={state}
      resolvePhoto={resolvePhoto}
      revision={photoRevision}
      onRetry={retry}
      onOpenDraft={(draftId) => {
        router.push(`/transactions/${draftId}?from=drafts` as Href);
      }}
    />
  );
}
