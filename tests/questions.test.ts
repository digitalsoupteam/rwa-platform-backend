import { expect, test, describe, beforeAll } from "bun:test";
import { ethers, HDNodeWallet, JsonRpcProvider } from "ethers";
import { TESTNET_RPC } from "./utils/config";
import { makeGraphQLRequest } from "./utils/graphql/makeGraphQLRequest";
import { authenticate } from "./utils/authenticate";
import {
  CREATE_TOPIC,
  GET_TOPIC,
  GET_TOPICS,
  CREATE_QUESTION,
  UPDATE_QUESTION_TEXT,
  CREATE_QUESTION_ANSWER,
  UPDATE_QUESTION_ANSWER,
  GET_QUESTION,
  GET_QUESTIONS,
  TOGGLE_QUESTION_LIKE,
  DELETE_QUESTION,
  DELETE_TOPIC,
  UPDATE_TOPIC,
} from "./utils/graphql/schema/questions";
import { CREATE_BUSINESS } from "./utils/graphql/schema/rwa";
import { CREATE_COMPANY } from "./utils/graphql/schema/company";

describe("Questions Flow", () => {
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
  let questionId: string;

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

  describe("Authentication Tests", () => {
    test("should require authentication for creating topic", async () => {
      const result = await makeGraphQLRequest(
        CREATE_TOPIC,
        {
          input: {
            name: "Test Topic",
            parentId: businessId,
            type: "business"
          },
        }
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });

    test("should require authentication for creating question answer", async () => {
      const result = await makeGraphQLRequest(
        CREATE_QUESTION_ANSWER,
        {
          input: {
            id: "some-question-id",
            text: "Test Answer",
          },
        }
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });

    test("should require authentication for creating question", async () => {
      const result = await makeGraphQLRequest(
        CREATE_QUESTION,
        {
          input: {
            topicId: "some-topic-id",
            text: "Test Question",
          },
        }
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });

    test("should require authentication for updating topic", async () => {
      const result = await makeGraphQLRequest(
        UPDATE_TOPIC,
        {
          input: {
            id: "some-topic-id",
            updateData: {
              name: "Updated Topic Name"
            }
          },
        }
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });

    test("should require authentication for deleting topic", async () => {
      const result = await makeGraphQLRequest(
        DELETE_TOPIC,
        {
          id: "some-topic-id",
        }
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });

    test("should require authentication for deleting question", async () => {
      const result = await makeGraphQLRequest(
        DELETE_QUESTION,
        {
          id: "some-question-id",
        }
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });
  });

  describe("Access Control Tests", () => {
    test("should not allow non-owner to create topic in business", async () => {
      const result = await makeGraphQLRequest(
        CREATE_TOPIC,
        {
          input: {
            name: "Test Topic",
            parentId: businessId,
            type: "business"
          },
        },
        accessToken2
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("User does not have required company permissions");
    });

    test("should not allow non-owner to create question in topic", async () => {
      // First create a topic as owner
      const createResult = await makeGraphQLRequest(
        CREATE_TOPIC,
        {
          input: {
            name: "Test Topic",
            parentId: businessId,
            type: "business"
          },
        },
        accessToken
      );

      expect(createResult.errors).toBeUndefined();
      topicId = createResult.data.createTopic.id;

      // Try to create question as non-owner
      const result = await makeGraphQLRequest(
        CREATE_QUESTION,
        {
          input: {
            topicId,
            text: "Test Question",
          },
        },
        accessToken2
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("User does not have required company permissions");
    });

    test("should not allow non-owner to update question text", async () => {
      // First create a question as owner
      const createResult = await makeGraphQLRequest(
        CREATE_QUESTION,
        {
          input: {
            topicId,
            text: "Test Question",
          },
        },
        accessToken
      );

      expect(createResult.errors).toBeUndefined();
      questionId = createResult.data.createQuestion.id;

      // Try to update as non-owner
      const result = await makeGraphQLRequest(
        UPDATE_QUESTION_TEXT,
        {
          input: {
            id: questionId,
            updateData: {
              text: "Updated Test Question"
            }
          },
        },
        accessToken2
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("User does not have required company permissions");
    });

    test("should not allow non-owner to create question answer", async () => {
      const result = await makeGraphQLRequest(
        CREATE_QUESTION_ANSWER,
        {
          input: {
            id: questionId,
            text: "Test Answer",
          },
        },
        accessToken2
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("User does not have required company permissions");
    });

    test("should not allow non-owner to update question answer", async () => {
      const result = await makeGraphQLRequest(
        UPDATE_QUESTION_ANSWER,
        {
          input: {
            id: questionId,
            updateData: {
              text: "Test Answer"
            }
          },
        },
        accessToken2
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("User does not have required company permissions");
    });

    test("should not allow non-owner to update topic", async () => {
      const result = await makeGraphQLRequest(
        UPDATE_TOPIC,
        {
          input: {
            id: topicId,
            updateData: {
              name: "Updated Topic Name"
            }
          },
        },
        accessToken2
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("User does not have required company permissions");
    });

    test("should not allow non-owner to delete topic", async () => {
      const result = await makeGraphQLRequest(
        DELETE_TOPIC,
        {
          id: topicId,
        },
        accessToken2
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("User does not have required company permissions");
    });

    test("should not allow non-owner to delete question", async () => {
      const result = await makeGraphQLRequest(
        DELETE_QUESTION,
        {
          id: questionId,
        },
        accessToken2
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("User does not have required company permissions");
    });
  });


  describe("Topics", () => {
    test("should create a topic", async () => {
      const result = await makeGraphQLRequest(
        CREATE_TOPIC,
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
      expect(result.data.createTopic).toBeDefined();
      expect(result.data.createTopic.name).toBe("Test Topic");
      expect(result.data.createTopic.parentId).toBe(businessId);
      expect(result.data.createTopic.ownerId).toBe(companyId);
      expect(result.data.createTopic.ownerType).toBe("company");
      expect(result.data.createTopic.creator).toBe(userId);
      expect(result.data.createTopic.createdAt).toBeDefined();
      expect(result.data.createTopic.updatedAt).toBeDefined();

      topicId = result.data.createTopic.id;
    });

    test("should get topic by id", async () => {
      const result = await makeGraphQLRequest(
        GET_TOPIC,
        {
          id: topicId,
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getTopic).toBeDefined();
      expect(result.data.getTopic.id).toBe(topicId);
      expect(result.data.getTopic.name).toBe("Test Topic");
      expect(result.data.getTopic.ownerId).toBe(companyId);
      expect(result.data.getTopic.ownerType).toBe("company");
      expect(result.data.getTopic.createdAt).toBeDefined();
      expect(result.data.getTopic.updatedAt).toBeDefined();
    });

    test("should get topics with filter", async () => {
      const result = await makeGraphQLRequest(
        GET_TOPICS,
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
      expect(result.data.getTopics).toBeDefined();
      expect(result.data.getTopics).toBeArray();
      expect(result.data.getTopics.length).toBeGreaterThan(0);
      expect(result.data.getTopics[0].parentId).toBe(businessId);
      expect(result.data.getTopics[0].ownerId).toBe(companyId);
      expect(result.data.getTopics[0].ownerType).toBe("company");
    });

    test("should update topic", async () => {
      const result = await makeGraphQLRequest(
        UPDATE_TOPIC,
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
      expect(result.data.updateTopic).toBeDefined();
      expect(result.data.updateTopic.id).toBe(topicId);
      expect(result.data.updateTopic.name).toBe("Updated Topic Name");
      expect(result.data.updateTopic.ownerId).toBe(companyId);
      expect(result.data.updateTopic.ownerType).toBe("company");
      expect(result.data.updateTopic.createdAt).toBeDefined();
      expect(result.data.updateTopic.updatedAt).toBeDefined();
    });
  });

  describe("Questions", () => {
    test("should create a question", async () => {
      const result = await makeGraphQLRequest(
        CREATE_QUESTION,
        {
          input: {
            topicId,
            text: "Test Question",
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.createQuestion).toBeDefined();
      expect(result.data.createQuestion.text).toBe("Test Question");
      expect(result.data.createQuestion.topicId).toBe(topicId);
      expect(result.data.createQuestion.answer).toBeNull();
      expect(result.data.createQuestion.answered).toBe(false);
      expect(result.data.createQuestion.likesCount).toBe(0);
      expect(result.data.createQuestion.ownerId).toBe(companyId);
      expect(result.data.createQuestion.ownerType).toBe("company");
      expect(result.data.createQuestion.creator).toBe(userId);

      questionId = result.data.createQuestion.id;
    });

    test("should get question by id", async () => {
      const result = await makeGraphQLRequest(
        GET_QUESTION,
        {
          id: questionId,
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getQuestion).toBeDefined();
      expect(result.data.getQuestion.id).toBe(questionId);
      expect(result.data.getQuestion.text).toBe("Test Question");
      expect(result.data.getQuestion.ownerId).toBe(companyId);
      expect(result.data.getQuestion.ownerType).toBe("company");
    });

    test("should get questions with filter", async () => {
      const result = await makeGraphQLRequest(
        GET_QUESTIONS,
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
      expect(result.data.getQuestions).toBeDefined();
      expect(result.data.getQuestions).toBeArray();
      expect(result.data.getQuestions.length).toBeGreaterThan(0);
      expect(result.data.getQuestions[0].topicId).toBe(topicId);
      expect(result.data.getQuestions[0].ownerId).toBe(companyId);
      expect(result.data.getQuestions[0].ownerType).toBe("company");
    });

    test("should update question text", async () => {
      const result = await makeGraphQLRequest(
        UPDATE_QUESTION_TEXT,
        {
          input: {
            id: questionId,
            updateData: {
              text: "Updated Test Question"
            }
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.updateQuestionText).toBeDefined();
      expect(result.data.updateQuestionText.id).toBe(questionId);
      expect(result.data.updateQuestionText.text).toBe("Updated Test Question");
      expect(result.data.updateQuestionText.ownerId).toBe(companyId);
      expect(result.data.updateQuestionText.ownerType).toBe("company");
    });

    test("should create question answer", async () => {
      const result = await makeGraphQLRequest(
        CREATE_QUESTION_ANSWER,
        {
          input: {
            id: questionId,
            text: "Initial Answer",
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.createQuestionAnswer).toBeDefined();
      expect(result.data.createQuestionAnswer.id).toBe(questionId);
      expect(result.data.createQuestionAnswer.answer.text).toBe("Initial Answer");
      expect(result.data.createQuestionAnswer.answer.userId).toBe(userId);
      expect(result.data.createQuestionAnswer.answered).toBe(true);
      expect(result.data.createQuestionAnswer.ownerId).toBe(companyId);
      expect(result.data.createQuestionAnswer.ownerType).toBe("company");
    });

    test("should update question answer", async () => {
      const result = await makeGraphQLRequest(
        UPDATE_QUESTION_ANSWER,
        {
          input: {
            id: questionId,
            updateData: {
              text: "Updated Answer"
            }
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.updateQuestionAnswer).toBeDefined();
      expect(result.data.updateQuestionAnswer.id).toBe(questionId);
      expect(result.data.updateQuestionAnswer.answer.text).toBe("Updated Answer");
      expect(result.data.updateQuestionAnswer.answer.userId).toBe(userId);
      expect(result.data.updateQuestionAnswer.answered).toBe(true);
      expect(result.data.updateQuestionAnswer.ownerId).toBe(companyId);
      expect(result.data.updateQuestionAnswer.ownerType).toBe("company");
    });

    test("should toggle question like", async () => {
      const result = await makeGraphQLRequest(
        TOGGLE_QUESTION_LIKE,
        {
          questionId,
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.toggleQuestionLike).toBe(true);

      // Verify like was added
      const getResult = await makeGraphQLRequest(
        GET_QUESTION,
        {
          id: questionId,
        },
        accessToken
      );

      expect(getResult.errors).toBeUndefined();
      expect(getResult.data.getQuestion.likesCount).toBe(1);
    });

    test("should delete question", async () => {
      const result = await makeGraphQLRequest(
        DELETE_QUESTION,
        {
          id: questionId,
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.deleteQuestion).toBe(questionId);

      // Verify question is deleted
      const getResult = await makeGraphQLRequest(
        GET_QUESTION,
        {
          id: questionId,
        },
        accessToken
      );

      expect(getResult.errors).toBeDefined();
      expect(getResult.errors[0].message).toBeDefined();
    });
  });

  test("should delete topic", async () => {
    const result = await makeGraphQLRequest(
      DELETE_TOPIC,
      {
        id: topicId,
      },
      accessToken
    );

    expect(result.errors).toBeUndefined();
    expect(result.data.deleteTopic).toBe(topicId);

    // Verify topic is deleted
    const getResult = await makeGraphQLRequest(
      GET_TOPIC,
      {
        id: topicId,
      },
      accessToken
    );

    expect(getResult.errors).toBeDefined();
    expect(getResult.errors[0].message).toBeDefined();
  });
});