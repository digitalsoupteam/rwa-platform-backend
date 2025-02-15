import { ChatService } from '../chat.service';
import { AccessService } from '../access.service';
import { logger, metrics } from '@rwa-platform/shared/src';

export class ChatController {
  constructor(
    private chatService: ChatService,
    private accessService: AccessService
  ) {}

  async getMessages(req: Request) {
    try {
      const chatId = req.params.chatId;
      const userAddress = req.headers.get('user-address');
      
      if (!userAddress) throw new Error('User address required');

      const canAccess = await this.accessService.canSendMessage(chatId, userAddress);
      if (!canAccess) throw new Error('Access denied');

      const messages = await this.chatService.getMessages(chatId, userAddress);
      
      metrics.increment('chat.messages.retrieved');
      return messages;
    } catch (error: any) {
      logger.error(`Failed to get messages: ${error.message}`);
      throw error;
    }
  }

  async sendMessage(req: Request) {
    try {
      const chatId = req.params.chatId;
      const userAddress = req.headers.get('user-address');
      const { content } = req.body as any;

      if (!userAddress) throw new Error('User address required');
      if (!content) throw new Error('Message content required');

      const canSend = await this.accessService.canSendMessage(chatId, userAddress);
      if (!canSend) throw new Error('Cannot send message to this chat');

      const message = await this.chatService.sendMessage(chatId, content, userAddress);
      
      metrics.increment('chat.message.sent');
      return message;
    } catch (error: any) {
      logger.error(`Failed to send message: ${error.message}`);
      throw error;
    }
  }

  async getUserChats(req: Request) {
    try {
      const userAddress = req.headers.get('user-address');
      if (!userAddress) throw new Error('User address required');

      const chats = await this.chatService.getUserChats(userAddress);
      
      metrics.increment('chat.list.retrieved');
      return chats;
    } catch (error: any) {
      logger.error(`Failed to get user chats: ${error.message}`);
      throw error;
    }
  }
}