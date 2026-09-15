import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { View } from 'react-native';

import type { CapturedDraftWriteResult } from '../src/data/captured-drafts';
import {
  CaptureScreen,
  type CaptureCamera,
  type CapturePermission,
  type CapturePhotoAccess,
} from '../src/ui/capture/CaptureScreen';
import type { PreparedPhoto, RetainedPhoto } from '../src/photos/photo-contract';

const draftId = '123e4567-e89b-42d3-a456-426614174000';
const photoKey = 'photos/v1/123e4567-e89b-42d3-a456-426614174001.jpg';
const occurredAt = new Date(2026, 8, 15, 12, 30);

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
} {
  let resolvePromise: (value: T) => void = () => undefined;
  let rejectPromise: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

const prepared: PreparedPhoto = {
  status: 'prepared',
  preparationId: 'capture-1',
  photoKey,
  stagingUri: 'file:///staging/capture-1.jpg',
  encodedUri: 'file:///cache/capture-1.jpg',
  metrics: {
    originalDimensions: { width: 1_200, height: 900 },
    outputDimensions: { width: 1_200, height: 900 },
    bytes: 180_000,
    attempt: 2,
    elapsedMs: 40,
  },
  cleanupIssues: [],
};

const retained: RetainedPhoto = {
  status: 'retained',
  preparationId: prepared.preparationId,
  photoKey,
  uri: 'file:///documents/photos/v1/123e4567-e89b-42d3-a456-426614174001.jpg',
  metrics: prepared.metrics,
  cleanupIssues: [],
};

const savedDraft: CapturedDraftWriteResult = {
  status: 'created',
  transaction: {
    id: draftId,
    accountId: '123e4567-e89b-42d3-a456-426614174002',
    direction: 'expense',
    adjustmentEffect: null,
    amount: 45_001,
    categoryId: null,
    quality: null,
    payer: { kind: 'you' },
    occurredAt,
    status: 'draft',
    photoKey,
    note: null,
    sourceLabel: null,
    createdAt: occurredAt,
    updatedAt: occurredAt,
    deletedAt: null,
  },
};

type Harness = {
  view: Awaited<ReturnType<typeof render>>;
  camera: CaptureCamera;
  photos: CapturePhotoAccess;
  createCapturedDraft: jest.MockedFunction<
    (input: {
      draftId: string;
      photoKey: string;
      amount: string | number | null;
      occurredAt: Date;
    }) => Promise<CapturedDraftWriteResult>
  >;
  navigateHome: jest.Mock;
  ready: () => void;
  picture: ReturnType<typeof deferred<{ uri: string }>>;
};

afterEach(() => {
  cleanup();
});

async function createHarness(overrides: {
  preparePhoto?: CapturePhotoAccess['preparePhoto'];
  retainPhoto?: CapturePhotoAccess['retainPhoto'];
  createCapturedDraft?: Harness['createCapturedDraft'];
  permission?: CapturePermission;
  onNavigateHome?: jest.Mock;
} = {}): Promise<Harness> {
  let readyCallback: () => void = () => undefined;
  const picture = deferred<{ uri: string }>();
  const camera: CaptureCamera = {
    renderPreview: jest.fn(({ onReady }) => {
      readyCallback = onReady;
      return <View testID="mock-camera" />;
    }),
    takePicture: jest.fn(() => picture.promise),
  };
  const photos: CapturePhotoAccess = {
    preparePhoto:
      jest.fn(
        overrides.preparePhoto ??
          (async () => ({ status: 'prepared' as const, photo: prepared }))
      ) as CapturePhotoAccess['preparePhoto'],
    retainPhoto:
      jest.fn(
        overrides.retainPhoto ??
          (async () => ({ status: 'retained' as const, photo: retained }))
      ) as CapturePhotoAccess['retainPhoto'],
    discardPreparedPhoto: jest.fn(async () => ({
        status: 'discarded' as const,
        photo: { status: 'discarded' as const, preparationId: prepared.preparationId, photoKey },
      })),
  };
  const createCapturedDraft =
    overrides.createCapturedDraft ??
    jest.fn(async (input) => ({
      ...savedDraft,
      transaction: { ...savedDraft.transaction, amount: input.amount as number | null },
    }));
  const navigateHome = jest.fn();
  const onNavigateHome = overrides.onNavigateHome ?? navigateHome;
  const view = await render(
    <CaptureScreen
      draftId={draftId}
      camera={camera}
      permission={overrides.permission ?? { status: 'granted' }}
      photos={photos}
      createCapturedDraft={createCapturedDraft}
      readTransaction={jest.fn(async () => undefined)}
      isFocused
      isAppActive
      onCancel={navigateHome}
      onNavigateHome={onNavigateHome}
      now={() => occurredAt}
    />
  );
  return {
    view,
    camera,
    photos,
    createCapturedDraft,
    navigateHome,
    ready: () => readyCallback(),
    picture,
  };
}

async function captureAndReview(harness: Harness): Promise<void> {
  await act(async () => harness.ready());
  expect(screen.getByRole('button', { name: 'Take photo' }).props.accessibilityState?.disabled).toBe(false);
  await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
  await act(async () => harness.picture.resolve({ uri: 'camera://receipt.jpg' }));
  await waitFor(() => expect(screen.getByLabelText('Captured purchase photo')).toBeTruthy());
}

test('gates the shutter until camera-ready, locks duplicate presses, and focuses numeric amount input', async () => {
  const harness = await createHarness();
  expect(screen.getByRole('button', { name: 'Take photo' }).props.accessibilityState?.disabled).toBe(true);
  const amount = screen.getByTestId('capture-amount');
  expect(amount.props.keyboardType).toBe('number-pad');
  expect(amount.props.inputMode).toBe('numeric');
  expect(amount.props.autoCorrect).toBe(false);

  await act(async () => harness.ready());
  expect(screen.getByRole('button', { name: 'Take photo' }).props.accessibilityState?.disabled).toBe(false);
  const shutter = screen.getByRole('button', { name: 'Take photo' });
  await act(async () => {
    shutter.props.onClick();
    shutter.props.onClick();
  });
  expect(harness.camera.takePicture).toBeDefined();
  await act(async () => harness.picture.resolve({ uri: 'camera://receipt.jpg' }));
  await waitFor(() => expect(screen.getByLabelText('Captured purchase photo')).toBeTruthy());
  expect(harness.photos.preparePhoto).toHaveBeenCalledTimes(1);
});

test('Done validates money before retention', async () => {
  const invalid = await createHarness();
  await captureAndReview(invalid);
  await fireEvent.changeText(screen.getByTestId('capture-amount'), '0');
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  expect(screen.getByRole('alert').props.children).toMatch(/positive whole-dong/i);
  expect(invalid.photos.retainPhoto).not.toHaveBeenCalled();
  expect(invalid.createCapturedDraft).not.toHaveBeenCalled();
});

test('Skip amount writes null in one tap', async () => {
  const skipped = await createHarness();
  await captureAndReview(skipped);
  await fireEvent.changeText(screen.getByTestId('capture-amount'), '45001');
  await fireEvent.press(screen.getByRole('button', { name: 'Skip amount' }));
  await waitFor(() => expect(skipped.createCapturedDraft).toHaveBeenCalledWith({
    draftId,
    photoKey,
    amount: null,
    occurredAt,
  }));
  expect(skipped.navigateHome).toHaveBeenCalledTimes(1);
});

test('waits for retention before SQLite and retries a database failure without another photo operation', async () => {
  const createCapturedDraft = jest
    .fn()
    .mockRejectedValueOnce(new Error('SQLite unavailable'))
    .mockResolvedValueOnce(savedDraft);
  const harness = await createHarness({ createCapturedDraft });
  await captureAndReview(harness);
  await fireEvent.changeText(screen.getByTestId('capture-amount'), '45001');
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  await waitFor(() => expect(screen.getByRole('alert').props.children).toContain('SQLite unavailable'));
  expect(harness.photos.preparePhoto).toHaveBeenCalledTimes(1);
  expect(harness.photos.retainPhoto).toHaveBeenCalledTimes(1);
  expect(createCapturedDraft).toHaveBeenCalledTimes(1);

  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(createCapturedDraft).toHaveBeenCalledTimes(2));
  expect(harness.photos.preparePhoto).toHaveBeenCalledTimes(1);
  expect(harness.photos.retainPhoto).toHaveBeenCalledTimes(1);
  expect(harness.navigateHome).toHaveBeenCalledTimes(1);
});

