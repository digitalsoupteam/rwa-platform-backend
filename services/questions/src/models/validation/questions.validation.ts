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
  text: t.String(),
  userId: t.String(),
  createdAt: t.Number(),
  updatedAt: t.Number(),
});

export const questionSchema = t.Object({
  id: t.String(),
  topicId: t.String(),
  text: t.String(),
  answer: t.Optional(answerSchema),
  answered: t.Boolean(),
  likesCount: t.Number(),
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
 * Get topics
 */
export const getTopicsRequest = t.Object({
  filter: t.Record(t.String(), t.Any()),
  sort: t.Optional(t.Record(t.String(), t.Union([t.Literal("asc"), t.Literal("desc")]))),
  limit: t.Optional(t.Number()),
  offset: t.Optional(t.Number())
});
export const getTopicsResponse = t.Array(topicSchema);

/*
 * Create question
 */
export const createQuestionRequest = t.Pick(questionSchema, [
  "topicId",
  "text",
  "ownerId",
  "ownerType",
  "creator",
  "parentId",
  "grandParentId",
]);
export const createQuestionResponse = questionSchema;

/*
 * Update question text
 */
export const updateQuestionTextRequest = t.Object({
  id: t.String(),
  updateData: t.Object({
    text: t.String()
  })
});
export const updateQuestionTextResponse = questionSchema;

/*
 * Create question answer
 */
export const createQuestionAnswerRequest = t.Object({
  id: t.String(),
  userId: t.String(),
  text: t.String()
});
export const createQuestionAnswerResponse = t.Composite([
  t.Required(t.Pick(questionSchema, ['answer'])),
  t.Omit(questionSchema, ['answer']),
]);

/*
 * Update question answer
 */
export const updateQuestionAnswerRequest = t.Object({
  id: t.String(),
  updateData: t.Object({
    text: t.String()
  })
});
export const updateQuestionAnswerResponse = t.Composite([
  t.Required(t.Pick(questionSchema, ['answer'])),
  t.Omit(questionSchema, ['answer']),
]);

/*
 * Delete question
 */
export const deleteQuestionRequest = t.Pick(questionSchema, ["id"]);
export const deleteQuestionResponse = t.Pick(questionSchema, ["id"]);

/*
 * Get question
 */
export const getQuestionRequest = t.Pick(questionSchema, ["id"]);
export const getQuestionResponse = questionSchema;

/*
 * Get questions
 */
export const getQuestionsRequest = t.Object({
  filter: t.Record(t.String(), t.Any()),
  sort: t.Optional(t.Record(t.String(), t.Union([t.Literal("asc"), t.Literal("desc")]))),
  limit: t.Optional(t.Number()),
  offset: t.Optional(t.Number())
});
export const getQuestionsResponse = t.Array(questionSchema);

/*
 * Toggle like
 */
export const toggleQuestionLikeRequest = t.Object({
  questionId: t.String(),
  userId: t.String(),
});
export const toggleQuestionLikeResponse = t.Object({
  liked: t.Boolean(),
});