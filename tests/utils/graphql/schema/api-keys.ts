export const CREATE_API_KEY = `
  mutation CreateApiKey($input: CreateApiKeyInput!) {
    createApiKey(input: $input) {
      id
      name
      prefix
      key
      createdAt
    }
  }
`;

export const UPDATE_API_KEY = `
  mutation UpdateApiKey($input: UpdateApiKeyInput!) {
    updateApiKey(input: $input) {
      id
      name
      prefix
      userId
      wallet
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_API_KEY = `
  mutation DeleteApiKey($id: ID!) {
    deleteApiKey(id: $id)
  }
`;

export const GET_API_KEYS = `
  query GetApiKeys {
    getApiKeys {
      id
      name
      prefix
      userId
      wallet
      createdAt
      updatedAt
    }
  }
`;

export const GET_API_KEY = `
  query GetApiKey($id: ID!) {
    getApiKey(id: $id) {
      id
      name
      prefix
      userId
      wallet
      createdAt
      updatedAt
    }
  }
`;
