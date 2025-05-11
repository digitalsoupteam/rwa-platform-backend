
// Pool GraphQL queries
export const GET_POOL = `
  query GetPool($input: GetPoolInput!) {
    getPool(input: $input) {
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
      status
      documents
      description
      tags
      riskScore
      approvalSignaturesExpired
      approvalSignatures {
        signer
        hash
        signature
      }
      generationCount
    }
  }
`;

export const CREATE_POOL = `
  mutation CreatePool($input: CreatePoolInput!) {
    createPool(input: $input) {
      id
      businessId
      owner
      chainId
      rwaAddress
      status
      documents
      description
      tags
      riskScore
      approvalSignaturesExpired
      approvalSignatures {
        signer
        hash
        signature
      }
      generationCount
    }
  }
`;

export const ADD_POOL_DOCUMENT = `
  mutation AddPoolDocument($input: AddPoolDocumentInput!) {
    addPoolDocument(input: $input) {
      id
      documents
    }
  }
`;

export const REMOVE_POOL_DOCUMENT = `
  mutation RemovePoolDocument($input: RemovePoolDocumentInput!) {
    removePoolDocument(input: $input) {
      id
      documents
    }
  }
`;

export const AUTO_GENERATE_POOL_INFO = `
  mutation AutoGeneratePoolInfo($input: AutoGeneratePoolInfoInput!) {
    autoGeneratePoolInfo(input: $input) {
      id
      description
      tags
      generationCount
      status
    }
  }
`;

export const UPDATE_POOL_RISK_SCORE = `
  mutation UpdatePoolRiskScore($input: UpdatePoolRiskScoreInput!) {
    updatePoolRiskScore(input: $input) {
      id
      riskScore
      status
      approvalSignaturesExpired
      approvalSignatures {
        signer
        hash
        signature
      }
    }
  }
`;

export const REQUEST_POOL_APPROVAL_SIGNATURES = `
  mutation RequestPoolApprovalSignatures($input: RequestPoolApprovalSignaturesInput!) {
    requestPoolApprovalSignatures(input: $input)
  }
`;

export const UPDATE_POOL = `
  mutation UpdatePool($input: UpdatePoolInput!) {
    updatePool(input: $input) {
      id
      targetAmount
      profitPercent
      investmentDuration
      realiseDuration
      speculationsEnabled
      description
      tags
      status
    }
  }
`;