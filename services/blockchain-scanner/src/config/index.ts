
export const CONFIG = {
  PORT: Number(process.env.PORT) || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  MONGODB: {
    URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/blockchain-scanner',
  },
  
  BLOCKCHAIN: {
    RPC_URL: process.env.RPC_URL || 'http://localhost:8545',
    EVENT_EMITTER_ADDRESS: process.env.EVENT_EMITTER_ADDRESS || '',
    BLOCK_CONFIRMATIONS: Number(process.env.BLOCK_CONFIRMATIONS) || 12,
    CHAIN_ID: Number(process.env.CHAIN_ID) || 1,
  },
  
  RABBITMQ: {
    URI: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    EXCHANGE: process.env.RABBITMQ_EXCHANGE || 'blockchain.events',
    RECONNECT_INTERVAL: Number(process.env.RABBITMQ_RECONNECT_INTERVAL) || 5000,
    MAX_RECONNECT_ATTEMPTS: Number(process.env.RABBITMQ_MAX_RECONNECT_ATTEMPTS) || 10,
  },
  
  SCANNER: {
    SCAN_INTERVAL: Number(process.env.SCANNER_INTERVAL) || 15000,
    BATCH_SIZE: Number(process.env.SCANNER_BATCH_SIZE) || 500,
  },
};