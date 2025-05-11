import { logger } from "@shared/monitoring/src/logger";
import { AppError, NotFoundError } from "@shared/errors/app-errors";
import { EventRepository } from "../repositories/event.repository";
import { ScannerStateRepository } from "../repositories/scannerState.repository";
import { RabbitMQClient } from "@shared/rabbitmq/src/rabbitmq.client";

/**
 * Service for handling blockchain events
 */
export class BlockchainScannerService {
  private readonly EXCHANGE_NAME = "blockchain.events";

  constructor(
    private readonly eventRepository: EventRepository,
    private readonly scannerStateRepository: ScannerStateRepository,
    private readonly rabbitMQClient: RabbitMQClient,
    private readonly chainId: number
  ) {}

  /**
   * Get event by ID
   */
  async getEventById(id: string) {
    logger.debug(`Getting event by ID: ${id}`);

    const event = await this.eventRepository.findById(id);
    if (!event) {
      throw new NotFoundError(`Event with id ${id} not found`);
    }

    return {
      id: event._id.toString(),
      chainId: event.chainId,
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      logIndex: event.logIndex,
      address: event.address,
      name: event.name,
      data: event.data,
      timestamp: event.timestamp,
    };
  }

  /**
   * Get events by filters
   */
  async getEvents(
    filters: {
      chainId?: number;
      blockNumber?: number;
      transactionHash?: string;
      address?: string;
      name?: string;
    },
    pagination?: { limit?: number; offset?: number }
  ) {
    logger.debug(`Getting events with filters: ${JSON.stringify(filters)}`);

    const events = await this.eventRepository.findAll(
      filters,
      { blockNumber: -1, logIndex: -1 },
      pagination?.limit || 100,
      pagination?.offset || 0
    );

    return events.map((event) => ({
      id: event._id.toString(),
      chainId: event.chainId,
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      logIndex: event.logIndex,
      address: event.address,
      name: event.name,
      data: event.data,
      timestamp: event.timestamp,
    }));
  }

  /**
   * Apply blockchain events from a single block - save to DB and publish to RabbitMQ
   */
  async applyBlockEvents(
    blockNumber: number,
    events: Array<{
      chainId: number;
      name: string;
      blockNumber: number;
      transactionHash: string;
      address: string;
      logIndex: number;
      data: Record<string, any>;
      timestamp: number;
    }>
  ): Promise<void> {
    if (events.length) {
      console.log("applyBlockEvents");
      console.log(JSON.stringify(events));
      console.log("-applyBlockEvents");

      for (let i = 0; i < events.length; i++) {
        if (events[i].blockNumber !== blockNumber) {
          throw new AppError("applyBlockEvents blockNumber!");
        }
      }

      // Delete existing events for this block
      await this.eventRepository.deleteBlockEvents(this.chainId, blockNumber);

      // Save new events to database
      const savedEvents = await this.eventRepository.createEvents(events);
      logger.info(
        `Saved ${savedEvents.length} events from block ${blockNumber} to database`
      );

      // Publish events to RabbitMQ
      for (const event of savedEvents) {
        await this.rabbitMQClient.publish(this.EXCHANGE_NAME, event.name, event);
      }
      logger.info(
        `Published ${savedEvents.length} events from block ${blockNumber} to RabbitMQ`
      );
    }

    // Update scanner state only after successful publish
    await this.scannerStateRepository.updateLastScannedBlock(
      this.chainId,
      blockNumber
    );
    logger.info(`Updated scanner state to block ${blockNumber}`);
  }

  /**
   * Get last processed block number from database
   * Returns 0 if no blocks were processed yet
   */
  async getLastProcessedBlock(): Promise<number> {
    logger.debug(`Getting last processed block for chain ${this.chainId}`);
    return this.scannerStateRepository.getLastScannedBlock(this.chainId);
  }

  /**
   * Update last processed block number in database
   */
  async updateLastProcessedBlock(blockNumber: number): Promise<void> {
    logger.debug(`Updating last processed block for chain ${this.chainId} to ${blockNumber}`);
    await this.scannerStateRepository.updateLastScannedBlock(this.chainId, blockNumber);
  }
}
