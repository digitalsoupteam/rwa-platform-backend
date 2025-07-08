import { expect, test, describe, beforeAll } from "bun:test";
import { ethers, HDNodeWallet, JsonRpcProvider } from "ethers";
import { TESTNET_RPC } from "./utils/config";
import { makeGraphQLRequest } from "./utils/graphql/makeGraphQLRequest";
import { authenticate } from "./utils/authenticate";
import {
  REGISTER_REFERRAL,
  CREATE_REFERRER_WITHDRAW_TASK,
  GET_FEES,
  GET_REFERRALS,
  GET_REFERRER_WITHDRAWS,
  GET_REFERRER_CLAIM_HISTORY,
} from "./utils/graphql/schema/loyalty";

describe("Loyalty Flow", () => {
  let chainId: string;
  let provider: JsonRpcProvider;
  let wallet: HDNodeWallet;
  let wallet2: HDNodeWallet;
  let wallet3: HDNodeWallet;
  let accessToken: string;
  let accessToken2: string;
  let accessToken3: string;
  let userId: string;
  let referralId: string;
  let withdrawTaskId: string;

  beforeAll(async () => {
    chainId = "97";
    provider = new ethers.JsonRpcProvider(TESTNET_RPC);
    wallet = ethers.Wallet.createRandom().connect(provider);
    wallet2 = ethers.Wallet.createRandom().connect(provider);
    wallet3 = ethers.Wallet.createRandom().connect(provider);
    ({ accessToken, userId } = await authenticate(wallet));
    ({ accessToken: accessToken2 } = await authenticate(wallet2));
    ({ accessToken: accessToken3 } = await authenticate(wallet3));
  });

  // describe("Authentication Tests", () => {
  //   test("should require authentication for registering referral", async () => {
  //     const result = await makeGraphQLRequest(
  //       REGISTER_REFERRAL,
  //       {
  //         input: {
  //           referrerWallet: wallet2.address,
  //         },
  //       }
  //     );

  //     expect(result.errors).toBeDefined();
  //     expect(result.errors[0].message).toBe("Authentication required");
  //   });

  //   test("should require authentication for creating referrer withdraw task", async () => {
  //     const result = await makeGraphQLRequest(
  //       CREATE_REFERRER_WITHDRAW_TASK,
  //       {
  //         input: {
  //           chainId: "97",
  //           tokenAddress: "0x1234567890123456789012345678901234567890",
  //           amount: "1000000000000000000",
  //         },
  //       }
  //     );

  //     expect(result.errors).toBeDefined();
  //     expect(result.errors[0].message).toBe("Authentication required");
  //   });
  // });

  // describe("Referral System Tests", () => {
  //   test("should register a referral", async () => {
  //     const result = await makeGraphQLRequest(
  //       REGISTER_REFERRAL,
  //       {
  //         input: {
  //           referrerWallet: wallet2.address,
  //         },
  //       },
  //       accessToken
  //     );

  //     expect(result.errors).toBeUndefined();
  //     expect(result.data.registerReferral).toBeDefined();
  //     expect(result.data.registerReferral.userWallet).toBe(wallet.address.toLowerCase());
  //     expect(result.data.registerReferral.referrerWallet).toBe(wallet2.address);
  //     expect(result.data.registerReferral.id).toBeDefined();
  //     expect(result.data.registerReferral.createdAt).toBeDefined();
  //     expect(result.data.registerReferral.updatedAt).toBeDefined();

  //     referralId = result.data.registerReferral.id;
  //   });

  //   test("should not allow user to refer themselves", async () => {
  //     const result = await makeGraphQLRequest(
  //       REGISTER_REFERRAL,
  //       {
  //         input: {
  //           referrerWallet: wallet.address,
  //         },
  //       },
  //       accessToken
  //     );

  //     expect(result.errors).toBeDefined();
  //     expect(result.errors[0].message).toBe("Failed to register referral");
  //   });

  //   test("should not allow user to register referral twice", async () => {
  //     const result = await makeGraphQLRequest(
  //       REGISTER_REFERRAL,
  //       {
  //         input: {
  //           referrerWallet: wallet3.address,
  //         },
  //       },
  //       accessToken
  //     );

  //     expect(result.errors).toBeDefined();
  //     expect(result.errors[0].message).toBe("Failed to register referral");
  //   });

  //   test("should get referrals with filter", async () => {
  //     const result = await makeGraphQLRequest(
  //       GET_REFERRALS,
  //       {
  //         input: {
  //           filter: {
  //             userWallet: wallet.address.toLowerCase(),
  //           },
  //         },
  //       },
  //       accessToken
  //     );

  //     expect(result.errors).toBeUndefined();
  //     expect(result.data.getReferrals).toBeDefined();
  //     expect(result.data.getReferrals).toBeArray();
  //     expect(result.data.getReferrals.length).toBeGreaterThan(0);
  //     expect(result.data.getReferrals[0].userWallet).toBe(wallet.address.toLowerCase());
  //     expect(result.data.getReferrals[0].referrerWallet).toBe(wallet2.address);
  //   });

  //   test("should get referrals by referrer wallet", async () => {
  //     const result = await makeGraphQLRequest(
  //       GET_REFERRALS,
  //       {
  //         input: {
  //           filter: {
  //             referrerWallet: wallet2.address,
  //           },
  //         },
  //       },
  //       accessToken2
  //     );

  //     expect(result.errors).toBeUndefined();
  //     expect(result.data.getReferrals).toBeDefined();
  //     expect(result.data.getReferrals).toBeArray();
  //     expect(result.data.getReferrals.length).toBeGreaterThan(0);
  //     expect(result.data.getReferrals[0].referrerWallet).toBe(wallet2.address);
  //   });
  // });

  // describe("Fees Query Tests", () => {
  //   test("should get fees with empty result for new wallet", async () => {
  //     const result = await makeGraphQLRequest(
  //       GET_FEES,
  //       {
  //         input: {
  //           filter: {
  //             userWallet: wallet.address,
  //           },
  //         },
  //       },
  //       accessToken
  //     );

  //     expect(result.errors).toBeUndefined();
  //     expect(result.data.getFees).toBeDefined();
  //     expect(result.data.getFees).toBeArray();
  //     expect(result.data.getFees.length).toBe(0);
  //   });

  //   test("should get fees with pagination", async () => {
  //     const result = await makeGraphQLRequest(
  //       GET_FEES,
  //       {
  //         input: {
  //           limit: 10,
  //           offset: 0,
  //         },
  //       },
  //       accessToken
  //     );

  //     expect(result.errors).toBeUndefined();
  //     expect(result.data.getFees).toBeDefined();
  //     expect(result.data.getFees).toBeArray();
  //   });

  //   test("should get fees with sorting", async () => {
  //     const result = await makeGraphQLRequest(
  //       GET_FEES,
  //       {
  //         input: {
  //           sort: {
  //             createdAt: "desc",
  //           },
  //         },
  //       },
  //       accessToken
  //     );

  //     expect(result.errors).toBeUndefined();
  //     expect(result.data.getFees).toBeDefined();
  //     expect(result.data.getFees).toBeArray();
  //   });
  // });

  //TODO
  // describe("Referrer Withdraw Tests", () => {
  //   test("should fail to create withdraw task without referral rewards", async () => {
  //     const result = await makeGraphQLRequest(
  //       CREATE_REFERRER_WITHDRAW_TASK,
  //       {
  //         input: {
  //           chainId: "97",
  //           tokenAddress: "0x1234567890123456789012345678901234567890",
  //           amount: "1000000000000000000",
  //         },
  //       },
  //       accessToken2
  //     );

  //     expect(result.errors).toBeDefined();
  //     expect(result.errors[0].message).toBe("Failed to create referrer withdraw task");
  //   });

  //   test("should get referrer withdraws with empty result", async () => {
  //     // ПРОБЛЕМА: Получаем ошибку "Failed to get referrer withdraws"
  //     // ОЖИДАЕМОЕ ПОВЕДЕНИЕ: Должен вернуть пустой массив для нового кошелька
  //     // ПРЕДПОЛОЖИТЕЛЬНАЯ ПРИЧИНА:
  //     // 1. Резолвер getReferrerWithdraws не реализован в gateway
  //     // 2. Ошибка в маппинге между GraphQL схемой и сервисом
  //     // 3. Проблема с аутентификацией или авторизацией в loyalty сервисе
  //     const result = await makeGraphQLRequest(
  //       GET_REFERRER_WITHDRAWS,
  //       {
  //         input: {
  //           filter: {
  //             referrerWallet: wallet2.address.toLowerCase(),
  //           },
  //         },
  //       },
  //       accessToken2
  //     );

  //     expect(result.errors).toBeUndefined();
  //     expect(result.data.getReferrerWithdraws).toBeDefined();
  //     expect(result.data.getReferrerWithdraws).toBeArray();
  //     expect(result.data.getReferrerWithdraws.length).toBe(0);
  //   });

  //   test("should get referrer withdraws with pagination", async () => {
  //     // ПРОБЛЕМА: Получаем ошибку "Failed to get referrer withdraws"
  //     // ОЖИДАЕМОЕ ПОВЕДЕНИЕ: Должен вернуть массив с пагинацией (limit: 10, offset: 0)
  //     // ПРЕДПОЛОЖИТЕЛЬНАЯ ПРИЧИНА: Та же что и в предыдущем тесте - резолвер не работает
  //     const result = await makeGraphQLRequest(
  //       GET_REFERRER_WITHDRAWS,
  //       {
  //         input: {
  //           limit: 10,
  //           offset: 0,
  //         },
  //       },
  //       accessToken2
  //     );

  //     expect(result.errors).toBeUndefined();
  //     expect(result.data.getReferrerWithdraws).toBeDefined();
  //     expect(result.data.getReferrerWithdraws).toBeArray();
  //   });
  // });

  describe("Referrer Claim History Tests", () => {
    test("should get referrer claim history with empty result", async () => {
      // ПРОБЛЕМА: Получаем ошибку "Failed to get referrer claim history"
      // ОЖИДАЕМОЕ ПОВЕДЕНИЕ: Должен вернуть пустой массив истории клеймов
      // ПРЕДПОЛОЖИТЕЛЬНАЯ ПРИЧИНА:
      // 1. Резолвер getReferrerClaimHistory не реализован
      // 2. Проблема с подключением к loyalty сервису
      // 3. Ошибка в обработке фильтров или параметров запроса
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

      expect(result.errors).toBeUndefined();
      expect(result.data.getReferrerClaimHistory).toBeDefined();
      expect(result.data.getReferrerClaimHistory).toBeArray();
      expect(result.data.getReferrerClaimHistory.length).toBe(0);
    });

    test("should get referrer claim history with pagination", async () => {
      // ПРОБЛЕМА: Получаем ошибку "Failed to get referrer claim history"
      // ОЖИДАЕМОЕ ПОВЕДЕНИЕ: Должен вернуть массив с пагинацией
      // ПРЕДПОЛОЖИТЕЛЬНАЯ ПРИЧИНА: Та же что и выше - резолвер не работает
      const result = await makeGraphQLRequest(
        GET_REFERRER_CLAIM_HISTORY,
        {
          input: {
            limit: 10,
            offset: 0,
          },
        },
        accessToken2
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getReferrerClaimHistory).toBeDefined();
      expect(result.data.getReferrerClaimHistory).toBeArray();
    });

    test("should get referrer claim history with sorting", async () => {
      // ИСПРАВЛЕНО: Заменили числовое значение -1 на строковое "desc"
      // ПРИЧИНА ОШИБКИ: Loyalty сервис ожидает строковые значения "asc"/"desc"
      const result = await makeGraphQLRequest(
        GET_REFERRER_CLAIM_HISTORY,
        {
          input: {
            sort: {
              blockNumber: "desc",
            },
          },
        },
        accessToken2
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getReferrerClaimHistory).toBeDefined();
      expect(result.data.getReferrerClaimHistory).toBeArray();
    });

    test("should get referrer claim history by referral wallet", async () => {
      // ПРОБЛЕМА: Получаем ошибку "Failed to get referrer claim history"
      // ОЖИДАЕМОЕ ПОВЕДЕНИЕ: Должен вернуть историю клеймов по referralWallet
      // ПРЕДПОЛОЖИТЕЛЬНАЯ ПРИЧИНА: Резолвер не работает
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

      expect(result.errors).toBeUndefined();
      expect(result.data.getReferrerClaimHistory).toBeDefined();
      expect(result.data.getReferrerClaimHistory).toBeArray();
    });
  });
return
  describe("Input Validation Tests", () => {
    test("should validate referrer wallet address format", async () => {
      // ПРОБЛЕМА: Ожидаем ошибку, но получаем undefined
      // ОЖИДАЕМОЕ ПОВЕДЕНИЕ: Должна быть ошибка валидации для невалидного адреса
      // ПРЕДПОЛОЖИТЕЛЬНАЯ ПРИЧИНА:
      // 1. Валидация адреса не реализована в резолвере
      // 2. Резолвер принимает любую строку как валидный адрес
      // 3. Валидация происходит на уровне сервиса, но ошибка не пробрасывается
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
      // This should fail due to invalid address format
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
      // This should fail due to invalid chain ID
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
      // This should fail due to invalid token address format
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
      // This should fail due to invalid amount format
    });
  });

  describe("Filter and Sorting Tests", () => {
    test("should handle complex filters for fees", async () => {
      // ИСПРАВЛЕНО: Заменили числовое значение -1 на строковое "desc"
      const result = await makeGraphQLRequest(
        GET_FEES,
        {
          input: {
            filter: {
              chainId: "97",
              buyCommissionCount: { $gt: 0 },
            },
            sort: {
              createdAt: "desc",
            },
            limit: 5,
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getFees).toBeDefined();
      expect(result.data.getFees).toBeArray();
    });

    test("should handle complex filters for referrals", async () => {
      // ИСПРАВЛЕНО: Заменили числовое значение -1 на строковое "desc"
      // ПРОБЛЕМА: Возможно также проблема с комплексными $or фильтрами
      const result = await makeGraphQLRequest(
        GET_REFERRALS,
        {
          input: {
            filter: {
              $or: [
                { userWallet: wallet.address },
                { referrerWallet: wallet.address },
              ],
            },
            sort: {
              updatedAt: "desc",
            },
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getReferrals).toBeDefined();
      expect(result.data.getReferrals).toBeArray();
    });

    test("should handle date range filters", async () => {
      // ПРОБЛЕМА: Получаем ошибку "Failed to get referrer claim history"
      // ОЖИДАЕМОЕ ПОВЕДЕНИЕ: Должен вернуть историю клеймов за последние 24 часа
      // ПРЕДПОЛОЖИТЕЛЬНАЯ ПРИЧИНА:
      // 1. Резолвер getReferrerClaimHistory не работает
      // 2. Проблема с обработкой date range фильтров ($gte, $lte)
      // 3. Неправильное преобразование timestamp в нужный формат
      const now = Date.now();
      const dayAgo = now - 24 * 60 * 60 * 1000;

      const result = await makeGraphQLRequest(
        GET_REFERRER_CLAIM_HISTORY,
        {
          input: {
            filter: {
              createdAt: {
                $gte: dayAgo,
                $lte: now,
              },
            },
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getReferrerClaimHistory).toBeDefined();
      expect(result.data.getReferrerClaimHistory).toBeArray();
    });
  });
});