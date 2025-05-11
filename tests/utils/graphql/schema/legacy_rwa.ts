export const GET_BUSINESS = `
  query GetBusiness($input: BusinessIdInput!) {
    getBusiness(input: $input) {
      id
      chainId
      name
      owner
      tokenAddress
      description
      tags
      riskScore
      image
      status
      generationCount
      approvalSignaturesTaskId
    }
  }
`;

export const CREATE_BUSINESS = `
  mutation CreateBusiness($input: CreateBusinessInput!) {
    createBusiness(input: $input) {
      id
      chainId
      name
      owner
      tokenAddress
      description
      tags
      riskScore
      image
      status
      generationCount
      approvalSignaturesTaskId
    }
  }
`;

export const UPDATE_BUSINESS = `
  mutation UpdateBusiness($input: UpdateBusinessInput!) {
    updateBusiness(input: $input) {
      id
      chainId
      name
      owner
      tokenAddress
      description
      tags
      riskScore
      image
      status
      generationCount
      approvalSignaturesTaskId
    }
  }
`;

export const UPDATE_BUSINESS_RISK_SCORE = `
  mutation UpdateBusinessRiskScore($input: BusinessIdInput!) {
    updateBusinessRiskScore(input: $input) {
      id
      chainId
      name
      owner
      tokenAddress
      description
      tags
      riskScore
      image
      status
      generationCount
      approvalSignaturesTaskId
    }
  }
`;

export const REQUEST_BUSINESS_APPROVAL_SIGNATURES = `
  mutation RequestBusinessApprovalSignatures($input: RequestApprovalSignaturesInput!) {
    requestBusinessApprovalSignatures(input: $input) {
      taskId
    }
  }
`;

export const GET_BUSINESSES_BY_OWNER = `
  query GetBusinessesByOwner($input: GetBusinessesByOwnerInput!) {
    getBusinessesByOwner(input: $input) {
      id
      chainId
      name
      owner
      tokenAddress
      description
      tags
      riskScore
      image
      status
      generationCount
      approvalSignaturesTaskId
    }
  }
`;

export const GET_DEPLOYED_BUSINESSES = `
  query GetDeployedBusinesses($input: GetDeployedBusinessesInput!) {
    getDeployedBusinesses(input: $input) {
      id
      chainId
      name
      owner
      tokenAddress
      description
      tags
      riskScore
      image
      status
      generationCount
      approvalSignaturesTaskId
    }
  }
`;

// Pool
export const CREATE_POOL = `
  mutation CreatePool($input: CreatePoolInput!) {
    createPool(input: $input) {
      id
      businessId
      owner
      chainId
      holdToken
      rwaAddress
      tokenId
      buyFeePercent
      sellFeePercent
      virtualHoldReserve
      virtualRwaReserve
      targetAmount
      profitPercent
      investmentExpired
      realiseExpired
      investmentDuration
      realiseDuration
      speculationsEnabled
      description
      tags
      riskScore
      status
      generationCount
      approvalSignaturesTaskId
    }
  }
`;

export const UPDATE_POOL = `
  mutation UpdatePool($input: UpdatePoolInput!) {
    updatePool(input: $input) {
      id
      businessId
      owner
      chainId
      holdToken
      rwaAddress
      tokenId
      buyFeePercent
      sellFeePercent
      virtualHoldReserve
      virtualRwaReserve
      targetAmount
      profitPercent
      investmentExpired
      realiseExpired
      investmentDuration
      realiseDuration
      speculationsEnabled
      description
      tags
      riskScore
      status
      generationCount
      approvalSignaturesTaskId
    }
  }
`;

export const UPDATE_POOL_RISK_SCORE = `
  mutation UpdatePoolRiskScore($input: PoolIdInput!) {
    updatePoolRiskScore(input: $input) {
      id
      businessId
      owner
      chainId
      holdToken
      rwaAddress
      tokenId
      buyFeePercent
      sellFeePercent
      virtualHoldReserve
      virtualRwaReserve
      targetAmount
      profitPercent
      investmentExpired
      realiseExpired
      investmentDuration
      realiseDuration
      speculationsEnabled
      description
      tags
      riskScore
      status
      generationCount
      approvalSignaturesTaskId
    }
  }
`;

export const REQUEST_POOL_APPROVAL_SIGNATURES = `
  mutation RequestPoolApprovalSignatures($input: RequestApprovalSignaturesInput!) {
    requestPoolApprovalSignatures(input: $input) {
      taskId
    }
  }
`;

export const GET_POOL = `
  query GetPool($input: PoolIdInput!) {
    getPool(input: $input) {
      id
      businessId
      owner
      chainId
      holdToken
      rwaAddress
      poolAddress
      tokenId
      buyFeePercent
      sellFeePercent
      virtualHoldReserve
      virtualRwaReserve
      targetAmount
      profitPercent
      investmentExpired
      realiseExpired
      investmentDuration
      realiseDuration
      speculationsEnabled
      description
      tags
      riskScore
      status
      generationCount
      approvalSignaturesTaskId
    }
  }
`;


export const GET_POOLS_BY_OWNER = `
  query GetPoolsByOwner($input: GetPoolsByOwnerInput!) {
    getPoolsByOwner(input: $input) {
      id
      businessId
      owner
      chainId
      holdToken
      rwaAddress
      tokenId
      buyFeePercent
      sellFeePercent
      virtualHoldReserve
      virtualRwaReserve
      targetAmount
      profitPercent
      investmentExpired
      realiseExpired
      investmentDuration
      realiseDuration
      speculationsEnabled
      description
      tags
      riskScore
      status
      generationCount
      approvalSignaturesTaskId
    }
  }
`;

export const GET_DEPLOYED_POOLS = `
  query GetDeployedPools($input: GetDeployedPoolsInput!) {
    getDeployedPools(input: $input) {
      id
      businessId
      owner
      chainId
      holdToken
      rwaAddress
      tokenId
      buyFeePercent
      sellFeePercent
      virtualHoldReserve
      virtualRwaReserve
      targetAmount
      profitPercent
      investmentExpired
      realiseExpired
      investmentDuration
      realiseDuration
      speculationsEnabled
      description
      tags
      riskScore
      status
      generationCount
      approvalSignaturesTaskId
    }
  }
`;