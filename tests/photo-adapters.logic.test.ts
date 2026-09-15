import { strict as assert } from 'node:assert';

type MockEntry = { bytes: number; isDirectory?: boolean };

jest.mock('expo-file-system', () => {
  type MockPath = string | { uri: string };
  const entries = new Map<string, MockEntry>();
  let documentUri = 'file:///documents';

  function uriFor(parts: MockPath[]): string {
    const [first, ...rest] = parts.map((part) =>
      typeof part === 'string' ? part : part.uri
    );
    return [first.replace(/\/$/, ''), ...rest].join('/');
  }

  class Directory {
    readonly uri: string;

    constructor(...parts: MockPath[]) {
      this.uri = uriFor(parts);
    }

    get exists(): boolean {
      return entries.get(this.uri)?.isDirectory === true;
    }

    create(): void {
      entries.set(this.uri, { bytes: 0, isDirectory: true });
    }

    delete(): void {
      for (const uri of entries.keys()) {
        if (uri === this.uri || uri.startsWith(`${this.uri}/`)) {
          entries.delete(uri);
        }
      }
    }
  }

  class File {
    readonly uri: string;

    constructor(...parts: MockPath[]) {
      this.uri = uriFor(parts);
    }

    get exists(): boolean {
      return entries.has(this.uri) && entries.get(this.uri)?.isDirectory !== true;
    }

    info(): { exists: boolean; size?: number } {
      const entry = entries.get(this.uri);
      return entry === undefined || entry.isDirectory === true
        ? { exists: false }
        : { exists: true, size: entry.bytes };
    }

    delete(): void {
      entries.delete(this.uri);
    }

    async copy(destination: File, options?: { overwrite?: boolean }): Promise<void> {
      if (!this.exists) throw new Error(`missing source ${this.uri}`);
      if (destination.exists && options?.overwrite !== true) {
        throw new Error(`destination exists ${destination.uri}`);
      }
      const source = entries.get(this.uri);
      if (source === undefined) throw new Error(`missing source ${this.uri}`);
      entries.set(destination.uri, { ...source });
    }

    async move(destination: File, options?: { overwrite?: boolean }): Promise<void> {
      await this.copy(destination, options);
      entries.delete(this.uri);
    }
  }

  return {
    Directory,
    File,
    Paths: {
      get document(): Directory {
        return new Directory(documentUri);
      },
    },
    __entries: entries,
    __setDocumentUri(uri: string): void {
      documentUri = uri;
    },
    __reset(): void {
      entries.clear();
      documentUri = 'file:///documents';
    },
  };
});

jest.mock('expo-image-manipulator', () => {
  const savedOptions: Array<Record<string, unknown>> = [];
  const resizes: Array<{ width?: number | null; height?: number | null }> = [];
  const sources: string[] = [];
  let nextOutput = 0;

  class ImageRef {
    readonly width = 1200;
    readonly height = 900;

    async saveAsync(options?: Record<string, unknown>): Promise<{
      uri: string;
      width: number;
      height: number;
    }> {
      savedOptions.push(options ?? {});
      nextOutput += 1;
      return {
        uri: `file:///cache/output-${nextOutput}.jpg`,
        width: this.width,
        height: this.height,
      };
    }

    release(): void {}
  }

  class Context {
    resize(size: { width?: number | null; height?: number | null }): this {
      resizes.push(size);
      return this;
    }

    async renderAsync(): Promise<ImageRef> {
      return new ImageRef();
    }

    release(): void {}
  }

  return {
    ImageManipulator: {
      manipulate(source: string): Context {
        sources.push(source);
        return new Context();
      },
    },
    SaveFormat: { JPEG: 'jpeg' },
    __savedOptions: savedOptions,
    __resizes: resizes,
    __sources: sources,
    __reset(): void {
      savedOptions.length = 0;
      resizes.length = 0;
      sources.length = 0;
      nextOutput = 0;
    },
  };
});

