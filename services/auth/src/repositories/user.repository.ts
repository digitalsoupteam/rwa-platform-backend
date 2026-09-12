import { AppError } from '@shared/errors/app-errors';
import { UserEntity } from '../models/entity/user.entity';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

export class UserRepository {
  constructor(private readonly model = UserEntity) {}

  @TraceDecorator()
  async delete(id: string) {
    const doc = await this.model.findByIdAndDelete(id).lean();

    if (!doc) {
      throw new AppError({ message: `User ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });
    }

    return id;
  }

  @TraceDecorator()
  async findById(id: string) {
    const doc = await this.model.findById(id).lean();

    if (!doc) {
      throw new AppError({ message: `User ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });
    }

    return doc;
  }

  @TraceDecorator()
  async findByWallet(wallet: string) {
    const doc = await this.model.findOne({ wallet: wallet.toLowerCase() }).lean();

    if (!doc) {
      throw new AppError({
        message: `User ${wallet} not found`,
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    }

    return doc;
  }

  @TraceDecorator()
  async exists(wallet: string): Promise<boolean> {
    const doc = await this.model.exists({ wallet: wallet.toLowerCase() });
    return doc !== null;
  }

  @TraceDecorator()
  async findOrCreate(wallet: string) {
    const doc = await this.model.findOneAndUpdate(
      { wallet: wallet.toLowerCase() },
      {
        $setOnInsert: { wallet: wallet.toLowerCase() },
      },
      {
        upsert: true,
        new: true,
        lean: true,
      },
    );

    return doc!;
  }
}
