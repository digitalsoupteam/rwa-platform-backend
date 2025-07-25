import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { CONFIG } from "../config";
import { RabbitMQClient } from "@shared/rabbitmq/src/rabbitmq.client";
import { signersManagerClient, SignersManagerClient } from "../clients/eden.clients";

export const ClientsPlugin = new Elysia({ name: "Clients" })
  .decorate("rabbitMQClient", {} as RabbitMQClient)
  .decorate("signersManagerClient", {} as SignersManagerClient)
  .onStart(async ({ decorator }) => {
    logger.debug("Initializing clients");

    
    decorator.signersManagerClient = signersManagerClient;
    
    logger.info("Signers Manager client initialized");

    // Initialize RabbitMQ client
    decorator.rabbitMQClient = new RabbitMQClient({
      uri: CONFIG.RABBITMQ.URI,
      reconnectAttempts: CONFIG.RABBITMQ.MAX_RECONNECT_ATTEMPTS,
      reconnectInterval: CONFIG.RABBITMQ.RECONNECT_INTERVAL,
    });

    await decorator.rabbitMQClient.connect();
    logger.info("RabbitMQ client connected");

  })
  .onStop(async ({ decorator }) => {
    await decorator.rabbitMQClient.disconnect();
    logger.info("RabbitMQ client disconnected");
  });