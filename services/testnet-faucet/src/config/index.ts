/**
 * Testnet Faucet Service Configuration
 */
export const CONFIG = {
  // Service settings
  PORT: Number(process.env.PORT),
  SERVICE_NAME: String(process.env.SERVICE_NAME),

  // MongoDB settings
  MONGODB: {
    URI: String(process.env.MONGODB_URI)
  },

  // Blockchain integration settings
  BLOCKCHAIN: {
    PROVIDER_URL: String(process.env.PROVIDER_URL),
    WALLET_PRIVATE_KEY: String(process.env.WALLET_PRIVATE_KEY),
    HOLD_TOKEN_ADDRESS: String(process.env.HOLD_TOKEN_ADDRESS),
    PLATFORM_TOKEN_ADDRESS: String(process.env.PLATFORM_TOKEN_ADDRESS)
  },

  // Faucet business logic settings
  FAUCET: {
    GAS_TOKEN_AMOUNT: Number(process.env.GAS_TOKEN_AMOUNT),
    HOLD_TOKEN_AMOUNT: Number(process.env.HOLD_TOKEN_AMOUNT),
    PLATFORM_TOKEN_AMOUNT: Number(process.env.PLATFORM_TOKEN_AMOUNT),
    REQUEST_GAS_DELAY_MS: Number(process.env.REQUEST_GAS_DELAY_MS),
    REQUEST_HOLD_DELAY_MS: Number(process.env.REQUEST_HOLD_DELAY_MS),
    REQUEST_PLATFORM_DELAY_MS: Number(process.env.REQUEST_PLATFORM_DELAY_MS)
  }
} as const;