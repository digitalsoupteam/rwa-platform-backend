/**
 * In-memory fake of the signers-manager eden client (src/clients/eden.clients.ts).
 *
 * The real client is an elysia treaty client produced by
 * createSignersManagerClient(); the services only rely on
 * `client.createSignatureTask.post(body)` returning `{ data, error, status }`.
 * This fake mirrors that shape and resolves a successful task by default;
 * tests override a single call with
 * `client.createSignatureTask.post.mockImplementationOnce(...)` to exercise
 * the `taskResponse.error` branch.
 */
import { mock } from 'bun:test';

export type CreateSignatureTaskBody = {
  ownerId: string;
  ownerType: string;
  hash: string;
  expired: number;
  requiredSignatures: number;
};

export type CreateSignatureTaskResponse = {
  data: { id: string } | null;
  error: unknown;
  status: number;
};

export const DEFAULT_SIGNATURE_TASK_ID = 'signature-task-1';

export function createFakeSignersManagerClient() {
  return {
    createSignatureTask: {
      post: mock(
        async (_body: CreateSignatureTaskBody): Promise<CreateSignatureTaskResponse> => ({
          data: { id: DEFAULT_SIGNATURE_TASK_ID },
          error: null,
          status: 200,
        }),
      ),
    },
  };
}

export type FakeSignersManagerClient = ReturnType<typeof createFakeSignersManagerClient>;
