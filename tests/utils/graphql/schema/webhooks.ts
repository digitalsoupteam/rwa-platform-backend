export const CREATE_WEBHOOK_ENDPOINT = `
  mutation CreateWebhookEndpoint($input: CreateWebhookEndpointInput!) {
    createWebhookEndpoint(input: $input) {
      id
      url
      events
      description
      active
      rateLimitPerMinute
      secret
      createdAt
    }
  }
`;

export const UPDATE_WEBHOOK_ENDPOINT = `
  mutation UpdateWebhookEndpoint($input: UpdateWebhookEndpointInput!) {
    updateWebhookEndpoint(input: $input) {
      id
      url
      events
      description
      active
      rateLimitPerMinute
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_WEBHOOK_ENDPOINT = `
  mutation DeleteWebhookEndpoint($id: ID!) {
    deleteWebhookEndpoint(id: $id)
  }
`;

export const GET_WEBHOOK_ENDPOINTS = `
  query GetWebhookEndpoints {
    getWebhookEndpoints {
      id
      url
      events
      description
      active
      rateLimitPerMinute
      createdAt
      updatedAt
    }
  }
`;

export const GET_WEBHOOK_ENDPOINT = `
  query GetWebhookEndpoint($id: ID!) {
    getWebhookEndpoint(id: $id) {
      id
      userId
      url
      events
      description
      active
      rateLimitPerMinute
      createdAt
      updatedAt
    }
  }
`;
