/**
 * Shared shape for the development-only capture probe.
 *
 * The probe owns its fixture labels and saved-key file separately from the
 * ledger so a device check cannot create or rewrite user transactions.
 */
export const PHOTO_PROBE_FIXTURE_IDS = [
  'portrait-receipt',
  'landscape-purchase',
  'dark-noisy',
  'detailed-scene',
  'already-small',
  'rotated-orientation',
  'supported-heic',
] as const;

export type PhotoProbeFixtureId = (typeof PHOTO_PROBE_FIXTURE_IDS)[number];

export type PhotoProbeFixture = {
  readonly id: PhotoProbeFixtureId;
  readonly label: string;
  readonly description: string;
  readonly sourceType: 'png' | 'jpeg' | 'heic';
};

export type PhotoProbeSavedKeys = Partial<
  Record<PhotoProbeFixtureId, import('../../photos/photo-contract').PhotoKey>
>;

export function isPhotoProbeFixtureId(
  value: string
): value is PhotoProbeFixtureId {
  return PHOTO_PROBE_FIXTURE_IDS.some((id) => id === value);
}
