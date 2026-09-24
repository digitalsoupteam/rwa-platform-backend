/**
 * Unit tests for BlogsService.
 *
 * Scope: the service layer only. Repositories are replaced with in-memory
 * fakes (tests/fakes/*.fake.ts), so these tests need no database, no broker
 * and no network. Run with `bun test` from services/blog.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { BlogsService } from '../src/services/blogs.service';
import type { BlogRepository } from '../src/repositories/blog.repository';
import type { PostRepository } from '../src/repositories/post.repository';
import { createFakeBlogRepository, type FakeBlogRepository } from './fakes/blog.repository.fake';
import { createFakePostRepository, type FakePostRepository } from './fakes/post.repository.fake';

const BLOG = {
  name: 'Getting started',
  ownerId: 'owner-1',
  ownerType: 'business',
  creator: 'user-1',
  parentId: 'parent-1',
  grandParentId: 'grand-1',
};

const POST = {
  title: 'What is HOLD?',
  content: 'The platform token.',
  ownerId: 'owner-1',
  ownerType: 'business',
  creator: 'user-1',
  parentId: 'parent-1',
  grandParentId: 'grand-1',
};

describe('BlogsService (unit, fake repositories)', () => {
  let blogs: FakeBlogRepository;
  let posts: FakePostRepository;
  let service: BlogsService;

  beforeEach(() => {
    blogs = createFakeBlogRepository();
    posts = createFakePostRepository();
    service = new BlogsService(blogs as unknown as BlogRepository, posts as unknown as PostRepository);
  });

  test('createBlog: forwards the payload and returns a mapped blog', async () => {
    const blog = await service.createBlog(BLOG);

    expect(blogs.create).toHaveBeenCalledTimes(1);
    expect(blogs.create).toHaveBeenCalledWith(BLOG);
    expect(blog).toMatchObject(BLOG);
    expect(typeof blog.id).toBe('string');
    expect(blog.id).toHaveLength(24); // Mongo ObjectId hex
    expect(typeof blog.createdAt).toBe('number');
    expect(blog).not.toHaveProperty('_id');
    // The result must be plain JSON — no ObjectId or class instances leaking to the caller.
    expect(JSON.parse(JSON.stringify(blog))).toEqual(blog);
  });

  test('updateBlog: updates by id and returns the mapped blog', async () => {
    const created = await service.createBlog(BLOG);

    const updated = await service.updateBlog({ id: created.id, updateData: { name: 'Renamed' } });

    expect(blogs.update).toHaveBeenCalledWith(created.id, { name: 'Renamed' });
    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe('Renamed');
    expect(updated.ownerId).toBe(BLOG.ownerId);
    expect(JSON.parse(JSON.stringify(updated))).toEqual(updated);
  });

  test('updateBlog: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.updateBlog({ id: 'unknown-id', updateData: { name: 'x' } })).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('deleteBlog: deletes every post of the blog, then the blog itself', async () => {
    const blog = await service.createBlog(BLOG);
    const otherBlog = await service.createBlog({ ...BLOG, name: 'Other' });
    const first = await service.createPost({ ...POST, blogId: blog.id });
    const second = await service.createPost({ ...POST, blogId: blog.id, title: 'Second?' });
    const foreign = await service.createPost({ ...POST, blogId: otherBlog.id });

    const result = await service.deleteBlog(blog.id);

    expect(result).toEqual({ id: blog.id });
    // The service first asks for the blog's posts, deletes each of them, then the blog.
    expect(posts.findAll).toHaveBeenCalledTimes(1);
    expect(posts.findAll).toHaveBeenCalledWith({ blogIds: [blog.id] });
    expect(posts.delete).toHaveBeenCalledTimes(2);
    expect(posts.delete).toHaveBeenCalledWith(first.id);
    expect(posts.delete).toHaveBeenCalledWith(second.id);
    expect(blogs.delete).toHaveBeenCalledWith(blog.id);
    expect(posts.store.has(first.id)).toBe(false);
    expect(posts.store.has(second.id)).toBe(false);
    expect(posts.store.has(foreign.id)).toBe(true);
    expect(blogs.store.has(blog.id)).toBe(false);
    expect(blogs.store.has(otherBlog.id)).toBe(true);
  });

  test('deleteBlog: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.deleteBlog('unknown-id')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('getBlog: returns the mapped blog', async () => {
    const created = await service.createBlog(BLOG);

    const blog = await service.getBlog(created.id);

    expect(blog.id).toBe(created.id);
    expect(blog.name).toBe(BLOG.name);
    expect(JSON.parse(JSON.stringify(blog))).toEqual(blog);
  });

  test('getBlog: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.getBlog('unknown-id')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('getBlogs: passes filter, sort and pagination through and maps every result', async () => {
    await service.createBlog(BLOG);
    await service.createBlog({ ...BLOG, name: 'Second', ownerId: 'owner-2' });
    await service.createBlog({ ...BLOG, name: 'Third', ownerId: 'owner-2' });

    const result = await service.getBlogs({
      filter: { ownerId: 'owner-2' },
      sort: { name: 'desc' },
      limit: 10,
      offset: 0,
    });

    expect(blogs.findAll).toHaveBeenCalledWith({ ownerId: 'owner-2' }, { name: 'desc' }, 10, 0);
    expect(result).toHaveLength(2);
    // The fake keeps insertion order (sort is only forwarded, not applied).
    expect(result.map((b) => b.name)).toEqual(['Second', 'Third']);
    for (const blog of result) expect(blog).not.toHaveProperty('_id');
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  test('getBlogs: returns an empty array when nothing matches', async () => {
    await service.createBlog(BLOG);

    const result = await service.getBlogs({ filter: { ownerId: 'nobody' } });

    expect(blogs.findAll).toHaveBeenCalledWith({ ownerId: 'nobody' }, undefined, undefined, undefined);
    expect(result).toEqual([]);
  });

  test('createPost: forwards the payload and returns a mapped post with a string blogId', async () => {
    const blog = await service.createBlog(BLOG);

    const post = await service.createPost({ ...POST, blogId: blog.id });

    expect(posts.create).toHaveBeenCalledTimes(1);
    expect(posts.create).toHaveBeenCalledWith({ ...POST, blogId: blog.id });
    expect(post).toMatchObject(POST);
    expect(post.blogId).toBe(blog.id);
    expect(typeof post.id).toBe('string');
    expect(post.id).toHaveLength(24); // Mongo ObjectId hex
    expect(typeof post.createdAt).toBe('number');
    expect(post).not.toHaveProperty('_id');
    expect(JSON.parse(JSON.stringify(post))).toEqual(post);
  });

  test('createPost: defaults images and documents to empty arrays', async () => {
    const blog = await service.createBlog(BLOG);

    const post = await service.createPost({ ...POST, blogId: blog.id });

    expect(post.images).toEqual([]);
    expect(post.documents).toEqual([]);
  });

  test('createPost: forwards provided images and documents', async () => {
    const blog = await service.createBlog(BLOG);
    const payload = {
      ...POST,
      blogId: blog.id,
      images: ['https://cdn.example.com/image-1.png'],
      documents: ['https://cdn.example.com/document-1.pdf'],
    };

    const post = await service.createPost(payload);

    expect(posts.create).toHaveBeenCalledWith(payload);
    expect(post.images).toEqual(payload.images);
    expect(post.documents).toEqual(payload.documents);
  });

  test('updatePost: applies a partial update and returns the mapped post', async () => {
    const blog = await service.createBlog(BLOG);
    const created = await service.createPost({ ...POST, blogId: blog.id });

    const updated = await service.updatePost({ id: created.id, updateData: { title: 'Updated' } });

    expect(posts.update).toHaveBeenCalledWith(created.id, { title: 'Updated' });
    expect(updated.id).toBe(created.id);
    expect(updated.title).toBe('Updated');
    expect(updated.content).toBe(POST.content);
    expect(updated.blogId).toBe(blog.id);
  });

  test('updatePost: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.updatePost({ id: 'unknown-id', updateData: { title: 'x' } })).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('deletePost: deletes only the requested post', async () => {
    const blog = await service.createBlog(BLOG);
    const first = await service.createPost({ ...POST, blogId: blog.id });
    const second = await service.createPost({ ...POST, blogId: blog.id, title: 'Second?' });

    const result = await service.deletePost(first.id);

    expect(result).toEqual({ id: first.id });
    expect(posts.store.has(first.id)).toBe(false);
    expect(posts.store.has(second.id)).toBe(true);
  });

  test('deletePost: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.deletePost('unknown-id')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('getPost: returns the mapped post', async () => {
    const blog = await service.createBlog(BLOG);
    const created = await service.createPost({ ...POST, blogId: blog.id });

    const post = await service.getPost(created.id);

    expect(post.id).toBe(created.id);
    expect(post.title).toBe(POST.title);
    expect(post.blogId).toBe(blog.id);
    expect(JSON.parse(JSON.stringify(post))).toEqual(post);
  });

  test('getPost: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.getPost('unknown-id')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('getPosts: filters by blogId and maps every result', async () => {
    const blog = await service.createBlog(BLOG);
    const otherBlog = await service.createBlog({ ...BLOG, name: 'Other' });
    await service.createPost({ ...POST, blogId: blog.id, title: 'A?' });
    await service.createPost({ ...POST, blogId: blog.id, title: 'B?' });
    await service.createPost({ ...POST, blogId: otherBlog.id, title: 'C?' });

    const result = await service.getPosts({ filter: { blogId: blog.id } });

    expect(posts.findAll).toHaveBeenCalledWith({ blogId: blog.id }, undefined, undefined, undefined);
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.title)).toEqual(['A?', 'B?']); // insertion order is stable in the fake
    for (const post of result) {
      expect(post.blogId).toBe(blog.id);
      expect(post).not.toHaveProperty('_id');
    }
  });

  test('getPosts: passes pagination through', async () => {
    const blog = await service.createBlog(BLOG);
    await service.createPost({ ...POST, blogId: blog.id, title: 'A?' });
    await service.createPost({ ...POST, blogId: blog.id, title: 'B?' });
    await service.createPost({ ...POST, blogId: blog.id, title: 'C?' });

    const result = await service.getPosts({ filter: { blogId: blog.id }, limit: 2, offset: 1 });

    expect(posts.findAll).toHaveBeenCalledWith({ blogId: blog.id }, undefined, 2, 1);
    expect(result.map((p) => p.title)).toEqual(['B?', 'C?']);
  });

  test('getPosts: returns an empty array when nothing matches', async () => {
    const blog = await service.createBlog(BLOG);
    await service.createPost({ ...POST, blogId: blog.id });

    const result = await service.getPosts({ filter: { blogId: 'nobody' } });

    expect(result).toEqual([]);
  });
});
