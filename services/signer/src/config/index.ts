export const CONFIG = {
    PORT: Number(process.env.PORT) || 3000,
    SERVICE_NAME: process.env.SERVICE_NAME || "signer",
  
  RABBITMQ: {
    URI: process.env.RABBITMQ_URI || "amqp://localhost:5672",
    MAX_RECONNECT_ATTEMPTS: 5,
    RECONNECT_INTERVAL: 5000,
  },
  SIGNER: {
    PRIVATE_KEY: process.env.SIGNER_PRIVATE_KEY || "",
  },
} as const;