import { expect, test, describe, beforeAll } from "bun:test";
import { ethers, HDNodeWallet } from "ethers";
import { makeGraphQLRequest } from "./utils/graphql/makeGraphQLRequest";
import { authenticate } from "./utils/authenticate";
import {
  CREATE_API_KEY,
  UPDATE_API_KEY,
  DELETE_API_KEY,
  GET_API_KEYS,
  GET_API_KEY,
} from "./utils/graphql/schema/api-keys";

describe("API Keys Flow", () => {
  let wallet: HDNodeWallet;
  let accessToken: string;
  let accessToken2: string;
  let userId: string;
  let apiKeyId: string;

  beforeAll(async () => {
    wallet = ethers.Wallet.createRandom();
    const wallet2 = ethers.Wallet.createRandom();
    ({ accessToken, userId } = await authenticate(wallet));
    ({ accessToken: accessToken2 } = await authenticate(wallet2));
  });

  describe("Authentication Tests", () => {
    test("should require authentication for creating API key", async () => {
      const result = await makeGraphQLRequest(CREATE_API_KEY, {
        input: {
          name: "Test Key",
        },
      });

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });

    test("should require authentication for getting API keys", async () => {
      const result = await makeGraphQLRequest(GET_API_KEYS, {});

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });

    test("should require authentication for getting API key by id", async () => {
      const result = await makeGraphQLRequest(GET_API_KEY, {
        id: "some-id",
      });

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });

    test("should require authentication for updating API key", async () => {
      const result = await makeGraphQLRequest(UPDATE_API_KEY, {
        input: {
          id: "some-id",
          name: "Updated Key",
        },
      });

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });

    test("should require authentication for deleting API key", async () => {
      const result = await makeGraphQLRequest(DELETE_API_KEY, {
        id: "some-id",
      });

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });
  });

  describe("CRUD Operations", () => {
    test("should create an API key", async () => {
      const result = await makeGraphQLRequest(
        CREATE_API_KEY,
        {
          input: {
            name: "My API Key",
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.createApiKey).toBeDefined();
      expect(result.data.createApiKey.id).toBeDefined();
      expect(result.data.createApiKey.name).toBe("My API Key");
      expect(result.data.createApiKey.prefix).toBeDefined();
      expect(result.data.createApiKey.key).toBeDefined();
      expect(result.data.createApiKey.createdAt).toBeDefined();

      apiKeyId = result.data.createApiKey.id;
    });

    test("should get all API keys", async () => {
      const result = await makeGraphQLRequest(GET_API_KEYS, {}, accessToken);

      expect(result.errors).toBeUndefined();
      expect(result.data.getApiKeys).toBeDefined();
      expect(result.data.getApiKeys).toBeArray();
      expect(result.data.getApiKeys.length).toBeGreaterThan(0);

      const key = result.data.getApiKeys.find((k: any) => k.id === apiKeyId);
      expect(key).toBeDefined();
      expect(key.name).toBe("My API Key");
      expect(key.prefix).toBeDefined();
      expect(key.userId).toBe(userId);
      expect(key.wallet).toBeDefined();
    });

    test("should get API key by id", async () => {
      const result = await makeGraphQLRequest(
        GET_API_KEY,
        { id: apiKeyId },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getApiKey).toBeDefined();
      expect(result.data.getApiKey.id).toBe(apiKeyId);
      expect(result.data.getApiKey.name).toBe("My API Key");
      expect(result.data.getApiKey.prefix).toBeDefined();
      expect(result.data.getApiKey.userId).toBe(userId);
      expect(result.data.getApiKey.wallet).toBeDefined();
    });

    test("should update API key name", async () => {
      const result = await makeGraphQLRequest(
        UPDATE_API_KEY,
        {
          input: {
            id: apiKeyId,
            name: "Updated Key Name",
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.updateApiKey).toBeDefined();
      expect(result.data.updateApiKey.id).toBe(apiKeyId);
      expect(result.data.updateApiKey.name).toBe("Updated Key Name");
      expect(result.data.updateApiKey.prefix).toBeDefined();
      expect(result.data.updateApiKey.userId).toBe(userId);
    });

    test("should delete API key", async () => {
      const result = await makeGraphQLRequest(
        DELETE_API_KEY,
        { id: apiKeyId },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.deleteApiKey).toBe(apiKeyId);

      // Verify key is deleted
      const getResult = await makeGraphQLRequest(
        GET_API_KEY,
        { id: apiKeyId },
        accessToken
      );

      expect(getResult.errors).toBeDefined();
      expect(getResult.errors[0].message).toBeDefined();
    });
  });

  describe("Access Control Tests", () => {
    test("should not allow other user to access another user's API key", async () => {
      // Create a key as first user
      const createResult = await makeGraphQLRequest(
        CREATE_API_KEY,
        {
          input: {
            name: "Private Key",
          },
        },
        accessToken
      );

      expect(createResult.errors).toBeUndefined();
      const keyId = createResult.data.createApiKey.id;

      // Try to get it as second user
      const getResult = await makeGraphQLRequest(
        GET_API_KEY,
        { id: keyId },
        accessToken2
      );

      expect(getResult.errors).toBeDefined();

      // Try to update it as second user
      const updateResult = await makeGraphQLRequest(
        UPDATE_API_KEY,
        {
          input: {
            id: keyId,
            name: "Hacked Name",
          },
        },
        accessToken2
      );

      expect(updateResult.errors).toBeDefined();

      // Try to delete it as second user
      const deleteResult = await makeGraphQLRequest(
        DELETE_API_KEY,
        { id: keyId },
        accessToken2
      );

      expect(deleteResult.errors).toBeDefined();

      // Clean up
      await makeGraphQLRequest(
        DELETE_API_KEY,
        { id: keyId },
        accessToken
      );
    });
  });
});
