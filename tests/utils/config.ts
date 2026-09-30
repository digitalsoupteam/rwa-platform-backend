process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

export const GATEWAY_URL = "https://localhost/gateway/graphql";
export const GATEWAY_REST_URL = "https://localhost";

export const TESTNET_RPC =
  process.env.TESTNET_RPC ?? "http://127.0.0.1:8545";

// export const TESTNET_RPC =
//   "https://rpc.ankr.com/bsc_testnet_chapel/46ed43307df1caf3e5552edd36e32161b6173775e5c6d08575ad9831af6ecbe8";

export const FACTORY_ADDRESS = "0xF46A71cac8B1A8F734559Cc4367CD1546A1A29bF";

export const HOLD_TOKEN_ADDRESS = "0x1c0e214bB702572E5582085d6E25c39A2B13510d";

export const DAO_STAKING_ADDRESS = "0xca901bb81b3467a1bf079003c9c5bd41a4041891";
export const GOVERNANCE_ADDRESS = "0x39c2a6de73d1928910977c6555ac0462ed3522d3";
export const PLATFORM_TOKEN_ADDRESS = "0x05e03e09329b059e67d5f9d4ec8daff9598b3bd3";
export const TIMELOCK_ADDRESS = "0xEE4B4338E22c542967334E4C0098fc42869f4750";
export const TREASURY_ADDRESS = "0x92d89379C79FD3Ad6127D841C8a36a98db4e05f0";

export const REFERRAL_TREASURY_ADDRESS = "0xcf56E77069cC2aBfA6c1Df9bfD4155F782697B9D";

// Testnet-faucet wallet on the stand: platform tokens are returned here by tests/dao.test.ts ("return all" in afterAll)
export const FAUCET_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
