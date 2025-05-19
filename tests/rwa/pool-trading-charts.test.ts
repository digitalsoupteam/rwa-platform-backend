import { expect, test, describe, beforeAll } from "bun:test";
import { ethers, Wallet, JsonRpcProvider } from "ethers";
import { TESTNET_RPC } from "../utils/config";
import { makeGraphQLRequest } from "../utils/graphql/makeGraphQLRequest";
import { requestHold, requestGas } from "../utils/requestTokens";
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

describe("RWA Pool Trading Charts", () => {
  let provider: JsonRpcProvider;
  let userWallet: Wallet;
  let poolData: PoolData;
  let userAccessToken: string;
  let startTime: number;

  const poolDataPath = join(__dirname, "pool-data.json");

  beforeAll(async () => {
    const rawData = await readFile(poolDataPath, 'utf-8');
    poolData = JSON.parse(rawData);

    provider = new ethers.JsonRpcProvider(TESTNET_RPC);
    userWallet = ethers.Wallet.createRandom().connect(provider) as any;
    
    ({ accessToken: userAccessToken } = await authenticate(userWallet));

    await requestHold(userAccessToken, 500);
    await requestGas(userAccessToken, 0.0015);
    await new Promise(resolve => setTimeout(resolve, 10000));

    startTime = Math.floor(Date.now() / 1000);
  });

  test("should track price changes during trading operations", async () => {
    const poolContract = new ethers.Contract(
      poolData.poolAddress,
      [
        "function estimateMint(uint256 rwaAmount, bool allowPartial) public view returns (uint256 holdAmountWithFee, uint256 fee, uint256 actualRwaAmount)",
        "function mint(uint256 rwaAmount, uint256 maxHoldAmount, uint256 validUntil, bool allowPartial) external",
        "function estimateBurn(uint256 rwaAmount) public view returns (uint256 holdAmountWithoutFee, uint256 holdFee, uint256 bonusAmountWithoutFee, uint256 bonusFee)",
        "function burn(uint256 rwaAmount, uint256 minHoldAmount, uint256 minBonusAmount, uint256 validUntil) external",
        "function holdToken() public view returns (address)",
      ],
      userWallet
    );

    // Approve HOLD token spending
    const holdTokenAddress = await poolContract.holdToken();
    const holdToken = new ethers.Contract(
      holdTokenAddress,
      [
        "function approve(address spender, uint256 amount) public returns (bool)",
      ],
      userWallet
    );

    const approveTx = await holdToken.approve(
      poolData.poolAddress,
      ethers.MaxUint256
    );
    await approveTx.wait();

    // Get initial price data
    const initialPriceData = await makeGraphQLRequest(
      GET_RAW_PRICE_DATA,
      {
        input: {
          poolAddress: poolData.poolAddress,
          startTime: startTime - 3600,
          endTime: startTime + 3600,
          sort: { timestamp: "desc" },
          limit: 1
        }
      },
      userAccessToken
    );

    console.log('aw1')
    console.log(initialPriceData.data.getRawPriceData)

    expect(initialPriceData.errors).toBeUndefined();
    expect(initialPriceData.data.getRawPriceData.length).toBeGreaterThan(0);
    const initialPrice = initialPriceData.data.getRawPriceData[0].price;

    // Perform mint operation
    const rwaAmount = "1000";
    const [holdAmountWithFee] = await poolContract.estimateMint(rwaAmount, true);
    const validUntil = Math.floor(Date.now() / 1000) + 3600;
    
    const maxHoldAmount = BigInt(holdAmountWithFee) * BigInt(110) / BigInt(100);
    
    const mintTx = await poolContract.mint(
      rwaAmount,
      maxHoldAmount,
      validUntil,
      true,
      {
        gasLimit: 1000000,
        gasPrice: 1000000000,
      }
    );
    await mintTx.wait(20);

    // Wait for price update
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Get price data after mint
    const afterMintPriceData = await makeGraphQLRequest(
      GET_RAW_PRICE_DATA,
      {
        input: {
          poolAddress: poolData.poolAddress,
          startTime: startTime - 3600,
          endTime: startTime + 3600,
          sort: { timestamp: "desc" },
          limit: 1
        }
      },
      userAccessToken
    );
    console.log('aw12')
    console.log(afterMintPriceData.data.getRawPriceData)

    expect(afterMintPriceData.errors).toBeUndefined();
    expect(afterMintPriceData.data.getRawPriceData.length).toBeGreaterThan(0);
    const afterMintPrice = afterMintPriceData.data.getRawPriceData[0].price;

    // Price should change after mint
    expect(afterMintPrice).not.toBe(initialPrice);

    // Perform burn operation
    const [holdAmountWithoutFee, , bonusAmountWithoutFee] = await poolContract.estimateBurn(rwaAmount);
    
    const minHoldAmount = BigInt(holdAmountWithoutFee) * BigInt(90) / BigInt(100);
    const minBonusAmount = BigInt(bonusAmountWithoutFee) * BigInt(90) / BigInt(100);
    
    const burnTx = await poolContract.burn(
      rwaAmount,
      minHoldAmount,
      minBonusAmount,
      validUntil,
      {
        gasLimit: 1000000,
        gasPrice: 1000000000,
      }
    );
    await burnTx.wait(20);

    // Wait for price update
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Get price data after burn
    const afterBurnPriceData = await makeGraphQLRequest(
      GET_RAW_PRICE_DATA,
      {
        input: {
          poolAddress: poolData.poolAddress,
          startTime: startTime - 3600,
          endTime: startTime + 3600,
          sort: { timestamp: "desc" },
          limit: 1
        }
      },
      userAccessToken
    );

    console.log('aw13')
    console.log(afterBurnPriceData.data.getRawPriceData)

    expect(afterBurnPriceData.errors).toBeUndefined();
    expect(afterBurnPriceData.data.getRawPriceData.length).toBeGreaterThan(0);
    const afterBurnPrice = afterBurnPriceData.data.getRawPriceData[0].price;

    // Price should return close to initial after burn
    expect(BigInt(afterBurnPrice)).toBeGreaterThanOrEqual(BigInt(initialPrice) * BigInt(95) / BigInt(100));
    expect(BigInt(afterBurnPrice)).toBeLessThanOrEqual(BigInt(initialPrice) * BigInt(105) / BigInt(100));

    // Check OHLC data
    const ohlcData = await makeGraphQLRequest(
      GET_OHLC_PRICE_DATA,
      {
        input: {
          poolAddress: poolData.poolAddress,
          interval: "1m",
          startTime: startTime - 3600,
          endTime: startTime + 3600
        }
      },
      userAccessToken
    );
    console.log('aw14')
    console.log(JSON.stringify(ohlcData, null, 4))

    expect(ohlcData.errors).toBeUndefined();
    expect(ohlcData.data.getOhlcPriceData.length).toBeGreaterThan(0);

    // Verify OHLC data structure
    const lastCandle = ohlcData.data.getOhlcPriceData[ohlcData.data.getOhlcPriceData.length - 1];
    expect(lastCandle).toHaveProperty("timestamp");
    expect(lastCandle).toHaveProperty("open");
    expect(lastCandle).toHaveProperty("high");
    expect(lastCandle).toHaveProperty("low");
    expect(lastCandle).toHaveProperty("close");

    // High should be highest price during the period
    expect(BigInt(lastCandle.high)).toBeGreaterThanOrEqual(BigInt(lastCandle.open));
    expect(BigInt(lastCandle.high)).toBeGreaterThanOrEqual(BigInt(lastCandle.close));
    
    // Low should be lowest price during the period
    expect(BigInt(lastCandle.low)).toBeLessThanOrEqual(BigInt(lastCandle.open));
    expect(BigInt(lastCandle.low)).toBeLessThanOrEqual(BigInt(lastCandle.close));
  });
});