export const CONFIG = {
  PORT: Number(process.env.PORT) || 3000,
  SERVICE_NAME: process.env.SERVICE_NAME || 'gateway',
  JWT_SECRET: process.env.JWT_SECRET || "default-secret-key-change-in-production",
  
  SERVICES: {
    AUTH: {
      URL: process.env.AUTH_SERVICE_URL || "http://auth:3000"
    },
    BLOCKCHAIN_SCANNER: {
      URL: process.env.BLOCKCHAIN_SCANNER_SERVICE_URL || "http://blockchain-scanner:3000"
    },
    TESTNET_FAUCET: {
      URL: process.env.TESTNET_FAUCET_SERVICE_URL || "http://testnet-faucet:3000"
    },
    ASSISTANT: {
      URL: process.env.ASSISTANT_SERVICE_URL || "http://ai-assistant:3000"
    },
    RWA: {
      URL: process.env.RWA_SERVICE_URL || "http://rwa:3000"
    },
    SIGNERS_MANAGER: {
      URL: process.env.SIGNERS_MANAGER_SERVICE_URL || "http://signers-manager:3000"
    },
    FILES: {
      URL: process.env.FILES_SERVICE_URL || "http://files:3000"
    },
    GALLERY: {
      URL: process.env.GALLERY_SERVICE_URL || "http://gallery:3000"
    },
    FAQ: {
      URL: process.env.FAQ_SERVICE_URL || "http://faq:3000"
    },
    BLOG: {
      URL: process.env.BLOG_SERVICE_URL || "http://blog:3000"
    },
    QUESTIONS: {
      URL: process.env.QUESTIONS_SERVICE_URL || "http://questions:3000"
    },
    PORTFOLIO: {
      URL: process.env.PORTFOLIO_SERVICE_URL || "http://portfolio:3000"
    },
    COMPANY: {
      URL: process.env.COMPANY_SERVICE_URL || "http://company:3000"
    },
    DOCUMENTS: {
      URL: process.env.DOCUMENTS_SERVICE_URL || "http://documents:3000"
    },
    CHARTS: {
      URL: process.env.CHARTS_SERVICE_URL || "http://charts:3040"
    },
    REACTIONS: {
      URL: process.env.REACTIONS_SERVICE_URL || "http://reactions:3026"
    }
  },
  
  MONITORING: {
    PROMETHEUS_URL: process.env.PROMETHEUS_URL || "http://prometheus:9090",
    LOKI_URL: process.env.LOKI_URL || "http://loki:3100"
  },

  REDIS: {
    URL: process.env.REDIS_URL || "redis://redis:6379"
  },

  RABBITMQ: {
    URL: process.env.RABBITMQ_URL || "amqp://localhost:5672", 
    CHARTS_EXCHANGE: process.env.RABBITMQ_CHARTS_EXCHANGE || "charts.events" 
  }
};