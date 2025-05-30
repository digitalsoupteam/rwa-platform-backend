import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { CONFIG } from "../config";
import { RabbitMQClient } from "@shared/rabbitmq/src/rabbitmq.client";
import { SignerClient } from "../clients/signer.client";

export const ClientsPlugin = new Elysia({ name: "Clients" })
  .decorate("rabbitMQClient", {} as RabbitMQClient)
  .decorate("signerClient", {} as SignerClient)
  .onStart(async ({ decorator }) => {
    logger.debug("Initializing clients");

    // Initialize RabbitMQ client
    decorator.rabbitMQClient = new RabbitMQClient({
      uri: CONFIG.RABBITMQ.URI,
      reconnectAttempts: CONFIG.RABBITMQ.MAX_RECONNECT_ATTEMPTS,
      reconnectInterval: CONFIG.RABBITMQ.RECONNECT_INTERVAL,
    });

    await decorator.rabbitMQClient.connect();

    decorator.signerClient = new SignerClient(decorator.rabbitMQClient)
    await decorator.signerClient.initialize()

    logger.debug("Signer client initialized");
  })
  .onStop(async ({ decorator }) => {
    await decorator.rabbitMQClient.disconnect();
  });
