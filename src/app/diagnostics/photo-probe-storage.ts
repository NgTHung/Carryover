import { File, Paths } from 'expo-file-system';

import { isPhotoKey, type PhotoKey } from '../../photos/photo-contract';
import {
  isPhotoProbeFixtureId,
  type PhotoProbeFixtureId,
  type PhotoProbeSavedKeys,
} from './photo-probe-contract';

const probeStateFileName = 'capture-photo-probe.json';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function probeStateFile(): File {
  return new File(Paths.document, probeStateFileName);
}

function parseSavedKeys(value: unknown): PhotoProbeSavedKeys {
  if (!isRecord(value) || !isRecord(value.photoKeys)) {
    throw new Error('The capture probe state file has an invalid shape.');
  }

  const savedKeys: PhotoProbeSavedKeys = {};
  for (const [fixtureId, valueForFixture] of Object.entries(value.photoKeys)) {
    if (isPhotoProbeFixtureId(fixtureId) && isPhotoKey(valueForFixture)) {
      savedKeys[fixtureId] = valueForFixture;
    }
  }
  return savedKeys;
}

export async function readPhotoProbeState(): Promise<PhotoProbeSavedKeys> {
  const file = probeStateFile();
  if (!file.exists) return {};
  return parseSavedKeys(JSON.parse(await file.text()) as unknown);
}

export function writePhotoProbeState(savedKeys: PhotoProbeSavedKeys): void {
  const photoKeys: Partial<Record<PhotoProbeFixtureId, PhotoKey>> = {};
  for (const [fixtureId, photoKey] of Object.entries(savedKeys)) {
    if (isPhotoProbeFixtureId(fixtureId) && isPhotoKey(photoKey)) {
      photoKeys[fixtureId] = photoKey;
    }
  }

  probeStateFile().write(JSON.stringify({ photoKeys }));
}
