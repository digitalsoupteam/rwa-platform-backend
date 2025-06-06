import { logger } from "@shared/monitoring/src/logger";
import { NotFoundError } from "@shared/errors/app-errors";
import { FilterQuery, SortOrder, Types } from "mongoose";
import {
  UserPoolActivityEntity,
  IUserPoolActivityEntity,
} from "../models/entity/userPoolActivity.entity";

export class UserPoolActivityRepository {
  constructor(private readonly model = UserPoolActivityEntity) { }

  async findById(id: string) {
    logger.debug(`Finding user pool activity by ID: ${id}`);
    const doc = await this.model.findById(id).lean();

    if (!doc) {
      throw new NotFoundError("UserPoolActivity", id);
    }

    return doc;
  }

  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: "desc" },
    limit: number = 100,
    offset: number = 0
  ) {
    logger.debug(`Finding user pool activities with query: ${JSON.stringify(filter)}`);

    return await this.model
      .find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();
  }

  async upsert(userWallet: string, chainId: number, poolId: string, businessId: string, data: Partial<Pick<IUserPoolActivityEntity,
    | "earlyMintCount"
    | "earlyBurnCount"
    | "middleMintCount"
    | "middleBurnCount"
    | "lateMintCount"
    | "lateBurnCount"
    | "postMintCount"
    | "postBurnCount"
    | "targetsReachedCount"
  >>) {
    logger.debug(`Upserting user pool activity for wallet: ${userWallet}, pool: ${poolId}, chain: ${chainId}`);

    const doc = await this.model.findOneAndUpdate(
      { userWallet, poolId, chainId },
      {
        $setOnInsert: {
          userWallet,
          chainId,
          poolId,
          businessId,
        },
        $inc: data,
      },
      {
        new: true,
        upsert: true,
        lean: true
      }
    );

    return doc;
  }
}