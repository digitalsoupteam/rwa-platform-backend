import { t } from "elysia";

export const paginationSchema = t.Object({
  limit: t.Optional(t.Number()),
  offset: t.Optional(t.Number()),
  sort: t.Optional(t.Record(
    t.String(),
    t.Union([t.Literal('asc'), t.Literal('desc')])
  ))
});