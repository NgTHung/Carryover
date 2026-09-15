import type {
  DiscardPhotoResult,
  PhotoAvailability,
  PhotoSource,
  PreparePhotoResult,
  PreparedPhoto,
  RetainPhotoResult,
  RetainedPhoto,
} from '../../photos/photo-contract';
import type { PreparePhotoOptions } from '../../photos/photo-store';
import type {
  PhotoProbeFixtureId,
  PhotoProbeSavedKeys,
} from '../../app/diagnostics/photo-probe-contract';

export type PhotoProbeAccess = {
  preparePhoto: (
    source: PhotoSource,
    options?: PreparePhotoOptions
  ) => Promise<PreparePhotoResult>;
  retainPhoto: (prepared: PreparedPhoto) => Promise<RetainPhotoResult>;
  discardPreparedPhoto: (prepared: PreparedPhoto) => Promise<DiscardPhotoResult>;
  resolvePhoto: (photoKey: string | null) => Promise<PhotoAvailability>;
};

export type PhotoProbeScreenProps<TFixture> = {
  access: PhotoProbeAccess;
  fixtures: readonly [TFixture, ...TFixture[]];
  loadFixture: (fixture: TFixture) => Promise<string>;
  readSavedKeys: () => Promise<PhotoProbeSavedKeys>;
  writeSavedKeys: (savedKeys: PhotoProbeSavedKeys) => void;
};

export type ProbeOperation =
  | { status: 'ready' }
  | { status: 'preparing'; fixtureId: PhotoProbeFixtureId }
  | { status: 'prepared'; fixtureId: PhotoProbeFixtureId; photo: PreparedPhoto }
  | { status: 'retaining'; fixtureId: PhotoProbeFixtureId; photo: PreparedPhoto }
  | { status: 'discarding'; fixtureId: PhotoProbeFixtureId; photo: PreparedPhoto }
  | { status: 'retained'; fixtureId: PhotoProbeFixtureId; photo: RetainedPhoto }
  | { status: 'error'; fixtureId: PhotoProbeFixtureId | null; message: string };

export type ResolveState =
  | { status: 'idle' }
  | { status: 'loading'; fixtureId: PhotoProbeFixtureId }
  | {
      status: 'ready';
      fixtureId: PhotoProbeFixtureId;
      availability: PhotoAvailability;
    }
  | { status: 'error'; fixtureId: PhotoProbeFixtureId; message: string };
