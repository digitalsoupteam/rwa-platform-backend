import { NotFoundError } from "@shared/errors/app-errors";
import { RefreshTokenEntity, IRefreshTokenEntity } from "../models/entity/refreshToken.entity";
import { Types } from "mongoose";
import { TracingDecorator } from "@shared/monitoring/src/tracingDecorator";

@TracingDecorator()
export class RefreshTokenRepository {
  constructor(private readonly model = RefreshTokenEntity) {}

  async create(userId: string, tokenHash: string, expiresAt: number) {
    const doc = await this.model.create({
      userId,
      tokenHash,
      expiresAt,
    });

    return doc;
  }

  async findByTokenHash(tokenHash: string) {
    const doc = await this.model.findOne({ tokenHash }).lean();
    return doc;
  }

  async findByUserId(userId: string | Types.ObjectId) {
    const docs = await this.model.find({ userId }).lean();
    return docs;
  }

  async deleteTokens(userId: string | Types.ObjectId, tokenHashes: string[]) {
    const result = await this.model.deleteMany({
      userId,
      tokenHash: { $in: tokenHashes }
    });

    return result.deletedCount;
  }
}