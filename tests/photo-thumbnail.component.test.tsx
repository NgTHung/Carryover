import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import type {
  PhotoAvailability,
  PhotoError,
  PhotoKey,
} from '../src/photos/photo-contract';
import { PhotoThumbnail } from '../src/ui/photos/PhotoThumbnail';

const firstKey = 'photos/v1/123e4567-e89b-42d3-a456-426614174000.jpg' as PhotoKey;
const secondKey = 'photos/v1/123e4567-e89b-42d3-a456-426614174001.jpg' as PhotoKey;

const resolutionError: PhotoError = {
  phase: 'resolve',
  code: 'fixture-unavailable',
  message: 'Fixture photo is unavailable',
  context: {},
};

function available(photoKey: PhotoKey, uri = `file://${photoKey}`): PhotoAvailability {
  return { status: 'available', photoKey, uri };
}

function unavailable(
  photoKey: string,
  reason: 'missing' | 'invalid-key' | 'unreadable' | 'unsupported-platform'
): PhotoAvailability {
  return {
    status: 'unavailable',
    photoKey,
    reason,
    message: resolutionError.message,
    error: resolutionError,
  };
}

afterEach(() => {
  cleanup();
});

test('does not resolve an absent photo and announces the explicit empty state', async () => {
  const resolvePhoto = jest.fn<Promise<PhotoAvailability>, [string]>();

  await render(<PhotoThumbnail photoKey={null} resolvePhoto={resolvePhoto} />);

  expect(screen.getByLabelText('No photo')).toBeTruthy();
  expect(screen.getByText('No photo')).toBeTruthy();
  expect(resolvePhoto).not.toHaveBeenCalled();
});

test('shows loading, then an available retained photo', async () => {
  let finish: (value: PhotoAvailability) => void = () => undefined;
  const resolvePhoto = jest.fn(
    () => new Promise<PhotoAvailability>((resolve) => { finish = resolve; })
  );

  await render(<PhotoThumbnail photoKey={firstKey} resolvePhoto={resolvePhoto} testID="photo" />);

  expect(screen.getByLabelText('Loading photo')).toBeTruthy();
  expect(resolvePhoto).toHaveBeenCalledWith(firstKey);

  await act(async () => {
    finish(available(firstKey, 'file:///retained/first.jpg'));
  });

  await waitFor(() => expect(screen.getByLabelText('Photo')).toBeTruthy());
  expect(screen.getByTestId('photo').props.source).toEqual({
    uri: 'file:///retained/first.jpg',
  });
});

test.each([
  ['missing', 'missing'],
  ['invalid key', 'invalid-key'],
  ['unreadable', 'unreadable'],
  ['unsupported platform', 'unsupported-platform'],
] as const)('renders %s as unavailable', async (_label, reason) => {
  const resolvePhoto = jest.fn(async (photoKey: string) => unavailable(photoKey, reason));

  await render(<PhotoThumbnail photoKey={firstKey} resolvePhoto={resolvePhoto} />);

  await waitFor(() => expect(screen.getByLabelText('Photo unavailable')).toBeTruthy());
  expect(screen.getByText('Photo unavailable')).toBeTruthy();
});

test('turns an image load error into an unavailable state', async () => {
  const resolvePhoto = jest.fn(async () => available(firstKey, 'file:///retained/first.jpg'));
  await render(<PhotoThumbnail photoKey={firstKey} resolvePhoto={resolvePhoto} testID="photo" />);

  const image = await screen.findByLabelText('Photo');
  await fireEvent(image, 'error');

  expect(screen.getByLabelText('Photo unavailable')).toBeTruthy();
  expect(screen.queryByLabelText('Photo')).toBeNull();
});

test('ignores a late result for a previous key and reloads when revision changes', async () => {
  const completions: Array<(value: PhotoAvailability) => void> = [];
  const resolvePhoto = jest.fn(
    () => new Promise<PhotoAvailability>((resolve) => { completions.push(resolve); })
  );
  const view = await render(
    <PhotoThumbnail
      photoKey={firstKey}
      resolvePhoto={resolvePhoto}
      revision={0}
      testID="photo"
    />
  );

  await view.rerender(
    <PhotoThumbnail
      photoKey={secondKey}
      resolvePhoto={resolvePhoto}
      revision={0}
      testID="photo"
    />
  );
  await act(async () => {
    completions[1]?.(available(secondKey, 'file:///retained/second.jpg'));
  });
  await waitFor(() => expect(screen.getByLabelText('Photo')).toBeTruthy());

  await act(async () => {
    completions[0]?.(available(firstKey, 'file:///retained/stale.jpg'));
  });
  expect(screen.getByTestId('photo').props.source).toEqual({
    uri: 'file:///retained/second.jpg',
  });

  await view.rerender(
    <PhotoThumbnail photoKey={secondKey} resolvePhoto={resolvePhoto} revision={1} testID="photo" />
  );
  expect(resolvePhoto).toHaveBeenCalledTimes(3);
  expect(screen.getByLabelText('Loading photo')).toBeTruthy();
  await act(async () => {
    completions[2]?.(available(secondKey, 'file:///retained/reloaded.jpg'));
  });
  await waitFor(() => expect(screen.getByTestId('photo').props.source).toEqual({
    uri: 'file:///retained/reloaded.jpg',
  }));
});

test('renders resolver rejection as unavailable instead of leaving a stale thumbnail', async () => {
  const resolvePhoto = jest.fn(async () => {
    throw new Error('storage read failed');
  });

  await render(<PhotoThumbnail photoKey={firstKey} resolvePhoto={resolvePhoto} />);

  await waitFor(() => expect(screen.getByLabelText('Photo unavailable')).toBeTruthy());
});
