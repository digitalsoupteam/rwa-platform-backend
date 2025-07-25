export const CONFIG = {
  PORT: Number(process.env.PORT),
  SERVICE_NAME: String(process.env.SERVICE_NAME),

  MONGODB: {
    URI: String(process.env.MONGODB_URI),
  },

  REDIS: {
    URL: String(process.env.REDIS_URL)
  },

  RABBITMQ: {
    URI: String(process.env.RABBITMQ_URL),
    EXCHANGE: String(process.env.RABBITMQ_EXCHANGE), // For incoming blockchain events
    CHARTS_EXCHANGE: String(process.env.RABBITMQ_CHARTS_EXCHANGE), // For publishing price/transaction updates
    RECONNECT_INTERVAL: Number(process.env.RABBITMQ_RECONNECT_INTERVAL),
    MAX_RECONNECT_ATTEMPTS: Number(process.env.RABBITMQ_MAX_RECONNECT_ATTEMPTS),
  },
};
