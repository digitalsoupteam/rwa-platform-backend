/**
 * Component tests for the ai-assistant HTTP layer.
 *
 * The whole Elysia app is assembled in-process: real controllers and real
 * services, with repositories and injected clients replaced by in-memory fakes.
 * The fake Repositories and Clients plugins expose the same decorator names
 * that src/plugins/services.plugin.ts reads back through `.decorator`. Requests
 * go through app.handle() — no port is bound, nothing is queried over the
 * network. Run with `bun test` from services/ai-assistant.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { Elysia } from 'elysia';
import { AppError } from '@shared/errors/app-errors';
import { ErrorHandlerPlugin } from '@shared/errors/error-handler.plugin';
import { createServicesPlugin } from '../src/plugins/services.plugin';
import { createControllersPlugin } from '../src/plugins/controllers.plugin';
import type { ClientsPlugin } from '../src/plugins/clients.plugin';
import type { RepositoriesPlugin } from '../src/plugins/repositories.plugin';
import { createFakeAssistantRepository, type FakeAssistantRepository } from './fakes/assistant.repository.fake';
import { createFakeMessageRepository, type FakeMessageRepository } from './fakes/message.repository.fake';
import { createFakeOpenRouterClient, type FakeOpenRouterClient } from './fakes/openrouter.client.fake';
import {
  createFakePortfolioClient,
  createFakeRwaClient,
  type FakePortfolioClient,
  type FakeRwaClient,
} from './fakes/eden.clients.fake';

/** Model name normally provided by createApp() from OPENROUTER_MODEL. */
const MODEL = 'openrouter/test-model';

const ASSISTANT = {
  name: 'Research Analyst',
  userId: 'user-1',
  contextPreferences: ['investor_base'],
};

