import { AppError } from '@shared/errors/app-errors';
import { PoolRepository } from '../repositories/pool.repository';
import { BusinessRepository } from '../repositories/business.repository';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';
import { MetricsDecorator } from '@shared/monitoring/src/metricsDecorator';
import { LogDecorator } from '@shared/monitoring/src/logDecorator';
import { setSpanAttributes } from '@shared/monitoring/src/tracing';

export class TokenService {
  constructor(
    private readonly poolRepository: PoolRepository,
    private readonly businessRepository: BusinessRepository,
    private readonly placeholderImageUrl: string,
  ) {}

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ tokenId: a[0] }),
  })
  async getTokenMetadata(tokenId: string) {
    setSpanAttributes({ tokenId });
    // Find pool by tokenId
    const pools = await this.poolRepository.findAll({ tokenId }, { createdAt: 'asc' }, 1);
    if (!pools.length) {
      throw new AppError({ message: 'Pool not found', statusCode: 404, code: 'NOT_FOUND' });
    }
    const pool = pools[0];

    // Find associated business
    const business = await this.businessRepository.findById(pool.businessId);
    if (!business) {
      throw new AppError({ message: 'Business not found', statusCode: 404, code: 'NOT_FOUND' });
    }

    // Combine descriptions
    const description = [business.description, pool.description].filter(Boolean).join('\n\n');

    // Get image with fallback logic
    const image = pool.image || business.image || this.placeholderImageUrl;

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
