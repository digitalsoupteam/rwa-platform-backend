import { expect, test, describe, beforeAll } from "bun:test";
import { ethers, HDNodeWallet, JsonRpcProvider } from "ethers";
import { FACTORY_ADDRESS, HOLD_TOKEN_ADDRESS, TESTNET_RPC } from "../utils/config";
import { makeGraphQLRequest } from "../utils/graphql/makeGraphQLRequest";
import { authenticate } from "../utils/authenticate";
import { CREATE_COMPANY } from "../utils/graphql/schema/company";
import {
  CREATE_BUSINESS,
  EDIT_BUSINESS,
  UPDATE_BUSINESS_RISK_SCORE,
  REQUEST_BUSINESS_APPROVAL_SIGNATURES,
  GET_BUSINESS,
  CREATE_POOL,
  EDIT_POOL,
  UPDATE_POOL_RISK_SCORE,
  REQUEST_POOL_APPROVAL_SIGNATURES,
  GET_POOL,
} from "../utils/graphql/schema/rwa";
import { GET_SIGNATURE_TASK } from "../utils/graphql/schema/signers-manager";
import { requestGas, requestHold } from "../utils/requestTokens";
import { writeFile } from "fs/promises";
import { join } from "path";

describe("Portfolio Deployment", () => {
  let chainId: string;
  let provider: JsonRpcProvider;
  let wallet: HDNodeWallet;
  let accessToken: string;
  let userId: string;
  
  // Business addresses
  let business1Id: string;
  let business2Id: string;
  let business1Address: string;
  let business2Address: string;
  
  // Pool addresses
  let pool1Id: string;
  let pool2Id: string;
  let pool3Id: string;
  let pool1Address: string;
  let pool2Address: string;
  let pool3Address: string;

  const portfolioDataPath = join(__dirname, "portfolio-data.json");

  beforeAll(async () => {
    chainId = "97";
    provider = new ethers.JsonRpcProvider(TESTNET_RPC);
    wallet = ethers.Wallet.createRandom().connect(provider);

    ({ accessToken, userId } = await authenticate(wallet));

    // Create company for testing
    const companyResult = await makeGraphQLRequest(
      CREATE_COMPANY,
      {
        input: {
          name: "Test Company for Portfolio",
          description: "Test Description"
        },
      },
      accessToken
    );
    const companyId = companyResult.data.createCompany.id;

    // Request initial tokens
    await requestHold(accessToken, 2000);
    await requestGas(accessToken, 0.01);
    
    // Wait for transactions to be mined
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Create first business
    const business1Result = await makeGraphQLRequest(
      CREATE_BUSINESS,
      {
        input: {
          name: "First Test Business",
          ownerId: companyId,
          ownerType: "company",
          chainId,
          description: "Business for portfolio testing",
          tags: ["test", "portfolio"]
        },
      },
      accessToken
    );
    business1Id = business1Result.data.createBusiness.id;

    // Request signatures for first business
    const signatures1Result = await makeGraphQLRequest(
      REQUEST_BUSINESS_APPROVAL_SIGNATURES,
      {
        input: {
          id: business1Id,
          ownerWallet: wallet.address,
          deployerWallet: wallet.address,
          createRWAFee: "100"
        },
      },
      accessToken
    );

    // Wait for signatures
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Get signatures for first business
    const task1Result = await makeGraphQLRequest(
      GET_SIGNATURE_TASK,
      {
        input: {
          taskId: signatures1Result.data.requestBusinessApprovalSignatures.taskId,
        },
      },
      accessToken
    );

    const signatures1 = task1Result.data.getSignatureTask.signatures;
    const signers1 = signatures1.map((sig: any) => ethers.getAddress(sig.signer));
    const signatureValues1 = signatures1.map((sig: any) => sig.signature);
    const expired1 = task1Result.data.getSignatureTask.expired;

    // Deploy first business contract
    const factory = new ethers.Contract(
      FACTORY_ADDRESS,
      [
        "function deployRWA(uint256 createRWAFee, string calldata entityId, string calldata entityOwnerId, string calldata entityOwnerType, address owner, address[] calldata signers, bytes[] calldata signatures, uint256 expired)",
        "function deployPool(uint256 createPoolFeeRatio, string calldata entityId, address rwa, uint256 expectedHoldAmount, uint256 expectedRwaAmount, uint256 priceImpactPercent, uint256 rewardPercent, uint256 entryPeriodStart, uint256 entryPeriodExpired, uint256 completionPeriodExpired, uint256 entryFeePercent, uint256 exitFeePercent, bool fixedSell, bool allowEntryBurn, bool awaitCompletionExpired, bool floatingOutTranchesTimestamps, uint256[] calldata outgoingTranches, uint256[] calldata outgoingTranchTimestamps, uint256[] calldata incomingTranches, uint256[] calldata incomingTrancheExpired, address[] calldata signers, bytes[] calldata signatures, uint256 expired)",
    ],
      wallet
    );
    const holdToken = new ethers.Contract(
      HOLD_TOKEN_ADDRESS,
      ["function approve(address spender, uint256 amount) public returns (bool)"],
      wallet
    );

    const approveTx1 = await holdToken.approve(FACTORY_ADDRESS, ethers.MaxUint256);
    await approveTx1.wait(1)
    const deploy1Tx = await factory.deployRWA(
      '100',
      business1Id,
      companyId,
      "company",
      wallet.address,
      signers1,
      signatureValues1,
      expired1,
      {
        gasLimit: 1200000,
        gasPrice: 1000000000,
      }
    );
    await deploy1Tx.wait(20);

    // Wait for backend to process
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Get first business address
    const business1Data = await makeGraphQLRequest(
      GET_BUSINESS,
      {
        id: business1Id,
      },
      accessToken
    );

    business1Address = business1Data.data.getBusiness.tokenAddress;

    // Create second business
    const business2Result = await makeGraphQLRequest(
      CREATE_BUSINESS,
      {
        input: {
          name: "Second Test Business",
          ownerId: companyId,
          ownerType: "company",
          chainId,
          description: "Another business for portfolio testing",
          tags: ["test", "portfolio"]
        },
      },
      accessToken
    );
    business2Id = business2Result.data.createBusiness.id;

    // Request signatures for second business
    const signatures2Result = await makeGraphQLRequest(
      REQUEST_BUSINESS_APPROVAL_SIGNATURES,
      {
        input: {
          id: business2Id,
          ownerWallet: wallet.address,
          deployerWallet: wallet.address,
          createRWAFee: "100"
        },
      },
      accessToken
    );

    // Wait for signatures
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Get signatures for second business
    const task2Result = await makeGraphQLRequest(
      GET_SIGNATURE_TASK,
      {
        input: {
          taskId: signatures2Result.data.requestBusinessApprovalSignatures.taskId,
        },
      },
      accessToken
    );

    const signatures2 = task2Result.data.getSignatureTask.signatures;
    const signers2 = signatures2.map((sig: any) => ethers.getAddress(sig.signer));
    const signatureValues2 = signatures2.map((sig: any) => sig.signature);
    const expired2 = task2Result.data.getSignatureTask.expired;

    // Deploy second business contract
    const deploy2Tx = await factory.deployRWA(
      '100',
      business2Id,
      companyId,
      "company",
      wallet.address,
      signers2,
      signatureValues2,
      expired2,
      {
        gasLimit: 1200000,
        gasPrice: 1000000000,
      }
    );
    await deploy2Tx.wait(20);

    // Wait for backend to process
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Get second business address
    const business2Data = await makeGraphQLRequest(
      GET_BUSINESS,
      {
        id: business2Id,
      },
      accessToken
    );
    business2Address = business2Data.data.getBusiness.tokenAddress;

    // Setup simple tranches configuration
    const setupTranches = (expectedHoldAmount: string, rewardPercent: string, entryPeriodExpired: number, completionPeriodExpired: number) => {
      // Single outgoing tranch with full amount
      const outgoingTranches = [{
        amount: expectedHoldAmount,
        timestamp: entryPeriodExpired + (7 * 86400),
        executedAmount: "0"
      }];

      // Single incoming tranch with full amount plus reward
      const totalExpectedIncoming = BigInt(expectedHoldAmount) + (BigInt(expectedHoldAmount) * BigInt(rewardPercent) / BigInt(10000));
      const incomingTranches = [{
        amount: totalExpectedIncoming.toString(),
        expiredAt: completionPeriodExpired,
        returnedAmount: "0"
      }];

      return { outgoingTranches, incomingTranches };
    };

    // Create first pool
    const now = Math.floor(Date.now() / 1000);
    const expectedHoldAmount = ethers.parseEther("15000").toString();
    const expectedRwaAmount = "100000"; // 100,000 RWA units

    // Entry period: 30 days
    const entryPeriodStart = now - 100;
    const entryPeriodExpired = entryPeriodStart + (30 * 86400);
    const completionPeriodExpired = entryPeriodExpired + (60 * 86400);

    const { outgoingTranches, incomingTranches } = setupTranches(expectedHoldAmount, "2000", entryPeriodExpired, completionPeriodExpired);

    const pool1Result = await makeGraphQLRequest(
      CREATE_POOL,
      {
        input: {
          name: "First Pool",
          ownerId: companyId,
          ownerType: "company",
          businessId: business1Id,
          rwaAddress: business1Address,
          chainId,
          description: "First business pool",
          tags: ["pool1", "test"],
          expectedHoldAmount,
          expectedRwaAmount,
          rewardPercent: "2000", // 20%
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
        },
      },
      accessToken
    );

    pool1Id = pool1Result.data.createPool.id;

    // Request pool signatures
    const poolSig1Result = await makeGraphQLRequest(
      REQUEST_POOL_APPROVAL_SIGNATURES,
      {
        input: {
          id: pool1Id,
          ownerWallet: wallet.address,
          deployerWallet: wallet.address,
          createPoolFeeRatio: "100"
        },
      },
      accessToken
    );

    // Wait for signatures
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Get pool data and signatures
    const pool1Data = await makeGraphQLRequest(
      GET_POOL,
      {
        id: pool1Id,
      },
      accessToken
    );

    const poolTask1Result = await makeGraphQLRequest(
      GET_SIGNATURE_TASK,
      {
        input: {
          taskId: poolSig1Result.data.requestPoolApprovalSignatures.taskId,
        },
      },
      accessToken
    );

    const poolSig1 = poolTask1Result.data.getSignatureTask.signatures;
    const poolSigners1 = poolSig1.map((sig: any) => ethers.getAddress(sig.signer));
    const poolSignatureValues1 = poolSig1.map((sig: any) => sig.signature);
    const poolExpired1 = poolTask1Result.data.getSignatureTask.expired;

    // Deploy first pool contract
    const pool1 = pool1Data.data.getPool;
    const deployPool1Tx = await factory.deployPool(
      '100',
      pool1Id,
      pool1.rwaAddress,
      BigInt(pool1.expectedHoldAmount),
      BigInt(pool1.expectedRwaAmount),
      BigInt(pool1.priceImpactPercent),
      BigInt(pool1.rewardPercent),
      BigInt(pool1.entryPeriodStart),
      BigInt(pool1.entryPeriodExpired),
      BigInt(pool1.completionPeriodExpired),
      BigInt(pool1.entryFeePercent),
      BigInt(pool1.exitFeePercent),
      pool1.fixedSell,
      pool1.allowEntryBurn,
      pool1.awaitCompletionExpired,
      pool1.floatingOutTranchesTimestamps,
      pool1.outgoingTranches.map(t => BigInt(t.amount)),
      pool1.outgoingTranches.map(t => BigInt(t.timestamp)),
      pool1.incomingTranches.map(t => BigInt(t.amount)),
      pool1.incomingTranches.map(t => BigInt(t.expiredAt)),
      poolSigners1,
      poolSignatureValues1,
      poolExpired1,
      {
        gasLimit: 2000000,
        gasPrice: 1000000000,
      }
    );

    // Create second pool
    const now2 = Math.floor(Date.now() / 1000);
    const expectedHoldAmount2 = ethers.parseEther("20000").toString();
    const expectedRwaAmount2 = "200000"; // 200,000 RWA units

    // Entry period: 30 days
    const entryPeriodStart2 = now2 - 100;
    const entryPeriodExpired2 = entryPeriodStart2 + (30 * 86400);
    const completionPeriodExpired2 = entryPeriodExpired2 + (60 * 86400);

    const tranches2 = setupTranches(expectedHoldAmount2, "2000", entryPeriodExpired2, completionPeriodExpired2);

    const pool2Result = await makeGraphQLRequest(
      CREATE_POOL,
      {
        input: {
          name: "Second Pool",
          ownerId: companyId,
          ownerType: "company",
          businessId: business2Id,
          rwaAddress: business2Address,
          chainId,
          description: "Second business first pool",
          tags: ["pool2", "test"],
          expectedHoldAmount: expectedHoldAmount2,
          expectedRwaAmount: expectedRwaAmount2,
          rewardPercent: "2000", // 20%
          priceImpactPercent: "101",
          entryFeePercent: "100",
          exitFeePercent: "100",
          entryPeriodStart: entryPeriodStart2,
          entryPeriodExpired: entryPeriodExpired2,
          completionPeriodExpired: completionPeriodExpired2,
          outgoingTranches: tranches2.outgoingTranches,
          incomingTranches: tranches2.incomingTranches,
          awaitCompletionExpired: true,
          floatingOutTranchesTimestamps: true,
          fixedSell: false,
          allowEntryBurn: true
        },
      },
      accessToken
    );
    pool2Id = pool2Result.data.createPool.id;

    // Request pool signatures
    const poolSig2Result = await makeGraphQLRequest(
      REQUEST_POOL_APPROVAL_SIGNATURES,
      {
        input: {
          id: pool2Id,
          ownerWallet: wallet.address,
          deployerWallet: wallet.address,
          createPoolFeeRatio: "100"
        },
      },
      accessToken
    );

    // Wait for signatures
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Get pool data and signatures
    const pool2Data = await makeGraphQLRequest(
      GET_POOL,
      {
        id: pool2Id,
      },
      accessToken
    );

    const poolTask2Result = await makeGraphQLRequest(
      GET_SIGNATURE_TASK,
      {
        input: {
          taskId: poolSig2Result.data.requestPoolApprovalSignatures.taskId,
        },
      },
      accessToken
    );

    const poolSig2 = poolTask2Result.data.getSignatureTask.signatures;
    const poolSigners2 = poolSig2.map((sig: any) => ethers.getAddress(sig.signer));
    const poolSignatureValues2 = poolSig2.map((sig: any) => sig.signature);
    const poolExpired2 = poolTask2Result.data.getSignatureTask.expired;

    // Deploy second pool contract
    const pool2 = pool2Data.data.getPool;
    const deployPool2Tx = await factory.deployPool(
      '100',
      pool2Id,
      pool2.rwaAddress,
      BigInt(pool2.expectedHoldAmount),
      BigInt(pool2.expectedRwaAmount),
      BigInt(pool2.priceImpactPercent),
      BigInt(pool2.rewardPercent),
      BigInt(pool2.entryPeriodStart),
      BigInt(pool2.entryPeriodExpired),
      BigInt(pool2.completionPeriodExpired),
      BigInt(pool2.entryFeePercent),
      BigInt(pool2.exitFeePercent),
      pool2.fixedSell,
      pool2.allowEntryBurn,
      pool2.awaitCompletionExpired,
      pool2.floatingOutTranchesTimestamps,
      pool2.outgoingTranches.map(t => BigInt(t.amount)),
      pool2.outgoingTranches.map(t => BigInt(t.timestamp)),
      pool2.incomingTranches.map(t => BigInt(t.amount)),
      pool2.incomingTranches.map(t => BigInt(t.expiredAt)),
      poolSigners2,
      poolSignatureValues2,
      poolExpired2,
      {
        gasLimit: 2000000,
        gasPrice: 1000000000,
      }
    );

    // Create third pool
    const now3 = Math.floor(Date.now() / 1000);
    const expectedHoldAmount3 = ethers.parseEther("30000").toString();
    const expectedRwaAmount3 = "300000"; // 300,000 RWA units

    // Entry period: 30 days
    const entryPeriodStart3 = now3 - 100;
    const entryPeriodExpired3 = entryPeriodStart3 + (30 * 86400);
    const completionPeriodExpired3 = entryPeriodExpired3 + (60 * 86400);

    const tranches3 = setupTranches(expectedHoldAmount3, "2000", entryPeriodExpired3, completionPeriodExpired3);

    const pool3Result = await makeGraphQLRequest(
      CREATE_POOL,
      {
        input: {
          name: "Third Pool",
          ownerId: companyId,
          ownerType: "company",
          businessId: business2Id,
          rwaAddress: business2Address,
          chainId,
          description: "Second business second pool",
          tags: ["pool3", "test"],
          expectedHoldAmount: expectedHoldAmount3,
          expectedRwaAmount: expectedRwaAmount3,
          rewardPercent: "2000", // 20%
          priceImpactPercent: "101",
          entryFeePercent: "100",
          exitFeePercent: "100",
          entryPeriodStart: entryPeriodStart3,
          entryPeriodExpired: entryPeriodExpired3,
          completionPeriodExpired: completionPeriodExpired3,
          outgoingTranches: tranches3.outgoingTranches,
          incomingTranches: tranches3.incomingTranches,
          awaitCompletionExpired: true,
          floatingOutTranchesTimestamps: true,
          fixedSell: false,
          allowEntryBurn: true
        },
      },
      accessToken
    );
    pool3Id = pool3Result.data.createPool.id;

    // Request pool signatures
    const poolSig3Result = await makeGraphQLRequest(
      REQUEST_POOL_APPROVAL_SIGNATURES,
      {
        input: {
          id: pool3Id,
          ownerWallet: wallet.address,
          deployerWallet: wallet.address,
          createPoolFeeRatio: "100"
        },
      },
      accessToken
    );

    // Wait for signatures
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Get pool data and signatures
    const pool3Data = await makeGraphQLRequest(
      GET_POOL,
      {
        id: pool3Id,
      },
      accessToken
    );

    const poolTask3Result = await makeGraphQLRequest(
      GET_SIGNATURE_TASK,
      {
        input: {
          taskId: poolSig3Result.data.requestPoolApprovalSignatures.taskId,
        },
      },
      accessToken
    );

    const poolSig3 = poolTask3Result.data.getSignatureTask.signatures;
    const poolSigners3 = poolSig3.map((sig: any) => ethers.getAddress(sig.signer));
    const poolSignatureValues3 = poolSig3.map((sig: any) => sig.signature);
    const poolExpired3 = poolTask3Result.data.getSignatureTask.expired;

    // Deploy third pool contract
    const pool3 = pool3Data.data.getPool;
    const deployPool3Tx = await factory.deployPool(
      '100',
      pool3Id,
      pool3.rwaAddress,
      BigInt(pool3.expectedHoldAmount),
      BigInt(pool3.expectedRwaAmount),
      BigInt(pool3.priceImpactPercent),
      BigInt(pool3.rewardPercent),
      BigInt(pool3.entryPeriodStart),
      BigInt(pool3.entryPeriodExpired),
      BigInt(pool3.completionPeriodExpired),
      BigInt(pool3.entryFeePercent),
      BigInt(pool3.exitFeePercent),
      pool3.fixedSell,
      pool3.allowEntryBurn,
      pool3.awaitCompletionExpired,
      pool3.floatingOutTranchesTimestamps,
      pool3.outgoingTranches.map(t => BigInt(t.amount)),
      pool3.outgoingTranches.map(t => BigInt(t.timestamp)),
      pool3.incomingTranches.map(t => BigInt(t.amount)),
      pool3.incomingTranches.map(t => BigInt(t.expiredAt)),
      poolSigners3,
      poolSignatureValues3,
      poolExpired3,
      {
        gasLimit: 2000000,
        gasPrice: 1000000000,
      }
    );
    await deployPool3Tx.wait(20);

    // Wait for backend to process
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Get pool addresses
    const [updatedPool1, updatedPool2, updatedPool3] = await Promise.all([
      makeGraphQLRequest(GET_POOL, { id: pool1Id }, accessToken),
      makeGraphQLRequest(GET_POOL, { id: pool2Id }, accessToken),
      makeGraphQLRequest(GET_POOL, { id: pool3Id }, accessToken),
    ]);

    pool1Address = updatedPool1.data.getPool.poolAddress;
    pool2Address = updatedPool2.data.getPool.poolAddress;
    pool3Address = updatedPool3.data.getPool.poolAddress;

    // Save deployment data to file
    const dataToSave = {
      chainId,
      business1Id,
      business2Id,
      business1Address,
      business2Address,
      pool1Id,
      pool2Id,
      pool3Id,
      pool1Address,
      pool2Address,
      pool3Address,
      ownerWallet: wallet.address,
      ownerPrivateKey: wallet.privateKey,
      accessToken,
      business1Data: updatedPool1.data.getBusiness,
      business2Data: updatedPool2.data.getBusiness,
      pool1Data: updatedPool1.data.getPool,
      pool2Data: updatedPool2.data.getPool,
      pool3Data: updatedPool3.data.getPool
    };

    await writeFile(portfolioDataPath, JSON.stringify(dataToSave, null, 2));
  });
});