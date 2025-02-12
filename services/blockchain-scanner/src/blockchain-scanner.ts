// src/services/blockchain-scanner.service.ts
import { ethers, Contract, EventLog, Log } from 'ethers';
import { Channel, connect } from 'amqplib';
import Queue from 'bull';
import { logger, metrics } from '@rwa-platform/shared/src';
import { BlockCursor } from './models/block-cursor.model';
import { BlockchainEvent } from './models/blockchain-event.model';

interface ContractConfig {
  address: string;
  abi: any[]; // В реальном проекте здесь лучше использовать более строгую типизацию для ABI
  events: string[];
  startBlock?: number;
}

interface ContractInstance {
  contract: Contract;
  config: ContractConfig;
}

interface BlockchainEventData {
  networkId: string;
  contractAddress: string;
  eventName: string;
  blockNumber: number;
  transactionHash: string;
  timestamp: Date;
  returnValues: any;
  raw: any;
}

export class BlockchainScanner {
  private provider: ethers.JsonRpcProvider;
  private contracts: Map<string, ContractInstance>;
  private rabbitmqChannel: Channel | null;
  private eventQueue: Queue.Queue | null;
  private isScanning: boolean;
  private readonly batchSize: number;
  private readonly retryDelay: number;
  private readonly maxRetries: number;

  constructor(
    private readonly networkId: string,
    private readonly rpcUrl: string,
    private readonly rabbitmqUrl: string,
    private readonly redisUrl: string,
    private readonly contractConfigs: Record<string, ContractConfig>,
    options?: {
      batchSize?: number;
      retryDelay?: number;
      maxRetries?: number;
    }
  ) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.contracts = new Map();
    this.rabbitmqChannel = null;
    this.eventQueue = null;
    this.isScanning = false;
    this.batchSize = options?.batchSize || 100;
    this.retryDelay = options?.retryDelay || 5000;
    this.maxRetries = options?.maxRetries || 3;
  }

  public async initialize(): Promise<void> {
    try {
      await this.initializeContracts();
      await this.initializeMessageQueues();
      logger.info('Blockchain scanner initialized successfully');
    } catch (error: any) {
      logger.error('Failed to initialize blockchain scanner:', error);
      throw error;
    }
  }

  private async initializeContracts(): Promise<void> {
    for (const [name, config] of Object.entries(this.contractConfigs)) {
      try {
        const contract = new ethers.Contract(config.address, config.abi, this.provider);
        this.contracts.set(name, { contract, config });
      } catch (error: any) {
        logger.error(`Failed to initialize contract ${name}:`, error);
        throw error;
      }
    }
  }

  private async initializeMessageQueues(): Promise<void> {
    try {
      const connection = await connect(this.rabbitmqUrl);
      this.rabbitmqChannel = await connection.createChannel();
      await this.rabbitmqChannel.assertQueue('blockchain_events');

      this.eventQueue = new Queue('blockchain_events', this.redisUrl, {
        defaultJobOptions: {
          attempts: this.maxRetries,
          backoff: {
            type: 'exponential',
            delay: this.retryDelay,
          },
        },
      });
    } catch (error: any) {
      logger.error('Failed to initialize message queues:', error);
      throw error;
    }
  }

  public async startScanning(): Promise<void> {
    if (this.isScanning) {
      logger.info('Scanner is already running');
      return;
    }

    this.isScanning = true;
    logger.info('Starting blockchain scanning');

    try {
      while (this.isScanning) {
        const cursor = await this.getOrCreateCursor();
        const latestBlock = await this.provider.getBlockNumber();

        if (cursor.lastBlockNumber >= latestBlock) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
          continue;
        }

        const endBlock = Math.min(
          cursor.lastBlockNumber + this.batchSize,
          latestBlock
        );

        await this.scanBlockRange(cursor.lastBlockNumber + 1, endBlock);
        
        cursor.lastBlockNumber = endBlock;
        await cursor.save();

        metrics.gauge('blockchain.scanner.current_block', endBlock);
      }
    } catch (error: any) {
      this.isScanning = false;
      logger.error('Scanning error:', error);
      metrics.increment('blockchain.scanner.errors');
      throw error;
    }
  }

  private async scanBlockRange(fromBlock: number, toBlock: number): Promise<void> {
    logger.info(`Scanning blocks from ${fromBlock} to ${toBlock}`);

    for (const [name, { contract, config }] of this.contracts) {
      for (const eventName of config.events) {
        try {
          const filter = contract.filters[eventName]();
          const events = await contract.queryFilter(filter, fromBlock, toBlock);

          for (const event of events) {
            await this.processEvent(contract.target as string, eventName, event);
          }

          metrics.increment('blockchain.events.scanned', {
            contract: name,
            event: eventName,
          });
        } catch (error: any) {
          logger.error(`Error scanning ${eventName} events for ${name}:`, error);
          metrics.increment('blockchain.scanner.event_errors');
        }
      }
    }
  }

  private async processEvent(
    contractAddress: string,
    eventName: string,
    event: EventLog | Log
  ): Promise<void> {
    const eventData: BlockchainEventData = {
      networkId: this.networkId,
      contractAddress,
      eventName,
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      timestamp: new Date(),
      returnValues: 'args' in event ? event.args : {},
      raw: event
    };

    try {
      // Сохраняем в MongoDB
      await BlockchainEvent.create(eventData);

      // Отправляем в RabbitMQ
      if (this.rabbitmqChannel) {
        await this.rabbitmqChannel.sendToQueue(
          'blockchain_events',
          Buffer.from(JSON.stringify(eventData))
        );
      }

      // Добавляем в очередь Bull
      if (this.eventQueue) {
        await this.eventQueue.add('processEvent', eventData);
      }

      metrics.increment('blockchain.events.processed');
    } catch (error: any) {
      logger.error('Failed to process blockchain event:', error);
      metrics.increment('blockchain.events.processing_errors');
      throw error;
    }
  }

  private async getOrCreateCursor(): Promise<any> {
    try {
      let cursor = await BlockCursor.findOne({ networkId: this.networkId });
      
      if (!cursor) {
        const startBlock = await this.getStartBlock();
        cursor = await BlockCursor.create({
          networkId: this.networkId,
          lastBlockNumber: startBlock
        });
      }

      return cursor;
    } catch (error: any) {
      logger.error('Failed to get or create block cursor:', error);
      throw error;
    }
  }

  private async getStartBlock(): Promise<number> {
    const configuredStartBlocks = Object.values(this.contractConfigs)
      .map(c => c.startBlock || 0)
      .filter(block => block > 0);

    if (configuredStartBlocks.length > 0) {
      return Math.min(...configuredStartBlocks);
    }

    return await this.provider.getBlockNumber();
  }

  public stop(): void {
    this.isScanning = false;
    logger.info('Stopping blockchain scanner');
  }

  public async cleanup(): Promise<void> {
    this.stop();
    
    if (this.eventQueue) {
      await this.eventQueue.close();
    }
    
    if (this.rabbitmqChannel) {
      await this.rabbitmqChannel.close();
    }
    
    logger.info('Blockchain scanner cleaned up');
  }
}
