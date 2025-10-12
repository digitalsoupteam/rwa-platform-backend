import { logger } from "@shared/monitoring/src/logger";
import { TracingDecorator } from "@shared/monitoring/src/tracingDecorator";
import type {
  OpenRouterCompletionRequest,
  OpenRouterChatCompletionRequest,
  OpenRouterCompletionResponse,
  OpenRouterChatCompletionResponse,
  OpenRouterGenerationMetadata,
  OpenRouterModelsResponse,
} from "./types";
import { camelToSnakeCase, snakeToCamelCase } from "./mappers";

@TracingDecorator({
  privateEnabled: true,
  prefix: 'OpenRouter',
})
export class OpenRouterClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
  ) {
    if (!this.apiKey) {
      throw new Error("OpenRouter API key is not configured");
    }
  }

  async completion(
    request: OpenRouterCompletionRequest
  ): Promise<OpenRouterCompletionResponse> {
    try {
      logger.info("Sending completion request to OpenRouter", {
        model: request.model,
      });


      const snakeCaseRequest = camelToSnakeCase(request);

      const response = await fetch(`${this.baseUrl}/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(snakeCaseRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("OpenRouter API error", {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        throw new Error(
          `OpenRouter API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }


      const snakeCaseData = await response.json();


      const data =
        snakeToCamelCase<OpenRouterCompletionResponse>(snakeCaseData);

      logger.info("Received completion response from OpenRouter", {
        id: data.id,
        choicesCount: data.choices.length,
      });

      return data;
    } catch (error) {
      logger.error("Error in OpenRouter completion request", { error });
      throw error instanceof Error
        ? error
        : new Error("Unknown error in OpenRouter completion request");
    }
  }

  async chatCompletion(
    request: OpenRouterChatCompletionRequest
  ): Promise<OpenRouterChatCompletionResponse> {
    try {
      logger.info("Sending chat completion request to OpenRouter", {
        model: request.model,
        messagesCount: request.messages.length,
      });


      const snakeCaseRequest = camelToSnakeCase(request);

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(snakeCaseRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("OpenRouter Chat API error", {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        throw new Error(
          `OpenRouter Chat API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }


      const snakeCaseData = await response.json();


      const data =
        snakeToCamelCase<OpenRouterChatCompletionResponse>(snakeCaseData);

      logger.info("Received chat completion response from OpenRouter", {
        id: data.id,
        choicesCount: data.choices.length,
      });

      return data;
    } catch (error) {
      logger.error("Error in OpenRouter chat completion request", { error });
      throw error instanceof Error
        ? error
        : new Error("Unknown error in OpenRouter chat completion request");
    }
  }

  async getGeneration(
    generationId: string
  ): Promise<OpenRouterGenerationMetadata> {
    try {
      logger.info("Fetching generation metadata from OpenRouter", {
        generationId,
      });


      const url = new URL(`${this.baseUrl}/generation`);
      url.searchParams.append("id", generationId);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("OpenRouter Generation API error", {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        throw new Error(
          `OpenRouter Generation API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }


      const snakeCaseData = await response.json();


      const data =
        snakeToCamelCase<OpenRouterGenerationMetadata>(snakeCaseData);

      logger.info("Received generation metadata from OpenRouter", {
        id: data.data.id,
        model: data.data.model,
      });

      return data;
    } catch (error) {
      logger.error("Error fetching generation metadata", { error });
      throw error instanceof Error
        ? error
        : new Error("Unknown error fetching generation metadata");
    }
  }

  async getModels(): Promise<OpenRouterModelsResponse> {
    try {
      logger.info("Fetching available models from OpenRouter");

      const response = await fetch(`${this.baseUrl}/models`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("OpenRouter Models API error", {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        throw new Error(
          `OpenRouter Models API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }


      const snakeCaseData = await response.json();


      const data = snakeToCamelCase<OpenRouterModelsResponse>(snakeCaseData);

      logger.info("Received models list from OpenRouter", {
        modelsCount: data.data.length,
      });

      return data;
    } catch (error) {
      logger.error("Error fetching models list", { error });
      throw error instanceof Error
        ? error
        : new Error("Unknown error fetching models list");
    }
  }
}
