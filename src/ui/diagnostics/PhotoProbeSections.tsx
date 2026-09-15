import { Text, View } from 'react-native';

import type {
  PhotoAvailability,
  PhotoKey,
  PreparedPhoto,
  RetainedPhoto,
} from '../../photos/photo-contract';
import { Button } from '../Button';
import { PhotoThumbnail } from '../photos/PhotoThumbnail';
import type { PhotoProbeFixture } from '../../diagnostics/photos/photo-probe-contract';
import type { ProbeOperation, ResolveState } from './photo-probe-types';

function metricsLabel(photo: PreparedPhoto | RetainedPhoto): string {
  const { originalDimensions, outputDimensions, bytes, attempt, elapsedMs } = photo.metrics;
  return [
    `Original ${originalDimensions.width}×${originalDimensions.height}`,
    `output ${outputDimensions.width}×${outputDimensions.height}`,
    `${bytes} bytes`,
    `attempt ${attempt}`,
    `${Math.round(elapsedMs)} ms`,
  ].join(' · ');
}

function availabilityLabel(availability: PhotoAvailability): string {
  if (availability.status === 'absent') return 'No saved photo key for this fixture.';
  if (availability.status === 'available') return `Available at ${availability.uri}`;
  return `${availability.reason}: ${availability.message}`;
}

export function PhotoProbeFixtureSection<TFixture extends PhotoProbeFixture>({
  fixtures,
  selectedFixture,
  disabled,
  onSelect,
}: {
  fixtures: readonly TFixture[];
  selectedFixture: TFixture;
  disabled: boolean;
  onSelect: (fixture: TFixture) => void;
}) {
  return (
    <View className="gap-3 rounded-surface border border-faint-light bg-surface-light p-4 dark:border-faint-dark dark:bg-surface-dark">
      <Text className="text-body font-semibold text-ink-light dark:text-ink-dark">Fixtures</Text>
      <View className="gap-2">
        {fixtures.map((fixture) => (
          <Button
            key={fixture.id}
            disabled={disabled}
            size="compact"
            variant={fixture.id === selectedFixture.id ? 'primary' : 'secondary'}
            onPress={() => onSelect(fixture)}
          >
            {fixture.label}
          </Button>
        ))}
      </View>
      <Text className="text-detail text-muted-light dark:text-muted-dark">
        {selectedFixture.description} ({selectedFixture.sourceType.toUpperCase()})
      </Text>
    </View>
  );
}

export function PhotoProbeLifecycleSection({
  operation,
  busy,
  onPrepare,
  onCancel,
  onRetain,
  onDiscard,
}: {
  operation: ProbeOperation;
  busy: boolean;
  onPrepare: () => void;
  onCancel: () => void;
  onRetain: () => void;
  onDiscard: () => void;
}) {
  return (
    <View className="gap-3 rounded-surface border border-faint-light bg-surface-light p-4 dark:border-faint-dark dark:bg-surface-dark">
      <Text className="text-body font-semibold text-ink-light dark:text-ink-dark">Capture lifecycle</Text>
      <View className="flex-row flex-wrap gap-2">
        <Button
          disabled={
            busy ||
            (operation.status !== 'ready' && operation.status !== 'error')
          }
          onPress={onPrepare}
        >
          Prepare photo
        </Button>
        <Button disabled={operation.status !== 'preparing'} variant="secondary" onPress={onCancel}>
          Cancel
        </Button>
      </View>

      {operation.status === 'prepared' ? (
        <View className="gap-2">
          <Text className="text-body text-ink-light dark:text-ink-dark">Prepared, not retained.</Text>
          <Text className="text-detail text-muted-light dark:text-muted-dark" selectable>
            {metricsLabel(operation.photo)}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <Button disabled={busy} onPress={onRetain}>Retain photo</Button>
            <Button disabled={busy} variant="secondary" onPress={onDiscard}>Discard</Button>
          </View>
        </View>
      ) : null}
      {operation.status === 'preparing' ? (
        <Text accessibilityLiveRegion="polite" className="text-body text-muted-light dark:text-muted-dark">
          Preparing and downscaling the selected source…
        </Text>
      ) : null}
      {operation.status === 'retaining' ? (
        <Text accessibilityLiveRegion="polite" className="text-body text-muted-light dark:text-muted-dark">
          Promoting the staged file to durable storage…
        </Text>
      ) : null}
      {operation.status === 'discarding' ? (
        <Text accessibilityLiveRegion="polite" className="text-body text-muted-light dark:text-muted-dark">
          Cleaning up prepared output…
        </Text>
      ) : null}
      {operation.status === 'retained' ? (
        <View className="gap-1">
          <Text className="text-body text-ink-light dark:text-ink-dark">Photo retained.</Text>
          <Text className="text-detail text-muted-light dark:text-muted-dark" selectable>
            {metricsLabel(operation.photo)}
          </Text>
        </View>
      ) : null}
      {operation.status === 'error' ? (
        <Text accessibilityRole="alert" className="text-body text-error-light dark:text-error-dark" selectable>
          Photo operation failed: {operation.message}
        </Text>
      ) : null}
    </View>
  );
}

export function PhotoProbeSavedPhotoSection({
  photoKey,
  resolvePhoto,
  revision,
  busy,
  resolveState,
  onResolve,
  onRemove,
  onRestore,
}: {
  photoKey: PhotoKey | null;
  resolvePhoto: (photoKey: string | null) => Promise<PhotoAvailability>;
  revision: number;
  busy: boolean;
  resolveState: ResolveState;
  onResolve: () => void;
  onRemove: () => void;
  onRestore: () => void;
}) {
  return (
    <View className="gap-3 rounded-surface border border-faint-light bg-surface-light p-4 dark:border-faint-dark dark:bg-surface-dark">
      <Text className="text-body font-semibold text-ink-light dark:text-ink-dark">Saved photo</Text>
      <PhotoThumbnail
        photoKey={photoKey}
        resolvePhoto={resolvePhoto}
        revision={revision}
        size={128}
        testID="photo-probe-thumbnail"
      />
      <Text className="text-detail text-muted-light dark:text-muted-dark" selectable>
        {photoKey === null ? 'No saved photo key.' : photoKey}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        <Button disabled={busy || photoKey === null} onPress={onResolve}>
          Resolve saved key
        </Button>
        <Button disabled={busy || photoKey === null} variant="secondary" onPress={onRemove}>
          Fault: remove file
        </Button>
        <Button disabled={busy || photoKey === null} variant="secondary" onPress={onRestore}>
          Restore file
        </Button>
      </View>
      {resolveState.status === 'loading' ? (
        <Text accessibilityLiveRegion="polite" className="text-body text-muted-light dark:text-muted-dark">
          Resolving the saved key…
        </Text>
      ) : null}
      {resolveState.status === 'ready' ? (
        <Text className="text-detail text-muted-light dark:text-muted-dark" selectable>
          {availabilityLabel(resolveState.availability)}
        </Text>
      ) : null}
      {resolveState.status === 'error' ? (
        <Text accessibilityRole="alert" className="text-detail text-error-light dark:text-error-dark" selectable>
          Resolve failed: {resolveState.message}
        </Text>
      ) : null}
    </View>
  );
}
