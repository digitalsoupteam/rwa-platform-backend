import { logger } from "@shared/monitoring/src/logger";
import { NotFoundError } from "@shared/errors/app-errors";
import { FilterQuery, SortOrder } from "mongoose";
import { ReferralEntity, IReferralEntity } from "../models/entity/referral.entity";

export class ReferralRepository {
  constructor(private readonly model = ReferralEntity) { }

  async create(data: Pick<IReferralEntity,
    "userWallet" |
    "userId" |
    "referrerWallet" |
    "referrerId"
  >) {
    logger.debug(`Creating referral: ${data.userWallet} -> ${data.referrerWallet}`);

    const doc = await this.model.create(data);
    return doc.toObject();
  }

  async findByUserWallet(userWallet: string) {
    logger.debug(`Finding referral by user wallet: ${userWallet} `);

    const doc = await this.model.findOne({
      userWallet,
    }).lean();

    return doc;
  }

  async findByReferrerWallet(referrerWallet: string) {
    logger.debug(`Finding referral by referrer wallet: ${referrerWallet}`);

    const doc = await this.model.findOne({
      referrerWallet,
    }).lean();

    return doc;
  }

  async findByUserId(userId: string) {
    logger.debug(`Finding referral by user id: ${userId} `);

    const doc = await this.model.findOne({
      userId,
    }).lean();

    return doc;
  }

  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: "desc" },
    limit: number = 100,
    offset: number = 0
  ) {
    logger.debug(`Finding referrals with query: ${JSON.stringify(filter)}`);

    return await this.model
      .find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();
  }

}