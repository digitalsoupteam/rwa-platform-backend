import { logger } from "@shared/monitoring/src/logger";
import { NotFoundError } from "@shared/errors/app-errors";
import { FilterQuery, SortOrder } from "mongoose";
import { PoolEntity, IPoolEntity } from "../models/entity/pool.entity";

export class PoolRepository {
  constructor(private readonly model = PoolEntity) { }

  async createPool(data: Pick<IPoolEntity,
    "ownerId" |
    "ownerType" |
    "name" |
    "chainId" |
    "businessId" |
    "rwaAddress"
  >) {
    logger.debug(`Creating pool: ${JSON.stringify(data)}`);
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  async updatePool(id: string, data: Partial<Pick<IPoolEntity,
    "name" |
    "poolAddress" |
    "tokenId" |
    "holdToken" |
    "entryFeePercent" |
    "exitFeePercent" |
    "expectedHoldAmount" |
    "expectedRwaAmount" |
    "expectedBonusAmount" |
    "rewardPercent" |
    "entryPeriodStart" |
    "entryPeriodExpired" |
    "completionPeriodExpired" |
    "awaitCompletionExpired" |
    "floatingOutTranchesTimestamps" |
    "fixedSell" |
    "allowEntryBurn" |
    "priceImpactPercent" |
    "liquidityCoefficient" |
    "k" |
    "realHoldReserve" |
    "virtualHoldReserve" |
    "virtualRwaReserve" |
    "floatingTimestampOffset" |
    "isTargetReached" |
    "isFullyReturned" |
    "fullReturnTimestamp" |
    "totalClaimedAmount" |
    "totalReturnedAmount" |
    "awaitingBonusAmount" |
    "awaitingRwaAmount" |
    "outgoingTranchesBalance" |
    "outgoingTranches" |
    "incomingTranches" |
    "lastCompletedIncomingTranche" |
    "paused" |
    "description" |
    "tags" |
    "riskScore" |
    "approvalSignaturesTaskId" |
    "approvalSignaturesTaskExpired"
  >>) {
    logger.debug(`Updating pool fields: ${id}`);
    const doc = await this.model.findByIdAndUpdate(id, data, { new: true }).lean();

    if (!doc) {
      throw new NotFoundError("Pool", id);
    }

    return doc;
  }


  async findById(id: string) {
    logger.debug(`Finding pool by ID: ${id}`);
    const doc = await this.model.findById(id).lean();

    if (!doc) {
      throw new NotFoundError("Pool", id);
    }

    return doc;
  }

  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: "asc" },
    limit: number = 100,
    offset: number = 0
  ) {
    logger.debug(`Finding pools with query: ${JSON.stringify(filter)}`);

    return await this.model
      .find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();
  }
}
