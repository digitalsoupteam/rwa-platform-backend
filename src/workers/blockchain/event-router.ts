import { EventEmitter } from 'events';
import { Channel, connect } from 'amqplib';
import { BlockchainEvent, ModuleConfig, IEventHandler } from './types';

export class EventRouter extends EventEmitter {
  private handlers: Map<string, IEventHandler[]> = new Map();
  private rabbitmqChannel: Channel | null = null;

  constructor(
    private readonly config: ModuleConfig,
  ) {
    super();
  }

  async initialize(): Promise<void> {
    try {
      const connection = await connect(this.config.rabbitmq.url);
      this.rabbitmqChannel = await connection.createChannel();
      await this.rabbitmqChannel.assertExchange(
        this.config.rabbitmq.exchange,
        'topic',
        { durable: true }
      );
    } catch (error) {
      console.error('Failed to initialize EventRouter', { error });
      throw error;
    }
  }

  registerHandler(
    contractAddress: string,
    eventSignature: string,
    handler: IEventHandler
  ): void {
    const key = `${contractAddress}-${eventSignature}`;
    if (!this.handlers.has(key)) {
      this.handlers.set(key, []);
    }
    this.handlers.get(key)?.push(handler);
  }

  async handleEvent(event: BlockchainEvent): Promise<void> {
    const key = `${event.address}-${event.topics[0]}`;
    const handlers = this.handlers.get(key) || [];

    try {
      await Promise.all(
        handlers.map(handler => handler.handle(event))
      );

      if (this.rabbitmqChannel) {
        await this.rabbitmqChannel.publish(
          this.config.rabbitmq.exchange,
          key,
          Buffer.from(JSON.stringify(event))
        );
      }
    } catch (error) {
      console.error('Error handling event', { error, event });
      throw error;
    }
  }
}
