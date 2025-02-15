import { Chat, Message } from '../models';
import { ChatType, ParticipantRole } from './types';
import { RealtimeService } from './realtime.service';

export class ChatService {
  private realtime = RealtimeService.getInstance();

  async getMessages(chatId: string, userAddress: string, limit = 50, before?: Date) {
    const chat = await Chat.findById(chatId);
    if (!chat) throw new Error('Chat not found');

    // Проверяем участника чата
    const participant = chat.participants.find(p => 
      p.address.toLowerCase() === userAddress.toLowerCase()
    );
    if (!participant) throw new Error('Access denied');

    const query: any = { chatId };
    if (before) {
      query.createdAt = { $lt: before };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);

    return messages;
  }

  async sendMessage(chatId: string, content: string, senderAddress: string) {
    const chat = await Chat.findById(chatId);
    if (!chat) throw new Error('Chat not found');

    // Находим роль отправителя
    const participant = chat.participants.find(p => 
      p.address.toLowerCase() === senderAddress.toLowerCase()
    );
    if (!participant) throw new Error('Access denied');

    // Создаем сообщение
    const message = await Message.create({
      chatId,
      sender: {
        address: senderAddress,
        role: participant.role
      },
      content
    });

    // Публикуем в реальном времени
    await this.realtime.publishMessage(chatId, message);

    return message;
  }

  async getUserChats(userAddress: string) {
    return Chat.find({
      'participants.address': userAddress.toLowerCase(),
      isActive: true
    });
  }
}