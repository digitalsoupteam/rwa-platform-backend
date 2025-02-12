import { KYCProvider, KYCVerificationResult } from '../types/kyc-provider.interface';
import { logger, metrics } from '@rwa-platform/shared/src';
import crypto from 'crypto';

export class SumsubProvider implements KYCProvider {
  name = 'sumsub';
  private baseUrl = 'https://api.sumsub.com';

  constructor(
    private apiKey: string,
    private apiSecret: string
  ) {}

  private generateSignature(ts: number, httpMethod: string, url: string, body: string = ''): string {
    const signingString = ts + httpMethod + url + body;
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(signingString)
      .digest('hex');
  }

  private async makeRequest(method: string, endpoint: string, data?: any) {
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const url = `${this.baseUrl}${endpoint}`;
      const body = data ? JSON.stringify(data) : '';
      const signature = this.generateSignature(timestamp, method, endpoint, body);

      const response = await fetch(url, {
        method,
        body: data ? JSON.stringify(data) : undefined,
        headers: {
          'X-App-Token': this.apiKey,
          'X-App-Access-Sig': signature,
          'X-App-Access-Ts': timestamp.toString(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();
      metrics.increment('kyc.sumsub.request.success');
      return responseData;
    } catch (error: any) {
      metrics.increment('kyc.sumsub.request.error');
      logger.error('SumSub API request failed:', { error: error.message, endpoint });
      throw error;
    }
  }

  async initVerification(userId: string, data: any): Promise<string> {
    try {
      // 1. Create applicant
      const applicant = await this.makeRequest('POST', '/resources/applicants', {
        externalUserId: userId,
        info: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          country: data.country,
          phone: data.phone,
          dob: data.dateOfBirth,
        }
      });

      // 2. Generate access token for SDK
      const accessToken = await this.makeRequest('POST', '/resources/accessTokens', {
        userId: applicant.id,
        levelName: 'basic-kyc-level',
        ttlInSecs: 3600
      });

      metrics.increment('kyc.sumsub.verification.initiated');
      return accessToken.token;
    } catch (error: any) {
      metrics.increment('kyc.sumsub.verification.failed');
      logger.error('Failed to initiate verification:', { error: error.message, userId });
      throw error;
    }
  }

  async getVerificationStatus(verificationId: string): Promise<KYCVerificationResult> {
    try {
      const response = await this.makeRequest('GET', `/resources/applicants/${verificationId}/status`);
      
      let status: 'pending' | 'approved' | 'rejected';
      switch (response.reviewStatus) {
        case 'completed':
          status = response.reviewResult.reviewAnswer === 'GREEN' ? 'approved' : 'rejected';
          break;
        case 'pending':
          status = 'pending';
          break;
        default:
          status = 'rejected';
      }

      metrics.increment(`kyc.sumsub.status.${status}`);

      return {
        success: status === 'approved',
        verificationId,
        status,
        details: response.reviewResult,
        timestamp: new Date()
      };
    } catch (error: any) {
      metrics.increment('kyc.sumsub.status.error');
      logger.error('Failed to get verification status:', { error: error.message, verificationId });
      throw error;
    }
  }

  async webhook(data: any): Promise<void> {
    try {
      const { type, applicantId, reviewStatus, reviewResult } = data;
      
      logger.info('Received SumSub webhook:', { type, applicantId, reviewStatus });
      metrics.increment('kyc.sumsub.webhook.received');

      // Verify webhook signature
      if (!this.verifyWebhookSignature(data)) {
        throw new Error('Invalid webhook signature');
      }

      // Process different webhook types
      switch (type) {
        case 'applicantReviewed':
          await this.handleApplicantReviewed(applicantId, reviewStatus, reviewResult);
          break;
        case 'applicantPending':
          await this.handleApplicantPending(applicantId);
          break;
        default:
          logger.info('Unhandled webhook type:', { type });
      }

      metrics.increment('kyc.sumsub.webhook.processed');
    } catch (error: any) {
      metrics.increment('kyc.sumsub.webhook.error');
      logger.error('Webhook processing failed:', { error: error.message });
      throw error;
    }
  }

  private verifyWebhookSignature(data: any): boolean {
    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(JSON.stringify(data))
      .digest('hex');

    return signature === data.signature;
  }

  private async handleApplicantReviewed(applicantId: string, reviewStatus: string, reviewResult: any) {
    try {
      // Отправляем уведомление в notification-service
      await fetch(`${process.env.NOTIFICATION_SERVICE_URL}/notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'KYC_REVIEW_COMPLETED',
          userId: applicantId,
          status: reviewStatus,
          details: reviewResult
        })
      });

      logger.info('Processed reviewed applicant:', { applicantId, reviewStatus });
    } catch (error: any) {
      logger.error('Failed to handle reviewed applicant:', { error: error.message, applicantId });
      throw error;
    }
  }

  private async handleApplicantPending(applicantId: string) {
    try {
      // Отправляем уведомление в notification-service
      await fetch(`${process.env.NOTIFICATION_SERVICE_URL}/notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'KYC_PENDING',
          userId: applicantId,
          message: 'Your KYC verification is pending review'
        })
      });

      logger.info('Processed pending applicant:', { applicantId });
    } catch (error: any) {
      logger.error('Failed to handle pending applicant:', { error: error.message, applicantId });
      throw error;
    }
  }
}
