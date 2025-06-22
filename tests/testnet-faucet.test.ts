import { expect, test, describe, beforeAll } from "bun:test";
import { ethers, HDNodeWallet } from "ethers";
import { makeGraphQLRequest } from "./utils/graphql/makeGraphQLRequest";
import { REQUEST_GAS, REQUEST_HOLD, GET_HISTORY, GET_UNLOCK_TIME } from "./utils/graphql/schema/testnet-faucet";
import { authenticate } from "./utils/authenticate";


describe("Testnet Faucet Flow Tests", () => {
  let wallet: HDNodeWallet
  let accessToken: string;
  let userId: string;
  let gasRequestId: string;
  let holdRequestId: string;

  beforeAll(async () => {
    wallet = ethers.Wallet.createRandom();
    ({ accessToken, userId } = await authenticate(wallet))
  })

  test("should request gas token", async () => {
    const amount = 0.0001
    const result = await makeGraphQLRequest(
      REQUEST_GAS,
      {
        input: {
          amount
        },
      },
      accessToken
    );

    expect(result.errors).toBeUndefined();
    expect(result.data.requestGas).toBeDefined();
    expect(result.data.requestGas.userId).toBe(userId);
    expect(result.data.requestGas.wallet).toBe(wallet.address.toLowerCase());
    expect(result.data.requestGas.tokenType).toBe("gas");
    expect(result.data.requestGas.amount).toBe(amount);
    expect(result.data.requestGas.transactionHash).toBeDefined();

    gasRequestId = result.data.requestGas.id;
  });
  
  test("should request hold token", async () => {
    const amount = 10
    const result = await makeGraphQLRequest(
      REQUEST_HOLD,
      {
        input: {
          amount
        },
      },
      accessToken
    );

    expect(result.errors).toBeUndefined();
    expect(result.data.requestHold).toBeDefined();
    expect(result.data.requestHold.userId).toBe(userId);
    expect(result.data.requestHold.wallet).toBe(wallet.address.toLowerCase());
    expect(result.data.requestHold.tokenType).toBe("hold");
    expect(result.data.requestHold.amount).toBe(amount);
    expect(result.data.requestHold.transactionHash).toBeDefined();

    holdRequestId = result.data.requestHold.id;
  });

  test("should get request history", async () => {
    const result = await makeGraphQLRequest(
      GET_HISTORY,
      {
        pagination: {
          limit: 10,
          offset: 0,
        },
      },
      accessToken
    );

    expect(result.errors).toBeUndefined();
    expect(result.data.getHistory).toBeDefined();
    expect(Array.isArray(result.data.getHistory)).toBe(true);
    expect(result.data.getHistory.length).toBe(2); // Gas and Hold requests

    // Check requests order (newest first)
    const requests = result.data.getHistory;
    expect(requests[0].id).toBe(gasRequestId);
    expect(requests[1].id).toBe(holdRequestId);
  });

  test("should get unlock time", async () => {
    const result = await makeGraphQLRequest(
      GET_UNLOCK_TIME,
      {},
      accessToken
    );

    expect(result.errors).toBeUndefined();
    expect(result.data.getUnlockTime).toBeDefined();
    expect(typeof result.data.getUnlockTime.gasUnlockTime).toBe("number");
    expect(typeof result.data.getUnlockTime.holdUnlockTime).toBe("number");
  });

  test("should fail operations without auth", async () => {
    // Test request gas
    const gasAmount = 0.00001
    const holdAmount = 0.00001
    let result = await makeGraphQLRequest(REQUEST_GAS, {
      input: {
        amount: gasAmount,
      },
    });
    expect(result.errors).toBeDefined();
    expect(result.errors[0].message).toBe("Authentication required");

    // Test request hold
    result = await makeGraphQLRequest(REQUEST_HOLD, {
      input: {
        amount: holdAmount,
      },
    });
    expect(result.errors).toBeDefined();
    expect(result.errors[0].message).toBe("Authentication required");

    // Test get history
    result = await makeGraphQLRequest(GET_HISTORY, {
      pagination: {
        limit: 10,
        offset: 0,
      },
    });
    expect(result.errors).toBeDefined();
    expect(result.errors[0].message).toBe("Authentication required");

    // Test get unlock time
    result = await makeGraphQLRequest(GET_UNLOCK_TIME, {});
    expect(result.errors).toBeDefined();
    expect(result.errors[0].message).toBe("Authentication required");
  });
});