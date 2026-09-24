/**
 * In-memory fake of StorageClient for unit tests.
 *
 * The real client writes files to the local filesystem under a root directory
 * given in the constructor. Tests use this fake to keep the service layer
 * isolated: everything stays in memory, nothing is ever written to disk and
 * generated paths are deterministic. The public API mirrors
 * src/clients/storage.client.ts, and every method is wrapped in bun:test
 * mock() so interactions can be asserted.
 */
import { mock } from 'bun:test';

// Fixed stand-in for the date/hour prefix the real client builds from the clock.
const FAKE_PATH_PREFIX = '2026/01/01/0';

export function createFakeStorageClient() {
  // relativePath -> stored bytes; stands in for the root directory on disk.
  const store = new Map<string, Buffer>();
  let pathCounter = 0;

  const client = {
    store,

    generatePath: mock((ext: string) => {
      pathCounter++;
      return `${FAKE_PATH_PREFIX}/upload-${pathCounter}.${ext}`;
    }),

    saveFile: mock(async (relativePath: string, data: Buffer) => {
      store.set(relativePath, data);
    }),

    deleteFile: mock(async (relativePath: string) => {
      // The real client silently ignores paths that are already gone.
      store.delete(relativePath);
    }),

    fileExists: mock((relativePath: string) => store.has(relativePath)),
  };

  return client;
}

export type FakeStorageClient = ReturnType<typeof createFakeStorageClient>;
