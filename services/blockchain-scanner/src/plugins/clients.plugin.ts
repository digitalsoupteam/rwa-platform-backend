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
    'blockchain-scanner.init.clients.rabbitmq',
    () => new RabbitMQClient({
      uri: rabbitMqUri,
      reconnectAttempts: rabbitMqMaxReconnectAttempts,
      reconnectInterval: rabbitMqReconnectInterval,
    })
  );

  await withTraceAsync(
    'blockchain-scanner.init.clients.rabbitmq_connect',
    async () => {
      logger.info("Initializing RabbitMQ client");
      await rabbitMQClient.connect();
      logger.info("RabbitMQ client initialized successfully");
    }
  );

  const plugin = withTraceSync(
    'blockchain-scanner.init.clients.plugin',
    () => new Elysia({ name: "Clients" })
      .decorate("rabbitMQClient", rabbitMQClient)
      .onStop(async () => {
        await withTraceAsync(
          'blockchain-scanner.stop.clients',
          async () => {
            logger.info("Shutting down RabbitMQ client");
            await rabbitMQClient.disconnect();
            logger.info("RabbitMQ client shut down successfully");
          }
        );
      })
  );

  return plugin;
}

export type ClientsPlugin = Awaited<ReturnType<typeof createClientsPlugin>>
