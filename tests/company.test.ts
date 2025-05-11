import { expect, test, describe, beforeAll } from "bun:test";
import { ethers, HDNodeWallet, JsonRpcProvider } from "ethers";
import { TESTNET_RPC } from "./utils/config";
import { makeGraphQLRequest } from "./utils/graphql/makeGraphQLRequest";
import { authenticate } from "./utils/authenticate";
import {
  CREATE_COMPANY,
  UPDATE_COMPANY,
  DELETE_COMPANY,
  GET_COMPANY,
  GET_COMPANIES,
  ADD_MEMBER,
  REMOVE_MEMBER,
  GRANT_PERMISSION,
  REVOKE_PERMISSION,
} from "./utils/graphql/schema/company";

describe("Company Flow", () => {
  let provider: JsonRpcProvider;
  let wallet: HDNodeWallet;
  let wallet2: HDNodeWallet;
  let accessToken: string;
  let accessToken2: string;
  let userId: string;
  let companyId: string;
  let memberId: string;
  let permissionId: string;

  beforeAll(async () => {
    provider = new ethers.JsonRpcProvider(TESTNET_RPC);
    wallet = ethers.Wallet.createRandom().connect(provider);
    wallet2 = ethers.Wallet.createRandom().connect(provider);
    ({ accessToken, userId } = await authenticate(wallet));
    ({ accessToken: accessToken2 } = await authenticate(wallet2));
  });

  describe("Authentication Tests", () => {
    test("should require authentication for creating company", async () => {
      const result = await makeGraphQLRequest(
        CREATE_COMPANY,
        {
          input: {
            name: "Test Company",
            description: "Test Description"
          },
        }
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });
    test("should require authentication for adding member", async () => {
      const result = await makeGraphQLRequest(
        ADD_MEMBER,
        {
          input: {
            companyId: "some-company-id",
            userId: "some-user-id",
            name: "Test Member"
          },
        }
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });

    test("should require authentication for granting permission", async () => {
      const result = await makeGraphQLRequest(
        GRANT_PERMISSION,
        {
          input: {
            companyId: "some-company-id",
            memberId: "some-member-id",
            userId: "some-user-id",
            permission: "read",
            entity: "some-entity-id",
          },
        }
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });
  });

  describe("Access Control Tests", () => {
    test("should not allow non-owner to update company", async () => {
      // First create a company as owner
      const createResult = await makeGraphQLRequest(
        CREATE_COMPANY,
        {
          input: {
            name: "Test Company",
            description: "Test Description"
          },
        },
        accessToken
      );

      expect(createResult.errors).toBeUndefined();
      companyId = createResult.data.createCompany.id;

      // Try to update as non-owner
      const result = await makeGraphQLRequest(
        UPDATE_COMPANY,
        {
          input: {
            id: companyId,
            updateData: {
              name: "Updated Company Name"
            }
          },
        },
        accessToken2
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Only company owner can update company");
    });

    test("should not allow non-owner to delete company", async () => {
      const result = await makeGraphQLRequest(
        DELETE_COMPANY,
        {
          id: companyId,
        },
        accessToken2
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Only company owner can delete company");
    });

    test("should not allow non-owner to add member", async () => {
      const result = await makeGraphQLRequest(
        ADD_MEMBER,
        {
          input: {
            companyId,
            userId: "some-user-id",
            name: "Test Member"
          },
        },
        accessToken2
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Only company owner can add members");
    });
  });

  describe("Company Operations", () => {
    test("should create a company", async () => {
      const result = await makeGraphQLRequest(
        CREATE_COMPANY,
        {
          input: {
            name: "Test Company",
            description: "Test Description"
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.createCompany).toBeDefined();
      expect(result.data.createCompany.name).toBe("Test Company");
      expect(result.data.createCompany.description).toBe("Test Description");
      expect(result.data.createCompany.ownerId).toBe(userId);

      companyId = result.data.createCompany.id;
    });

    test("should get company by id", async () => {
      const result = await makeGraphQLRequest(
        GET_COMPANY,
        {
          id: companyId,
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getCompany).toBeDefined();
      expect(result.data.getCompany.id).toBe(companyId);
      expect(result.data.getCompany.name).toBe("Test Company");
      expect(result.data.getCompany.description).toBe("Test Description");
      expect(result.data.getCompany.users).toBeDefined();
      expect(Array.isArray(result.data.getCompany.users)).toBe(true);
    });

    test("should get companies with filter", async () => {
      const result = await makeGraphQLRequest(
        GET_COMPANIES,
        {
          input: {
            filter: {
              ownerId: { $in: [userId] },
            },
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getCompanies).toBeDefined();
      expect(result.data.getCompanies).toBeArray();
      expect(result.data.getCompanies.length).toBeGreaterThan(0);
      expect(result.data.getCompanies[0].ownerId).toBe(userId);
    });

    test("should update company", async () => {
      const result = await makeGraphQLRequest(
        UPDATE_COMPANY,
        {
          input: {
            id: companyId,
            updateData: {
              name: "Updated Company Name",
              description: "Updated Description"
            }
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.updateCompany).toBeDefined();
      expect(result.data.updateCompany.id).toBe(companyId);
      expect(result.data.updateCompany.name).toBe("Updated Company Name");
      expect(result.data.updateCompany.description).toBe("Updated Description");
    });
  });

  describe("Member Operations", () => {
    test("should add member to company", async () => {
      const result = await makeGraphQLRequest(
        ADD_MEMBER,
        {
          input: {
            companyId,
            userId: wallet2.address,
            name: "Test Member"
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.addMember).toBeDefined();
      expect(result.data.addMember.userId).toBe(wallet2.address);
      expect(result.data.addMember.name).toBe("Test Member");

      memberId = result.data.addMember.id;
    });

    test("should grant permission to member", async () => {
      const result = await makeGraphQLRequest(
        GRANT_PERMISSION,
        {
          input: {
            companyId,
            memberId,
            userId: wallet2.address,
            permission: "read",
            entity: "company",
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.grantPermission).toBeDefined();
      expect(result.data.grantPermission.permission).toBe("read");

      permissionId = result.data.grantPermission.id;
    });

    test("should revoke permission from member", async () => {
      const result = await makeGraphQLRequest(
        REVOKE_PERMISSION,
        {
          input: {
            id: permissionId,
            companyId,
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.revokePermission).toBe(permissionId);
    });

    test("should remove member from company", async () => {
      const result = await makeGraphQLRequest(
        REMOVE_MEMBER,
        {
          input: {
            id: memberId,
            companyId,
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.removeMember).toBe(memberId);
    });
  });

  describe("Company Cleanup", () => {
    test("should delete company", async () => {
      const result = await makeGraphQLRequest(
        DELETE_COMPANY,
        {
          id: companyId,
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.deleteCompany).toBe(companyId);

      // Verify company is deleted
      const getResult = await makeGraphQLRequest(
        GET_COMPANY,
        {
          id: companyId,
        },
        accessToken
      );

      expect(getResult.errors).toBeDefined();
      expect(getResult.errors[0].message).toBeDefined();
    });
  });
});