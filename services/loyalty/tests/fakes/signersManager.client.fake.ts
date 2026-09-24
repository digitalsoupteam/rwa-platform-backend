/**
 * In-memory fake of the signers-manager Eden treaty client for unit tests.
 *
 * The real client (src/clients/eden.clients.ts) is built on createEdenTreatyClient
 * and exposes `createSignatureTask.post(...)`, which resolves to the
 * `{ data, error }` envelope. The loyalty service reads `taskResponse.error`
 * first and `taskResponse.data.id` afterwards, so the fake returns the same
 * envelope. Tests can override a single call with
 * `client.createSignatureTask.post.mockResolvedValueOnce({ data: null, error: someAppError })`.
 */
import { mock } from 'bun:test';

export type SignersManagerSignatureTaskPayload = {
  ownerId: string;
  ownerType: string;
  hash: string;
  expired: number;
  requiredSignatures: number;
};

/** The `{ data, error }` envelope the Eden treaty client resolves to. */
export type SignersManagerSignatureTaskResult = {
  data: ({ id: string } & SignersManagerSignatureTaskPayload) | null;
  error: unknown;
};

export const FAKE_SIGNERS_TASK_ID = 'signers-task-1';

export function createFakeSignersManagerClient() {
  const post = mock(
    async (payload: SignersManagerSignatureTaskPayload): Promise<SignersManagerSignatureTaskResult> => ({
      data: { id: FAKE_SIGNERS_TASK_ID, ...payload },
      error: null,
    }),
  );

  return {
    createSignatureTask: { post },
  };
}

export type FakeSignersManagerClient = ReturnType<typeof createFakeSignersManagerClient>;
