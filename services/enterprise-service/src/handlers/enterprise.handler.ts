import { RabbitMQClient } from '@rwa-platform/shared/src/utils/rabbitmq';
import { logger } from '@rwa-platform/shared/src';
import path from 'path';
import fs from 'fs';
import pdf from 'pdf-parse';
import { RWAEnterprise } from '../models/rwa-enterprise.model';
import { Pool } from '../models/pool.model';
import { 
  QUEUES, 
  AIAnalysisMessage, 
  AIAnalysisResultMessage,
  SignerMessage,
  SignedMessage,
  BlockchainEventMessage 
} from '../types/queue.types';

export class EnterpriseHandler {
  private uploadDir: string;

  constructor(
    private rabbitmq: RabbitMQClient
  ) {
    this.uploadDir = path.join(process.cwd(), 'uploads');
    this.ensureUploadDir();
  }

  private ensureUploadDir() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  private async saveFile(file: any) {
    const filename = `${Date.now()}-${file.name}`;
    const filepath = path.join(this.uploadDir, filename);
    
    await fs.promises.writeFile(filepath, Buffer.from(await file.arrayBuffer()));
    
    return {
      path: filepath,
      filename: filename
    };
  }

  private async parsePDF(filepath: string): Promise<string> {
    const dataBuffer = await fs.promises.readFile(filepath);
    const data = await pdf(dataBuffer);
    return data.text;
  }

  private async handleAIAnalysisResult(message: AIAnalysisResultMessage) {
    try {
      const enterprise = await RWAEnterprise.findById(message.enterpriseId);
      if (!enterprise) {
        throw new Error('Enterprise not found');
      }

      enterprise.aiAnalysis = {
        summary: message.summary,
        riskScore: message.riskScore
      };
      enterprise.status = 'PROCESSING';
      await enterprise.save();

      logger.info(`AI analysis completed for enterprise ${enterprise.id}`);
    } catch (error: any) {
      logger.error('Error handling AI analysis result:', error);
    }
  }

  private async handleSignedMessage(message: SignedMessage) {
    try {
      const enterprise = await RWAEnterprise.findById(message.id);
      if (!enterprise) {
        throw new Error('Enterprise not found');
      }

      // Clear existing signatures
      enterprise.signatures.splice(0, enterprise.signatures.length);
      
      // Add new signatures using Mongoose array methods
      for (const sig of message.signatures) {
        enterprise.signatures.addToSet({
          signer: sig.signer,
          signature: sig.signature
        });
      }
      await enterprise.save();

      logger.info(`Signatures collected for enterprise ${enterprise.id}`);
    } catch (error: any) {
      logger.error('Error handling signed message:', error);
    }
  }

  private async handleBlockchainEvent(message: BlockchainEventMessage) {
    try {
      if (message.eventName !== 'RWADeployed') {
        return;
      }

      const enterprise = await RWAEnterprise.findOne({
        productOwner: message.params.productOwner,
        name: message.params.name
      });

      if (!enterprise) {
        throw new Error('Enterprise not found');
      }

      enterprise.status = 'APPROVED';
      enterprise.contractAddress = message.contractAddress;
      await enterprise.save();

      logger.info(`Enterprise ${enterprise.id} approved and deployed to blockchain`);
    } catch (error: any) {
      logger.error('Error handling blockchain event:', error);
    }
  }

  async initialize() {
    // Setup queues
    await this.rabbitmq.setupQueue(QUEUES.AI_ANALYSIS);
    await this.rabbitmq.setupQueue(QUEUES.AI_ANALYSIS_RESULT);
    await this.rabbitmq.setupQueue(QUEUES.BLOCKCHAIN_EVENTS);

    // Subscribe to queue messages
    await this.rabbitmq.subscribe(
      QUEUES.AI_ANALYSIS_RESULT,
      this.handleAIAnalysisResult.bind(this)
    );
    await this.rabbitmq.subscribe(
      QUEUES.SIGNER_SIGNED,
      this.handleSignedMessage.bind(this)
    );
    await this.rabbitmq.subscribe(
      QUEUES.BLOCKCHAIN_EVENTS,
      this.handleBlockchainEvent.bind(this)
    );

    logger.info('Enterprise handler initialized');
  }

  async createEnterprise(data: {
    name: string;
    productOwner: string;
    image: any;
    investmentPresentation: any;
    projectSummary: any;
  }) {
    try {
      // Create enterprise record
      const enterprise = await RWAEnterprise.create({
        name: data.name,
        productOwner: data.productOwner,
        status: 'PENDING'
      });

      // Save files
      const imageFile = await this.saveFile(data.image);
      const investmentPresentationFile = await this.saveFile(data.investmentPresentation);
      const projectSummaryFile = await this.saveFile(data.projectSummary);

      // Parse PDFs
      const investmentPresentationText = await this.parsePDF(investmentPresentationFile.path);
      const projectSummaryText = await this.parsePDF(projectSummaryFile.path);

      // Update enterprise with file info
      enterprise.image = imageFile;
      enterprise.investmentPresentation = {
        ...investmentPresentationFile,
        content: investmentPresentationText
      };
      enterprise.projectSummary = {
        ...projectSummaryFile,
        content: projectSummaryText
      };
      await enterprise.save();

      // Send to AI analysis
      await this.rabbitmq.publish(QUEUES.AI_ANALYSIS, {
        enterpriseId: enterprise.id,
        investmentPresentationText,
        projectSummaryText
      } as AIAnalysisMessage);

      return enterprise;

    } catch (error: any) {
      logger.error('Error creating enterprise:', error);
      throw error;
    }
  }

  async requestSignatures(enterpriseId: string) {
    const enterprise = await RWAEnterprise.findById(enterpriseId);
    if (!enterprise) {
      throw new Error('Enterprise not found');
    }

    if (enterprise.status !== 'PROCESSING') {
      throw new Error('Enterprise must be in PROCESSING status');
    }

    // Prepare contract deployment data
    const deploymentData = {
      // This will be configured later by product owner
      chainId: 1,
      factoryAddress: '',
      productOwner: enterprise.productOwner,
      name: enterprise.name
    };

    // Request signatures
    await this.rabbitmq.publish(QUEUES.SIGNER_UNSIGNED, {
      id: enterprise.id,
      data: JSON.stringify(deploymentData),
      chainId: deploymentData.chainId,
      requiredSignatures: 2, // Configure as needed
      totalSigners: 3 // Configure as needed
    } as SignerMessage);

    return enterprise;
  }

  async createPool(enterpriseId: string, data: { name: string; metadata?: Record<string, string> }) {
    const enterprise = await RWAEnterprise.findById(enterpriseId);
    if (!enterprise) {
      throw new Error('Enterprise not found');
    }

    if (enterprise.status !== 'APPROVED') {
      throw new Error('Enterprise must be approved to create pools');
    }

    const pool = await Pool.create({
      rwaEnterprise: enterprise.id,
      name: data.name,
      metadata: data.metadata
    });

    enterprise.pools.push(pool.id);
    await enterprise.save();

    return pool;
  }

}
