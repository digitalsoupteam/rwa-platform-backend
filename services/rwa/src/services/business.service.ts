import { BusinessRepository } from '../repositories/business.repository';
import { AppError } from '@shared/errors/app-errors';
import type { IBusinessEntity } from '../models/entity/business.entity';

import { OpenRouterClient } from '@shared/openrouter/client';
import { ethers } from 'ethers';
import type { SortOrder } from 'mongoose';
import type { SignersManagerClient } from '../clients/eden.clients';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';
import { MetricsDecorator } from '@shared/monitoring/src/metricsDecorator';
import { LogDecorator } from '@shared/monitoring/src/logDecorator';
import { setSpanAttributes } from '@shared/monitoring/src/tracing';

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
    private readonly supportedNetworks: NetworkConfig[],
  ) {}

  private isChainIdSupported(chainId: string): boolean {
    return this.supportedNetworks.some((network) => network.chainId === chainId);
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
  ): string {
    const paramsHash = ethers.solidityPackedKeccak256(
      ['uint256', 'address', 'address', 'string', 'uint256', 'string', 'string', 'string', 'address'],
      [
        BigInt(chainId),
        ethers.getAddress(factoryAddress),
        ethers.getAddress(deployerWallet),
        'deployRWA',
        BigInt(createRWAFee),
        entityId,
        entityOwnerId,
        entityOwnerType,
        ethers.getAddress(owner),
      ],
    );

    return paramsHash;
  }

  private async generateBusinessFields(description: string) {
    const systemMessage = `You are a business analyst. Analyze the following business description and generate:
1. A concise business name
2. Relevant tags (up to 5)
3. A structured description

Business description: ${description}

Response format:
{
  "name": "string",
  "tags": ["string"],
  "description": "string",
}`;

    const response = await this.openRouterClient.chatCompletion({
      model: 'google/gemini-2.0-flash-001',
      messages: [
        { role: 'system', content: systemMessage },
        {
          role: 'user',
          content: 'Please analyze the provided business description and generate the required fields.',
        },
      ],
    });

    const aiResponse = response.choices[0]?.message?.content;
    if (!aiResponse) {
      throw new AppError({
        message: 'Failed to get AI response for business field generation',
        statusCode: 502,
        code: 'AI_ERROR',
      });
    }

    try {
      // Find first { and last } to extract JSON object
      const firstBrace = aiResponse.indexOf('{');
      const lastBrace = aiResponse.lastIndexOf('}');

      if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
        throw new AppError({
          message: 'No valid JSON object found in AI response',
          statusCode: 502,
          code: 'AI_ERROR',
        });
      }

      const jsonString = aiResponse.substring(firstBrace, lastBrace + 1);

      return JSON.parse(jsonString);
    } catch (error) {
      throw new AppError({
        message: 'Failed to parse AI response as JSON',
        statusCode: 502,
        code: 'AI_ERROR',
        cause: error,
      });
    }
  }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['data'] })
  async createBusinessWithAI(data: { description: string; ownerId: string; ownerType: string; chainId: string }) {
    setSpanAttributes({
      ownerId: data.ownerId,
      ownerType: data.ownerType,
      chainId: data.chainId,
    });
    if (!this.isChainIdSupported(data.chainId)) {
      throw new AppError({
        message: `Chain ID ${data.chainId} is not supported`,
        statusCode: 403,
        code: 'NOT_ALLOWED',
      });
    }

    const aiFields = await this.generateBusinessFields(data.description);

    const business = await this.businessRepository.createBusiness({
      name: aiFields.name,
      ownerId: data.ownerId,
      ownerType: data.ownerType,
      chainId: data.chainId,
      description: aiFields.description,
      tags: aiFields.tags,
    });

    return this.mapBusiness(business);
  }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['data'] })
  async createBusiness(data: {
    name: string;
    ownerId: string;
    ownerType: string;
    chainId: string;
    description?: string;
    tags?: string[];
    image?: string;
    country?: string;
    businessType?: string;
    socials?: { type: string; url: string }[];
  }) {
    setSpanAttributes({
      ownerId: data.ownerId,
      ownerType: data.ownerType,
      chainId: data.chainId,
    });
    if (!this.isChainIdSupported(data.chainId)) {
      throw new AppError({
        message: `Chain ID ${data.chainId} is not supported`,
        statusCode: 403,
        code: 'NOT_ALLOWED',
      });
    }

    const business = await this.businessRepository.createBusiness(
      data as Parameters<typeof this.businessRepository.createBusiness>[0],
    );

    return this.mapBusiness(business);
  }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['params'] })
  async editBusiness(params: {
    id: string;
    updateData: {
      chainId?: string;
      name?: string;
      description?: string;
      tags?: string[];
      image?: string;
      country?: string;
      businessType?: string;
      socials?: { type: string; url: string }[];
    };
  }) {
    setSpanAttributes({
      entityId: params.id,
      entityType: 'business',
      ...(params.updateData.chainId !== undefined && { chainId: params.updateData.chainId }),
    });
    const business = await this.businessRepository.findById(params.id);

    if (business.approvalSignaturesTaskId) {
      const immutableFields = ['chainId'];

      for (const field of immutableFields) {
        if (params.updateData[field as keyof typeof params.updateData] !== undefined) {
          throw new AppError({
            message: `Cannot edit ${field} while approval signatures task is pending`,
            statusCode: 403,
            code: 'NOT_ALLOWED',
          });
        }
      }
    }

    const updated = await this.businessRepository.updateBusiness(
      params.id,
      params.updateData as Parameters<typeof this.businessRepository.updateBusiness>[1],
    );

    return this.mapBusiness(updated);
  }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['id'] })
  async updateRiskScore(id: string) {
    setSpanAttributes({ entityId: id, entityType: 'business' });
    const business = await this.businessRepository.findById(id);

    if (!business.name || !business.description || !business.tags?.length) {
      throw new AppError({
        message: 'Business name, description and tags are required for risk assessment',
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }

    const systemMessage = `You are a risk assessment expert. Analyze the business information and provide a risk score from 1 to 100.

Business Name: ${business.name}"
Description: ${business.description}
Tags: ${business.tags.join(', ')}

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
      model: 'google/gemini-2.0-flash-001',
      messages: [
        { role: 'system', content: systemMessage },
        {
          role: 'user',
          content: 'Please analyze the provided business information and assess its risk score.',
        },
      ],
    });

    const aiResponse = response.choices[0]?.message?.content;
    if (!aiResponse) {
      throw new AppError({
        message: 'Failed to get AI response for risk assessment',
        statusCode: 502,
        code: 'AI_ERROR',
      });
    }

    const match = aiResponse.match(/RISK_SCORE:\s*(\d+)/);
    if (!match) {
      throw new AppError({
        message: 'Failed to parse risk score from AI response',
        statusCode: 502,
        code: 'AI_ERROR',
      });
    }

    const riskScore = parseInt(match[1]);
    if (isNaN(riskScore) || riskScore < 1 || riskScore > 100) {
      throw new AppError({
        message: 'Invalid risk score received from AI assessment',
        statusCode: 502,
        code: 'AI_ERROR',
      });
    }

    const updated = await this.businessRepository.updateBusiness(id, {
      riskScore,
    });

    return this.mapBusiness(updated);
  }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['params'] })
  async requestApprovalSignatures(params: {
    id: string;
    ownerWallet: string;
    deployerWallet: string;
    createRWAFee: string;
  }) {
    setSpanAttributes({
      entityId: params.id,
      entityType: 'business',
      ownerWallet: params.ownerWallet,
      deployerWallet: params.deployerWallet,
    });
    const business = await this.businessRepository.findById(params.id);

    if (business.approvalSignaturesTaskId) {
      throw new AppError({
        message: 'Business already has an active approval signatures task',
        statusCode: 403,
        code: 'NOT_ALLOWED',
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const expired = now + 86400; // 24 hours

    const network = this.supportedNetworks.find((n) => n.chainId === business.chainId);
    if (!network) {
      throw new AppError({
        message: `Network configuration not found for chain ID ${business.chainId}`,
        statusCode: 404,
        code: 'NOT_FOUND',
      });
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
    );

    const taskResponse = await this.signersManagerClient.createSignatureTask.post({
      ownerId: business.ownerId,
      ownerType: business.ownerType,
      hash: messageHash,
      expired,
      requiredSignatures: 3,
    });

    if (taskResponse.error) throw taskResponse.error;

    const taskId = taskResponse.data.id;

    await this.businessRepository.updateBusiness(params.id, {
      approvalSignaturesTaskId: taskId,
      approvalSignaturesTaskExpired: expired,
    });

    return { taskId };
  }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['id'] })
  async rejectApprovalSignatures(id: string) {
    setSpanAttributes({ entityId: id, entityType: 'business' });
    const business = await this.businessRepository.findById(id);

    if (business.tokenAddress) {
      throw new AppError({
        message: 'Business already deployed!',
        statusCode: 403,
        code: 'NOT_ALLOWED',
      });
    }

    if (!business.approvalSignaturesTaskId || !business.approvalSignaturesTaskExpired) {
      throw new AppError({
        message: 'Business has no active approval signatures task',
        statusCode: 403,
        code: 'NOT_ALLOWED',
      });
    }

    const now = Math.floor(Date.now() / 1000);
    if (now <= business.approvalSignaturesTaskExpired + 60) {
      throw new AppError({
        message: 'Cannot reject approval signatures before expiration',
        statusCode: 403,
        code: 'NOT_ALLOWED',
      });
    }

    await this.businessRepository.updateBusiness(id, {
      approvalSignaturesTaskId: undefined,
    });
  }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['eventData'] })
  async syncAfterDeployment(eventData: { entityId: string; emittedFrom: string; owner: string }) {
    setSpanAttributes({
      entityId: eventData.entityId,
      entityType: 'business',
      tokenAddress: eventData.emittedFrom,
      ownerWallet: eventData.owner,
    });
    const updated = await this.businessRepository.updateBusiness(eventData.entityId, {
      tokenAddress: eventData.emittedFrom,
      ownerWallet: eventData.owner,
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
      approvalSignaturesTaskExpired: business.approvalSignaturesTaskExpired ?? undefined,
      country: business.country ?? undefined,
      businessType: business.businessType ?? undefined,
      socials: business.socials ?? [],
      paused: business.paused,
      createdAt: business.createdAt,
      updatedAt: business.updatedAt,
    };
  }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['id'] })
  async getBusiness(id: string) {
    setSpanAttributes({ entityId: id, entityType: 'business' });
    const business = await this.businessRepository.findById(id);
    return this.mapBusiness(business);
  }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['params'] })
  async getBusinesses(params: {
    filter?: Record<string, any>;
    sort?: { [key: string]: SortOrder };
    limit?: number;
    offset?: number;
  }) {
    const filterJson = params.filter ? JSON.stringify(params.filter) : undefined;
    setSpanAttributes({
      entityType: 'business',
      ...(filterJson !== undefined && { filter: filterJson }),
      ...(params.limit !== undefined && { limit: params.limit }),
      ...(params.offset !== undefined && { offset: params.offset }),
    });
    const businesses = await this.businessRepository.findAll(params.filter, params.sort, params.limit, params.offset);
    return businesses.map(this.mapBusiness);
  }
}
