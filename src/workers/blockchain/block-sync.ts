import { ethers } from 'ethers';
import { Collection, MongoClient } from 'mongodb';
import { ModuleConfig, SyncState } from './types';
import { EventRouter } from './event-router';

export class BlockSyncService {
  // @ts-ignore
  private syncState: Collection<SyncState>;
  private lastProcessedBlock: number = 0;
  private isRunning: boolean = false;
  // @ts-ignore
  private mongoClient: MongoClient;

  constructor(
    private readonly config: ModuleConfig,
    private readonly provider: ethers.JsonRpcProvider,
    private readonly eventRouter: EventRouter
  ) {}

  async initialize(): Promise<void> {
    try {
      this.mongoClient = await MongoClient.connect(this.config.mongodb.uri);
      this.syncState = this.mongoClient.db().collection(this.config.mongodb.collection);

      const state = await this.syncState.findOne({ _id: 'sync-state' });
      this.lastProcessedBlock = state?.blockNumber || 0;
    } catch (error) {
      console.error('Failed to initialize BlockSyncService', { error });
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      while (this.isRunning) {
        const currentBlock = await this.provider.getBlockNumber();
        const confirmedBlock = currentBlock - this.config.ethereum.confirmations;

        if (confirmedBlock > this.lastProcessedBlock) {
          const fromBlock = this.lastProcessedBlock + 1;
          const toBlock = Math.min(fromBlock + this.config.sync.batchSize - 1, confirmedBlock);

          await this.processBlocks(fromBlock, toBlock);
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error('Error in block sync loop', { error });
      this.isRunning = false;
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    await this.mongoClient.close();
  }

  private async processBlocks(fromBlock: number, toBlock: number): Promise<void> {
    const session = this.mongoClient.startSession();

    try {
      await session.withTransaction(async () => {
        for (let blockNumber = fromBlock; blockNumber <= toBlock; blockNumber++) {
          const block = await this.provider.getBlock(blockNumber, true);
          if (!block) throw 'Sync service: Failed get block!';
          await this.processBlockEvents(block);

          await this.syncState.updateOne(
            { _id: 'sync-state' },
            { $set: { blockNumber, lastUpdate: new Date() } },
            { upsert: true, session }
          );

          this.lastProcessedBlock = blockNumber;
        }
      });
    } finally {
      await session.endSession();
    }
  }

  private async processBlockEvents(block: ethers.Block): Promise<void> {
    // Implementation of block events processing
  }
}
