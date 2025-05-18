import { ethers } from "ethers";
import { logger } from "@shared/monitoring/src/logger";
import { BlockchainError } from "@shared/errors/app-errors";
import { CONFIG } from "../config";
import EventEmitterABI from "../abi/EventEmitter.json";
import { BlockchainScannerService } from "../services/blockchainScanner.service";

type BlockchainEventData = {
  chainId: number;
  name: string;
  blockNumber: number;
  transactionHash: string;
  address: string;
  logIndex: number;
  data: Record<string, any>;
  timestamp: number;
};

/**
 * Daemon for scanning blockchain
 * Handles blockchain interaction and periodic scanning
 */
export class BlockchainScannerDaemon {
  // Blockchain related
  private provider: ethers.JsonRpcProvider;
  private eventEmitterContract: ethers.Contract;

  // Scanner related
  private isRunning: boolean = false;
  private scanTimer: Timer | null = null;
  private lastProcessedBlock: number = 0;

  constructor(
    private rpcUrl: string,
    private contractAddress: string,
    private blockConfirmations: number,
    private scanIntervalMs: number,
    private batchSize: number,
    private chainId: number,
    private scannerService: BlockchainScannerService
  ) {
    // Initialize provider and contract
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.eventEmitterContract = new ethers.Contract(
      contractAddress,
      EventEmitterABI.abi,
      this.provider
    );
  }

  /**
   * Initialize daemon
   */
  async initialize(): Promise<void> {
    try {
      logger.info("Initializing Blockchain Scanner Daemon");

      // Verify chain ID from provider matches the expected one
      const network = await this.provider.getNetwork();
      const providerChainId = Number(network.chainId);

      if (providerChainId !== this.chainId) {
        throw new BlockchainError(
          `Chain ID mismatch. Expected ${this.chainId}, but provider returned ${providerChainId}`
        );
      }

      logger.info(`Chain ID verified: ${this.chainId}`);

      // Get last processed block from database or use genesis block
      this.lastProcessedBlock = await this.scannerService.getLastProcessedBlock();
      if (this.lastProcessedBlock === 0) {
        this.lastProcessedBlock = await this.getGenesisBlock() - 1;
      }
      logger.info(`Last processed block: ${this.lastProcessedBlock}`);

      logger.info("Blockchain Scanner Daemon initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize Blockchain Scanner Daemon", error);
      throw new BlockchainError(
        "Failed to initialize Blockchain Scanner Daemon",
        error
      );
    }
  }

  /**
   * Get genesis block number from contract
   */
  private async getGenesisBlock(): Promise<number> {
    try {      
      logger.info(`getGenesisBlock`);
      const genesisBlock = await this.eventEmitterContract.genesisBlock();
      return typeof genesisBlock === "bigint"
        ? Number(genesisBlock)
        : genesisBlock;
    } catch (error) {
      logger.error("Failed to get genesis block", error);
      return 0;
    }
  }

  /**
   * Get latest block number
   */
  private async getLatestBlockNumber(): Promise<number> {
    try {
      return await this.provider.getBlockNumber();
    } catch (error) {
      logger.error("Failed to get latest block number", error);
      throw new BlockchainError("Failed to get latest block number", error);
    }
  }

  /**
   * Get events from block range
   */
  private async getEvents(
    fromBlock: number,
    toBlock: number
  ): Promise<BlockchainEventData[]> {
    try {
      logger.info(`Getting events from block ${fromBlock} to ${toBlock}`);

      const allEvents = await this.eventEmitterContract.queryFilter(
        "*" as any,
        fromBlock,
        toBlock
      );

      logger.info(`Retrieved ${allEvents.length} events`);

      // Group events by blocks for ordered processing
      const eventsByBlock: Record<number, ethers.EventLog[]> = {};
      const blockNumbers: number[] = [];

      for (const event of allEvents) {
        if (!eventsByBlock[event.blockNumber]) {
          eventsByBlock[event.blockNumber] = [];
          blockNumbers.push(event.blockNumber);
        }
        eventsByBlock[event.blockNumber].push(event as ethers.EventLog);
      }

      // Sort blocks for sequential processing
      blockNumbers.sort((a, b) => a - b);

      const processedEvents: BlockchainEventData[] = [];

      // Process each block sequentially
      for (const blockNumber of blockNumbers) {
        const blockEvents = eventsByBlock[blockNumber];
        const block = await blockEvents[0].getBlock(); // Get block once for all events

        for (const event of blockEvents) {
          const eventName = this.getEventName(event);
          processedEvents.push({
            chainId: this.chainId,
            name: eventName,
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
            address: this.contractAddress,
            logIndex: event.index,
            data: this.parseEventData(event),
            timestamp: Number(block.timestamp),
          });
        }
      }

      return processedEvents;
    } catch (error) {
      logger.error(
        `Failed to get events from ${fromBlock} to ${toBlock}`,
        error
      );
      throw new BlockchainError(
        `Failed to get events from block ${fromBlock} to ${toBlock}`,
        error
      );
    }
  }

