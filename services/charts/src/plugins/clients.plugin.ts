import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { CONFIG } from "../config";
import { RedisEventsClient } from "@shared/redis-events/src/redis-events.client";
import { ChartEventsClient } from "../clients/redis.client";
import { RabbitMQClient } from "@shared/rabbitmq/src/rabbitmq.client";

export const ClientsPlugin = new Elysia({ name: "Clients" })
  .decorate("rabbitMQClient", {} as RabbitMQClient)
  .decorate("redisEventsClient", {} as RedisEventsClient)
  .decorate("chartEventsClient", {} as ChartEventsClient)
  .onStart(async ({ decorator }) => {
    logger.debug("Initializing clients");

    // Initialize Redis Events client
    decorator.redisEventsClient = new RedisEventsClient(
      CONFIG.REDIS.URL,
      CONFIG.SERVICE_NAME
    );

    // Initialize Chart Events client
    decorator.chartEventsClient = new ChartEventsClient(
      decorator.redisEventsClient
    );

    // Initialize RabbitMQ client
    decorator.rabbitMQClient = new RabbitMQClient({
      uri: CONFIG.RABBITMQ.URI,
      reconnectAttempts: CONFIG.RABBITMQ.MAX_RECONNECT_ATTEMPTS,
      reconnectInterval: CONFIG.RABBITMQ.RECONNECT_INTERVAL,
    });

    await decorator.rabbitMQClient.connect();


  })
  .onStop(async ({ decorator }) => {
    logger.debug("Stopping clients");
    await decorator.redisEventsClient.close();
  });