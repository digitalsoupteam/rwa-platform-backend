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
    poolType: string,
    entityId: string,
    entityOwnerId: string,
    entityOwnerType: string,
    ownerWallet: string,
    rwaAddress: string,
    expectedHoldAmount: string,
    rewardPercent: string,
    entryPeriodDuration: number,
    completionPeriodDuration: number,
    payload: string,
    expired: number
  ): string {
    const innerHash = ethers.solidityPackedKeccak256(
      [
        "uint256",
        "address",
        "address",
        "string",
        "uint256",
        "string",
        "string",
        "string",
        "string",
        "address",
        "address",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
        "bytes"
      ],
      [
        BigInt(chainId),
        ethers.getAddress(factoryAddress),
        ethers.getAddress(deployerWallet),
        "deployPool",
        BigInt(createPoolFeeRatio),
        poolType,
        entityId,
        entityOwnerId,
        entityOwnerType,
        ethers.getAddress(ownerWallet),
        ethers.getAddress(rwaAddress),
        BigInt(expectedHoldAmount),
        BigInt(rewardPercent),
        BigInt(entryPeriodDuration),
        BigInt(completionPeriodDuration),
        payload
      ]
    );

    return ethers.solidityPackedKeccak256(
      ["bytes32", "uint256"],
      [innerHash, BigInt(expired)]
    );
  }

  private generateStablePoolPayload(): string {
    return "0x";
  }

  private generateSpeculativePoolPayload(rwaMultiplierIndex: number): string {
    return ethers.solidityPacked(
      ["uint256"],
      [BigInt(rwaMultiplierIndex)]
    );
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

    if (!pool.rewardPercent || BigInt(pool.rewardPercent) <= BigInt(0)) {
      throw new Error("rewardPercent must be greater than 0");
    }

    if (!pool.entryPeriodDuration || pool.entryPeriodDuration <= 0) {
      throw new Error("entryPeriodDuration must be greater than 0");
    }

    if (!pool.completionPeriodDuration || pool.completionPeriodDuration <= 0) {
      throw new Error("completionPeriodDuration must be greater than 0");
    }

    const now = Math.floor(Date.now() / 1000);
    const expired = now + 86400; // 24 hours

    const network = this.supportedNetworks.find(n => n.chainId === pool.chainId);
    if (!network) {
      throw new Error(`Network configuration not found for chain ID ${pool.chainId}`);
    }

    let payload: string;
    if (pool.type === 'stable') {
      payload = this.generateStablePoolPayload();
    } else if (pool.type === 'speculation') {
      if (typeof pool.speculativeSpecificFields?.rwaMultiplierIndex !== 'number') {
        throw new Error('rwaMultiplierIndex is required for speculation pools');
      }
      payload = this.generateSpeculativePoolPayload(pool.speculativeSpecificFields?.rwaMultiplierIndex!);
    } else {
      throw new Error(`Unsupported pool type: ${pool.type}`);
    }

    const messageHash = this.generatePoolMessageHash(
      pool.chainId,
      network.factoryAddress,
      params.deployerWallet,
      params.createPoolFeeRatio,
      pool.type,
      params.id,
      pool.ownerId,
      pool.ownerType,
      params.ownerWallet,
      pool.rwaAddress,
      pool.expectedHoldAmount,
      pool.rewardPercent,
      pool.entryPeriodDuration,
      pool.completionPeriodDuration,
      payload,
      expired
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
      type: pool.type,
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
      rewardPercent: pool.rewardPercent ?? undefined,
      expectedReturnAmount: pool.expectedReturnAmount ?? undefined,
      entryPeriodExpired: pool.entryPeriodExpired ?? undefined,
      completionPeriodExpired: pool.completionPeriodExpired ?? undefined,
      description: pool.description,
      tags: pool.tags,
      riskScore: pool.riskScore,
      entryPeriodDuration: pool.entryPeriodDuration,
      completionPeriodDuration: pool.completionPeriodDuration,
      stableSpecificFields: pool.stableSpecificFields,
      speculativeSpecificFields: pool.speculativeSpecificFields,
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
    type: 'stable' | 'speculation';
    chainId: string;
    businessId: string;
    rwaAddress: string;
    expectedHoldAmount?: string;
    rewardPercent?: string;
    description?: string;
    entryPeriodDuration?: number;
    completionPeriodDuration?: number;
    stableSpecificFields?: {};
    speculativeSpecificFields?: {
      rwaMultiplierIndex?: number;
    };
  }) {
    logger.debug("Creating new pool", { data });

    if (!this.isChainIdSupported(data.chainId)) {
      throw new NotAllowedError(`Chain ID ${data.chainId} is not supported`);
    }

    if (data.speculativeSpecificFields != undefined && data.type != 'speculation') {
      throw new NotAllowedError("Speculative specific fields can only be set for speculation pools");
    }

    if (data.stableSpecificFields != undefined && data.type != 'stable') {
      throw new NotAllowedError("Stable specific fields can only be set for stable pools");
    }

    const pool = await this.poolRepository.createPool(data);
    return this.mapPool(pool);
  }

  async editPool(params: {
    id: string,
    updateData: {
      name?: string;
      expectedHoldAmount?: string;
      rewardPercent?: string;
      description?: string;
      tags?: string[];
      riskScore?: number;
      entryPeriodDuration?: number;
      completionPeriodDuration?: number;
      stableSpecificFields?: {};
      speculativeSpecificFields?: {
        rwaMultiplierIndex?: number;
      };
    }
  }) {
    logger.debug("Updating pool", params);

    const pool = await this.poolRepository.findById(params.id);

    if (pool.approvalSignaturesTaskId) {
      if (params.updateData.expectedHoldAmount != undefined) {
        throw new NotAllowedError("Cannot edit expected hold amount while approval signatures task is pending");
      }
      
      if (params.updateData.rewardPercent != undefined) {
        throw new NotAllowedError("Cannot edit reward percent while approval signatures task is pending");
      }

      if (params.updateData.entryPeriodDuration != undefined) {
        throw new NotAllowedError("Cannot edit entry period duration while approval signatures task is pending");
      }

      if (params.updateData.completionPeriodDuration != undefined) {
        throw new NotAllowedError("Cannot edit completion period duration while approval signatures task is pending");
      }

      if (params.updateData.stableSpecificFields != undefined) {
        throw new NotAllowedError("Cannot edit stable pool specific fields while approval signatures task is pending");
      }

      if (params.updateData.speculativeSpecificFields != undefined) {
        throw new NotAllowedError("Cannot edit speculative pool specific fields while approval signatures task is pending");
      }
    }

    const updated = await this.poolRepository.updatePool(params.id, params.updateData);
    return this.mapPool(updated);
  }


  async syncPoolAfterDeployment(
    event: {
      emittedFrom: string,
      holdToken: string,
      entityId: string,
      rwa: string,
      tokenId: string,
      entryFeePercent: string,
      exitFeePercent: string,
      expectedHoldAmount: string,
      expectedRwaAmount: string,
      rewardPercent: string,
      expectedReturnAmount: string,
      entryPeriodExpired: string,
      completionPeriodExpired: string,
      poolType: string,
      initializationData: string,
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
      rwaAddress: event.rwa,
      tokenId: event.tokenId,
      entryFeePercent: event.entryFeePercent,
      exitFeePercent: event.exitFeePercent,
      expectedHoldAmount: event.expectedHoldAmount,
      expectedRwaAmount: event.expectedRwaAmount,
      rewardPercent: event.rewardPercent,
      expectedReturnAmount: event.expectedReturnAmount,
      entryPeriodExpired: event.entryPeriodExpired,
      completionPeriodExpired: event.completionPeriodExpired,
    };

    
    if (pool.type === 'stable') {
      const [fixedMintPrice] = ethers.AbiCoder.defaultAbiCoder().decode(
        ['uint256'],
        event.initializationData
      );
      updateData.stableSpecificFields = {
        fixedMintPrice: fixedMintPrice.toString()
      };
    } else if (pool.type === 'speculation') {
      const [
        virtualHoldReserve,
        virtualRwaReserve,
        realHoldReserve,
        k,
        availableBonusAmount,
        expectedBonusAmount
      ] = ethers.AbiCoder.defaultAbiCoder().decode(
        ['uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256'],
        event.initializationData
      );
      
      updateData.speculativeSpecificFields = {
        ...pool.speculativeSpecificFields,
        virtualHoldReserve: virtualHoldReserve.toString(),
        virtualRwaReserve: virtualRwaReserve.toString(),
        realHoldReserve: realHoldReserve.toString(),
        k: k.toString(),
        availableBonusAmount: availableBonusAmount.toString(),
        expectedBonusAmount: expectedBonusAmount.toString()
      };
    }

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