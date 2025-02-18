import { RabbitMQClient } from '@rwa-platform/shared/src/utils/rabbitmq';
import { logger } from '@rwa-platform/shared/src';
import { Wallet } from 'ethers';
import { UnsignedMessage, CollectingMessage, SignedMessage, Signature } from '../types/queue.types';

export class SignerHandler {
  private wallet: Wallet;
  private static readonly UNSIGNED_QUEUE = 'signer.unsigned';
  private static readonly COLLECTING_QUEUE = 'signer.collecting';
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
    await this.rabbitmq.setupQueue(SignerHandler.COLLECTING_QUEUE);
    await this.rabbitmq.setupQueue(SignerHandler.SIGNED_QUEUE);

    // Subscribe to unsigned and collecting messages
    await this.rabbitmq.subscribe(
      SignerHandler.UNSIGNED_QUEUE,
      this.handleUnsignedMessage.bind(this)
    );
    await this.rabbitmq.subscribe(
      SignerHandler.COLLECTING_QUEUE,
      this.handleCollectingMessage.bind(this)
    );

    logger.info(`Signer initialized with address: ${this.wallet.address}`);
  }

  private async handleUnsignedMessage(message: any) {
    try {
      // Type guard for UnsignedMessage
      if (!this.isValidUnsignedMessage(message)) {
        throw new Error('Invalid unsigned message format');
      }

      const unsignedMessage = message as UnsignedMessage;
      logger.info(`Processing unsigned message: ${unsignedMessage.id}`);

      // Sign the data
      const signature = await this.wallet.signMessage(unsignedMessage.data);

      // Prepare collecting message with first signature
      const collectingMessage: CollectingMessage = {
        id: unsignedMessage.id,
        data: unsignedMessage.data,
        chainId: unsignedMessage.chainId,
        requiredSignatures: unsignedMessage.requiredSignatures,
        totalSigners: unsignedMessage.totalSigners,
        signatures: [{
          signature,
          signer: this.wallet.address
        }]
      };

      // Check if we already have enough signatures
      if (collectingMessage.requiredSignatures === 1) {
        // If only one signature was required, send directly to signed queue
        await this.rabbitmq.publish(SignerHandler.SIGNED_QUEUE, {
          id: collectingMessage.id,
          data: collectingMessage.data,
          chainId: collectingMessage.chainId,
          signatures: collectingMessage.signatures
        } as SignedMessage);
      } else {
        // Otherwise send to collecting queue for more signatures
        await this.rabbitmq.publish(SignerHandler.COLLECTING_QUEUE, collectingMessage);
      }
      
      logger.info(`Message processed and forwarded: ${unsignedMessage.id}`);
    } catch (error: any) {
      logger.error('Error processing unsigned message:', error);
      throw error;
    }
  }

  private async handleCollectingMessage(message: any) {
    try {
      // Type guard for CollectingMessage
      if (!this.isValidCollectingMessage(message)) {
        throw new Error('Invalid collecting message format');
      }

      const collectingMessage = message as CollectingMessage;
      logger.info(`Processing collecting message: ${collectingMessage.id}`);

      // Check if we've already signed this message
      if (collectingMessage.signatures.some(sig => sig.signer === this.wallet.address)) {
        logger.info(`Already signed message ${collectingMessage.id}, skipping`);
        return;
      }

      // Sign the data
      const signature = await this.wallet.signMessage(collectingMessage.data);

      // Add our signature
      collectingMessage.signatures.push({
        signature,
        signer: this.wallet.address
      });

      // Check if we have enough signatures
      if (collectingMessage.signatures.length >= collectingMessage.requiredSignatures) {
        // We have enough signatures, send to signed queue
        await this.rabbitmq.publish(SignerHandler.SIGNED_QUEUE, {
          id: collectingMessage.id,
          data: collectingMessage.data,
          chainId: collectingMessage.chainId,
          signatures: collectingMessage.signatures
        } as SignedMessage);
        
        logger.info(`Message fully signed and published: ${collectingMessage.id}`);
      } else {
        // Need more signatures, send back to collecting queue
        await this.rabbitmq.publish(SignerHandler.COLLECTING_QUEUE, collectingMessage);
        logger.info(`Message partially signed and republished: ${collectingMessage.id}`);
      }
    } catch (error: any) {
      logger.error('Error processing collecting message:', error);
      throw error;
    }
  }

  private isValidUnsignedMessage(message: any): message is UnsignedMessage {
    return (
      message &&
      typeof message === 'object' &&
      typeof message.id === 'string' &&
      typeof message.data === 'string' &&
      typeof message.chainId === 'number' &&
      typeof message.requiredSignatures === 'number' &&
      typeof message.totalSigners === 'number'
    );
  }

  private isValidCollectingMessage(message: any): message is CollectingMessage {
    return (
      message &&
      typeof message === 'object' &&
      typeof message.id === 'string' &&
      typeof message.data === 'string' &&
      typeof message.chainId === 'number' &&
      typeof message.requiredSignatures === 'number' &&
      typeof message.totalSigners === 'number' &&
      Array.isArray(message.signatures) &&
      message.signatures.every((sig: any) =>
        typeof sig === 'object' &&
        typeof sig.signature === 'string' &&
        typeof sig.signer === 'string'
      )
    );
  }
}
