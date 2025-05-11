import {
  FaucetRequestEntity,
  IFaucetRequestEntity,
} from "../models/entity/faucet.entity";
import { FaucetTokenType } from "../models/shared/enums.model";

export class FaucetRequestRepository {
  async create(data: {
    userId: string;
    wallet: string;
    tokenType: FaucetTokenType;
    amount: number;
    transactionHash: string;
  }) {
    const request = await FaucetRequestEntity.create<IFaucetRequestEntity>(
      data
    );
    return request.toObject();
  }

  async findById(id: string) {
    const request = await FaucetRequestEntity.findById(id);
    return request?.toObject();
  }

  async findAll(
    filter: {
      userId?: string;
      wallet?: string;
      tokenType?: FaucetTokenType;
    },
    options: {
      limit?: number;
      offset?: number;
      sort?: Record<string, 'asc' | 'desc'>;
    } = {}
  ) {
    const { limit = 50, offset = 0, sort = { createdAt: 'asc' } } = options;

    const requests = await FaucetRequestEntity.find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();

    return requests;
  }
}
