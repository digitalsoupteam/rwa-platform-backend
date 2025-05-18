import { logger } from "@shared/monitoring/src/logger";
import { NotFoundError, NotAllowedError } from "@shared/errors/app-errors";
import { PoolRepository } from "../repositories/pool.repository";
import { OpenRouterClient } from "@shared/openrouter/client";
import { SignersManagerClient } from "../clients/eden.clients";
import { ethers } from "ethers";
import { SortOrder } from "mongoose";


export class PoolService {
  constructor(
    private readonly poolRepository: PoolRepository,
    private readonly openRouterClient: OpenRouterClient,
    private readonly signersManagerClient: SignersManagerClient,
    private readonly supportedNetworks: {
      chainId: string;
      name: string;
      factoryAddress: string;
    }[]
  ) { }

  private isChainIdSupported(chainId: string): boolean {
    return this.supportedNetworks.some((network) => network.chainId === chainId);
  }


  async updateRiskScore(id: string) {
    logger.debug("Updating pool risk score", { id });

    const pool = await this.poolRepository.findById(id);

    if (!pool.description || !pool.tags?.length) {
      throw new Error("Pool description and tags are required for risk assessment");
    }

    const systemMessage = `You are a risk assessment expert. Analyze the pool information and provide a risk score from 1 to 100.

Description: ${pool.description}
Tags: ${pool.tags.join(", ")}

Consider these factors:
- Pool model viability
- Market competition and conditions
- Regulatory compliance risks
- Financial stability indicators
- Operational risks and scalability
- Management team experience
- Industry-specific challenges
- Market positioning and branding
- Technology and innovation potential
- Target market size and accessibility

Provide your response in EXACTLY this format:
RISK_SCORE: [number between 1-100]
REASONING: [brief explanation]

Example response:
RISK_SCORE: 45
REASONING: Moderate risk due to competitive market, but strong pool model and experienced team`;

    const response = await this.openRouterClient.chatCompletion({
      model: "google/gemini-2.0-flash-001",
      messages: [
        { role: "system", content: systemMessage },
        {
          role: "user",
          content: "Please analyze the provided pool information and assess its risk score.",
        },
      ],
    });

    const aiResponse = response.choices[0]?.message?.content;
    if (!aiResponse) {
      throw new Error("Failed to get AI response for risk assessment");
    }

    console.log('aiResponseaw1')
    console.log(aiResponse)
    
    const match = aiResponse.match(/RISK_SCORE:\s*(\d+)/);
    if (!match) {
      throw new Error("Failed to parse risk score from AI response");
    }

    const riskScore = parseInt(match[1]);
    if (isNaN(riskScore) || riskScore < 1 || riskScore > 100) {
      throw new Error("Invalid risk score received from AI assessment");
    }


    const updated = await this.poolRepository.updatePool(id, { riskScore });
    return this.mapPool(updated);
  }

  private generatePoolMessageHash(
    chainId: string,
    factoryAddress: string,
    deployerWallet: string,
    createPoolFeeRatio: string,
    entityId: string,
    rwa: string,
    expectedHoldAmount: string,
    expectedRwaAmount: string,
    priceImpactPercent: string,
    rewardPercent: string,
    entryPeriodStart: string,
    entryPeriodExpired: string,
    completionPeriodExpired: string,
    entryFeePercent: string,
    exitFeePercent: string,
    fixedSell: boolean,
    allowEntryBurn: boolean,
    awaitCompletionExpired: boolean,
    floatingOutTranchesTimestamps: boolean,
    outgoingTranches: Array<{
      amount: string;
      timestamp: number;
      executedAmount: string;
    }>,
    incomingTranches: Array<{
      amount: string;
      expiredAt: number;
      returnedAmount: string;
    }>
  ): string {
    const innerHash = ethers.solidityPackedKeccak256(
      [
        "uint256",
        "address",
        "address",
        "string",
        "uint256",
        "string",
        "address",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
        "bool",
        "bool",
        "bool",
        "bool",
        "uint256[]",
        "uint256[]",
        "uint256[]",
        "uint256[]"
      ],
      [
        BigInt(chainId),
        ethers.getAddress(factoryAddress),
        ethers.getAddress(deployerWallet),
        "deployPool",
        BigInt(createPoolFeeRatio),
        entityId,
        ethers.getAddress(rwa),
        BigInt(expectedHoldAmount),
        BigInt(expectedRwaAmount),
        BigInt(priceImpactPercent),
        BigInt(rewardPercent),
        BigInt(entryPeriodStart),
        BigInt(entryPeriodExpired),
        BigInt(completionPeriodExpired),
        BigInt(entryFeePercent),
        BigInt(exitFeePercent),
        fixedSell,
        allowEntryBurn,
        awaitCompletionExpired,
        floatingOutTranchesTimestamps,
        outgoingTranches.map(t => BigInt(t.amount)),
        outgoingTranches.map(t => BigInt(t.timestamp)),
        incomingTranches.map(t => BigInt(t.amount)),
        incomingTranches.map(t => BigInt(t.expiredAt))
      ]
    );

    return innerHash;
  }



