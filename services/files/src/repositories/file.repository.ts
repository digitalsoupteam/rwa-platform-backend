import { AppError } from "@shared/errors/app-errors";
import { FileEntity, type IFileEntity } from "../models/entity/file.entity";
import { TraceDecorator } from "@shared/monitoring/src/traceDecorator";


export class FileRepository {
  constructor(private readonly model = FileEntity) {}

  @TraceDecorator()
  async create(data: Pick<IFileEntity, "name" | "path" | "size" | "mimeType" >) {
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  @TraceDecorator()
  async findById(id: string) {
    const doc = await this.model.findById(id).lean();
    if (!doc) throw new AppError({ message: `File ${id} not found`, statusCode: 404, code: "NOT_FOUND" });
    return doc;
  }

  @TraceDecorator()
  async findByPath(path: string) {
    const doc = await this.model.findOne({ path }).lean();
    if (!doc) throw new AppError({ message: `File ${path} not found`, statusCode: 404, code: "NOT_FOUND" });
    return doc;
  }

  @TraceDecorator()
  async update(id: string, data: Partial<Pick<IFileEntity, "name">>) {
    const doc = await this.model.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true }
    ).lean();
    
    if (!doc) throw new AppError({ message: `File ${id} not found`, statusCode: 404, code: "NOT_FOUND" });
    return doc;
  }

  @TraceDecorator()
  async delete(id: string) {
    const doc = await this.model.findByIdAndDelete(id).lean();
    if (!doc) throw new AppError({ message: `File ${id} not found`, statusCode: 404, code: "NOT_FOUND" });
    return doc;
  }
}