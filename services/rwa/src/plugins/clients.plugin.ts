import { Elysia } from "elysia";
import { OpenRouterClient } from "@shared/openrouter/client";
import { logger } from "@shared/monitoring/src/logger";
import { CONFIG } from "../config";
import { RabbitMQClient } from "@shared/rabbitmq/src/rabbitmq.client";
import { SignersManagerClient, signersManagerClient } from "../clients/eden.clients";

export const ClientsPlugin = new Elysia({ name: "Clients" })
  .decorate("rabbitMQClient", {} as RabbitMQClient)
  .decorate("openRouterClient", {} as OpenRouterClient)
  .decorate("signersManagerClient", {} as SignersManagerClient)
  .onStart(async ({ decorator }) => {
    logger.debug("Initializing clients");

    decorator.signersManagerClient = signersManagerClient

    decorator.openRouterClient = new OpenRouterClient(
      CONFIG.OPENROUTER.API_KEY,
      CONFIG.OPENROUTER.BASE_URL
    );

    // Initialize RabbitMQ client
    decorator.rabbitMQClient = new RabbitMQClient({
      uri: CONFIG.RABBITMQ.URI,
      reconnectAttempts: CONFIG.RABBITMQ.MAX_RECONNECT_ATTEMPTS,
      reconnectInterval: CONFIG.RABBITMQ.RECONNECT_INTERVAL,
    });

    await decorator.rabbitMQClient.connect();
    console.log("await decorator.rabbitMQClient.initialize()");
  })
  .onStop(async ({ decorator }) => {
    await decorator.rabbitMQClient.disconnect();
  });
