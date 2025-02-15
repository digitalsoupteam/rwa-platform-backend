import { pubsub } from '@rwa-platform/shared/src';

export class RealtimeService {
  private static instance: RealtimeService;

  private constructor() {}

  static getInstance(): RealtimeService {
    if (!RealtimeService.instance) {
      RealtimeService.instance = new RealtimeService();
    }
    return RealtimeService.instance;
  }

  async publishMessage(chatId: string, message: any) {
    await pubsub.publish(`CHAT:${chatId}`, {
      messageReceived: message
    });
  }

  async publishChatUpdate(chatId: string, update: any) {
    await pubsub.publish(`CHAT_UPDATED:${chatId}`, {
      chatUpdated: update
    });
  }
}