/**
 * Unit tests for ImagesService (the gallery service).
 *
 * Scope: the service layer only. Repositories are replaced with in-memory
 * fakes (tests/fakes/*.fake.ts), so these tests need no database and no
 * network. Run with `bun test` from services/gallery.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { ImagesService } from '../src/services/images.service';
import type { GalleryRepository } from '../src/repositories/gallery.repository';
import type { ImageRepository } from '../src/repositories/image.repository';
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

describe('ImagesService (unit, fake repositories)', () => {
  let galleries: FakeGalleryRepository;
  let images: FakeImageRepository;
  let service: ImagesService;

  beforeEach(() => {
    galleries = createFakeGalleryRepository();
    images = createFakeImageRepository();
    service = new ImagesService(
      galleries as unknown as GalleryRepository,
      images as unknown as ImageRepository,
      FILES_BASE_URL,
    );
  });

  test('createGallery: forwards the payload and returns a mapped gallery', async () => {
    const gallery = await service.createGallery(GALLERY);

    expect(galleries.create).toHaveBeenCalledTimes(1);
    expect(galleries.create).toHaveBeenCalledWith(GALLERY);
    expect(gallery).toMatchObject(GALLERY);
    expect(typeof gallery.id).toBe('string');
    expect(gallery.id).toHaveLength(24); // Mongo ObjectId hex
    expect(typeof gallery.createdAt).toBe('number');
    expect(gallery).not.toHaveProperty('_id');
    // The result must be plain JSON — no ObjectId or class instances leaking to the caller.
    expect(JSON.parse(JSON.stringify(gallery))).toEqual(gallery);
  });

  test('updateGallery: updates by id and returns the mapped gallery', async () => {
    const created = await service.createGallery(GALLERY);

    const updated = await service.updateGallery({ id: created.id, updateData: { name: 'Renamed' } });

    expect(galleries.update).toHaveBeenCalledWith(created.id, { name: 'Renamed' });
    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe('Renamed');
    expect(updated).not.toHaveProperty('_id');
  });

  test('updateGallery: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.updateGallery({ id: 'unknown-id', updateData: { name: 'x' } })).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('deleteGallery: deletes the gallery and forwards the image cascade filter', async () => {
    const gallery = await service.createGallery(GALLERY);
    const otherGallery = await service.createGallery({ ...GALLERY, name: 'Other' });
    const image = await service.createImage({ ...IMAGE, galleryId: gallery.id });
    const foreign = await service.createImage({ ...IMAGE, galleryId: otherGallery.id });

    const result = await service.deleteGallery(gallery.id);

    expect(result).toEqual({ id: gallery.id });
    expect(images.findAll).toHaveBeenCalledWith({ galleryIds: [gallery.id] });
    expect(galleries.store.has(gallery.id)).toBe(false);
    // The service cascades with `{ galleryIds: [id] }`, but image documents store
    // `galleryId` (singular). The fake matches filters by equality against the stored
    // fields, so the cascade filter matches nothing and no image is deleted: the
    // assertions below pin the current behaviour of the cascade filter key.
    expect(images.delete).toHaveBeenCalledTimes(0);
    expect(images.store.has(image.id)).toBe(true);
    expect(images.store.has(foreign.id)).toBe(true);
  });

  test('deleteGallery: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.deleteGallery('unknown-id')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('getGallery: returns the mapped gallery', async () => {
    const created = await service.createGallery(GALLERY);

    const gallery = await service.getGallery(created.id);

    expect(gallery.id).toBe(created.id);
    expect(gallery.name).toBe(GALLERY.name);
    expect(gallery).not.toHaveProperty('_id');
  });

  test('getGallery: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.getGallery('unknown-id')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('getGalleries: passes filter/pagination through and maps every result', async () => {
    await service.createGallery(GALLERY);
    await service.createGallery({ ...GALLERY, name: 'Second', ownerId: 'owner-2' });
    await service.createGallery({ ...GALLERY, name: 'Third', ownerId: 'owner-2' });

    const result = await service.getGalleries({ filter: { ownerId: 'owner-2' }, limit: 10, offset: 0 });

    expect(galleries.findAll).toHaveBeenCalledWith({ ownerId: 'owner-2' }, undefined, 10, 0);
    expect(result).toHaveLength(2);
    expect(result.map((gallery) => gallery.name)).toEqual(['Second', 'Third']); // insertion order is stable in the fake
    for (const gallery of result) expect(gallery).not.toHaveProperty('_id');
  });

  test('getGalleries: returns an empty array when nothing matches', async () => {
    await service.createGallery(GALLERY);

    const result = await service.getGalleries({ filter: { ownerId: 'nobody' } });

    expect(result).toEqual([]);
  });

  test('createImage: returns a mapped image with string ids and a computed url', async () => {
    const gallery = await service.createGallery(GALLERY);
    const payload = { ...IMAGE, galleryId: gallery.id };

    const image = await service.createImage(payload);

    expect(images.create).toHaveBeenCalledTimes(1);
    expect(images.create).toHaveBeenCalledWith(payload);
    expect(image.galleryId).toBe(gallery.id);
    expect(image.name).toBe(IMAGE.name);
    expect(image.url).toBe(`${FILES_BASE_URL}/${IMAGE.path}`);
    expect(typeof image.id).toBe('string');
    expect(image.id).toHaveLength(24); // Mongo ObjectId hex
    expect(image).not.toHaveProperty('_id');
    // The result must be plain JSON — no ObjectId or class instances leaking to the caller.
    expect(JSON.parse(JSON.stringify(image))).toEqual(image);
  });

  test('createImage: propagates unexpected repository errors unchanged', async () => {
    const gallery = await service.createGallery(GALLERY);
    const failure = new Error('mongo unavailable');
    images.create.mockImplementationOnce(async () => {
      throw failure;
    });

    await expect(service.createImage({ ...IMAGE, galleryId: gallery.id })).rejects.toBe(failure);
  });

  test('updateImage: applies a partial update and returns the mapped image', async () => {
    const gallery = await service.createGallery(GALLERY);
    const created = await service.createImage({ ...IMAGE, galleryId: gallery.id });

    const updated = await service.updateImage({ id: created.id, updateData: { description: 'Updated' } });

    expect(images.update).toHaveBeenCalledWith(created.id, { description: 'Updated' });
    expect(updated.id).toBe(created.id);
    expect(updated.description).toBe('Updated');
    expect(updated.name).toBe(IMAGE.name);
    expect(updated.url).toBe(`${FILES_BASE_URL}/${IMAGE.path}`);
  });

  test('updateImage: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.updateImage({ id: 'unknown-id', updateData: { name: 'x' } })).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('deleteImage: deletes only the requested image', async () => {
    const gallery = await service.createGallery(GALLERY);
    const first = await service.createImage({ ...IMAGE, galleryId: gallery.id, name: 'First' });
    const second = await service.createImage({ ...IMAGE, galleryId: gallery.id, name: 'Second' });

    const result = await service.deleteImage(first.id);

    expect(result).toEqual({ id: first.id });
    expect(images.store.has(first.id)).toBe(false);
    expect(images.store.has(second.id)).toBe(true);
  });

  test('deleteImage: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.deleteImage('unknown-id')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('getImage: returns the mapped image', async () => {
    const gallery = await service.createGallery(GALLERY);
    const created = await service.createImage({ ...IMAGE, galleryId: gallery.id });

    const image = await service.getImage(created.id);

    expect(image.id).toBe(created.id);
    expect(image.galleryId).toBe(gallery.id);
    expect(image.url).toBe(`${FILES_BASE_URL}/${IMAGE.path}`);
    expect(image).not.toHaveProperty('_id');
  });

  test('getImage: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.getImage('unknown-id')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('getImages: filters by galleryId and maps every result', async () => {
    const gallery = await service.createGallery(GALLERY);
    const otherGallery = await service.createGallery({ ...GALLERY, name: 'Other' });
    await service.createImage({ ...IMAGE, galleryId: gallery.id, name: 'A' });
    await service.createImage({ ...IMAGE, galleryId: gallery.id, name: 'B' });
    await service.createImage({ ...IMAGE, galleryId: otherGallery.id, name: 'C' });

    const result = await service.getImages({ filter: { galleryId: gallery.id } });

    expect(images.findAll).toHaveBeenCalledWith({ galleryId: gallery.id }, undefined, undefined, undefined);
    expect(result).toHaveLength(2);
    expect(result.map((image) => image.name)).toEqual(['A', 'B']); // insertion order is stable in the fake
    for (const image of result) {
      expect(image.galleryId).toBe(gallery.id);
      expect(image).not.toHaveProperty('_id');
    }
  });
});
