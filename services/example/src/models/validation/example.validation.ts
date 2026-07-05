import { t } from 'elysia';

const exampleSchema = t.Object({
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

export const createExampleRequest = t.Pick(exampleSchema, [
  'name',
  'ownerId',
  'ownerType',
  'creator',
  'parentId',
  'grandParentId',
]);
export const createExampleResponse = exampleSchema;

export const updateExampleRequest = t.Object({
  id: t.String(),
  updateData: t.Partial(t.Pick(exampleSchema, ['name'])),
});
export const updateExampleResponse = exampleSchema;

export const deleteExampleRequest = t.Pick(exampleSchema, ['id']);
export const deleteExampleResponse = t.Pick(exampleSchema, ['id']);

export const getExampleRequest = t.Pick(exampleSchema, ['id']);
export const getExampleResponse = exampleSchema;

export const getExamplesRequest = t.Object({
  filter: t.Record(t.String(), t.Any()),
  sort: t.Optional(t.Record(t.String(), t.Union([t.Literal('asc'), t.Literal('desc')]))),
  limit: t.Optional(t.Number()),
  offset: t.Optional(t.Number()),
});
export const getExamplesResponse = t.Array(exampleSchema);

export const greetingResponse = t.Object({
  message: t.String(),
});
