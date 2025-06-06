import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { RabbitMQClient } from "@shared/rabbitmq/src/rabbitmq.client";
import { CONFIG } from "../config";

export const ClientsPlugin = new Elysia({ name: "Clients" })
  .decorate("rabbitMQClient", {} as RabbitMQClient)
  .onStart(async ({ decorator }) => {
    logger.debug("Initializing clients");

    // Initialize RabbitMQ client
    decorator.rabbitMQClient = new RabbitMQClient({
      uri: CONFIG.RABBITMQ.URI,
      reconnectAttempts: CONFIG.RABBITMQ.MAX_RECONNECT_ATTEMPTS,
      reconnectInterval: CONFIG.RABBITMQ.RECONNECT_INTERVAL,
    });

    await decorator.rabbitMQClient.connect();
  })
  .onStop(async ({ decorator }) => {
    await decorator.rabbitMQClient.disconnect();
  });