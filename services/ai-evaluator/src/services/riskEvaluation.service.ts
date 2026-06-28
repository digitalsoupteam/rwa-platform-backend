import { AppError } from '@shared/errors/app-errors';
import { OpenRouterClient } from '@shared/openrouter/client';
import type { ChatMessage, TextContentPart, FileContentPart, ImageContentPart } from '@shared/openrouter/types';
import type { EvaluationRepository } from '../repositories/evaluation.repository';
import type {
  RwaClient,
  DocumentsClient,
  GalleryClient,
  ReactionsClient,
  QuestionsClient,
  PortfolioClient,
} from '../clients/eden.clients';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';
import { MetricsDecorator } from '@shared/monitoring/src/metricsDecorator';
import { LogDecorator } from '@shared/monitoring/src/logDecorator';
import { setSpanAttributes } from '@shared/monitoring/src/tracing';
import type { SortOrder } from 'mongoose';

type SiblingPoolMeta = {
  name: string;
  riskScore: number | undefined;
  poolAddress: string | undefined;
  deployed: boolean;
};

type DocumentMeta = {
  id: string;
  name: string;
  mimeType: string;
  url: string;
};

type ImageMeta = {
  id: string;
  name: string;
  url: string;
};

type Stage1Result = {
  stage1Response: string;
  requestedDocuments: string[];
  requestedImages: string[];
};

type Stage2Result = {
  riskScore: number;
  reasoning: string;
  factors: Array<{ name: string; impact: string; detail: string }>;
  stage2Response: string;
};

export class RiskEvaluationService {
  constructor(
    private readonly evaluationRepository: EvaluationRepository,
    private readonly openRouterClient: OpenRouterClient,
    private readonly rwaClient: RwaClient,
    private readonly documentsClient: DocumentsClient,
    private readonly galleryClient: GalleryClient,
    private readonly reactionsClient: ReactionsClient,
    private readonly questionsClient: QuestionsClient,
    private readonly portfolioClient: PortfolioClient,
    private readonly openRouterModel: string,
  ) {}

