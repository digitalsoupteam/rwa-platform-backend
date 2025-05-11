
export const CREATE_ASSISTANT = `
  mutation CreateAssistant($input: CreateAssistantInput!) {
    createAssistant(input: $input) {
      id
      userId
      name
      contextPreferences
    }
  }
`;

export const GET_ASSISTANT = `
  query GetAssistant($id: ID!) {
    getAssistant(id: $id) {
      id
      userId
      name
      contextPreferences
    }
  }
`;

export const GET_USER_ASSISTANTS = `
  query GetUserAssistants($pagination: PaginationInput) {
    getUserAssistants(pagination: $pagination) {
      id
      userId
      name
      contextPreferences
    }
  }
`;

export const UPDATE_ASSISTANT = `
  mutation UpdateAssistant($input: UpdateAssistantInput!) {
    updateAssistant(input: $input) {
      id
      userId
      name
      contextPreferences
    }
  }
`;

export const DELETE_ASSISTANT = `
  mutation DeleteAssistant($id: ID!) {
    deleteAssistant(id: $id) {
      id
    }
  }
`;

export const CREATE_MESSAGE = `
  mutation CreateMessage($input: CreateMessageInput!) {
    createMessage(input: $input) {
      id
      assistantId
      text
    }
  }
`;

export const GET_MESSAGE = `
  query GetMessage($id: ID!) {
    getMessage(id: $id) {
      id
      assistantId
      text
    }
  }
`;

export const UPDATE_MESSAGE = `
  mutation UpdateMessage($input: UpdateMessageInput!) {
    updateMessage(input: $input) {
      id
      assistantId
      text
    }
  }
`;

export const DELETE_MESSAGE = `
  mutation DeleteMessage($id: ID!) {
    deleteMessage(id: $id) {
      id
    }
  }
`;

export const GET_MESSAGE_HISTORY = `
  query GetMessageHistory($assistantId: ID!, $pagination: PaginationInput) {
    getMessageHistory(assistantId: $assistantId, pagination: $pagination) {
      id
      assistantId
      text
    }
  }
`;