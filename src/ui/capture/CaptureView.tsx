/**
 * Visual capture states and actions.
 *
 * This component renders injected state and callbacks only. The controller
 * keeps photo and database races out of the view so the same flow is easy to
 * exercise without a camera or SQLite connection.
 */
import type { RefObject } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  type TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, CrossFade, Input } from '../index';
import type { CaptureCamera, CapturePermission } from './capture-contract';
import {
  type CaptureFailure,
  type CaptureOperationState,
  isCaptureReviewState,
} from './capture-operation';

export type CaptureViewProps = {
  state: CaptureOperationState;
  permission: CapturePermission;
  camera: CaptureCamera;
  isFocused: boolean;
  isAppActive: boolean;
  amountRef: RefObject<TextInput | null>;
  amountText: string;
  amountError?: string;
  terminalPending: boolean;
  cancelDisabled: boolean;
  sourceUri?: string;
  reviewVisible: boolean;
  onAmountChange: (value: string) => void;
  onCameraReady: () => void;
  onCameraError: (error: unknown) => void;
  onTakePhoto: () => void;
  onDone: () => void;
  onSkipAmount: () => void;
  onCancel: () => void;
  onRetryPermission: () => void;
  onRetryPhoto: () => void;
  onRetrySubmit: () => void;
  onRetryNavigation: () => void;
  onRetake: () => void;
}

