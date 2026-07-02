import { AppError } from '@shared/errors/app-errors';
import { PoolRepository } from '../repositories/pool.repository';
import { BusinessRepository } from '../repositories/business.repository';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';
import { MetricsDecorator } from '@shared/monitoring/src/metricsDecorator';
import { LogDecorator } from '@shared/monitoring/src/logDecorator';
import { setSpanAttributes } from '@shared/monitoring/src/tracing';
import { buildFileUrl } from '@shared/files/src/index';

export class TokenService {
  constructor(
    private readonly poolRepository: PoolRepository,
    private readonly businessRepository: BusinessRepository,
    private readonly placeholderImageUrl: string,
    private readonly filesBaseUrl: string,
  ) {}

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ rwaAddress: a[0].rwaAddress, tokenId: a[0].tokenId }),
  })
  async getTokenMetadata(params: { rwaAddress: string; tokenId: string }) {
    setSpanAttributes({ rwaAddress: params.rwaAddress, tokenId: params.tokenId });
    // Find pool by rwaAddress and tokenId
    const pool = await this.poolRepository.findByRwaAddressAndTokenId(params.rwaAddress, params.tokenId);

    // Find associated business
    const business = await this.businessRepository.findById(pool.businessId);
    if (!business) {
      throw new AppError({ message: 'Business not found', statusCode: 404, code: 'NOT_FOUND' });
    }

    // Combine descriptions
    const description = [business.description, pool.description].filter(Boolean).join('\n\n');

    // Get image with fallback logic — build full public URL from relative path
    const image = pool.image
      ? buildFileUrl(pool.image, this.filesBaseUrl)
      : business.image
        ? buildFileUrl(business.image, this.filesBaseUrl)
        : this.placeholderImageUrl;

    // Format metadata according to ERC-1155 Metadata URI JSON Schema
    return {
      name: pool.name,
      description: description || 'Real World Asset Pool Token',
      image,
      decimals: 18,
      properties: {
        business: {
          id: business._id.toString(),
          name: business.name,
          riskScore: business.riskScore ?? undefined,
        },
        pool: {
          address: pool.poolAddress || undefined,
          holdToken: pool.holdToken || undefined,
          expectedHoldAmount: pool.expectedHoldAmount?.toString() || undefined,
          expectedRwaAmount: pool.expectedRwaAmount?.toString() || undefined,
          rewardPercent: pool.rewardPercent?.toString() || undefined,
          entryFeePercent: pool.entryFeePercent?.toString() || undefined,
          exitFeePercent: pool.exitFeePercent?.toString() || undefined,
          riskScore: pool.riskScore ?? undefined,
        },
        status: {
          isTargetReached: Boolean(pool.isTargetReached),
          isFullyReturned: Boolean(pool.isFullyReturned),
          paused: Boolean(pool.paused),
        },
        tags: pool.tags || [],
      },
    };
  }
}
