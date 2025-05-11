import { t } from "elysia";
import { paginationSchema } from "./shared.validation";

/*
 * Entity schemas
 */
export const topicSchema = t.Object({
  id: t.String(),
  name: t.String(),
  ownerId: t.String(),
  ownerType: t.String(),
  creator: t.String(),
  parentId: t.String(),
  grandParentId: t.String(),
  createdAt: t.Number(),
  updatedAt: t.Number(),
});

export const answerSchema = t.Object({
  id: t.String(),
  topicId: t.String(),
  question: t.String(),
  answer: t.String(),
  order: t.Number(),
  ownerId: t.String(),
  ownerType: t.String(),
  creator: t.String(),
  parentId: t.String(),
  grandParentId: t.String(),
  createdAt: t.Number(),
  updatedAt: t.Number(),
});

/*
 * Create topic
 */
export const createTopicRequest = t.Pick(topicSchema, [
  "name",
  "ownerId",
  "ownerType",
  "creator",
  "parentId",
  "grandParentId",
]);
export const createTopicResponse = topicSchema;

/*
 * Update topic
 */
export const updateTopicRequest = t.Object({
  id: t.String(),
  updateData: t.Object({
    name: t.String()
  })
});
export const updateTopicResponse = topicSchema;

/*
 * Delete topic
 */
export const deleteTopicRequest = t.Pick(topicSchema, ["id"]);
export const deleteTopicResponse = t.Pick(topicSchema, ["id"]);

/*
 * Get topic
 */
export const getTopicRequest = t.Pick(topicSchema, ["id"]);
export const getTopicResponse = topicSchema;

/*
 * Get topics by parent ID
 */
export const getTopicsRequest = t.Object({
  filter: t.Record(t.String(), t.Any()),
  sort: t.Optional(t.Record(t.String(), t.Union([t.Literal("asc"), t.Literal("desc")]))),
  limit: t.Optional(t.Number()),
  offset: t.Optional(t.Number())
});
export const getTopicsResponse = t.Array(topicSchema);

/*
 * Create answer
 */
export const createAnswerRequest = t.Object({
  topicId: t.String(),
  question: t.String(),
  answer: t.String(),
  order: t.Optional(t.Number()),
  ownerId: t.String(),
  ownerType: t.String(),
  creator: t.String(),
  parentId: t.String(),
  grandParentId: t.String(),
});
export const createAnswerResponse = answerSchema;

/*
 * Update answer
 */
export const updateAnswerRequest = t.Object({
  id: t.String(),
  updateData: t.Partial(t.Object({
    question: t.String(),
    answer: t.String(),
    order: t.Number()
  }))
});
export const updateAnswerResponse = answerSchema;

/*
 * Delete answer
 */
export const deleteAnswerRequest = t.Pick(answerSchema, ["id"]);
export const deleteAnswerResponse = t.Pick(answerSchema, ["id"]);

/*
 * Get answer
 */
export const getAnswerRequest = t.Pick(answerSchema, ["id"]);
export const getAnswerResponse = answerSchema;

/*
 * Get answers
 */
export const getAnswersRequest = t.Object({
  filter: t.Record(t.String(), t.Any()),
  sort: t.Optional(t.Record(t.String(), t.Union([t.Literal("asc"), t.Literal("desc")]))),
  limit: t.Optional(t.Number()),
  offset: t.Optional(t.Number())
});
export const getAnswersResponse = t.Array(answerSchema);