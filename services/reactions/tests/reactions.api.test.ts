/**
 * Component tests for the reactions HTTP layer.
 *
 * The whole Elysia app is assembled in-process: real controllers and the real
 * ReactionsService, with the repository replaced by an in-memory fake. Requests
 * go through app.handle() — no port is bound, nothing is queried over the network.
 * Run with `bun test` from services/reactions.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { Elysia } from 'elysia';
import { ErrorHandlerPlugin } from '@shared/errors/error-handler.plugin';
import { createServicesPlugin } from '../src/plugins/services.plugin';
import { createControllersPlugin } from '../src/plugins/controllers.plugin';
import type { RepositoriesPlugin } from '../src/plugins/repositories.plugin';
import { createFakeReactionRepository, type FakeReactionRepository } from './fakes/reaction.repository.fake';

const REACTION = {
  parentId: 'post-1',
  parentType: 'post',
  userId: 'user-1',
  reaction: 'like',
};

function buildApp(reactions: FakeReactionRepository) {
  const repositoriesPlugin = new Elysia({ name: 'Repositories' }).decorate('reactionRepository', reactions);

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

describe('reactions HTTP layer (component, fake repository)', () => {
  let reactions: FakeReactionRepository;
  let app: App;

  beforeEach(() => {
    reactions = createFakeReactionRepository();
    app = buildApp(reactions);
  });

  test('setReaction → getReactions → resetReaction round-trip', async () => {
    const created = await post(app, '/setReaction', REACTION);
    expect(created.status).toBe(200);
    expect(created.body).toMatchObject(REACTION);
    expect(typeof created.body.id).toBe('string');

    const fetched = await post(app, '/getReactions', { filter: { userId: 'user-1' } });
    expect(fetched.status).toBe(200);
    expect(fetched.body).toHaveLength(1);
    expect(fetched.body[0].id).toBe(created.body.id);

    const removed = await post(app, '/resetReaction', REACTION);
    expect(removed.status).toBe(200);
    expect(removed.body.id).toBe(created.body.id);

    const after = await post(app, '/getReactions', { filter: { userId: 'user-1' } });
    expect(after.status).toBe(200);
    expect(after.body).toHaveLength(0);
  });

  test('setReaction: an invalid payload never reaches the repository', async () => {
    const response = await post(app, '/setReaction', { parentId: 'post-1' });

    expect(response.status).not.toBe(200);
    expect(reactions.create).toHaveBeenCalledTimes(0);
  });

  test('resetReaction: an unknown reaction maps to 404 NOT_FOUND', async () => {
    const response = await post(app, '/resetReaction', REACTION);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Reaction post-1:user-1:like not found' },
    });
  });

  test('getEntityReactions: aggregates counts per reaction and lists the requester own reactions', async () => {
    await post(app, '/setReaction', REACTION);
    await post(app, '/setReaction', { ...REACTION, userId: 'user-2' });
    await post(app, '/setReaction', { ...REACTION, userId: 'user-2', reaction: 'dislike' });
    await post(app, '/setReaction', { ...REACTION, parentId: 'post-2' });

    const anonymous = await post(app, '/getEntityReactions', { parentId: 'post-1', parentType: 'post' });
    expect(anonymous.status).toBe(200);
    expect(anonymous.body).toEqual({ reactions: { like: 2, dislike: 1 }, userReactions: [] });
    expect(reactions.getUserReaction).toHaveBeenCalledTimes(0);

    const personalized = await post(app, '/getEntityReactions', {
      parentId: 'post-1',
      parentType: 'post',
      userId: 'user-1',
    });
    expect(personalized.status).toBe(200);
    expect(personalized.body.reactions).toEqual({ like: 2, dislike: 1 });
    expect(personalized.body.userReactions).toEqual(['like']);
  });

  test('getReactions: filter is forwarded end-to-end and ids are plain strings', async () => {
    await post(app, '/setReaction', REACTION);
    await post(app, '/setReaction', { ...REACTION, parentId: 'post-2' });
    await post(app, '/setReaction', { ...REACTION, parentId: 'post-2', userId: 'user-2', reaction: 'dislike' });

    const list = await post(app, '/getReactions', { filter: { parentId: 'post-2' } });

    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(2);
    expect(list.body.map((reaction: any) => reaction.userId).sort()).toEqual(['user-1', 'user-2']);
    for (const reaction of list.body) {
      expect(typeof reaction.id).toBe('string');
      expect(reaction).not.toHaveProperty('_id');
    }
  });

  test('getReactions: an unfiltered list returns every reaction', async () => {
    await post(app, '/setReaction', REACTION);
    await post(app, '/setReaction', { ...REACTION, userId: 'user-2' });

    const list = await post(app, '/getReactions', { filter: {} });

    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(2);
  });
});
