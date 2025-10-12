import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { RedisEventsClient } from "@shared/redis-events/src/redis-events.client";
import { ChartEventsClient } from "../clients/redis.client";
import { RabbitMQClient } from "@shared/rabbitmq/src/rabbitmq.client";
import { withTraceSync, withTraceAsync } from "@shared/monitoring/src/tracing";

export const createClientsPlugin = async (
  redisUrl: string,
  serviceName: string,
  rabbitMqUri: string,
  rabbitMqMaxReconnectAttempts: number,
  rabbitMqReconnectInterval: number
) => {
  const redisEventsClient = withTraceSync(
    'charts.init.clients.redis_events',
    () => new RedisEventsClient(redisUrl, serviceName)
  );

  const chartEventsClient = withTraceSync(
    'charts.init.clients.chart_events',
    () => new ChartEventsClient(redisEventsClient)
  );

  const rabbitMQClient = withTraceSync(
    'charts.init.clients.rabbitmq',
    () => new RabbitMQClient({
      uri: rabbitMqUri,
      reconnectAttempts: rabbitMqMaxReconnectAttempts,
      reconnectInterval: rabbitMqReconnectInterval,
    })
  );

  await withTraceAsync(
    'charts.init.clients.rabbitmq_connect',
    async () => {
      logger.debug("Initializing clients");
      await rabbitMQClient.connect();
    }
  );

  const plugin = withTraceSync(
    'charts.init.clients.plugin',
    () => new Elysia({ name: "Clients" })
      .decorate("rabbitMQClient", rabbitMQClient)
      .decorate("redisEventsClient", redisEventsClient)
      .decorate("chartEventsClient", chartEventsClient)
      .onStop(async () => {
        await withTraceAsync(
          'charts.stop.clients',
          async () => {
            logger.debug("Stopping clients");
            await redisEventsClient.close();
          }
        );
      })
  );

  return plugin;
}

export type ClientsPlugin = Awaited<ReturnType<typeof createClientsPlugin>>