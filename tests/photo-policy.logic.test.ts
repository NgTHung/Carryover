import { strict as assert } from 'node:assert';

import {
  PHOTO_ENCODING_ATTEMPTS,
  PHOTO_TARGET_BYTES,
  planPhotoEncoding,
  resizePhotoDimensions,
  selectPhotoCandidate,
  type EncodedPhotoCandidate,
} from '../src/photos/photo-policy';
import {
  isPhotoKey,
  parsePhotoKey,
  photoKeySchema,
} from '../src/photos/photo-contract';

function candidate(
  attempt: number,
  bytes: number,
  overrides: Partial<EncodedPhotoCandidate> = {}
): EncodedPhotoCandidate {
  return {
    originalDimensions: { width: 4_000, height: 3_000 },
    outputDimensions: { width: 1_600, height: 1_200 },
    bytes,
    attempt,
    elapsedMs: 20,
    uri: `cache-${attempt}.jpg`,
    ...overrides,
  };
}

test('photo keys use the strict lowercase v4 JPEG grammar', () => {
  const valid = 'photos/v1/123e4567-e89b-42d3-a456-426614174000.jpg';

  assert.equal(photoKeySchema.safeParse(valid).success, true);
  assert.equal(parsePhotoKey(valid), valid);
  assert.equal(isPhotoKey(valid), true);

  for (const invalid of [
    'photos/v2/123e4567-e89b-42d3-a456-426614174000.jpg',
    'photos/v1/123E4567-e89b-42d3-a456-426614174000.jpg',
    'photos/v1/123e4567-e89b-52d3-a456-426614174000.jpg',
    'photos/v1/123e4567-e89b-42d3-c456-426614174000.jpg',
    'photos/v1/123e4567-e89b-42d3-a456-426614174000.png',
    '/photos/v1/123e4567-e89b-42d3-a456-426614174000.jpg',
    'photos/v1/../123e4567-e89b-42d3-a456-426614174000.jpg',
    'photos/v1/%2e%2e/123e4567-e89b-42d3-a456-426614174000.jpg',
    'photos/v1/123e4567-e89b-42d3-a456-426614174000.jpg/extra',
    'photos/v1/123e4567-e89b-42d3-a456-426614174000.jpg\n',
  ]) {
    assert.equal(isPhotoKey(invalid), false, invalid);
  }
});

test('sizing preserves portrait and landscape aspect ratios', () => {
  assert.deepEqual(
    resizePhotoDimensions({ width: 4_000, height: 3_000 }, 1_600),
    { width: 1_600, height: 1_200 }
  );
  assert.deepEqual(
    resizePhotoDimensions({ width: 3_000, height: 4_000 }, 1_600),
    { width: 1_200, height: 1_600 }
  );
  assert.deepEqual(
    resizePhotoDimensions({ width: 1_601, height: 1 }, 1_600),
    { width: 1_600, height: 1 }
  );
});

test('small images are never upscaled and every attempt starts from the source', () => {
  const plan = planPhotoEncoding({ width: 800, height: 600 });

  assert.equal(plan.length, PHOTO_ENCODING_ATTEMPTS.length);
  assert.deepEqual(
    plan.map(({ dimensions }) => dimensions),
    [
      { width: 800, height: 600 },
      { width: 800, height: 600 },
      { width: 800, height: 600 },
    ]
  );
});

test('invalid dimensions and candidate metadata are rejected', () => {
  for (const dimensions of [
    { width: 0, height: 100 },
    { width: -1, height: 100 },
    { width: Number.NaN, height: 100 },
    { width: 100.5, height: 100 },
    { width: Number.POSITIVE_INFINITY, height: 100 },
  ]) {
    assert.throws(() => planPhotoEncoding(dimensions), /dimensions/i);
  }

  assert.throws(
    () => selectPhotoCandidate([candidate(1, 0)]),
    /metadata is invalid/i
  );
  assert.throws(
    () => selectPhotoCandidate([candidate(1, PHOTO_TARGET_BYTES, { uri: '' })]),
    /metadata is invalid/i
  );
  assert.throws(() => selectPhotoCandidate([]), /at least one/i);
});

test('target equality is accepted and the first in-policy attempt wins', () => {
  const selected = selectPhotoCandidate([
    candidate(2, PHOTO_TARGET_BYTES),
    candidate(1, PHOTO_TARGET_BYTES),
    candidate(3, PHOTO_TARGET_BYTES - 1),
  ]);

  assert.equal(selected.attempt, 1);
  assert.equal(selected.bytes, PHOTO_TARGET_BYTES);
});

test('oversized candidates fall back to the smallest output', () => {
  const selected = selectPhotoCandidate([
    candidate(1, 280_000),
    candidate(2, 240_000),
    candidate(3, 220_000),
  ]);

  assert.equal(selected.attempt, 3);
  assert.equal(selected.bytes, 220_000);
});

test('equal-sized oversized candidates use the earlier attempt', () => {
  const selected = selectPhotoCandidate([
    candidate(3, 220_000),
    candidate(2, 220_000),
    candidate(1, 220_000),
  ]);

  assert.equal(selected.attempt, 1);
});
