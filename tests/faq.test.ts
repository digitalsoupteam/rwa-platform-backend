import { expect, test, describe, beforeAll } from "bun:test";
import { ethers, HDNodeWallet, JsonRpcProvider } from "ethers";
import { TESTNET_RPC } from "./utils/config";
import { makeGraphQLRequest } from "./utils/graphql/makeGraphQLRequest";
import { authenticate } from "./utils/authenticate";
import {
  CREATE_FAQ_TOPIC,
  UPDATE_FAQ_TOPIC,
  DELETE_FAQ_TOPIC,
  GET_FAQ_TOPIC,
  GET_FAQ_TOPICS,
  CREATE_FAQ_ANSWER,
  UPDATE_FAQ_ANSWER,
  DELETE_FAQ_ANSWER,
  GET_FAQ_ANSWER,
  GET_FAQ_ANSWERS,
} from "./utils/graphql/schema/faq";
import { CREATE_BUSINESS } from "./utils/graphql/schema/rwa";
import { CREATE_COMPANY } from "./utils/graphql/schema/company";

describe("FAQ Flow", () => {
  let chainId: string;
  let provider: JsonRpcProvider;
  let wallet: HDNodeWallet;
  let wallet2: HDNodeWallet;
  let accessToken: string;
  let accessToken2: string;
  let userId: string;
  let companyId: string;
  let businessId: string;
  let topicId: string;
  let answerId: string;

  beforeAll(async () => {
    chainId = "97";
    provider = new ethers.JsonRpcProvider(TESTNET_RPC);
    wallet = ethers.Wallet.createRandom().connect(provider);
    wallet2 = ethers.Wallet.createRandom().connect(provider);
    ({ accessToken, userId } = await authenticate(wallet));
    ({ accessToken: accessToken2 } = await authenticate(wallet2));

    const companyResult = await makeGraphQLRequest(
      CREATE_COMPANY,
      {
        input: {
          name: "Test Company for RWA",
          description: "Test Description"
        },
      },
      accessToken
    );

    companyId = companyResult.data.createCompany.id;

    const result = await makeGraphQLRequest(
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

    businessId = result.data.createBusiness.id;
  });

  // describe("Authentication Tests", () => {
  //   test("should require authentication for creating topic", async () => {
  //     const result = await makeGraphQLRequest(
  //       CREATE_FAQ_TOPIC,
  //       {
  //         input: {
  //           name: "Test Topic",
  //           parentId: businessId,
  //           type: "business"
  //         },
  //       }
  //     );

  //     expect(result.errors).toBeDefined();
  //     expect(result.errors[0].message).toBe("Authentication required");
  //   });

  //   test("should require authentication for updating topic", async () => {
  //     const result = await makeGraphQLRequest(
  //       UPDATE_FAQ_TOPIC,
  //       {
  //         input: {
  //           id: "some-topic-id",
  //           updateData: {
  //             name: "Updated Topic Name"
  //           }
  //         },
  //       }
  //     );

  //     expect(result.errors).toBeDefined();
  //     expect(result.errors[0].message).toBe("Authentication required");
  //   });

  //   test("should require authentication for deleting topic", async () => {
  //     const result = await makeGraphQLRequest(
  //       DELETE_FAQ_TOPIC,
  //       {
  //         id: "some-topic-id",
  //       }
  //     );

  //     expect(result.errors).toBeDefined();
  //     expect(result.errors[0].message).toBe("Authentication required");
  //   });

  //   test("should require authentication for creating answer", async () => {
  //     const result = await makeGraphQLRequest(
  //       CREATE_FAQ_ANSWER,
  //       {
  //         input: {
  //           topicId: "some-topic-id",
  //           question: "Test Question",
  //           answer: "Test Answer",
  //         },
  //       }
  //     );

  //     expect(result.errors).toBeDefined();
  //     expect(result.errors[0].message).toBe("Authentication required");
  //   });

  //   test("should require authentication for updating answer", async () => {
  //     const result = await makeGraphQLRequest(
  //       UPDATE_FAQ_ANSWER,
  //       {
  //         input: {
  //           id: "some-answer-id",
  //           updateData: {
  //             question: "Updated Question",
  //             answer: "Updated Answer"
  //           }
  //         },
  //       }
  //     );

  //     expect(result.errors).toBeDefined();
  //     expect(result.errors[0].message).toBe("Authentication required");
  //   });

  //   test("should require authentication for deleting answer", async () => {
  //     const result = await makeGraphQLRequest(
  //       DELETE_FAQ_ANSWER,
  //       {
  //         id: "some-answer-id",
  //       }
  //     );

  //     expect(result.errors).toBeDefined();
  //     expect(result.errors[0].message).toBe("Authentication required");
  //   });
  // });

  // describe("Access Control Tests", () => {
  //   test("should not allow non-owner to create topic in business", async () => {
  //     const result = await makeGraphQLRequest(
  //       CREATE_FAQ_TOPIC,
  //       {
  //         input: {
  //           name: "Test Topic",
  //           parentId: businessId,
  //           type: "business"
  //         },
  //       },
  //       accessToken2
  //     );

  //     expect(result.errors).toBeDefined();
  //     expect(result.errors[0].message).toBe("User does not have required company permissions");
  //   });

  //   test("should not allow non-owner to create answer in topic", async () => {
  //     // First create a topic as owner
  //     const createResult = await makeGraphQLRequest(
  //       CREATE_FAQ_TOPIC,
  //       {
  //         input: {
  //           name: "Test Topic",
  //           parentId: businessId,
  //           type: "business"
  //         },
  //       },
  //       accessToken
  //     );

  //     expect(createResult.errors).toBeUndefined();
  //     topicId = createResult.data.createFaqTopic.id;

  //     // Try to create answer as non-owner
  //     const result = await makeGraphQLRequest(
  //       CREATE_FAQ_ANSWER,
  //       {
  //         input: {
  //           topicId,
  //           question: "Test Question",
  //           answer: "Test Answer",
  //         },
  //       },
  //       accessToken2
  //     );

  //     expect(result.errors).toBeDefined();
  //     expect(result.errors[0].message).toBe("User does not have required company permissions");
  //   });

  //   test("should not allow non-owner to update topic", async () => {
  //     const result = await makeGraphQLRequest(
  //       UPDATE_FAQ_TOPIC,
  //       {
  //         input: {
  //           id: topicId,
  //           updateData: {
  //             name: "Updated Topic Name"
  //           }
  //         },
  //       },
  //       accessToken2
  //     );

  //     expect(result.errors).toBeDefined();
  //     expect(result.errors[0].message).toBe("User does not have required company permissions");
  //   });

  //   test("should not allow non-owner to delete topic", async () => {
  //     const result = await makeGraphQLRequest(
  //       DELETE_FAQ_TOPIC,
  //       {
  //         id: topicId,
  //       },
  //       accessToken2
  //     );

  //     expect(result.errors).toBeDefined();
  //     expect(result.errors[0].message).toBe("User does not have required company permissions");
  //   });

  //   test("should not allow non-owner to update answer", async () => {
  //     // First create an answer as owner
  //     const createResult = await makeGraphQLRequest(
  //       CREATE_FAQ_ANSWER,
  //       {
  //         input: {
  //           topicId,
  //           question: "Test Question",
  //           answer: "Test Answer",
  //         },
  //       },
  //       accessToken
  //     );

  //     expect(createResult.errors).toBeUndefined();
  //     answerId = createResult.data.createFaqAnswer.id;

  //     // Try to update as non-owner
  //     const result = await makeGraphQLRequest(
  //       UPDATE_FAQ_ANSWER,
  //       {
  //         input: {
  //           id: answerId,
  //           updateData: {
  //             question: "Updated Question",
  //             answer: "Updated Answer"
  //           }
  //         },
  //       },
  //       accessToken2
  //     );

  //     expect(result.errors).toBeDefined();
  //     expect(result.errors[0].message).toBe("User does not have required company permissions");
  //   });

  //   test("should not allow non-owner to delete answer", async () => {
  //     const result = await makeGraphQLRequest(
  //       DELETE_FAQ_ANSWER,
  //       {
  //         id: answerId,
  //       },
  //       accessToken2
  //     );

  //     expect(result.errors).toBeDefined();
  //     expect(result.errors[0].message).toBe("User does not have required company permissions");
  //   });
  // });

  describe("Topics", () => {
    test("should create a topic", async () => {
      const result = await makeGraphQLRequest(
        CREATE_FAQ_TOPIC,
        {
          input: {
            name: "Test Topic",
            parentId: businessId,
            type: "business"
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.createFaqTopic).toBeDefined();
      expect(result.data.createFaqTopic.name).toBe("Test Topic");
      expect(result.data.createFaqTopic.parentId).toBe(businessId);
      expect(result.data.createFaqTopic.ownerId).toBe(companyId);
      expect(result.data.createFaqTopic.ownerType).toBe("company");
      expect(result.data.createFaqTopic.creator).toBe(userId);

      topicId = result.data.createFaqTopic.id;
    });

    test("should get topic by id", async () => {
      const result = await makeGraphQLRequest(
        GET_FAQ_TOPIC,
        {
          id: topicId,
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getFaqTopic).toBeDefined();
      expect(result.data.getFaqTopic.id).toBe(topicId);
      expect(result.data.getFaqTopic.name).toBe("Test Topic");
      expect(result.data.getFaqTopic.ownerId).toBe(companyId);
      expect(result.data.getFaqTopic.ownerType).toBe("company");
    });

    test("should get topics with filter", async () => {
      const result = await makeGraphQLRequest(
        GET_FAQ_TOPICS,
        {
          input: {
            filter: {
              parentId: { $in: [businessId] },
            },
          }
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getFaqTopics).toBeDefined();
      expect(result.data.getFaqTopics).toBeArray();
      expect(result.data.getFaqTopics.length).toBeGreaterThan(0);
      expect(result.data.getFaqTopics[0].parentId).toBe(businessId);
      expect(result.data.getFaqTopics[0].ownerId).toBe(companyId);
      expect(result.data.getFaqTopics[0].ownerType).toBe("company");
    });

    test("should update topic", async () => {
      const result = await makeGraphQLRequest(
        UPDATE_FAQ_TOPIC,
        {
          input: {
            id: topicId,
            updateData: {
              name: "Updated Topic Name"
            }
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.updateFaqTopic).toBeDefined();
      expect(result.data.updateFaqTopic.id).toBe(topicId);
      expect(result.data.updateFaqTopic.name).toBe("Updated Topic Name");
      expect(result.data.updateFaqTopic.ownerId).toBe(companyId);
      expect(result.data.updateFaqTopic.ownerType).toBe("company");
    });

    test("should delete topic", async () => {
      const result = await makeGraphQLRequest(
        DELETE_FAQ_TOPIC,
        {
          id: topicId,
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.deleteFaqTopic).toBe(topicId);

      // Verify topic is deleted
      const getResult = await makeGraphQLRequest(
        GET_FAQ_TOPIC,
        {
          id: topicId,
        },
        accessToken
      );

      expect(getResult.errors).toBeDefined();
      expect(getResult.errors[0].message).toBeDefined();
    });
  });

  describe("Answers", () => {
    test("should create an answer", async () => {
      // First create a topic
      const topicResult = await makeGraphQLRequest(
        CREATE_FAQ_TOPIC,
        {
          input: {
            name: "Test Topic",
            parentId: businessId,
            type: "business"
          },
        },
        accessToken
      );

      expect(topicResult.errors).toBeUndefined();
      topicId = topicResult.data.createFaqTopic.id;

      // Create answer
      const result = await makeGraphQLRequest(
        CREATE_FAQ_ANSWER,
        {
          input: {
            topicId,
            question: "Test Question",
            answer: "Test Answer",
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.createFaqAnswer).toBeDefined();
      expect(result.data.createFaqAnswer.question).toBe("Test Question");
      expect(result.data.createFaqAnswer.answer).toBe("Test Answer");
      expect(result.data.createFaqAnswer.topicId).toBe(topicId);
      expect(result.data.createFaqAnswer.ownerId).toBe(companyId);
      expect(result.data.createFaqAnswer.ownerType).toBe("company");
      expect(result.data.createFaqAnswer.creator).toBe(userId);

      answerId = result.data.createFaqAnswer.id;
    });

    test("should get answer by id", async () => {
      const result = await makeGraphQLRequest(
        GET_FAQ_ANSWER,
        {
          id: answerId,
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getFaqAnswer).toBeDefined();
      expect(result.data.getFaqAnswer.id).toBe(answerId);
      expect(result.data.getFaqAnswer.question).toBe("Test Question");
      expect(result.data.getFaqAnswer.answer).toBe("Test Answer");
      expect(result.data.getFaqAnswer.ownerId).toBe(companyId);
      expect(result.data.getFaqAnswer.ownerType).toBe("company");
    });

    test("should get answers with filter", async () => {
      const result = await makeGraphQLRequest(
        GET_FAQ_ANSWERS,
        {
          input: {
            filter: {
              topicId: { $in: [topicId] },
            },
          }
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getFaqAnswers).toBeDefined();
      expect(result.data.getFaqAnswers).toBeArray();
      expect(result.data.getFaqAnswers.length).toBeGreaterThan(0);
      expect(result.data.getFaqAnswers[0].topicId).toBe(topicId);
      expect(result.data.getFaqAnswers[0].ownerId).toBe(companyId);
      expect(result.data.getFaqAnswers[0].ownerType).toBe("company");
    });

    test("should update answer", async () => {
      const result = await makeGraphQLRequest(
        UPDATE_FAQ_ANSWER,
        {
          input: {
            id: answerId,
            updateData: {
              question: "Updated Question",
              answer: "Updated Answer"
            }
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.updateFaqAnswer).toBeDefined();
      expect(result.data.updateFaqAnswer.id).toBe(answerId);
      expect(result.data.updateFaqAnswer.question).toBe("Updated Question");
      expect(result.data.updateFaqAnswer.answer).toBe("Updated Answer");
      expect(result.data.updateFaqAnswer.ownerId).toBe(companyId);
      expect(result.data.updateFaqAnswer.ownerType).toBe("company");
    });

    test("should delete answer", async () => {
      const result = await makeGraphQLRequest(
        DELETE_FAQ_ANSWER,
        {
          id: answerId,
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.deleteFaqAnswer).toBe(answerId);

      // Verify answer is deleted
      const getResult = await makeGraphQLRequest(
        GET_FAQ_ANSWER,
        {
          id: answerId,
        },
        accessToken
      );

      expect(getResult.errors).toBeDefined();
      expect(getResult.errors[0].message).toBeDefined();
    });
  });
});