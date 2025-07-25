export const SET_REACTION = `
  mutation SetReaction($input: SetReactionInput!) {
    setReaction(input: $input) {
      id
      parentId
      parentType
      userId
      reaction
      createdAt
      updatedAt
    }
  }
`;

export const RESET_REACTION = `
  mutation ResetReaction($input: SetReactionInput!) {
    resetReaction(input: $input) {
      id
      parentId
      parentType
      userId
      reaction
      createdAt
      updatedAt
    }
  }
`;

export const GET_ENTITY_REACTIONS = `
  query GetEntityReactions($parentId: String!, $parentType: String!) {
    getEntityReactions(parentId: $parentId, parentType: $parentType) {
      reactions
      userReactions
    }
  }
`;

export const GET_REACTIONS = `
  query GetReactions($input: GetReactionsFilterInput!) {
    getReactions(input: $input) {
      id
      parentId
      parentType
      userId
      reaction
      createdAt
      updatedAt
    }
  }
`;