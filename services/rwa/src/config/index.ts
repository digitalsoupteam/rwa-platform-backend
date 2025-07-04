export const CONFIG = {
  PORT: Number(process.env.PORT) || 3000,
  SERVICE_NAME: process.env.SERVICE_NAME || "rwa",

  REDIS: {
    URL: process.env.REDIS_URL || "redis://localhost:6379",
  },

  OTHER_SERVICES: {
    SIGNATURES_MANAGER: {
      URL: process.env.SIGNERS_MANAGER_URL || "http://signers-manager"
    }
  },

  MONGODB: {
    URI: process.env.MONGODB_URI || "mongodb://mongodb:27017/rwa",
  },

  OPENROUTER: {
    API_KEY: process.env.OPENROUTER_API_KEY || "",
    BASE_URL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    MODEL: process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-001",
  },

    
  RABBITMQ: {
    URI: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    EXCHANGE: process.env.RABBITMQ_EXCHANGE || 'blockchain.events',
    RECONNECT_INTERVAL: Number(process.env.RABBITMQ_RECONNECT_INTERVAL) || 5000,
    MAX_RECONNECT_ATTEMPTS: Number(process.env.RABBITMQ_MAX_RECONNECT_ATTEMPTS) || 10,
  },

  SUPPORTED_NETWORKS: [
    {
      chainId: '97', 
      name: "BSC Testnet",
      factoryAddress: "0xb2889D76166eDe1Bf0460f391914e8C266E3f9CE",
    }
  ]
};
