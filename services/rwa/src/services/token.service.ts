import { logger } from "@shared/monitoring/src/logger";
import { PoolRepository } from "../repositories/pool.repository";
import { BusinessRepository } from "../repositories/business.repository";
import { NotFoundError } from "@shared/errors/app-errors";

export class TokenService {
  constructor(
    private readonly poolRepository: PoolRepository,
    private readonly businessRepository: BusinessRepository
  ) {}

  async getTokenMetadata(tokenId: string) {
    logger.debug("Getting token metadata", { tokenId });

    // Find pool by tokenId
    const pools = await this.poolRepository.findAll({ tokenId }, { createdAt: "asc" }, 1);
    if (!pools.length) {
      throw new NotFoundError("Pool not found");
    }
    const pool = pools[0];

    // Find associated business
    const business = await this.businessRepository.findById(pool.businessId);
    if (!business) {
      throw new NotFoundError("Business not found");
    }

    // Combine descriptions
    const description = [
      business.description,
      pool.description
    ].filter(Boolean).join("\n\n");

    // Combine and deduplicate tags
    const tags = Array.from(new Set([
      ...(business.tags || []),
      ...(pool.tags || [])
    ]));

    // Get image with fallback logic
    const image = pool.image || business.image || `https://example.com/images/${tokenId}.png`;

    // Format metadata according to ERC-1155 Metadata URI JSON Schema
    return {
      name: pool.name,
      description: description || "Real World Asset Pool Token",
      image,
      decimals: 18,
      properties: {
        business: {
          id: business._id.toString(),
          name: business.name,
          riskScore: business.riskScore
        },
        pool: {
          address: pool.poolAddress || undefined,
          holdToken: pool.holdToken || undefined,
          expectedHoldAmount: pool.expectedHoldAmount?.toString() || undefined,
          expectedRwaAmount: pool.expectedRwaAmount?.toString() || undefined,
          rewardPercent: pool.rewardPercent?.toString() || undefined,
          entryFeePercent: pool.entryFeePercent?.toString() || undefined,
          exitFeePercent: pool.exitFeePercent?.toString() || undefined
        },
        status: {
          isTargetReached: Boolean(pool.isTargetReached),
          isFullyReturned: Boolean(pool.isFullyReturned),
          paused: Boolean(pool.paused)
        },
        tags: pool.tags || []
      }
    };
  }
}