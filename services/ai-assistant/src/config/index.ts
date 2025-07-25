export const CONFIG = {
  PORT: Number(process.env.PORT),
  SERVICE_NAME: String(process.env.SERVICE_NAME),

  MONGODB: {
    URI: String(process.env.MONGODB_URI),
  },

  OPENROUTER: {
    API_KEY: String(process.env.OPENROUTER_API_KEY),
    BASE_URL: String(process.env.OPENROUTER_BASE_URL),
    MODEL: String(process.env.OPENROUTER_MODEL),
  },

  OTHER_SERVICES: {
    RWA: {
      URL: String(process.env.RWA_SERVICE_URL)
    },
    PORTFOLIO: {
      URL: String(process.env.PORTFOLIO_SERVICE_URL)
    }
  }
};
