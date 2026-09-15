import { isPhotoProbeEnabled } from '../src/app/diagnostics/photo-probe-gate';

test('enables the photo probe only for the development variant', () => {
  expect(isPhotoProbeEnabled('development')).toBe(true);
  expect(isPhotoProbeEnabled('release')).toBe(false);
  expect(isPhotoProbeEnabled(undefined)).toBe(false);
  expect(isPhotoProbeEnabled('developmnt')).toBe(false);
});
