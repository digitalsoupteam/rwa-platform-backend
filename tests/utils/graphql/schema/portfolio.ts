export const GET_BALANCES = `
  query GetBalances($input: GetBalancesInput!) {
    getBalances(input: $input) {
      id
      owner
      tokenAddress
      chainId
      balance
      lastUpdateBlock
      createdAt
      updatedAt
    }
  }
`;

export const GET_TRANSACTIONS = `
  query GetTransactions($input: GetTransactionsInput!) {
    getTransactions(input: $input) {
      id
      from
      to
      tokenAddress
      tokenId
      chainId
      transactionHash
      blockNumber
      amount
      createdAt
      updatedAt
    }
  }
`;