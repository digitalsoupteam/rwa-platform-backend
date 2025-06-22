import { expect, test, describe, beforeAll } from "bun:test";
import { ethers, HDNodeWallet, JsonRpcProvider } from "ethers";
import { FACTORY_ADDRESS, HOLD_TOKEN_ADDRESS, TESTNET_RPC } from "./utils/config";
import { makeGraphQLRequest } from "./utils/graphql/makeGraphQLRequest";
import { authenticate } from "./utils/authenticate";
import { CREATE_COMPANY } from "./utils/graphql/schema/company";
import {
  CREATE_BUSINESS_WITH_AI,
  GET_BUSINESS,
  REQUEST_BUSINESS_APPROVAL_SIGNATURES,
  CREATE_POOL_WITH_AI,
  GET_POOL,
  REQUEST_POOL_APPROVAL_SIGNATURES,
} from "./utils/graphql/schema/rwa";
import { GET_SIGNATURE_TASK } from "./utils/graphql/schema/signers-manager";
import { requestHold, requestGas } from "./utils/requestTokens";

describe("RWA AI Flow", () => {
  let chainId: string;
  let provider: JsonRpcProvider;
  let wallet: HDNodeWallet;
  let accessToken: string;
  let userId: string;
  let companyId: string;
  let businessId: string;
  let poolId: string;
  let businessApprovalSignaturesTaskId: string;
  let tokenAddress: string;

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
          name: "Test Company for RWA AI",
          description: "Test Description"
        },
      },
      accessToken
    );

    companyId = companyResult.data.createCompany.id;
  });

  describe("Business AI Creation", () => {
    test("should create a business using AI", async () => {
      const result = await makeGraphQLRequest(
        CREATE_BUSINESS_WITH_AI,
        {
          input: {
            description: "A coffee shop chain that operates in major cities. We serve premium coffee and pastries. Our business model includes both retail locations and a coffee bean subscription service. We have 5 locations and plan to expand to 15 more cities in the next year. Our revenue comes from in-store sales (60%), subscription service (30%), and corporate catering (10%).",
            ownerId: companyId,
            ownerType: "company",
            chainId,
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.createBusinessWithAI).toBeDefined();
      expect(result.data.createBusinessWithAI.name).toBeDefined();
      expect(result.data.createBusinessWithAI.ownerId).toBe(companyId);
      expect(result.data.createBusinessWithAI.ownerType).toBe("company");
      expect(result.data.createBusinessWithAI.chainId).toBe(chainId);
      expect(result.data.createBusinessWithAI.description).toBeDefined();
      expect(result.data.createBusinessWithAI.tags).toBeArray();
      expect(result.data.createBusinessWithAI.tags.length).toBeGreaterThan(0);

      businessId = result.data.createBusinessWithAI.id;
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

      tokenAddress = updatedBusiness.data.getBusiness.tokenAddress;
    });
  });

  describe("Pool AI Creation", () => {
    test("should create a pool using AI", async () => {
      const result = await makeGraphQLRequest(
        CREATE_POOL_WITH_AI,
        {
          input: {
            description: "Investment pool for our coffee shop expansion. We're looking to raise 100,000 HOLD tokens to open 3 new locations. The investment period is 30 days, with a 20% reward for investors. Returns will be made quarterly over 1 year from our revenue stream. Each location generates approximately 10,000 HOLD tokens in monthly revenue.",
            businessId,
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.createPoolWithAI).toBeDefined();
      expect(result.data.createPoolWithAI.name).toBeDefined();
      expect(result.data.createPoolWithAI.businessId).toBe(businessId);
      expect(result.data.createPoolWithAI.description).toBeDefined();
      expect(result.data.createPoolWithAI.tags).toBeArray();
      expect(result.data.createPoolWithAI.tags.length).toBeGreaterThan(0);

      // Check pool configuration
      expect(result.data.createPoolWithAI.expectedHoldAmount).toBeDefined();
      expect(result.data.createPoolWithAI.expectedRwaAmount).toBeDefined();
      expect(result.data.createPoolWithAI.rewardPercent).toBeDefined();
      expect(result.data.createPoolWithAI.entryFeePercent).toBeDefined();
      expect(result.data.createPoolWithAI.exitFeePercent).toBeDefined();
      expect(result.data.createPoolWithAI.priceImpactPercent).toBeDefined();

      // Check time periods
      expect(result.data.createPoolWithAI.entryPeriodStart).toBeDefined();
      expect(result.data.createPoolWithAI.entryPeriodExpired).toBeDefined();
      expect(result.data.createPoolWithAI.completionPeriodExpired).toBeDefined();

      // Check tranches
      expect(result.data.createPoolWithAI.outgoingTranches).toBeArray();
      expect(result.data.createPoolWithAI.outgoingTranches.length).toBeGreaterThan(0);
      expect(result.data.createPoolWithAI.incomingTranches).toBeArray();
      expect(result.data.createPoolWithAI.incomingTranches.length).toBeGreaterThan(0);

      poolId = result.data.createPoolWithAI.id;

      // Verify tranche structure
      const outgoingTranche = result.data.createPoolWithAI.outgoingTranches[0];
      expect(outgoingTranche.amount).toBeDefined();
      expect(outgoingTranche.timestamp).toBeDefined();
      expect(outgoingTranche.executedAmount).toBeDefined();

      const incomingTranche = result.data.createPoolWithAI.incomingTranches[0];
      expect(incomingTranche.amount).toBeDefined();
      expect(incomingTranche.expiredAt).toBeDefined();
      expect(incomingTranche.returnedAmount).toBeDefined();
    });
  });
});