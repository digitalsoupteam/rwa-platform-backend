import { AppError } from "@shared/errors/app-errors";
import type { FilterQuery, SortOrder } from "mongoose";
import { DocumentsFolderEntity } from "../models/entity/documentsFolder.entity";
import type { IDocumentsFolderEntity } from "../models/entity/documentsFolder.entity";
import { TraceDecorator } from "@shared/monitoring/src/traceDecorator";


export class DocumentsFolderRepository {
  constructor(private readonly model = DocumentsFolderEntity) {}

  @TraceDecorator()
  async create(data: Pick<IDocumentsFolderEntity, "name" | "parentId" | "ownerId" | "ownerType" | "creator" | "grandParentId">) {
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  @TraceDecorator()
  async update(id: string, data: Partial<Pick<IDocumentsFolderEntity, "name">>) {
    const doc = await this.model.findByIdAndUpdate(id, data, { new: true }).lean();

    if (!doc) {
      throw new AppError({ message: `DocumentsFolder ${id} not found`, statusCode: 404, code: "NOT_FOUND" });
    }

    return doc;
  }

  @TraceDecorator()
  async delete(id: string) {
    const doc = await this.model.findByIdAndDelete(id).lean();

    if (!doc) {
      throw new AppError({ message: `DocumentsFolder ${id} not found`, statusCode: 404, code: "NOT_FOUND" });
    }

    return id;
  }

  @TraceDecorator()
  async findById(id: string) {
    const doc = await this.model.findById(id).lean();

    if (!doc) {
      throw new AppError({ message: `DocumentsFolder ${id} not found`, statusCode: 404, code: "NOT_FOUND" });
    }

    return doc;
  }

  @TraceDecorator()
  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: "asc" },
    limit: number = 100,
    offset: number = 0
  ) {

    return await this.model
      .find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();
  }
}
