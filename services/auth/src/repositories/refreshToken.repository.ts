import { RefreshTokenEntity } from "../models/entity/refreshToken.entity";
import type { Types } from "mongoose";
import { TraceDecorator } from "@shared/monitoring/src/traceDecorator";

export class RefreshTokenRepository {
  constructor(private readonly model = RefreshTokenEntity) {}

  @TraceDecorator()
  async create(userId: string, tokenHash: string, expiresAt: number) {
    const doc = await this.model.create({
      userId,
      tokenHash,
      expiresAt,
    });

    return doc;
  }

  @TraceDecorator()
  async findByTokenHash(tokenHash: string) {
    const doc = await this.model.findOne({ tokenHash }).lean();
    return doc;
  }

  @TraceDecorator()
  async findByUserId(userId: string | Types.ObjectId) {
    const docs = await this.model.find({ userId }).lean();
    return docs;
  }

  @TraceDecorator()
  async deleteTokens(userId: string | Types.ObjectId, tokenHashes: string[]) {
    const result = await this.model.deleteMany({
      userId,
      tokenHash: { $in: tokenHashes }
    });

    return result.deletedCount;
  }
}
