/**
 * Unit tests for DocumentsService.
 *
 * Scope: the service layer only. Repositories are replaced with in-memory
 * fakes (tests/fakes/*.fake.ts), so these tests need no database, no broker
 * and no network. Run with `bun test` from services/documents.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { DocumentsService } from '../src/services/documents.service';
import type { DocumentsFolderRepository } from '../src/repositories/documentsFolder.repository';
import type { DocumentRepository } from '../src/repositories/document.repository';
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

// buildFileUrl(filePath, filesBaseUrl) => `${filesBaseUrl}/${filePath}`
const DOCUMENT_URL = `${FILES_BASE_URL}/${DOCUMENT.path}`;

describe('DocumentsService (unit, fake repositories)', () => {
  let folders: FakeDocumentsFolderRepository;
  let documents: FakeDocumentRepository;
  let service: DocumentsService;

  beforeEach(() => {
    folders = createFakeDocumentsFolderRepository();
    documents = createFakeDocumentRepository();
    service = new DocumentsService(
      folders as unknown as DocumentsFolderRepository,
      documents as unknown as DocumentRepository,
      FILES_BASE_URL,
    );
  });

  test('createFolder: forwards the payload and returns a mapped folder', async () => {
    const folder = await service.createFolder(FOLDER);

    expect(folders.create).toHaveBeenCalledTimes(1);
    expect(folders.create).toHaveBeenCalledWith(FOLDER);
    expect(folder).toMatchObject(FOLDER);
    expect(typeof folder.id).toBe('string');
    expect(folder.id).toHaveLength(24); // Mongo ObjectId hex
    expect(typeof folder.createdAt).toBe('number');
    expect(folder).not.toHaveProperty('_id');
    // The result must be plain JSON — no ObjectId or class instances leaking to the caller.
    expect(JSON.parse(JSON.stringify(folder))).toEqual(folder);
  });

  test('updateFolder: updates by id and returns the mapped folder', async () => {
    const created = await service.createFolder(FOLDER);

    const updated = await service.updateFolder({ id: created.id, updateData: { name: 'Renamed' } });

    expect(folders.update).toHaveBeenCalledWith(created.id, { name: 'Renamed' });
    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe('Renamed');
  });

  test('updateFolder: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.updateFolder({ id: 'unknown-id', updateData: { name: 'x' } })).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('deleteFolder: removes the folder and forwards the documents filter', async () => {
    const folder = await service.createFolder(FOLDER);
    const document = await service.createDocument({ ...DOCUMENT, folderId: folder.id });
    const otherFolder = await service.createFolder({ ...FOLDER, name: 'Other' });
    const foreign = await service.createDocument({ ...DOCUMENT, folderId: otherFolder.id, name: 'Other.pdf' });

    const result = await service.deleteFolder(folder.id);

    expect(result).toEqual({ id: folder.id });
    expect(documents.findAll).toHaveBeenCalledWith({ folderIds: [folder.id] });
    expect(folders.delete).toHaveBeenCalledWith(folder.id);
    expect(folders.store.has(folder.id)).toBe(false);
    expect(folders.store.has(otherFolder.id)).toBe(true);
    // The service looks documents up with `folderIds` (plural) while the entity stores a
    // single `folderId`, so nothing matches — the fake reproduces that collection-equivalent
    // behavior: the folder goes away, its documents currently stay behind.
    expect(documents.delete).toHaveBeenCalledTimes(0);
    expect(documents.store.has(document.id)).toBe(true);
    expect(documents.store.has(foreign.id)).toBe(true);
  });

  test('deleteFolder: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.deleteFolder('unknown-id')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('getFolder: returns the mapped folder', async () => {
    const created = await service.createFolder(FOLDER);

    const folder = await service.getFolder(created.id);

    expect(folder.id).toBe(created.id);
    expect(folder.name).toBe(FOLDER.name);
    expect(folder).not.toHaveProperty('_id');
  });

  test('getFolder: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.getFolder('unknown-id')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('getFolders: passes filter/pagination through and maps every result', async () => {
    await service.createFolder(FOLDER);
    await service.createFolder({ ...FOLDER, name: 'Second', ownerId: 'owner-2' });
    await service.createFolder({ ...FOLDER, name: 'Third', ownerId: 'owner-2' });

    const result = await service.getFolders({ filter: { ownerId: 'owner-2' }, limit: 10, offset: 0 });

    expect(folders.findAll).toHaveBeenCalledWith({ ownerId: 'owner-2' }, undefined, 10, 0);
    expect(result).toHaveLength(2);
    expect(result.map((folder) => folder.name)).toEqual(['Second', 'Third']); // insertion order is stable in the fake
    for (const folder of result) expect(folder).not.toHaveProperty('_id');
  });

  test('getFolders: returns an empty array when nothing matches', async () => {
    await service.createFolder(FOLDER);

    const result = await service.getFolders({ filter: { ownerId: 'nobody' } });

    expect(result).toEqual([]);
  });

  test('createDocument: forwards the payload and returns a mapped document with a computed url', async () => {
    const folder = await service.createFolder(FOLDER);

    const document = await service.createDocument({ ...DOCUMENT, folderId: folder.id });

    expect(documents.create).toHaveBeenCalledTimes(1);
    expect(documents.create).toHaveBeenCalledWith({ ...DOCUMENT, folderId: folder.id });
    expect(document.folderId).toBe(folder.id); // ObjectId mapped back to a string
    expect(document.name).toBe(DOCUMENT.name);
    expect(document.url).toBe(DOCUMENT_URL);
    expect(typeof document.id).toBe('string');
    expect(document.id).toHaveLength(24);
    expect(document).not.toHaveProperty('_id');
    expect(JSON.parse(JSON.stringify(document))).toEqual(document);
  });

  test('createDocument: does not double the slash when the base url ends with /', async () => {
    const trailingSlashService = new DocumentsService(
      folders as unknown as DocumentsFolderRepository,
      documents as unknown as DocumentRepository,
      `${FILES_BASE_URL}/`,
    );
    const folder = await service.createFolder(FOLDER);

    const document = await trailingSlashService.createDocument({ ...DOCUMENT, folderId: folder.id });

    expect(document.url).toBe(DOCUMENT_URL);
  });

  test('updateDocument: applies a partial update and returns the mapped document', async () => {
    const folder = await service.createFolder(FOLDER);
    const created = await service.createDocument({ ...DOCUMENT, folderId: folder.id });

    const updated = await service.updateDocument({ id: created.id, updateData: { name: 'Renamed.pdf' } });

    expect(documents.update).toHaveBeenCalledWith(created.id, { name: 'Renamed.pdf' });
    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe('Renamed.pdf');
    expect(updated.url).toBe(DOCUMENT_URL);
  });

  test('updateDocument: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.updateDocument({ id: 'unknown-id', updateData: { name: 'x' } })).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('deleteDocument: deletes only the requested document', async () => {
    const folder = await service.createFolder(FOLDER);
    const first = await service.createDocument({ ...DOCUMENT, folderId: folder.id });
    const second = await service.createDocument({ ...DOCUMENT, folderId: folder.id, name: 'Second.pdf' });

    const result = await service.deleteDocument(first.id);

    expect(result).toEqual({ id: first.id });
    expect(documents.store.has(first.id)).toBe(false);
    expect(documents.store.has(second.id)).toBe(true);
  });

  test('deleteDocument: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.deleteDocument('unknown-id')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('getDocument: returns the mapped document with a computed url', async () => {
    const folder = await service.createFolder(FOLDER);
    const created = await service.createDocument({ ...DOCUMENT, folderId: folder.id });

    const document = await service.getDocument(created.id);

    expect(document.id).toBe(created.id);
    expect(document.folderId).toBe(folder.id);
    expect(document.url).toBe(DOCUMENT_URL);
    expect(document).not.toHaveProperty('_id');
    expect(JSON.parse(JSON.stringify(document))).toEqual(document);
  });

  test('getDocument: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.getDocument('unknown-id')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('getDocuments: filters by folderId and maps every result', async () => {
    const folder = await service.createFolder(FOLDER);
    const otherFolder = await service.createFolder({ ...FOLDER, name: 'Other' });
    await service.createDocument({ ...DOCUMENT, folderId: folder.id, name: 'A.pdf' });
    await service.createDocument({ ...DOCUMENT, folderId: folder.id, name: 'B.pdf' });
    await service.createDocument({ ...DOCUMENT, folderId: otherFolder.id, name: 'C.pdf' });

    const result = await service.getDocuments({ filter: { folderId: folder.id } });

    expect(result).toHaveLength(2);
    expect(result.map((doc) => doc.name)).toEqual(['A.pdf', 'B.pdf']); // insertion order is stable in the fake
    for (const doc of result) {
      expect(doc.folderId).toBe(folder.id);
      expect(doc.url).toBe(DOCUMENT_URL);
      expect(doc).not.toHaveProperty('_id');
    }
  });

  test('getDocuments: passes filter/pagination through', async () => {
    const folder = await service.createFolder(FOLDER);
    await service.createDocument({ ...DOCUMENT, folderId: folder.id });

    await service.getDocuments({ filter: { ownerId: 'owner-1' }, limit: 10, offset: 0 });

    expect(documents.findAll).toHaveBeenCalledWith({ ownerId: 'owner-1' }, undefined, 10, 0);
  });

  test('getDocuments: returns an empty array when nothing matches', async () => {
    const folder = await service.createFolder(FOLDER);
    await service.createDocument({ ...DOCUMENT, folderId: folder.id });

    const result = await service.getDocuments({ filter: { folderId: 'nobody' } });

    expect(result).toEqual([]);
  });
});