  // ========== Public orchestrators ==========

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ poolId: a[0].poolId }),
  })
  async evaluatePoolRisk({ poolId }: { poolId: string }) {
    setSpanAttributes({ entityId: poolId, entityType: 'pool' });

    const pool = await this.fetchPool({ poolId });
    const business = await this.fetchBusiness({ businessId: pool.businessId });
    const siblingPools = await this.fetchSiblingPools({
      businessId: pool.businessId,
      excludeId: poolId,
    });

    const [documents, gallery, reactions, questions] = await Promise.all([
      this.fetchDocuments({ parentId: poolId }),
      this.fetchGallery({ parentId: poolId }),
      this.fetchReactions({ parentId: poolId, parentType: 'pool' }),
      this.fetchQuestions({ parentId: poolId }),
    ]);

    const portfolio = pool.poolAddress ? await this.fetchPortfolio({ poolAddress: pool.poolAddress }) : null;

    const stage1 = await this.assemblePoolSummary({
      pool,
      business,
      siblingPools,
      documents,
      gallery,
      reactions,
      questions,
      portfolio,
    });

    const { fetchedDocuments, fetchedImages } = await this.fetchRequestedFiles({
      documents,
      gallery,
      requestedDocuments: stage1.requestedDocuments,
      requestedImages: stage1.requestedImages,
    });

    const stage2 = await this.evaluateWithRequestedData({
      summary: stage1.stage1Response,
      fetchedDocuments,
      fetchedImages,
    });

    const evaluation = await this.evaluationRepository.create({
      entityType: 'pool',
      parentId: poolId,
      grandParentId: pool.businessId,
      ownerId: pool.ownerId,
      ownerType: pool.ownerType,
      riskScore: stage2.riskScore,
      reasoning: stage2.reasoning,
      factors: stage2.factors,
      stage1Response: stage1.stage1Response,
      stage2Response: stage2.stage2Response,
      evaluatedDocuments: fetchedDocuments.map((d) => ({ id: d.id, name: d.name, mimeType: d.mimeType })),
      evaluatedImages: fetchedImages.map((i) => ({ id: i.id, name: i.name })),
      modelUsed: this.openRouterModel,
    });

    const response = await this.rwaClient.setPoolRiskScore.post({ id: poolId, riskScore: stage2.riskScore });
    if (response.error) {
      throw new AppError({
        message: 'Failed to set pool risk score in rwa service',
        statusCode: 502,
        code: 'UPSTREAM_ERROR',
      });
    }

    return this.mapEvaluation(evaluation);
  }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ businessId: a[0].businessId }),
  })
  async evaluateBusinessRisk({ businessId }: { businessId: string }) {
    setSpanAttributes({ entityId: businessId, entityType: 'business' });

    const business = await this.fetchBusiness({ businessId });
    const pools = await this.fetchBusinessPools({ businessId });

    const [documents, gallery, reactions, questions] = await Promise.all([
      this.fetchDocuments({ parentId: businessId }),
      this.fetchGallery({ parentId: businessId }),
      this.fetchReactions({ parentId: businessId, parentType: 'business' }),
      this.fetchQuestions({ parentId: businessId }),
    ]);

    const stage1 = await this.assembleBusinessSummary({
      business,
      pools,
      documents,
      gallery,
      reactions,
      questions,
    });

    const { fetchedDocuments, fetchedImages } = await this.fetchRequestedFiles({
      documents,
      gallery,
      requestedDocuments: stage1.requestedDocuments,
      requestedImages: stage1.requestedImages,
    });

    const stage2 = await this.evaluateWithRequestedData({
      summary: stage1.stage1Response,
      fetchedDocuments,
      fetchedImages,
    });

    const evaluation = await this.evaluationRepository.create({
      entityType: 'business',
      parentId: businessId,
      grandParentId: businessId,
      ownerId: business.ownerId,
      ownerType: business.ownerType,
      riskScore: stage2.riskScore,
      reasoning: stage2.reasoning,
      factors: stage2.factors,
      stage1Response: stage1.stage1Response,
      stage2Response: stage2.stage2Response,
      evaluatedDocuments: fetchedDocuments.map((d) => ({ id: d.id, name: d.name, mimeType: d.mimeType })),
      evaluatedImages: fetchedImages.map((i) => ({ id: i.id, name: i.name })),
      modelUsed: this.openRouterModel,
    });

    const response = await this.rwaClient.setBusinessRiskScore.post({ id: businessId, riskScore: stage2.riskScore });
    if (response.error) {
      throw new AppError({
        message: 'Failed to set business risk score in rwa service',
        statusCode: 502,
        code: 'UPSTREAM_ERROR',
      });
    }

    return this.mapEvaluation(evaluation);
  }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ evaluationId: a[0].id }),
  })
  async getEvaluation({ id }: { id: string }) {
    setSpanAttributes({ evaluationId: id });
    const evaluation = await this.evaluationRepository.findById(id);
    return this.mapEvaluation(evaluation);
  }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ filterKeys: Object.keys(a[0].filter).join(',') }),
  })
  async getEvaluations({
    filter,
    sort,
    limit,
    offset,
  }: {
    filter: Record<string, any>;
    sort?: { [key: string]: SortOrder };
    limit?: number;
    offset?: number;
  }) {
    setSpanAttributes({ filterKeys: Object.keys(filter).join(',') });
    const evaluations = await this.evaluationRepository.findAll(filter, sort, limit, offset);
    return evaluations.map((e) => this.mapEvaluation(e));
  }

  // ========== Private fetch methods ==========

  @TraceDecorator()
  @LogDecorator({ args: (a) => ({ poolId: a[0].poolId }) })
  private async fetchPool({ poolId }: { poolId: string }) {
    const response = await this.rwaClient.getPool.post({ id: poolId });
    if (response.error || !response.data) {
      throw new AppError({
        message: 'Failed to fetch pool from rwa service',
        statusCode: 502,
        code: 'UPSTREAM_ERROR',
      });
    }
    return response.data;
  }

  @TraceDecorator()
  @LogDecorator({ args: (a) => ({ businessId: a[0].businessId }) })
  private async fetchBusiness({ businessId }: { businessId: string }) {
    const response = await this.rwaClient.getBusiness.post({ id: businessId });
    if (response.error || !response.data) {
      throw new AppError({
        message: 'Failed to fetch business from rwa service',
        statusCode: 502,
        code: 'UPSTREAM_ERROR',
      });
    }
    return response.data;
  }

  @TraceDecorator()
  @LogDecorator({ args: (a) => ({ businessId: a[0].businessId, excludeId: a[0].excludeId }) })
  private async fetchSiblingPools({
    businessId,
    excludeId,
  }: {
    businessId: string;
    excludeId: string;
  }): Promise<SiblingPoolMeta[]> {
    const response = await this.rwaClient.getPools.post({ filter: { businessId } });
    if (response.error || !response.data) {
      throw new AppError({
        message: 'Failed to fetch pools from rwa service',
        statusCode: 502,
        code: 'UPSTREAM_ERROR',
      });
    }
    return response.data
      .filter((p) => p.id !== excludeId)
      .map((p) => ({
        name: p.name,
        riskScore: p.riskScore ?? undefined,
        poolAddress: p.poolAddress ?? undefined,
        deployed: !!p.poolAddress,
      }));
  }

  @TraceDecorator()
  @LogDecorator({ args: (a) => ({ businessId: a[0].businessId }) })
  private async fetchBusinessPools({ businessId }: { businessId: string }): Promise<SiblingPoolMeta[]> {
    const response = await this.rwaClient.getPools.post({ filter: { businessId } });
    if (response.error || !response.data) {
      throw new AppError({
        message: 'Failed to fetch pools from rwa service',
        statusCode: 502,
        code: 'UPSTREAM_ERROR',
      });
    }
    return response.data.map((p) => ({
      name: p.name,
      riskScore: p.riskScore ?? undefined,
      poolAddress: p.poolAddress ?? undefined,
      deployed: !!p.poolAddress,
    }));
  }

  @TraceDecorator()
  @LogDecorator({ args: (a) => ({ parentId: a[0].parentId }) })
  private async fetchDocuments({ parentId }: { parentId: string }): Promise<DocumentMeta[]> {
    const response = await this.documentsClient.getDocuments.post({ filter: { parentId } });
    if (response.error || !response.data) {
      throw new AppError({
        message: 'Failed to fetch documents from documents service',
        statusCode: 502,
        code: 'UPSTREAM_ERROR',
      });
    }
    return response.data.map((d) => ({ id: d.id, name: d.name, mimeType: d.mimeType, url: d.url }));
  }

  @TraceDecorator()
  @LogDecorator({ args: (a) => ({ parentId: a[0].parentId }) })
  private async fetchGallery({ parentId }: { parentId: string }): Promise<ImageMeta[]> {
    const response = await this.galleryClient.getImages.post({ filter: { parentId } });
    if (response.error || !response.data) {
      throw new AppError({
        message: 'Failed to fetch images from gallery service',
        statusCode: 502,
        code: 'UPSTREAM_ERROR',
      });
    }
    return response.data.map((i) => ({ id: i.id, name: i.name, url: i.url }));
  }

  @TraceDecorator()
  @LogDecorator({ args: (a) => ({ parentId: a[0].parentId, parentType: a[0].parentType }) })
  private async fetchReactions({ parentId, parentType }: { parentId: string; parentType: string }) {
    const response = await this.reactionsClient.getEntityReactions.post({ parentId, parentType });
    if (response.error || !response.data) {
      throw new AppError({
        message: 'Failed to fetch reactions from reactions service',
        statusCode: 502,
        code: 'UPSTREAM_ERROR',
      });
    }
    return response.data;
  }

  @TraceDecorator()
  @LogDecorator({ args: (a) => ({ parentId: a[0].parentId }) })
  private async fetchQuestions({ parentId }: { parentId: string }) {
    const response = await this.questionsClient.getQuestions.post({ filter: { parentId } });
    if (response.error || !response.data) {
      throw new AppError({
        message: 'Failed to fetch questions from questions service',
        statusCode: 502,
        code: 'UPSTREAM_ERROR',
      });
    }
    return response.data;
  }

  @TraceDecorator()
  @LogDecorator({ args: (a) => ({ poolAddress: a[0].poolAddress }) })
  private async fetchPortfolio({ poolAddress }: { poolAddress: string }) {
    const response = await this.portfolioClient.getBalances.post({ filter: { poolAddress } });
    if (response.error || !response.data) {
      throw new AppError({
        message: 'Failed to fetch portfolio from portfolio service',
        statusCode: 502,
        code: 'UPSTREAM_ERROR',
      });
    }
    return response.data;
  }

  // ========== Private LLM methods ==========

  @TraceDecorator()
  @LogDecorator()
  private async assemblePoolSummary(params: {
    pool: any;
    business: any;
    siblingPools: SiblingPoolMeta[];
    documents: DocumentMeta[];
    gallery: ImageMeta[];
    reactions: any;
    questions: any[];
    portfolio: any[] | null;
  }): Promise<Stage1Result> {
    const siblingText =
      params.siblingPools.length > 0
        ? params.siblingPools
            .map((p) => `- ${p.name}: riskScore=${p.riskScore ?? 'not yet evaluated'}, deployed=${p.deployed}`)
            .join('\n')
        : 'No sibling pools';

    const documentsText =
      params.documents.length > 0
        ? params.documents.map((d) => `- id=${d.id}, name=${d.name}, mimeType=${d.mimeType}, url=${d.url}`).join('\n')
        : 'No documents available';

    const imagesText =
      params.gallery.length > 0
        ? params.gallery.map((i) => `- id=${i.id}, name=${i.name}, url=${i.url}`).join('\n')
        : 'No images available';

    const reactionsText =
      Object.keys(params.reactions.reactions).length > 0
        ? Object.entries(params.reactions.reactions)
            .map(([type, count]) => `${type}: ${count}`)
            .join(', ')
        : 'No reactions';

    const questionsTotal = params.questions.length;
    const questionsAnswered = params.questions.filter((q) => q.answered).length;

    const portfolioText =
      params.portfolio && params.portfolio.length > 0
        ? `Investors: ${params.portfolio.length}`
        : 'No portfolio data (pool not deployed or no investors)';

    const summary = `Entity type: pool
Pool name: ${params.pool.name}
Pool description: ${params.pool.description ?? 'N/A'}
Pool tags: ${params.pool.tags?.join(', ') ?? 'N/A'}

Financial parameters:
- Entry fee: ${params.pool.entryFeePercent ?? 'N/A'}
- Exit fee: ${params.pool.exitFeePercent ?? 'N/A'}
- Expected HOLD amount: ${params.pool.expectedHoldAmount ?? 'N/A'}
- Expected RWA amount: ${params.pool.expectedRwaAmount ?? 'N/A'}
- Reward percent: ${params.pool.rewardPercent ?? 'N/A'}

Parent business:
- Name: ${params.business.name}
- Type: ${params.business.businessType ?? 'N/A'}
- Country: ${params.business.country ?? 'N/A'}
- Tags: ${params.business.tags?.join(', ') ?? 'N/A'}

Sibling pools of this business:
${siblingText}

Available documents (no content, metadata only):
${documentsText}

Available images (no content, metadata only):
${imagesText}

Reactions: ${reactionsText}

Q&A: ${questionsTotal} questions, ${questionsAnswered} answered

Portfolio: ${portfolioText}`;

    const systemMessage = `You are a risk assessment expert. Analyze the following pool summary and decide which documents and images you need to study for a detailed risk evaluation.

${summary}

Return JSON with the IDs of documents and images you want to examine:
{
  "requestedDocuments": ["docId1", "docId3"],
  "requestedImages": ["imgId2"]
}

If you don't need any documents or images, return empty arrays.`;

    const completion = await this.openRouterClient.chatCompletion({
      model: this.openRouterModel,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: 'Which documents and images do you need for risk evaluation? Return JSON only.' },
      ],
    });

    const stage1Response = completion.choices[0]?.message?.content ?? '';
    const parsed = this.parseLLMJsonResponse(stage1Response);

    return {
      stage1Response,
      requestedDocuments: parsed.requestedDocuments ?? [],
      requestedImages: parsed.requestedImages ?? [],
    };
  }

  @TraceDecorator()
  @LogDecorator()
  private async assembleBusinessSummary(params: {
    business: any;
    pools: SiblingPoolMeta[];
    documents: DocumentMeta[];
    gallery: ImageMeta[];
    reactions: any;
    questions: any[];
  }): Promise<Stage1Result> {
    const poolsText =
      params.pools.length > 0
        ? params.pools
            .map((p) => `- ${p.name}: riskScore=${p.riskScore ?? 'not yet evaluated'}, deployed=${p.deployed}`)
            .join('\n')
        : 'No pools';

    const documentsText =
      params.documents.length > 0
        ? params.documents.map((d) => `- id=${d.id}, name=${d.name}, mimeType=${d.mimeType}, url=${d.url}`).join('\n')
        : 'No documents available';

    const imagesText =
      params.gallery.length > 0
        ? params.gallery.map((i) => `- id=${i.id}, name=${i.name}, url=${i.url}`).join('\n')
        : 'No images available';

    const reactionsText =
      Object.keys(params.reactions.reactions).length > 0
        ? Object.entries(params.reactions.reactions)
            .map(([type, count]) => `${type}: ${count}`)
            .join(', ')
        : 'No reactions';

    const questionsTotal = params.questions.length;
    const questionsAnswered = params.questions.filter((q) => q.answered).length;

    const summary = `Entity type: business
Business name: ${params.business.name}
Business description: ${params.business.description ?? 'N/A'}
Business tags: ${params.business.tags?.join(', ') ?? 'N/A'}
Country: ${params.business.country ?? 'N/A'}
Business type: ${params.business.businessType ?? 'N/A'}
Socials: ${params.business.socials?.map((s: any) => `${s.type}: ${s.url}`).join(', ') ?? 'N/A'}

Pools of this business:
${poolsText}

Available documents (no content, metadata only):
${documentsText}

Available images (no content, metadata only):
${imagesText}

Reactions: ${reactionsText}

Q&A: ${questionsTotal} questions, ${questionsAnswered} answered`;

    const systemMessage = `You are a risk assessment expert. Analyze the following business summary and decide which documents and images you need to study for a detailed risk evaluation.

${summary}

Return JSON with the IDs of documents and images you want to examine:
{
  "requestedDocuments": ["docId1", "docId3"],
  "requestedImages": ["imgId2"]
}

If you don't need any documents or images, return empty arrays.`;

    const completion = await this.openRouterClient.chatCompletion({
      model: this.openRouterModel,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: 'Which documents and images do you need for risk evaluation? Return JSON only.' },
      ],
    });

    const stage1Response = completion.choices[0]?.message?.content ?? '';
    const parsed = this.parseLLMJsonResponse(stage1Response);

    return {
      stage1Response,
      requestedDocuments: parsed.requestedDocuments ?? [],
      requestedImages: parsed.requestedImages ?? [],
    };
  }

  @TraceDecorator()
  @LogDecorator()
  private async evaluateWithRequestedData(params: {
    summary: string;
    fetchedDocuments: DocumentMeta[];
    fetchedImages: ImageMeta[];
  }): Promise<Stage2Result> {
    const contentParts: Array<TextContentPart | FileContentPart | ImageContentPart> = [
      { type: 'text', text: params.summary },
      {
        type: 'text',
        text: `\n\nPlease evaluate the risk of this entity based on the summary above and the attached documents/images. Return JSON:
{
  "riskScore": <integer 1-100>,
  "reasoning": "<textual justification>",
  "factors": [{"name": "<factor name>", "impact": "<positive|negative|neutral>", "detail": "<explanation>"}]
}

riskScore must be an integer between 1 and 100. 0 is not allowed.`,
      },
    ];

    for (const doc of params.fetchedDocuments) {
      contentParts.push({
        type: 'file',
        file: {
          filename: doc.name,
          fileData: doc.url,
        },
      });
    }

    for (const img of params.fetchedImages) {
      contentParts.push({
        type: 'image_url',
        imageUrl: { url: img.url },
      });
    }

    const messages: ChatMessage[] = [{ role: 'user', content: contentParts }];

    const completion = await this.openRouterClient.chatCompletion({
      model: this.openRouterModel,
      messages,
    });

    const stage2Response = completion.choices[0]?.message?.content ?? '';
    const parsed = this.parseLLMJsonResponse(stage2Response);

    const riskScore = Number(parsed.riskScore);
    if (!Number.isInteger(riskScore) || riskScore < 1 || riskScore > 100) {
      throw new AppError({
        message: `LLM returned invalid riskScore: ${parsed.riskScore}. Must be integer 1-100.`,
        statusCode: 502,
        code: 'AI_ERROR',
      });
    }

    return {
      riskScore,
      reasoning: String(parsed.reasoning ?? ''),
      factors: Array.isArray(parsed.factors) ? parsed.factors : [],
      stage2Response,
    };
  }

  @TraceDecorator()
  @LogDecorator()
  private async fetchRequestedFiles(params: {
    documents: DocumentMeta[];
    gallery: ImageMeta[];
    requestedDocuments: string[];
    requestedImages: string[];
  }): Promise<{ fetchedDocuments: DocumentMeta[]; fetchedImages: ImageMeta[] }> {
    const fetchedDocuments: DocumentMeta[] = [];
    for (const docId of params.requestedDocuments) {
      const doc = params.documents.find((d) => d.id === docId);
      if (!doc) {
        throw new AppError({
          message: `LLM requested document ${docId} but it was not found in the available documents`,
          statusCode: 400,
          code: 'NOT_FOUND',
        });
      }
      fetchedDocuments.push(doc);
    }

    const fetchedImages: ImageMeta[] = [];
    for (const imgId of params.requestedImages) {
      const img = params.gallery.find((i) => i.id === imgId);
      if (!img) {
        throw new AppError({
          message: `LLM requested image ${imgId} but it was not found in the available images`,
          statusCode: 400,
          code: 'NOT_FOUND',
        });
      }
      fetchedImages.push(img);
    }

    return { fetchedDocuments, fetchedImages };
  }

  private parseLLMJsonResponse(response: string): any {
    let cleaned = response.trim();
    // Strip markdown code block ```json ... ``` or ``` ... ```
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      cleaned = codeBlockMatch[1].trim();
    }
    try {
      return JSON.parse(cleaned);
    } catch (error) {
      throw new AppError({
        message: 'Failed to parse LLM response as JSON',
        statusCode: 502,
        code: 'AI_ERROR',
        cause: error,
      });
    }
  }

  private mapEvaluation(evaluation: any) {
    return {
      id: evaluation._id.toString(),
      entityType: evaluation.entityType,
      parentId: evaluation.parentId,
      grandParentId: evaluation.grandParentId,
      ownerId: evaluation.ownerId,
      ownerType: evaluation.ownerType,
      riskScore: evaluation.riskScore,
      reasoning: evaluation.reasoning,
      factors: evaluation.factors ?? [],
      stage1Response: evaluation.stage1Response,
      stage2Response: evaluation.stage2Response,
      evaluatedDocuments: evaluation.evaluatedDocuments ?? [],
      evaluatedImages: evaluation.evaluatedImages ?? [],
      modelUsed: evaluation.modelUsed,
      createdAt: evaluation.createdAt,
      updatedAt: evaluation.updatedAt,
    };
  }
}
