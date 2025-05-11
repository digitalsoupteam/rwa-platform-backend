import { logger } from "@shared/monitoring/src/logger";
import { NotFoundError } from "@shared/errors/app-errors";
import { UserEntity, IUserEntity } from "../models/entity/user.entity";

export class UserRepository {
  constructor(private readonly model = UserEntity) {}



  async delete(id: string) {
    logger.debug(`Deleting user: ${id}`);
    const doc = await this.model.findByIdAndDelete(id).lean();

    if (!doc) {
      throw new NotFoundError("User", id);
    }

    return id;
  }

  async findById(id: string) {
    logger.debug(`Finding user by ID: ${id}`);
    const doc = await this.model.findById(id).lean();

    if (!doc) {
      throw new NotFoundError("User", id);
    }

    return doc;
  }

  async findByWallet(wallet: string) {
    logger.debug(`Finding user by wallet: ${wallet}`);
    const doc = await this.model.findOne({ wallet: wallet.toLowerCase() }).lean();

    if (!doc) {
      throw new NotFoundError("User", wallet);
    }

    return doc;
  }

  /**
   * Find user by wallet or create new one
   * Uses single MongoDB operation
   */
  async findOrCreate(wallet: string) {
    logger.debug(`Finding or creating user with wallet: ${wallet}`);
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
