export enum UserRole {
  INVESTOR = 'investor',
  PRODUCT_OWNER = 'product_owner',
  DAO_MEMBER = 'dao_member',
}

export enum KYCStatus {
  NONE = 'none',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum EnterpriseStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  ACTIVE = 'active',
  REJECTED = 'rejected',
  CLOSED = 'closed',
}

export enum PoolStatus {
  PENDING = 'pending', // Ожидает одобрения
  INVESTMENT = 'investment', // Инвестиционная фаза
  ACTIVE = 'active', // После достижения страйка
  REALISATION = 'realisation', // Фаза возврата инвестиций
  COMPLETED = 'completed', // Успешно завершен
  DEFAULTED = 'defaulted', // Дефолт
  REJECTED = 'rejected', // Отклонен
}

export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}

export enum DocumentType {
  PRESENTATION = 'presentation',
  BUSINESS_SUMMARY = 'business_summary',
  BUSINESS_PLAN = 'business_plan',
  FINANCIAL_MODEL = 'financial_model',
  KYC_DOCUMENT = 'kyc_document',
}

export enum AuditLogAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  APPROVE = 'approve',
  REJECT = 'reject',
  INVEST = 'invest',
  WITHDRAW = 'withdraw',
  RETURN = 'return',
}

export enum NotificationType {
  KYC_UPDATE = 'kyc_update',
  POOL_STATUS = 'pool_status',
  INVESTMENT = 'investment',
  RETURN = 'return',
  RATING_UPDATE = 'rating_update',
  SYSTEM = 'system',
}

export enum StakingDuration {
  ONE_MONTH = 30,
  THREE_MONTHS = 90,
  SIX_MONTHS = 180,
  TWELVE_MONTHS = 360,
}

export enum RewardType {
  TRADING_FEE = 'trading_fee',
  REFERRAL = 'referral',
  STAKING = 'staking',
  AIRDROP = 'airdrop',
}

export enum ChainEvent {
  POOL_CREATED = 'PoolCreated',
  RWA_CREATED = 'RWACreated',
  INVESTMENT_MADE = 'InvestmentMade',
  PROFIT_RETURNED = 'ProfitReturned',
  STAKE_ADDED = 'StakeAdded',
  STAKE_REMOVED = 'StakeRemoved',
}

export enum TransactionType {
  STAKE = 'stake',
  UNSTAKE = 'unstake',
  SWAP = 'swap',
  DEPLOY_RWA = 'deploy_rwa',
  DEPLOY_POOL = 'deploy_pool',
  REPAY = 'repay',
  PROPOSAL = 'proposal',
  VOTE = 'vote',
  EXECUTE = 'execute',
}
