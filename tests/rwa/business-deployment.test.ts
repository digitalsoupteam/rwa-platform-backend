import { expect, test, describe, beforeAll } from "bun:test";
import { ethers, HDNodeWallet, JsonRpcProvider } from "ethers";
import { FACTORY_ADDRESS, HOLD_TOKEN_ADDRESS, TESTNET_RPC } from "../utils/config";
import { makeGraphQLRequest } from "../utils/graphql/makeGraphQLRequest";
import { authenticate } from "../utils/authenticate";
import { CREATE_COMPANY } from "../utils/graphql/schema/company";
import {
  CREATE_BUSINESS,
  GET_BUSINESS,
  REQUEST_BUSINESS_APPROVAL_SIGNATURES,
} from "../utils/graphql/schema/rwa";
import { GET_SIGNATURE_TASK } from "../utils/graphql/schema/signers-manager";
import { requestHold, requestGas } from "../utils/requestTokens";
import { writeFile } from "fs/promises";
import { join } from "path";

describe("RWA Business Deployment", () => {
  let chainId: string;
  let provider: JsonRpcProvider;
  let wallet: HDNodeWallet;
  let accessToken: string;
  let userId: string;
  let companyId: string;
  let businessId: string;
  let businessApprovalSignaturesTaskId: string;

  // Путь к файлу с данными бизнеса
  const businessDataPath = join(__dirname, "business-data.json");

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
          name: "Test Company for RWA Business",
          description: "Test Description"
        },
      },
      accessToken
    );

    companyId = companyResult.data.createCompany.id;
  });

  test("should create and deploy business with data saving", async () => {
    // Create business
    const createResult = await makeGraphQLRequest(
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

    expect(createResult.errors).toBeUndefined();
    expect(createResult.data.createBusiness).toBeDefined();
    businessId = createResult.data.createBusiness.id;

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
    businessApprovalSignaturesTaskId = sigResult.data.requestBusinessApprovalSignatures.taskId;

    // Wait for signatures
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Get signatures
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
    expect(taskResult.data.getSignatureTask.completed).toBe(true);

    // Request tokens
    await requestHold(accessToken, 500);
    await requestGas(accessToken, 0.0035);
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

    // Get final business data
    const businessData = await makeGraphQLRequest(
      GET_BUSINESS,
      {
        id: businessId,
      },
      accessToken
    );

    expect(businessData.errors).toBeUndefined();
    expect(businessData.data.getBusiness.tokenAddress).toBeDefined();

    // Save business data to file
    const dataToSave = {
      businessId,
      companyId,
      tokenAddress: businessData.data.getBusiness.tokenAddress,
      ownerWallet: wallet.address,
      ownerPrivateKey: wallet.privateKey,
      accessToken,
      chainId,
      businessData: businessData.data.getBusiness
    };

    await writeFile(businessDataPath, JSON.stringify(dataToSave, null, 2));
  });
});