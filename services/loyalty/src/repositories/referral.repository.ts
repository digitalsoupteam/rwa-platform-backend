import type { FilterQuery, SortOrder } from 'mongoose';
import { ReferralEntity } from '../models/entity/referral.entity';
import type { IReferralEntity } from '../models/entity/referral.entity';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

export class ReferralRepository {
  constructor(private readonly model = ReferralEntity) {}

  @TraceDecorator()
  async create(data: Pick<IReferralEntity, 'userWallet' | 'userId' | 'referrerWallet' | 'referrerId'>) {
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  @TraceDecorator()
  async findByUserWallet(userWallet: string) {
    const doc = await this.model
      .findOne({
        userWallet,
      })
      .lean();

    return doc;
  }

  @TraceDecorator()
  async findByReferrerWallet(referrerWallet: string) {
    const doc = await this.model
      .findOne({
        referrerWallet,
      })
      .lean();

    return doc;
  }

  @TraceDecorator()
  async findByUserId(userId: string) {
    const doc = await this.model
      .findOne({
        userId,
      })
      .lean();

    return doc;
  }

  @TraceDecorator()
  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: 'desc' },
    limit: number = 100,
    offset: number = 0,
  ) {
    return await this.model.find(filter).sort(sort).skip(offset).limit(limit).lean();
  }
}
