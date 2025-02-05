import amqp from 'amqplib';
import config from '../config/config';

export class RabbitMQ {
  private static connection: amqp.Connection;
  private static channel: amqp.Channel;

  static async initialize() {
    this.connection = await amqp.connect(config.rabbit.url);
    this.channel = await this.connection.createChannel();
    await this.channel.assertQueue('hello-queue');
  }

  static async publishMessage(message: string) {
    if (!this.channel) await this.initialize();
    this.channel.sendToQueue('hello-queue', Buffer.from(message));
  }

  static async consumeMessages() {
    if (!this.channel) await this.initialize();
    this.channel.consume('hello-queue', (msg) => {
      if (msg) {
        console.log('Received from RabbitMQ:', msg.content.toString());
        this.channel.ack(msg);
      }
    });
  }
}
