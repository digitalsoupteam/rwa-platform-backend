import { logger } from "@shared/monitoring/src/logger";
import { NotFoundError } from "@shared/errors/app-errors";
import { RefreshTokenEntity, IRefreshTokenEntity } from "../models/entity/refreshToken.entity";
import { Types } from "mongoose";

export class RefreshTokenRepository {
  constructor(private readonly model = RefreshTokenEntity) {}

  /**
   * Create new refresh token record
   */
  async create(userId: string, tokenHash: string, expiresAt: number) {
    logger.debug(`Creating refresh token for user: ${userId}`);
    
    const doc = await this.model.create({
      userId,
      tokenHash,
      expiresAt,
    });

    return doc;
  }

  /**
   * Find refresh token by hash
   */
  async findByTokenHash(tokenHash: string) {
    logger.debug(`Finding refresh token by hash`);
    
    const doc = await this.model.findOne({ tokenHash }).lean();
    return doc;
  }

  /**
   * Find all refresh tokens by user ID
   */
  async findByUserId(userId: string | Types.ObjectId) {
    logger.debug(`Finding refresh tokens for user: ${userId}`);
    
    const docs = await this.model.find({ userId }).lean();
    return docs;
  }

  /**
   * Delete specific refresh tokens for user
   */
  async deleteTokens(userId: string | Types.ObjectId, tokenHashes: string[]) {
    logger.debug(`Deleting ${tokenHashes.length} tokens for user: ${userId}`);
    
    const result = await this.model.deleteMany({
      userId,
      tokenHash: { $in: tokenHashes }
    });
    
    return result.deletedCount;
  }
}