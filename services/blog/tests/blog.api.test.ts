/**
 * Component tests for the blog HTTP layer.
 *
 * The whole Elysia app is assembled in-process: real controllers and the real
 * BlogsService, with repositories replaced by in-memory fakes. Requests go
 * through app.handle() — no port is bound, nothing is queried over the network.
 * Run with `bun test` from services/blog.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { Elysia } from 'elysia';
import { ErrorHandlerPlugin } from '@shared/errors/error-handler.plugin';
import { createServicesPlugin } from '../src/plugins/services.plugin';
import { createControllersPlugin } from '../src/plugins/controllers.plugin';
import type { RepositoriesPlugin } from '../src/plugins/repositories.plugin';
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

function buildApp(blogs: FakeBlogRepository, posts: FakePostRepository) {
  const repositoriesPlugin = new Elysia({ name: 'Repositories' })
    .decorate('blogRepository', blogs)
    .decorate('postRepository', posts);

  const servicesPlugin = createServicesPlugin(repositoriesPlugin as unknown as RepositoriesPlugin);

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

describe('blog HTTP layer (component, fake repositories)', () => {
  let blogs: FakeBlogRepository;
  let posts: FakePostRepository;
  let app: App;

  beforeEach(() => {
    blogs = createFakeBlogRepository();
    posts = createFakePostRepository();
    app = buildApp(blogs, posts);
  });

  test('createBlog → getBlog → getBlogs round-trip', async () => {
    const created = await post(app, '/createBlog', BLOG);
    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({ name: BLOG.name, ownerId: BLOG.ownerId });
    expect(typeof created.body.id).toBe('string');

    const fetched = await post(app, '/getBlog', { id: created.body.id });
    expect(fetched.status).toBe(200);
    expect(fetched.body).toEqual(created.body);

    const list = await post(app, '/getBlogs', { filter: {} });
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(created.body.id);
    expect(list.body[0]).not.toHaveProperty('_id');
  });

  test('createBlog: an invalid payload never reaches the repository', async () => {
    const response = await post(app, '/createBlog', { name: 'Missing everything else' });

    expect(response.status).not.toBe(200);
    expect(blogs.create).toHaveBeenCalledTimes(0);
  });

  test('updateBlog: rename is visible through getBlog', async () => {
    const created = await post(app, '/createBlog', BLOG);

    const updated = await post(app, '/updateBlog', { id: created.body.id, updateData: { name: 'Renamed' } });
    expect(updated.status).toBe(200);
    expect(updated.body.name).toBe('Renamed');

    const fetched = await post(app, '/getBlog', { id: created.body.id });
    expect(fetched.status).toBe(200);
    expect(fetched.body.name).toBe('Renamed');
  });

  test('deleteBlog: deletes the blog and its posts', async () => {
    const blog = (await post(app, '/createBlog', BLOG)).body;
    const created = await post(app, '/createPost', { ...POST, blogId: blog.id });
    expect(created.status).toBe(200);

    const deleted = await post(app, '/deleteBlog', { id: blog.id });
    expect(deleted.status).toBe(200);
    expect(deleted.body).toEqual({ id: blog.id });

    const fetched = await post(app, '/getBlog', { id: blog.id });
    expect(fetched.status).toBe(404);

    const list = await post(app, '/getPosts', { filter: { blogId: blog.id } });
    expect(list.status).toBe(200);
    expect(list.body).toEqual([]);
  });

  test('deleteBlog: an unknown id maps to 404 NOT_FOUND', async () => {
    const response = await post(app, '/deleteBlog', { id: 'unknown-id' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Blog unknown-id not found' } });
  });

  test('getBlog: an unknown id maps to 404 NOT_FOUND', async () => {
    const response = await post(app, '/getBlog', { id: 'unknown-id' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Blog unknown-id not found' } });
  });

  test('getBlogs: filter is forwarded end-to-end', async () => {
    await post(app, '/createBlog', BLOG);
    await post(app, '/createBlog', { ...BLOG, name: 'Other', ownerId: 'owner-2' });

    const list = await post(app, '/getBlogs', { filter: { ownerId: 'owner-2' } });

    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].name).toBe('Other');
  });

  test('posts: create, list by blogId, delete', async () => {
    const blog = (await post(app, '/createBlog', BLOG)).body;

    const created = await post(app, '/createPost', { ...POST, blogId: blog.id });
    expect(created.status).toBe(200);
    expect(created.body.blogId).toBe(blog.id);
    expect(created.body.images).toEqual([]);
    expect(created.body.documents).toEqual([]);

    const list = await post(app, '/getPosts', { filter: { blogId: blog.id } });
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(created.body.id);

    const deleted = await post(app, '/deletePost', { id: created.body.id });
    expect(deleted.status).toBe(200);

    const after = await post(app, '/getPosts', { filter: { blogId: blog.id } });
    expect(after.body).toHaveLength(0);
  });

  test('updatePost: edit is visible through getPost', async () => {
    const blog = (await post(app, '/createBlog', BLOG)).body;
    const created = (await post(app, '/createPost', { ...POST, blogId: blog.id })).body;

    const updated = await post(app, '/updatePost', {
      id: created.id,
      updateData: { title: 'Updated title', content: 'Updated content' },
    });
    expect(updated.status).toBe(200);
    expect(updated.body.title).toBe('Updated title');

    const fetched = await post(app, '/getPost', { id: created.id });
    expect(fetched.status).toBe(200);
    expect(fetched.body).toEqual(updated.body);
  });

  test('createPost: an invalid payload never reaches the repository', async () => {
    const response = await post(app, '/createPost', { title: 'Missing everything else' });

    expect(response.status).not.toBe(200);
    expect(posts.create).toHaveBeenCalledTimes(0);
  });

  test('getPosts: filter is forwarded end-to-end', async () => {
    const first = (await post(app, '/createBlog', BLOG)).body;
    const second = (await post(app, '/createBlog', { ...BLOG, name: 'Other', ownerId: 'owner-2' })).body;
    await post(app, '/createPost', { ...POST, blogId: first.id, title: 'First post' });
    await post(app, '/createPost', { ...POST, blogId: second.id, title: 'Second post' });

    const list = await post(app, '/getPosts', { filter: { blogId: second.id } });

    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].title).toBe('Second post');
  });

  test('getPost: an unknown id maps to 404 NOT_FOUND', async () => {
    const response = await post(app, '/getPost', { id: 'unknown-id' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Post unknown-id not found' } });
  });
});
