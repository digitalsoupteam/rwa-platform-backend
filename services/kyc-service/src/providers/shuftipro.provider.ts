import { KYCProvider, KYCVerificationResult } from 'src/types/kyc-provider.interface';

export class ShuftiProProvider implements KYCProvider {
  name = 'shuftipro';

  constructor(
    private clientId: string,
    private secretKey: string
  ) {}

  async initVerification(userId: string, data: any): Promise<string> {
    throw 'Implement ShuftiPro specific logic';
  }

  async getVerificationStatus(verificationId: string): Promise<KYCVerificationResult> {
    throw 'Implement status check';
  }
}
