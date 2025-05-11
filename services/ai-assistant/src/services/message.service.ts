import { logger } from "@shared/monitoring/src/logger";
import { MessageRepository } from "../repositories/message.repository";
import { OpenRouterClient } from "@shared/openrouter/client";
import { AssistantRepository } from "../repositories/assistant.repository";

export class MessageService {
  constructor(
    private readonly messageRepository: MessageRepository,
    private readonly assistantRepository: AssistantRepository,
    private readonly openRouterClient: OpenRouterClient,
    private readonly openRouterModel: string,
  ) {}

  /**
   * Sends a message to the assistant and gets AI response
   */
  async createMessage(data: {
    assistantId: string;
    text: string;
    model?: string;
  }) {
    logger.debug("Processing new message", { assistantId: data.assistantId });

    // Verify assistant exists
    const assistant = await this.assistantRepository.findById(data.assistantId);

    // Save user message
    const userMessage = await this.messageRepository.create({
      assistantId: data.assistantId,
      text: data.text,
    });

    try {
      // Get recent message history for context
      const history = await this.messageRepository.findByAssistantId(
        data.assistantId,
        { createdAt: -1 },
        5 // Last 5 messages for context
      );

      // Prepare conversation history
      const messages = [
        {
          role: "system",
          content: `You are ${assistant.name}, an AI assistant.`,
        },
        ...history.reverse().map((msg) => ({
          role: "user",
          content: msg.text,
        })),
        {
          role: "user",
          content: data.text,
        },
      ];

      // Get AI response
      const completion = await this.openRouterClient.chatCompletion({
        model: this.openRouterModel,
        messages,
      });

      // Save AI response
      const aiMessage = await this.messageRepository.create({
        assistantId: data.assistantId,
        text: completion.choices[0].message.content,
      });

      return [
        {
          id: userMessage._id.toString(),
          assistantId: userMessage.assistantId,
          text: userMessage.text,
        },
        {
          id: aiMessage._id.toString(),
          assistantId: aiMessage.assistantId,
          text: aiMessage.text,
        }
      ];
    } catch (error) {
      logger.error("Error getting AI response", { error });
      throw error;
    }
  }

  /**
   * Gets message history for an assistant
   */
  async getMessageHistory(
    assistantId: string,
    limit: number = 100,
    offset: number = 0
  ) {
    logger.debug("Getting message history", { assistantId });

    // Verify assistant exists
    await this.assistantRepository.findById(assistantId);

    const messages = await this.messageRepository.findByAssistantId(
      assistantId,
      { createdAt: -1 },
      limit,
      offset
    );

    return messages.map((msg) => ({
      id: msg._id.toString(),
      assistantId: msg.assistantId,
      text: msg.text,
    }));
  }

  /**
   * Gets a specific message by ID
   */
  async getMessage(id: string) {
    logger.debug("Getting message", { id });
    const message = await this.messageRepository.findById(id);
    return {
      id: message._id.toString(),
      assistantId: message.assistantId,
      text: message.text,
    };
  }
  /**
   * Deletes a message
   */
  async deleteMessage(id: string) {
    logger.debug("Deleting message", { id });
    return this.messageRepository.delete(id);
  }

  /**
   * Updates a message
   */
  async updateMessage(id: string, data: { text: string }) {
    logger.debug("Updating message", { id });
    const message = await this.messageRepository.update(id, data);
    return {
      id: message._id.toString(),
      assistantId: message.assistantId,
      text: message.text,
    };
  }
}
