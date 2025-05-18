import { expect, test, describe, beforeAll } from "bun:test";
import { ethers, HDNodeWallet, JsonRpcProvider } from "ethers";
import { FACTORY_ADDRESS, HOLD_TOKEN_ADDRESS, TESTNET_RPC } from "./utils/config";
import { makeGraphQLRequest } from "./utils/graphql/makeGraphQLRequest";
import { authenticate } from "./utils/authenticate";
import { CREATE_COMPANY } from "./utils/graphql/schema/company";
import {
  CREATE_BUSINESS,
  EDIT_BUSINESS,
  GET_BUSINESS,
  GET_BUSINESSES,
  UPDATE_BUSINESS_RISK_SCORE,
  REQUEST_BUSINESS_APPROVAL_SIGNATURES,
  REJECT_BUSINESS_APPROVAL_SIGNATURES,
  CREATE_POOL,
  EDIT_POOL,
  GET_POOL,
  GET_POOLS,
  UPDATE_POOL_RISK_SCORE,
  REQUEST_POOL_APPROVAL_SIGNATURES,
  REJECT_POOL_APPROVAL_SIGNATURES,
} from "./utils/graphql/schema/rwa";
import { GET_SIGNATURE_TASK } from "./utils/graphql/schema/signers-manager";
import { requestHold, requestGas } from "./utils/requestTokens";

