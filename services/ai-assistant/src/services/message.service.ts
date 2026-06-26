import { MessageRepository } from '../repositories/message.repository';
import { OpenRouterClient } from '@shared/openrouter/client';
import { AssistantRepository } from '../repositories/assistant.repository';
import { ContextService } from './context.service';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';
import { MetricsDecorator } from '@shared/monitoring/src/metricsDecorator';
import { LogDecorator } from '@shared/monitoring/src/logDecorator';
import { setSpanAttributes } from '@shared/monitoring/src/tracing';

export class MessageService {
  constructor(
    private readonly messageRepository: MessageRepository,
    private readonly assistantRepository: AssistantRepository,
    private readonly contextService: ContextService,
    private readonly openRouterClient: OpenRouterClient,
    private readonly openRouterModel: string,
  ) {}

  /**
   * Sends a message to the assistant and gets AI response
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({
      assistantId: a[0].assistantId,
      text: a[0].text,
      model: a[0].model,
    }),
  })
  async createMessage(data: { assistantId: string; text: string; model?: string }) {
    setSpanAttributes({ assistantId: data.assistantId, model: data.model ?? this.openRouterModel });
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
        5, // Last 5 messages for context
      );

      // Get assistant-specific context
      const context = await this.contextService.getContextForAssistant(assistant.contextPreferences, assistant.userId);

      // Prepare conversation history
      const messages = [
        {
          role: 'system',
          content: `You are ${assistant.name}, an AI assistant.\n\n${context || ''}`,
        },
        ...history.reverse().map((msg) => ({
          role: 'user',
          content: msg.text,
        })),
        {
          role: 'user',
          content: data.text,
        },
      ];

      // Get AI response with middle-out compression enabled
      const completion = await this.openRouterClient.chatCompletion({
        model: data.model || this.openRouterModel,
        messages,
        transforms: ['middle-out'], // Enable middle-out compression for large contexts
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
        },
      ];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets message history for an assistant
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({
      assistantId: a[0],
      limit: a[1],
      offset: a[2],
    }),
  })
  async getMessageHistory(assistantId: string, limit: number = 100, offset: number = 0) {
    setSpanAttributes({ assistantId });
    // Verify assistant exists
    await this.assistantRepository.findById(assistantId);

    const messages = await this.messageRepository.findByAssistantId(assistantId, { createdAt: -1 }, limit, offset);

    return messages.map((msg) => ({
      id: msg._id.toString(),
      assistantId: msg.assistantId,
      text: msg.text,
    }));
  }

  /**
   * Gets a specific message by ID
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ id: a[0] }),
  })
  async getMessage(id: string) {
    setSpanAttributes({ messageId: id });
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
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ id: a[0] }),
  })
  async deleteMessage(id: string) {
    setSpanAttributes({ messageId: id });
    return this.messageRepository.delete(id);
  }

  /**
   * Updates a message
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({
      id: a[0],
      text: a[1].text,
    }),
  })
  async updateMessage(id: string, data: { text: string }) {
    setSpanAttributes({ messageId: id });
    const message = await this.messageRepository.update(id, data);
    return {
      id: message._id.toString(),
      assistantId: message.assistantId,
      text: message.text,
    };
  }
}
