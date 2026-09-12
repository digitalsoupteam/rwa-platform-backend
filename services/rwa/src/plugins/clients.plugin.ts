import { Elysia } from 'elysia';
import { OpenRouterClient } from '@shared/openrouter/client';
import { logger } from '@shared/monitoring/src/monitoring.plugin';
import { RabbitMQClient } from '@shared/rabbitmq/src/rabbitmq.client';
import { createSignersManagerClient } from '../clients/eden.clients';
import { RedisEventsClient } from '@shared/redis-events/src/redis-events.client';
import { PoolEventsClient } from '../clients/poolEvents.client';
import { EvaluationResultsClient } from '../clients/evaluationResults.client';
import { EvaluationRequestsClient } from '../clients/evaluationRequests.client';
import { WebhookEventsPublisher } from '@shared/webhooks/src';
import { withTraceSync, withTraceAsync } from '@shared/monitoring/src/tracing';

export const createClientsPlugin = async (
  redisUrl: string,
  serviceName: string,
  openRouterApiKey: string,
  openRouterBaseUrl: string,
  rabbitMqUri: string,
  rabbitMqMaxReconnectAttempts: number,
  rabbitMqReconnectInterval: number,
  signersManagerUrl: string,
) => {
  const signersManagerClient = withTraceSync('rwa.init.clients.signers_manager', () =>
    createSignersManagerClient(signersManagerUrl),
  );

  const redisEventsClient = withTraceSync(
    'rwa.init.clients.redis_events',
    () => new RedisEventsClient(redisUrl, serviceName),
  );

  const poolEventsClient = withTraceSync('rwa.init.clients.pool_events', () => new PoolEventsClient(redisEventsClient));

  const openRouterClient = withTraceSync(
    'rwa.init.clients.openrouter',
    () => new OpenRouterClient(openRouterApiKey, openRouterBaseUrl),
  );

  const rabbitMQClient = withTraceSync(
    'rwa.init.clients.rabbitmq',
    () =>
      new RabbitMQClient({
        uri: rabbitMqUri,
        reconnectAttempts: rabbitMqMaxReconnectAttempts,
        reconnectInterval: rabbitMqReconnectInterval,
      }),
  );

  const evaluationResultsClient = withTraceSync(
    'rwa.init.clients.evaluation_results',
    () => new EvaluationResultsClient(rabbitMQClient),
  );

  const evaluationRequestsClient = withTraceSync(
    'rwa.init.clients.evaluation_requests',
    () => new EvaluationRequestsClient(rabbitMQClient),
  );

  const webhookEventsPublisher = withTraceSync(
    'rwa.init.clients.webhook_events',
    () => new WebhookEventsPublisher(rabbitMQClient),
  );

  await withTraceAsync('rwa.init.clients.rabbitmq_connect', async () => {
    logger.debug('Initializing clients');
    await rabbitMQClient.connect();
    await evaluationResultsClient.initialize();
    await evaluationRequestsClient.initialize();
    await webhookEventsPublisher.initialize();
    logger.info('RabbitMQ client connected, evaluation results and requests queues initialized');
  });

  const plugin = withTraceSync('rwa.init.clients.plugin', () =>
    new Elysia({ name: 'Clients' })
      .decorate('signersManagerClient', signersManagerClient)
      .decorate('redisEventsClient', redisEventsClient)
      .decorate('poolEventsClient', poolEventsClient)
      .decorate('openRouterClient', openRouterClient)
      .decorate('rabbitMQClient', rabbitMQClient)
      .decorate('evaluationResultsClient', evaluationResultsClient)
      .decorate('evaluationRequestsClient', evaluationRequestsClient)
      .decorate('webhookEventsPublisher', webhookEventsPublisher)
      .onStop(async () => {
        await withTraceAsync('rwa.stop.clients', async () => {
          await rabbitMQClient.disconnect();
          await redisEventsClient.close();
          logger.info('Clients disconnected');
        });
      }),
  );

  return plugin;
};

export type ClientsPlugin = Awaited<ReturnType<typeof createClientsPlugin>>;
