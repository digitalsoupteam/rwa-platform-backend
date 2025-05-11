
export const GET_BUSINESS = `
  query GetBusiness($input: GetBusinessInput!) {
    getBusiness(input: $input) {
      id
      name
      owner
      status
      documents
      description
      tags
      riskScore
      tokenAddress
      approvalSignaturesExpired
      approvalSignatures {
        signer
        hash
        signature
      }
      image
      metadataUrl
    }
  }
`;

export const CREATE_BUSINESS = `
  mutation CreateBusiness($input: CreateBusinessInput!) {
    createBusiness(input: $input) {
      id
      name
      owner
      status
      documents
      description
      tags
      riskScore
      tokenAddress
      approvalSignaturesExpired
      approvalSignatures {
        signer
        hash
        signature
      }
      image
      metadataUrl
    }
  }
`;

export const UPLOAD_IMAGE = `
  mutation UploadImage($input: UploadImageInput!) {
    uploadImage(input: $input) {
      id
      name
      owner
      status
      documents
      description
      tags
      riskScore
      tokenAddress
      approvalSignaturesExpired
      approvalSignatures {
        signer
        hash
        signature
      }
      image
      metadataUrl
    }
  }
`;

export const UPDATE_BUSINESS = `
mutation UpdateBusiness($input: UpdateBusinessInput!) {
  updateBusiness(input: $input) {
    id
    name
    owner
    status
    documents
    description
    tags
    riskScore
    tokenAddress
    approvalSignaturesExpired
    approvalSignatures {
      signer
      hash
      signature
    }
    image
    metadataUrl
  }
}
`;

export const ADD_BUSINESS_DOCUMENT = `
  mutation AddBusinessDocument($input: AddBusinessDocumentInput!) {
    addBusinessDocument(input: $input) {
      id
      name
      owner
      status
      documents
      description
      tags
      riskScore
      tokenAddress
      approvalSignaturesExpired
      approvalSignatures {
        signer
        hash
        signature
      }
      image
      metadataUrl
    }
  }
`;

export const REMOVE_BUSINESS_DOCUMENT = `
  mutation RemoveBusinessDocument($input: RemoveBusinessDocumentInput!) {
    removeBusinessDocument(input: $input) {
      id
      name
      owner
      status
      documents
      description
      tags
      riskScore
      tokenAddress
      approvalSignaturesExpired
      approvalSignatures {
        signer
        hash
        signature
      }
      image
      metadataUrl
    }
  }
`;

export const AUTO_GENERATE_BUSINESS_INFO = `
  mutation AutoGenerateBusinessInfo($input: AutoGenerateBusinessInfoInput!) {
    autoGenerateBusinessInfo(input: $input) {
      id
      name
      owner
      status
      documents
      description
      tags
      riskScore
      tokenAddress
      approvalSignaturesExpired
      approvalSignatures {
        signer
        hash
        signature
      }
      image
      metadataUrl
      generationCount
    }
  }
`;

export const UPDATE_BUSINESS_RISK_SCORE = `
  mutation UpdateBusinessRiskScore($input: UpdateBusinessRiskScoreInput!) {
    updateBusinessRiskScore(input: $input) {
      id
      name
      owner
      status
      documents
      description
      tags
      riskScore
      tokenAddress
      approvalSignaturesExpired
      approvalSignatures {
        signer
        hash
        signature
      }
      image
      metadataUrl
      generationCount
    }
  }
`;

export const REQUEST_APPROVAL_SIGNATURES = `
  mutation RequestApprovalSignatures($input: RequestApprovalSignaturesInput!) {
    requestApprovalSignatures(input: $input)
  }
`;