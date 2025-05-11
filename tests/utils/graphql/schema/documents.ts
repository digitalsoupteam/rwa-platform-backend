export const CREATE_FOLDER = `
  mutation CreateFolder($input: CreateFolderInput!) {
    createFolder(input: $input) {
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

export const UPDATE_FOLDER = `
  mutation UpdateFolder($input: UpdateFolderInput!) {
    updateFolder(input: $input) {
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

export const DELETE_FOLDER = `
  mutation DeleteFolder($id: ID!) {
    deleteFolder(id: $id)
  }
`;

export const GET_FOLDER = `
  query GetFolder($id: ID!) {
    getFolder(id: $id) {
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

export const GET_FOLDERS = `
  query GetFolders($filter: GetFoldersFilterInput) {
    getFolders(filter: $filter) {
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

export const CREATE_DOCUMENT = `
  mutation CreateDocument($input: CreateDocumentInput!) {
    createDocument(input: $input) {
      id
      folderId
      name
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

export const UPDATE_DOCUMENT = `
  mutation UpdateDocument($input: UpdateDocumentInput!) {
    updateDocument(input: $input) {
      id
      folderId
      name
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

export const DELETE_DOCUMENT = `
  mutation DeleteDocument($id: ID!) {
    deleteDocument(id: $id)
  }
`;

export const GET_DOCUMENT = `
  query GetDocument($id: ID!) {
    getDocument(id: $id) {
      id
      folderId
      name
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

export const GET_DOCUMENTS = `
  query GetDocuments($filter: GetDocumentsFilterInput) {
    getDocuments(filter: $filter) {
      id
      folderId
      name
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