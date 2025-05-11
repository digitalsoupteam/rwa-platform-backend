import { gql } from "graphql-request";

// Business Queries
export const GET_BUSINESS = gql`
  query GetBusiness($id: ID!) {
    getBusiness(id: $id) {
      id
      chainId
      name
      ownerId
      ownerType
      tokenAddress
      description
      tags
      riskScore
      image
      generationCount
      approvalSignaturesTaskId
      approvalSignaturesTaskExpired
      paused
      createdAt
      updatedAt
    }
  }
`;

export const GET_BUSINESSES = gql`
  query GetBusinesses($input: FilterInput!) {
    getBusinesses(input: $input) {
      id
      chainId
      name
      ownerId
      ownerType
      tokenAddress
      description
      tags
      riskScore
      image
      generationCount
      approvalSignaturesTaskId
      approvalSignaturesTaskExpired
      paused
      createdAt
      updatedAt
    }
  }
`;

// Business Mutations
export const CREATE_BUSINESS = gql`
  mutation CreateBusiness($input: CreateBusinessInput!) {
    createBusiness(input: $input) {
      id
      chainId
      name
      ownerId
      ownerType
      tokenAddress
      description
      tags
      riskScore
      image
      generationCount
      approvalSignaturesTaskId
      approvalSignaturesTaskExpired
      paused
      createdAt
      updatedAt
    }
  }
`;

export const EDIT_BUSINESS = gql`
  mutation EditBusiness($input: EditBusinessInput!) {
    editBusiness(input: $input) {
      id
      chainId
      name
      ownerId
      ownerType
      tokenAddress
      description
      tags
      riskScore
      image
      generationCount
      approvalSignaturesTaskId
      approvalSignaturesTaskExpired
      paused
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_BUSINESS_RISK_SCORE = gql`
  mutation UpdateBusinessRiskScore($id: ID!) {
    updateRiskScore(id: $id) {
      id
      riskScore
      updatedAt
    }
  }
`;

export const REQUEST_BUSINESS_APPROVAL_SIGNATURES = gql`
  mutation RequestBusinessApprovalSignatures($input: RequestBusinessApprovalSignaturesInput!) {
    requestApprovalSignatures(input: $input) {
      taskId
    }
  }
`;

export const REJECT_BUSINESS_APPROVAL_SIGNATURES = gql`
  mutation RejectBusinessApprovalSignatures($id: ID!) {
    rejectApprovalSignatures(id: $id)
  }
`;

// Pool Queries
export const GET_POOL = gql`
  query GetPool($id: ID!) {
    getPool(id: $id) {
      id
      ownerId
      ownerType
      name
      type
      businessId
      rwaAddress
      poolAddress
      tokenId
      holdToken
      entryFeePercent
      exitFeePercent
      expectedHoldAmount
      expectedRwaAmount
      rewardPercent
      entryPeriodExpired
      completionPeriodExpired
      expectedReturnAmount
      accumulatedHoldAmount
      accumulatedRwaAmount
      isTargetReached
      isFullyReturned
      returnedAmount
      paused
      allocatedHoldAmount
      availableReturnBalance
      awaitingRwaAmount
      description
      chainId
      tags
      riskScore
      approvalSignaturesTaskId
      approvalSignaturesTaskExpired
      entryPeriodDuration
      completionPeriodDuration
      stableSpecificFields {
        fixedMintPrice
      }
      speculativeSpecificFields {
        rwaMultiplierIndex
        rwaMultiplier
        realHoldReserve
        virtualHoldReserve
        virtualRwaReserve
        k
        availableBonusAmount
        expectedBonusAmount
      }
      createdAt
      updatedAt
    }
  }
`;

export const GET_POOLS = gql`
  query GetPools($input: FilterInput!) {
    getPools(input: $input) {
      id
      ownerId
      ownerType
      name
      type
      businessId
      rwaAddress
      poolAddress
      tokenId
      holdToken
      entryFeePercent
      exitFeePercent
      expectedHoldAmount
      expectedRwaAmount
      rewardPercent
      entryPeriodExpired
      completionPeriodExpired
      expectedReturnAmount
      accumulatedHoldAmount
      accumulatedRwaAmount
      isTargetReached
      isFullyReturned
      returnedAmount
      paused
      allocatedHoldAmount
      availableReturnBalance
      awaitingRwaAmount
      description
      chainId
      tags
      riskScore
      approvalSignaturesTaskId
      approvalSignaturesTaskExpired
      entryPeriodDuration
      completionPeriodDuration
      stableSpecificFields {
        fixedMintPrice
      }
      speculativeSpecificFields {
        rwaMultiplierIndex
        rwaMultiplier
        realHoldReserve
        virtualHoldReserve
        virtualRwaReserve
        k
        availableBonusAmount
        expectedBonusAmount
      }
      createdAt
      updatedAt
    }
  }
`;

// Pool Mutations
export const CREATE_POOL = gql`
  mutation CreatePool($input: CreatePoolInput!) {
    createPool(input: $input) {
      id
      ownerId
      ownerType
      name
      type
      businessId
      rwaAddress
      description
      chainId
      expectedHoldAmount
      rewardPercent
      entryPeriodDuration
      completionPeriodDuration
      speculativeSpecificFields {
        rwaMultiplierIndex
      }
      createdAt
      updatedAt
    }
  }
`;

export const EDIT_POOL = gql`
  mutation EditPool($input: EditPoolInput!) {
    editPool(input: $input) {
      id
      name
      expectedHoldAmount
      rewardPercent
      description
      tags
      riskScore
      entryPeriodDuration
      completionPeriodDuration
      speculativeSpecificFields {
        rwaMultiplierIndex
      }
      updatedAt
    }
  }
`;

export const UPDATE_POOL_RISK_SCORE = gql`
  mutation UpdatePoolRiskScore($id: ID!) {
    updatePoolRiskScore(id: $id) {
      id
      riskScore
      updatedAt
    }
  }
`;

export const REQUEST_POOL_APPROVAL_SIGNATURES = gql`
  mutation RequestPoolApprovalSignatures($input: RequestPoolApprovalSignaturesInput!) {
    requestPoolApprovalSignatures(input: $input) {
      taskId
    }
  }
`;

export const REJECT_POOL_APPROVAL_SIGNATURES = gql`
  mutation RejectPoolApprovalSignatures($id: ID!) {
    rejectPoolApprovalSignatures(id: $id)
  }
`;