export interface UnsignedMessage {
  id: string;
  data: string;     // Hex string to sign
  chainId: number;  // EVM chain ID
  requiredSignatures: number; // Number of signatures required
  totalSigners: number;      // Total number of available signers
}

export interface Signature {
  signature: string;
  signer: string;
}

export interface CollectingMessage {
  id: string;
  data: string;     // Original data
  chainId: number;  // EVM chain ID
  requiredSignatures: number;
  totalSigners: number;
  signatures: Signature[];
}

export interface SignedMessage {
  id: string;
  data: string;     // Original data
  chainId: number;  // EVM chain ID
  signatures: Signature[];
}
