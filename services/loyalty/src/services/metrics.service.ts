import { logger } from "@shared/monitoring/src/logger";
import { ProductOwnerMetricsRepository } from "../repositories/productOwnerMetrics.repository";
import { ProductOwnerTokenMetricsRepository } from "../repositories/productOwnerTokenMetrics.repository";
import { UserPoolActivityRepository } from "../repositories/userPoolActivity.repository";
import { UserPoolTokenActivityRepository } from "../repositories/userPoolTokenActivity.repository";
import { SortOrder, Types } from "mongoose";

export class MetricsService {
  constructor(
    private readonly productOwnerMetricsRepository: ProductOwnerMetricsRepository,
    private readonly productOwnerTokenMetricsRepository: ProductOwnerTokenMetricsRepository,
    private readonly userPoolActivityRepository: UserPoolActivityRepository,
    private readonly userPoolTokenActivityRepository: UserPoolTokenActivityRepository
  ) { }

  async syncRWADeployed(data: {
    emittedFrom: string;
    deployer: string;
    owner: string;
    chainId: number;
  }) {
    logger.debug("Syncing RWA deployment metrics", { data });

    if (data.deployer !== data.owner) {
      await this.productOwnerMetricsRepository.upsert(data.owner, data.chainId, {
        businessesCreated: 1,
      });
      await this.productOwnerMetricsRepository.upsert(data.deployer, data.chainId, {
        businessesDeployed: 1
      });
    } else {
      await this.productOwnerMetricsRepository.upsert(data.owner, data.chainId, {
        businessesCreated: 1,
        businessesDeployed: 1,
      });
    }

    logger.info("Updated metrics for RWA deployment", {
      owner: data.owner,
      deployer: data.deployer,
      chainId: data.chainId
    });
  }

  async syncPoolDeployed(data: {
    emittedFrom: string;
    deployer: string;
    entityId: string;
    entityOwnerId: string;
    owner: string;
    chainId: number;
  }) {
    logger.debug("Syncing pool deployment metrics", { data });

    if (data.deployer !== data.owner) {
      await this.productOwnerMetricsRepository.upsert(data.owner, data.chainId, {
        poolsCreated: 1,
      });
      await this.productOwnerMetricsRepository.upsert(data.deployer, data.chainId, {
        poolsDeployed: 1
      });
    } else {
      await this.productOwnerMetricsRepository.upsert(data.owner, data.chainId, {
        poolsCreated: 1,
        poolsDeployed: 1
      });
    }

    logger.info("Updated metrics for pool deployment", {
      owner: data.owner,
      deployer: data.deployer,
      chainId: data.chainId
    });
  }

  async syncPoolFundsFullyReturned(data: {
    emittedFrom: string;
    caller: string;
    owner: string;
    chainId: number;
  }) {
    logger.debug("Syncing pool fully returned metrics", { data });

    if (data.caller !== data.owner) {
      await this.productOwnerMetricsRepository.upsert(data.owner, data.chainId, {
        fullyReturnedPools: 1,
      });
      await this.productOwnerMetricsRepository.upsert(data.caller, data.chainId, {
        poolsFullyReturnCalled: 1
      });
    } else {
      await this.productOwnerMetricsRepository.upsert(data.owner, data.chainId, {
        fullyReturnedPools: 1,
        poolsFullyReturnCalled: 1
      });
    }

    logger.info("Updated metrics for fully returned pool", {
      owner: data.owner,
      caller: data.caller,
      pool: data.emittedFrom,
      chainId: data.chainId
    });
  }

  async syncPoolRwaMinted(data: {
    emittedFrom: string;
    minter: string;
    rwaAmountMinted: string;
    holdAmountPaid: string;
    feePaid: string;
    percentBefore: number;
    userPercent: number;
    targetReached: boolean;
    businessId: string;
    poolId: string;
    holdToken: string;
    chainId: number;
  }) {
    const stage = this.calculateStage(data.percentBefore, data.targetReached);
    const countField = `${stage}MintCount` as const;
    const volumeField = `${stage}MintVolume` as const;

    const updates: Record<string, number> = { [countField]: 1 };

    // Check if target is reached in this mint
    if (data.targetReached &&
      data.percentBefore < 10000 &&
      data.percentBefore + data.userPercent >= 10000) {
      updates.targetsReachedCount = 1;
    }

    await this.userPoolActivityRepository.upsert(
      data.minter,
      data.chainId,
      data.poolId,
      data.businessId,
      updates
    );

    await this.userPoolTokenActivityRepository.upsert(
      data.minter,
      data.chainId,
      data.poolId,
      data.businessId,
      data.holdToken,
      { [volumeField]: Types.Decimal128.fromString(data.holdAmountPaid) }
    );
  }