test('navigation failure retries home without repeating capture persistence', async () => {
  const navigateHome = jest
    .fn()
    .mockImplementationOnce(() => {
      throw new Error('Navigation unavailable');
    })
    .mockResolvedValueOnce(undefined);
  const harness = await createHarness({ onNavigateHome: navigateHome });
  await captureAndReview(harness);
  await fireEvent.press(screen.getByRole('button', { name: 'Skip amount' }));

  await waitFor(() => expect(screen.getByRole('alert').props.children).toContain('Navigation unavailable'));
  expect(harness.photos.preparePhoto).toHaveBeenCalledTimes(1);
  expect(harness.photos.retainPhoto).toHaveBeenCalledTimes(1);
  expect(harness.createCapturedDraft).toHaveBeenCalledTimes(1);

  await fireEvent.press(screen.getByRole('button', { name: 'Back to home' }));
  await waitFor(() => expect(navigateHome).toHaveBeenCalledTimes(2));
  expect(harness.photos.preparePhoto).toHaveBeenCalledTimes(1);
  expect(harness.photos.retainPhoto).toHaveBeenCalledTimes(1);
  expect(harness.createCapturedDraft).toHaveBeenCalledTimes(1);
});

test('cancellation awaits preparation cleanup before navigating', async () => {
  const preparation = deferred<Awaited<ReturnType<CapturePhotoAccess['preparePhoto']>>>();
  let signal: AbortSignal | undefined;
  const harness = await createHarness({
    preparePhoto: async (_source, options) => {
      signal = options?.signal;
      return preparation.promise;
    },
  });
  await act(async () => harness.ready());
  await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
  await act(async () => harness.picture.resolve({ uri: 'camera://receipt.jpg' }));
  await waitFor(() => expect(harness.photos.preparePhoto).toHaveBeenCalled());

  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(signal?.aborted).toBe(true);
  expect(harness.navigateHome).not.toHaveBeenCalled();

  await act(async () => preparation.resolve({ status: 'prepared', photo: prepared }));
  await waitFor(() => expect(harness.photos.discardPreparedPhoto).toHaveBeenCalledWith(prepared));
  expect(harness.navigateHome).toHaveBeenCalledTimes(1);
  expect(harness.createCapturedDraft).not.toHaveBeenCalled();
});

