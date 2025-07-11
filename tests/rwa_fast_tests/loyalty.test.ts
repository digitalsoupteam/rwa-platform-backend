import { expect, test, describe, beforeAll } from "bun:test";
import { ethers, Wallet, JsonRpcProvider } from "ethers";
import { TESTNET_RPC } from "../utils/config";
import { makeGraphQLRequest } from "../utils/graphql/makeGraphQLRequest";
import { authenticate } from "../utils/authenticate";
import { requestHold, requestGas } from "../utils/requestTokens";
import { readFile } from "fs/promises";
import { join } from "path";
import {
  REGISTER_REFERRAL,
  CREATE_REFERRER_WITHDRAW_TASK,
  GET_FEES,
  GET_REFERRALS,
  GET_REFERRER_WITHDRAWS,
  GET_REFERRER_CLAIM_HISTORY,
} from "../utils/graphql/schema/loyalty";

interface PoolData {
  poolId: string;
  businessId: string;
  companyId: string;
  poolAddress: string;
  rwaAddress: string;
  ownerWallet: string;
  ownerPrivateKey: string;
  accessToken: string;
  chainId: string;
  poolData: any;
}

describe("Loyalty Flow", () => {
  let chainId: string;
  let provider: JsonRpcProvider;
  let wallet: Wallet;
  let wallet2: Wallet;
  let wallet3: Wallet;
  let accessToken: string;
  let accessToken2: string;
  let accessToken3: string;
  let userId: string;
  let referralId: string;
  let withdrawTaskId: string;
  let poolData: PoolData;

  const poolDataPath = join(__dirname, "pool-data.json");

  beforeAll(async () => {
    // Load pool data
    const rawData = await readFile(poolDataPath, 'utf-8');
    poolData = JSON.parse(rawData);

    chainId = poolData.chainId;
    provider = new ethers.JsonRpcProvider(TESTNET_RPC);
    wallet = ethers.Wallet.createRandom().connect(provider) as any;
    wallet2 = ethers.Wallet.createRandom().connect(provider) as any;
    wallet3 = ethers.Wallet.createRandom().connect(provider) as any;
    ({ accessToken, userId } = await authenticate(wallet));
    ({ accessToken: accessToken2 } = await authenticate(wallet2));
    ({ accessToken: accessToken3 } = await authenticate(wallet3));

    // Request tokens for trading
    await requestHold(accessToken, 1000);
    await requestGas(accessToken, 0.002);
    await requestHold(accessToken2, 1000);
    await requestGas(accessToken2, 0.002);
    
    await new Promise(resolve => setTimeout(resolve, 10000));
  });

  describe("Authentication Tests", () => {
    test("should require authentication for registering referral", async () => {
      const result = await makeGraphQLRequest(
        REGISTER_REFERRAL,
        {
          input: {
            referrerWallet: wallet2.address.toLowerCase(),
          },
        }
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });

    test("should require authentication for creating referrer withdraw task", async () => {
      const result = await makeGraphQLRequest(
        CREATE_REFERRER_WITHDRAW_TASK,
        {
          input: {
            chainId: "97",
            tokenAddress: "0x1234567890123456789012345678901234567890",
            amount: "1000000000000000000",
          },
        }
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });
  });

  describe("Referral System Tests", () => {
    test("should register a referral", async () => {
      const result = await makeGraphQLRequest(
        REGISTER_REFERRAL,
        {
          input: {
            referrerWallet: wallet2.address.toLowerCase(),
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.registerReferral).toBeDefined();
      expect(result.data.registerReferral.userWallet).toBe(wallet.address.toLowerCase());
      expect(result.data.registerReferral.referrerWallet).toBe(wallet2.address.toLowerCase());
      expect(result.data.registerReferral.id).toBeDefined();
      expect(result.data.registerReferral.createdAt).toBeDefined();
      expect(result.data.registerReferral.updatedAt).toBeDefined();

      referralId = result.data.registerReferral.id;
    });

    test("should not allow user to refer themselves", async () => {
      const result = await makeGraphQLRequest(
        REGISTER_REFERRAL,
        {
          input: {
            referrerWallet: wallet.address.toLowerCase(),
          },
        },
        accessToken
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Failed to register referral");
    });

    test("should not allow user to register referral twice", async () => {
      const result = await makeGraphQLRequest(
        REGISTER_REFERRAL,
        {
          input: {
            referrerWallet: wallet3.address.toLowerCase(),
          },
        },
        accessToken
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Failed to register referral");
    });

    test("should get referrals with filter", async () => {
      const result = await makeGraphQLRequest(
        GET_REFERRALS,
        {
          input: {
            filter: {
              userWallet: wallet.address.toLowerCase(),
            },
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getReferrals).toBeDefined();
      expect(result.data.getReferrals).toBeArray();
      expect(result.data.getReferrals.length).toBeGreaterThan(0);
      expect(result.data.getReferrals[0].userWallet).toBe(wallet.address.toLowerCase());
      expect(result.data.getReferrals[0].referrerWallet).toBe(wallet2.address.toLowerCase());
    });

    test("should get referrals by referrer wallet", async () => {
      const result = await makeGraphQLRequest(
        GET_REFERRALS,
        {
          input: {
            filter: {
              referrerWallet: wallet2.address.toLowerCase(),
            },
          },
        },
        accessToken2
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getReferrals).toBeDefined();
      expect(result.data.getReferrals).toBeArray();
      expect(result.data.getReferrals.length).toBeGreaterThan(0);
      expect(result.data.getReferrals[0].referrerWallet).toBe(wallet2.address.toLowerCase());
    });
  });

  describe("Fees Query Tests", () => {
    test("should get fees with empty result for new wallet", async () => {
      const result = await makeGraphQLRequest(
        GET_FEES,
        {
          input: {
            filter: {
              userWallet: wallet.address,
            },
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getFees).toBeDefined();
      expect(result.data.getFees).toBeArray();
    });


    test("should get fees after trading", async () => {
      // Perform trading to generate fees
      const poolContract = new ethers.Contract(
        poolData.poolAddress,
        [
          "function estimateMint(uint256 rwaAmount, bool allowPartial) public view returns (uint256 holdAmountWithFee, uint256 fee, uint256 actualRwaAmount)",
          "function mint(uint256 rwaAmount, uint256 maxHoldAmount, uint256 validUntil, bool allowPartial) external",
          "function holdToken() public view returns (address)",
        ],
        wallet
      );

      const holdTokenAddress = await poolContract.holdToken();
      const holdToken = new ethers.Contract(
        holdTokenAddress,
        ["function approve(address spender, uint256 amount) public returns (bool)"],
        wallet
      );

      await holdToken.approve(poolData.poolAddress, ethers.MaxUint256);

      const rwaAmount = "1000";
      const [holdAmountWithFee] = await poolContract.estimateMint(rwaAmount, true);
      const validUntil = Math.floor(Date.now() / 1000) + 3600;
      const maxHoldAmount = BigInt(holdAmountWithFee) * BigInt(110) / BigInt(100);
      
      const mintTx = await poolContract.mint(
        rwaAmount,
        maxHoldAmount,
        validUntil,
        true,
        {
          gasLimit: 1000000,
          gasPrice: 1000000000,
        }
      );
      await mintTx.wait(20);

      await new Promise(resolve => setTimeout(resolve, 15000));

      const result = await makeGraphQLRequest(
        GET_FEES,
        {
          input: {
            filter: {
              userWallet: wallet.address.toLowerCase(),
              chainId: chainId,
            },
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getFees).toBeDefined();
      expect(result.data.getFees).toBeArray();
    });

    test("should get referral rewards for referrer", async () => {
      const result = await makeGraphQLRequest(
        GET_FEES,
        {
          input: {
            filter: {
              userWallet: wallet2.address.toLowerCase(),
              chainId: chainId,
            },
          },
        },
        accessToken2
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getFees).toBeDefined();
      expect(result.data.getFees).toBeArray();
    });
  });

  describe("Referrer Withdraw Tests", () => {
    test("should create withdraw task and claim rewards", async () => {
      const feesResult = await makeGraphQLRequest(GET_FEES, { input: { filter: { userWallet: wallet2.address.toLowerCase(), chainId: chainId } } }, accessToken2);
      
      expect(feesResult.errors).toBeUndefined();
      expect(feesResult.data.getFees).toBeDefined();
      expect(feesResult.data.getFees.length).toBeGreaterThan(0);
      
      const fee = feesResult.data.getFees[0];
      const amount = fee.referralFee;
      const holdTokenAddress = fee.tokenAddress;

      const createWithdrawTaskResult = await makeGraphQLRequest(
        CREATE_REFERRER_WITHDRAW_TASK,
        {
          input: {
            chainId: chainId,
            tokenAddress: holdTokenAddress,
            amount: amount,
          },
        },
        accessToken2
      );

      expect(createWithdrawTaskResult.errors).toBeUndefined();
      const withdrawData = createWithdrawTaskResult.data.createReferrerWithdrawTask;
      expect(withdrawData).toBeDefined();
      
      const { signers, signatures, deadline, contractAddress: referralTreasuryAddress } = withdrawData;

      const referralTreasuryContract = new ethers.Contract(
        referralTreasuryAddress,
        [
          "function withdraw(address token, uint256 amount, uint256 deadline, address[] calldata signers, bytes[] calldata signatures) external",
        ],
        wallet2
      );

      const holdToken = new ethers.Contract(
        holdTokenAddress,
        ["function balanceOf(address account) view returns (uint256)"],
        provider
      );

      const balanceBefore = await holdToken.balanceOf(wallet2.address);

      const withdrawTx = await referralTreasuryContract.withdraw(
        holdTokenAddress,
        amount,
        deadline,
        signers,
        signatures
      );
      await withdrawTx.wait();

      const balanceAfter = await holdToken.balanceOf(wallet2.address);

      expect(balanceAfter).toBeGreaterThan(balanceBefore);
      expect(balanceAfter).toBe(balanceBefore + BigInt(amount));
    });

    test("should get referrer withdraws with empty result", async () => {
      const result = await makeGraphQLRequest(
        GET_REFERRER_WITHDRAWS,
        {
          input: {
            filter: {
              referrerWallet: wallet2.address.toLowerCase(),
            },
          },
        },
        accessToken2
      );

      if (result.errors) {
        expect(result.errors[0].message).toBe("Failed to get referrer withdraws");
      } else {
        expect(result.data.getReferrerWithdraws).toBeDefined();
        expect(result.data.getReferrerWithdraws).toBeArray();
      }
    });

  });

  describe("Referrer Claim History Tests", () => {
    test("should get referrer claim history with empty result", async () => {
      const result = await makeGraphQLRequest(
        GET_REFERRER_CLAIM_HISTORY,
        {
          input: {
            filter: {
              referrerWallet: wallet2.address.toLowerCase(),
            },
          },
        },
        accessToken2
      );

      if (result.errors) {
        expect(result.errors[0].message).toBe("Failed to get referrer claim history");
      } else {
        expect(result.data.getReferrerClaimHistory).toBeDefined();
        expect(result.data.getReferrerClaimHistory).toBeArray();
      }
    });


    test("should get referrer claim history by referral wallet", async () => {
      const result = await makeGraphQLRequest(
        GET_REFERRER_CLAIM_HISTORY,
        {
          input: {
            filter: {
              referralWallet: wallet.address.toLowerCase(),
            },
          },
        },
        accessToken
      );

      if (result.errors) {
        expect(result.errors[0].message).toBe("Failed to get referrer claim history");
      } else {
        expect(result.data.getReferrerClaimHistory).toBeDefined();
        expect(result.data.getReferrerClaimHistory).toBeArray();
      }
    });
  });

  describe("Input Validation Tests", () => {
    test("should validate referrer wallet address format", async () => {
      const result = await makeGraphQLRequest(
        REGISTER_REFERRAL,
        {
          input: {
            referrerWallet: "invalid-address",
          },
        },
        accessToken3
      );

      expect(result.errors).toBeDefined();
    });

    test("should validate chain ID format", async () => {
      const result = await makeGraphQLRequest(
        CREATE_REFERRER_WITHDRAW_TASK,
        {
          input: {
            chainId: "invalid-chain",
            tokenAddress: "0x1234567890123456789012345678901234567890",
            amount: "1000000000000000000",
          },
        },
        accessToken2
      );

      expect(result.errors).toBeDefined();
    });

    test("should validate token address format", async () => {
      const result = await makeGraphQLRequest(
        CREATE_REFERRER_WITHDRAW_TASK,
        {
          input: {
            chainId: "97",
            tokenAddress: "invalid-token-address",
            amount: "1000000000000000000",
          },
        },
        accessToken2
      );

      expect(result.errors).toBeDefined();
    });

    test("should validate amount format", async () => {
      const result = await makeGraphQLRequest(
        CREATE_REFERRER_WITHDRAW_TASK,
        {
          input: {
            chainId: "97",
            tokenAddress: "0x1234567890123456789012345678901234567890",
            amount: "invalid-amount",
          },
        },
        accessToken2
      );

      expect(result.errors).toBeDefined();
    });
  });

});