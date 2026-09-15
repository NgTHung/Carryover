/**
 * Contracts at the boundary between the capture controller and native edges.
 *
 * The UI receives camera, photo-store, and ledger functions so its races can
 * be tested with deferred promises instead of a physical device.
 */
import type { ReactNode } from 'react';

import type { CreateCapturedDraftInput } from '../../data/captured-draft-validation';
import type { CapturedDraftWriteResult } from '../../data/captured-drafts';
import type { Transaction } from '../../data/transaction-validation';
import type { PhotoStore } from '../../photos/photo-store';

export type CaptureCameraPreviewProps = {
  active: boolean;
  onReady: () => void;
  onError: (error: unknown) => void;
};

export type CaptureCamera = {
  renderPreview: (props: CaptureCameraPreviewProps) => ReactNode;
  takePicture: () => Promise<{ uri: string } | undefined>;
};

export type CapturePermission =
  | { status: 'loading' }
  | { status: 'undetermined'; request: () => Promise<unknown> }
  | { status: 'granted'; refresh?: () => Promise<unknown> }
  | {
      status: 'denied';
      canAskAgain: boolean;
      request: () => Promise<unknown>;
      openSettings: () => Promise<unknown>;
      refresh?: () => Promise<unknown>;
    };

export type CapturePhotoAccess = Pick<
  PhotoStore,
  'preparePhoto' | 'retainPhoto' | 'discardPreparedPhoto'
>;

export type CaptureScreenProps = {
  draftId: string;
  camera: CaptureCamera;
  permission: CapturePermission;
  photos: CapturePhotoAccess;
  createCapturedDraft: (
    input: CreateCapturedDraftInput
  ) => Promise<CapturedDraftWriteResult>;
  readTransaction?: (id: string) => Promise<Transaction | undefined>;
  isFocused: boolean;
  isAppActive: boolean;
  onCancel: () => void | Promise<void>;
  onNavigateHome: () => void | Promise<void>;
  onTerminalPending?: (pending: boolean) => void;
  now?: () => Date;
};
