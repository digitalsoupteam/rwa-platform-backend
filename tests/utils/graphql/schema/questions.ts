export const CREATE_TOPIC = `
  mutation CreateTopic($input: CreateTopicInput!) {
    createTopic(input: $input) {
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

export const UPDATE_TOPIC = `
  mutation UpdateTopic($input: UpdateTopicInput!) {
    updateTopic(input: $input) {
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

export const DELETE_TOPIC = `
  mutation DeleteTopic($id: ID!) {
    deleteTopic(id: $id)
  }
`;

export const GET_TOPIC = `
  query GetTopic($id: ID!) {
    getTopic(id: $id) {
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

export const GET_TOPICS = `
  query GetTopics($filter: GetTopicsFilterInput) {
    getTopics(filter: $filter) {
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

export const CREATE_QUESTION = `
  mutation CreateQuestion($input: CreateQuestionInput!) {
    createQuestion(input: $input) {
      id
      topicId
      text
      answer {
        text
        userId
        createdAt
        updatedAt
      }
      answered
      likesCount
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

export const CREATE_QUESTION_ANSWER = `
  mutation CreateQuestionAnswer($input: CreateQuestionAnswerInput!) {
    createQuestionAnswer(input: $input) {
      id
      topicId
      text
      answer {
        text
        userId
        createdAt
        updatedAt
      }
      answered
      likesCount
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

export const UPDATE_QUESTION_TEXT = `
  mutation UpdateQuestionText($input: UpdateQuestionTextInput!) {
    updateQuestionText(input: $input) {
      id
      topicId
      text
      answer {
        text
        userId
        createdAt
        updatedAt
      }
      answered
      likesCount
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

export const UPDATE_QUESTION_ANSWER = `
  mutation UpdateQuestionAnswer($input: UpdateQuestionAnswerInput!) {
    updateQuestionAnswer(input: $input) {
      id
      topicId
      text
      answer {
        text
        userId
        createdAt
        updatedAt
      }
      answered
      likesCount
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

export const DELETE_QUESTION = `
  mutation DeleteQuestion($id: ID!) {
    deleteQuestion(id: $id)
  }
`;

export const GET_QUESTION = `
  query GetQuestion($id: ID!) {
    getQuestion(id: $id) {
      id
      topicId
      text
      answer {
        text
        userId
        createdAt
        updatedAt
      }
      answered
      likesCount
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

export const GET_QUESTIONS = `
  query GetQuestions($filter: GetQuestionsFilterInput) {
    getQuestions(filter: $filter) {
      id
      topicId
      text
      answer {
        text
        userId
        createdAt
        updatedAt
      }
      answered
      likesCount
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

export const TOGGLE_QUESTION_LIKE = `
  mutation ToggleQuestionLike($questionId: ID!) {
    toggleQuestionLike(questionId: $questionId)
  }
`;