/**
 * Unit tests for AssistantService.
 *
 * Scope: the service layer only. AssistantRepository is replaced with an
 * in-memory fake (tests/fakes/assistant.repository.fake.ts), so these tests
 * need no database, no broker and no network. Run with `bun test` from
 * services/ai-assistant.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { AssistantService } from '../src/services/assistant.service';
import type { AssistantRepository } from '../src/repositories/assistant.repository';
import type { AssistantContext } from '../src/models/shared/enums.model';
import { createFakeAssistantRepository, type FakeAssistantRepository } from './fakes/assistant.repository.fake';

const ASSISTANT: { userId: string; name: string; contextPreferences: AssistantContext } = {
  userId: 'user-1',
  name: 'Research Analyst',
  contextPreferences: ['investor_base', 'popular_pools'],
};

describe('AssistantService (unit, fake repository)', () => {
  let assistants: FakeAssistantRepository;
  let service: AssistantService;

  beforeEach(() => {
    assistants = createFakeAssistantRepository();
    service = new AssistantService(assistants as unknown as AssistantRepository);
  });

  test('createAssistant: forwards the payload and returns a mapped assistant', async () => {
    const assistant = await service.createAssistant(ASSISTANT);

    expect(assistants.create).toHaveBeenCalledTimes(1);
    expect(assistants.create).toHaveBeenCalledWith(ASSISTANT);
    expect(assistant).toMatchObject(ASSISTANT);
    expect(typeof assistant.id).toBe('string');
    expect(assistant.id).toHaveLength(24); // Mongo ObjectId hex
    expect(assistant).not.toHaveProperty('_id');
    // The result must be plain JSON — no ObjectId or class instances leaking to the caller.
    expect(JSON.parse(JSON.stringify(assistant))).toEqual(assistant);
  });

  test('updateAssistant: applies a partial update and returns the mapped assistant', async () => {
    const created = await service.createAssistant(ASSISTANT);

    const updated = await service.updateAssistant(created.id, { name: 'Renamed' });

    expect(assistants.update).toHaveBeenCalledWith(created.id, { name: 'Renamed' });
    expect(updated).toEqual({ ...created, name: 'Renamed' });
    // Preferences survive an update that only carries a name.
    expect(updated.contextPreferences).toEqual(ASSISTANT.contextPreferences);
  });

  test('updateAssistant: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.updateAssistant('unknown-id', { name: 'x' })).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('getAssistant: returns the mapped assistant', async () => {
    const created = await service.createAssistant(ASSISTANT);

    const assistant = await service.getAssistant(created.id);

    expect(assistant).toEqual(created);
    expect(assistants.findById).toHaveBeenCalledWith(created.id);
  });

  test('getAssistant: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.getAssistant('unknown-id')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('getUserAssistants: filters by userId and maps every result', async () => {
    await service.createAssistant(ASSISTANT);
    await service.createAssistant({ ...ASSISTANT, userId: 'user-2', name: 'Second' });
    await service.createAssistant({ ...ASSISTANT, userId: 'user-2', name: 'Third' });

    const result = await service.getUserAssistants('user-2');

    expect(assistants.findAll).toHaveBeenCalledWith({ userId: 'user-2' });
    expect(result).toHaveLength(2);
    expect(result.map((a) => a.name)).toEqual(['Second', 'Third']); // insertion order is stable in the fake
    for (const assistant of result) {
      expect(assistant.userId).toBe('user-2');
      expect(assistant).not.toHaveProperty('_id');
    }
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  test('getUserAssistants: returns an empty array when nothing matches', async () => {
    await service.createAssistant(ASSISTANT);

    const result = await service.getUserAssistants('nobody');

    expect(result).toEqual([]);
  });

  test('deleteAssistant: deletes by id and returns the deleted id', async () => {
    const created = await service.createAssistant(ASSISTANT);

    const result = await service.deleteAssistant(created.id);

    expect(result).toEqual({ id: created.id });
    expect(assistants.store.has(created.id)).toBe(false);
  });

  test('deleteAssistant: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.deleteAssistant('unknown-id')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });
});
