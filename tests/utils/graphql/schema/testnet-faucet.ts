
export const REQUEST_GAS = `
  mutation RequestGas($input: RequestTokenInput!) {
    requestGas(input: $input) {
      id
      userId
      wallet
      tokenType
      amount
      transactionHash
      createdAt
    }
  }
`;

export const REQUEST_HOLD = `
  mutation RequestHold($input: RequestTokenInput!) {
    requestHold(input: $input) {
      id
      userId
      wallet
      tokenType
      amount
      transactionHash
      createdAt
    }
  }
`;

export const GET_HISTORY = `
  query GetHistory($pagination: PaginationInput) {
    getHistory(pagination: $pagination) {
      id
      userId
      wallet
      tokenType
      amount
      transactionHash
      createdAt
    }
  }
`;

export const GET_UNLOCK_TIME = `
  query GetUnlockTime {
    getUnlockTime {
      gasUnlockTime
      holdUnlockTime
    }
  }
`;