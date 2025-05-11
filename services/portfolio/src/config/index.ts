export const CONFIG = {
  PORT: Number(process.env.PORT) || 3000,
  SERVICE_NAME: process.env.SERVICE_NAME || "gallery",

  MONGODB: {
    URI: process.env.MONGODB_URI || "mongodb://mongodb:27017/gallery",
  },
  RABBITMQ: {
    URI: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    EXCHANGE: process.env.RABBITMQ_EXCHANGE || 'blockchain.events',
    RECONNECT_INTERVAL: Number(process.env.RABBITMQ_RECONNECT_INTERVAL) || 5000,
    MAX_RECONNECT_ATTEMPTS: Number(process.env.RABBITMQ_MAX_RECONNECT_ATTEMPTS) || 10,
  },
};