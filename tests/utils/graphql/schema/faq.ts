export const CREATE_FAQ_TOPIC = `
  mutation CreateFaqTopic($input: CreateFaqTopicInput!) {
    createFaqTopic(input: $input) {
      id
      name
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

export const UPDATE_FAQ_TOPIC = `
  mutation UpdateFaqTopic($input: UpdateFaqTopicInput!) {
    updateFaqTopic(input: $input) {
      id
      name
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

export const DELETE_FAQ_TOPIC = `
  mutation DeleteFaqTopic($id: ID!) {
    deleteFaqTopic(id: $id)
  }
`;

export const GET_FAQ_TOPIC = `
  query GetFaqTopic($id: ID!) {
    getFaqTopic(id: $id) {
      id
      name
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

export const GET_FAQ_TOPICS = `
  query GetFaqTopics($filter: GetFaqTopicsFilterInput) {
    getFaqTopics(filter: $filter) {
      id
      name
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

export const CREATE_FAQ_ANSWER = `
  mutation CreateFaqAnswer($input: CreateFaqAnswerInput!) {
    createFaqAnswer(input: $input) {
      id
      topicId
      question
      answer
      order
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

export const UPDATE_FAQ_ANSWER = `
  mutation UpdateFaqAnswer($input: UpdateFaqAnswerInput!) {
    updateFaqAnswer(input: $input) {
      id
      topicId
      question
      answer
      order
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

export const DELETE_FAQ_ANSWER = `
  mutation DeleteFaqAnswer($id: ID!) {
    deleteFaqAnswer(id: $id)
  }
`;

export const GET_FAQ_ANSWER = `
  query GetFaqAnswer($id: ID!) {
    getFaqAnswer(id: $id) {
      id
      topicId
      question
      answer
      order
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

export const GET_FAQ_ANSWERS = `
  query GetFaqAnswers($filter: GetFaqAnswersFilterInput) {
    getFaqAnswers(filter: $filter) {
      id
      topicId
      question
      answer
      order
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