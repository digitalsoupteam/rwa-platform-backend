export const CONFIG = {
  PORT: Number(process.env.PORT),
  SERVICE_NAME: String(process.env.SERVICE_NAME),

  REDIS: {
    URL: String(process.env.REDIS_URL),
  },

  OTHER_SERVICES: {
    SIGNATURES_MANAGER: {
      URL: String(process.env.SIGNERS_MANAGER_URL)
    }
  },

  MONGODB: {
    URI: String(process.env.MONGODB_URI),
  },

  OPENROUTER: {
    API_KEY: String(process.env.OPENROUTER_API_KEY),
    BASE_URL: String(process.env.OPENROUTER_BASE_URL),
    MODEL: String(process.env.OPENROUTER_MODEL),
  },

    
  RABBITMQ: {
    URI: String(process.env.RABBITMQ_URL),
    EXCHANGE: String(process.env.RABBITMQ_EXCHANGE),
    RECONNECT_INTERVAL: Number(process.env.RABBITMQ_RECONNECT_INTERVAL),
    MAX_RECONNECT_ATTEMPTS: Number(process.env.RABBITMQ_MAX_RECONNECT_ATTEMPTS),
  },

  SUPPORTED_NETWORKS: [
    {
      chainId: '97', 
      name: "BSC Testnet",
      factoryAddress: "0xD1b0e186A2B0d602f27cE2e046Fa95BBe9FE6d84",
    }
  ]
};
