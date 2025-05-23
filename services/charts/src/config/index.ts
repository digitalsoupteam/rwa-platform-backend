export const CONFIG = {
  PORT: Number(process.env.PORT) || 3040,
  SERVICE_NAME: process.env.SERVICE_NAME || "charts",

  MONGODB: {
    URI: process.env.MONGODB_URI || "mongodb://mongodb:27017/charts",
  },


  REDIS: {
    URL: process.env.REDIS_URL || "redis://redis:6379"
  },


  RABBITMQ: {
    URI: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    EXCHANGE: process.env.RABBITMQ_EXCHANGE || 'blockchain.events', // For incoming blockchain events
    CHARTS_EXCHANGE: process.env.RABBITMQ_CHARTS_EXCHANGE || 'charts.events', // For publishing price/transaction updates
    RECONNECT_INTERVAL: Number(process.env.RABBITMQ_RECONNECT_INTERVAL) || 5000,
    MAX_RECONNECT_ATTEMPTS: Number(process.env.RABBITMQ_MAX_RECONNECT_ATTEMPTS) || 10,
  },
};
