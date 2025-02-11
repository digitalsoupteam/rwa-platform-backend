import { KYCProvider } from '../types/kyc-provider.interface';
import { KYC } from '../models/kyc.model';
import { logger, metrics } from '@rwa-platform/shared/src';

export class VerificationOrchestrator {
  private providers: Map<string, KYCProvider> = new Map();

  registerProvider(provider: KYCProvider) {
    this.providers.set(provider.name, provider);
  }

  async initiateVerification(userId: string, providerName: string, data: any) {
    try {
      const provider = this.providers.get(providerName);
      if (!provider) {
        throw new Error(`KYC provider ${providerName} not found`);
      }

      const verificationId = await provider.initVerification(userId, data);

      await KYC.create({
        userId,
        status: 'pending',
        provider: providerName,
        verificationId,
      });

      metrics.increment('kyc.verification.initiated');
      return verificationId;
    } catch (error: any) {
      logger.error(`KYC initiation failed: ${error.message}`);
      metrics.increment('kyc.verification.failed');
      throw error;
    }
  }

  async checkVerificationStatus(userId: string) {
    const kyc = await KYC.findOne({ userId });
    if (!kyc) {
      return { status: 'none' };
    }
    return kyc;
  }

  async handleWebhook(providerName: string, data: any) {
    const provider = this.providers.get(providerName);
    if (provider?.webhook) {
      await provider.webhook(data);
    }
  }
}
