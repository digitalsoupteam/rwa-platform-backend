import { logger } from "@shared/monitoring/src/logger";
import { FilterQuery, SortOrder } from "mongoose";
import { TimelockTaskEntity, ITimelockTaskEntity } from "../models/entity/timelockTask.entity";

export class TimelockTaskRepository {
  constructor(private readonly model = TimelockTaskEntity) {}

  async create(data: Pick<ITimelockTaskEntity,
    "txHash" |
    "target" |
    "data" |
    "eta" |
    "chainId"
  >) {
    logger.debug(`Creating timelock task: ${data.txHash} with eta: ${data.eta}`);

    const doc = await this.model.create(data);
    return doc.toObject();
  }

  async updateExecuted(txHash: string, executed: boolean = true) {
    logger.debug(`Updating timelock task execution status: ${txHash} to ${executed}`);

    const doc = await this.model.findOneAndUpdate(
      { txHash },
      { 
        executed,
        updatedAt: Math.floor(Date.now() / 1000)
      },
      { new: true }
    ).lean();

    return doc;
  }

  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: "desc" },
    limit: number = 100,
    offset: number = 0
  ) {
    logger.debug(`Finding timelock tasks with query: ${JSON.stringify(filter)}`);

    return await this.model
      .find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();
  }
}