export function CaptureView({
  state,
  permission,
  camera,
  isFocused,
  isAppActive,
  amountRef,
  amountText,
  amountError,
  terminalPending,
  cancelDisabled,
  sourceUri,
  reviewVisible,
  onAmountChange,
  onCameraReady,
  onCameraError,
  onTakePhoto,
  onDone,
  onSkipAmount,
  onCancel,
  onRetryPermission,
  onRetryPhoto,
  onRetrySubmit,
  onRetryNavigation,
  onRetake,
}: CaptureViewProps) {
  const amountLocked =
    terminalPending ||
    (state.status === 'failed' &&
      (state.failure.kind === 'retention' ||
        state.failure.kind === 'database'));

  return (
    <SafeAreaView className="flex-1 bg-ground-light dark:bg-ground-dark" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerClassName="gap-5 px-5 pb-12 pt-6"
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-1">
            <Text className="text-eyebrow font-semibold tracking-widest text-need-light dark:text-need-dark">
              CARRYOVER · CAPTURE
            </Text>
            <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">
              Capture purchase
            </Text>
            <Text className="text-body text-muted-light dark:text-muted-dark">
              Take one photo. Add the amount now or leave it unknown.
            </Text>
          </View>

          {state.status === 'permission-loading' ? (
            <Text className="text-body text-muted-light dark:text-muted-dark">Checking camera permission…</Text>
          ) : null}
          {state.status === 'permission-undetermined' ? (
            <Text className="text-body text-muted-light dark:text-muted-dark">Requesting camera permission…</Text>
          ) : null}
          {permission.status === 'denied' ? (
            <View className="gap-3">
              <Text className="text-body text-muted-light dark:text-muted-dark">
                Camera access is needed to capture a purchase photo.
              </Text>
              {permission.canAskAgain ? (
                <Button onPress={onRetryPermission}>Retry permission</Button>
              ) : (
                <Button onPress={() => void permission.openSettings()}>Open Settings</Button>
              )}
              <Button variant="secondary" onPress={onCancel} disabled={cancelDisabled}>
                Cancel
              </Button>
            </View>
          ) : null}

          {permission.status === 'granted' && (state.status === 'live' || state.status === 'taking') ? (
            <View testID="capture-camera" className="h-96 overflow-hidden rounded-surface bg-surface-light dark:bg-surface-dark">
              {camera.renderPreview({
                active: isFocused && isAppActive,
                onReady: onCameraReady,
                onError: onCameraError,
              })}
            </View>
          ) : null}

          {reviewVisible && sourceUri ? (
            <Image
              accessibilityLabel="Captured purchase photo"
              source={{ uri: sourceUri }}
              className="h-96 w-full rounded-surface bg-surface-light dark:bg-surface-dark"
              resizeMode="contain"
            />
          ) : null}

          {permission.status === 'granted' && state.status !== 'taking' && state.status !== 'saved' ? (
            <Input
              ref={amountRef}
              testID="capture-amount"
              label="Amount (VND)"
              value={amountText}
              onChangeText={onAmountChange}
              error={amountError}
              keyboardType="number-pad"
              inputMode="numeric"
              autoCorrect={false}
              editable={!amountLocked}
              placeholder="Optional"
              accessibilityHint={amountError ?? 'Enter positive whole dong only.'}
            />
          ) : null}

          {state.status === 'live' ? (
            <View className="gap-3">
              <Button
                onPress={onTakePhoto}
                disabled={!state.cameraReady || !isFocused || !isAppActive}
                accessibilityLabel="Take photo"
                accessibilityHint="Take one back-camera photo of this purchase."
              >
                Take photo
              </Button>
              <Button variant="secondary" onPress={onCancel} disabled={cancelDisabled}>
                Cancel
              </Button>
            </View>
          ) : null}

          {state.status === 'taking' ? (
            <View className="gap-3">
              <Text className="text-body text-muted-light dark:text-muted-dark">Taking photo…</Text>
              <Button variant="secondary" onPress={onCancel} disabled={cancelDisabled}>
                Cancel
              </Button>
            </View>
          ) : null}

          {state.status === 'preparing' ? (
            <Text className="text-body text-muted-light dark:text-muted-dark">Preparing photo…</Text>
          ) : null}

          {isCaptureReviewState(state.status) && state.status !== 'failed' ? (
            <View className="gap-3">
              <Button onPress={onDone} disabled={terminalPending}>Done</Button>
              <Button variant="secondary" onPress={onSkipAmount} disabled={terminalPending}>
                Skip amount
              </Button>
              <Button variant="secondary" onPress={onCancel} disabled={cancelDisabled}>
                Cancel
              </Button>
            </View>
          ) : null}

          {state.status === 'failed' ? (
            <CaptureFailureView
              state={state}
              onRetryPermission={onRetryPermission}
              onRetryPhoto={onRetryPhoto}
              onRetrySubmit={onRetrySubmit}
              onRetryNavigation={onRetryNavigation}
              onRetake={onRetake}
              onCancel={onCancel}
              cancelDisabled={cancelDisabled}
            />
          ) : null}

          <CrossFade stateKey={state.status} intent="captureSaved">
            {state.status === 'saved' ? (
              <Text accessibilityLiveRegion="polite" className="text-body font-semibold text-need-light dark:text-need-dark">
                Saved. Returning home…
              </Text>
            ) : null}
          </CrossFade>

          {state.status === 'retaining' || state.status === 'writing' ? (
            <Text className="text-body text-muted-light dark:text-muted-dark">Saving…</Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function CaptureFailureView({
  state,
  onRetryPermission,
  onRetryPhoto,
  onRetrySubmit,
  onRetryNavigation,
  onRetake,
  onCancel,
  cancelDisabled,
}: {
  state: Extract<CaptureOperationState, { status: 'failed' }>;
  onRetryPermission: () => void;
  onRetryPhoto: () => void;
  onRetrySubmit: () => void;
  onRetryNavigation: () => void;
  onRetake: () => void;
  onCancel: () => void;
  cancelDisabled: boolean;
}) {
  const { failure } = state;
  return (
    <View className="gap-3">
      <Text accessibilityRole="alert" className="text-body text-error-light dark:text-error-dark">
        {failure.message}
      </Text>
      {failure.kind === 'permission' ? <Button onPress={onRetryPermission}>Retry permission</Button> : null}
      {failure.kind === 'camera' ? <Button onPress={onRetryPhoto}>Try camera again</Button> : null}
      {failure.kind === 'photo' ? <Button onPress={onRetryPhoto}>Retry photo</Button> : null}
      {failure.kind === 'retention' || failure.kind === 'database' ? (
        <Button onPress={onRetrySubmit}>Try again</Button>
      ) : null}
      {failure.kind === 'navigation' ? <Button onPress={onRetryNavigation}>Back to home</Button> : null}
      {failure.kind === 'cancellation' ? (
        <Button onPress={onCancel} disabled={cancelDisabled}>Try again</Button>
      ) : null}
      {failure.kind === 'photo' || failure.kind === 'retention' || failure.kind === 'cancellation' ? (
        <Button variant="secondary" onPress={onRetake} disabled={cancelDisabled}>Retake</Button>
      ) : null}
      {failure.kind !== 'navigation' && failure.kind !== 'database' ? (
        <Button variant="secondary" onPress={onCancel} disabled={cancelDisabled}>Cancel</Button>
      ) : null}
    </View>
  );
}
