import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { RabbitMQClient } from "@shared/rabbitmq/src/rabbitmq.client";
import { SignersManagerClient } from "../clients/signersManager.client";
import { withTraceAsync, withTraceSync } from "@shared/monitoring/src/tracing";

export const createClientsPlugin = async (
  rabbitMqUri: string,
  maxReconnectAttempts: number,
  reconnectInterval: number
) => {
  const rabbitMQClient = withTraceSync(
    'signer.init.clients.rabbitmq',
    () => new RabbitMQClient({
      uri: rabbitMqUri,
      reconnectAttempts: maxReconnectAttempts,
      reconnectInterval: reconnectInterval,
    })
  );

  const signersManagerClient = withTraceSync(
    'signer.init.clients.signers_manager',
    () => new SignersManagerClient(rabbitMQClient)
  );

  await withTraceAsync(
    'signer.init.clients.initialize',
    async () => {
      logger.info("Initializing RabbitMQ client");
      await rabbitMQClient.connect();
      await signersManagerClient.initialize();
      logger.info("RabbitMQ client initialized successfully");
    }
  );

  const plugin = withTraceSync(
    'signer.init.clients.plugin',
    () => new Elysia({ name: "Clients" })
      .decorate("rabbitMQClient", rabbitMQClient)
      .decorate("signersManagerClient", signersManagerClient)
      .onStop(async () => {
        await withTraceAsync(
          'signer.stop.clients',
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