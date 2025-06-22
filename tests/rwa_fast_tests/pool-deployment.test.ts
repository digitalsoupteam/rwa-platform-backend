import { expect, test, describe, beforeAll } from "bun:test";
import { ethers, Wallet, JsonRpcProvider } from "ethers";
import { FACTORY_ADDRESS, TESTNET_RPC } from "../utils/config";
import { makeGraphQLRequest } from "../utils/graphql/makeGraphQLRequest";
import {
  CREATE_POOL,
  EDIT_POOL,
  GET_POOL,
  REQUEST_POOL_APPROVAL_SIGNATURES,
} from "../utils/graphql/schema/rwa";
import { GET_SIGNATURE_TASK } from "../utils/graphql/schema/signers-manager";
import { requestHold, requestGas } from "../utils/requestTokens";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { authenticate } from "../utils/authenticate";

interface BusinessData {
  businessId: string;
  companyId: string;
  tokenAddress: string;
  ownerWallet: string;
  ownerPrivateKey: string;
  accessToken: string;
  chainId: string;
  businessData: any;
}

describe("RWA Pool Operations", () => {
  let provider: JsonRpcProvider;
  let wallet: Wallet;
  let businessData: BusinessData;
  let poolId: string;
  let poolApprovalSignaturesTaskId: string;
  let accessToken: string;
  let userId: string;

  
  const businessDataPath = join(__dirname, "business-data.json");
  const poolDataPath = join(__dirname, "pool-data.json");

  beforeAll(async () => {
    
    const rawData = await readFile(businessDataPath, 'utf-8');
    businessData = JSON.parse(rawData);

    provider = new ethers.JsonRpcProvider(TESTNET_RPC);
    wallet = new Wallet(businessData.ownerPrivateKey).connect(provider);

    ({ accessToken, userId } = await authenticate(wallet));
  });

  test("should create and deploy pool using existing business", async () => {
    // Create pool
    const createResult = await makeGraphQLRequest(
      CREATE_POOL,
      {
        input: {
          name: "Test Pool",
          businessId: businessData.businessId,
        },
      },
      accessToken
    );

    expect(createResult.errors).toBeUndefined();
    expect(createResult.data.createPool).toBeDefined();
    poolId = createResult.data.createPool.id;

    // Configure pool parameters
    const now = Math.floor(Date.now() / 1000);
    const expectedHoldAmount = "10000000000000000000000"; // 10,000 USDT
    const expectedRwaAmount = "100000"; // 100,000 RWA units

    const entryPeriodStart = now - 100;
    const entryPeriodExpired = entryPeriodStart + (30 * 86400);
    const completionPeriodExpired = entryPeriodExpired + (60 * 86400);

    const outgoingTranchAmount = BigInt(expectedHoldAmount) / BigInt(4);
    const outgoingTranches = Array(4).fill(null).map((_, i) => ({
      amount: outgoingTranchAmount.toString(),
      timestamp: entryPeriodExpired + ((i + 1) * 7 * 86400),
      executedAmount: "0"
    }));

    const rewardPercent = "2000"; // 20%
    const totalExpectedIncoming = BigInt(expectedHoldAmount) + 
      (BigInt(expectedHoldAmount) * BigInt(rewardPercent) / BigInt(10000));

    const incomingTranchAmount = totalExpectedIncoming / BigInt(4);
    const incomingTranches = Array(4).fill(null).map((_, i) => ({
      amount: incomingTranchAmount.toString(),
      expiredAt: entryPeriodExpired + ((i + 1) * 15 * 86400),
      returnedAmount: "0"
    }));

    // Update pool configuration
    const editResult = await makeGraphQLRequest(
      EDIT_POOL,
      {
        input: {
          id: poolId,
          updateData: {
            name: "Production Pool",
            description: "Production Pool Description",
            tags: ["production"],
            expectedHoldAmount,
            expectedRwaAmount,
            rewardPercent,
            priceImpactPercent: "101",
            entryFeePercent: "100",
            exitFeePercent: "100",
            entryPeriodStart,
            entryPeriodExpired,
            completionPeriodExpired,
            outgoingTranches,
            incomingTranches,
            awaitCompletionExpired: true,
            floatingOutTranchesTimestamps: true,
            fixedSell: false,
            allowEntryBurn: true
          }
        },
      },
      accessToken
    );

    expect(editResult.errors).toBeUndefined();
    expect(editResult.data.editPool).toBeDefined();

    // Request signatures for deployment
    const sigResult = await makeGraphQLRequest(
      REQUEST_POOL_APPROVAL_SIGNATURES,
      {
        input: {
          id: poolId,
          ownerWallet: wallet.address,
          deployerWallet: wallet.address,
          createPoolFeeRatio: "100"
        },
      },
      accessToken
    );

    expect(sigResult.errors).toBeUndefined();
    poolApprovalSignaturesTaskId = sigResult.data.requestPoolApprovalSignatures.taskId;

    // Wait for signatures
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Get pool data and signatures
    const poolData = await makeGraphQLRequest(
      GET_POOL,
      {
        id: poolId,
      },
      accessToken
    );

    expect(poolData.errors).toBeUndefined();

    const taskResult = await makeGraphQLRequest(
      GET_SIGNATURE_TASK,
      {
        input: {
          taskId: poolApprovalSignaturesTaskId,
        },
      },
      accessToken
    );

    expect(taskResult.errors).toBeUndefined();
    expect(taskResult.data.getSignatureTask.completed).toBe(true);

    // Request tokens
    await requestHold(accessToken, 500);
    await requestGas(accessToken, 0.0035);
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Deploy pool contract
    const signatures = taskResult.data.getSignatureTask.signatures;
    const signers = signatures.map((sig: any) => ethers.getAddress(sig.signer));
    const signatureValues = signatures.map((sig: any) => sig.signature);
    const approvalSignaturesExpired = taskResult.data.getSignatureTask.expired;

    const factory = new ethers.Contract(
      FACTORY_ADDRESS,
      [
        "function deployPool(uint256 createPoolFeeRatio, string calldata entityId, address rwa, uint256 expectedHoldAmount, uint256 expectedRwaAmount, uint256 priceImpactPercent, uint256 rewardPercent, uint256 entryPeriodStart, uint256 entryPeriodExpired, uint256 completionPeriodExpired, uint256 entryFeePercent, uint256 exitFeePercent, bool fixedSell, bool allowEntryBurn, bool awaitCompletionExpired, bool floatingOutTranchesTimestamps, uint256[] calldata outgoingTranches, uint256[] calldata outgoingTranchTimestamps, uint256[] calldata incomingTranches, uint256[] calldata incomingTrancheExpired, address[] calldata signers, bytes[] calldata signatures, uint256 expired)"
      ],
      wallet
    );

    const pool = poolData.data.getPool;
    const deployTx = await factory.deployPool(
      '100',
      poolId,
      pool.rwaAddress,
      BigInt(pool.expectedHoldAmount),
      BigInt(pool.expectedRwaAmount),
      BigInt(pool.priceImpactPercent),
      BigInt(pool.rewardPercent),
      BigInt(pool.entryPeriodStart),
      BigInt(pool.entryPeriodExpired),
      BigInt(pool.completionPeriodExpired),
      BigInt(pool.entryFeePercent),
      BigInt(pool.exitFeePercent),
      pool.fixedSell,
      pool.allowEntryBurn,
      pool.awaitCompletionExpired,
      pool.floatingOutTranchesTimestamps,
      pool.outgoingTranches.map(t => BigInt(t.amount)),
      pool.outgoingTranches.map(t => BigInt(t.timestamp)),
      pool.incomingTranches.map(t => BigInt(t.amount)),
      pool.incomingTranches.map(t => BigInt(t.expiredAt)),
      signers,
      signatureValues,
      approvalSignaturesExpired,
      {
        gasLimit: 2000000,
        gasPrice: 1000000000,
      }
    );
    await deployTx.wait(20);

    // Wait for backend to process the event
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Get final pool data
    const updatedPool = await makeGraphQLRequest(
      GET_POOL,
      {
        id: poolId,
      },
      accessToken
    );

    expect(updatedPool.errors).toBeUndefined();
    expect(updatedPool.data.getPool.poolAddress).toBeDefined();
    expect(updatedPool.data.getPool.poolAddress).not.toBeNull();
    expect(updatedPool.data.getPool.poolAddress).not.toBe("");

    // Save pool data to file
    const poolDataToSave = {
      poolId,
      businessId: businessData.businessId,
      companyId: businessData.companyId,
      poolAddress: updatedPool.data.getPool.poolAddress,
      rwaAddress: businessData.tokenAddress,
      ownerWallet: wallet.address,
      ownerPrivateKey: businessData.ownerPrivateKey,
      accessToken: accessToken,
      chainId: businessData.chainId,
      poolData: updatedPool.data.getPool
    };

    await writeFile(poolDataPath, JSON.stringify(poolDataToSave, null, 2));
  });
});