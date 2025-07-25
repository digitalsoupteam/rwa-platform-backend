export const CONFIG = {
  PORT: Number(process.env.PORT),
  SERVICE_NAME: String(process.env.SERVICE_NAME),

  MONGODB: {
    URI: String(process.env.MONGODB_URI),
  },
  RABBITMQ: {
    URI: String(process.env.RABBITMQ_URL),
    EXCHANGE: String(process.env.RABBITMQ_EXCHANGE),
    RECONNECT_INTERVAL: Number(process.env.RABBITMQ_RECONNECT_INTERVAL),
    MAX_RECONNECT_ATTEMPTS: Number(process.env.RABBITMQ_MAX_RECONNECT_ATTEMPTS),
  },
  
  OTHER_SERVICES: {
    SIGNERS_MANAGER: {
      URL: String(process.env.SIGNERS_MANAGER_URL)
    }
  },
  
  LOYALTY: {
    REFERRAL_REWARD_PERCENTAGE: Number(process.env.LOYALTY_REFERRAL_REWARD_PERCENTAGE),
  },
  SUPPORTED_NETWORKS: [
    {
      chainId: '97',
      name: "BSC Testnet",
      referralTreasuryAddress: "0x5Be8ef43955d48357080334DAa7DC68cDcc7a6c6",
    }
  ]
};
