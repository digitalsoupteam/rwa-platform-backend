import { expect, test, describe, beforeAll } from "bun:test";
import { ethers, HDNodeWallet, JsonRpcProvider } from "ethers";
import { FACTORY_ADDRESS, HOLD_TOKEN_ADDRESS, TESTNET_RPC } from "./utils/config";
import { makeGraphQLRequest } from "./utils/graphql/makeGraphQLRequest";
import { authenticate } from "./utils/authenticate";
import {
  CREATE_BUSINESS,
  UPDATE_BUSINESS,
  UPDATE_BUSINESS_RISK_SCORE,
  REQUEST_BUSINESS_APPROVAL_SIGNATURES,
  GET_BUSINESS,
  GET_BUSINESSES_BY_OWNER,
  GET_DEPLOYED_BUSINESSES,
  CREATE_POOL,
  UPDATE_POOL,
  UPDATE_POOL_RISK_SCORE,
  REQUEST_POOL_APPROVAL_SIGNATURES,
  GET_POOL,
  GET_POOLS_BY_OWNER,
  GET_DEPLOYED_POOLS,
} from "./utils/graphql/schema/legacy_rwa";
import { GET_SIGNATURE_TASK } from "./utils/graphql/schema/signers-manager";
import { requestGas, requestHold } from "./utils/requestTokens";

