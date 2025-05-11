import { t } from "elysia";

// Base schemas
const signatureTaskSchema = t.Object({
  id: t.String(),
  ownerId: t.String(),
  ownerType: t.String(),
  hash: t.String(),
  requiredSignatures: t.Number(),
  expired: t.Number(),
  completed: t.Boolean(),
  signatures: t.Optional(
    t.Array(
      t.Object({
        signer: t.String(),
        signature: t.String(),
      })
    )
  ),
});

// Create signature task
export const createSignatureTaskRequest = t.Pick(signatureTaskSchema, [
  "ownerId",
  "ownerType",
  "hash",
  "requiredSignatures",
  "expired",
]);

export const createSignatureTaskResponse = signatureTaskSchema;

// Get signature task
export const getSignatureTaskRequest = t.Object({
  taskId: t.String(),
});

export const getSignatureTaskResponse = signatureTaskSchema;
