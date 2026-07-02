import { expect, test, describe, beforeAll } from "bun:test";
import { ethers, Wallet, JsonRpcProvider } from "ethers";
import { TESTNET_RPC } from "../utils/config";
import { makeGraphQLRequest } from "../utils/graphql/makeGraphQLRequest";
import { readFile } from "fs/promises";
import { join } from "path";
import { authenticate } from "../utils/authenticate";

interface PoolData {
  poolId: string;
  businessId: string;
  companyId: string;
  poolAddress: string;
  rwaAddress: string;
  ownerWallet: string;
  ownerPrivateKey: string;
  accessToken: string;
  chainId: string;
  poolData: any;
}

const GET_RAW_PRICE_DATA = `
  query GetRawPriceData($input: GetRawPriceDataInput!) {
    getRawPriceData(input: $input) {
      id
      poolAddress
      timestamp
      blockNumber
      realHoldReserve
      virtualHoldReserve
      virtualRwaReserve
      price
      createdAt
      updatedAt
    }
  }
`;

const GET_OHLC_PRICE_DATA = `
  query GetOhlcPriceData($input: GetOhlcPriceDataInput!) {
    getOhlcPriceData(input: $input) {
      timestamp
      open
      high
      low
      close
    }
  }
`;

const GET_POOL_TRANSACTIONS = `
  query GetPoolTransactions($input: GetPoolTransactionsInput!) {
    getPoolTransactions(input: $input) {
      id
      poolAddress
      transactionType
      userAddress
      timestamp
      rwaAmount
      holdAmount
      bonusAmount
      holdFee
      bonusFee
      createdAt
      updatedAt
    }
  }
`;

const GET_VOLUME_DATA = `
  query GetVolumeData($input: GetVolumeDataInput!) {
    getVolumeData(input: $input) {
      timestamp
      mintVolume
      burnVolume
    }
  }
`;

const INTERVALS = ["1m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "12h", "1d", "1w"] as const;

describe("Charts Queries — all endpoints for pool from pool-data.json", () => {
  let poolData: PoolData;
  let userAccessToken: string;
  let startTime: number;
  let endTime: number;

  const poolDataPath = join(__dirname, "pool-data.json");

  beforeAll(async () => {
    const rawData = await readFile(poolDataPath, "utf-8");
    poolData = JSON.parse(rawData);

    const provider = new ethers.JsonRpcProvider(TESTNET_RPC);
    const userWallet = ethers.Wallet.createRandom().connect(provider) as any;

    ({ accessToken: userAccessToken } = await authenticate(userWallet));

    // Wide time range: from pool creation to now + 1 day
    startTime = poolData.poolData.createdAt;
    endTime = Math.floor(Date.now() / 1000) + 86400;
  });

  test("getRawPriceData — returns price entries for the pool", async () => {
    const result = await makeGraphQLRequest(
      GET_RAW_PRICE_DATA,
      {
        input: {
          poolAddress: poolData.poolAddress,
          startTime,
          endTime,
          sort: { timestamp: "desc" },
          limit: 50,
        },
      },
      userAccessToken,
    );

    console.log("getRawPriceData:", JSON.stringify(result, null, 2));

    expect(result.errors).toBeUndefined();
    const items = result.data.getRawPriceData;
    expect(Array.isArray(items)).toBe(true);

    if (items.length > 0) {
      const first = items[0];
      expect(first.poolAddress).toBe(poolData.poolAddress);
      expect(typeof first.price).toBe("string");
      expect(typeof first.timestamp).toBe("number");
      expect(typeof first.blockNumber).toBe("number");
      expect(typeof first.realHoldReserve).toBe("string");
      expect(typeof first.virtualHoldReserve).toBe("string");
      expect(typeof first.virtualRwaReserve).toBe("string");
      expect(typeof first.id).toBe("string");
    }
  });

  test("getOhlcPriceData — returns OHLC candles for every interval", async () => {
    for (const interval of INTERVALS) {
      const result = await makeGraphQLRequest(
        GET_OHLC_PRICE_DATA,
        {
          input: {
            poolAddress: poolData.poolAddress,
            interval,
            startTime,
            endTime,
          },
        },
        userAccessToken,
      );

      console.log(`getOhlcPriceData [${interval}]:`, JSON.stringify(result, null, 2));

      expect(result.errors).toBeUndefined();
      const candles = result.data.getOhlcPriceData;
      expect(Array.isArray(candles)).toBe(true);

      if (candles.length > 0) {
        const candle = candles[0];
        expect(candle).toHaveProperty("timestamp");
        expect(candle).toHaveProperty("open");
        expect(candle).toHaveProperty("high");
        expect(candle).toHaveProperty("low");
        expect(candle).toHaveProperty("close");

        // High >= open, high >= close
        expect(BigInt(candle.high)).toBeGreaterThanOrEqual(BigInt(candle.open));
        expect(BigInt(candle.high)).toBeGreaterThanOrEqual(BigInt(candle.close));
        // Low <= open, low <= close
        expect(BigInt(candle.low)).toBeLessThanOrEqual(BigInt(candle.open));
        expect(BigInt(candle.low)).toBeLessThanOrEqual(BigInt(candle.close));
      }
    }
  });

  test("getPoolTransactions — returns transactions for the pool", async () => {
    const result = await makeGraphQLRequest(
      GET_POOL_TRANSACTIONS,
      {
        input: {
          filter: { poolAddress: poolData.poolAddress },
          sort: { timestamp: "desc" },
          limit: 50,
        },
      },
      userAccessToken,
    );

    console.log("getPoolTransactions:", JSON.stringify(result, null, 2));

    expect(result.errors).toBeUndefined();
    const txs = result.data.getPoolTransactions;
    expect(Array.isArray(txs)).toBe(true);

    if (txs.length > 0) {
      const tx = txs[0];
      expect(tx.poolAddress).toBe(poolData.poolAddress);
      expect(["MINT", "BURN"]).toContain(tx.transactionType);
      expect(typeof tx.userAddress).toBe("string");
      expect(typeof tx.rwaAmount).toBe("string");
      expect(typeof tx.holdAmount).toBe("string");
      expect(typeof tx.holdFee).toBe("string");
      expect(typeof tx.timestamp).toBe("number");
    }
  });

  test("getVolumeData — returns volume data for every interval", async () => {
    for (const interval of INTERVALS) {
      const result = await makeGraphQLRequest(
        GET_VOLUME_DATA,
        {
          input: {
            poolAddress: poolData.poolAddress,
            interval,
            startTime,
            endTime,
          },
        },
        userAccessToken,
      );

      console.log(`getVolumeData [${interval}]:`, JSON.stringify(result, null, 2));

      expect(result.errors).toBeUndefined();
      const volumes = result.data.getVolumeData;
      expect(Array.isArray(volumes)).toBe(true);

      if (volumes.length > 0) {
        const vol = volumes[0];
        expect(vol).toHaveProperty("timestamp");
        expect(vol).toHaveProperty("mintVolume");
        expect(vol).toHaveProperty("burnVolume");
        expect(typeof vol.mintVolume).toBe("string");
        expect(typeof vol.burnVolume).toBe("string");
      }
    }
  });
});