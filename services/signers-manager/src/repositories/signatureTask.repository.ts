import { logger } from "@shared/monitoring/src/logger";
import { NotFoundError } from "@shared/errors/app-errors";
import { FilterQuery, SortOrder } from "mongoose";
import { SignatureTask, ISignatureTask } from "../models/entity/signatureTask.entity";
import { TracingDecorator } from "@shared/monitoring/src/tracingDecorator";

@TracingDecorator()
export class SignatureTaskRepository {
  constructor(private readonly model = SignatureTask) {}

  async create(data: Pick<ISignatureTask, "ownerId" | "ownerType" | "hash" | "requiredSignatures" | "expired">) {
    logger.debug(`Creating signatures request with hash: ${data.hash}`);
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  async update(id: string, data: Partial<Pick<ISignatureTask, "completed">>) {
    logger.debug(`Updating signatures request: ${id}`);
    const doc = await this.model.findByIdAndUpdate(id, data, { new: true }).lean();

    if (!doc) {
      throw new NotFoundError("SignatureTask", id);
    }

    return doc;
  }

  async findById(id: string) {
    logger.debug(`Finding signatures request by ID: ${id}`);
    const doc = await this.model.findById(id).lean();

    if (!doc) {
      throw new NotFoundError("SignatureTask", id);
    }

    return doc;
  }

  async findByHash(hash: string) {
    logger.debug(`Finding signatures request by hash: ${hash}`);
    const doc = await this.model.findOne({ hash }).lean();

    if (!doc) {
      throw new NotFoundError("SignatureTask", `hash: ${hash}`);
    }

    return doc;
  }

  async findAll(
    filters: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: 'asc' },
    limit: number = 100,
    offset: number = 0
  ) {
    logger.debug(`Finding signatures requests with filters: ${JSON.stringify(filters)}`);
    const docs = await this.model
      .find(filters)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();

    return docs;
  }

  async findActive() {
    const now = Math.floor(Date.now() / 1000);
    return this.findAll({
      $or: [
        { expired: { $gt: now } },
        { expired: { $exists: false } }
      ]
    });
  }
}