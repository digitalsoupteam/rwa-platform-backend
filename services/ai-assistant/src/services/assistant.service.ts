import { AssistantRepository } from "../repositories/assistant.repository";
import type { AssistantContext } from "../models/shared/enums.model";
import { TraceDecorator } from "@shared/monitoring/src/traceDecorator";
import { MetricsDecorator } from "@shared/monitoring/src/metricsDecorator";
import { LogDecorator } from "@shared/monitoring/src/logDecorator";
import { setSpanAttributes } from "@shared/monitoring/src/tracing";


export class AssistantService {
  constructor(private readonly assistantRepository: AssistantRepository) {}

  /**
   * Creates a new AI assistant
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['data'] })
  async createAssistant(data: {
    name: string;
    userId: string;
    contextPreferences: AssistantContext;
  }) {
    setSpanAttributes({ userId: data.userId });
    const assistant = await this.assistantRepository.create(data);

    return {
      id: assistant._id.toString(),
      userId: assistant.userId,
      name: assistant.name,
      contextPreferences: assistant.contextPreferences,
    };
  }

  /**
   * Updates assistant settings
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['id', 'data'] })
    async updateAssistant(
        id: string,
        data: {
          name?: string;
          contextPreferences?: AssistantContext;
        }
    ) {
      setSpanAttributes({ assistantId: id });
      const assistant = await this.assistantRepository.update(id, data);

    return {
      id: assistant._id.toString(),
      userId: assistant.userId,
      name: assistant.name,
      contextPreferences: assistant.contextPreferences,
    };
  }

  /**
   * Gets assistant by ID
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['id'] })
  async getAssistant(id: string) {
    setSpanAttributes({ assistantId: id });
    const assistant = await this.assistantRepository.findById(id);

    return {
      id: assistant._id.toString(),
      userId: assistant.userId,
      name: assistant.name,
      contextPreferences: assistant.contextPreferences,
    };
  }

  /**
   * Gets all assistants for a user
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['userId'] })
  async getUserAssistants(userId: string) {
    setSpanAttributes({ userId });
    const assistants = await this.assistantRepository.findAll({ userId });

    return assistants.map(assistant => ({
      id: assistant._id.toString(),
      userId: assistant.userId,
      name: assistant.name,
      contextPreferences: assistant.contextPreferences,
    }));
  }

  /**
   * Deletes assistant by ID
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['id'] })
  async deleteAssistant(id: string) {
    setSpanAttributes({ assistantId: id });
    await this.assistantRepository.delete(id);
    return { id };
  }
}
