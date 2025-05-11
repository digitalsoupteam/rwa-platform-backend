import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { CONFIG } from "../config";
import { RabbitMQClient } from "@shared/rabbitmq/src/rabbitmq.client";

export const ClientsPlugin = new Elysia({ name: "Clients" })
  .decorate("rabbitMQClient", {} as RabbitMQClient)
  .onStart(async ({ decorator }) => {
    logger.info("Initializing RabbitMQ client");
    decorator.rabbitMQClient = new RabbitMQClient({
      uri: CONFIG.RABBITMQ.URI,
      reconnectAttempts: CONFIG.RABBITMQ.MAX_RECONNECT_ATTEMPTS,
      reconnectInterval: CONFIG.RABBITMQ.RECONNECT_INTERVAL,
    });
    await decorator.rabbitMQClient.connect();
    logger.info("RabbitMQ client initialized successfully");
  })
  .onStop(async ({ decorator: { rabbitMQClient } }) => {
    logger.info("Shutting down RabbitMQ client");
    await rabbitMQClient.disconnect();
    logger.info("RabbitMQ client shut down successfully");
  });
