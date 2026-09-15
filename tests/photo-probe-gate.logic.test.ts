import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { isPhotoProbeEnabled } from '../src/diagnostics/photos/photo-probe-gate';

test('enables the photo probe only for the development variant', () => {
  expect(isPhotoProbeEnabled('development')).toBe(true);
  expect(isPhotoProbeEnabled('release')).toBe(false);
  expect(isPhotoProbeEnabled(undefined)).toBe(false);
  expect(isPhotoProbeEnabled('developmnt')).toBe(false);
});

test('keeps probe helpers outside the Expo Router directory', () => {
  const diagnosticsRoutes = readdirSync(
    resolve(__dirname, '../src/app/diagnostics')
  ).sort();

  expect(diagnosticsRoutes).toEqual([
    'photos.native.tsx',
    'photos.tsx',
    'photos.web.tsx',
  ]);
});
