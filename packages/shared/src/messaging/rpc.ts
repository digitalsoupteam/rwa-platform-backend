import { MessageBroker, MessageBrokerConfig, Message } from './message-broker';
import { logger } from '../utils/structured-logger';
import { metrics } from '../utils/monitoring';

export interface RPCConfig extends MessageBrokerConfig {
  exchange?: string;
  timeout?: number;
}

export interface RPCRequest<T = any> {
  method: string;
  params: T;
  id?: string;
}

export interface RPCResponse<T = any> {
  id: string;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export class RPC extends MessageBroker {
  private responseHandlers: Map<
    string,
    { resolve: Function; reject: Function; timer: ReturnType<typeof setTimeout> }
  > = new Map();

  private replyQueue?: string;
  private readonly timeout: number;

  constructor(config: RPCConfig) {
    super({
      ...config,
      exchangeType: 'direct',
    });
    this.timeout = config.timeout || 30000; // 30 секунд по умолчанию
  }

  async initialize(): Promise<void> {
    await this.connect();

    if (!this.channel) throw new Error('Channel not initialized');

    // Создаем очередь для ответов
    const { queue } = await this.channel.assertQueue('', {
      exclusive: true,
      autoDelete: true,
    });
    this.replyQueue = queue;

    // Настраиваем обработчик ответов
    this.setupConsumer(
      this.replyQueue,
      async (message: Message<RPCResponse>) => {
        const { id } = message.data;
        const handler = this.responseHandlers.get(id);

        if (handler) {
          const { resolve, reject, timer } = handler;
          clearTimeout(timer);
          this.responseHandlers.delete(id);

          if (message.data.error) {
            reject(message.data.error);
          } else {
            resolve(message.data.result);
          }
        } else {
          logger.info('Received response for unknown RPC call', {
            id,
            response: message.data,
          });
        }
      },
      { noAck: true }
    );

    logger.info('RPC client initialized');
  }

  async call<TParams = any, TResult = any>(
    queue: string,
    request: RPCRequest<TParams>
  ): Promise<TResult> {
    if (!this.channel || !this.replyQueue) {
      throw new Error('RPC client not initialized');
    }

    const id = request.id || Math.random().toString(36).substring(7);
    const correlationId = Math.random().toString(36).substring(7);

    const message: Message<RPCRequest<TParams>> = {
      data: { ...request, id },
      headers: {
        messageId: id,
        correlationId,
        timestamp: Date.now(),
      },
    };

    const startTime = Date.now();

    try {
      metrics.increment('rpc_requests', { method: request.method });

      const promise = new Promise<TResult>((resolve, reject) => {
        // Таймаут для ожидания ответа
        const timer = setTimeout(() => {
          this.responseHandlers.delete(id);
          metrics.increment('rpc_timeouts', { method: request.method });
          reject(new Error(`RPC call timeout after ${this.timeout}ms`));
        }, this.timeout);

        this.responseHandlers.set(id, { resolve, reject, timer });
      });

      await this.publishWithRetry('', queue, message, {
        replyTo: this.replyQueue,
        correlationId,
      });

      const result = await promise;

      const duration = Date.now() - startTime;
      metrics.gauge('rpc_duration', duration, { method: request.method });
      metrics.increment('rpc_success', { method: request.method });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      metrics.gauge('rpc_duration', duration, { method: request.method });
      metrics.increment('rpc_errors', { method: request.method });
      
      logger.error('RPC call failed', {
        error,
        method: request.method,
        queue,
        duration,
      });
      throw error;
    }
  }

  async createServer(
    queue: string,
    handlers: {
      [method: string]: (params: any) => Promise<any>;
    }
  ): Promise<void> {
    if (!this.channel) throw new Error('RPC server not initialized');

    // Создаем очередь для запросов
    await this.channel.assertQueue(queue, {
      durable: true,
    });

    this.setupConsumer(
      queue,
      async (message: Message<RPCRequest>) => {
        const { method, params, id } = message.data;
        const { replyTo, correlationId } = message.headers || {};

        if (!replyTo) {
          logger.error('Received RPC request without replyTo', { method, id });
          return;
        }

        const startTime = Date.now();
        metrics.increment('rpc_requests_received', { method });

        try {
          const handler = handlers[method];
          if (!handler) {
            throw new Error(`Unknown RPC method: ${method}`);
          }

          const result = await handler(params);
          
          const response: RPCResponse = {
            id: id!,
            result,
          };

          await this.publishWithRetry('', replyTo, {
            data: response,
            headers: { correlationId },
          });

          const duration = Date.now() - startTime;
          metrics.gauge('rpc_handler_duration', duration, { method });
          metrics.increment('rpc_responses_sent', { method });

          logger.debug('RPC request handled successfully', {
            method,
            duration,
            id,
          });
        } catch (error: any) {
          metrics.increment('rpc_handler_errors', { method });

          const response: RPCResponse = {
            id: id!,
            error: {
              code: error.code || 500,
              message: error.message,
              data: error.data,
            },
          };

          await this.publishWithRetry('', replyTo, {
            data: response,
            headers: { correlationId },
          });

          logger.error('RPC request handler failed', {
            error,
            method,
            id,
          });
        }
      },
      { noAck: false }
    );

    logger.info('RPC server started', { queue, methods: Object.keys(handlers) });
  }

  async close(): Promise<void> {
    // Очищаем все ожидающие ответы
    for (const [id, { reject, timer }] of this.responseHandlers.entries()) {
      clearTimeout(timer);
      reject(new Error('RPC client closing'));
      this.responseHandlers.delete(id);
    }

    await super.close();
  }
}
