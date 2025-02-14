import amqp, { Connection, Channel, Options } from 'amqplib';

export interface RabbitMQConfig {
  url: string;
  exchanges?: {
    name: string;
    type: string;
    options?: Options.AssertExchange;
  }[];
}

export class RabbitMQClient {
  private connection?: Connection;
  private channel?: Channel;

  constructor(private config: RabbitMQConfig) {}

  async connect() {
    this.connection = await amqp.connect(this.config.url);
    this.channel = await this.connection.createChannel();

    // Setup exchanges if provided
    if (this.config.exchanges) {
      for (const exchange of this.config.exchanges) {
        await this.channel.assertExchange(
          exchange.name,
          exchange.type,
          exchange.options
        );
      }
    }
  }

  async setupQueue(queue: string, options?: Options.AssertQueue) {
    if (!this.channel) throw new Error('Channel not initialized');
    return this.channel.assertQueue(queue, { durable: true, ...options });
  }

  async publish(queue: string, message: any) {
    if (!this.channel) throw new Error('Channel not initialized');
    return this.channel.sendToQueue(
      queue, 
      Buffer.from(JSON.stringify(message))
    );
  }

  async subscribe(
    queue: string, 
    handler: (message: any) => Promise<void>,
    options?: Options.Consume
  ) {
    if (!this.channel) throw new Error('Channel not initialized');

    await this.channel.assertQueue(queue, { durable: true });
    
    return this.channel.consume(queue, async (msg) => {
      if (msg) {
        try {
          const content = JSON.parse(msg.content.toString());
          await handler(content);
          this.channel?.ack(msg);
        } catch (error) {
          // Handle failed messages
          this.channel?.nack(msg, false, false);
        }
      }
    }, options);
  }

  async close() {
    await this.channel?.close();
    await this.connection?.close();
  }

  getChannel(): Channel | undefined {
    return this.channel;
  }
}