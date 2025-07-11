import { gql } from "graphql-request";

export const GET_STAKING = gql`
  query GetStaking($input: GetStakingFilterInput) {
    getStaking(input: $input) {
      id
      userWallet
      amount
      timestamp
      createdAt
      updatedAt
    }
  }
`;

export const GET_PROPOSALS = gql`
  query GetProposals($input: GetProposalsFilterInput) {
    getProposals(input: $input) {
      id
      proposer
      description
      status
      createdAt
      updatedAt
    }
  }
`;

export const GET_VOTES = gql`
  query GetVotes($input: GetVotesFilterInput) {
    getVotes(input: $input) {
      id
      voter
      proposalId
      support
      weight
      reason
      createdAt
      updatedAt
    }
  }
`;

export const GET_STAKING_HISTORY = gql`
  query GetStakingHistory($input: GetStakingHistoryFilterInput) {
    getStakingHistory(input: $input) {
      id
      userWallet
      amount
      txType
      timestamp
      createdAt
      updatedAt
    }
  }
`;

export const GET_TIMELOCK_TASKS = gql`
  query GetTimelockTasks($input: GetTimelockTasksFilterInput) {
    getTimelockTasks(input: $input) {
      id
      target
      value
      data
      predecessor
      salt
      status
      createdAt
      updatedAt
    }
  }
`;

export const GET_TREASURY_WITHDRAWS = gql`
  query GetTreasuryWithdraws($input: GetTreasuryWithdrawsFilterInput) {
    getTreasuryWithdraws(input: $input) {
      id
      tokenAddress
      amount
      recipient
      status
      createdAt
      updatedAt
    }
  }
`;