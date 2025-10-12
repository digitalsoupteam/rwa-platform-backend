import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { RabbitMQClient } from "@shared/rabbitmq/src/rabbitmq.client";
import { createSignersManagerClient } from "../clients/eden.clients";
import { withTraceSync, withTraceAsync } from "@shared/monitoring/src/tracing";

export const createClientsPlugin = async (
  rabbitMqUri: string,
  rabbitMqMaxReconnectAttempts: number,
  rabbitMqReconnectInterval: number,
  signersManagerUrl: string
) => {
  const signersManagerClient = withTraceSync(
    'loyalty.init.clients.signers_manager',
    () => createSignersManagerClient(signersManagerUrl)
  );

  const rabbitMQClient = withTraceSync(
    'loyalty.init.clients.rabbitmq',
    () => new RabbitMQClient({
      uri: rabbitMqUri,
      reconnectAttempts: rabbitMqMaxReconnectAttempts,
      reconnectInterval: rabbitMqReconnectInterval,
    })
  );

  await withTraceAsync(
    'loyalty.init.clients.rabbitmq_connect',
    async () => {
      logger.debug("Initializing clients");
      await rabbitMQClient.connect();
      logger.info("RabbitMQ client connected");
    }
  );

  const plugin = withTraceSync(
    'loyalty.init.clients.plugin',
    () => new Elysia({ name: "Clients" })
      .decorate("signersManagerClient", signersManagerClient)
      .decorate("rabbitMQClient", rabbitMQClient)
      .onStop(async () => {
        await withTraceAsync(
          'loyalty.stop.clients',
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