  async requestApprovalSignatures(
    params: { 
      id: string, 
      ownerWallet: string, 
      deployerWallet: string, 
      createPoolFeeRatio: string 
    }
  ) {
    logger.debug("Requesting approval signatures for pool", params);

    const pool = await this.poolRepository.findById(params.id);

    
    if (pool.approvalSignaturesTaskId) {
      throw new NotAllowedError("Pool already has an active approval signatures task");
    }

    
    if (!pool.expectedHoldAmount || BigInt(pool.expectedHoldAmount) <= BigInt(0)) {
      throw new Error("expectedHoldAmount must be greater than 0");
    }
    
    if (!pool.expectedRwaAmount || BigInt(pool.expectedRwaAmount) <= BigInt(0)) {
      throw new Error("expectedRwaAmount must be greater than 0");
    }    

    if (!pool.priceImpactPercent || BigInt(pool.priceImpactPercent) <= BigInt(0)) {
      throw new Error("priceImpactPercent must be greater than 0");
    }

    if (!pool.rewardPercent || BigInt(pool.rewardPercent) <= BigInt(0)) {
      throw new Error("rewardPercent must be greater than 0");
    }

    if (!pool.entryPeriodStart || pool.entryPeriodStart <= 0) {
      throw new Error("entryPeriodStart must be greater than 0");
    }

    if (!pool.entryPeriodExpired || pool.entryPeriodExpired <= pool.entryPeriodStart) {
      throw new Error("entryPeriodExpired must be greater than entryPeriodStart");
    }

    if (!pool.completionPeriodExpired || pool.completionPeriodExpired <= pool.entryPeriodExpired) {
      throw new Error("completionPeriodExpired must be greater than entryPeriodExpired");
    }

    if (!pool.entryFeePercent) {
      throw new Error("entryFeePercent is required");
    }

    if (!pool.exitFeePercent) {
      throw new Error("exitFeePercent is required");
    }

    const now = Math.floor(Date.now() / 1000);
    const expired = now + 86400; // 24 hours

    const network = this.supportedNetworks.find(n => n.chainId === pool.chainId);
    if (!network) {
      throw new Error(`Network configuration not found for chain ID ${pool.chainId}`);
    }

    const messageHash = this.generatePoolMessageHash(
      pool.chainId,
      network.factoryAddress,
      params.deployerWallet,
      params.createPoolFeeRatio,
      params.id,
      pool.rwaAddress,
      pool.expectedHoldAmount,
      pool.expectedRwaAmount,
      pool.priceImpactPercent,
      pool.rewardPercent,
      pool.entryPeriodStart.toString(),
      pool.entryPeriodExpired.toString(),
      pool.completionPeriodExpired.toString(),
      pool.entryFeePercent,
      pool.exitFeePercent,
      pool.fixedSell,
      pool.allowEntryBurn,
      pool.awaitCompletionExpired,
      pool.floatingOutTranchesTimestamps,
      pool.outgoingTranches,
      pool.incomingTranches
    );

    const taskResponse =
      await this.signersManagerClient.createSignatureTask.post({
        ownerId: pool.ownerId,
        ownerType: pool.ownerType,
        hash: messageHash,
        expired,
        requiredSignatures: 3
      });

    if (taskResponse.error) throw taskResponse.error;

    const taskId = taskResponse.data.id;

    await this.poolRepository.updatePool(params.id, {
      approvalSignaturesTaskId: taskId,
      approvalSignaturesTaskExpired: expired
    });
    return { taskId };
  }

  async rejectApprovalSignatures(id: string) {
    logger.debug("Rejecting approval signatures for pool", { id });

    const pool = await this.poolRepository.findById(id);

    if (pool.poolAddress) {
      throw new NotAllowedError("Pool deployed!");
    }

    if (!pool.approvalSignaturesTaskId || !pool.approvalSignaturesTaskExpired) {
      throw new NotAllowedError("Pool has no active approval signatures task");
    }

    const now = Math.floor(Date.now() / 1000);
    if (now <= pool.approvalSignaturesTaskExpired + 60) {
      throw new NotAllowedError("Cannot reject approval signatures before expiration");
    }

    await this.poolRepository.updatePool(id, {
      approvalSignaturesTaskId: null,
      approvalSignaturesTaskExpired: null
    });
  }

