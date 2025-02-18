export interface File {
  path: string;
  filename: string;
}

export interface Document extends File {
  content?: string;
}

export interface AIAnalysis {
  summary?: string;
  riskScore?: number;
}

export interface Signature {
  signer: string;
  signature: string;
}

export interface Enterprise {
  id: string;
  name: string;
  status: string;
  productOwner: string;
  image?: File;
  investmentPresentation?: Document;
  projectSummary?: Document;
  aiAnalysis?: AIAnalysis;
  signatures?: Signature[];
  contractAddress?: string;
  pools?: string[];
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface Pool {
  id: string;
  rwaEnterprise: string;
  name: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}
