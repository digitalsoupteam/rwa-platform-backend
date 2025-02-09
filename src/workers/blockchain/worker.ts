import { ethers } from 'ethers';
import { ModuleConfig } from './types';
import { EventRouter } from './event-router';
import { BlockSyncService } from './block-sync';

export class BlockchainWorker {
  private provider: ethers.JsonRpcProvider;
  private eventRouter: EventRouter;
  private blockSyncService: BlockSyncService;
  private isRunning: boolean = false;

  constructor(
    private readonly config: ModuleConfig,
  ) {
    this.provider = new ethers.JsonRpcProvider(config.ethereum.rpcUrl);
    this.eventRouter = new EventRouter(config);
    this.blockSyncService = new BlockSyncService(
      config,
      this.provider,
      this.eventRouter,
    );
  }

  async initialize(): Promise<void> {
    try {
      await this.eventRouter.initialize();
      await this.blockSyncService.initialize();
    } catch (error) {
      console.error('Failed to initialize BlockchainWorker', { error });
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      await this.blockSyncService.start();
    } catch (error) {
      this.isRunning = false;
      console.error('Error starting BlockchainWorker', { error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    await this.blockSyncService.stop();
  }
}