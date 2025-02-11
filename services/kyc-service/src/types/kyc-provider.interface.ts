export interface KYCVerificationResult {
  success: boolean;
  verificationId: string;
  status: 'pending' | 'approved' | 'rejected';
  details?: any;
  timestamp: Date;
}

export interface KYCProvider {
  name: string;
  initVerification(userId: string, data: any): Promise<string>; // Returns verification URL or ID
  getVerificationStatus(verificationId: string): Promise<KYCVerificationResult>;
  webhook?(data: any): Promise<void>; // Optional webhook handler
}
