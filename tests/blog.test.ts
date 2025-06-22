import { expect, test, describe, beforeAll } from "bun:test";
import { ethers, HDNodeWallet, JsonRpcProvider } from "ethers";
import { TESTNET_RPC } from "./utils/config";
import { makeGraphQLRequest } from "./utils/graphql/makeGraphQLRequest";
import { authenticate } from "./utils/authenticate";
import {
  CREATE_BLOG,
  GET_BLOG,
  GET_BLOGS,
  CREATE_POST,
  UPDATE_POST,
  DELETE_POST,
  GET_POST,
  GET_POSTS,
  DELETE_BLOG,
  UPDATE_BLOG,
} from "./utils/graphql/schema/blog";
import { CREATE_BUSINESS } from "./utils/graphql/schema/rwa";
import { CREATE_COMPANY } from "./utils/graphql/schema/company";

describe("Blog Flow", () => {
  let chainId: string;
  let provider: JsonRpcProvider;
  let wallet: HDNodeWallet;
  let wallet2: HDNodeWallet;
  let accessToken: string;
  let accessToken2: string;
  let userId: string;
  let companyId: string;
  let businessId: string;
  let blogId: string;
  let postId: string;

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
    test("should require authentication for creating blog", async () => {
      const result = await makeGraphQLRequest(
        CREATE_BLOG,
        {
          input: {
            name: "Test Blog",
            parentId: businessId,
            type: "business"
          },
        }
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });

    test("should require authentication for creating post", async () => {
      const result = await makeGraphQLRequest(
        CREATE_POST,
        {
          input: {
            blogId: "some-blog-id",
            title: "Test Post",
            content: "Test Content",
          },
        }
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });

    test("should require authentication for updating blog", async () => {
      const result = await makeGraphQLRequest(
        UPDATE_BLOG,
        {
          input: {
            id: "some-blog-id",
            updateData: {
              name: "Updated Blog Name"
            }
          },
        }
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });

    test("should require authentication for deleting blog", async () => {
      const result = await makeGraphQLRequest(
        DELETE_BLOG,
        {
          id: "some-blog-id",
        }
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });
  });

  describe("Access Control Tests", () => {
    test("should not allow non-owner to create blog in business", async () => {
      const result = await makeGraphQLRequest(
        CREATE_BLOG,
        {
          input: {
            name: "Test Blog",
            parentId: businessId,
            type: "business"
          },
        },
        accessToken2
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("User does not have required company permissions");
    });

    test("should not allow non-owner to create post in blog", async () => {
      // First create a blog as owner
      const createResult = await makeGraphQLRequest(
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

      expect(createResult.errors).toBeUndefined();
      blogId = createResult.data.createBlog.id;

      // Try to create post as non-owner
      const result = await makeGraphQLRequest(
        CREATE_POST,
        {
          input: {
            blogId,
            title: "Test Post",
            content: "Test Content",
          },
        },
        accessToken2
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("User does not have required company permissions");
    });

    test("should not allow non-owner to update post", async () => {
      // First create a post as owner
      const createResult = await makeGraphQLRequest(
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

      expect(createResult.errors).toBeUndefined();
      postId = createResult.data.createPost.id;

      // Try to update as non-owner
      const result = await makeGraphQLRequest(
        UPDATE_POST,
        {
          input: {
            id: postId,
            updateData: {
              title: "Updated Test Post",
              content: "Updated Test Content"
            }
          },
        },
        accessToken2
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("User does not have required company permissions");
    });

    test("should not allow non-owner to delete post", async () => {
      const result = await makeGraphQLRequest(
        DELETE_POST,
        {
          id: postId,
        },
        accessToken2
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("User does not have required company permissions");
    });
  });
  
  describe("Blogs", () => {
    test("should create a blog", async () => {
      const result = await makeGraphQLRequest(
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

      expect(result.errors).toBeUndefined();
      expect(result.data.createBlog).toBeDefined();
      expect(result.data.createBlog.name).toBe("Test Blog");
      expect(result.data.createBlog.parentId).toBe(businessId);
      expect(result.data.createBlog.ownerId).toBe(companyId);
      expect(result.data.createBlog.ownerType).toBe("company");
      expect(result.data.createBlog.creator).toBe(userId);

      blogId = result.data.createBlog.id;
    });

    test("should get blog by id", async () => {
      const result = await makeGraphQLRequest(
        GET_BLOG,
        {
          id: blogId,
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getBlog).toBeDefined();
      expect(result.data.getBlog.id).toBe(blogId);
      expect(result.data.getBlog.name).toBe("Test Blog");
      expect(result.data.getBlog.ownerId).toBe(companyId);
      expect(result.data.getBlog.ownerType).toBe("company");
    });

    test("should get blogs with filter", async () => {
      const result = await makeGraphQLRequest(
        GET_BLOGS,
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
      expect(result.data.getBlogs).toBeDefined();
      expect(result.data.getBlogs).toBeArray();
      expect(result.data.getBlogs.length).toBeGreaterThan(0);
      expect(result.data.getBlogs[0].parentId).toBe(businessId);
      expect(result.data.getBlogs[0].ownerId).toBe(companyId);
      expect(result.data.getBlogs[0].ownerType).toBe("company");
    });

    test("should update blog", async () => {
      const result = await makeGraphQLRequest(
        UPDATE_BLOG,
        {
          input: {
            id: blogId,
            updateData: {
              name: "Updated Blog Name"
            }
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.updateBlog).toBeDefined();
      expect(result.data.updateBlog.id).toBe(blogId);
      expect(result.data.updateBlog.name).toBe("Updated Blog Name");
      expect(result.data.updateBlog.ownerId).toBe(companyId);
      expect(result.data.updateBlog.ownerType).toBe("company");
    });
  });

  describe("Posts", () => {
    test("should create a post", async () => {
      const result = await makeGraphQLRequest(
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

      expect(result.errors).toBeUndefined();
      expect(result.data.createPost).toBeDefined();
      expect(result.data.createPost.title).toBe("Test Post");
      expect(result.data.createPost.content).toBe("Test Content");
      expect(result.data.createPost.blogId).toBe(blogId);
      expect(result.data.createPost.ownerId).toBe(companyId);
      expect(result.data.createPost.ownerType).toBe("company");
      expect(result.data.createPost.creator).toBe(userId);

      postId = result.data.createPost.id;
    });

    test("should get post by id", async () => {
      const result = await makeGraphQLRequest(
        GET_POST,
        {
          id: postId,
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getPost).toBeDefined();
      expect(result.data.getPost.id).toBe(postId);
      expect(result.data.getPost.title).toBe("Test Post");
      expect(result.data.getPost.content).toBe("Test Content");
      expect(result.data.getPost.ownerId).toBe(companyId);
      expect(result.data.getPost.ownerType).toBe("company");
    });

    test("should get posts with filter", async () => {
      const result = await makeGraphQLRequest(
        GET_POSTS,
        {
          input: {
            filter: {
              blogId: { $in: [blogId] },
            },
          }
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getPosts).toBeDefined();
      expect(result.data.getPosts).toBeArray();
      expect(result.data.getPosts.length).toBeGreaterThan(0);
      expect(result.data.getPosts[0].blogId).toBe(blogId);
      expect(result.data.getPosts[0].ownerId).toBe(companyId);
      expect(result.data.getPosts[0].ownerType).toBe("company");
    });

    test("should update post", async () => {
      const result = await makeGraphQLRequest(
        UPDATE_POST,
        {
          input: {
            id: postId,
            updateData: {
              title: "Updated Test Post",
              content: "Updated Test Content"
            }
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.updatePost).toBeDefined();
      expect(result.data.updatePost.id).toBe(postId);
      expect(result.data.updatePost.title).toBe("Updated Test Post");
      expect(result.data.updatePost.content).toBe("Updated Test Content");
      expect(result.data.updatePost.ownerId).toBe(companyId);
      expect(result.data.updatePost.ownerType).toBe("company");
    });

    test("should create post with images and documents", async () => {
      const result = await makeGraphQLRequest(
        CREATE_POST,
        {
          input: {
            blogId,
            title: "Post with Media",
            content: "Post content with media files",
            images: ["image-id-123"],
            documents: ["document-id-456"]
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.createPost).toBeDefined();
      expect(result.data.createPost.title).toBe("Post with Media");
      expect(result.data.createPost.content).toBe("Post content with media files");
      expect(result.data.createPost.images).toEqual(["image-id-123"]);
      expect(result.data.createPost.documents).toEqual(["document-id-456"]);
      expect(result.data.createPost.blogId).toBe(blogId);
      expect(result.data.createPost.ownerId).toBe(companyId);
      expect(result.data.createPost.ownerType).toBe("company");
      expect(result.data.createPost.creator).toBe(userId);

      // Store this post ID for the update test
      postId = result.data.createPost.id;
    });

    test("should update post with multiple images and clear documents", async () => {
      const result = await makeGraphQLRequest(
        UPDATE_POST,
        {
          input: {
            id: postId,
            updateData: {
              title: "Updated Post with Multiple Images",
              content: "Updated content with multiple images and no documents",
              images: ["image-id-789", "image-id-101"],
              documents: []
            }
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.updatePost).toBeDefined();
      expect(result.data.updatePost.id).toBe(postId);
      expect(result.data.updatePost.title).toBe("Updated Post with Multiple Images");
      expect(result.data.updatePost.content).toBe("Updated content with multiple images and no documents");
      expect(result.data.updatePost.images).toEqual(["image-id-789", "image-id-101"]);
      expect(result.data.updatePost.documents).toEqual([]);
      expect(result.data.updatePost.ownerId).toBe(companyId);
      expect(result.data.updatePost.ownerType).toBe("company");
    });
  });

  test("should delete post", async () => {
    const result = await makeGraphQLRequest(
      DELETE_POST,
      {
        id: postId,
      },
      accessToken
    );

    expect(result.errors).toBeUndefined();
    expect(result.data.deletePost).toBe(postId);

    // Verify post is deleted
    const getResult = await makeGraphQLRequest(
      GET_POST,
      {
        id: postId,
      },
      accessToken
    );

    expect(getResult.errors).toBeDefined();
    expect(getResult.errors[0].message).toBeDefined();
  });

  test("should delete blog", async () => {
    const result = await makeGraphQLRequest(
      DELETE_BLOG,
      {
        id: blogId,
      },
      accessToken
    );

    expect(result.errors).toBeUndefined();
    expect(result.data.deleteBlog).toBe(blogId);

    // Verify blog is deleted
    const getResult = await makeGraphQLRequest(
      GET_BLOG,
      {
        id: blogId,
      },
      accessToken
    );

    expect(getResult.errors).toBeDefined();
    expect(getResult.errors[0].message).toBeDefined();
  });
});