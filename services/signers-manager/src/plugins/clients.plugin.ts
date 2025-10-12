import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { RabbitMQClient } from "@shared/rabbitmq/src/rabbitmq.client";
import { SignerClient } from "../clients/signer.client";
import { withTraceSync, withTraceAsync } from "@shared/monitoring/src/tracing";

export const createClientsPlugin = async (
  rabbitMqUri: string,
  rabbitMqMaxReconnectAttempts: number,
  rabbitMqReconnectInterval: number
) => {
  const rabbitMQClient = withTraceSync(
    'signers-manager.init.clients.rabbitmq',
    () => new RabbitMQClient({
      uri: rabbitMqUri,
      reconnectAttempts: rabbitMqMaxReconnectAttempts,
      reconnectInterval: rabbitMqReconnectInterval,
    })
  );

  await withTraceAsync(
    'signers-manager.init.clients.rabbitmq_connect',
    async () => await rabbitMQClient.connect()
  );

  const signerClient = withTraceSync(
    'signers-manager.init.clients.signer',
    () => new SignerClient(rabbitMQClient)
  );

  await withTraceAsync(
    'signers-manager.init.clients.signer_initialize',
    async () => await signerClient.initialize()
  );

  const plugin = withTraceSync(
    'signers-manager.init.clients.plugin',
    () => new Elysia({ name: "Clients" })
      .decorate("rabbitMQClient", rabbitMQClient)
      .decorate("signerClient", signerClient)
      .onStop(async () => {
        await withTraceAsync(
          'signers-manager.stop.clients',
          async () => {
            await rabbitMQClient.disconnect();
          }
        );
      })
  );

  return plugin;
}

export type ClientsPlugin = Awaited<ReturnType<typeof createClientsPlugin>>
