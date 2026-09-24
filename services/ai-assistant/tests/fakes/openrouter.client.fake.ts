/**
 * In-memory fake of OpenRouterClient for unit tests.
 *
 * The real client performs HTTP fetches against OpenRouter. Tests use this fake
 * to keep the service layer isolated: no network, deterministic results. The
 * public API mirrors shared/openrouter/client.ts (completion, chatCompletion,
 * getGeneration, getModels) and every method is wrapped in bun:test mock() so
 * requests can be asserted. The ai-assistant service only calls chatCompletion;
 * the other methods are provided so the fake stands in for the whole class.
 */
import { mock } from 'bun:test';
import type {
  OpenRouterChatCompletionRequest,
  OpenRouterChatCompletionResponse,
  OpenRouterCompletionRequest,
  OpenRouterCompletionResponse,
  OpenRouterGenerationMetadata,
  OpenRouterModelsResponse,
} from '@shared/openrouter/types';

/** Default chat completion returned by the fake; tests can override per call. */
export const FAKE_CHAT_COMPLETION_RESPONSE: OpenRouterChatCompletionResponse = {
  id: 'chat-completion-1',
  choices: [
    {
      message: { role: 'assistant', content: 'HOLD is the platform token.' },
      index: 0,
      finishReason: 'stop',
    },
  ],
};

const FAKE_COMPLETION_RESPONSE: OpenRouterCompletionResponse = {
  id: 'completion-1',
  choices: [{ text: 'HOLD is the platform token.', index: 0, finishReason: 'stop' }],
};

const FAKE_GENERATION_METADATA: OpenRouterGenerationMetadata = {
  data: {
    id: 'generation-1',
    totalCost: 0,
    createdAt: '1970-01-01T00:00:00.000Z',
    model: 'test/model',
    origin: 'test',
    usage: 0,
    isByok: false,
    upstreamId: 'upstream-1',
    cacheDiscount: 0,
    appId: 0,
    streamed: false,
    cancelled: false,
    providerName: 'test-provider',
    latency: 0,
    moderationLatency: 0,
    generationTime: 0,
    finishReason: 'stop',
    nativeFinishReason: 'stop',
    tokensPrompt: 0,
    tokensCompletion: 0,
    nativeTokensPrompt: 0,
    nativeTokensCompletion: 0,
    nativeTokensReasoning: 0,
    numMediaPrompt: 0,
    numMediaCompletion: 0,
    numSearchResults: 0,
  },
};

export function createFakeOpenRouterClient() {
  const client = {
    chatCompletion: mock(async (_request: OpenRouterChatCompletionRequest) => FAKE_CHAT_COMPLETION_RESPONSE),

    completion: mock(async (_request: OpenRouterCompletionRequest) => FAKE_COMPLETION_RESPONSE),

    getGeneration: mock(async (_generationId: string) => FAKE_GENERATION_METADATA),

    getModels: mock(async (): Promise<OpenRouterModelsResponse> => ({ data: [] })),
  };

  return client;
}

export type FakeOpenRouterClient = ReturnType<typeof createFakeOpenRouterClient>;
