import { KYCProvider, KYCVerificationResult } from '../types/kyc-provider.interface';

export class SumsubProvider implements KYCProvider {
  name = 'sumsub';

  constructor(
    private apiKey: string,
    private apiSecret: string
  ) {}

  async initVerification(userId: string, data: any): Promise<string> {
    throw 'Implement ShuftiPro specific logic';
  }

  async getVerificationStatus(verificationId: string): Promise<KYCVerificationResult> {
    throw 'Implement status check';
  }

  async webhook(data: any): Promise<void> {
    // Handle Sumsub webhooks
  }
}