describe("RWA Business & Pool Flow", () => {
  let chainId: string;
  let provider: JsonRpcProvider;
  let wallet: HDNodeWallet;
  let wallet2: HDNodeWallet;
  let accessToken: string;
  let accessToken2: string;
  let userId: string;
  let businessId: string;
  let poolId: string;

  // test('1', async () => {
  //   const result1 = await makeGraphQLRequest(
  //     GET_POOL,
  //     {
  //       input: {
  //         id: '6806e060788a53c3877e969f',
  //       },
  //     }
  //   );

  //   console.log(result1)

  //   const result = await makeGraphQLRequest(
  //     GET_DEPLOYED_POOLS,
  //     {
  //       input: {
  //         chainId: '97',
  //         // owner: '6806dc62cdbbeba1ed9d7d3c'
  //       },
  //     }
  //   );

  //   expect(result.errors).toBeUndefined();
  //   expect(result.data.getDeployedPools).toBeDefined();
  //   expect(result.data.getDeployedPools).toBeArray();
  //   expect(result.data.getDeployedPools.length).toBeGreaterThan(0);
  //   expect(result.data.getDeployedPools[0].id).toBe(poolId);
  // })

  // return

  beforeAll(async () => {
    chainId = "97";
    provider = new ethers.JsonRpcProvider(TESTNET_RPC);
    wallet = ethers.Wallet.createRandom().connect(provider);
    wallet2 = ethers.Wallet.createRandom().connect(provider);
    ({ accessToken, userId } = await authenticate(wallet));
    ({ accessToken: accessToken2 } = await authenticate(wallet2));
  });

  describe("Business Flow", () => {
    test("should require authentication for creating business", async () => {
      const result = await makeGraphQLRequest(
        CREATE_BUSINESS,
        {
          input: {
            name: "Test Business",
            chainId,
          },
        }
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });

    test("should create business", async () => {
      const result = await makeGraphQLRequest(
        CREATE_BUSINESS,
        {
          input: {
            name: "RWA Test Business",
            chainId,
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.createBusiness).toBeDefined();
      expect(result.data.createBusiness.name).toBe("RWA Test Business");
      expect(result.data.createBusiness.owner).toBe(userId);
      expect(result.data.createBusiness.chainId).toBe(chainId);

      businessId = result.data.createBusiness.id;
    });

    test("should get business", async () => {
      const result = await makeGraphQLRequest(
        GET_BUSINESS,
        {
          input: {
            id: businessId,
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getBusiness).toBeDefined();
      expect(result.data.getBusiness.id).toBe(businessId);
    });

    test("should get businesses by owner", async () => {
      const result = await makeGraphQLRequest(
        GET_BUSINESSES_BY_OWNER,
        {
          input: {
            chainId,
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getBusinessesByOwner).toBeDefined();
      expect(result.data.getBusinessesByOwner).toBeArray();
      expect(result.data.getBusinessesByOwner.length).toBeGreaterThan(0);
    });

    test("should get empty deployed businesses initially", async () => {
      const result = await makeGraphQLRequest(
        GET_DEPLOYED_BUSINESSES,
        {
          input: {
            chainId,
            owner: userId
          },
        }
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getDeployedBusinesses).toBeDefined();
      expect(result.data.getDeployedBusinesses).toBeArray();
      expect(result.data.getDeployedBusinesses.length).toBe(0);
    });

    test("should update business ", async () => {
      const updateData = {
        id: businessId,
        name: "Updated Business",
        description: "Test description",
        tags: ["rwa", "test"],
        image: "https://example.com/image.png",
      };

      const result = await makeGraphQLRequest(
        UPDATE_BUSINESS,
        {
          input: updateData,
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.updateBusiness).toBeDefined();
      expect(result.data.updateBusiness.name).toBe(updateData.name);
      expect(result.data.updateBusiness.description).toBe(updateData.description);
      expect(result.data.updateBusiness.tags).toEqual(updateData.tags);
      expect(result.data.updateBusiness.image).toBe(updateData.image);
    });

    test("should not allow non-owner to update business", async () => {
      const result = await makeGraphQLRequest(
        UPDATE_BUSINESS,
        {
          input: {
            id: businessId,
            name: "Hacked Business",
          },
        },
        accessToken2
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Not authorized to update this business");
    });

    test("should update business risk score", async () => {
      const result = await makeGraphQLRequest(
        UPDATE_BUSINESS_RISK_SCORE,
        {
          input: {
            id: businessId,
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.updateBusinessRiskScore).toBeDefined();
      expect(result.data.updateBusinessRiskScore.id).toBe(businessId);
      expect(typeof result.data.updateBusinessRiskScore.riskScore).toBe("number");
    });

    test("should request business approval signatures", async () => {
      // Request signatures
      const result = await makeGraphQLRequest(
        REQUEST_BUSINESS_APPROVAL_SIGNATURES,
        {
          input: {
            id: businessId,
            userWallet: wallet.address,
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.requestBusinessApprovalSignatures).toBeDefined();
      expect(result.data.requestBusinessApprovalSignatures.taskId).toBeDefined();

      // Wait for signatures to be processed
      await new Promise((resolve) => setTimeout(resolve, 10000));

      // Get and verify signatures
      const taskResult = await makeGraphQLRequest(
        GET_SIGNATURE_TASK,
        {
          input: {
            taskId: result.data.requestBusinessApprovalSignatures.taskId,
          },
        },
        accessToken
      );

      console.log(taskResult.data.getSignatureTask)

      expect(taskResult.errors).toBeUndefined();
      expect(taskResult.data.getSignatureTask).toBeDefined();
      expect(taskResult.data.getSignatureTask.completed).toBe(true);
      expect(taskResult.data.getSignatureTask.signatures).toBeArray();
      expect(taskResult.data.getSignatureTask.signatures.length).toBeGreaterThan(0);

      // Verify each signature
      const signatures = taskResult.data.getSignatureTask.signatures;
      for (const sig of signatures) {
        const recoveredAddress = ethers.verifyMessage(
          ethers.getBytes(ethers.solidityPackedKeccak256(
            ['bytes', 'uint256'], 
            [
              taskResult.data.getSignatureTask.hash, 
              taskResult.data.getSignatureTask.expired,
            ])),
          sig.signature
        );
        expect(recoveredAddress.toLowerCase()).toBe(sig.signer.toLowerCase());
      }
    });

   
    test("should deploy RWA contract", async () => {
      // Request HOLD tokens and gas
      await requestHold(accessToken, 500);
      await requestGas(accessToken, 0.0025);

      // Wait for transactions to be mined
      await new Promise((resolve) => setTimeout(resolve, 10000));

      // Approve HOLD tokens
      const holdToken = new ethers.Contract(
        HOLD_TOKEN_ADDRESS,
        [
          "function approve(address spender, uint256 amount) public returns (bool)",
        ],
        wallet
      );

      const approveTx = await holdToken.approve(
        FACTORY_ADDRESS,
        ethers.MaxUint256
      );
      await approveTx.wait();

      // Get business data to get signatures
      const businessData = await makeGraphQLRequest(
        GET_BUSINESS,
        {
          input: {
            id: businessId,
          },
        },
        accessToken
      );

      console.log(businessData)

      // Get signatures from task result
      const taskResult = await makeGraphQLRequest(
        GET_SIGNATURE_TASK,
        {
          input: {
            taskId: businessData.data.getBusiness.approvalSignaturesTaskId,
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
      const expired = taskResult.data.getSignatureTask.expired;

      // Deploy RWA contract
      const factory = new ethers.Contract(
        FACTORY_ADDRESS,
        [
          "function deployRWA(string calldata entityId, address[] calldata signers, bytes[] calldata signatures, uint256 expired)",
        ],
        wallet
      );

      const deployTx = await factory.deployRWA(
        businessId,
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
          input: {
            id: businessId,
          },
        },
        accessToken
      );

      expect(updatedBusiness.errors).toBeUndefined();
      expect(updatedBusiness.data.getBusiness.tokenAddress).toBeDefined();
      expect(updatedBusiness.data.getBusiness.tokenAddress).not.toBeNull();
      expect(updatedBusiness.data.getBusiness.tokenAddress).not.toBe("");
    });

    test("should get deployed businesses after contract deployment", async () => {
      const result = await makeGraphQLRequest(
        GET_DEPLOYED_BUSINESSES,
        {
          input: {
            chainId,
            owner: userId
          },
        }
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getDeployedBusinesses).toBeDefined();
      expect(result.data.getDeployedBusinesses).toBeArray();
      expect(result.data.getDeployedBusinesses.length).toBeGreaterThan(0);
      expect(result.data.getDeployedBusinesses[0].id).toBe(businessId);
    });
  });

  describe("Pool Flow", () => {
    test("should require authentication for creating pool", async () => {
      const result = await makeGraphQLRequest(
        CREATE_POOL,
        {
          input: {
            businessId: "some-business-id",
          },
        }
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });

    test("should create pool", async () => {
      const result = await makeGraphQLRequest(
        CREATE_POOL,
        {
          input: {
            businessId,
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.createPool).toBeDefined();
      expect(result.data.createPool.businessId).toBe(businessId);
      expect(result.data.createPool.owner).toBe(userId);

      poolId = result.data.createPool.id;
    });

    test("should get pool ", async () => {
      const result = await makeGraphQLRequest(
        GET_POOL,
        {
          input: {
            id: poolId,
          },
        }
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getPool).toBeDefined();
      expect(result.data.getPool.id).toBe(poolId);
    });

    test("should get pools by owner", async () => {
      const result = await makeGraphQLRequest(
        GET_POOLS_BY_OWNER,
        {
          input: {
            chainId,
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getPoolsByOwner).toBeDefined();
      expect(result.data.getPoolsByOwner).toBeArray();
      expect(result.data.getPoolsByOwner.length).toBeGreaterThan(0);
    });


    test("should get empty deployed pools initially", async () => {
      const result = await makeGraphQLRequest(
        GET_DEPLOYED_POOLS,
        {
          input: {
            chainId,
            owner: userId
          },
        }
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getDeployedPools).toBeDefined();
      expect(result.data.getDeployedPools).toBeArray();
      expect(result.data.getDeployedPools.length).toBe(0);
    });

    test("should update pool ", async () => {
      const updateData = {
        id: poolId,
        description: "Test pool description",
        tags: ["pool", "test"],
        targetAmount: ethers.parseEther("15000").toString(),
        profitPercent: "500",
        investmentDuration: `${1 * 60 *60}`, 
        realiseDuration: `${2 * 60 *60}`,
        speculationsEnabled: true,
      };

      const result = await makeGraphQLRequest(
        UPDATE_POOL,
        {
          input: updateData,
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.updatePool).toBeDefined();
      expect(result.data.updatePool.description).toBe(updateData.description);
      expect(result.data.updatePool.tags).toEqual(updateData.tags);
      expect(result.data.updatePool.buyFeePercent).toEqual(null);
      expect(result.data.updatePool.sellFeePercent).toEqual(null);
      expect(result.data.updatePool.targetAmount).toBe(updateData.targetAmount);
      expect(result.data.updatePool.profitPercent).toBe(updateData.profitPercent);
      expect(result.data.updatePool.investmentDuration).toBe(updateData.investmentDuration);
      expect(result.data.updatePool.realiseDuration).toBe(updateData.realiseDuration);
      expect(result.data.updatePool.speculationsEnabled).toBe(updateData.speculationsEnabled);
    });

    test("should not allow non-owner to update pool", async () => {
      const result = await makeGraphQLRequest(
        UPDATE_POOL,
        {
          input: {
            id: poolId,
            description: "Hacked pool",
          },
        },
        accessToken2
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Not authorized to update this pool");
    });

    test("should update pool risk score", async () => {
      const result = await makeGraphQLRequest(
        UPDATE_POOL_RISK_SCORE,
        {
          input: {
            id: poolId,
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.updatePoolRiskScore).toBeDefined();
      expect(result.data.updatePoolRiskScore.id).toBe(poolId);
      expect(typeof result.data.updatePoolRiskScore.riskScore).toBe("number");
    });

    test("should request pool approval signatures", async () => {
      // Request signatures
      const result = await makeGraphQLRequest(
        REQUEST_POOL_APPROVAL_SIGNATURES,
        {
          input: {
            id: poolId,
            userWallet: wallet.address,
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.requestPoolApprovalSignatures).toBeDefined();
      expect(result.data.requestPoolApprovalSignatures.taskId).toBeDefined();

      // Wait for signatures to be processed
      await new Promise((resolve) => setTimeout(resolve, 10000));

      // Get and verify signatures
      const taskResult = await makeGraphQLRequest(
        GET_SIGNATURE_TASK,
        {
          input: {
            taskId: result.data.requestPoolApprovalSignatures.taskId,
          },
        },
        accessToken
      );

      console.log(taskResult.data.getSignatureTask)

      expect(taskResult.errors).toBeUndefined();
      expect(taskResult.data.getSignatureTask).toBeDefined();
      expect(taskResult.data.getSignatureTask.completed).toBe(true);
      expect(taskResult.data.getSignatureTask.signatures).toBeArray();
      expect(taskResult.data.getSignatureTask.signatures.length).toBeGreaterThan(0);

      // Verify each signature
      const signatures = taskResult.data.getSignatureTask.signatures;
      for (const sig of signatures) {
        const recoveredAddress = ethers.verifyMessage(
          ethers.getBytes(ethers.solidityPackedKeccak256(
            ['bytes', 'uint256'],
            [
              taskResult.data.getSignatureTask.hash,
              taskResult.data.getSignatureTask.expired,
            ])),
          sig.signature
        );
        expect(recoveredAddress.toLowerCase()).toBe(sig.signer.toLowerCase());
      }
    });
    
    test("should get deployed pools after contract deployment", async () => {
      // // Request HOLD tokens and gas
      // await requestHold(accessToken, 500);
      // await requestGas(accessToken, 0.0025);

      // // Wait for transactions to be mined
      // await new Promise((resolve) => setTimeout(resolve, 10000));

      // // Approve HOLD tokens
      // const holdToken = new ethers.Contract(
      //   HOLD_TOKEN_ADDRESS,
      //   ["function approve(address spender, uint256 amount) public returns (bool)"],
      //   wallet
      // );
      // const approveTx = await holdToken.approve(FACTORY_ADDRESS, ethers.MaxUint256);
      // await approveTx.wait(1);

      // Get pool data and signatures from task
      const poolData = await makeGraphQLRequest(
        GET_POOL,
        {
          input: {
            id: poolId,
          },
        },
        accessToken
      );

      // Get signatures from task result
      const taskResult = await makeGraphQLRequest(
        GET_SIGNATURE_TASK,
        {
          input: {
            taskId: poolData.data.getPool.approvalSignaturesTaskId,
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
          "function deployPool(string memory entityId, address rwa, uint256 targetAmount, uint256 profitPercent, uint256 investmentDuration, uint256 realiseDuration, bool speculationsEnabled, address[] calldata signers, bytes[] calldata signatures, uint256 expired)"
        ],
        wallet
      );

      const pool = poolData.data.getPool;
      const deployTx = await factory.deployPool(
        poolId,
        pool.rwaAddress,
        BigInt(pool.targetAmount),
        BigInt(pool.profitPercent),
        BigInt(pool.investmentDuration),
        BigInt(pool.realiseDuration),
        pool.speculationsEnabled,
        signers,
        signatureValues,
        approvalSignaturesExpired,
        {
          gasLimit: 1200000,
          gasPrice: 1000000000,
        }
      );
      await deployTx.wait(20);

      // Wait for backend to process the event
      await new Promise((resolve) => setTimeout(resolve, 10000));

      const result = await makeGraphQLRequest(
        GET_DEPLOYED_POOLS,
        {
          input: {
            chainId,
            owner: userId
          },
        }
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getDeployedPools).toBeDefined();
      expect(result.data.getDeployedPools).toBeArray();
      expect(result.data.getDeployedPools.length).toBeGreaterThan(0);
      expect(result.data.getDeployedPools[0].id).toBe(poolId);
    });
  });
});