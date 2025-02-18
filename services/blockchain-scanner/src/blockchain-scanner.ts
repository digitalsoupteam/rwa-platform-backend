// src/services/blockchain-scanner.service.ts
import { ethers, Contract, EventLog, Log } from 'ethers';
import { Channel, connect } from 'amqplib';
import { logger, metrics } from '@rwa-platform/shared/src';
import { BlockCursor } from './models/block-cursor.model';
import { BlockchainEvent } from './models/blockchain-event.model';
import { ContractConfig, EventConfig, getUniqueQueueNames } from './config/contracts';

interface ContractInstance {
  contract: Contract;
  config: ContractConfig;
}

export class BlockchainScanner {
  private provider: ethers.JsonRpcProvider;
  private contracts: Map<string, ContractInstance>;
  private rabbitmqChannel: Channel | null;
  private isScanning: boolean;
  private readonly batchSize: number;
  private readonly retryDelay: number;
  private readonly maxRetries: number;

  constructor(
    private readonly networkId: string,
    private readonly rpcUrl: string,
    private readonly rabbitmqUrl: string,
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
      
      // Initialize all required queues based on contract configurations
      const queueNames = getUniqueQueueNames();
      for (const queueName of queueNames) {
        await this.rabbitmqChannel.assertQueue(queueName, { durable: true });
      }
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

    for (const [contractName, { contract, config }] of this.contracts) {
      const eventNames = Object.keys(config.events);
      
      for (const eventName of eventNames) {
        let retries = 0;
        while (retries <= this.maxRetries) {
          try {
            const filter = contract.filters[eventName]();
            const events = await contract.queryFilter(filter, fromBlock, toBlock);
            const block = await this.provider.getBlock(toBlock);

            for (const event of events) {
              await this.processEvent(contractName, eventName, event, block);
            }

            metrics.increment('blockchain.events.scanned', {
              contract: contractName,
              event: eventName,
            });
            break; // Success, exit retry loop
          } catch (error: any) {
            retries++;
            logger.error(`Error scanning ${eventName} events for ${contractName} (attempt ${retries}/${this.maxRetries}):`, error);
            metrics.increment('blockchain.scanner.event_errors');
            
            if (retries > this.maxRetries) {
              throw error; // Max retries exceeded
            }
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, this.retryDelay));
          }
        }
      }
    }
  }

  private async processEvent(
    contractName: string,
    eventName: string,
    event: EventLog | Log,
    block: any
  ): Promise<void> {
    const contractConfig = this.contractConfigs[contractName];
    const eventConfig = contractConfig.events[eventName];

    if (!eventConfig) {
      logger.info(`No configuration found for event ${eventName} in contract ${contractName}`);
      return;
    }

    try {
      // Parse event data using custom parser if provided
      const parsedData = eventConfig.parseData 
        ? eventConfig.parseData(event)
        : 'args' in event 
          ? event.args 
          : {};

      const eventData = {
        networkId: this.networkId,
        contractAddress: contractConfig.address,
        eventName,
        blockNumber: event.blockNumber,
        blockTimestamp: block.timestamp,
        transactionHash: event.transactionHash,
        logIndex: event.index || 0,
        topics: event.topics || [],
        parsedData
      };

      // Store in MongoDB for analytics
      await BlockchainEvent.create(eventData);

      // Send to specific RabbitMQ queue based on event configuration
      if (this.rabbitmqChannel) {
        await this.rabbitmqChannel.sendToQueue(
          eventConfig.queueName,
          Buffer.from(JSON.stringify({
            ...eventData,
            timestamp: new Date().toISOString()
          }))
        );
      }

      metrics.increment('blockchain.events.processed', {
        contract: contractName,
        event: eventName
      });
    } catch (error: any) {
      logger.error(`Failed to process ${eventName} event from ${contractName}:`, error);
      metrics.increment('blockchain.events.processing_errors', {
        contract: contractName,
        event: eventName
      });
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
    
    if (this.rabbitmqChannel) {
      await this.rabbitmqChannel.close();
    }
    
    logger.info('Blockchain scanner cleaned up');
  }
}
