import { logger } from "@shared/monitoring/src/logger";
import { FilterQuery, SortOrder } from "mongoose";
import mongoose from "mongoose";
import { VoteEntity, IVoteEntity } from "../models/entity/vote.entity";
import { TracingDecorator } from "@shared/monitoring/src/tracingDecorator";

@TracingDecorator()
export class VoteRepository {
  constructor(private readonly model = VoteEntity) {}

  async create(data: Pick<IVoteEntity,
    "proposalId" |
    "chainId" |
    "governanceAddress" |
    "voterWallet" |
    "support" |
    "reason" |
    "transactionHash" |
    "logIndex" |
    "blockNumber"
  > & {weight: string}) {
    logger.debug(`Creating vote: ${data.voterWallet} voted ${data.support ? 'for' : 'against'} proposal ${data.proposalId}`);

    const doc = await this.model.create({
      ...data,
      weight: mongoose.Types.Decimal128.fromString(data.weight)
    });
    return doc.toObject();
  }

  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: "desc" },
    limit: number = 100,
    offset: number = 0
  ) {
    logger.debug(`Finding votes with query: ${JSON.stringify(filter)}`);

    return await this.model
      .find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();
  }
}