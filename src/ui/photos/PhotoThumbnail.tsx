/**
 * Renders a retained capture without making the ledger responsible for file
 * availability. The resolver is injected so this component stays usable in
 * tests and on the browser, where native photo storage does not exist.
 */
import { useEffect, useRef, useState } from 'react';
import { Image, Text, View } from 'react-native';

import type { PhotoAvailability, PhotoKey } from '../../photos/photo-contract';

export type PhotoThumbnailResolver = (
  photoKey: string
) => Promise<PhotoAvailability>;

export type PhotoThumbnailProps = {
  photoKey: PhotoKey | string | null;
  resolvePhoto: PhotoThumbnailResolver;
  revision?: number;
  size?: number;
  testID?: string;
};

type PhotoThumbnailState =
  | { status: 'loading'; photoKey: string }
  | { status: 'absent'; photoKey: null }
  | { status: 'available'; photoKey: string; uri: string }
  | { status: 'unavailable'; photoKey: string };

function initialState(photoKey: PhotoThumbnailProps['photoKey']): PhotoThumbnailState {
  return photoKey === null
    ? { status: 'absent', photoKey: null }
    : { status: 'loading', photoKey };
}

function unavailableState(photoKey: string): PhotoThumbnailState {
  return { status: 'unavailable', photoKey };
}

function isCurrentPhoto(
  state: PhotoThumbnailState,
  photoKey: PhotoThumbnailProps['photoKey']
): boolean {
  return state.photoKey === photoKey;
}

export function PhotoThumbnail({
  photoKey,
  resolvePhoto,
  revision = 0,
  size = 96,
  testID,
}: PhotoThumbnailProps) {
  const [state, setState] = useState<PhotoThumbnailState>(() => initialState(photoKey));
  const requestNumber = useRef(0);

  useEffect(() => {
    const request = requestNumber.current + 1;
    requestNumber.current = request;

    if (photoKey === null) {
      setState({ status: 'absent', photoKey: null });
      return undefined;
    }

    let active = true;
    setState({ status: 'loading', photoKey });

    void resolvePhoto(photoKey)
      .then((availability) => {
        if (!active || requestNumber.current !== request) return;

        if (availability.status === 'available') {
          setState({
            status: 'available',
            photoKey,
            uri: availability.uri,
          });
          return;
        }

        setState(unavailableState(photoKey));
      })
      .catch(() => {
        if (!active || requestNumber.current !== request) return;
        setState(unavailableState(photoKey));
      });

    return () => {
      active = false;
    };
  }, [photoKey, resolvePhoto, revision]);

  const displayedState = isCurrentPhoto(state, photoKey)
    ? state
    : initialState(photoKey);
  const containerClassName =
    'overflow-hidden rounded-surface border border-faint-light bg-surface-light dark:border-faint-dark dark:bg-surface-dark';
  const sizeStyle = { width: size, height: size };

  if (displayedState.status === 'available') {
    return (
      <Image
        accessibilityLabel="Photo"
        className="rounded-surface border border-faint-light dark:border-faint-dark"
        source={{ uri: displayedState.uri }}
        style={sizeStyle}
        testID={testID}
        onError={() => {
          setState((current) =>
            current.status === 'available' &&
            current.photoKey === displayedState.photoKey
              ? unavailableState(displayedState.photoKey)
              : current
          );
        }}
      />
    );
  }

  const label =
    displayedState.status === 'loading'
      ? 'Loading photo'
      : displayedState.status === 'absent'
        ? 'No photo'
        : 'Photo unavailable';
  const message =
    displayedState.status === 'loading'
      ? 'Loading photo…'
      : displayedState.status === 'absent'
        ? 'No photo'
        : 'Photo unavailable';

  return (
    <View
      accessible
      accessibilityLabel={label}
      className={`${containerClassName} items-center justify-center px-2`}
      style={sizeStyle}
      testID={testID}
    >
      <Text className="text-center text-detail text-muted-light dark:text-muted-dark">
        {message}
      </Text>
    </View>
  );
}
