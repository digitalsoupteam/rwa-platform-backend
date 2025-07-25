export const CONFIG = {
    PORT: Number(process.env.PORT),
    SERVICE_NAME: String(process.env.SERVICE_NAME),
  
  RABBITMQ: {
    URI: String(process.env.RABBITMQ_URI),
    MAX_RECONNECT_ATTEMPTS: Number(process.env.RABBITMQ_MAX_RECONNECT_ATTEMPTS),
    RECONNECT_INTERVAL: Number(process.env.RABBITMQ_RECONNECT_INTERVAL),
  },
  SIGNER: {
    PRIVATE_KEY: String(process.env.SIGNER_PRIVATE_KEY),
  },
} as const;