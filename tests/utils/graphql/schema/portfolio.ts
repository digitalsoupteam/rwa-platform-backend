export const GET_BALANCES = `
  query GetBalances($input: FilterInput!) {
    getBalances(input: $input) {
      id
      owner
      tokenAddress
      tokenId
      pool
      chainId
      balance
      lastUpdateBlock
      createdAt
      updatedAt
    }
  }
`;

export const GET_TRANSACTIONS = `
  query GetTransactions($input: FilterInput!) {
    getTransactions(input: $input) {
      id
      from
      to
      tokenAddress
      tokenId
      pool
      chainId
      transactionHash
      blockNumber
      amount
      createdAt
      updatedAt
    }
  }
`;