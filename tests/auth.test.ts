import { expect, test, describe, beforeAll } from "bun:test";
import { ethers, HDNodeWallet, type Signer } from "ethers";
import { makeGraphQLRequest } from "./utils/graphql/makeGraphQLRequest";
import { AUTHENTICATE, REFRESH_TOKEN } from "./utils/graphql/schema/auth";
import { generateTypedData } from "./utils/generateTypedData";

describe("Auth Flow Tests", () => {
  let wallet: HDNodeWallet;
  let authTokens: any;

  beforeAll(async () => {
    wallet = ethers.Wallet.createRandom();
  });

  test("should authenticate with typed data signature", async () => {
    const typedData = await generateTypedData(wallet);
    const signature = await wallet.signTypedData(
      typedData.domain,
      typedData.types,
      typedData.message
    );

    const result = await makeGraphQLRequest(AUTHENTICATE, {
      input: {
        wallet: wallet.address,
        signature,
        timestamp: typedData.message.timestamp,
      },
    });

    expect(result.errors).toBeUndefined();
    expect(result.data.authenticate).toBeDefined();
    expect(result.data.authenticate.wallet).toBe(wallet.address.toLowerCase());
    expect(result.data.authenticate.accessToken).toBeDefined();
    expect(result.data.authenticate.refreshToken).toBeDefined();

    authTokens = result.data.authenticate;
  });

  test("should refresh tokens", async () => {
    const result = await makeGraphQLRequest(REFRESH_TOKEN, {
      input: {
        refreshToken: authTokens.refreshToken,
      },
    });

    expect(result.errors).toBeUndefined();
    expect(result.data.refreshToken).toBeDefined();
    expect(result.data.refreshToken.wallet).toBe(wallet.address.toLowerCase());
    expect(result.data.refreshToken.accessToken).toBeDefined();
    expect(result.data.refreshToken.refreshToken).toBeDefined();
    expect(result.data.refreshToken.accessToken).not.toBe(
      authTokens.accessToken
    );
  });

  test("should fail with invalid refresh token", async () => {
    const result = await makeGraphQLRequest(REFRESH_TOKEN, {
      input: {
        refreshToken: "invalid_token",
      },
    });

    expect(result.errors).toBeDefined();
    expect(result.errors[0].message).toBe("Failed to refresh token");
  });

  test("should fail with expired signature", async () => {
    const invalidWallet = ethers.Wallet.createRandom();

    const expiredTimestamp = Math.floor(Date.now() / 1000) - 61;

    const typedData = await generateTypedData(wallet, expiredTimestamp);

    const signature = await invalidWallet.signTypedData(
      typedData.domain,
      typedData.types,
      typedData.message
    );

    const result = await makeGraphQLRequest(AUTHENTICATE, {
      input: {
        wallet: wallet.address,
        signature: signature,
        timestamp: expiredTimestamp,
      },
    });

    expect(result.errors).toBeDefined();
    expect(result.errors[0].message).toBe("Failed to authenticate");
  });

  test("should fail with future timestamp", async () => {
    const invalidWallet = ethers.Wallet.createRandom();

    const futureTimestamp = Math.floor(Date.now() / 1000) + 120;

    const typedData = await generateTypedData(wallet, futureTimestamp);

    const signature = await invalidWallet.signTypedData(
      typedData.domain,
      typedData.types,
      typedData.message
    );

    const result = await makeGraphQLRequest(AUTHENTICATE, {
      input: {
        wallet: wallet.address,
        signature: signature,
        timestamp: futureTimestamp,
      },
    });

    expect(result.errors).toBeDefined();
    expect(result.errors[0].message).toBe("Failed to authenticate");
  });

  test("should fail with other user signature", async () => {
    const invalidWallet = ethers.Wallet.createRandom();

    const typedData = await generateTypedData(wallet);
    const invalidSignature = await invalidWallet.signTypedData(
      typedData.domain,
      typedData.types,
      typedData.message
    );

    const result = await makeGraphQLRequest(AUTHENTICATE, {
      input: {
        wallet: wallet.address,
        signature: invalidSignature,
        timestamp: typedData.message.timestamp,
      },
    });

    expect(result.errors).toBeDefined();
    expect(result.errors[0].message).toBe("Failed to authenticate");
  });
});
