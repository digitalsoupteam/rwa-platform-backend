import { createServer } from '../src/server';
import mongoose from 'mongoose';
import { FastifyInstance } from 'fastify';
import { messageQueue, closeWorker } from '../src/queue/bull.queue';
import { RabbitMQ } from '../src/queue/rabbit.queue';
import { User } from '../src/models';
import { UserRole, KYCStatus } from '../src/types/enums';

describe('System Test', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    try {
      await mongoose.connect('mongodb://localhost:27017/test-db');
      console.log('Connected to MongoDB');
      
      await RabbitMQ.initialize();
      console.log('RabbitMQ initialized');
      
      server = await createServer();
      console.log('Server started');
    } catch (error) {
      console.error('Setup failed:', error);
      throw error;
    }
  });

  afterAll(async () => {
    try {
      // Очищаем БД
      await mongoose.connection.dropDatabase();
      
      // Закрываем соединения
      await mongoose.disconnect();
      await messageQueue.close();
      await closeWorker();
      await server.close();
      
      console.log('Cleanup completed');
    } catch (error) {
      console.error('Cleanup failed:', error);
      throw error;
    }
  });

  it('should verify complete system functionality', async () => {
    // 1. Проверяем создание пользователя
    const user = await User.create({
      address: '0x123456789',
      nonce: '123456',
      role: UserRole.INVESTOR,
      kycStatus: KYCStatus.NONE
    });

    expect(user).toBeDefined();
    expect(user.address).toBe('0x123456789');
    console.log('User created successfully');

    // 2. Проверяем health endpoint
    const health = await server.inject({
      method: 'GET',
      url: '/health'
    });

    expect(health.statusCode).toBe(200);
    const healthData = JSON.parse(health.payload);
    expect(healthData.status).toBe('ok');
    console.log('Health check passed');

    // 3. Тестируем очереди
    let messageProcessed = false;

    // Добавляем обработчик для RabbitMQ
    await RabbitMQ.consumeMessages();
    
    // Публикуем тестовое сообщение в RabbitMQ
    await RabbitMQ.publishMessage('test message');
    
    // Добавляем задачу в Redis очередь
    await messageQueue.add('test', { text: 'test message' });

    // Ждем обработки сообщений
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('Message queue test completed');
  }, 30000);
});