  /**
   * Get event name from log
   */
  private getEventName(event: ethers.EventLog): string {
    try {
      return event.fragment.name;
    } catch (error) {
      return "Unknown";
    }
  }

  /**
   * Parse event data
   */
  private parseEventData(event: ethers.EventLog): Record<string, any> {
    try {
      const args = event.args;
      if (!args) {
        return {};
      }

      const result: Record<string, any> = {};
      for (let i = 0; i < args.length; i++) {
        result[event.fragment.inputs[i].name] = args[i];
      }

      return this.convertBigIntToString(result);
    } catch (error) {
      logger.error("Failed to parse event data", error);
      return {};
    }
  }

  /**
   * Convert BigInt to string in object
   */
  private convertBigIntToString(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === "bigint") return obj.toString();
    if (Array.isArray(obj))
      return obj.map((item) => this.convertBigIntToString(item));
    if (typeof obj === "object") {
      const result: Record<string, any> = {};
      for (const key in obj) {
        if (isNaN(Number(key))) {
          result[key] = this.convertBigIntToString(obj[key]);
        }
      }
      return result;
    }
    return obj;
  }

  /**
   * Start scanning daemon
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("Scanner is already running");
      return;
    }

    try {
      this.isRunning = true;
      logger.info("Starting blockchain scanner");

      await this.scan();

      this.scanTimer = setInterval(async () => {
        try {
          await this.scan();
        } catch (error) {
          logger.error("Error during periodic scan", error);
        }
      }, this.scanIntervalMs);

      logger.info(
        `Scanner started. Scanning every ${this.scanIntervalMs / 1000} seconds`
      );
    } catch (error) {
      this.isRunning = false;
      logger.error("Failed to start scanner", error);
      throw new BlockchainError("Failed to start scanner", error);
    }
  }

  /**
   * Stop scanning daemon
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn("Scanner is not running");
      return;
    }

    logger.info("Stopping blockchain scanner");

    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }

    this.isRunning = false;
    logger.info("Scanner stopped");
  }

  /**
   * Scan blockchain
   */
  private async scan(): Promise<void> {
    try {
      const currentBlock = await this.getLatestBlockNumber();
      const confirmedBlock = currentBlock - this.blockConfirmations;

      if (this.lastProcessedBlock >= confirmedBlock) {
        logger.info(
          `No new blocks to process. Last processed: ${this.lastProcessedBlock}, Latest confirmed: ${confirmedBlock}`
        );
        return;
      }

      logger.info(
        `Processing blocks from ${
          this.lastProcessedBlock + 1
        } to ${confirmedBlock}`
      );

      let fromBlock = this.lastProcessedBlock + 1;

      while (fromBlock <= confirmedBlock) {
        const toBlock = Math.min(
          fromBlock + this.batchSize - 1,
          confirmedBlock
        );

        const events = await this.getEvents(fromBlock, toBlock);
        
        // Group events by block number
        const eventsByBlock = events.reduce((acc, event) => {
          if (!acc[event.blockNumber]) {
            acc[event.blockNumber] = [];
          }
          acc[event.blockNumber].push(event);
          return acc;
        }, {} as Record<number, BlockchainEventData[]>);

        // Process events block by block in ascending order
        const blockNumbers = Object.keys(eventsByBlock)
          .map(Number)
          .sort((a, b) => a - b);

        for (const blockNumber of blockNumbers) {
          const blockEvents = eventsByBlock[blockNumber];
          await this.scannerService.applyBlockEvents(blockNumber, blockEvents);
        }

        fromBlock = toBlock + 1;
        this.lastProcessedBlock = toBlock;
      }

      logger.info(`Finished processing blocks up to ${confirmedBlock}`);
    } catch (error) {
      logger.error("Error during scan", error);
      throw new BlockchainError("Error during blockchain scan", error);
    }
  }
}
