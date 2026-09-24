/**
 * In-memory fake of the HTTP client used for outbound webhook delivery.
 *
 * DeliveryService calls the global `fetch` directly — src has no injectable
 * HTTP client — so tests install this fake on globalThis.fetch (install()) and
 * put the real one back afterwards (restore()). Responses are plain stubs, not
 * real Response instances, which keeps the shapes the service reads (`ok`,
 * `status`, `text()`) while also allowing status 0 to be represented (an
 * opaque redirect, which the real runtime produces with redirect: 'manual').
 * Every call is wrapped in bun:test mock() so requests can be asserted.
 */
import { mock } from 'bun:test';

export type FakeFetchResponse = {
  status?: number;
  ok?: boolean;
  body?: string;
  /** When set, the fake rejects with this error instead of answering. */
  error?: unknown;
};

export type FakeFetchCall = { url: string; init: any };

export function createFakeFetch() {
  const calls: FakeFetchCall[] = [];
  let responses: FakeFetchResponse[] = [];
  let fallback: FakeFetchResponse = { status: 200, body: '' };

  const originalFetch = globalThis.fetch;

  const fetchMock = mock(async (url: any, init?: any) => {
    calls.push({ url: String(url), init });

    const spec = responses.shift() ?? fallback;
    if (spec.error) throw spec.error;

    const status = spec.status ?? 200;
    return {
      ok: spec.ok ?? (status >= 200 && status < 300),
      status,
      text: async () => spec.body ?? '',
    } as unknown as Response;
  });

  return {
    fetchMock,
    calls,

    /** Sets the response returned for every subsequent call. */
    setResponse(spec: FakeFetchResponse) {
      responses = [];
      fallback = spec;
    },

    /** Queues one response per call, in order; later calls reuse the last entry. */
    setResponses(specs: FakeFetchResponse[]) {
      responses = [...specs];
      if (specs.length > 0) fallback = specs[specs.length - 1];
    },

    /** Makes every subsequent call reject with the given error. */
    setError(error: unknown) {
      this.setResponse({ error });
    },

    install() {
      globalThis.fetch = fetchMock as unknown as typeof fetch;
    },

    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}

export type FakeFetch = ReturnType<typeof createFakeFetch>;
