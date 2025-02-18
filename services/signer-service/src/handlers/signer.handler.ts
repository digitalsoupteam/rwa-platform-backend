import { RabbitMQClient } from '@rwa-platform/shared/src/utils/rabbitmq';
import { logger } from '@rwa-platform/shared/src';
import { Wallet } from 'ethers';
import { UnsignedMessage, SignedMessage } from '../types/queue.types';

export class SignerHandler {
  private wallet: Wallet;
  private static readonly UNSIGNED_QUEUE = 'signer.unsigned';
  private static readonly SIGNED_QUEUE = 'signer.signed';

  getAddress(): string {
    return this.wallet.address;
  }

  constructor(
    private rabbitmq: RabbitMQClient,
    privateKey: string
  ) {
    if (!privateKey) {
      throw new Error('SIGNER_PRIVATE_KEY is required');
    }
    this.wallet = new Wallet(privateKey);
  }

  async initialize() {
    // Setup queues
    await this.rabbitmq.setupQueue(SignerHandler.UNSIGNED_QUEUE);
    await this.rabbitmq.setupQueue(SignerHandler.SIGNED_QUEUE);

    // Subscribe to unsigned messages
    await this.rabbitmq.subscribe(
      SignerHandler.UNSIGNED_QUEUE,
      this.handleMessage.bind(this)
    );

    logger.info(`Signer initialized with address: ${this.wallet.address}`);
  }

  private async handleMessage(message: any) {
    try {
      // Type guard for UnsignedMessage
      if (!message || typeof message !== 'object' || !('id' in message) || !('data' in message) || !('chainId' in message)) {
        throw new Error('Invalid message format');
      }

      const unsignedMessage = message as UnsignedMessage;
      logger.info(`Processing message: ${unsignedMessage.id}`);

      // Sign the data
      const signature = await this.wallet.signMessage(unsignedMessage.data);

      // Prepare signed message
      const signedMessage: SignedMessage = {
        id: unsignedMessage.id,
        data: unsignedMessage.data,
        signature,
        signer: this.wallet.address,
        chainId: unsignedMessage.chainId
      };

      // Publish signed message
      await this.rabbitmq.publish(SignerHandler.SIGNED_QUEUE, signedMessage as any);
      
      logger.info(`Message signed and published: ${unsignedMessage.id}`);
    } catch (error: any) {
      logger.error('Error processing message:', error);
      throw error; // Let RabbitMQ handler handle the error
    }
  }
}