const mockFileSystem = require('expo-file-system') as {
  __entries: Map<string, MockEntry>;
  __setDocumentUri: (uri: string) => void;
  __reset: () => void;
};
const mockImageManipulator = require('expo-image-manipulator') as {
  __savedOptions: Array<Record<string, unknown>>;
  __resizes: Array<{ width?: number | null; height?: number | null }>;
  __sources: string[];
  __reset: () => void;
};

import { createPhotoEncoder } from '../src/photos/photo-encoder';
import { createPhotoFileAdapter } from '../src/photos/photo-files';
import { parsePhotoKey } from '../src/photos/photo-contract';

const photoKey = parsePhotoKey(
  'photos/v1/123e4567-e89b-42d3-a456-426614174000.jpg'
);

beforeEach(() => {
  mockFileSystem.__reset();
  mockImageManipulator.__reset();
});

test('file adapter keeps staging separate and promotes without overwrite', async () => {
  const adapter = createPhotoFileAdapter();
  await adapter.initialize();
  mockFileSystem.__entries.set('file:///camera/source.heic', { bytes: 900_000 });

  const staging = adapter.createStagingFile('capture-1');
  await adapter.copyIntoStaging('file:///camera/source.heic', staging);
  assert.equal((await adapter.inspect(staging.uri))?.bytes, 900_000);

  const retained = adapter.createRetainedFile(photoKey);
  await adapter.promote(staging, retained);
  assert.equal(await adapter.inspect(staging.uri), null);
  assert.equal((await adapter.resolve(photoKey))?.uri, retained.uri);

  await assert.rejects(
    adapter.promote(staging, retained),
    /missing source|destination exists/i
  );
  assert.equal((await adapter.resolve(photoKey))?.bytes, 900_000);
});

test('initialization removes only the owned staging directory and resolves the current document root', async () => {
  const adapter = createPhotoFileAdapter();
  await adapter.initialize();
  mockFileSystem.__entries.set('file:///documents/capture-staging/old.jpg', { bytes: 2 });
  mockFileSystem.__entries.set('file:///documents/photos/v1/keep.jpg', { bytes: 3 });

  await adapter.initialize();
  assert.equal(mockFileSystem.__entries.has('file:///documents/capture-staging/old.jpg'), false);
  assert.equal(mockFileSystem.__entries.has('file:///documents/photos/v1/keep.jpg'), true);

  mockFileSystem.__setDocumentUri('file:///new-documents');
  const current = adapter.createRetainedFile(photoKey);
  assert.equal(current.uri.startsWith('file:///new-documents/'), true);
});

test('encoder decodes dimensions, maps bounded JPEG options, and owns cache output cleanup', async () => {
  const encoder = createPhotoEncoder();
  assert.deepEqual(await encoder.readDimensions('file:///camera/source.heic'), {
    width: 1200,
    height: 900,
  });

  const output = await encoder.encode('file:///camera/source.heic', {
    attempt: 1,
    maxLongEdge: 1600,
    quality: 0.75,
    dimensions: { width: 1200, height: 900 },
  });

  assert.deepEqual(mockImageManipulator.__sources, [
    'file:///camera/source.heic',
    'file:///camera/source.heic',
  ]);
  assert.deepEqual(mockImageManipulator.__resizes, [{ width: 1200, height: 900 }]);
  assert.deepEqual(mockImageManipulator.__savedOptions, [
    { format: 'jpeg', compress: 0.75, base64: false },
  ]);
  mockFileSystem.__entries.set(output.uri, { bytes: 150_000 });
  assert.equal((await createPhotoFileAdapter().inspect(output.uri))?.bytes, 150_000);

  await encoder.release(output);
  assert.equal(mockFileSystem.__entries.has(output.uri), false);
  mockFileSystem.__entries.set('file:///camera/source.heic', { bytes: 2 });
  await encoder.release({ uri: 'file:///camera/source.heic', dimensions: output.dimensions });
  assert.equal(mockFileSystem.__entries.has('file:///camera/source.heic'), true);
});