  async syncPoolRwaBurned(data: {
    emittedFrom: string;
    burner: string;
    rwaAmountBurned: string;
    holdAmountReceived: string;
    bonusAmountReceived: string;
    holdFeePaid: string;
    bonusFeePaid: string;
    percentBefore: number;
    userPercent: number;
    targetReached: boolean;
    businessId: string;
    poolId: string;
    holdToken: string;
    chainId: number;
  }) {
    const stage = this.calculateStage(data.percentBefore, data.targetReached);
    const countField = `${stage}BurnCount` as const;
    const volumeField = `${stage}BurnVolume` as const;

    await this.userPoolActivityRepository.upsert(
      data.burner,
      data.chainId,
      data.poolId,
      data.businessId,
      { [countField]: 1 }
    );

    await this.userPoolTokenActivityRepository.upsert(
      data.burner,
      data.chainId,
      data.poolId,
      data.businessId,
      data.holdToken,
      { [volumeField]: Types.Decimal128.fromString(data.holdAmountReceived) }
    );
  }

  async syncPoolTargetReached(data: {
    emittedFrom: string;
    owner: string;
    chainId: number;
  }) {
    await this.productOwnerMetricsRepository.upsert(data.owner, data.chainId, {
      targetReachedPools: 1
    });
  }

  private calculateStage(percentBefore: number, isTargetReached: boolean): "early" | "middle" | "late" | "post" {
    if (isTargetReached) return "post";
    if (percentBefore < 3300) return "early";
    if (percentBefore < 6600) return "middle";
    return "late";
  }

  async syncPoolIncomingTrancheUpdate(data: {
    emittedFrom: string;
    caller: string;
    owner: string;
    trancheIndex: number;
    amountAppliedToTranche: string;
    isNowComplete: boolean;
    wasOnTime: boolean;
    holdToken: string;
    chainId: number;
  }) {
    logger.debug("Syncing pool incoming tranche update metrics", { data });

    // Update incoming tranches count
    await this.productOwnerMetricsRepository.upsert(data.owner, data.chainId, {
      incomingTranchesCount: 1
    });

    // Update total funds returned based on who made the return
    if (data.caller === data.owner) {
      await this.productOwnerTokenMetricsRepository.upsert(
        data.owner,
        data.chainId,
        data.holdToken,
        {
          ownerTotalFundsReturned: Types.Decimal128.fromString(data.amountAppliedToTranche)
        }
      );
    } else {
      await this.productOwnerTokenMetricsRepository.upsert(
        data.owner,
        data.chainId,
        data.holdToken,
        {
          managerTotalFundsReturned: Types.Decimal128.fromString(data.amountAppliedToTranche)
        }
      );
    }
  }


  async getProductOwnerMetrics(params: {
    filter: Record<string, any>;
    sort?: { [key: string]: SortOrder };
    limit?: number;
    offset?: number;
  }) {
    logger.debug("Getting product owner metrics list", params);

    const metrics = await this.productOwnerMetricsRepository.findAll(
      params.filter,
      params.sort,
      params.limit,
      params.offset
    );

    return metrics.map(metric => ({
      id: metric._id.toString(),
      userWallet: metric.userWallet,
      chainId: metric.chainId,
      businessesCreated: metric.businessesCreated,
      poolsCreated: metric.poolsCreated,
      businessesDeployed: metric.businessesDeployed,
      poolsDeployed: metric.poolsDeployed,
      targetReachedPools: metric.targetReachedPools,
      fullyReturnedPools: metric.fullyReturnedPools,
      poolsReturnCalled: metric.poolsReturnCalled,
      poolsFullyReturnCalled: metric.poolsFullyReturnCalled,
      incomingTranchesCount: metric.incomingTranchesCount,
      outgoingTranchesCount: metric.outgoingTranchesCount,
      createdAt: metric.createdAt,
      updatedAt: metric.updatedAt
    }));
  }