  private mapPool(pool: any) {
    return {
      id: pool._id.toString(),
      chainId: pool.chainId,
      name: pool.name,
      ownerId: pool.ownerId,
      ownerType: pool.ownerType,
      businessId: pool.businessId,
      poolAddress: pool.poolAddress ?? undefined,
      holdToken: pool.holdToken ?? undefined,
      rwaAddress: pool.rwaAddress,
      tokenId: pool.tokenId ?? undefined,
      entryFeePercent: pool.entryFeePercent ?? undefined,
      exitFeePercent: pool.exitFeePercent ?? undefined,
      expectedHoldAmount: pool.expectedHoldAmount ?? undefined,
      expectedRwaAmount: pool.expectedRwaAmount ?? undefined,
      expectedBonusAmount: pool.expectedBonusAmount ?? undefined,
      rewardPercent: pool.rewardPercent ?? undefined,
      entryPeriodStart: pool.entryPeriodStart ?? undefined,
      entryPeriodExpired: pool.entryPeriodExpired ?? undefined,
      completionPeriodExpired: pool.completionPeriodExpired ?? undefined,
      awaitCompletionExpired: pool.awaitCompletionExpired ?? false,
      floatingOutTranchesTimestamps: pool.floatingOutTranchesTimestamps ?? false,
      fixedSell: pool.fixedSell ?? false,
      allowEntryBurn: pool.allowEntryBurn ?? false,
      priceImpactPercent: pool.priceImpactPercent ?? undefined,
      liquidityCoefficient: pool.liquidityCoefficient ?? undefined,
      k: pool.k ?? undefined,
      realHoldReserve: pool.realHoldReserve ?? "0",
      virtualHoldReserve: pool.virtualHoldReserve ?? undefined,
      virtualRwaReserve: pool.virtualRwaReserve ?? undefined,
      floatingTimestampOffset: pool.floatingTimestampOffset ?? 0,
      isTargetReached: pool.isTargetReached ?? false,
      isFullyReturned: pool.isFullyReturned ?? false,
      fullReturnTimestamp: pool.fullReturnTimestamp ?? undefined,
      totalClaimedAmount: pool.totalClaimedAmount ?? "0",
      totalReturnedAmount: pool.totalReturnedAmount ?? "0",
      awaitingBonusAmount: pool.awaitingBonusAmount ?? "0",
      awaitingRwaAmount: pool.awaitingRwaAmount ?? "0",
      outgoingTranchesBalance: pool.outgoingTranchesBalance ?? "0",
      outgoingTranches: pool.outgoingTranches ?? [],
      incomingTranches: pool.incomingTranches ?? [],
      lastCompletedIncomingTranche: pool.lastCompletedIncomingTranche ?? 0,
      paused: pool.paused ?? false,
      description: pool.description,
      tags: pool.tags ?? [],
      riskScore: pool.riskScore ?? 0,
      approvalSignaturesTaskId: pool.approvalSignaturesTaskId ?? undefined,
      approvalSignaturesTaskExpired: pool.approvalSignaturesTaskExpired ?? undefined,
      createdAt: pool.createdAt,
      updatedAt: pool.updatedAt,
    };
  }

  async getPool(id: string) {
    const pool = await this.poolRepository.findById(id);
    return this.mapPool(pool);
  }

  async createPool(data: {
    ownerId: string;
    ownerType: string;
    name: string;
    chainId: string;
    businessId: string;
    rwaAddress: string;
    entryFeePercent?: string;
    exitFeePercent?: string;
    expectedHoldAmount?: string;
    expectedRwaAmount?: string;
    rewardPercent?: string;
    entryPeriodStart?: number;
    entryPeriodExpired?: number;
    completionPeriodExpired?: number;
    awaitCompletionExpired?: boolean;
    floatingOutTranchesTimestamps?: boolean;
    fixedSell?: boolean;
    allowEntryBurn?: boolean;
    priceImpactPercent?: string;
    outgoingTranches?: Array<{
      amount: string;
      timestamp: number;
      executedAmount: string;
    }>;
    incomingTranches?: Array<{
      amount: string;
      expiredAt: number;
      returnedAmount: string;
    }>;
    description?: string;
    tags?: string[];
  }) {
    logger.debug("Creating new pool", { data });

    if (!this.isChainIdSupported(data.chainId)) {
      throw new NotAllowedError(`Chain ID ${data.chainId} is not supported`);
    }

    const pool = await this.poolRepository.createPool(data);
    return this.mapPool(pool);
  }

