
export const CONFIG = {
  PORT: Number(process.env.PORT),
  SERVICE_NAME: String(process.env.SERVICE_NAME),
  
  MONGODB: {
    URI: String(process.env.MONGODB_URI)
  },
  
  JWT: {
    SECRET: String(process.env.JWT_SECRET),
    ACCESS_TOKEN_EXPIRY: String(process.env.ACCESS_TOKEN_EXPIRY),
    REFRESH_TOKEN_EXPIRY: String(process.env.REFRESH_TOKEN_EXPIRY)
  },
  
  AUTH: {
    DOMAIN_NAME: String(process.env.DOMAIN_NAME),
    DOMAIN_VERSION: String(process.env.DOMAIN_VERSION)
  }
};