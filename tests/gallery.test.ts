import { expect, test, describe, beforeAll } from "bun:test";
import { ethers, HDNodeWallet, JsonRpcProvider } from "ethers";
import { TESTNET_RPC } from "./utils/config";
import { makeGraphQLRequest } from "./utils/graphql/makeGraphQLRequest";
import { authenticate } from "./utils/authenticate";
import {
  CREATE_GALLERY,
  UPDATE_GALLERY,
  DELETE_GALLERY,
  GET_GALLERY,
  GET_GALLERIES,
  CREATE_IMAGE,
  UPDATE_IMAGE,
  DELETE_IMAGE,
  GET_IMAGE,
  GET_IMAGES,
} from "./utils/graphql/schema/gallery";
import { CREATE_BUSINESS } from "./utils/graphql/schema/rwa";
import { CREATE_COMPANY } from "./utils/graphql/schema/company";

describe("Gallery Flow", () => {
  let chainId: string;
  let provider: JsonRpcProvider;
  let wallet: HDNodeWallet;
  let wallet2: HDNodeWallet;
  let accessToken: string;
  let accessToken2: string;
  let userId: string;
  let companyId: string;
  let businessId: string;
  let galleryId: string;
  let imageId: string;

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
    test("should require authentication for creating gallery", async () => {
      const result = await makeGraphQLRequest(
        CREATE_GALLERY,
        {
          input: {
            name: "Test Gallery",
            parentId: businessId,
            type: "business"
          },
        }
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });

    test("should require authentication for creating image", async () => {
      // Create test image file
      const imageContent = "fake image content";
      const file = new File([imageContent], "test.jpg", { type: "image/jpeg" });

      const result = await makeGraphQLRequest(
        CREATE_IMAGE,
        {
          input: {
            galleryId: "some-gallery-id",
            name: "Test Image",
            description: "Test Description",
          },
        },
        undefined,
        file
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("Authentication required");
    });
  });

  describe("Access Control Tests", () => {
    test("should not allow non-owner to create gallery in business", async () => {
      const result = await makeGraphQLRequest(
        CREATE_GALLERY,
        {
          input: {
            name: "Test Gallery",
            parentId: businessId,
            type: "business"
          },
        },
        accessToken2
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("User does not have required company permissions");
    });

    test("should not allow non-owner to update gallery", async () => {
      // First create a gallery as owner
      const createResult = await makeGraphQLRequest(
        CREATE_GALLERY,
        {
          input: {
            name: "Test Gallery",
            parentId: businessId,
            type: "business"
          },
        },
        accessToken
      );

      expect(createResult.errors).toBeUndefined();
      galleryId = createResult.data.createGallery.id;

      // Try to update as non-owner
      const result = await makeGraphQLRequest(
        UPDATE_GALLERY,
        {
          input: {
            id: galleryId,
            updateData: {
              name: "Updated Test Gallery"
            }
          },
        },
        accessToken2
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("User does not have required company permissions");
    });

    test("should not allow non-owner to create image in gallery", async () => {
      // Create test image file
      const imageContent = "fake image content";
      const file = new File([imageContent], "test.jpg", { type: "image/jpeg" });

      const result = await makeGraphQLRequest(
        CREATE_IMAGE,
        {
          input: {
            galleryId,
            name: "Test Image",
            description: "Test Description",
          },
        },
        accessToken2,
        file
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("User does not have required company permissions");
    });

    test("should not allow non-owner to update image", async () => {
      // First create an image as owner
      const imageContent = "fake image content";
      const file = new File([imageContent], "test.jpg", { type: "image/jpeg" });

      const createResult = await makeGraphQLRequest(
        CREATE_IMAGE,
        {
          input: {
            galleryId,
            name: "Test Image",
            description: "Test Description",
          },
        },
        accessToken,
        file
      );

      expect(createResult.errors).toBeUndefined();
      imageId = createResult.data.createImage.id;

      // Try to update as non-owner
      const result = await makeGraphQLRequest(
        UPDATE_IMAGE,
        {
          input: {
            id: imageId,
            updateData: {
              name: "Updated Test Image",
              description: "Updated Test Description",
              link: "https://example.com/updated.jpg"
            }
          },
        },
        accessToken2
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("User does not have required company permissions");
    });

    test("should not allow non-owner to delete image", async () => {
      const result = await makeGraphQLRequest(
        DELETE_IMAGE,
        {
          id: imageId,
        },
        accessToken2
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("User does not have required company permissions");
    });

    test("should not allow non-owner to delete gallery", async () => {
      const result = await makeGraphQLRequest(
        DELETE_GALLERY,
        {
          id: galleryId,
        },
        accessToken2
      );

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toBe("User does not have required company permissions");
    });
  });

  describe("Galleries", () => {
    test("should create a gallery", async () => {
      const result = await makeGraphQLRequest(
        CREATE_GALLERY,
        {
          input: {
            name: "Test Gallery",
            parentId: businessId,
            type: "business"
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.createGallery).toBeDefined();
      expect(result.data.createGallery.name).toBe("Test Gallery");
      expect(result.data.createGallery.parentId).toBe(businessId);
      expect(result.data.createGallery.ownerId).toBe(companyId);
      expect(result.data.createGallery.ownerType).toBe("company");
      expect(result.data.createGallery.creator).toBe(userId);

      galleryId = result.data.createGallery.id;
    });

    test("should get gallery by id", async () => {
      const result = await makeGraphQLRequest(
        GET_GALLERY,
        {
          id: galleryId,
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getGallery).toBeDefined();
      expect(result.data.getGallery.id).toBe(galleryId);
      expect(result.data.getGallery.name).toBe("Test Gallery");
      expect(result.data.getGallery.ownerId).toBe(companyId);
      expect(result.data.getGallery.ownerType).toBe("company");
    });

    test("should get galleries with filter", async () => {
      const result = await makeGraphQLRequest(
        GET_GALLERIES,
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
      expect(result.data.getGalleries).toBeDefined();
      expect(result.data.getGalleries).toBeArray();
      expect(result.data.getGalleries.length).toBeGreaterThan(0);
      expect(result.data.getGalleries[0].parentId).toBe(businessId);
      expect(result.data.getGalleries[0].ownerId).toBe(companyId);
      expect(result.data.getGalleries[0].ownerType).toBe("company");
    });

    test("should update gallery", async () => {
      const result = await makeGraphQLRequest(
        UPDATE_GALLERY,
        {
          input: {
            id: galleryId,
            updateData: {
              name: "Updated Test Gallery"
            }
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.updateGallery).toBeDefined();
      expect(result.data.updateGallery.id).toBe(galleryId);
      expect(result.data.updateGallery.name).toBe("Updated Test Gallery");
      expect(result.data.updateGallery.ownerId).toBe(companyId);
      expect(result.data.updateGallery.ownerType).toBe("company");
      expect(result.data.updateGallery.parentId).toBe(businessId);
    });
  });

  describe("Images", () => {
    test("should create an image with file", async () => {
      // Create test image file
      const imageContent = "fake image content";
      const file = new File([imageContent], "test.jpg", { type: "image/jpeg" });

      const result = await makeGraphQLRequest(
        CREATE_IMAGE,
        {
          input: {
            galleryId,
            name: "Test Image",
            description: "Test Description",
          },
        },
        accessToken,
        file
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.createImage).toBeDefined();
      expect(result.data.createImage.name).toBe("Test Image");
      expect(result.data.createImage.description).toBe("Test Description");
      expect(result.data.createImage.link).toBeDefined(); // Path should be set by files service
      expect(result.data.createImage.galleryId).toBe(galleryId);
      expect(result.data.createImage.ownerId).toBe(companyId);
      expect(result.data.createImage.ownerType).toBe("company");
      expect(result.data.createImage.creator).toBe(userId);

      imageId = result.data.createImage.id;
    });

    test("should get image by id", async () => {
      const result = await makeGraphQLRequest(
        GET_IMAGE,
        {
          id: imageId,
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getImage).toBeDefined();
      expect(result.data.getImage.id).toBe(imageId);
      expect(result.data.getImage.name).toBe("Test Image");
      expect(result.data.getImage.ownerId).toBe(companyId);
      expect(result.data.getImage.ownerType).toBe("company");
    });

    test("should get images with filter", async () => {
      const result = await makeGraphQLRequest(
        GET_IMAGES,
        {
          input: {
            filter: {
              galleryId: { $in: [galleryId] },
            },
          }
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.getImages).toBeDefined();
      expect(result.data.getImages).toBeArray();
      expect(result.data.getImages.length).toBeGreaterThan(0);
      
      // Find the specific image we created
      const createdImage = result.data.getImages.find(img => img.id === imageId);
      expect(createdImage).toBeDefined();
      expect(createdImage.galleryId).toBe(galleryId);
      expect(createdImage.ownerId).toBe(companyId);
      expect(createdImage.ownerType).toBe("company");
    });

    test("should update image", async () => {
      const result = await makeGraphQLRequest(
        UPDATE_IMAGE,
        {
          input: {
            id: imageId,
            updateData: {
              name: "Updated Test Image",
              description: "Updated Test Description",
              link: "https://example.com/updated.jpg"
            }
          },
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.updateImage).toBeDefined();
      expect(result.data.updateImage.id).toBe(imageId);
      expect(result.data.updateImage.name).toBe("Updated Test Image");
      expect(result.data.updateImage.description).toBe("Updated Test Description");
      expect(result.data.updateImage.link).toBe("https://example.com/updated.jpg");
      expect(result.data.updateImage.ownerId).toBe(companyId);
      expect(result.data.updateImage.ownerType).toBe("company");
      expect(result.data.updateImage.galleryId).toBe(galleryId);
    });

    test("should delete image", async () => {
      const result = await makeGraphQLRequest(
        DELETE_IMAGE,
        {
          id: imageId,
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.deleteImage).toBe(imageId);

      // Verify image is deleted
      const getResult = await makeGraphQLRequest(
        GET_IMAGE,
        {
          id: imageId,
        },
        accessToken
      );

      expect(getResult.errors).toBeDefined();
      expect(getResult.errors[0].message).toBeDefined();
    });
  });

  describe("Gallery Cleanup", () => {
    test("should delete gallery", async () => {
      const result = await makeGraphQLRequest(
        DELETE_GALLERY,
        {
          id: galleryId,
        },
        accessToken
      );

      expect(result.errors).toBeUndefined();
      expect(result.data.deleteGallery).toBe(galleryId);

      // Verify gallery is deleted
      const getResult = await makeGraphQLRequest(
        GET_GALLERY,
        {
          id: galleryId,
        },
        accessToken
      );

      expect(getResult.errors).toBeDefined();
      expect(getResult.errors[0].message).toBeDefined();
    });
  });
});