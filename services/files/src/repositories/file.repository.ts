import { logger } from "@shared/monitoring/src/logger";
import { NotFoundError } from "@shared/errors/app-errors";
import { FileEntity, IFileEntity } from "../models/entity/file.entity";

export class FileRepository {
  constructor(private readonly model = FileEntity) {}

  async create(data: Pick<IFileEntity, "name" | "path" | "size" | "mimeType" >) {
    logger.debug(`Creating file: ${data.name}`);
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  async findById(id: string) {
    logger.debug(`Finding file by ID: ${id}`);
    const doc = await this.model.findById(id).lean();
    if (!doc) throw new NotFoundError("File", id);
    return doc;
  }

  async findByPath(path: string) {
    logger.debug(`Finding file by path: ${path}`);
    const doc = await this.model.findOne({ path }).lean();
    if (!doc) throw new NotFoundError("File", path);
    return doc;
  }

  async update(id: string, data: Partial<Pick<IFileEntity, "name">>) {
    logger.debug(`Updating file: ${id}`);
    const doc = await this.model.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true }
    ).lean();
    
    if (!doc) throw new NotFoundError("File", id);
    return doc;
  }

  async delete(id: string) {
    logger.debug(`Deleting file: ${id}`);
    const doc = await this.model.findByIdAndDelete(id).lean();
    if (!doc) throw new NotFoundError("File", id);
    return doc;
  }
}