import { gql } from "graphql-request";

export const GET_STAKING = gql`
  query GetStaking($input: GetStakingFilterInput) {
    getStaking(input: $input) {
      id
      staker
      amount
      unlockTimestamp
      lastStakeTimestamp
      chainId
      createdAt
      updatedAt
    }
  }
`;

export const GET_PROPOSALS = gql`
  query GetProposals($input: GetProposalsFilterInput) {
    getProposals(input: $input) {
      id
      proposalId
      proposer
      target
      data
      description
      creationTime
      endTime
      state
      executor
      canceller
      chainId
      transactionHash
      logIndex
      createdAt
      updatedAt
    }
  }
`;

export const GET_VOTES = gql`
  query GetVotes($input: GetVotesFilterInput) {
    getVotes(input: $input) {
      id
      proposalId
      chainId
      governanceAddress
      voterWallet
      support
      weight
      reason
      transactionHash
      logIndex
      blockNumber
      createdAt
      updatedAt
    }
  }
`;

export const GET_STAKING_HISTORY = gql`
  query GetStakingHistory($input: GetStakingHistoryFilterInput) {
    getStakingHistory(input: $input) {
      id
      staker
      amount
      rewards
      operation
      chainId
      transactionHash
      logIndex
      blockNumber
      createdAt
      updatedAt
    }
  }
`;

export const GET_TIMELOCK_TASKS = gql`
  query GetTimelockTasks($input: GetTimelockTasksFilterInput) {
    getTimelockTasks(input: $input) {
      id
      txHash
      target
      data
      eta
      executed
      cancelled
      chainId
      transactionHash
      logIndex
      blockNumber
      createdAt
      updatedAt
    }
  }
`;

export const GET_TREASURY_WITHDRAWS = gql`
  query GetTreasuryWithdraws($input: GetTreasuryWithdrawsFilterInput) {
    getTreasuryWithdraws(input: $input) {
      id
      recipient
      token
      isNative
      amount
      chainId
      transactionHash
      logIndex
      createdAt
      updatedAt
    }
  }
`;