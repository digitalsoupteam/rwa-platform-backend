/**
 * Component tests for the documents HTTP layer.
 *
 * The whole Elysia app is assembled in-process: real controllers and the real
 * DocumentsService, with repositories replaced by in-memory fakes. Requests go
 * through app.handle() — no port is bound, nothing is queried over the network.
 * Run with `bun test` from services/documents.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { Elysia } from 'elysia';
import { ErrorHandlerPlugin } from '@shared/errors/error-handler.plugin';
import { createServicesPlugin } from '../src/plugins/services.plugin';
import { createControllersPlugin } from '../src/plugins/controllers.plugin';
import type { RepositoriesPlugin } from '../src/plugins/repositories.plugin';
import {
  createFakeDocumentsFolderRepository,
  type FakeDocumentsFolderRepository,
} from './fakes/documentsFolder.repository.fake';
import { createFakeDocumentRepository, type FakeDocumentRepository } from './fakes/document.repository.fake';

const FILES_BASE_URL = 'https://files.example.com/files';

const FOLDER = {
  name: 'Contracts',
  parentId: 'parent-1',
  ownerId: 'owner-1',
  ownerType: 'business',
  creator: 'user-1',
  grandParentId: 'grand-1',
};

const DOCUMENT = {
  name: 'Term sheet.pdf',
  fileId: 'file-1',
  path: '2026/09/24/10/term-sheet.pdf',
  mimeType: 'application/pdf',
  size: 2048,
  ownerId: 'owner-1',
  ownerType: 'business',
  creator: 'user-1',
  parentId: 'parent-1',
  grandParentId: 'grand-1',
};

function buildApp(folders: FakeDocumentsFolderRepository, documents: FakeDocumentRepository) {
  const repositoriesPlugin = new Elysia({ name: 'Repositories' })
    .decorate('documentsFolderRepository', folders)
    .decorate('documentRepository', documents);

  const servicesPlugin = createServicesPlugin(repositoriesPlugin as unknown as RepositoriesPlugin, FILES_BASE_URL);

  return new Elysia().onError(ErrorHandlerPlugin).use(createControllersPlugin(servicesPlugin));
}

type App = ReturnType<typeof buildApp>;

async function post(app: App, path: string, body: unknown) {
  const response = await app.handle(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

  return { status: response.status, body: (await response.json()) as any };
}

describe('documents HTTP layer (component, fake repositories)', () => {
  let folders: FakeDocumentsFolderRepository;
  let documents: FakeDocumentRepository;
  let app: App;

  beforeEach(() => {
    folders = createFakeDocumentsFolderRepository();
    documents = createFakeDocumentRepository();
    app = buildApp(folders, documents);
  });

  test('folders: createFolder → getFolder → getFolders round-trip', async () => {
    const created = await post(app, '/createFolder', FOLDER);
    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({ name: FOLDER.name, ownerId: FOLDER.ownerId });
    expect(typeof created.body.id).toBe('string');

    const fetched = await post(app, '/getFolder', { id: created.body.id });
    expect(fetched.status).toBe(200);
    expect(fetched.body).toEqual(created.body);

    const list = await post(app, '/getFolders', { filter: {} });
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(created.body.id);
  });

  test('createFolder: an invalid payload never reaches the repository', async () => {
    const response = await post(app, '/createFolder', { name: 'Missing everything else' });

    expect(response.status).not.toBe(200);
    expect(folders.create).toHaveBeenCalledTimes(0);
  });

  test('updateFolder: rename is visible through getFolder', async () => {
    const created = await post(app, '/createFolder', FOLDER);

    const updated = await post(app, '/updateFolder', { id: created.body.id, updateData: { name: 'Renamed' } });
    expect(updated.status).toBe(200);
    expect(updated.body.name).toBe('Renamed');

    const fetched = await post(app, '/getFolder', { id: created.body.id });
    expect(fetched.body.name).toBe('Renamed');
  });

  test('deleteFolder: an unknown id maps to 404 NOT_FOUND', async () => {
    const response = await post(app, '/deleteFolder', { id: 'unknown-id' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: 'NOT_FOUND', message: 'DocumentsFolder unknown-id not found' } });
  });

  test('documents: create, list by folderId, delete', async () => {
    const folder = (await post(app, '/createFolder', FOLDER)).body;

    const created = await post(app, '/createDocument', { ...DOCUMENT, folderId: folder.id });
    expect(created.status).toBe(200);
    expect(created.body.folderId).toBe(folder.id);
    expect(created.body.url).toBe(`${FILES_BASE_URL}/${DOCUMENT.path}`);
    expect(created.body).not.toHaveProperty('_id');

    const fetched = await post(app, '/getDocument', { id: created.body.id });
    expect(fetched.status).toBe(200);
    expect(fetched.body).toEqual(created.body);

    const list = await post(app, '/getDocuments', { filter: { folderId: folder.id } });
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(created.body.id);

    const deleted = await post(app, '/deleteDocument', { id: created.body.id });
    expect(deleted.status).toBe(200);

    const after = await post(app, '/getDocuments', { filter: { folderId: folder.id } });
    expect(after.body).toHaveLength(0);
  });

  test('getDocument: an unknown id maps to 404 NOT_FOUND', async () => {
    const response = await post(app, '/getDocument', { id: 'unknown-id' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Document unknown-id not found' } });
  });

  test('getFolders: filter is forwarded end-to-end', async () => {
    await post(app, '/createFolder', FOLDER);
    await post(app, '/createFolder', { ...FOLDER, name: 'Other', ownerId: 'owner-2' });

    const list = await post(app, '/getFolders', { filter: { ownerId: 'owner-2' } });

    expect(list.body).toHaveLength(1);
    expect(list.body[0].name).toBe('Other');
  });
});
