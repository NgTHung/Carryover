/**
 * Presents one draft without requiring account, category, or file metadata.
 *
 * The amount label checks for null explicitly so an unknown never becomes a
 * zero-valued amount while the photo resolver can fail independently.
 */
import { Pressable, Text, View } from 'react-native';

import { formatVnd } from '../../money/currency';
import type { DraftTransaction } from '../../data/transaction-validation';
import { PhotoThumbnail, type PhotoThumbnailResolver } from '../photos/PhotoThumbnail';

function dateLabel(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function draftAmountLabel(amount: number | null): string {
  return amount === null ? 'Unknown amount' : formatVnd(amount);
}

export function draftInboxRowAccessibilityLabel(draft: DraftTransaction): string {
  return `Open draft, ${draftAmountLabel(draft.amount)}, ${draft.direction}, ${dateLabel(draft.occurredAt)}`;
}

export function DraftInboxRow({
  draft,
  resolvePhoto,
  revision = 0,
  onOpen,
}: {
  draft: DraftTransaction;
  resolvePhoto: PhotoThumbnailResolver;
  revision?: number;
  onOpen: (draftId: string) => void;
}) {
  const note = draft.note?.trim();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={draftInboxRowAccessibilityLabel(draft)}
      className="mx-5 min-h-touch rounded-surface border border-faint-light bg-surface-light p-3 active:opacity-80 dark:border-faint-dark dark:bg-surface-dark"
      onPress={() => onOpen(draft.id)}
      testID={`draft-row-${draft.id}`}
    >
      <View className="flex-row items-center gap-3">
        <PhotoThumbnail
          photoKey={draft.photoKey}
          resolvePhoto={resolvePhoto}
          revision={revision}
          size={72}
          testID={`draft-photo-${draft.id}`}
        />
        <View className="min-w-0 flex-1 gap-1">
          <View className="flex-row items-start justify-between gap-2">
            <Text className="flex-1 text-body font-semibold tabular-nums text-ink-light dark:text-ink-dark">
              {draftAmountLabel(draft.amount)}
            </Text>
            <Text className="text-detail font-semibold uppercase text-muted-light dark:text-muted-dark">
              {draft.direction}
            </Text>
          </View>
          <Text className="text-detail text-muted-light dark:text-muted-dark">
            {dateLabel(draft.occurredAt)}
          </Text>
          {note ? (
            <Text numberOfLines={1} className="text-detail text-ink-light dark:text-ink-dark">
              {note}
            </Text>
          ) : null}
          <Text className="text-detail font-semibold text-want-light dark:text-want-dark">
            Open draft
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
