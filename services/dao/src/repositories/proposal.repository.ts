import { logger } from "@shared/monitoring/src/logger";
import { FilterQuery, SortOrder } from "mongoose";
import { ProposalEntity, IProposalEntity } from "../models/entity/proposal.entity";

export class ProposalRepository {
  constructor(private readonly model = ProposalEntity) {}

  async create(data: Pick<IProposalEntity,
    "proposalId" |
    "proposer" |
    "target" |
    "data" |
    "description" |
    "startTime" |
    "endTime" |
    "chainId" |
    "transactionHash" |
    "logIndex"
  >) {
    logger.debug(`Creating proposal: ${data.proposalId} by proposer: ${data.proposer}`);

    const doc = await this.model.create(data);
    return doc.toObject();
  }

  async updateState(proposalId: string, state: "pending" | "executed" | "canceled") {
    logger.debug(`Updating proposal state: ${proposalId} to ${state}`);

    const doc = await this.model.findOneAndUpdate(
      { proposalId },
      { 
        state,
        updatedAt: Math.floor(Date.now() / 1000)
      },
      { new: true }
    ).lean();

    return doc;
  }

  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: "desc" },
    limit: number = 100,
    offset: number = 0
  ) {
    logger.debug(`Finding proposals with query: ${JSON.stringify(filter)}`);

    return await this.model
      .find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();
  }
}