  async getProductOwnerTokenMetrics(params: {
    filter: Record<string, any>;
    sort?: { [key: string]: SortOrder };
    limit?: number;
    offset?: number;
  }) {
    logger.debug("Getting product owner token metrics list", params);

    const metrics = await this.productOwnerTokenMetricsRepository.findAll(
      params.filter,
      params.sort,
      params.limit,
      params.offset
    );

    return metrics.map(metric => ({
      id: metric._id.toString(),
      userWallet: metric.userWallet,
      chainId: metric.chainId,
      holdTokenAddress: metric.holdTokenAddress,
      ownerTotalFundsReturned: metric.ownerTotalFundsReturned.toString(),
      managerTotalFundsReturned: metric.managerTotalFundsReturned.toString(),
      totalFundsWithdrawn: metric.totalFundsWithdrawn.toString(),
      createdAt: metric.createdAt,
      updatedAt: metric.updatedAt
    }));
  }

  async getUserPoolActivities(params: {
    filter: Record<string, any>;
    sort?: { [key: string]: SortOrder };
    limit?: number;
    offset?: number;
  }) {
    logger.debug("Getting user pool activities list", params);

    const activities = await this.userPoolActivityRepository.findAll(
      params.filter,
      params.sort,
      params.limit,
      params.offset
    );

    return activities.map(activity => ({
      id: activity._id.toString(),
      userWallet: activity.userWallet,
      chainId: activity.chainId,
      poolId: activity.poolId,
      businessId: activity.businessId,
      earlyMintCount: activity.earlyMintCount,
      earlyBurnCount: activity.earlyBurnCount,
      middleMintCount: activity.middleMintCount,
      middleBurnCount: activity.middleBurnCount,
      lateMintCount: activity.lateMintCount,
      lateBurnCount: activity.lateBurnCount,
      postMintCount: activity.postMintCount,
      postBurnCount: activity.postBurnCount,
      targetsReachedCount: activity.targetsReachedCount,
      createdAt: activity.createdAt,
      updatedAt: activity.updatedAt
    }));
  }

  async getUserPoolTokenActivities(params: {
    filter: Record<string, any>;
    sort?: { [key: string]: SortOrder };
    limit?: number;
    offset?: number;
  }) {
    logger.debug("Getting user pool token activities list", params);

    const activities = await this.userPoolTokenActivityRepository.findAll(
      params.filter,
      params.sort,
      params.limit,
      params.offset
    );

    return activities.map(activity => ({
      id: activity._id.toString(),
      userWallet: activity.userWallet,
      chainId: activity.chainId,
      poolId: activity.poolId,
      businessId: activity.businessId,
      holdTokenAddress: activity.holdTokenAddress,
      earlyMintVolume: activity.earlyMintVolume.toString(),
      earlyBurnVolume: activity.earlyBurnVolume.toString(),
      middleMintVolume: activity.middleMintVolume.toString(),
      middleBurnVolume: activity.middleBurnVolume.toString(),
      lateMintVolume: activity.lateMintVolume.toString(),
      lateBurnVolume: activity.lateBurnVolume.toString(),
      postMintVolume: activity.postMintVolume.toString(),
      postBurnVolume: activity.postBurnVolume.toString(),
      createdAt: activity.createdAt,
      updatedAt: activity.updatedAt
    }));
  }

  async syncPoolOutgoingTrancheClaimed(data: {
    emittedFrom: string;
    claimer: string;
    trancheIndex: number;
    amountClaimed: string;
    holdToken: string;
    chainId: number;
  }) {
    logger.debug("Syncing pool outgoing tranche claimed metrics", { data });

    // Update outgoing tranches count
    await this.productOwnerMetricsRepository.upsert(data.claimer, data.chainId, {
      outgoingTranchesCount: 1
    });

    // Update total funds withdrawn
    await this.productOwnerTokenMetricsRepository.upsert(
      data.claimer,
      data.chainId,
      data.holdToken,
      {
        totalFundsWithdrawn: Types.Decimal128.fromString(data.amountClaimed)
      }
    );
  }
}