/**
 * Development-only controls for checking durable capture photos on an iPhone.
 *
 * This screen stores only probe keys in its own document file. It never opens
 * the ledger or writes a transaction, so a failed device check cannot alter
 * budgeting data.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Directory, File, Paths } from 'expo-file-system';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type {
  DiscardPhotoResult,
  PhotoError,
  PhotoKey,
  PreparePhotoResult,
  PreparedPhoto,
  RetainPhotoResult,
  RetainedPhoto,
} from '../../photos/photo-contract';
import type {
  PhotoProbeFixture,
  PhotoProbeFixtureId,
  PhotoProbeSavedKeys,
} from '../../app/diagnostics/photo-probe-contract';
import {
  PhotoProbeFixtureSection,
  PhotoProbeLifecycleSection,
  PhotoProbeSavedPhotoSection,
} from './PhotoProbeSections';
import type {
  PhotoProbeScreenProps,
  ProbeOperation,
  ResolveState,
} from './photo-probe-types';
import { Button } from '../Button';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function failureMessage(error: PhotoError, cleanupIssues: readonly { message: string }[]): string {
  if (cleanupIssues.length === 0) return error.message;
  return `${error.message} Cleanup: ${cleanupIssues.map((issue) => issue.message).join('; ')}`;
}

function resultFailureMessage(
  result: PreparePhotoResult | RetainPhotoResult | DiscardPhotoResult
): string {
  if (result.status === 'cancelled') {
    return failureMessage(result.preparation.error, result.cleanupIssues);
  }
  if (result.status === 'failed') {
    return failureMessage(result.preparation.error, result.preparation.cleanupIssues);
  }
  return 'The photo operation did not return a failure.';
}

function photoFileName(photoKey: PhotoKey): string {
  return photoKey.slice('photos/v1/'.length);
}

function retainedPhotoFile(photoKey: PhotoKey): File {
  return new File(Paths.document, 'photos', 'v1', photoFileName(photoKey));
}

function faultBackupFile(photoKey: PhotoKey): File {
  return new File(Paths.document, 'capture-photo-probe-fault', photoFileName(photoKey));
}

function faultBackupDirectory(): Directory {
  return new Directory(Paths.document, 'capture-photo-probe-fault');
}

export function PhotoProbeScreen<TFixture extends PhotoProbeFixture>({
  access,
  fixtures,
  loadFixture,
  readSavedKeys,
  writeSavedKeys,
}: PhotoProbeScreenProps<TFixture>) {
  const [selectedId, setSelectedId] = useState<PhotoProbeFixtureId>(fixtures[0].id);
  const [savedKeys, setSavedKeys] = useState<PhotoProbeSavedKeys>({});
  const [stateReady, setStateReady] = useState(false);
  const [stateError, setStateError] = useState<string | null>(null);
  const [operation, setOperation] = useState<ProbeOperation>({ status: 'ready' });
  const [resolveState, setResolveState] = useState<ResolveState>({ status: 'idle' });
  const [notice, setNotice] = useState<string | null>(null);
  const [thumbnailRevision, setThumbnailRevision] = useState(0);
  const [faultBusy, setFaultBusy] = useState(false);
  const controllerRef = useRef<AbortController | undefined>(undefined);
  const mountedRef = useRef(true);

  const loadState = useCallback(async () => {
    setStateError(null);
    try {
      const nextSavedKeys = await readSavedKeys();
      if (!mountedRef.current) return;
      setSavedKeys(nextSavedKeys);
      setStateReady(true);
    } catch (error: unknown) {
      if (mountedRef.current) setStateError(errorMessage(error));
    }
  }, [readSavedKeys]);

  useEffect(() => {
    void loadState();
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, [loadState]);

  const selectedFixture = fixtures.find((fixture) => fixture.id === selectedId) ?? fixtures[0];
  const savedPhotoKey = savedKeys[selectedFixture.id] ?? null;
  const operationBusy =
    operation.status === 'preparing' ||
    operation.status === 'retaining' ||
    operation.status === 'discarding';
  const resolving = resolveState.status === 'loading';
  const busy = operationBusy || resolving || faultBusy;
  const selectionDisabled = busy || operation.status === 'prepared';

  const selectFixture = useCallback(
    (fixture: TFixture) => {
      if (selectionDisabled) return;
      setSelectedId(fixture.id);
      setOperation({ status: 'ready' });
      setResolveState({ status: 'idle' });
      setNotice(null);
    },
    [selectionDisabled]
  );

  const prepare = useCallback(() => {
    if (
      !stateReady ||
      (operation.status !== 'ready' && operation.status !== 'error')
    ) return;

    const fixtureId = selectedFixture.id;
    const controller = new AbortController();
    controllerRef.current = controller;
    setNotice(null);
    setOperation({ status: 'preparing', fixtureId });

    void (async () => {
      try {
        const sourceUri = await loadFixture(selectedFixture);
        const result = await access.preparePhoto(sourceUri, { signal: controller.signal });
        if (!mountedRef.current) return;
        if (result.status === 'prepared') {
          setOperation({ status: 'prepared', fixtureId, photo: result.photo });
        } else {
          setOperation({ status: 'error', fixtureId, message: resultFailureMessage(result) });
        }
      } catch (error: unknown) {
        if (mountedRef.current) {
          setOperation({ status: 'error', fixtureId, message: errorMessage(error) });
        }
      } finally {
        if (controllerRef.current === controller) controllerRef.current = undefined;
      }
    })();
  }, [access, loadFixture, operation.status, selectedFixture, stateReady]);

  const cancel = useCallback(() => {
    if (operation.status !== 'preparing') return;
    setNotice('Cancellation requested. Waiting for the native operation to finish cleanup.');
    controllerRef.current?.abort();
  }, [operation.status]);

  const retain = useCallback(() => {
    if (operation.status !== 'prepared') return;

    const { fixtureId, photo } = operation;
    setNotice(null);
    setOperation({ status: 'retaining', fixtureId, photo });

    void (async () => {
      try {
        const result = await access.retainPhoto(photo);
        if (!mountedRef.current) return;
        if (result.status !== 'retained') {
          setOperation({ status: 'error', fixtureId, message: resultFailureMessage(result) });
          return;
        }

        const nextSavedKeys: PhotoProbeSavedKeys = {
          ...savedKeys,
          [fixtureId]: result.photo.photoKey,
        };
        setSavedKeys(nextSavedKeys);
        try {
          writeSavedKeys(nextSavedKeys);
          setNotice('Retained and recorded in the probe state file.');
        } catch (error: unknown) {
          setNotice(`Retained, but the probe state file could not be written: ${errorMessage(error)}`);
        }
        setOperation({ status: 'retained', fixtureId, photo: result.photo });
        setResolveState({ status: 'idle' });
        setThumbnailRevision((revision) => revision + 1);
      } catch (error: unknown) {
        if (mountedRef.current) {
          setOperation({ status: 'error', fixtureId, message: errorMessage(error) });
        }
      }
    })();
  }, [access, operation, savedKeys, writeSavedKeys]);

  const discard = useCallback(() => {
    if (operation.status !== 'prepared') return;

    const { fixtureId, photo } = operation;
    setNotice(null);
    setOperation({ status: 'discarding', fixtureId, photo });

    void (async () => {
      try {
        const result = await access.discardPreparedPhoto(photo);
        if (!mountedRef.current) return;
        if (result.status === 'discarded') {
          setOperation({ status: 'ready' });
          setNotice('Prepared output discarded. No retained photo was created.');
        } else if (result.status === 'retained') {
          setOperation({ status: 'retained', fixtureId, photo: result.photo });
        } else {
          setOperation({ status: 'error', fixtureId, message: resultFailureMessage(result) });
        }
      } catch (error: unknown) {
        if (mountedRef.current) {
          setOperation({ status: 'error', fixtureId, message: errorMessage(error) });
        }
      }
    })();
  }, [access, operation]);

  const resolveSavedPhoto = useCallback(() => {
    const fixtureId = selectedFixture.id;
    const photoKey = savedKeys[fixtureId];
    if (photoKey === undefined) {
      setResolveState({
        status: 'error',
        fixtureId,
        message: 'Retain this fixture first so the probe has a saved photo key.',
      });
      return;
    }

    setResolveState({ status: 'loading', fixtureId });
    void access.resolvePhoto(photoKey)
      .then((availability) => {
        if (!mountedRef.current) return;
        setResolveState({ status: 'ready', fixtureId, availability });
        setThumbnailRevision((revision) => revision + 1);
      })
      .catch((error: unknown) => {
        if (mountedRef.current) {
          setResolveState({ status: 'error', fixtureId, message: errorMessage(error) });
        }
      });
  }, [access, savedKeys, selectedFixture.id]);

  const removeRetainedPhoto = useCallback(() => {
    const photoKey = savedKeys[selectedFixture.id];
    if (photoKey === undefined) {
      setNotice('Retain this fixture before running the missing-file fault.');
      return;
    }

    setFaultBusy(true);
    void (async () => {
      try {
        const availability = await access.resolvePhoto(photoKey);
        if (availability.status !== 'available') {
          setNotice(`Cannot remove the retained file: ${availability.status}`);
          return;
        }
        const backup = faultBackupFile(photoKey);
        faultBackupDirectory().create({ intermediates: true, idempotent: true });
        if (backup.exists) backup.delete();
        await new File(availability.uri).copy(backup, { overwrite: false });
        new File(availability.uri).delete();
        setResolveState({ status: 'idle' });
        setThumbnailRevision((revision) => revision + 1);
        setNotice('Removed the retained fixture file. Resolve again to show missing explicitly.');
      } catch (error: unknown) {
        setNotice(`Fault operation failed: ${errorMessage(error)}`);
      } finally {
        if (mountedRef.current) setFaultBusy(false);
      }
    })();
  }, [access, savedKeys, selectedFixture.id]);

  const restoreRetainedPhoto = useCallback(() => {
    const photoKey = savedKeys[selectedFixture.id];
    if (photoKey === undefined) {
      setNotice('Retain this fixture before restoring its retained file.');
      return;
    }

    setFaultBusy(true);
    void (async () => {
      try {
        const availability = await access.resolvePhoto(photoKey);
        if (availability.status === 'available') {
          setNotice('The retained fixture file is already available.');
          return;
        }
        const backup = faultBackupFile(photoKey);
        if (!backup.exists) {
          setNotice('No probe-owned backup exists for this missing-file fault.');
          return;
        }
        await backup.copy(retainedPhotoFile(photoKey), { overwrite: false });
        backup.delete();
        setResolveState({ status: 'idle' });
        setThumbnailRevision((revision) => revision + 1);
        setNotice('Restored the retained fixture file under the same photo key.');
      } catch (error: unknown) {
        setNotice(`Restore operation failed: ${errorMessage(error)}`);
      } finally {
        if (mountedRef.current) setFaultBusy(false);
      }
    })();
  }, [access, savedKeys, selectedFixture.id]);

  return (
    <SafeAreaView className="flex-1 bg-ground-light dark:bg-ground-dark" edges={['top', 'bottom']}>
      <ScrollView
        contentContainerClassName="gap-4 px-5 pb-12 pt-8"
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-eyebrow font-semibold tracking-widest text-need-light dark:text-need-dark">
          DEVELOPMENT PROBE
        </Text>
        <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">
          Durable capture photos
        </Text>
        <Text className="text-body text-muted-light dark:text-muted-dark">
          Prepare, retain, resolve, remove, and restore a photo without touching the ledger.
        </Text>

        {!stateReady && stateError === null ? (
          <Text accessibilityLiveRegion="polite" className="text-body text-muted-light dark:text-muted-dark">
            Reading probe state…
          </Text>
        ) : null}
        {stateError !== null ? (
          <Text accessibilityRole="alert" className="text-body text-error-light dark:text-error-dark">
            Probe state unavailable: {stateError}
          </Text>
        ) : null}
        {stateError !== null ? (
          <Button variant="secondary" onPress={() => void loadState()}>
            Try again
          </Button>
        ) : null}

        <PhotoProbeFixtureSection
          disabled={selectionDisabled}
          fixtures={fixtures}
          selectedFixture={selectedFixture}
          onSelect={selectFixture}
        />
        <PhotoProbeLifecycleSection
          busy={busy || !stateReady}
          operation={operation}
          onCancel={cancel}
          onDiscard={discard}
          onPrepare={prepare}
          onRetain={retain}
        />
        <PhotoProbeSavedPhotoSection
          busy={busy}
          photoKey={savedPhotoKey}
          resolvePhoto={access.resolvePhoto}
          resolveState={resolveState}
          revision={thumbnailRevision}
          onRemove={removeRetainedPhoto}
          onResolve={resolveSavedPhoto}
          onRestore={restoreRetainedPhoto}
        />

        {notice !== null ? (
          <Text accessibilityLiveRegion="polite" className="text-detail text-muted-light dark:text-muted-dark" selectable>
            {notice}
          </Text>
        ) : null}
        <Text className="text-detail text-muted-light dark:text-muted-dark">
          Probe state file: capture-photo-probe.json. A force-quit/relaunch check is documented in the
          capture verification runbook.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
