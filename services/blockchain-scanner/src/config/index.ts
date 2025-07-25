
export const CONFIG = {
  PORT: Number(process.env.PORT),
  SERVICE_NAME: String(process.env.SERVICE_NAME),
  
  MONGODB: {
    URI: String(process.env.MONGODB_URI),
  },
  
  BLOCKCHAIN: {
    RPC_URL: String(process.env.RPC_URL),
    EVENT_EMITTER_ADDRESS: String(process.env.EVENT_EMITTER_ADDRESS),
    BLOCK_CONFIRMATIONS: Number(process.env.BLOCK_CONFIRMATIONS),
    CHAIN_ID: Number(process.env.CHAIN_ID),
  },
  
  RABBITMQ: {
    URI: String(process.env.RABBITMQ_URL),
    EXCHANGE: String(process.env.RABBITMQ_EXCHANGE),
    RECONNECT_INTERVAL: Number(process.env.RABBITMQ_RECONNECT_INTERVAL),
    MAX_RECONNECT_ATTEMPTS: Number(process.env.RABBITMQ_MAX_RECONNECT_ATTEMPTS),
  },
  
  SCANNER: {
    SCAN_INTERVAL: Number(process.env.SCAN_INTERVAL),
    BATCH_SIZE: Number(process.env.BATCH_SIZE),
  },
};