import { t } from 'elysia';

export const sampleRequest = t.Object({
  name: t.String(),
});

export const sampleResponse = t.Object({
  id: t.String(),
  name: t.String(),
  createdAt: t.Number(),
});
