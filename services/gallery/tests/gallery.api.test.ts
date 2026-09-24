/**
 * Component tests for the gallery HTTP layer.
 *
 * The whole Elysia app is assembled in-process: real controllers and the real
 * ImagesService, with repositories replaced by in-memory fakes. Requests go
 * through app.handle() — no port is bound, nothing is queried over the network.
 * Run with `bun test` from services/gallery.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { Elysia } from 'elysia';
import { ErrorHandlerPlugin } from '@shared/errors/error-handler.plugin';
import { createServicesPlugin } from '../src/plugins/services.plugin';
import { createControllersPlugin } from '../src/plugins/controllers.plugin';
import type { RepositoriesPlugin } from '../src/plugins/repositories.plugin';
import { createFakeGalleryRepository, type FakeGalleryRepository } from './fakes/gallery.repository.fake';
import { createFakeImageRepository, type FakeImageRepository } from './fakes/image.repository.fake';

const FILES_BASE_URL = 'https://files.test';

const GALLERY = {
  name: 'Product shots',
  parentId: 'parent-1',
  ownerId: 'owner-1',
  ownerType: 'business',
  creator: 'user-1',
  grandParentId: 'grand-1',
};

const IMAGE = {
  name: 'Front view',
  description: 'Main product photo',
  fileId: 'file-1',
  path: '2026/09/24/12/uuid.png',
  mimeType: 'image/png',
  size: 2048,
  ownerId: 'owner-1',
  ownerType: 'business',
  creator: 'user-1',
  parentId: 'parent-1',
  grandParentId: 'grand-1',
};

function buildApp(galleries: FakeGalleryRepository, images: FakeImageRepository) {
  const repositoriesPlugin = new Elysia({ name: 'Repositories' })
    .decorate('galleryRepository', galleries)
    .decorate('imageRepository', images);

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

describe('gallery HTTP layer (component, fake repositories)', () => {
  let galleries: FakeGalleryRepository;
  let images: FakeImageRepository;
  let app: App;

  beforeEach(() => {
    galleries = createFakeGalleryRepository();
    images = createFakeImageRepository();
    app = buildApp(galleries, images);
  });

  test('createGallery → getGallery → getGalleries round-trip', async () => {
    const created = await post(app, '/createGallery', GALLERY);
    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({ name: GALLERY.name, ownerId: GALLERY.ownerId });
    expect(typeof created.body.id).toBe('string');

    const fetched = await post(app, '/getGallery', { id: created.body.id });
    expect(fetched.status).toBe(200);
    expect(fetched.body).toEqual(created.body);

    const list = await post(app, '/getGalleries', { filter: {} });
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(created.body.id);
  });

  test('createGallery: an invalid payload never reaches the repository', async () => {
    const response = await post(app, '/createGallery', { name: 'Missing everything else' });

    expect(response.status).not.toBe(200);
    expect(galleries.create).toHaveBeenCalledTimes(0);
  });

  test('updateGallery: rename is visible through getGallery', async () => {
    const created = await post(app, '/createGallery', GALLERY);

    const updated = await post(app, '/updateGallery', { id: created.body.id, updateData: { name: 'Renamed' } });
    expect(updated.status).toBe(200);
    expect(updated.body.name).toBe('Renamed');

    const fetched = await post(app, '/getGallery', { id: created.body.id });
    expect(fetched.body.name).toBe('Renamed');
  });

  test('deleteGallery: an unknown id maps to 404 NOT_FOUND', async () => {
    const response = await post(app, '/deleteGallery', { id: 'unknown-id' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Gallery unknown-id not found' } });
  });

  test('getGalleries: filter is forwarded end-to-end', async () => {
    await post(app, '/createGallery', GALLERY);
    await post(app, '/createGallery', { ...GALLERY, name: 'Other', ownerId: 'owner-2' });

    const list = await post(app, '/getGalleries', { filter: { ownerId: 'owner-2' } });

    expect(list.body).toHaveLength(1);
    expect(list.body[0].name).toBe('Other');
  });

  test('images: create, get, list by galleryId, update, delete', async () => {
    const gallery = (await post(app, '/createGallery', GALLERY)).body;

    const created = await post(app, '/createImage', { ...IMAGE, galleryId: gallery.id });
    expect(created.status).toBe(200);
    expect(created.body.galleryId).toBe(gallery.id);
    expect(created.body.url).toBe(`${FILES_BASE_URL}/${IMAGE.path}`);

    const fetched = await post(app, '/getImage', { id: created.body.id });
    expect(fetched.status).toBe(200);
    expect(fetched.body).toEqual(created.body);

    const list = await post(app, '/getImages', { filter: { galleryId: gallery.id } });
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(created.body.id);

    const updated = await post(app, '/updateImage', { id: created.body.id, updateData: { name: 'Renamed image' } });
    expect(updated.status).toBe(200);
    expect(updated.body.name).toBe('Renamed image');

    const deleted = await post(app, '/deleteImage', { id: created.body.id });
    expect(deleted.status).toBe(200);
    expect(deleted.body).toEqual({ id: created.body.id });

    const after = await post(app, '/getImages', { filter: { galleryId: gallery.id } });
    expect(after.body).toHaveLength(0);
  });

  test('deleteGallery: removes the gallery; the image cascade filter does not match stored images', async () => {
    const gallery = (await post(app, '/createGallery', GALLERY)).body;
    const image = (await post(app, '/createImage', { ...IMAGE, galleryId: gallery.id })).body;

    const deleted = await post(app, '/deleteGallery', { id: gallery.id });
    expect(deleted.status).toBe(200);
    expect(deleted.body).toEqual({ id: gallery.id });

    const gone = await post(app, '/getGallery', { id: gallery.id });
    expect(gone.status).toBe(404);

    // The cascade filters images by `galleryIds`, but image documents store `galleryId`
    // (singular), so the filter matches nothing in the fake and the image survives.
    // Pinned deliberately: this assertion flips once the service filters by the real field.
    const survived = await post(app, '/getImage', { id: image.id });
    expect(survived.status).toBe(200);
  });

  test('getImage: an unknown id maps to 404 NOT_FOUND', async () => {
    const response = await post(app, '/getImage', { id: 'unknown-id' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Image unknown-id not found' } });
  });
});
