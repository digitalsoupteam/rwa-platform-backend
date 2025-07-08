
export const CONFIG = {
  PORT: Number(process.env.PORT) || 3000,
  SERVICE_NAME: process.env.SERVICE_NAME || 'auth',
  VERSION: process.env.VERSION || '1.0.0',
  
  MONGODB: {
    URI: process.env.MONGODB_URI || 'mongodb://mongodb:27017/auth'
    
  },
  
  JWT: {
    SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    ACCESS_TOKEN_EXPIRY: process.env.ACCESS_TOKEN_EXPIRY || '15m',
    REFRESH_TOKEN_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY || '1d' // TODO CHECK docker
  },
  
  AUTH: {
    DOMAIN_NAME: 'RWA Platform',
    DOMAIN_VERSION: '1'
  }
};