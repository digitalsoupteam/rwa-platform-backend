import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { RabbitMQClient } from "@shared/rabbitmq/src/rabbitmq.client";
import { withTraceSync, withTraceAsync } from "@shared/monitoring/src/tracing";

export const createClientsPlugin = async (
  rabbitMqUri: string,
  rabbitMqMaxReconnectAttempts: number,
  rabbitMqReconnectInterval: number
) => {
  const rabbitMQClient = withTraceSync(
    'dao.init.clients.rabbitmq',
    () => new RabbitMQClient({
      uri: rabbitMqUri,
      reconnectAttempts: rabbitMqMaxReconnectAttempts,
      reconnectInterval: rabbitMqReconnectInterval,
    })
  );

  await withTraceAsync(
    'dao.init.clients.rabbitmq_connect',
    async () => {
      logger.debug("Initializing clients");
      await rabbitMQClient.connect();
      logger.info("RabbitMQ client connected");
    }
  );

  const plugin = withTraceSync(
    'dao.init.clients.plugin',
    () => new Elysia({ name: "Clients" })
      .decorate("rabbitMQClient", rabbitMQClient)
      .onStop(async () => {
        await withTraceAsync(
          'dao.stop.clients',
          async () => {
            await rabbitMQClient.disconnect();
            logger.info("RabbitMQ client disconnected");
          }
        );
      })
  );

  return plugin;
}

export type ClientsPlugin = Awaited<ReturnType<typeof createClientsPlugin>>