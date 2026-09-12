import { expect, test, describe, beforeAll } from "bun:test";
import { ethers, HDNodeWallet } from "ethers";
import { makeGraphQLRequest } from "./utils/graphql/makeGraphQLRequest";
import { authenticate } from "./utils/authenticate";
import {
  CREATE_WEBHOOK_ENDPOINT,
  UPDATE_WEBHOOK_ENDPOINT,
  DELETE_WEBHOOK_ENDPOINT,
  GET_WEBHOOK_ENDPOINTS,
  GET_WEBHOOK_ENDPOINT,
} from "./utils/graphql/schema/webhooks";

describe("Webhooks Flow", () => {
  let wallet: HDNodeWallet;
  let wallet2: HDNodeWallet;
  let accessToken: string;
  let accessToken2: string;
  let userId: string;
  let endpointId: string;

  beforeAll(async () => {
    wallet = ethers.Wallet.createRandom();
    wallet2 = ethers.Wallet.createRandom();
    ({ accessToken, userId } = await authenticate(wallet));
    ({ accessToken: accessToken2 } = await authenticate(wallet2));
  });

  describe("Authentication Tests", () => {
    test("should require authentication for creating webhook endpoint", async () => {
      const result = await makeGraphQLRequest(CREATE_WEBHOOK_ENDPOINT, {
        input: {
          url: "https://example.com/webhook",
          events: ["pool.created"],
        },
      });

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });

    test("should require authentication for getting webhook endpoints", async () => {
      const result = await makeGraphQLRequest(GET_WEBHOOK_ENDPOINTS, {});

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });

    test("should require authentication for getting webhook endpoint by id", async () => {
      const result = await makeGraphQLRequest(GET_WEBHOOK_ENDPOINT, {
        id: "some-id",
      });

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });

    test("should require authentication for updating webhook endpoint", async () => {
      const result = await makeGraphQLRequest(UPDATE_WEBHOOK_ENDPOINT, {
        input: {
          id: "some-id",
          url: "https://example.com/updated",
        },
      });

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });

    test("should require authentication for deleting webhook endpoint", async () => {
      const result = await makeGraphQLRequest(DELETE_WEBHOOK_ENDPOINT, {
        id: "some-id",
      });

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });
  });

  describe("CRUD Operations", () => {
    test("should create a webhook endpoint", async () => {
      const result = await makeGraphQLRequest(
        CREATE_WEBHOOK_ENDPOINT,
        {
          input: {
            url: "https://example.com/webhook",
            events: ["pool.created", "pool.staked"],
            description: "Test webhook",
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.createWebhookEndpoint).toBeDefined();
      expect(result.data.createWebhookEndpoint.id).toBeDefined();
      expect(result.data.createWebhookEndpoint.url).toBe("https://example.com/webhook");
      expect(result.data.createWebhookEndpoint.events).toEqual(["pool.created", "pool.staked"]);
      expect(result.data.createWebhookEndpoint.description).toBe("Test webhook");
      expect(result.data.createWebhookEndpoint.active).toBe(true);
      expect(result.data.createWebhookEndpoint.rateLimitPerMinute).toBe(100);
      expect(result.data.createWebhookEndpoint.secret).toBeDefined();
      expect(result.data.createWebhookEndpoint.createdAt).toBeDefined();

      endpointId = result.data.createWebhookEndpoint.id;
    });

    test("should get all webhook endpoints", async () => {
      const result = await makeGraphQLRequest(GET_WEBHOOK_ENDPOINTS, {}, accessToken);

      expect(result.errors).toBeUndefined();
      expect(result.data.getWebhookEndpoints).toBeDefined();
      expect(result.data.getWebhookEndpoints).toBeArray();
      expect(result.data.getWebhookEndpoints.length).toBeGreaterThan(0);

      const endpoint = result.data.getWebhookEndpoints.find((e: any) => e.id === endpointId);
      expect(endpoint).toBeDefined();
      expect(endpoint.url).toBe("https://example.com/webhook");
      expect(endpoint.events).toEqual(["pool.created", "pool.staked"]);
      expect(endpoint.active).toBe(true);
    });

    test("should get webhook endpoint by id", async () => {
      const result = await makeGraphQLRequest(
        GET_WEBHOOK_ENDPOINT,
        { id: endpointId },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getWebhookEndpoint).toBeDefined();
      expect(result.data.getWebhookEndpoint.id).toBe(endpointId);
      expect(result.data.getWebhookEndpoint.url).toBe("https://example.com/webhook");
      expect(result.data.getWebhookEndpoint.events).toEqual(["pool.created", "pool.staked"]);
      expect(result.data.getWebhookEndpoint.userId).toBe(userId);
      expect(result.data.getWebhookEndpoint.active).toBe(true);
    });

    test("should update webhook endpoint", async () => {
      const result = await makeGraphQLRequest(
        UPDATE_WEBHOOK_ENDPOINT,
        {
          input: {
            id: endpointId,
            url: "https://example.com/webhook-v2",
            events: ["pool.created", "pool.burned"],
            description: "Updated webhook",
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.updateWebhookEndpoint).toBeDefined();
      expect(result.data.updateWebhookEndpoint.id).toBe(endpointId);
      expect(result.data.updateWebhookEndpoint.url).toBe("https://example.com/webhook-v2");
      expect(result.data.updateWebhookEndpoint.events).toEqual(["pool.created", "pool.burned"]);
      expect(result.data.updateWebhookEndpoint.description).toBe("Updated webhook");
      expect(result.data.updateWebhookEndpoint.active).toBe(true);
    });

    test("should delete webhook endpoint", async () => {
      const result = await makeGraphQLRequest(
        DELETE_WEBHOOK_ENDPOINT,
        { id: endpointId },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.deleteWebhookEndpoint).toBe(endpointId);

      // Verify endpoint is deleted
      const getResult = await makeGraphQLRequest(
        GET_WEBHOOK_ENDPOINT,
        { id: endpointId },
        accessToken
      );

      expect(getResult.errors).toBeDefined();
    });
  });

  describe("Access Control Tests", () => {
    test("should not allow other user to access another user's webhook endpoint", async () => {
      // Create an endpoint as first user
      const createResult = await makeGraphQLRequest(
        CREATE_WEBHOOK_ENDPOINT,
        {
          input: {
            url: "https://example.com/private-webhook",
            events: ["pool.created"],
          },
        },
        accessToken
      );

      expect(createResult.errors).toBeUndefined();
      const keyId = createResult.data.createWebhookEndpoint.id;

      // Try to get it as second user
      const getResult = await makeGraphQLRequest(
        GET_WEBHOOK_ENDPOINT,
        { id: keyId },
        accessToken2
      );

      expect(getResult.errors).toBeDefined();

      // Try to update it as second user
      const updateResult = await makeGraphQLRequest(
        UPDATE_WEBHOOK_ENDPOINT,
        {
          input: {
            id: keyId,
            url: "https://example.com/hacked",
          },
        },
        accessToken2
      );

      expect(updateResult.errors).toBeDefined();

      // Try to delete it as second user
      const deleteResult = await makeGraphQLRequest(
        DELETE_WEBHOOK_ENDPOINT,
        { id: keyId },
        accessToken2
      );

      expect(deleteResult.errors).toBeDefined();

      // Clean up
      await makeGraphQLRequest(
        DELETE_WEBHOOK_ENDPOINT,
        { id: keyId },
        accessToken
      );
    });
  });
});
