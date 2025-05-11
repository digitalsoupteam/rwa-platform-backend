
export interface ChatMessage {
  role: string;
  content: string;
}


export interface OpenRouterCompletionRequest {
  
  model: string;
  prompt: string;
  
  
  stream?: boolean;
  maxTokens?: number;
  temperature?: number;
  seed?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  repetitionPenalty?: number;
  logitBias?: Record<string, number>;
  topLogprobs?: number;
  minP?: number;
  topA?: number;
  transforms?: string[];
  models?: string[];
  route?: string;
  provider?: Record<string, any>;
  reasoning?: Record<string, any>;
}


export interface OpenRouterChatCompletionRequest {
  
  model: string;
  messages: ChatMessage[];
  
  
  stream?: boolean;
  maxTokens?: number;
  temperature?: number;
  seed?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  repetitionPenalty?: number;
  logitBias?: Record<string, number>;
  topLogprobs?: number;
  minP?: number;
  topA?: number;
  transforms?: string[];
  models?: string[];
  route?: string;
  provider?: Record<string, any>;
  reasoning?: Record<string, any>;
}


export interface OpenRouterCompletionResponse {
  id: string;
  choices: Array<{
    text: string;
    index: number;
    finishReason: string;
  }>;
}


export interface OpenRouterChatCompletionResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    index: number;
    finishReason: string;
  }>;
}


export interface OpenRouterGenerationMetadata {
  data: {
    id: string;
    totalCost: number;
    createdAt: string;
    model: string;
    origin: string;
    usage: number;
    isByok: boolean;
    upstreamId: string;
    cacheDiscount: number;
    appId: number;
    streamed: boolean;
    cancelled: boolean;
    providerName: string;
    latency: number;
    moderationLatency: number;
    generationTime: number;
    finishReason: string;
    nativeFinishReason: string;
    tokensPrompt: number;
    tokensCompletion: number;
    nativeTokensPrompt: number;
    nativeTokensCompletion: number;
    nativeTokensReasoning: number;
    numMediaPrompt: number;
    numMediaCompletion: number;
    numSearchResults: number;
  };
}


export interface ModelArchitecture {
  modality: string;
  tokenizer: string;
}


export interface ModelProvider {
  contextLength: number;
  maxCompletionTokens: number;
  isModerated: boolean;
}


export interface ModelPricing {
  prompt: string;
  completion: string;
  image: string;
  request: string;
  inputCacheRead: string;
  inputCacheWrite: string;
  webSearch: string;
  internalReasoning: string;
}


export interface ModelRequestLimits {
  [key: string]: string;
}


export interface OpenRouterModel {
  id: string;
  name: string;
  created: number;
  description: string;
  contextLength: number;
  architecture: ModelArchitecture;
  topProvider: ModelProvider;
  pricing: ModelPricing;
  perRequestLimits: ModelRequestLimits;
}


export interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}
