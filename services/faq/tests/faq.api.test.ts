/**
 * Component tests for the faq HTTP layer.
 *
 * The whole Elysia app is assembled in-process: real controllers and the real
 * FaqService, with repositories replaced by in-memory fakes. Requests go
 * through app.handle() — no port is bound, nothing is queried over the network.
 * Run with `bun test` from services/faq.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { Elysia } from 'elysia';
import { ErrorHandlerPlugin } from '@shared/errors/error-handler.plugin';
import { createServicesPlugin } from '../src/plugins/services.plugin';
import { createControllersPlugin } from '../src/plugins/controllers.plugin';
import type { RepositoriesPlugin } from '../src/plugins/repositories.plugin';
import { createFakeTopicRepository, type FakeTopicRepository } from './fakes/topic.repository.fake';
import { createFakeAnswerRepository, type FakeAnswerRepository } from './fakes/answer.repository.fake';

const TOPIC = {
  name: 'Getting started',
  ownerId: 'owner-1',
  ownerType: 'business',
  creator: 'user-1',
  parentId: 'parent-1',
  grandParentId: 'grand-1',
};

const ANSWER = {
  question: 'What is HOLD?',
  answer: 'The platform token.',
  ownerId: 'owner-1',
  ownerType: 'business',
  creator: 'user-1',
  parentId: 'parent-1',
  grandParentId: 'grand-1',
};

function buildApp(topics: FakeTopicRepository, answers: FakeAnswerRepository) {
  const repositoriesPlugin = new Elysia({ name: 'Repositories' })
    .decorate('topicRepository', topics)
    .decorate('answerRepository', answers);

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

describe('faq HTTP layer (component, fake repositories)', () => {
  let topics: FakeTopicRepository;
  let answers: FakeAnswerRepository;
  let app: App;

  beforeEach(() => {
    topics = createFakeTopicRepository();
    answers = createFakeAnswerRepository();
    app = buildApp(topics, answers);
  });

  test('createTopic → getTopic → getTopics round-trip', async () => {
    const created = await post(app, '/createTopic', TOPIC);
    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({ name: TOPIC.name, ownerId: TOPIC.ownerId });
    expect(typeof created.body.id).toBe('string');

    const fetched = await post(app, '/getTopic', { id: created.body.id });
    expect(fetched.status).toBe(200);
    expect(fetched.body).toEqual(created.body);

    const list = await post(app, '/getTopics', { filter: {} });
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(created.body.id);
  });

  test('createTopic: an invalid payload never reaches the repository', async () => {
    const response = await post(app, '/createTopic', { name: 'Missing everything else' });

    expect(response.status).not.toBe(200);
    expect(topics.create).toHaveBeenCalledTimes(0);
  });

  test('updateTopic: rename is visible through getTopic', async () => {
    const created = await post(app, '/createTopic', TOPIC);

    const updated = await post(app, '/updateTopic', { id: created.body.id, updateData: { name: 'Renamed' } });
    expect(updated.status).toBe(200);
    expect(updated.body.name).toBe('Renamed');

    const fetched = await post(app, '/getTopic', { id: created.body.id });
    expect(fetched.body.name).toBe('Renamed');
  });

  test('deleteTopic: an unknown id maps to 404 NOT_FOUND', async () => {
    const response = await post(app, '/deleteTopic', { id: 'unknown-id' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Topic unknown-id not found' } });
  });

  test('answers: create, list by topicId, delete', async () => {
    const topic = (await post(app, '/createTopic', TOPIC)).body;

    const created = await post(app, '/createAnswer', { ...ANSWER, topicId: topic.id });
    expect(created.status).toBe(200);
    expect(created.body.topicId).toBe(topic.id);

    const list = await post(app, '/getAnswers', { filter: { topicId: topic.id } });
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);

    const deleted = await post(app, '/deleteAnswer', { id: created.body.id });
    expect(deleted.status).toBe(200);

    const after = await post(app, '/getAnswers', { filter: { topicId: topic.id } });
    expect(after.body).toHaveLength(0);
  });

  test('getTopics: filter is forwarded end-to-end', async () => {
    await post(app, '/createTopic', TOPIC);
    await post(app, '/createTopic', { ...TOPIC, name: 'Other', ownerId: 'owner-2' });

    const list = await post(app, '/getTopics', { filter: { ownerId: 'owner-2' } });

    expect(list.body).toHaveLength(1);
    expect(list.body[0].name).toBe('Other');
  });
});
