import { expect, test, describe, beforeAll } from "bun:test";
import { ethers, Wallet, JsonRpcProvider } from "ethers";
import { HOLD_TOKEN_ADDRESS, TESTNET_RPC } from "../utils/config";
import { makeGraphQLRequest } from "../utils/graphql/makeGraphQLRequest";
import { GET_POOL } from "../utils/graphql/schema/rwa";
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

describe("RWA Pool Trading", () => {
  let provider: JsonRpcProvider;
  let poolWallet: Wallet;
  let poolData: PoolData;

  // Путь к файлу с данными пула
  const poolDataPath = join(__dirname, "pool-data.json");

  // Количество пользователей и циклов
  const NUM_USERS = 5;
  const NUM_CYCLES = 10;

  beforeAll(async () => {
    // Загружаем данные пула
    const rawData = await readFile(poolDataPath, 'utf-8');
    poolData = JSON.parse(rawData);

    provider = new ethers.JsonRpcProvider(TESTNET_RPC);
    poolWallet = new Wallet(poolData.ownerPrivateKey).connect(provider);
  });

  // Функция для выполнения операций одним пользователем
  async function runUserOperations(userId: number) {
    const userWallet = ethers.Wallet.createRandom().connect(provider) as any;
    const { accessToken: userAccessToken } = await authenticate(userWallet);

    // Запрашиваем токены для пользователя
    await requestHold(userAccessToken, 500);
    await requestGas(userAccessToken, 0.007);
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log(`User ${userId}: Initialized and received tokens`);

    // Создаем контракты для пользователя
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

    // Get HOLD token address and approve spending
    const holdTokenAddress = await poolContract.holdToken();
    const holdToken = new ethers.Contract(
      holdTokenAddress,
      [
        "function approve(address spender, uint256 amount) public returns (bool)",
        "function balanceOf(address account) public view returns (uint256)",
      ],
      userWallet
    );

    const approveTx = await holdToken.approve(
      poolData.poolAddress,
      ethers.MaxUint256
    );
    await approveTx.wait();

    console.log(`User ${userId}: Approved HOLD token spending`);

    // Выполняем циклы mint/burn
    for (let cycle = 0; cycle < NUM_CYCLES; cycle++) {
      try {
        console.log(`User ${userId}: Starting cycle ${cycle + 1}`);

        // Mint operation
        const rwaAmount = "1000";
        const [holdAmountWithFee] = await poolContract.estimateMint(rwaAmount, true);
        const validUntil = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
        
        // Добавляем 10% слиппейдж для maxHoldAmount
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
        console.log(`User ${userId}: Completed mint in cycle ${cycle + 1}`);

        // Burn operation
        const [holdAmountWithoutFee, , bonusAmountWithoutFee] = await poolContract.estimateBurn(rwaAmount);
        
        // Уменьшаем minHoldAmount и minBonusAmount на 10%
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
        console.log(`User ${userId}: Completed burn in cycle ${cycle + 1}`);

      } catch (error) {
        console.error(`User ${userId}: Error in cycle ${cycle + 1}:`, error);
        throw error;
      }
    }

    console.log(`User ${userId}: Completed all ${NUM_CYCLES} cycles`);
  }

  test("should perform parallel mint and burn operations with multiple users", async () => {
    // Получаем и выводим начальное состояние пула
    const initialPoolState = await makeGraphQLRequest(
      GET_POOL,
      {
        id: poolData.poolId,
      },
      poolData.accessToken
    );

    console.log("\nInitial pool state:", {
      awaitingRwaAmount: initialPoolState.data.getPool.awaitingRwaAmount,
      realHoldReserve: initialPoolState.data.getPool.realHoldReserve,
      virtualHoldReserve: initialPoolState.data.getPool.virtualHoldReserve,
      virtualRwaReserve: initialPoolState.data.getPool.virtualRwaReserve
    });

    // Создаем массив промисов для каждого пользователя
    const userPromises = Array.from({ length: NUM_USERS }, (_, i) =>
      runUserOperations(i + 1)
    );

    // Запускаем всех пользователей параллельно
    await Promise.all(userPromises);
    
    console.log("\nAll users completed their operations");

    // Получаем и выводим конечное состояние пула
    const finalPoolState = await makeGraphQLRequest(
      GET_POOL,
      {
        id: poolData.poolId,
      },
      poolData.accessToken
    );

    console.log("\nFinal pool state:", {
      awaitingRwaAmount: finalPoolState.data.getPool.awaitingRwaAmount,
      realHoldReserve: finalPoolState.data.getPool.realHoldReserve,
      virtualHoldReserve: finalPoolState.data.getPool.virtualHoldReserve,
      virtualRwaReserve: finalPoolState.data.getPool.virtualRwaReserve
    });
  });
});