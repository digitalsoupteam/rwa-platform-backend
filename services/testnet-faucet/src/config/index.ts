/**
 * Testnet Faucet Service Configuration
 */
export const CONFIG = {
  // Service settings
  PORT: Number(process.env.PORT) || 3000,
  SERVICE_NAME: process.env.SERVICE_NAME || 'testnet-faucet',

  // MongoDB settings
  MONGODB: {
    URI: process.env.MONGODB_URI || "mongodb://mongodb:27017/testnet-faucet"
  },

  // Blockchain integration settings
  BLOCKCHAIN: {
    PROVIDER_URL: process.env.PROVIDER_URL || "https://polygon-mumbai.infura.io/v3/YOUR_INFURA_PROJECT_ID",
    WALLET_PRIVATE_KEY: process.env.WALLET_PRIVATE_KEY || "",
    HOLD_TOKEN_ADDRESS: process.env.HOLD_TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000",
    PLATFORM_TOKEN_ADDRESS: process.env.PLATFORM_TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000"
  },

  // Faucet business logic settings
  FAUCET: {
    GAS_TOKEN_AMOUNT: Number(process.env.GAS_TOKEN_AMOUNT) || 0.02,
    HOLD_TOKEN_AMOUNT: Number(process.env.HOLD_TOKEN_AMOUNT) || 10000,
    PLATFORM_TOKEN_AMOUNT: Number(process.env.PLATFORM_TOKEN_AMOUNT) || 10000,
    REQUEST_GAS_DELAY: Number(process.env.REQUEST_GAS_DELAY) || 60,
    REQUEST_HOLD_DELAY: Number(process.env.REQUEST_HOLD_DELAY) || 60,
    REQUEST_PLATFORM_DELAY: Number(process.env.REQUEST_PLATFORM_DELAY) || 60
  }
} as const;