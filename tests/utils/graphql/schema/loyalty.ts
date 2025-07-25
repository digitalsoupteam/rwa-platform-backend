export const REGISTER_REFERRAL = `
  mutation RegisterReferral($input: RegisterReferralInput!) {
    registerReferral(input: $input) {
      id
      userWallet
      userId
      referrerWallet
      referrerId
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_REFERRER_WITHDRAW_TASK = `
  mutation CreateReferrerWithdrawTask($input: CreateReferrerWithdrawTaskInput!) {
    createReferrerWithdrawTask(input: $input) {
      id
      referrerId
      referrerWallet
      chainId
      tokenAddress
      totalWithdrawnAmount
      taskId
      taskExpiredAt
      taskCooldown
      createdAt
      updatedAt
    }
  }
`;

export const GET_FEES = `
  query GetFees($input: GetFeesFilterInput) {
    getFees(input: $input) {
      id
      userWallet
      userId
      chainId
      tokenAddress
      buyCommissionAmount
      sellCommissionAmount
      tokenCreationCommissionAmount
      poolCreationCommissionAmount
      referralRewardAmount
      buyCommissionCount
      sellCommissionCount
      tokenCreationCommissionCount
      poolCreationCommissionCount
      referralRewardCount
      createdAt
      updatedAt
    }
  }
`;

export const GET_REFERRALS = `
  query GetReferrals($input: GetReferralsFilterInput) {
    getReferrals(input: $input) {
      id
      userWallet
      userId
      referrerWallet
      referrerId
      createdAt
      updatedAt
    }
  }
`;

export const GET_REFERRER_WITHDRAWS = `
  query GetReferrerWithdraws($input: GetReferrerWithdrawsFilterInput) {
    getReferrerWithdraws(input: $input) {
      id
      referrerWallet
      referrerId
      chainId
      tokenAddress
      totalWithdrawnAmount
      taskId
      taskExpiredAt
      taskCooldown
      createdAt
      updatedAt
    }
  }
`;

export const GET_REFERRER_CLAIM_HISTORY = `
  query GetReferrerClaimHistory($input: GetReferrerClaimHistoryFilterInput) {
    getReferrerClaimHistory(input: $input) {
      id
      referrerWallet
      referrerId
      referralWallet
      chainId
      tokenAddress
      amount
      transactionHash
      logIndex
      blockNumber
      createdAt
      updatedAt
    }
  }
`;