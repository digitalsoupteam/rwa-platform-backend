/**
 * Unit tests for ReactionsService.
 *
 * Scope: the service layer only. The repository is replaced with an in-memory
 * fake (tests/fakes/*.fake.ts), so these tests need no database, no broker
 * and no network. Run with `bun test` from services/reactions.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { AppError } from '@shared/errors/app-errors';
import { ReactionsService } from '../src/services/reactions.service';
import type { ReactionRepository } from '../src/repositories/reaction.repository';
import { createFakeReactionRepository, type FakeReactionRepository } from './fakes/reaction.repository.fake';

const REACTION = {
  parentId: 'post-1',
  parentType: 'post',
  userId: 'user-1',
  reaction: 'like',
};

describe('ReactionsService (unit, fake repository)', () => {
  let reactions: FakeReactionRepository;
  let service: ReactionsService;

  beforeEach(() => {
    reactions = createFakeReactionRepository();
    service = new ReactionsService(reactions as unknown as ReactionRepository);
  });

  test('setReaction: forwards the payload and returns a mapped reaction', async () => {
    const reaction = await service.setReaction(REACTION);

    expect(reactions.create).toHaveBeenCalledTimes(1);
    expect(reactions.create).toHaveBeenCalledWith(REACTION);
    expect(reaction).toMatchObject(REACTION);
    expect(typeof reaction.id).toBe('string');
    expect(reaction.id).toHaveLength(24); // Mongo ObjectId hex
    expect(typeof reaction.createdAt).toBe('number');
    expect(typeof reaction.updatedAt).toBe('number');
    expect(reaction).not.toHaveProperty('_id');
    // The result must be plain JSON — no ObjectId or class instances leaking to the caller.
    expect(JSON.parse(JSON.stringify(reaction))).toEqual(reaction);
  });

  test('setReaction: stores each reaction separately and returns distinct ids', async () => {
    const first = await service.setReaction(REACTION);
    const second = await service.setReaction({ ...REACTION, userId: 'user-2' });

    expect(first.id).not.toBe(second.id);
    expect(reactions.store.size).toBe(2);
  });

  test('setReaction: propagates an AppError raised by the repository unchanged', async () => {
    reactions.create.mockImplementationOnce(async () => {
      throw new AppError({ message: 'Duplicate reaction', statusCode: 409, code: 'CONFLICT' });
    });

    await expect(service.setReaction(REACTION)).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
      message: 'Duplicate reaction',
    });
  });

  test('resetReaction: removes the reaction and returns the mapped result', async () => {
    const created = await service.setReaction(REACTION);

    const removed = await service.resetReaction(REACTION);

    expect(reactions.delete).toHaveBeenCalledTimes(1);
    expect(reactions.delete).toHaveBeenCalledWith(REACTION);
    expect(removed.id).toBe(created.id);
    expect(removed.reaction).toBe(REACTION.reaction);
    expect(reactions.store.has(created.id)).toBe(false);
    expect(removed).not.toHaveProperty('_id');
    expect(JSON.parse(JSON.stringify(removed))).toEqual(removed);
  });

  test('resetReaction: propagates NOT_FOUND for a reaction that was never set', async () => {
    await expect(service.resetReaction(REACTION)).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Reaction post-1:user-1:like not found',
    });
  });

  test('getEntityReactions: aggregates counts and returns the requesting user reactions', async () => {
    await service.setReaction(REACTION);
    await service.setReaction({ ...REACTION, userId: 'user-2' });
    await service.setReaction({ ...REACTION, userId: 'user-2', reaction: 'dislike' });
    await service.setReaction({ ...REACTION, parentId: 'post-2' });

    const result = await service.getEntityReactions({ parentId: 'post-1', parentType: 'post', userId: 'user-2' });

    expect(reactions.getEntityStats).toHaveBeenCalledWith('post-1', 'post');
    expect(reactions.getUserReaction).toHaveBeenCalledWith('post-1', 'user-2');
    expect(result.reactions).toEqual({ like: 2, dislike: 1 });
    expect(result.userReactions).toEqual(['like', 'dislike']); // insertion order is stable in the fake
  });

  test('getEntityReactions: skips the per-user lookup when userId is omitted', async () => {
    await service.setReaction(REACTION);

    const result = await service.getEntityReactions({ parentId: 'post-1', parentType: 'post' });

    expect(reactions.getUserReaction).toHaveBeenCalledTimes(0);
    expect(result.reactions).toEqual({ like: 1 });
    expect(result.userReactions).toEqual([]);
  });

  test('getEntityReactions: returns empty stats for an entity without reactions', async () => {
    const result = await service.getEntityReactions({ parentId: 'post-unknown', parentType: 'post' });

    expect(result).toEqual({ reactions: {}, userReactions: [] });
  });

  test('getReactions: passes filter/sort/pagination through and maps every result', async () => {
    await service.setReaction(REACTION);
    await service.setReaction({ ...REACTION, userId: 'user-2' });
    await service.setReaction({ ...REACTION, parentId: 'post-2' });

    const result = await service.getReactions({
      filter: { parentId: 'post-1' },
      sort: { createdAt: 'asc' },
      limit: 10,
      offset: 0,
    });

    expect(reactions.findAll).toHaveBeenCalledWith({ parentId: 'post-1' }, { createdAt: 'asc' }, 10, 0);
    expect(result).toHaveLength(2);
    expect(result.map((reaction) => reaction.userId)).toEqual(['user-1', 'user-2']);
    for (const reaction of result) {
      expect(typeof reaction.id).toBe('string');
      expect(reaction).not.toHaveProperty('_id');
    }
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  test('getReactions: applies the default filter/sort/pagination when called without params', async () => {
    const result = await service.getReactions();

    expect(reactions.findAll).toHaveBeenCalledWith({}, { createdAt: 'desc' }, 100, 0);
    expect(result).toEqual([]);
  });

  test('getReactions: returns an empty array when nothing matches', async () => {
    await service.setReaction(REACTION);

    const result = await service.getReactions({ filter: { parentId: 'nobody' } });

    expect(result).toEqual([]);
  });
});
