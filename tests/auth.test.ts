import { expect, test, describe, beforeAll } from "bun:test";
import { ethers, HDNodeWallet, type Signer } from "ethers";
import { makeGraphQLRequest } from "./utils/graphql/makeGraphQLRequest";
import { AUTHENTICATE, REFRESH_TOKEN, GET_USER_TOKENS, REVOKE_TOKENS } from "./utils/graphql/schema/auth";
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
    }, authTokens.accessToken);

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
    expect(result.errors[0].message).toBe("Authentication required");
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

  test("should get user tokens", async () => {
    const result = await makeGraphQLRequest(GET_USER_TOKENS, {}, authTokens.accessToken);

    expect(result.errors).toBeUndefined();
    expect(result.data.getUserTokens).toBeDefined();
    expect(Array.isArray(result.data.getUserTokens)).toBe(true);
    expect(result.data.getUserTokens.length).toBeGreaterThan(0);

    const token = result.data.getUserTokens[0];
    expect(token.tokenId).toBeDefined();
    expect(token.userId).toBe(authTokens.userId);
    expect(token.tokenHash).toBeDefined();
    expect(token.expiresAt).toBeDefined();
    expect(token.createdAt).toBeDefined();
    expect(token.updatedAt).toBeDefined();
  });

  test("should revoke specific tokens", async () => {
    // First get user tokens
    const tokensResult = await makeGraphQLRequest(GET_USER_TOKENS, {}, authTokens.accessToken);

    expect(tokensResult.errors).toBeUndefined();
    expect(tokensResult.data.getUserTokens.length).toBeGreaterThan(0);

    const tokenToRevoke = tokensResult.data.getUserTokens[0];

    // Revoke the token
    const revokeResult = await makeGraphQLRequest(REVOKE_TOKENS, {
      input: {
        tokenHashes: [tokenToRevoke.tokenHash],
      },
    }, authTokens.accessToken);

    expect(revokeResult.errors).toBeUndefined();
    expect(revokeResult.data.revokeTokens).toBeDefined();
    expect(revokeResult.data.revokeTokens.revokedCount).toBe(1);

    // Verify token was removed
    const tokensAfterRevoke = await makeGraphQLRequest(GET_USER_TOKENS, {}, authTokens.accessToken);

    expect(tokensAfterRevoke.errors).toBeUndefined();
    expect(tokensAfterRevoke.data.getUserTokens.length).toBe(
      tokensResult.data.getUserTokens.length - 1
    );
  });

  test("should revoke multiple tokens", async () => {
    // Create additional tokens by authenticating again
    const typedData1 = await generateTypedData(wallet);
    const signature1 = await wallet.signTypedData(
      typedData1.domain,
      typedData1.types,
      typedData1.message
    );

    await makeGraphQLRequest(AUTHENTICATE, {
      input: {
        wallet: wallet.address,
        signature: signature1,
        timestamp: typedData1.message.timestamp,
      },
    });

    const typedData2 = await generateTypedData(wallet);
    const signature2 = await wallet.signTypedData(
      typedData2.domain,
      typedData2.types,
      typedData2.message
    );

    await makeGraphQLRequest(AUTHENTICATE, {
      input: {
        wallet: wallet.address,
        signature: signature2,
        timestamp: typedData2.message.timestamp,
      },
    });

    // Get all tokens
    const tokensResult = await makeGraphQLRequest(GET_USER_TOKENS, {}, authTokens.accessToken);

    expect(tokensResult.errors).toBeUndefined();
    expect(tokensResult.data.getUserTokens.length).toBeGreaterThanOrEqual(2);

    // Revoke first two tokens
    const tokensToRevoke = tokensResult.data.getUserTokens.slice(0, 2);
    const tokenHashes = tokensToRevoke.map((token: any) => token.tokenHash);

    const revokeResult = await makeGraphQLRequest(REVOKE_TOKENS, {
      input: {
        tokenHashes,
      },
    }, authTokens.accessToken);

    expect(revokeResult.errors).toBeUndefined();
    expect(revokeResult.data.revokeTokens.revokedCount).toBe(2);

    // Verify tokens were removed
    const tokensAfterRevoke = await makeGraphQLRequest(GET_USER_TOKENS, {}, authTokens.accessToken);

    expect(tokensAfterRevoke.errors).toBeUndefined();
    expect(tokensAfterRevoke.data.getUserTokens.length).toBe(
      tokensResult.data.getUserTokens.length - 2
    );
  });

  test("should handle revoking non-existent tokens", async () => {
    const result = await makeGraphQLRequest(REVOKE_TOKENS, {
      input: {
        tokenHashes: ["non-existent-hash-1", "non-existent-hash-2"],
      },
    }, authTokens.accessToken);

    expect(result.errors).toBeUndefined();
    expect(result.data.revokeTokens.revokedCount).toBe(0);
  });

  test("should fail to get tokens without authentication", async () => {
    const result = await makeGraphQLRequest(GET_USER_TOKENS, {});

    expect(result.errors).toBeDefined();
    expect(result.errors[0].message).toBe("Authentication required");
  });

  test("should fail to get tokens with Authentication required", async () => {
    const result = await makeGraphQLRequest(GET_USER_TOKENS, {}, "invalid_token");

    expect(result.errors).toBeDefined();
    expect(result.errors[0].message).toBe("Authentication required");
  });

  test("should fail to revoke tokens without authentication", async () => {
    const result = await makeGraphQLRequest(REVOKE_TOKENS, {
      input: {
        tokenHashes: ["some-hash"],
      },
    });

    expect(result.errors).toBeDefined();
    expect(result.errors[0].message).toBe("Authentication required");
  });

  test("should fail to revoke tokens with Authentication required", async () => {
    const result = await makeGraphQLRequest(REVOKE_TOKENS, {
      input: {
        tokenHashes: ["some-hash"],
      },
    }, "invalid_token");

    expect(result.errors).toBeDefined();
    expect(result.errors[0].message).toBe("Authentication required");
  });
});
