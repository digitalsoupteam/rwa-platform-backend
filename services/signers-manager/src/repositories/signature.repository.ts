import { logger } from "@shared/monitoring/src/logger";
import { NotFoundError } from "@shared/errors/app-errors";
import { FilterQuery, SortOrder } from "mongoose";
import { SignatureEntity, ISignature } from "../models/entity/signature.entity";

export class SignatureRepository {
  constructor(private readonly model = SignatureEntity) {}

  async create(data: Pick<ISignature, "taskId" | "signer" | "signature">) {
    logger.debug(`Creating signature for task: ${data.taskId}`);
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  async findById(id: string) {
    logger.debug(`Finding signature by ID: ${id}`);
    const doc = await this.model.findById(id).lean();

    if (!doc) {
      throw new NotFoundError("Signature", id);
    }

    return doc;
  }

  async findByTaskId(
    taskId: string,
    sort: { [key: string]: SortOrder } = { createdAt: 'asc' }
  ) {
    logger.debug(`Finding signatures for task: ${taskId}`);
    const docs = await this.model
      .find({ taskId })
      .sort(sort)
      .lean();

    return docs;
  }

  async countByTaskId(taskId: string): Promise<number> {
    logger.debug(`Counting signatures for task: ${taskId}`);
    return this.model.countDocuments({ taskId });
  }

  async findAll(
    filters: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: 'asc' },
    limit: number = 100,
    offset: number = 0
  ) {
    logger.debug(`Finding signatures with filters: ${JSON.stringify(filters)}`);
    const docs = await this.model
      .find(filters)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();

    return docs;
  }
}