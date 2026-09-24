/**
 * Unit tests for QuestionsService.
 *
 * Scope: the service layer only. Repositories are replaced with in-memory
 * fakes (tests/fakes/*.fake.ts), so these tests need no database, no broker
 * and no network. Run with `bun test` from services/questions.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { QuestionsService } from '../src/services/questions.service';
import type { TopicRepository } from '../src/repositories/topic.repository';
import type { QuestionRepository } from '../src/repositories/question.repository';
import type { QuestionLikesRepository } from '../src/repositories/questionLikes.repository';
import { createFakeTopicRepository, type FakeTopicRepository } from './fakes/topic.repository.fake';
import { createFakeQuestionRepository, type FakeQuestionRepository } from './fakes/question.repository.fake';
import {
  createFakeQuestionLikesRepository,
  type FakeQuestionLikesRepository,
} from './fakes/questionLikes.repository.fake';

const TOPIC = {
  name: 'Getting started',
  ownerId: 'owner-1',
  ownerType: 'business',
  creator: 'user-1',
  parentId: 'parent-1',
  grandParentId: 'grand-1',
};

const QUESTION = {
  text: 'How does staking work?',
  ownerId: 'owner-1',
  ownerType: 'business',
  creator: 'user-1',
  parentId: 'parent-1',
  grandParentId: 'grand-1',
};

const ANSWER = {
  userId: 'user-2',
  text: 'Stake HOLD and wait for the next epoch.',
};

describe('QuestionsService (unit, fake repositories)', () => {
  let topics: FakeTopicRepository;
  let questions: FakeQuestionRepository;
  let likes: FakeQuestionLikesRepository;
  let service: QuestionsService;

  beforeEach(() => {
    topics = createFakeTopicRepository();
    questions = createFakeQuestionRepository();
    likes = createFakeQuestionLikesRepository();
    service = new QuestionsService(
      topics as unknown as TopicRepository,
      questions as unknown as QuestionRepository,
      likes as unknown as QuestionLikesRepository,
    );
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
    expect(updated).not.toHaveProperty('_id');
  });

  test('updateTopic: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.updateTopic({ id: 'unknown-id', updateData: { name: 'x' } })).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('deleteTopic: deletes every question of the topic, then the topic itself', async () => {
    const topic = await service.createTopic(TOPIC);
    const otherTopic = await service.createTopic({ ...TOPIC, name: 'Other' });
    const first = await service.createQuestion({ ...QUESTION, topicId: topic.id });
    const second = await service.createQuestion({ ...QUESTION, topicId: topic.id, text: 'Second?' });
    const foreign = await service.createQuestion({ ...QUESTION, topicId: otherTopic.id, text: 'Foreign?' });

    const result = await service.deleteTopic(topic.id);

    expect(result).toEqual({ id: topic.id });
    expect(questions.findAll).toHaveBeenCalledWith({ topicIds: [topic.id] });
    expect(questions.delete).toHaveBeenCalledTimes(2);
    expect(questions.delete).toHaveBeenCalledWith(first.id);
    expect(questions.delete).toHaveBeenCalledWith(second.id);
    expect(questions.store.has(first.id)).toBe(false);
    expect(questions.store.has(second.id)).toBe(false);
    expect(questions.store.has(foreign.id)).toBe(true);
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
    expect(topic).not.toHaveProperty('_id');
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

    const result = await service.getTopics({ filter: { ownerId: 'owner-2' }, limit: 10, offset: 1 });

    expect(topics.findAll).toHaveBeenCalledWith({ ownerId: 'owner-2' }, undefined, 10, 1);
    expect(result).toHaveLength(1);
    expect(result.map((topic) => topic.name)).toEqual(['Third']);
    for (const topic of result) {
      expect(typeof topic.id).toBe('string');
      expect(topic).not.toHaveProperty('_id');
    }
  });

  test('getTopics: returns an empty array when nothing matches', async () => {
    await service.createTopic(TOPIC);

    const result = await service.getTopics({ filter: { ownerId: 'nobody' } });

    expect(result).toEqual([]);
  });

  test('createQuestion: forwards the payload and returns a mapped question', async () => {
    const topic = await service.createTopic(TOPIC);

    const question = await service.createQuestion({ ...QUESTION, topicId: topic.id });

    expect(questions.create).toHaveBeenCalledTimes(1);
    expect(questions.create).toHaveBeenCalledWith({ ...QUESTION, topicId: topic.id });
    expect(question).toMatchObject({ ...QUESTION, topicId: topic.id });
    expect(typeof question.id).toBe('string');
    expect(question.id).toHaveLength(24); // Mongo ObjectId hex
    expect(question.topicId).toBe(topic.id); // string, not a raw ObjectId
    expect(question.answered).toBe(false);
    expect(question.likesCount).toBe(0);
    expect(question.answer).toBeUndefined();
    expect(question).not.toHaveProperty('_id');
  });

  test('updateQuestionText: applies the new text and returns the mapped question', async () => {
    const topic = await service.createTopic(TOPIC);
    const created = await service.createQuestion({ ...QUESTION, topicId: topic.id });

    const updated = await service.updateQuestionText({ id: created.id, updateData: { text: 'Updated?' } });

    expect(questions.updateText).toHaveBeenCalledWith(created.id, 'Updated?');
    expect(updated.id).toBe(created.id);
    expect(updated.text).toBe('Updated?');
    expect(updated.topicId).toBe(topic.id);
    expect(updated.answer).toBeUndefined();
    expect(updated).not.toHaveProperty('_id');
  });

  test('updateQuestionText: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.updateQuestionText({ id: 'unknown-id', updateData: { text: 'x' } })).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('updateAnswer: applies the new answer text and returns the mapped question', async () => {
    const topic = await service.createTopic(TOPIC);
    const created = await service.createQuestion({ ...QUESTION, topicId: topic.id });
    await service.createAnswer({ id: created.id, ...ANSWER });

    const updated = await service.updateAnswer({ id: created.id, updateData: { text: 'Revised answer.' } });

    expect(questions.updateAnswerText).toHaveBeenCalledWith(created.id, 'Revised answer.');
    expect(updated.id).toBe(created.id);
    expect(updated.answered).toBe(true);
    expect(updated.answer).toMatchObject({ userId: ANSWER.userId, text: 'Revised answer.' });
    expect(updated).not.toHaveProperty('_id');
  });

  test('createAnswer: forwards the question id and the answer payload, returns the mapped question', async () => {
    const topic = await service.createTopic(TOPIC);
    const created = await service.createQuestion({ ...QUESTION, topicId: topic.id });

    const answered = await service.createAnswer({ id: created.id, ...ANSWER });

    expect(questions.createAnswer).toHaveBeenCalledWith(created.id, { userId: ANSWER.userId, text: ANSWER.text });
    expect(answered.id).toBe(created.id);
    expect(answered.answered).toBe(true);
    expect(answered.answer).toMatchObject({ userId: ANSWER.userId, text: ANSWER.text });
    expect(typeof answered.answer?.createdAt).toBe('number');
    expect(answered).not.toHaveProperty('_id');
    expect(JSON.parse(JSON.stringify(answered))).toEqual(answered);
  });

  test('createAnswer: propagates NOT_FOUND for an unknown question id', async () => {
    await expect(service.createAnswer({ id: 'unknown-id', ...ANSWER })).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('deleteQuestion: deletes only the requested question', async () => {
    const topic = await service.createTopic(TOPIC);
    const first = await service.createQuestion({ ...QUESTION, topicId: topic.id });
    const second = await service.createQuestion({ ...QUESTION, topicId: topic.id, text: 'Second?' });

    const result = await service.deleteQuestion(first.id);

    expect(result).toEqual({ id: first.id });
    expect(questions.delete).toHaveBeenCalledWith(first.id);
    expect(questions.store.has(first.id)).toBe(false);
    expect(questions.store.has(second.id)).toBe(true);
  });

  test('deleteQuestion: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.deleteQuestion('unknown-id')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('getQuestion: returns the mapped question with string ids', async () => {
    const topic = await service.createTopic(TOPIC);
    const created = await service.createQuestion({ ...QUESTION, topicId: topic.id });
    await service.createAnswer({ id: created.id, ...ANSWER });

    const question = await service.getQuestion(created.id);

    expect(question.id).toBe(created.id);
    expect(question.topicId).toBe(topic.id);
    expect(typeof question.topicId).toBe('string');
    expect(question.text).toBe(QUESTION.text);
    expect(question.answered).toBe(true);
    expect(question.answer).toMatchObject({ userId: ANSWER.userId, text: ANSWER.text });
    expect(question).not.toHaveProperty('_id');
    // The result must be plain JSON — no ObjectId or class instances leaking to the caller.
    expect(JSON.parse(JSON.stringify(question))).toEqual(question);
  });

  test('getQuestion: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.getQuestion('unknown-id')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('getQuestions: filters by topicId, forwards pagination and maps every result', async () => {
    const topic = await service.createTopic(TOPIC);
    const otherTopic = await service.createTopic({ ...TOPIC, name: 'Other' });
    await service.createQuestion({ ...QUESTION, topicId: topic.id, text: 'A?' });
    await service.createQuestion({ ...QUESTION, topicId: topic.id, text: 'B?' });
    await service.createQuestion({ ...QUESTION, topicId: otherTopic.id, text: 'C?' });

    const result = await service.getQuestions({
      filter: { topicId: topic.id },
      sort: { createdAt: 'desc' },
      limit: 10,
      offset: 0,
    });

    expect(questions.findAll).toHaveBeenCalledWith({ topicId: topic.id }, { createdAt: 'desc' }, 10, 0);
    expect(result).toHaveLength(2);
    expect(result.map((question) => question.text)).toEqual(['A?', 'B?']); // insertion order is stable in the fake
    for (const question of result) {
      expect(question.topicId).toBe(topic.id);
      expect(question).not.toHaveProperty('_id');
    }
  });

  test('getQuestions: returns an empty array when nothing matches', async () => {
    const topic = await service.createTopic(TOPIC);
    await service.createQuestion({ ...QUESTION, topicId: topic.id });

    const result = await service.getQuestions({ filter: { topicId: 'nobody' } });

    expect(result).toEqual([]);
  });

  test('toggleLike: creates a like and increments the counter when the user has not liked yet', async () => {
    const topic = await service.createTopic(TOPIC);
    const question = await service.createQuestion({ ...QUESTION, topicId: topic.id });

    const result = await service.toggleLike({ questionId: question.id, userId: 'user-2' });

    expect(result).toEqual({ liked: true });
    expect(likes.exists).toHaveBeenCalledWith(question.id, 'user-2');
    expect(likes.create).toHaveBeenCalledWith({ questionId: question.id, userId: 'user-2' });
    expect(questions.incrementLikes).toHaveBeenCalledWith(question.id);
    expect(questions.decrementLikes).toHaveBeenCalledTimes(0);
    expect(likes.store.size).toBe(1);
    expect(questions.store.get(question.id)?.likesCount).toBe(1);
  });

  test('toggleLike: removes the like and decrements the counter when the user has already liked', async () => {
    const topic = await service.createTopic(TOPIC);
    const question = await service.createQuestion({ ...QUESTION, topicId: topic.id });
    await service.toggleLike({ questionId: question.id, userId: 'user-2' });

    const result = await service.toggleLike({ questionId: question.id, userId: 'user-2' });

    expect(result).toEqual({ liked: false });
    expect(likes.delete).toHaveBeenCalledWith(question.id, 'user-2');
    expect(questions.decrementLikes).toHaveBeenCalledWith(question.id);
    expect(questions.incrementLikes).toHaveBeenCalledTimes(1); // only the first toggle
    expect(likes.store.size).toBe(0);
    expect(questions.store.get(question.id)?.likesCount).toBe(0);
  });

  test('toggleLike: propagates NOT_FOUND when the question does not exist', async () => {
    const topic = await service.createTopic(TOPIC);
    const question = await service.createQuestion({ ...QUESTION, topicId: topic.id });
    await service.deleteQuestion(question.id);

    await expect(service.toggleLike({ questionId: question.id, userId: 'user-2' })).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });
});
