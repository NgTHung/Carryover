/** Browser bundling boundary for the iPhone-only probe fixtures. */
export const PHOTO_PROBE_FIXTURES = [] as const;

export async function loadPhotoProbeFixture(): Promise<string> {
  throw new Error('Capture photo fixtures are unavailable in the browser preview');
}
