import { logger } from "@shared/monitoring/src/logger";
import { AssistantRepository } from "../repositories/assistant.repository";
import { AssistantContext } from "../models/shared/enums.model";

export class AssistantService {
  constructor(private readonly assistantRepository: AssistantRepository) {}

  /**
   * Creates a new AI assistant
   */
  async createAssistant(data: {
    name: string;
    userId: string;
    contextPreferences: AssistantContext;
  }) {
    logger.debug("Creating new assistant", { name: data.name });
    
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
  async updateAssistant(
    id: string,
    data: {
      name?: string;
      contextPreferences?: AssistantContext;
    }
  ) {
    logger.debug("Updating assistant settings", { id });

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
  async getAssistant(id: string) {
    logger.debug("Getting assistant", { id });
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
  async getUserAssistants(userId: string) {
    logger.debug("Getting user assistants", { userId });
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
  async deleteAssistant(id: string) {
    logger.debug("Deleting assistant", { id });
    await this.assistantRepository.delete(id);
    return { id };
  }
}