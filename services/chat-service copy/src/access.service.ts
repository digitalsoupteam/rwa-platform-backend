import { Chat } from '../models';
import { ChatType, ParticipantRole } from '../types';
import { ethers } from 'ethers';

export class AccessService {
  private provider: ethers.Provider;
  
  constructor() {
    // В реальности URL должен быть в конфиге
    this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  }

  async canSendMessage(chatId: string, userAddress: string): Promise<boolean> {
    const chat = await Chat.findById(chatId);
    if (!chat) return false;

    const participant = chat.participants.find(p => 
      p.address.toLowerCase() === userAddress.toLowerCase()
    );
    if (!participant) return false;

    // Для Product Owner чатов проверяем баланс токенов
    if (chat.type === ChatType.PRODUCT_OWNER && participant.role === ParticipantRole.USER) {
      // В реальности адрес токена должен быть в metadata чата или в конфиге
      const tokenBalance = await this.getTokenBalance(userAddress, chat.productId!);
      return tokenBalance > 0;
    }

    // Для DAO чатов проверяем заблокированные токены
    if (chat.type === ChatType.DAO && participant.role === ParticipantRole.USER) {
      // В реальности адрес стейкинг контракта должен быть в metadata или конфиге
      const stakedBalance = await this.getStakedBalance(userAddress);
      return stakedBalance > 0;
    }

    // AI чаты доступны всем участникам
    if (chat.type === ChatType.AI_ASSISTANT) {
      return true;
    }

    return false;
  }

  private async getTokenBalance(address: string, productId: string): Promise<number> {
    // В реальной реализации здесь будет запрос к блокчейну или к базе данных
    return 0;
  }

  private async getStakedBalance(address: string): Promise<number> {
    // В реальной реализации здесь будет запрос к блокчейну или к базе данных
    return 0;
  }
}