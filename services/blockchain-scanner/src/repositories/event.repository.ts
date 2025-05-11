import { logger } from "@shared/monitoring/src/logger";
import { NotFoundError } from "@shared/errors/app-errors";
import { EventEntity, IEventEntity } from "../models/entity/event.entity";
import type { FilterQuery, SortOrder } from "mongoose";
import { Types } from "mongoose";

export class EventRepository {
  constructor(private readonly model = EventEntity) {}

  /**
   * Find event by ID
   */
  async findById(id: string) {
    return await this.model.findById(id).lean();
  }

  /**
   * Save multiple events to database
   */
  async createEvents(
    data: Pick<IEventEntity, "chainId" | "blockNumber" | "transactionHash" | "logIndex" | "address" | "name" | "data" | "timestamp">[]
  ) {
    if (data.length === 0) return [];
    
    logger.debug(`Creating ${data.length} events`);

    const docs = await this.model.insertMany(data, { ordered: true, lean: true });
    logger.debug(`Created ${docs.length} events`);

    return docs;
  }

  /**
   * Delete all events for a specific block
   */
  async deleteBlockEvents(chainId: number, blockNumber: number) {
    logger.debug(`Deleting events for chain ${chainId} block ${blockNumber}`);
    
    const result = await this.model.deleteMany({
      chainId,
      blockNumber
    });

    const deletedCount = result.deletedCount
    logger.debug(`Deleted ${deletedCount} events for chain ${chainId} block ${blockNumber}`);

    return deletedCount
  }

  async findAll(
    filters: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { blockNumber: -1, logIndex: -1 },
    limit: number = 100,
    offset: number = 0
  ) {
    logger.debug(`Finding events with filters: ${JSON.stringify(filters)}`);
      return await this.model
        .find(filters)
        .sort(sort)
        .skip(offset)
        .limit(limit)
        .lean();
  }
}