function buildApp(
  assistants: FakeAssistantRepository,
  messages: FakeMessageRepository,
  openRouter: FakeOpenRouterClient,
  rwa: FakeRwaClient,
  portfolio: FakePortfolioClient,
) {
  // Same decorator names as src/plugins/repositories.plugin.ts and
  // src/plugins/clients.plugin.ts — createServicesPlugin reads them back
  // through `.decorator`.
  const repositoriesPlugin = new Elysia({ name: 'Repositories' })
    .decorate('assistantRepository', assistants)
    .decorate('messageRepository', messages);

  const clientsPlugin = new Elysia({ name: 'Clients' })
    .decorate('openRouterClient', openRouter)
    .decorate('rwaClient', rwa)
    .decorate('portfolioClient', portfolio);

  const servicesPlugin = createServicesPlugin(
    repositoriesPlugin as unknown as RepositoriesPlugin,
    clientsPlugin as unknown as ClientsPlugin,
    MODEL,
  );

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

async function createAssistant(app: App, overrides: Record<string, unknown> = {}) {
  const response = await post(app, '/createAssistant', { ...ASSISTANT, ...overrides });
  expect(response.status).toBe(200);

  return response.body as { id: string; userId: string; name: string; contextPreferences: string[] };
}

describe('ai-assistant HTTP layer (component, fake repositories and clients)', () => {
  let assistants: FakeAssistantRepository;
  let messages: FakeMessageRepository;
  let openRouter: FakeOpenRouterClient;
  let rwa: FakeRwaClient;
  let portfolio: FakePortfolioClient;
  let app: App;

  beforeEach(() => {
    assistants = createFakeAssistantRepository();
    messages = createFakeMessageRepository();
    openRouter = createFakeOpenRouterClient();
    rwa = createFakeRwaClient();
    portfolio = createFakePortfolioClient();
    app = buildApp(assistants, messages, openRouter, rwa, portfolio);
  });

  test('createAssistant → getAssistant → getUserAssistants round-trip', async () => {
    const created = await post(app, '/createAssistant', ASSISTANT);
    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({
      name: ASSISTANT.name,
      userId: ASSISTANT.userId,
      contextPreferences: ASSISTANT.contextPreferences,
    });
    expect(typeof created.body.id).toBe('string');
    expect(created.body.id).toHaveLength(24); // Mongo ObjectId hex

    const fetched = await post(app, '/getAssistant', { id: created.body.id });
    expect(fetched.status).toBe(200);
    expect(fetched.body).toEqual(created.body);

    const list = await post(app, '/getUserAssistants', { userId: ASSISTANT.userId });
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(created.body.id);
  });

  test('updateAssistant: rename is visible through getAssistant', async () => {
    const created = await createAssistant(app);

    const updated = await post(app, '/updateAssistant', { id: created.id, name: 'Renamed' });
    expect(updated.status).toBe(200);
    expect(updated.body.name).toBe('Renamed');
    // Preferences are kept when the update only carries a name.
    expect(updated.body.contextPreferences).toEqual(ASSISTANT.contextPreferences);

    const fetched = await post(app, '/getAssistant', { id: created.id });
    expect(fetched.body.name).toBe('Renamed');
  });

  test('deleteAssistant: deletes the assistant and a later getAssistant maps to 404', async () => {
    const created = await createAssistant(app);

    const deleted = await post(app, '/deleteAssistant', { id: created.id });
    expect(deleted.status).toBe(200);
    expect(deleted.body).toEqual({ id: created.id });
    expect(assistants.store.has(created.id)).toBe(false);

    const fetched = await post(app, '/getAssistant', { id: created.id });
    expect(fetched.status).toBe(404);
    expect(fetched.body).toEqual({ error: { code: 'NOT_FOUND', message: `Assistant ${created.id} not found` } });
  });

  test('getAssistant: an unknown id maps to 404 NOT_FOUND', async () => {
    const response = await post(app, '/getAssistant', { id: 'unknown-id' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Assistant unknown-id not found' } });
  });

  test('createAssistant: an invalid payload never reaches the repository', async () => {
    const response = await post(app, '/createAssistant', { name: 'Missing userId and contextPreferences' });

    expect(response.status).not.toBe(200);
    expect(assistants.create).toHaveBeenCalledTimes(0);
  });

  test('createMessage: returns the user/assistant pair and history/get/update/delete work on it', async () => {
    const assistant = await createAssistant(app);

    const created = await post(app, '/createMessage', { assistantId: assistant.id, text: 'What is HOLD?' });
    expect(created.status).toBe(200);
    expect(created.body).toHaveLength(2);
    expect(created.body[0]).toMatchObject({ assistantId: assistant.id, text: 'What is HOLD?', sender: 'user' });
    expect(created.body[1]).toMatchObject({ assistantId: assistant.id, sender: 'assistant' });

    // The model call carries the model configured on the services plugin and middle-out compression.
    expect(openRouter.chatCompletion).toHaveBeenCalledTimes(1);
    const request = openRouter.chatCompletion.mock.calls[0][0];
    expect(request.model).toBe(MODEL);
    expect(request.transforms).toEqual(['middle-out']);

    const history = await post(app, '/getMessageHistory', { assistantId: assistant.id });
    expect(history.status).toBe(200);
    expect(history.body).toHaveLength(2);

    const fetched = await post(app, '/getMessage', { id: created.body[1].id });
    expect(fetched.status).toBe(200);
    expect(fetched.body).toEqual(created.body[1]);

    const updated = await post(app, '/updateMessage', { id: created.body[1].id, text: 'Edited reply' });
    expect(updated.status).toBe(200);
    expect(updated.body.text).toBe('Edited reply');

    const deleted = await post(app, '/deleteMessage', { id: created.body[0].id });
    expect(deleted.status).toBe(200);
    expect(deleted.body).toEqual({ id: created.body[0].id });

    const after = await post(app, '/getMessageHistory', { assistantId: assistant.id });
    expect(after.body).toHaveLength(1);
    expect(after.body[0].id).toBe(created.body[1].id);
  });

  test('createMessage: user_portfolio context assembled from the fake clients reaches the model call', async () => {
    const assistant = await createAssistant(app, { contextPreferences: ['user_portfolio'] });
    portfolio.state.balances.push({ owner: ASSISTANT.userId, poolAddress: '0xpool-1', balance: 10 });
    rwa.state.pools.push({
      id: '0xpool-1',
      name: 'Solar Farm One',
      poolAddress: '0xpool-1',
      awaitingRwaAmount: '500',
      expectedRwaAmount: '1000',
    });

    const created = await post(app, '/createMessage', { assistantId: assistant.id, text: 'How am I doing?' });

    expect(created.status).toBe(200);
    expect(portfolio.getBalances.post).toHaveBeenCalledTimes(1);
    expect(rwa.getPools.post).toHaveBeenCalledTimes(1);

    const systemContent = String(openRouter.chatCompletion.mock.calls[0][0].messages[0].content);
    expect(systemContent).toContain('Your current investments:');
    expect(systemContent).toContain('- Solar Farm One: 10 tokens');
  });

  test('createMessage: an unknown assistant maps to 404 and persists nothing', async () => {
    const response = await post(app, '/createMessage', { assistantId: 'unknown-id', text: 'Hi' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Assistant unknown-id not found' } });
    expect(messages.create).toHaveBeenCalledTimes(0);
    expect(openRouter.chatCompletion).toHaveBeenCalledTimes(0);
  });

  test('createMessage: an OpenRouter failure maps to 502 UPSTREAM_ERROR', async () => {
    const assistant = await createAssistant(app);
    openRouter.chatCompletion.mockImplementation(async () => {
      throw new AppError({
        message: 'OpenRouter Chat API error: 502 Bad Gateway',
        statusCode: 502,
        code: 'UPSTREAM_ERROR',
      });
    });

    const response = await post(app, '/createMessage', { assistantId: assistant.id, text: 'Hi' });

    expect(response.status).toBe(502);
    expect(response.body).toEqual({
      error: { code: 'UPSTREAM_ERROR', message: 'OpenRouter Chat API error: 502 Bad Gateway' },
    });
    // Current behavior: the user message is persisted before the failing upstream call.
    expect(messages.create).toHaveBeenCalledTimes(1);
  });

  test('createMessage: an invalid payload never reaches the repositories', async () => {
    const response = await post(app, '/createMessage', { assistantId: 'assistant-1' });

    expect(response.status).not.toBe(200);
    expect(messages.create).toHaveBeenCalledTimes(0);
  });
});
