import { Elysia } from "elysia";
import { RabbitMQClient } from "@shared/rabbitmq/src/rabbitmq.client";
import { withTraceSync, withTraceAsync } from "@shared/monitoring/src/tracing";

export const createClientsPlugin = async (
  rabbitMQUri: string,
  reconnectAttempts: number,
  reconnectInterval: number
) => {
  const rabbitMQClient = withTraceSync(
    'portfolio.init.clients.rabbitmq',
    () => new RabbitMQClient({
      uri: rabbitMQUri,
      reconnectAttempts,
      reconnectInterval,
    })
  );

  await withTraceAsync(
    'portfolio.init.clients.rabbitmq_connect',
    async () => {
      await rabbitMQClient.connect();
    }
  );

  const plugin = withTraceSync(
    'portfolio.init.clients.plugin',
    () => new Elysia({ name: "Clients" })
      .decorate("rabbitMQClient", rabbitMQClient)
      .onStop(async () => {
        await withTraceAsync(
          'portfolio.stop.clients.rabbitmq_disconnect',
          async () => {
            await rabbitMQClient.disconnect();
          }
        );
      })
  );

  return plugin;
}

export type ClientsPlugin = Awaited<ReturnType<typeof createClientsPlugin>>