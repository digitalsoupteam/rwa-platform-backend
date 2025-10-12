import { logger } from "@shared/monitoring/src/logger";
import { NotFoundError } from "@shared/errors/app-errors";
import { ScannerStateEntity, IScannerStateEntity } from "../models/entity/scannerState.entity";
import type { FilterQuery, SortOrder } from "mongoose";
import { TracingDecorator } from "@shared/monitoring/src/tracingDecorator";

@TracingDecorator()
export class ScannerStateRepository {
  constructor(private readonly model = ScannerStateEntity) {}

  async create(data: Pick<IScannerStateEntity, "chainId" | "lastScannedBlock">) {
    logger.debug(`Creating ScannerState for chain: ${data.chainId}`);
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  async update(chainId: number, data: Pick<IScannerStateEntity, "lastScannedBlock">) {
    logger.debug(`Updating ScannerState for chain: ${chainId}`);
    const doc = await this.model.findOneAndUpdate(
      { chainId },
      data,
      { new: true }
    ).lean();

    if (!doc) {
      throw new NotFoundError("ScannerState", chainId.toString());
    }

    return doc;
  }

  async delete(chainId: number) {
    logger.debug(`Deleting ScannerState for chain: ${chainId}`);
    const doc = await this.model.findOneAndDelete({ chainId }).lean();

    if (!doc) {
      throw new NotFoundError("ScannerState", chainId.toString());
    }

    return chainId;
  }

  async getLastScannedBlock(chainId: number): Promise<number> {
    logger.debug(`Getting last scanned block for chain: ${chainId}`);
    const doc = await this.model.findOne({ chainId }).lean();
    return doc?.lastScannedBlock ?? 0;
  }

  async updateLastScannedBlock(chainId: number, blockNumber: number): Promise<void> {
    logger.debug(`Updating last scanned block for chain ${chainId} to ${blockNumber}`);
    const doc = await this.model.findOne({ chainId });

    if (doc) {
      await this.model.findOneAndUpdate(
        { chainId },
        { lastScannedBlock: blockNumber },
        { new: true }
      ).lean();
    } else {
      await this.create({
        chainId,
        lastScannedBlock: blockNumber
      });
    }
  }

  async findAll(
    filters: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: 'asc' },
    limit: number = 100,
    offset: number = 0
  ) {
    logger.debug(`Finding ScannerStates with filters: ${JSON.stringify(filters)}`);
    const docs = await this.model
      .find(filters)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();

    return docs;
  }
}