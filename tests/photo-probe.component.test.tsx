import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type {
  PhotoAvailability,
  DiscardedPhoto,
  FailedPhoto,
  PhotoError,
  PhotoKey,
  PhotoMetrics,
  PreparePhotoResult,
  PreparedPhoto,
} from '../src/photos/photo-contract';
import { PhotoProbeScreen } from '../src/ui/diagnostics/PhotoProbeScreen';
import type { PhotoProbeFixture } from '../src/app/diagnostics/photo-probe-contract';
import type { PhotoProbeAccess } from '../src/ui/diagnostics/photo-probe-types';

const fixture: PhotoProbeFixture = {
  id: 'portrait-receipt',
  label: 'Portrait receipt',
  description: 'Receipt fixture',
  sourceType: 'png',
};
const fixtures = [fixture] as const;
const photoKey = 'photos/v1/123e4567-e89b-42d3-a456-426614174000.jpg' as PhotoKey;
const metrics: PhotoMetrics = {
  originalDimensions: { width: 1200, height: 1800 },
  outputDimensions: { width: 1067, height: 1600 },
  bytes: 120000,
  attempt: 1,
  elapsedMs: 12,
};
const prepared: PreparedPhoto = {
  status: 'prepared',
  preparationId: 'capture-test',
  photoKey,
  stagingUri: 'file:///staging/capture-test.jpg',
  encodedUri: 'file:///cache/capture-test.jpg',
  metrics,
  cleanupIssues: [],
};
const failedError: PhotoError = {
  phase: 'encode',
  code: 'photo-encode-failed',
  message: 'Fixture encoder failed',
  context: {},
};
const failedPreparation: FailedPhoto = {
  status: 'failed',
  preparationId: 'capture-test',
  photoKey: null,
  error: failedError,
  cleanupIssues: [],
};
const discardedPhoto: DiscardedPhoto = {
  status: 'discarded',
  preparationId: 'capture-test',
  photoKey,
};

afterEach(() => {
  cleanup();
});

function absentPhoto(): PhotoAvailability {
  return { status: 'absent' };
}

function screenProps(access: PhotoProbeAccess) {
  return {
    access,
    fixtures,
    loadFixture: async () => 'file:///bundle/portrait-receipt.png',
    readSavedKeys: async () => ({}),
    writeSavedKeys: () => undefined,
  };
}

test('shows a state-file error and recovers through the retry control', async () => {
  let readCount = 0;
  const access: PhotoProbeAccess = {
    preparePhoto: async () => ({ status: 'failed', preparation: failedPreparation }),
    retainPhoto: async () => ({ status: 'failed', preparation: failedPreparation }),
    discardPreparedPhoto: async () => ({ status: 'failed', preparation: failedPreparation }),
    resolvePhoto: async () => absentPhoto(),
  };
  const props = {
    ...screenProps(access),
    readSavedKeys: async () => {
      readCount += 1;
      if (readCount === 1) throw new Error('probe file is unreadable');
      return {};
    },
  };

  await render(<PhotoProbeScreen {...props} />);
  expect(await screen.findByText('Probe state unavailable: probe file is unreadable')).toBeTruthy();

  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  });

  await waitFor(() => {
    expect(screen.queryByText('Probe state unavailable: probe file is unreadable')).toBeNull();
    expect(screen.getByRole('button', { name: 'Prepare photo' }).props.accessibilityState?.disabled).not.toBe(true);
  });
});

test('shows a native failure and allows the same fixture to be retried', async () => {
  let attempts = 0;
  const preparePhoto = jest.fn<Promise<PreparePhotoResult>, Parameters<PhotoProbeAccess['preparePhoto']>>(
    async () => {
      attempts += 1;
      return attempts === 1
        ? {
            status: 'failed',
            preparation: failedPreparation,
          }
        : { status: 'prepared', photo: prepared };
    }
  );
  const access: PhotoProbeAccess = {
    preparePhoto,
    retainPhoto: async () => ({ status: 'failed', preparation: failedPreparation }),
    discardPreparedPhoto: async () => ({ status: 'discarded', photo: discardedPhoto }),
    resolvePhoto: async () => absentPhoto(),
  };

  await render(<PhotoProbeScreen {...screenProps(access)} />);
  const prepareButton = await screen.findByRole('button', { name: 'Prepare photo' });

  await act(async () => {
    fireEvent.press(prepareButton);
  });
  expect(await screen.findByText('Photo operation failed: Fixture encoder failed')).toBeTruthy();

  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: 'Prepare photo' }));
  });
  expect(await screen.findByText('Prepared, not retained.')).toBeTruthy();
  expect(preparePhoto).toHaveBeenCalledTimes(2);
});
