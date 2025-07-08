import { expect, test, describe, beforeAll } from "bun:test";
import { ethers, HDNodeWallet, JsonRpcProvider } from "ethers";
import { TESTNET_RPC } from "./utils/config";
import { makeGraphQLRequest } from "./utils/graphql/makeGraphQLRequest";
import { authenticate } from "./utils/authenticate";
import {
  SET_REACTION,
  RESET_REACTION,
  GET_ENTITY_REACTIONS,
  GET_REACTIONS,
} from "./utils/graphql/schema/reactions";
import { CREATE_BUSINESS } from "./utils/graphql/schema/rwa";
import { CREATE_COMPANY } from "./utils/graphql/schema/company";
import { CREATE_BLOG, CREATE_POST } from "./utils/graphql/schema/blog";

describe("Reactions Flow Tests", () => {
  let chainId: string;
  let provider: JsonRpcProvider;
  let wallet: HDNodeWallet;
  let wallet2: HDNodeWallet;
  let accessToken: string;
  let accessToken2: string;
  let userId: string;
  let userId2: string;
  let companyId: string;
  let businessId: string;
  let blogId: string;
  let postId: string;
  let reactionId: string;

  beforeAll(async () => {
    chainId = "97";
    provider = new ethers.JsonRpcProvider(TESTNET_RPC);
    wallet = ethers.Wallet.createRandom().connect(provider);
    wallet2 = ethers.Wallet.createRandom().connect(provider);
    ({ accessToken, userId } = await authenticate(wallet));
    ({ accessToken: accessToken2, userId: userId2 } = await authenticate(wallet2));

    // Create company
    const companyResult = await makeGraphQLRequest(
      CREATE_COMPANY,
      {
        input: {
          name: "Test Company for Reactions",
          description: "Test Description"
        },
      },
      accessToken
    );
    companyId = companyResult.data.createCompany.id;

    // Create business
    const businessResult = await makeGraphQLRequest(
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
    businessId = businessResult.data.createBusiness.id;

    // Create blog
    const blogResult = await makeGraphQLRequest(
      CREATE_BLOG,
      {
        input: {
          name: "Test Blog",
          parentId: businessId,
          type: "business"
        },
      },
      accessToken
    );
    blogId = blogResult.data.createBlog.id;

    // Create post
    const postResult = await makeGraphQLRequest(
      CREATE_POST,
      {
        input: {
          blogId,
          title: "Test Post",
          content: "Test Content",
        },
      },
      accessToken
    );
    postId = postResult.data.createPost.id;
  });

  describe("Authentication Tests", () => {
    test("should require authentication for setting reaction", async () => {
      const result = await makeGraphQLRequest(
        SET_REACTION,
        {
          input: {
            parentId: postId,
            parentType: "post",
            reaction: "like"
          },
        }
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });

    test("should require authentication for resetting reaction", async () => {
      const result = await makeGraphQLRequest(
        RESET_REACTION,
        {
          input: {
            parentId: postId,
            parentType: "post",
            reaction: "like"
          },
        }
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });
  });

  describe("Set Reactions", () => {
    test("should set a like reaction on post", async () => {
      const result = await makeGraphQLRequest(
        SET_REACTION,
        {
          input: {
            parentId: postId,
            parentType: "post",
            reaction: "like"
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.setReaction).toBeDefined();
      expect(result.data.setReaction.parentId).toBe(postId);
      expect(result.data.setReaction.parentType).toBe("post");
      expect(result.data.setReaction.userId).toBe(userId);
      expect(result.data.setReaction.reaction).toBe("like");
      expect(result.data.setReaction.id).toBeDefined();
      expect(result.data.setReaction.createdAt).toBeDefined();
      expect(result.data.setReaction.updatedAt).toBeDefined();

      reactionId = result.data.setReaction.id;
    });

    test("should set a dislike reaction on post", async () => {
      const result = await makeGraphQLRequest(
        SET_REACTION,
        {
          input: {
            parentId: postId,
            parentType: "post",
            reaction: "dislike"
          },
        },
        accessToken2
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.setReaction).toBeDefined();
      expect(result.data.setReaction.parentId).toBe(postId);
      expect(result.data.setReaction.parentType).toBe("post");
      expect(result.data.setReaction.userId).toBe(userId2);
      expect(result.data.setReaction.reaction).toBe("dislike");
    });

    test("should set a love reaction on business", async () => {
      const result = await makeGraphQLRequest(
        SET_REACTION,
        {
          input: {
            parentId: businessId,
            parentType: "business",
            reaction: "love"
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.setReaction).toBeDefined();
      expect(result.data.setReaction.parentId).toBe(businessId);
      expect(result.data.setReaction.parentType).toBe("business");
      expect(result.data.setReaction.userId).toBe(userId);
      expect(result.data.setReaction.reaction).toBe("love");
    });

    test("should update existing reaction when setting different reaction", async () => {
      // First set a like
      const firstResult = await makeGraphQLRequest(
        SET_REACTION,
        {
          input: {
            parentId: blogId,
            parentType: "blog",
            reaction: "like"
          },
        },
        accessToken
      );

      expect(firstResult.errors).toBeUndefined();
      expect(firstResult.data.setReaction.reaction).toBe("like");
      const firstReactionId = firstResult.data.setReaction.id;

      // Then set a dislike (should update the same reaction)
      const secondResult = await makeGraphQLRequest(
        SET_REACTION,
        {
          input: {
            parentId: blogId,
            parentType: "blog",
            reaction: "dislike"
          },
        },
        accessToken
      );

      expect(secondResult.errors).toBeUndefined();
      expect(secondResult.data.setReaction.reaction).toBe("dislike");
      expect(secondResult.data.setReaction.id).toBe(firstReactionId);
      expect(secondResult.data.setReaction.parentId).toBe(blogId);
      expect(secondResult.data.setReaction.parentType).toBe("blog");
      expect(secondResult.data.setReaction.userId).toBe(userId);
    });

    test("should handle various reaction types", async () => {
      const reactions = ["angry", "sad", "wow", "haha"];
      
      for (const reaction of reactions) {
        const result = await makeGraphQLRequest(
          SET_REACTION,
          {
            input: {
              parentId: companyId,
              parentType: "company",
              reaction
            },
          },
          accessToken
        );

        expect(result.errors).toBeUndefined();
        expect(result.data.setReaction.reaction).toBe(reaction);
        expect(result.data.setReaction.parentId).toBe(companyId);
        expect(result.data.setReaction.parentType).toBe("company");
        expect(result.data.setReaction.userId).toBe(userId);
      }
    });
  });

  describe("Get Entity Reactions", () => {
    test("should get reactions for post", async () => {
      const result = await makeGraphQLRequest(
        GET_ENTITY_REACTIONS,
        {
          parentId: postId,
          parentType: "post"
        }
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getEntityReactions).toBeDefined();
      expect(result.data.getEntityReactions.reactions).toBeDefined();
      expect(result.data.getEntityReactions.userReactions).toBeDefined();
      expect(Array.isArray(result.data.getEntityReactions.userReactions)).toBe(true);
      
      // Should have reactions from both users
      expect(typeof result.data.getEntityReactions.reactions).toBe("object");
      expect(result.data.getEntityReactions.reactions.like).toBe(1);
      expect(result.data.getEntityReactions.reactions.dislike).toBe(1);
    });

    test("should get reactions for business", async () => {
      const result = await makeGraphQLRequest(
        GET_ENTITY_REACTIONS,
        {
          parentId: businessId,
          parentType: "business"
        }
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getEntityReactions).toBeDefined();
      expect(result.data.getEntityReactions.reactions).toBeDefined();
      expect(result.data.getEntityReactions.userReactions).toBeDefined();
      expect(Array.isArray(result.data.getEntityReactions.userReactions)).toBe(true);
      
      // Should have love reaction
      expect(result.data.getEntityReactions.reactions.love).toBe(1);
    });

    test("should get reactions for blog", async () => {
      const result = await makeGraphQLRequest(
        GET_ENTITY_REACTIONS,
        {
          parentId: blogId,
          parentType: "blog"
        }
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getEntityReactions).toBeDefined();
      expect(result.data.getEntityReactions.reactions).toBeDefined();
      expect(result.data.getEntityReactions.userReactions).toBeDefined();
      
      // Should have dislike reaction (updated from like)
      expect(result.data.getEntityReactions.reactions.dislike).toBe(1);
      expect(result.data.getEntityReactions.reactions.like).toBeUndefined();
    });

    test("should get reactions for company with multiple reaction types", async () => {
      const result = await makeGraphQLRequest(
        GET_ENTITY_REACTIONS,
        {
          parentId: companyId,
          parentType: "company"
        }
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getEntityReactions).toBeDefined();
      expect(result.data.getEntityReactions.reactions).toBeDefined();
      
      // Should have the last reaction set (haha, since we updated the same user's reaction)
      expect(result.data.getEntityReactions.reactions.haha).toBe(1);
      expect(result.data.getEntityReactions.reactions.angry).toBeUndefined();
      expect(result.data.getEntityReactions.reactions.sad).toBeUndefined();
      expect(result.data.getEntityReactions.reactions.wow).toBeUndefined();
    });

    test("should return empty reactions for entity with no reactions", async () => {
      // Create a new post without reactions
      const newPostResult = await makeGraphQLRequest(
        CREATE_POST,
        {
          input: {
            blogId,
            title: "Post Without Reactions",
            content: "No reactions here",
          },
        },
        accessToken
      );

      const newPostId = newPostResult.data.createPost.id;

      const result = await makeGraphQLRequest(
        GET_ENTITY_REACTIONS,
        {
          parentId: newPostId,
          parentType: "post"
        }
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getEntityReactions).toBeDefined();
      expect(result.data.getEntityReactions.reactions).toEqual({});
      expect(result.data.getEntityReactions.userReactions).toEqual([]);
    });

    test("should get user reactions when authenticated", async () => {
      const result = await makeGraphQLRequest(
        GET_ENTITY_REACTIONS,
        {
          parentId: postId,
          parentType: "post"
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getEntityReactions.userReactions).toContain("like");
    });

    test("should get different user reactions for different users", async () => {
      const result1 = await makeGraphQLRequest(
        GET_ENTITY_REACTIONS,
        {
          parentId: postId,
          parentType: "post"
        },
        accessToken
      );

      const result2 = await makeGraphQLRequest(
        GET_ENTITY_REACTIONS,
        {
          parentId: postId,
          parentType: "post"
        },
        accessToken2
      );

      expect(result1.errors).toBeUndefined();
      expect(result2.errors).toBeUndefined();
      
      expect(result1.data.getEntityReactions.userReactions).toContain("like");
      expect(result2.data.getEntityReactions.userReactions).toContain("dislike");
      
      expect(result1.data.getEntityReactions.userReactions).not.toContain("dislike");
      expect(result2.data.getEntityReactions.userReactions).not.toContain("like");
    });
  });

  describe("Reset Reactions", () => {
    test("should reset user reaction", async () => {
      const result = await makeGraphQLRequest(
        RESET_REACTION,
        {
          input: {
            parentId: postId,
            parentType: "post",
            reaction: "like"
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.resetReaction).toBeDefined();
      expect(result.data.resetReaction.id).toBe(reactionId);
      expect(result.data.resetReaction.parentId).toBe(postId);
      expect(result.data.resetReaction.parentType).toBe("post");
      expect(result.data.resetReaction.userId).toBe(userId);
      expect(result.data.resetReaction.reaction).toBe("like");
    });

    test("should verify reaction was removed after reset", async () => {
      const result = await makeGraphQLRequest(
        GET_ENTITY_REACTIONS,
        {
          parentId: postId,
          parentType: "post"
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getEntityReactions.userReactions).not.toContain("like");
      expect(result.data.getEntityReactions.reactions.like).toBeUndefined();
      expect(result.data.getEntityReactions.reactions.dislike).toBe(1); // Other user's reaction should remain
    });

    test("should return null when resetting non-existent reaction", async () => {
      const result = await makeGraphQLRequest(
        RESET_REACTION,
        {
          input: {
            parentId: postId,
            parentType: "post",
            reaction: "love"
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.resetReaction).toBeNull();
    });

    test("should reset reaction on different entity types", async () => {
      // Reset business reaction
      const businessResult = await makeGraphQLRequest(
        RESET_REACTION,
        {
          input: {
            parentId: businessId,
            parentType: "business",
            reaction: "love"
          },
        },
        accessToken
      );

      expect(businessResult.errors).toBeUndefined();
      expect(businessResult.data.resetReaction).toBeDefined();
      expect(businessResult.data.resetReaction.parentType).toBe("business");

      // Reset blog reaction
      const blogResult = await makeGraphQLRequest(
        RESET_REACTION,
        {
          input: {
            parentId: blogId,
            parentType: "blog",
            reaction: "dislike"
          },
        },
        accessToken
      );

      expect(blogResult.errors).toBeUndefined();
      expect(blogResult.data.resetReaction).toBeDefined();
      expect(blogResult.data.resetReaction.parentType).toBe("blog");

      // Reset company reaction
      const companyResult = await makeGraphQLRequest(
        RESET_REACTION,
        {
          input: {
            parentId: companyId,
            parentType: "company",
            reaction: "haha"
          },
        },
        accessToken
      );

      expect(companyResult.errors).toBeUndefined();
      expect(companyResult.data.resetReaction).toBeDefined();
      expect(companyResult.data.resetReaction.parentType).toBe("company");
    });

    test("should not allow resetting other user's reaction", async () => {
      // User2 still has dislike reaction on post
      const result = await makeGraphQLRequest(
        RESET_REACTION,
        {
          input: {
            parentId: postId,
            parentType: "post",
            reaction: "dislike"
          },
        },
        accessToken // User1 trying to reset User2's reaction
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.resetReaction).toBeNull(); // Should return null since user1 doesn't have dislike reaction
    });
  });

  describe("Edge Cases", () => {
    test("should handle invalid parent type", async () => {
      const result = await makeGraphQLRequest(
        SET_REACTION,
        {
          input: {
            parentId: "some-id",
            parentType: "invalid_type",
            reaction: "like"
          },
        },
        accessToken
      );

      // This might return an error or handle gracefully depending on implementation
      // Adjust expectation based on actual behavior
      expect(result.errors).toBeDefined();
    });

    test("should handle invalid parent id", async () => {
      const result = await makeGraphQLRequest(
        SET_REACTION,
        {
          input: {
            parentId: "non-existent-id",
            parentType: "post",
            reaction: "like"
          },
        },
        accessToken
      );

      // This might return an error or handle gracefully depending on implementation
      expect(result.errors).toBeDefined();
    });

    test("should handle invalid reaction type", async () => {
      const result = await makeGraphQLRequest(
        SET_REACTION,
        {
          input: {
            parentId: postId,
            parentType: "post",
            reaction: "invalid_reaction"
          },
        },
        accessToken
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toContain("Value \"invalid_reaction\" does not exist in \"ReactionType\" enum");
    });

    test("should handle empty reaction string", async () => {
      const result = await makeGraphQLRequest(
        SET_REACTION,
        {
          input: {
            parentId: postId,
            parentType: "post",
            reaction: ""
          },
        },
        accessToken
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toContain("Value \"\" does not exist in \"ReactionType\" enum");
    });

    test("should only accept valid enum values", async () => {
      const validReactions = ["like", "dislike", "love", "angry", "sad", "wow", "haha"];
      
      for (const reaction of validReactions) {
        const result = await makeGraphQLRequest(
          SET_REACTION,
          {
            input: {
              parentId: postId,
              parentType: "post",
              reaction
            },
          },
          accessToken
        );

        expect(result.errors).toBeUndefined();
        expect(result.data.setReaction.reaction).toBe(reaction);
      }
    });
  });

  describe("Authentication Tests", () => {
    test("should fail to set reaction without authentication", async () => {
      const result = await makeGraphQLRequest(SET_REACTION, {
        input: {
          parentId: "test-parent-1",
          parentType: "post",
          reaction: "like",
        },
      });

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });

    test("should fail to set reaction with invalid token", async () => {
      const result = await makeGraphQLRequest(
        SET_REACTION,
        {
          input: {
            parentId: "test-parent-1",
            parentType: "post",
            reaction: "like",
          },
        },
        "invalid_token"
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });

    test("should fail to reset reaction without authentication", async () => {
      const result = await makeGraphQLRequest(RESET_REACTION, {
        input: {
          parentId: "test-parent-1",
          parentType: "post",
          reaction: "like",
        },
      });

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });

    test("should fail to reset reaction with invalid token", async () => {
      const result = await makeGraphQLRequest(
        RESET_REACTION,
        {
          input: {
            parentId: "test-parent-1",
            parentType: "post",
            reaction: "like",
          },
        },
        "invalid_token"
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });

    test("should fail to get entity reactions without authentication", async () => {
      const result = await makeGraphQLRequest(GET_ENTITY_REACTIONS, {
        parentId: "test-parent-1",
        parentType: "post",
      });

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });

    test("should fail to get entity reactions with invalid token", async () => {
      const result = await makeGraphQLRequest(
        GET_ENTITY_REACTIONS,
        {
          parentId: "test-parent-1",
          parentType: "post",
        },
        "invalid_token"
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });

    test("should fail to get reactions without authentication", async () => {
      const result = await makeGraphQLRequest(GET_REACTIONS, {
        filter: {
          parentId: { $eq: "test-parent-1" },
        },
      });

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });

    test("should fail to get reactions with invalid token", async () => {
      const result = await makeGraphQLRequest(
        GET_REACTIONS,
        {
          filter: {
            parentId: { $eq: "test-parent-1" },
          },
        },
        "invalid_token"
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });
  });

  describe("Get Reactions Tests", () => {
    test("should get reactions with filter", async () => {
      const result = await makeGraphQLRequest(
        GET_REACTIONS,
        {
          filter: {
            parentId: { $in: [postId] },
          },
          limit: 10,
          offset: 0,
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getReactions).toBeDefined();
      expect(Array.isArray(result.data.getReactions)).toBe(true);
      expect(result.data.getReactions.length).toBeGreaterThan(0);

      const reaction = result.data.getReactions[0];
      expect(reaction.id).toBeDefined();
      expect(reaction.parentId).toBe(postId);
      expect(reaction.parentType).toBe("post");
      expect(reaction.userId).toBeDefined();
      expect(reaction.reaction).toBeDefined();
      expect(reaction.createdAt).toBeDefined();
      expect(reaction.updatedAt).toBeDefined();
    });

    test("should get reactions with multiple filters", async () => {
      const result = await makeGraphQLRequest(
        GET_REACTIONS,
        {
          filter: {
            parentType: { $eq: "post" },
            reaction: { $in: ["like", "love"] },
          },
          sort: { createdAt: -1 },
          limit: 5,
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getReactions).toBeDefined();
      expect(Array.isArray(result.data.getReactions)).toBe(true);

      if (result.data.getReactions.length > 0) {
        const reaction = result.data.getReactions[0];
        expect(reaction.parentType).toBe("post");
        expect(["like", "love"]).toContain(reaction.reaction);
      }
    });

    test("should get reactions with user filter", async () => {
      const result = await makeGraphQLRequest(
        GET_REACTIONS,
        {
          filter: {
            userId: { $eq: userId },
          },
          limit: 20,
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getReactions).toBeDefined();
      expect(Array.isArray(result.data.getReactions)).toBe(true);

      result.data.getReactions.forEach((reaction: any) => {
        expect(reaction.userId).toBe(userId);
      });
    });

    test("should get empty array for non-existent parent", async () => {
      const result = await makeGraphQLRequest(
        GET_REACTIONS,
        {
          filter: {
            parentId: { $eq: "non-existent-parent" },
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getReactions).toBeDefined();
      expect(Array.isArray(result.data.getReactions)).toBe(true);
      expect(result.data.getReactions.length).toBe(0);
    });

    test("should handle pagination correctly", async () => {
      // First, create multiple reactions
      await makeGraphQLRequest(
        SET_REACTION,
        {
          input: {
            parentId: "test-parent-pagination",
            parentType: "post",
            reaction: "like",
          },
        },
        accessToken
      );

      await makeGraphQLRequest(
        SET_REACTION,
        {
          input: {
            parentId: "test-parent-pagination-2",
            parentType: "post",
            reaction: "love",
          },
        },
        accessToken
      );

      // Test pagination
      const firstPage = await makeGraphQLRequest(
        GET_REACTIONS,
        {
          filter: {
            userId: { $eq: userId },
          },
          limit: 1,
          offset: 0,
          sort: { createdAt: -1 },
        },
        accessToken
      );

      expect(firstPage.errors).toBeUndefined();
      expect(firstPage.data.getReactions.length).toBe(1);

      const secondPage = await makeGraphQLRequest(
        GET_REACTIONS,
        {
          filter: {
            userId: { $eq: userId },
          },
          limit: 1,
          offset: 1,
          sort: { createdAt: -1 },
        },
        accessToken
      );

      expect(secondPage.errors).toBeUndefined();
      expect(secondPage.data.getReactions.length).toBe(1);

      // Ensure different reactions
      if (firstPage.data.getReactions.length > 0 && secondPage.data.getReactions.length > 0) {
        expect(firstPage.data.getReactions[0].id).not.toBe(
          secondPage.data.getReactions[0].id
        );
      }
    });

    test("should get reactions by parent type", async () => {
      const result = await makeGraphQLRequest(
        GET_REACTIONS,
        {
          filter: {
            parentType: { $eq: "business" },
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getReactions).toBeDefined();
      expect(Array.isArray(result.data.getReactions)).toBe(true);

      result.data.getReactions.forEach((reaction: any) => {
        expect(reaction.parentType).toBe("business");
      });
    });

    test("should get reactions with sorting", async () => {
      const ascResult = await makeGraphQLRequest(
        GET_REACTIONS,
        {
          filter: {
            userId: { $eq: userId },
          },
          sort: { createdAt: 1 },
          limit: 10,
        },
        accessToken
      );

      const descResult = await makeGraphQLRequest(
        GET_REACTIONS,
        {
          filter: {
            userId: { $eq: userId },
          },
          sort: { createdAt: -1 },
          limit: 10,
        },
        accessToken
      );

      expect(ascResult.errors).toBeUndefined();
      expect(descResult.errors).toBeUndefined();

      if (ascResult.data.getReactions.length > 1 && descResult.data.getReactions.length > 1) {
        expect(ascResult.data.getReactions[0].createdAt).toBeLessThanOrEqual(
          ascResult.data.getReactions[1].createdAt
        );
        expect(descResult.data.getReactions[0].createdAt).toBeGreaterThanOrEqual(
          descResult.data.getReactions[1].createdAt
        );
      }
    });

    test("should get reactions with complex filter", async () => {
      const result = await makeGraphQLRequest(
        GET_REACTIONS,
        {
          filter: {
            $and: [
              { parentType: { $eq: "post" } },
              { reaction: { $in: ["like", "dislike"] } },
              { userId: { $eq: userId } }
            ]
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getReactions).toBeDefined();
      expect(Array.isArray(result.data.getReactions)).toBe(true);

      result.data.getReactions.forEach((reaction: any) => {
        expect(reaction.parentType).toBe("post");
        expect(["like", "dislike"]).toContain(reaction.reaction);
        expect(reaction.userId).toBe(userId);
      });
    });
  });
});