  async editPool(params: {
    id: string,
    updateData: {
      chainId?: string;
      name?: string;
      entryFeePercent?: string;
      exitFeePercent?: string;
      expectedHoldAmount?: string;
      expectedRwaAmount?: string;
      rewardPercent?: string;
      entryPeriodStart?: number;
      entryPeriodExpired?: number;
      completionPeriodExpired?: number;
      awaitCompletionExpired?: boolean;
      floatingOutTranchesTimestamps?: boolean;
      fixedSell?: boolean;
      allowEntryBurn?: boolean;
      priceImpactPercent?: string;
      outgoingTranches?: Array<{
        amount: string;
        timestamp: number;
        executedAmount: string;
      }>;
      incomingTranches?: Array<{
        amount: string;
        expiredAt: number;
        returnedAmount: string;
      }>;
      description?: string;
      tags?: string[];
    }
  }) {
    logger.debug("Updating pool", params);

    const pool = await this.poolRepository.findById(params.id);

    if (pool.approvalSignaturesTaskId) {
      const immutableFields = [
        'chainId',
        'entryFeePercent',
        'exitFeePercent',
        'expectedHoldAmount',
        'expectedRwaAmount',
        'rewardPercent',
        'entryPeriodStart',
        'entryPeriodExpired',
        'completionPeriodExpired',
        'awaitCompletionExpired',
        'floatingOutTranchesTimestamps',
        'fixedSell',
        'allowEntryBurn',
        'priceImpactPercent',
        'outgoingTranches',
        'incomingTranches',
      ];

      for (const field of immutableFields) {
        if (params.updateData[field as keyof typeof params.updateData] !== undefined) {
          throw new NotAllowedError(`Cannot edit ${field} while approval signatures task is pending`);
        }
      }
    }

    const updated = await this.poolRepository.updatePool(params.id, params.updateData);
    return this.mapPool(updated);
  }


  async syncPoolAfterDeployment(
    event: {
      emittedFrom: string,
      awaitCompletionExpired: boolean,
      floatingOutTranchesTimestamps: boolean,
      holdToken: string,
      rwaToken: string,
      tokenId: string,
      entityId: string,
      entityOwnerId: string,
      entityOwnerType: string,
      owner: string,
      expectedHoldAmount: string,
      expectedRwaAmount: string,
      expectedBonusAmount: string,
      rewardPercent: string,
      fixedSell: boolean,
      allowEntryBurn: boolean,
      entryPeriodStart: string,
      entryPeriodExpired: string,
      completionPeriodExpired: string,
      k: string,
      entryFeePercent: string,
      exitFeePercent: string,
      outgoingTranches: string[],
      outgoingTranchTimestamps: number[],
      incomingTranches: string[],
      incomingTrancheExpired: number[],
    }
  ) {
    logger.debug(`Syncing pool after deployment`, event);

    const pool = await this.poolRepository.findById(event.entityId);
    if (!pool) {
      throw new NotFoundError(`Pool ${event.entityId} not found`);
    }

    const updateData: any = {
      poolAddress: event.emittedFrom,
      holdToken: event.holdToken,
      rwaAddress: event.rwaToken,
      tokenId: event.tokenId,
      floatingOutTranchesTimestamps: event.floatingOutTranchesTimestamps,
      awaitCompletionExpired: event.awaitCompletionExpired,
      ownerWallet: event.owner,
      expectedHoldAmount: event.expectedHoldAmount,
      expectedRwaAmount: event.expectedRwaAmount,
      expectedBonusAmount: event.expectedBonusAmount,
      rewardPercent: event.rewardPercent,
      fixedSell: event.fixedSell,
      allowEntryBurn: event.allowEntryBurn,
      entryPeriodStart: event.entryPeriodStart,
      entryPeriodExpired: event.entryPeriodExpired,
      completionPeriodExpired: event.completionPeriodExpired,
      k: event.k,
      entryFeePercent: event.entryFeePercent,
      exitFeePercent: event.exitFeePercent,
      outgoingTranches: event.outgoingTranches.map((amount, i) => ({
        amount,
        timestamp: event.outgoingTranchTimestamps[i],
        executedAmount: "0"
      })),
      incomingTranches: event.incomingTranches.map((amount, i) => ({
        amount,
        expiredAt: event.incomingTrancheExpired[i],
        returnedAmount: "0"
      }))
    };
    
    const updated = await this.poolRepository.updatePool(event.entityId, updateData);
    return this.mapPool(updated);
  }


  async getPools(
    params: {
      filter?: Record<string, any>,
      sort?: { [key: string]: SortOrder },
      limit?: number,
      offset?: number
    }
  ) {
    logger.debug("Getting pools with filter", params);
    const pools = await this.poolRepository.findAll(params.filter, params.sort, params.limit, params.offset);
    return pools.map(this.mapPool);
  }
}