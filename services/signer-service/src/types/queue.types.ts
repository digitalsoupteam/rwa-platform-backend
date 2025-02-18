export interface UnsignedMessage {
  id: string;
  data: string;     // Hex string to sign
  chainId: number;  // EVM chain ID
}

export interface SignedMessage {
  id: string;
  data: string;     // Original data
  signature: string; // Signed data
  signer: string;   // Address that signed
  chainId: number;  // EVM chain ID
}
