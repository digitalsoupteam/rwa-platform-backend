export const CREATE_GALLERY = `
  mutation CreateGallery($input: CreateGalleryInput!) {
    createGallery(input: $input) {
      id
      name
      parentId
      ownerId
      ownerType
      creator
      grandParentId
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_GALLERY = `
  mutation UpdateGallery($input: UpdateGalleryInput!) {
    updateGallery(input: $input) {
      id
      name
      parentId
      ownerId
      ownerType
      creator
      grandParentId
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_GALLERY = `
  mutation DeleteGallery($id: ID!) {
    deleteGallery(id: $id)
  }
`;

export const GET_GALLERY = `
  query GetGallery($id: ID!) {
    getGallery(id: $id) {
      id
      name
      parentId
      ownerId
      ownerType
      creator
      grandParentId
      createdAt
      updatedAt
    }
  }
`;

export const GET_GALLERIES = `
  query GetGalleries($filter: GetGalleriesFilterInput) {
    getGalleries(filter: $filter) {
      id
      name
      parentId
      ownerId
      ownerType
      creator
      grandParentId
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_IMAGE = `
  mutation CreateImage($input: CreateImageInput!) {
    createImage(input: $input) {
      id
      galleryId
      name
      description
      link
      ownerId
      ownerType
      creator
      parentId
      grandParentId
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_IMAGE = `
  mutation UpdateImage($input: UpdateImageInput!) {
    updateImage(input: $input) {
      id
      galleryId
      name
      description
      link
      ownerId
      ownerType
      creator
      parentId
      grandParentId
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_IMAGE = `
  mutation DeleteImage($id: ID!) {
    deleteImage(id: $id)
  }
`;

export const GET_IMAGE = `
  query GetImage($id: ID!) {
    getImage(id: $id) {
      id
      galleryId
      name
      description
      link
      ownerId
      ownerType
      creator
      parentId
      grandParentId
      createdAt
      updatedAt
    }
  }
`;

export const GET_IMAGES = `
  query GetImages($filter: GetImagesFilterInput) {
    getImages(filter: $filter) {
      id
      galleryId
      name
      description
      link
      ownerId
      ownerType
      creator
      parentId
      grandParentId
      createdAt
      updatedAt
    }
  }
`;