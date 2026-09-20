import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { ethers, HDNodeWallet, JsonRpcProvider } from "ethers";
import { FACTORY_ADDRESS, HOLD_TOKEN_ADDRESS, TESTNET_RPC } from "./utils/config";
import { makeGraphQLRequest } from "./utils/graphql/makeGraphQLRequest";
import { authenticate } from "./utils/authenticate";
import { createWebhookTestServer } from "./utils/webhook-test-server";
import { CREATE_COMPANY } from "./utils/graphql/schema/company";
import {
  CREATE_BUSINESS,
  GET_BUSINESS,
  REQUEST_BUSINESS_APPROVAL_SIGNATURES,
} from "./utils/graphql/schema/rwa";
import { GET_SIGNATURE_TASK } from "./utils/graphql/schema/signers-manager";
import { requestHold, requestGas } from "./utils/requestTokens";
import {
  CREATE_WEBHOOK_ENDPOINT,
  DELETE_WEBHOOK_ENDPOINT,
  GET_WEBHOOK_ENDPOINT,
  UPDATE_WEBHOOK_ENDPOINT,
} from "./utils/graphql/schema/webhooks";

describe("Webhooks E2E — Business Deployment", () => {
  let chainId: string;
  let provider: JsonRpcProvider;
  let wallet: HDNodeWallet;
  let wallet2: HDNodeWallet;
  let accessToken: string;
  let accessToken2: string;
  let userId: string;
  let companyId: string;
  let businessId: string;
  let businessApprovalSignaturesTaskId: string;
  let endpointId: string;
  let webhookServer: ReturnType<typeof createWebhookTestServer>;

  beforeAll(async () => {
    chainId = "97";
    provider = new ethers.JsonRpcProvider(TESTNET_RPC);
    wallet = ethers.Wallet.createRandom().connect(provider);
    wallet2 = ethers.Wallet.createRandom().connect(provider);
    ({ accessToken, userId } = await authenticate(wallet));
    ({ accessToken: accessToken2 } = await authenticate(wallet2));

    // Create company
    const companyResult = await makeGraphQLRequest(
      CREATE_COMPANY,
      {
        input: {
          name: "Test Company for Webhook E2E",
          description: "Test Description",
        },
      },
      accessToken
    );
    companyId = companyResult.data.createCompany.id;

    // Start webhook test server
    webhookServer = createWebhookTestServer();
    await webhookServer.start();
  });

  afterAll(() => {
    webhookServer.stop();
  });

  test("should create webhook endpoint for business.created", async () => {
    const result = await makeGraphQLRequest(
      CREATE_WEBHOOK_ENDPOINT,
      {
        input: {
          url: webhookServer.getUrl(),
          events: ["business.created"],
          description: "E2E test webhook",
        },
      },
      accessToken
    );

    expect(result.errors).toBeUndefined();
    expect(result.data.createWebhookEndpoint).toBeDefined();
    expect(result.data.createWebhookEndpoint.url).toBe(webhookServer.getUrl());
    expect(result.data.createWebhookEndpoint.events).toEqual(["business.created"]);
    expect(result.data.createWebhookEndpoint.secret).toBeDefined();

    endpointId = result.data.createWebhookEndpoint.id;
  });

  test("should create a business under company", async () => {
    const result = await makeGraphQLRequest(
      CREATE_BUSINESS,
      {
        input: {
          name: "Webhook Test Business",
          ownerId: companyId,
          ownerType: "company",
          chainId,
          description: "Business for webhook delivery test",
          tags: ["webhook-test"],
        },
      },
      accessToken
    );

    expect(result.errors).toBeUndefined();
    expect(result.data.createBusiness).toBeDefined();
    expect(result.data.createBusiness.name).toBe("Webhook Test Business");

    businessId = result.data.createBusiness.id;
  });

  test("should deploy business contract and receive webhook", async () => {
    // Request signatures
    const sigResult = await makeGraphQLRequest(
      REQUEST_BUSINESS_APPROVAL_SIGNATURES,
      {
        input: {
          id: businessId,
          ownerWallet: wallet.address,
          deployerWallet: wallet.address,
          createRWAFee: "100",
        },
      },
      accessToken
    );

    expect(sigResult.errors).toBeUndefined();
    expect(sigResult.data.requestBusinessApprovalSignatures).toBeDefined();
    expect(sigResult.data.requestBusinessApprovalSignatures.taskId).toBeDefined();

    businessApprovalSignaturesTaskId = sigResult.data.requestBusinessApprovalSignatures.taskId;

    // Wait for signatures to be processed
    await new Promise((resolve) => setTimeout(resolve, 10000));

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
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Approve HOLD tokens
    const holdToken = new ethers.Contract(
      HOLD_TOKEN_ADDRESS,
      ["function approve(address spender, uint256 amount) public returns (bool)"],
      wallet
    );

    const approveTx = await holdToken.approve(FACTORY_ADDRESS, ethers.MaxUint256);
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
      "100",
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

    // Wait for backend to process the event and deliver webhook
    await new Promise((resolve) => setTimeout(resolve, 15000));

    // Verify business was deployed
    const updatedBusiness = await makeGraphQLRequest(
      GET_BUSINESS,
      { id: businessId },
      accessToken
    );

    expect(updatedBusiness.errors).toBeUndefined();
    expect(updatedBusiness.data.getBusiness.tokenAddress).toBeDefined();
    expect(updatedBusiness.data.getBusiness.tokenAddress).not.toBeNull();
    expect(updatedBusiness.data.getBusiness.tokenAddress).not.toBe("");

    // Verify webhook was delivered
    const deliveries = webhookServer.getDeliveries();
    expect(deliveries.length).toBeGreaterThan(0);

    const delivery = deliveries[0];
    expect(delivery.body).toBeDefined();
    expect((delivery.body as any).businessId).toBe(businessId);
    expect((delivery.body as any).tokenAddress).toBe(updatedBusiness.data.getBusiness.tokenAddress);
    expect((delivery.body as any).ownerId).toBe(companyId);
    expect((delivery.body as any).ownerType).toBe("company");

    // Verify webhook headers
    expect(delivery.headers["x-webhook-id"]).toBeDefined();
    expect(delivery.headers["x-webhook-timestamp"]).toBeDefined();
    expect(delivery.headers["x-webhook-signature"]).toBeDefined();
    expect(delivery.headers["x-webhook-signature"]).toMatch(/^sha256=/);
    expect(delivery.headers["content-type"]).toBe("application/json");
  });

  test("should not allow other user to access webhook endpoint by id", async () => {
    // Create a dedicated endpoint owned by the first user so this test is self-sufficient
    const idorEndpointUrl = "https://example.com/e2e-idor-webhook";

    const createResult = await makeGraphQLRequest(
      CREATE_WEBHOOK_ENDPOINT,
      {
        input: {
          url: idorEndpointUrl,
          events: ["pool.created"],
          description: "IDOR test webhook",
        },
      },
      accessToken
    );

    expect(createResult.errors).toBeUndefined();
    expect(createResult.data.createWebhookEndpoint).toBeDefined();

    const idorEndpointId = createResult.data.createWebhookEndpoint.id;

    // Try to get the endpoint as a second user
    const getResult = await makeGraphQLRequest(
      GET_WEBHOOK_ENDPOINT,
      { id: idorEndpointId },
      accessToken2
    );

    expect(getResult.errors).toBeDefined();
    expect(getResult.errors[0].message).toContain("not found");

    // Try to update it as a second user
    const updateResult = await makeGraphQLRequest(
      UPDATE_WEBHOOK_ENDPOINT,
      {
        input: {
          id: idorEndpointId,
          url: "https://example.com/hijacked-webhook",
          events: ["pool.burned"],
          active: false,
        },
      },
      accessToken2
    );

    expect(updateResult.errors).toBeDefined();
    expect(updateResult.errors[0].message).toContain("not found");

    // Try to delete it as a second user
    const deleteResult = await makeGraphQLRequest(
      DELETE_WEBHOOK_ENDPOINT,
      { id: idorEndpointId },
      accessToken2
    );

    expect(deleteResult.errors).toBeDefined();
    expect(deleteResult.errors[0].message).toContain("not found");

    // Owner still sees the endpoint unchanged
    const ownerResult = await makeGraphQLRequest(
      GET_WEBHOOK_ENDPOINT,
      { id: idorEndpointId },
      accessToken
    );

    expect(ownerResult.errors).toBeUndefined();
    expect(ownerResult.data.getWebhookEndpoint.id).toBe(idorEndpointId);
    expect(ownerResult.data.getWebhookEndpoint.url).toBe(idorEndpointUrl);
    expect(ownerResult.data.getWebhookEndpoint.events).toEqual(["pool.created"]);
    expect(ownerResult.data.getWebhookEndpoint.active).toBe(true);

    // Clean up the endpoint created by this test
    const cleanupResult = await makeGraphQLRequest(
      DELETE_WEBHOOK_ENDPOINT,
      { id: idorEndpointId },
      accessToken
    );

    expect(cleanupResult.errors).toBeUndefined();
    expect(cleanupResult.data.deleteWebhookEndpoint).toBe(idorEndpointId);
  });

  test("should reject webhook endpoint pointing to a private network (SSRF protection)", async () => {
    const result = await makeGraphQLRequest(
      CREATE_WEBHOOK_ENDPOINT,
      {
        input: {
          url: "https://172.20.0.5/internal",
          events: ["pool.created"],
        },
      },
      accessToken
    );

    expect(result.errors).toBeDefined();
    expect(result.errors[0].message).toContain("Failed to create webhook endpoint");
  });

  test("should reject webhook endpoint pointing to IPv6 loopback (SSRF protection)", async () => {
    const result = await makeGraphQLRequest(
      CREATE_WEBHOOK_ENDPOINT,
      {
        input: {
          url: "https://[::1]/internal",
          events: ["pool.created"],
        },
      },
      accessToken
    );

    expect(result.errors).toBeDefined();
    expect(result.errors[0].message).toContain("Failed to create webhook endpoint");
  });

  test("should clean up webhook endpoint", async () => {
    const result = await makeGraphQLRequest(
      DELETE_WEBHOOK_ENDPOINT,
      { id: endpointId },
      accessToken
    );

    expect(result.errors).toBeUndefined();
    expect(result.data.deleteWebhookEndpoint).toBe(endpointId);
  });
});