describe("RWA Flow", () => {
  let chainId: string;
  let provider: JsonRpcProvider;
  let wallet: HDNodeWallet;
  let wallet2: HDNodeWallet;
  let accessToken: string;
  let accessToken2: string;
  let userId: string;
  let companyId: string;
  let businessId: string;
  let poolId: string;
  let businessApprovalSignaturesTaskId: string;
  let poolApprovalSignaturesTaskId: string;

  beforeAll(async () => {
    chainId = "97";
    provider = new ethers.JsonRpcProvider(TESTNET_RPC);
    wallet = ethers.Wallet.createRandom().connect(provider);
    wallet2 = ethers.Wallet.createRandom().connect(provider);
    ({ accessToken, userId } = await authenticate(wallet));
    ({ accessToken: accessToken2 } = await authenticate(wallet2));

    // Create company for testing
    const companyResult = await makeGraphQLRequest(
      CREATE_COMPANY,
      {
        input: {
          name: "Test Company for RWA",
          description: "Test Description"
        },
      },
      accessToken
    );

    companyId = companyResult.data.createCompany.id;
  });
  //  test("should get business by id", async () => {

  //     const poolData = await makeGraphQLRequest(
  //       GET_POOL,
  //       {
  //         id: poolId,
  //       },
  //       accessToken
  //     );

  //     console.log(JSON.stringify(poolData,))
  //   });

  //   return


  describe("Business Operations", () => {
    test("should require authentication for creating business", async () => {
      const result = await makeGraphQLRequest(
        CREATE_BUSINESS,
        {
          input: {
            name: "Test Business",
            ownerId: companyId,
            ownerType: "company",
            chainId,
            description: "Test Description",
            tags: ["test"]
          },
        }
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });

    test("should create a business under company", async () => {
      const result = await makeGraphQLRequest(
        CREATE_BUSINESS,
        {
          input: {
            name: "Test Business",
            ownerId: companyId,
            ownerType: "company",
            chainId,
            description: "Test Description",
            tags: ["test"]
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.createBusiness).toBeDefined();
      expect(result.data.createBusiness.name).toBe("Test Business");
      expect(result.data.createBusiness.ownerId).toBe(companyId);
      expect(result.data.createBusiness.ownerType).toBe("company");
      expect(result.data.createBusiness.ownerWallet).toBeDefined();
      expect(result.data.createBusiness.chainId).toBe(chainId);
      expect(result.data.createBusiness.description).toBe("Test Description");
      expect(result.data.createBusiness.tags).toEqual(["test"]);

      businessId = result.data.createBusiness.id;
    });

    test("should get business by id", async () => {
      const result = await makeGraphQLRequest(
        GET_BUSINESS,
        {
          id: businessId,
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getBusiness).toBeDefined();
      expect(result.data.getBusiness.id).toBe(businessId);
      expect(result.data.getBusiness.name).toBe("Test Business");
      expect(result.data.getBusiness.ownerId).toBe(companyId);
      expect(result.data.getBusiness.ownerType).toBe("company");
      expect(result.data.getBusiness.ownerWallet).toBeDefined();
    });

    test("should get businesses with filter", async () => {
      const result = await makeGraphQLRequest(
        GET_BUSINESSES,
        {
          input: {
            filter: {
              ownerId: { $eq: companyId },
              ownerType: { $eq: "company" }
            },
          }
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getBusinesses).toBeDefined();
      expect(result.data.getBusinesses).toBeArray();
      expect(result.data.getBusinesses.length).toBeGreaterThan(0);
      expect(result.data.getBusinesses[0].ownerId).toBe(companyId);
      expect(result.data.getBusinesses[0].ownerType).toBe("company");
      expect(result.data.getBusinesses[0].ownerWallet).toBeDefined();
    });

    test("should edit business", async () => {
      const result = await makeGraphQLRequest(
        EDIT_BUSINESS,
        {
          input: {
            id: businessId,
            updateData: {
              name: "Coffee shop",
              description: "Demo Coffee shop",
              tags: ["coffee"]
            }
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.editBusiness).toBeDefined();
      expect(result.data.editBusiness.id).toBe(businessId);
      expect(result.data.editBusiness.name).toBe("Coffee shop");
      expect(result.data.editBusiness.description).toBe("Demo Coffee shop");
      expect(result.data.editBusiness.tags).toEqual(["coffee"]);
    });

    test("should update business risk score", async () => {
      const result = await makeGraphQLRequest(
        UPDATE_BUSINESS_RISK_SCORE,
        {
          id: businessId,
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.updateBusinessRiskScore).toBeDefined();
      expect(result.data.updateBusinessRiskScore.id).toBe(businessId);
      expect(result.data.updateBusinessRiskScore.riskScore).toBeDefined();
    });

    test("should deploy business contract", async () => {
      // Request signatures
      const sigResult = await makeGraphQLRequest(
        REQUEST_BUSINESS_APPROVAL_SIGNATURES,
        {
          input: {
            id: businessId,
            ownerWallet: wallet.address,
            deployerWallet: wallet.address,
            createRWAFee: "100"
          },
        },
        accessToken
      );

      expect(sigResult.errors).toBeUndefined();
      expect(sigResult.data.requestBusinessApprovalSignatures).toBeDefined();
      expect(sigResult.data.requestBusinessApprovalSignatures.taskId).toBeDefined();

      businessApprovalSignaturesTaskId = sigResult.data.requestBusinessApprovalSignatures.taskId;

      // Wait for signatures to be processed
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Get and verify signatures
      const taskResult = await makeGraphQLRequest(
        GET_SIGNATURE_TASK,
        {
          input: {
            taskId: businessApprovalSignaturesTaskId,
          },
        },
        accessToken
      );

      expect(taskResult.errors).toBeUndefined();
      expect(taskResult.data.getSignatureTask).toBeDefined();
      expect(taskResult.data.getSignatureTask.completed).toBe(true);
      expect(taskResult.data.getSignatureTask.signatures).toBeArray();
      expect(taskResult.data.getSignatureTask.signatures.length).toBeGreaterThan(0);

      // Request HOLD tokens and gas
      await requestHold(accessToken, 500);
      await requestGas(accessToken, 0.0035);

      // Wait for transactions to be mined
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Approve HOLD tokens
      const holdToken = new ethers.Contract(
        HOLD_TOKEN_ADDRESS,
        ["function approve(address spender, uint256 amount) public returns (bool)"],
        wallet
      );

      const approveTx = await holdToken.approve(
        FACTORY_ADDRESS,
        ethers.MaxUint256
      );
      await approveTx.wait();

      const signatures = taskResult.data.getSignatureTask.signatures;
      const signers = signatures.map((sig: any) => ethers.getAddress(sig.signer));
      const signatureValues = signatures.map((sig: any) => sig.signature);
      const expired = taskResult.data.getSignatureTask.expired;

      // Deploy RWA contract
      const factory = new ethers.Contract(
        FACTORY_ADDRESS,
        [
          "function deployRWA(uint256 createRWAFee, string calldata entityId, string calldata entityOwnerId, string calldata entityOwnerType, address owner, address[] calldata signers, bytes[] calldata signatures, uint256 expired)",
        ],
        wallet
      );

      const deployTx = await factory.deployRWA(
        '100',
        businessId,
        companyId,
        "company",
        wallet.address,
        signers,
        signatureValues,
        expired,
        {
          gasLimit: 1200000,
          gasPrice: 1000000000,
        }
      );
      await deployTx.wait(20);

      // Wait for backend to process the event
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Check if contract address was updated in backend
      const updatedBusiness = await makeGraphQLRequest(
        GET_BUSINESS,
        {
          id: businessId,
        },
        accessToken
      );

      expect(updatedBusiness.errors).toBeUndefined();
      expect(updatedBusiness.data.getBusiness.tokenAddress).toBeDefined();
      expect(updatedBusiness.data.getBusiness.tokenAddress).not.toBeNull();
      expect(updatedBusiness.data.getBusiness.tokenAddress).not.toBe("");

      tokenAddress = updatedBusiness.data.getBusiness.tokenAddress
    });
  });

  let tokenAddress: string;

  describe("Pool Operations", () => {
    test("should require authentication for creating pool", async () => {
      const result = await makeGraphQLRequest(
        CREATE_POOL,
        {
          input: {
            name: "Test Pool",
            ownerId: companyId,
            ownerType: "company",
            businessId,
            chainId,
            rwaAddress: tokenAddress
          },
        }
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });

    test("should create a pool under business", async () => {
      const result = await makeGraphQLRequest(
        CREATE_POOL,
        {
          input: {
            name: "Test Pool",
            ownerId: companyId,
            ownerType: "company",
            businessId,
            chainId,
            rwaAddress: tokenAddress
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.createPool).toBeDefined();
      expect(result.data.createPool.name).toBe("Test Pool");
      expect(result.data.createPool.ownerId).toBe(companyId);
      expect(result.data.createPool.ownerType).toBe("company");
      expect(result.data.createPool.businessId).toBe(businessId);
      expect(result.data.createPool.chainId).toBe(chainId);
      expect(result.data.createPool.rwaAddress).toBe(tokenAddress);

      poolId = result.data.createPool.id;
    });

    test("should get pool by id", async () => {
      const result = await makeGraphQLRequest(
        GET_POOL,
        {
          id: poolId,
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getPool).toBeDefined();
      expect(result.data.getPool.id).toBe(poolId);
      expect(result.data.getPool.name).toBe("Test Pool");
      expect(result.data.getPool.businessId).toBe(businessId);
    });

    test("should get pools with filter", async () => {
      const result = await makeGraphQLRequest(
        GET_POOLS,
        {
          input: {
            filter: {
              businessId: { $eq: businessId }
            },
          }
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getPools).toBeDefined();
      expect(result.data.getPools).toBeArray();
      expect(result.data.getPools.length).toBeGreaterThan(0);
      expect(result.data.getPools[0].businessId).toBe(businessId);
    });

    test("should edit pool", async () => {
      const now = Math.floor(Date.now() / 1000);
      const expectedHoldAmount = "10000000000000000000000"; // 10,000 USDT
      const expectedRwaAmount = "100000"; // 100,000 RWA units

      // Entry period: 30 days
      const entryPeriodStart = now + 86400; // 1 day from now
      const entryPeriodExpired = entryPeriodStart + (30 * 86400); // 30 days duration

      // Completion period: 60 days
      const completionPeriodExpired = entryPeriodExpired + (60 * 86400); // 60 days after entry period

      // 4 outgoing tranches, each 25% of expectedHoldAmount
      const outgoingTranchAmount = BigInt(expectedHoldAmount) / BigInt(4);
      const outgoingTranches = [
        {
          amount: outgoingTranchAmount.toString(),
          timestamp: entryPeriodExpired + (7 * 86400), // 7 days after entry period
          executedAmount: "0"
        },
        {
          amount: outgoingTranchAmount.toString(),
          timestamp: entryPeriodExpired + (14 * 86400), // 14 days after entry period
          executedAmount: "0"
        },
        {
          amount: outgoingTranchAmount.toString(),
          timestamp: entryPeriodExpired + (21 * 86400), // 21 days after entry period
          executedAmount: "0"
        },
        {
          amount: outgoingTranchAmount.toString(),
          timestamp: entryPeriodExpired + (28 * 86400), // 28 days after entry period
          executedAmount: "0"
        }
      ];

      // 20% reward
      const rewardPercent = "2000"; // 20%
      const totalExpectedIncoming = BigInt(expectedHoldAmount) + (BigInt(expectedHoldAmount) * BigInt(rewardPercent) / BigInt(10000));

      // 4 incoming tranches, each 25% of totalExpectedIncoming
      const incomingTranchAmount = totalExpectedIncoming / BigInt(4);
      const incomingTranches = [
        {
          amount: incomingTranchAmount.toString(),
          expiredAt: entryPeriodExpired + (30 * 86400), // 30 days after entry period
          returnedAmount: "0"
        },
        {
          amount: incomingTranchAmount.toString(),
          expiredAt: entryPeriodExpired + (40 * 86400), // 40 days after entry period
          returnedAmount: "0"
        },
        {
          amount: incomingTranchAmount.toString(),
          expiredAt: entryPeriodExpired + (50 * 86400), // 50 days after entry period
          returnedAmount: "0"
        },
        {
          amount: incomingTranchAmount.toString(),
          expiredAt: completionPeriodExpired, // At completion period end
          returnedAmount: "0"
        }
      ];

      const result = await makeGraphQLRequest(
        EDIT_POOL,
        {
          input: {
            id: poolId,
            updateData: {
              name: "Coffee Shop Pool Name",
              description: "New Coffee Pool Description",
              tags: ["coffee"],
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

      expect(result.errors).toBeUndefined();
      expect(result.data.editPool).toBeDefined();
      expect(result.data.editPool.id).toBe(poolId);
      expect(result.data.editPool.name).toBe("Coffee Shop Pool Name");
      expect(result.data.editPool.description).toBe("New Coffee Pool Description");
      expect(result.data.editPool.tags).toEqual(["coffee"]);
      expect(result.data.editPool.expectedHoldAmount).toBe(expectedHoldAmount);
      expect(result.data.editPool.expectedRwaAmount).toBe(expectedRwaAmount);
      expect(result.data.editPool.rewardPercent).toBe(rewardPercent);
      expect(result.data.editPool.priceImpactPercent).toBe("101");
      expect(result.data.editPool.entryFeePercent).toBe("100");
      expect(result.data.editPool.exitFeePercent).toBe("100");
      expect(result.data.editPool.entryPeriodStart).toBe(entryPeriodStart);
      expect(result.data.editPool.entryPeriodExpired).toBe(entryPeriodExpired);
      expect(result.data.editPool.completionPeriodExpired).toBe(completionPeriodExpired);
      expect(result.data.editPool.outgoingTranches).toBeArray();
      expect(result.data.editPool.outgoingTranches.length).toBe(4);
      expect(result.data.editPool.outgoingTranches[0].amount).toBe(outgoingTranches[0].amount);
      expect(result.data.editPool.outgoingTranches[0].timestamp).toBe(outgoingTranches[0].timestamp);
      expect(result.data.editPool.outgoingTranches[1].amount).toBe(outgoingTranches[1].amount);
      expect(result.data.editPool.outgoingTranches[1].timestamp).toBe(outgoingTranches[1].timestamp);
      expect(result.data.editPool.outgoingTranches[2].amount).toBe(outgoingTranches[2].amount);
      expect(result.data.editPool.outgoingTranches[2].timestamp).toBe(outgoingTranches[2].timestamp);
      expect(result.data.editPool.outgoingTranches[3].amount).toBe(outgoingTranches[3].amount);
      expect(result.data.editPool.outgoingTranches[3].timestamp).toBe(outgoingTranches[3].timestamp);
      expect(result.data.editPool.incomingTranches).toBeArray();
      expect(result.data.editPool.incomingTranches.length).toBe(4);
      expect(result.data.editPool.incomingTranches[0].amount).toBe(incomingTranches[0].amount);
      expect(result.data.editPool.incomingTranches[0].expiredAt).toBe(incomingTranches[0].expiredAt);
      expect(result.data.editPool.incomingTranches[1].amount).toBe(incomingTranches[1].amount);
      expect(result.data.editPool.incomingTranches[1].expiredAt).toBe(incomingTranches[1].expiredAt);
      expect(result.data.editPool.incomingTranches[2].amount).toBe(incomingTranches[2].amount);
      expect(result.data.editPool.incomingTranches[2].expiredAt).toBe(incomingTranches[2].expiredAt);
      expect(result.data.editPool.incomingTranches[3].amount).toBe(incomingTranches[3].amount);
      expect(result.data.editPool.incomingTranches[3].expiredAt).toBe(incomingTranches[3].expiredAt);
      expect(result.data.editPool.awaitCompletionExpired).toBe(true);
      expect(result.data.editPool.floatingOutTranchesTimestamps).toBe(true);
      expect(result.data.editPool.fixedSell).toBe(false);
      expect(result.data.editPool.allowEntryBurn).toBe(true);
    });

    test("should update pool risk score", async () => {
      const result = await makeGraphQLRequest(
        UPDATE_POOL_RISK_SCORE,
        {
          id: poolId,
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.updatePoolRiskScore).toBeDefined();
      expect(result.data.updatePoolRiskScore.id).toBe(poolId);
      expect(result.data.updatePoolRiskScore.riskScore).toBeDefined();
    });

    test("should deploy pool contract", async () => {
      // Request signatures
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
      expect(sigResult.data.requestPoolApprovalSignatures).toBeDefined();
      expect(sigResult.data.requestPoolApprovalSignatures.taskId).toBeDefined();

      poolApprovalSignaturesTaskId = sigResult.data.requestPoolApprovalSignatures.taskId;

      // Wait for signatures to be processed
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Get pool data and signatures from task
      const poolData = await makeGraphQLRequest(
        GET_POOL,
        {
          id: poolId,
        },
        accessToken
      );

      expect(poolData.errors).toBeUndefined();
      expect(poolData.data.getPool).toBeDefined();

      // Get signatures from task result
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
      expect(taskResult.data.getSignatureTask).toBeDefined();
      expect(taskResult.data.getSignatureTask.completed).toBe(true);

      const signatures = taskResult.data.getSignatureTask.signatures;
      const signers = signatures.map((sig: any) => ethers.getAddress(sig.signer));
      const signatureValues = signatures.map((sig: any) => sig.signature);
      const approvalSignaturesExpired = taskResult.data.getSignatureTask.expired;

      // Deploy pool contract
      const factory = new ethers.Contract(
        FACTORY_ADDRESS,
        [
          "function deployPool(uint256 createPoolFeeRatio, string calldata entityId, address rwa, uint256 expectedHoldAmount, uint256 expectedRwaAmount, uint256 priceImpactPercent, uint256 rewardPercent, uint256 entryPeriodStart, uint256 entryPeriodExpired, uint256 completionPeriodExpired, uint256 entryFeePercent, uint256 exitFeePercent, bool fixedSell, bool allowEntryBurn, bool awaitCompletionExpired, bool floatingOutTranchesTimestamps, uint256[] calldata outgoingTranches, uint256[] calldata outgoingTranchTimestamps, uint256[] calldata incomingTranches, uint256[] calldata incomingTrancheExpired, address[] calldata signers, bytes[] calldata signatures, uint256 expired)"
        ],
        wallet
      );

      const pool = poolData.data.getPool;
      const deployTx = await factory.deployPool(
        '100', // createPoolFeeRatio
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

      // Verify pool was deployed
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
    });
  });

  describe("Access Control Tests", () => {
    test("should not allow non-owner to create business under company", async () => {
      const result = await makeGraphQLRequest(
        CREATE_BUSINESS,
        {
          input: {
            name: "Unauthorized Business",
            ownerId: companyId,
            ownerType: "company",
            chainId,
            description: "Test Description",
            tags: ["test"]
          },
        },
        accessToken2
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("User does not have required company permissions");
    });

    test("should not allow non-owner to edit business", async () => {
      const result = await makeGraphQLRequest(
        EDIT_BUSINESS,
        {
          input: {
            id: businessId,
            updateData: {
              name: "Unauthorized Update",
            }
          },
        },
        accessToken2
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("User does not have required company permissions");
    });

    test("should not allow non-owner to create pool under business", async () => {
      const result = await makeGraphQLRequest(
        CREATE_POOL,
        {
          input: {
            name: "Unauthorized Pool",
            ownerId: companyId,
            ownerType: "company",
            businessId,
            chainId,
            rwaAddress: tokenAddress
          },
        },
        accessToken2
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("User does not have required company permissions");
    });

    test("should not allow non-owner to edit pool", async () => {
      const result = await makeGraphQLRequest(
        EDIT_POOL,
        {
          input: {
            id: poolId,
            updateData: {
              name: "Unauthorized Update",
            }
          },
        },
        accessToken2
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("User does not have required company permissions");
    });
  });

  // describe("Cleanup", () => {
  //   test("should reject pool approval signatures", async () => {
  //     const result = await makeGraphQLRequest(
  //       REJECT_POOL_APPROVAL_SIGNATURES,
  //       {
  //         id: poolId,
  //       },
  //       accessToken
  //     );

  //     expect(result.errors).toBeUndefined();
  //     expect(result.data.rejectPoolApprovalSignatures).toBe(true);
  //   });

  //   test("should reject business approval signatures", async () => {
  //     const result = await makeGraphQLRequest(
  //       REJECT_BUSINESS_APPROVAL_SIGNATURES,
  //       {
  //         id: businessId,
  //       },
  //       accessToken
  //     );

  //     expect(result.errors).toBeUndefined();
  //     expect(result.data.rejectBusinessApprovalSignatures).toBe(true);
  //   });
  // });
});