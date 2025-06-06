import { logger } from "@shared/monitoring/src/logger";
import { NotFoundError } from "@shared/errors/app-errors";
import { FilterQuery, SortOrder, Types } from "mongoose";
import {
  UserPoolTokenActivityEntity,
  IUserPoolTokenActivityEntity,
} from "../models/entity/userPoolTokenActivity.entity";

export class UserPoolTokenActivityRepository {
  constructor(private readonly model = UserPoolTokenActivityEntity) { }

  async findById(id: string) {
    logger.debug(`Finding user pool token activity by ID: ${id}`);
    const doc = await this.model.findById(id).lean();

    if (!doc) {
      throw new NotFoundError("UserPoolTokenActivity", id);
    }

    return doc;
  }

  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: "desc" },
    limit: number = 100,
    offset: number = 0
  ) {
    logger.debug(`Finding user pool token activities with query: ${JSON.stringify(filter)}`);

    return await this.model
      .find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();
  }

  async upsert(
    userWallet: string, 
    chainId: number, 
    poolId: string, 
    businessId: string, 
    holdTokenAddress: string, 
    data: Partial<Pick<IUserPoolTokenActivityEntity,
      | "earlyMintVolume"
      | "earlyBurnVolume"
      | "middleMintVolume"
      | "middleBurnVolume"
      | "lateMintVolume"
      | "lateBurnVolume"
      | "postMintVolume"
      | "postBurnVolume"
    >>
  ) {
    logger.debug(`Upserting user pool token activity for wallet: ${userWallet}, pool: ${poolId}, chain: ${chainId}, token: ${holdTokenAddress}`);

    const doc = await this.model.findOneAndUpdate(
      { userWallet, poolId, chainId, holdTokenAddress },
      {
        $setOnInsert: {
          userWallet,
          chainId,
          poolId,
          businessId,
          holdTokenAddress,
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