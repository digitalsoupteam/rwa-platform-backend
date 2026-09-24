/**
 * Unit tests for FaqService.
 *
 * Scope: the service layer only. Repositories are replaced with in-memory
 * fakes (tests/fakes/*.fake.ts), so these tests need no database, no broker
 * and no network. Run with `bun test` from services/faq.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { FaqService } from '../src/services/faq.service';
import type { TopicRepository } from '../src/repositories/topic.repository';
import type { AnswerRepository } from '../src/repositories/answer.repository';
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

describe('FaqService (unit, fake repositories)', () => {
  let topics: FakeTopicRepository;
  let answers: FakeAnswerRepository;
  let service: FaqService;

  beforeEach(() => {
    topics = createFakeTopicRepository();
    answers = createFakeAnswerRepository();
    service = new FaqService(topics as unknown as TopicRepository, answers as unknown as AnswerRepository);
  });

  test('createTopic: forwards the payload and returns a mapped topic', async () => {
    const topic = await service.createTopic(TOPIC);

    expect(topics.create).toHaveBeenCalledTimes(1);
    expect(topics.create).toHaveBeenCalledWith(TOPIC);
    expect(topic).toMatchObject(TOPIC);
    expect(typeof topic.id).toBe('string');
    expect(topic.id).toHaveLength(24); // Mongo ObjectId hex
    expect(typeof topic.createdAt).toBe('number');
    expect(topic).not.toHaveProperty('_id');
    // The result must be plain JSON — no ObjectId or class instances leaking to the caller.
    expect(JSON.parse(JSON.stringify(topic))).toEqual(topic);
  });

  test('updateTopic: updates by id and returns the mapped topic', async () => {
    const created = await service.createTopic(TOPIC);

    const updated = await service.updateTopic({ id: created.id, updateData: { name: 'Renamed' } });

    expect(topics.update).toHaveBeenCalledWith(created.id, { name: 'Renamed' });
    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe('Renamed');
  });

  test('updateTopic: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.updateTopic({ id: 'unknown-id', updateData: { name: 'x' } })).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('deleteTopic: deletes every answer of the topic, then the topic itself', async () => {
    const topic = await service.createTopic(TOPIC);
    const otherTopic = await service.createTopic({ ...TOPIC, name: 'Other' });
    const first = await service.createAnswer({ ...ANSWER, topicId: topic.id });
    const second = await service.createAnswer({ ...ANSWER, topicId: topic.id, question: 'Second?' });
    const foreign = await service.createAnswer({ ...ANSWER, topicId: otherTopic.id });

    const result = await service.deleteTopic(topic.id);

    expect(result).toEqual({ id: topic.id });
    expect(answers.findAll).toHaveBeenCalledWith({ topicId: topic.id });
    expect(answers.delete).toHaveBeenCalledTimes(2);
    expect(answers.delete).toHaveBeenCalledWith(first.id);
    expect(answers.delete).toHaveBeenCalledWith(second.id);
    expect(answers.store.has(first.id)).toBe(false);
    expect(answers.store.has(second.id)).toBe(false);
    expect(answers.store.has(foreign.id)).toBe(true);
    expect(topics.store.has(topic.id)).toBe(false);
  });

  test('deleteTopic: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.deleteTopic('unknown-id')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('getTopic: returns the mapped topic', async () => {
    const created = await service.createTopic(TOPIC);

    const topic = await service.getTopic(created.id);

    expect(topic.id).toBe(created.id);
    expect(topic.name).toBe(TOPIC.name);
  });

  test('getTopic: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.getTopic('unknown-id')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('getTopics: passes filter/pagination through and maps every result', async () => {
    await service.createTopic(TOPIC);
    await service.createTopic({ ...TOPIC, name: 'Second', ownerId: 'owner-2' });
    await service.createTopic({ ...TOPIC, name: 'Third', ownerId: 'owner-2' });

    const result = await service.getTopics({ filter: { ownerId: 'owner-2' }, limit: 10, offset: 0 });

    expect(topics.findAll).toHaveBeenCalledWith({ ownerId: 'owner-2' }, undefined, 10, 0);
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.name)).toEqual(['Second', 'Third']);
    for (const topic of result) expect(topic).not.toHaveProperty('_id');
  });

  test('getTopics: returns an empty array when nothing matches', async () => {
    await service.createTopic(TOPIC);

    const result = await service.getTopics({ filter: { ownerId: 'nobody' } });

    expect(result).toEqual([]);
  });

  test('createAnswer: returns a mapped answer with a string topicId', async () => {
    const topic = await service.createTopic(TOPIC);

    const answer = await service.createAnswer({ ...ANSWER, topicId: topic.id, order: 3 });

    expect(answers.create).toHaveBeenCalledTimes(1);
    expect(answer.topicId).toBe(topic.id);
    expect(answer.question).toBe(ANSWER.question);
    expect(answer.order).toBe(3);
    expect(typeof answer.id).toBe('string');
    expect(answer).not.toHaveProperty('_id');
    expect(JSON.parse(JSON.stringify(answer))).toEqual(answer);
  });

  test('createAnswer: defaults order to 0 when omitted', async () => {
    const topic = await service.createTopic(TOPIC);

    const answer = await service.createAnswer({ ...ANSWER, topicId: topic.id });

    expect(answer.order).toBe(0);
  });

  test('updateAnswer: applies a partial update and returns the mapped answer', async () => {
    const topic = await service.createTopic(TOPIC);
    const created = await service.createAnswer({ ...ANSWER, topicId: topic.id });

    const updated = await service.updateAnswer({ id: created.id, updateData: { answer: 'Updated' } });

    expect(answers.update).toHaveBeenCalledWith(created.id, { answer: 'Updated' });
    expect(updated.id).toBe(created.id);
    expect(updated.answer).toBe('Updated');
    expect(updated.question).toBe(ANSWER.question);
  });

  test('deleteAnswer: deletes only the requested answer', async () => {
    const topic = await service.createTopic(TOPIC);
    const first = await service.createAnswer({ ...ANSWER, topicId: topic.id });
    const second = await service.createAnswer({ ...ANSWER, topicId: topic.id, question: 'Second?' });

    const result = await service.deleteAnswer(first.id);

    expect(result).toEqual({ id: first.id });
    expect(answers.store.has(first.id)).toBe(false);
    expect(answers.store.has(second.id)).toBe(true);
  });

  test('getAnswer: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.getAnswer('unknown-id')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('getAnswers: filters by topicId and maps every result', async () => {
    const topic = await service.createTopic(TOPIC);
    const otherTopic = await service.createTopic({ ...TOPIC, name: 'Other' });
    await service.createAnswer({ ...ANSWER, topicId: topic.id, question: 'A?' });
    await service.createAnswer({ ...ANSWER, topicId: topic.id, question: 'B?' });
    await service.createAnswer({ ...ANSWER, topicId: otherTopic.id, question: 'C?' });

    const result = await service.getAnswers({ filter: { topicId: topic.id } });

    expect(result).toHaveLength(2);
    expect(result.map((a) => a.question)).toEqual(['A?', 'B?']); // insertion order is stable in the fake
    for (const answer of result) expect(answer.topicId).toBe(topic.id);
  });
});
