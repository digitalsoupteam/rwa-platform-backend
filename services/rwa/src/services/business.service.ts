import { logger } from "@shared/monitoring/src/logger";
import { BusinessRepository } from "../repositories/business.repository";
import { NotAllowedError } from "@shared/errors/app-errors";
import { IBusinessEntity } from "../models/entity/business.entity";

import { OpenRouterClient } from "@shared/openrouter/client";
import { ethers } from "ethers";
import { SortOrder } from "mongoose";
import { SignersManagerClient } from "../clients/eden.clients";

interface NetworkConfig {
  chainId: string;
  name: string;
  factoryAddress: string;
}

export class BusinessService {
  constructor(
    private readonly businessRepository: BusinessRepository,
    private readonly openRouterClient: OpenRouterClient,
    private readonly signersManagerClient: SignersManagerClient,
    private readonly supportedNetworks: NetworkConfig[]
  ) { }

  private isChainIdSupported(chainId: string): boolean {
    return this.supportedNetworks.some(
      (network) => network.chainId === chainId
    );
  }

  private generateMessageHash(
    chainId: string,
    factoryAddress: string,
    deployerWallet: string,
    createRWAFee: string,
    entityId: string,
    entityOwnerId: string,
    entityOwnerType: string,
    owner: string,
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
        "address"
      ],
      [
        BigInt(chainId),
        ethers.getAddress(factoryAddress),
        ethers.getAddress(deployerWallet),
        "deployRWA",
        BigInt(createRWAFee),
        entityId,
        entityOwnerId,
        entityOwnerType,
        ethers.getAddress(owner)
      ]
    );

    return ethers.solidityPackedKeccak256(
      ["bytes32", "uint256"],
      [innerHash, BigInt(expired)]
    );
  }

  async createBusiness(data: {
    name: string;
    ownerId: string;
    ownerType: string;
    chainId: string;
    description?: string;
    tags?: string[];
    image?: string;
  }) {
    logger.debug("Creating new business", { data });

    if (!this.isChainIdSupported(data.chainId)) {
      throw new NotAllowedError(`Chain ID ${data.chainId} is not supported`);
    }

    const business = await this.businessRepository.createBusiness(data);

    return this.mapBusiness(business);
  }

  async editBusiness(
    params: {
      id: string,
      updateData: {
        chainId?: string;
        name?: string;
        description?: string;
        tags?: string[];
        image?: string;
      }
    }
  ) {
    logger.debug("Updating business info", params);

    const updated = await this.businessRepository.updateBusiness(params.id, params.updateData);

    return this.mapBusiness(updated);
  }

  async updateRiskScore(id: string) {
    logger.debug("Updating business risk score", { id });

    const business = await this.businessRepository.findById(id);

    if (!business.name || !business.description || !business.tags?.length) {
      throw new Error(
        "Business name, description and tags are required for risk assessment"
      );
    }

    const systemMessage = `You are a risk assessment expert. Analyze the business information and provide a risk score from 1 to 100.

Business Name: ${business.name}"
Description: ${business.description}
Tags: ${business.tags.join(", ")}

Consider these factors:
- Business model viability
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
REASONING: Moderate risk due to competitive market, but strong business model and experienced team`;

    const response = await this.openRouterClient.chatCompletion({
      model: "google/gemini-2.0-flash-001",
      messages: [
        { role: "system", content: systemMessage },
        {
          role: "user",
          content:
            "Please analyze the provided business information and assess its risk score.",
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

    const updated = await this.businessRepository.updateBusiness(id, {
      riskScore
    });

    return this.mapBusiness(updated);
  }

  async requestApprovalSignatures(params: { 
    id: string, 
    ownerWallet: string, 
    deployerWallet: string, 
    createRWAFee: string 
  }) {
    logger.debug("Requesting approval signatures", params);

    const business = await this.businessRepository.findById(params.id);

    if (business.approvalSignaturesTaskId) {
      throw new NotAllowedError("Business already has an active approval signatures task");
    }

    const now = Math.floor(Date.now() / 1000);
    const expired = now + 86400; // 24 hours

    const network = this.supportedNetworks.find(n => n.chainId === business.chainId);
    if (!network) {
      throw new Error(`Network configuration not found for chain ID ${business.chainId}`);
    }

    const messageHash = this.generateMessageHash(
      business.chainId,
      network.factoryAddress,
      params.deployerWallet,
      params.createRWAFee,
      params.id,
      business.ownerId,
      business.ownerType,
      params.ownerWallet,
      expired
    );

    const taskResponse =
      await this.signersManagerClient.createSignatureTask.post({
        ownerId: business.ownerId,
        ownerType: business.ownerType,
        hash: messageHash,
        expired,
        requiredSignatures: 3
      });

    if (taskResponse.error) throw taskResponse.error;

    const taskId = taskResponse.data.id;

    await this.businessRepository.updateBusiness(params.id, {
      approvalSignaturesTaskId: taskId,
      approvalSignaturesTaskExpired: expired,
    });

    return { taskId };
  }

  async rejectApprovalSignatures(id: string) {
    logger.debug("Rejecting approval signatures", { id });

    const business = await this.businessRepository.findById(id);

    if (business.tokenAddress) {
      throw new NotAllowedError("Business already deployed!");
    }

    if (!business.approvalSignaturesTaskId || !business.approvalSignaturesTaskExpired) {
      throw new NotAllowedError("Business has no active approval signatures task");
    }

    const now = Math.floor(Date.now() / 1000);
    if (now <= business.approvalSignaturesTaskExpired + 60) {
      throw new NotAllowedError("Cannot reject approval signatures before expiration");
    }

    await this.businessRepository.updateBusiness(id, {
      approvalSignaturesTaskId: undefined
    });
  }

  async syncAfterDeployment(
    eventData: {
      entityId: string,
      emittedFrom: string;
      initialOwner: string;
    }
  ) {
    logger.debug("Updating business contract data", eventData);

    const updated = await this.businessRepository.updateBusiness(eventData.entityId, {
      tokenAddress: eventData.emittedFrom,
      ownerWallet: eventData.initialOwner
    });

    return this.mapBusiness(updated);
  }

  private mapBusiness(business: IBusinessEntity) {
    return {
      id: business._id.toString(),
      chainId: business.chainId,
      name: business.name,
      ownerId: business.ownerId,
      ownerType: business.ownerType,
      ownerWallet: business.ownerWallet ?? undefined,
      tokenAddress: business.tokenAddress ?? undefined,
      description: business.description,
      tags: business.tags,
      riskScore: business.riskScore,
      image: business.image ?? undefined,
      approvalSignaturesTaskId: business.approvalSignaturesTaskId ?? undefined,
      paused: business.paused,
      createdAt: business.createdAt,
      updatedAt: business.updatedAt,
    };
  }

  async getBusiness(id: string) {
    const business = await this.businessRepository.findById(id);
    return this.mapBusiness(business);
  }

  async getBusinesses(params: {
    filter?: Record<string, any>,
    sort?: { [key: string]: SortOrder },
    limit?: number,
    offset?: number
  }
  ) {
    logger.debug("Getting businesses with filter", params);
    const businesses = await this.businessRepository.findAll(
      params.filter,
      params.sort,
      params.limit,
      params.offset
    );
    return businesses.map(this.mapBusiness);
  }
}