test('cancellation while taking waits for the camera promise and never starts photo work', async () => {
  const harness = await createHarness();
  await act(async () => harness.ready());
  await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
  await waitFor(() => expect(screen.getByText('Taking photo…')).toBeTruthy());

  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(harness.navigateHome).not.toHaveBeenCalled();
  expect(harness.photos.preparePhoto).not.toHaveBeenCalled();

  await act(async () => harness.picture.resolve({ uri: 'camera://receipt.jpg' }));
  await waitFor(() => expect(harness.navigateHome).toHaveBeenCalledTimes(1));
  expect(harness.photos.preparePhoto).not.toHaveBeenCalled();
});

test('requests undetermined permission once and does not open the camera while waiting', async () => {
  const request = jest.fn(async () => undefined);
  const harness = await createHarness({
    permission: { status: 'undetermined', request },
  });

  await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  expect(screen.getByText('Requesting camera permission…')).toBeTruthy();
  expect(harness.camera.renderPreview).not.toHaveBeenCalled();
});

test('denied permission offers retry or Settings and cancellation never touches the camera', async () => {
  const request = jest.fn(async () => undefined);
  const openSettings = jest.fn(async () => undefined);
  const harness = await createHarness({
    permission: {
      status: 'denied',
      canAskAgain: false,
      request,
      openSettings,
    },
  });

  expect(screen.getByRole('button', { name: 'Open Settings' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Open Settings' }));
  expect(openSettings).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(harness.navigateHome).toHaveBeenCalledTimes(1);
  expect(request).not.toHaveBeenCalled();
  expect(harness.camera.renderPreview).not.toHaveBeenCalled();
});
