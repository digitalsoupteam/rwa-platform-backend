export const QUEUES = {
  AI_ANALYSIS: 'enterprise.ai.analysis',
  AI_ANALYSIS_RESULT: 'enterprise.ai.result',
  SIGNER_UNSIGNED: 'signer.unsigned',
  SIGNER_SIGNED: 'signer.signed',
  BLOCKCHAIN_EVENTS: 'blockchain.events'
} as const;

export interface AIAnalysisMessage {
  enterpriseId: string;
  investmentPresentationText: string;
  projectSummaryText: string;
}

export interface AIAnalysisResultMessage {
  enterpriseId: string;
  summary: string;
  riskScore: number;
}

export interface SignerMessage {
  id: string;
  data: string; // Contract deployment data
  chainId: number;
  requiredSignatures: number;
  totalSigners: number;
}

export interface SignedMessage {
  id: string;
  data: string;
  chainId: number;
  signatures: Array<{
    signer: string;
    signature: string;
  }>;
}

export interface BlockchainEventMessage {
  eventName: string;
  contractAddress: string;
  params: Record<string, any>;
}
