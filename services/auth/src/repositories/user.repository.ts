import { NotFoundError } from "@shared/errors/app-errors";
import { UserEntity, IUserEntity } from "../models/entity/user.entity";
import { TracingDecorator } from "@shared/monitoring/src/tracingDecorator";

@TracingDecorator()
export class UserRepository {
  constructor(private readonly model = UserEntity) {}

  async delete(id: string) {
    const doc = await this.model.findByIdAndDelete(id).lean();

    if (!doc) {
      throw new NotFoundError("User", id);
    }

    return id;
  }

  async findById(id: string) {
    const doc = await this.model.findById(id).lean();

    if (!doc) {
      throw new NotFoundError("User", id);
    }

    return doc;
  }

  async findByWallet(wallet: string) {
    const doc = await this.model.findOne({ wallet: wallet.toLowerCase() }).lean();

    if (!doc) {
      throw new NotFoundError("User", wallet);
    }

    return doc;
  }

  async findOrCreate(wallet: string) {
    const doc = await this.model.findOneAndUpdate(
      { wallet: wallet.toLowerCase() },
      {
        $setOnInsert: { wallet: wallet.toLowerCase() }
      },
      {
        upsert: true,
        new: true,
        lean: true
      }
    );

    return doc!;
  }
}
