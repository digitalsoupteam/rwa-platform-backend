import { logger } from "@shared/monitoring/src/logger";
import { SignerClient } from "../clients/signer.client";
import { SignaturesService } from "../services/signatures.service";
import type { ConsumeMessage } from "amqplib";

interface SignatureResponse {
  signer: string;
  hash: string;
  signature: string;
  taskId: string;
}

/**
 * Daemon for handling signature responses from signer service
 */
export class TaskResponsesDaemon {
  private initialized: boolean = false;

  constructor(
    private readonly signerClient: SignerClient,
    private readonly signaturesService: SignaturesService
  ) {}

  /**
   * Initialize daemon and start consuming messages
   */
  async initialize(): Promise<void> {
    try {
      logger.info("Initializing Task Responses Daemon");

      // Start consuming messages
      await this.signerClient.consumeResponses(this.handleResponse.bind(this));

      this.initialized = true;
      logger.info("Task Responses Daemon initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize Task Responses Daemon:", error);
      throw error;
    }
  }

  /**
   * Handle signature response
   */
  private async handleResponse(message: ConsumeMessage | null): Promise<void> {
    if (!message) return;

    try {
      const response = JSON.parse(message.content.toString()) as SignatureResponse;

      // Validate response
      if (!response.signer || !response.hash || !response.signature || !response.taskId) {
        throw new Error("Invalid signature response format");
      }

      // Add signature to task
      await this.signaturesService.addSignature({
        taskId: response.taskId,
        signer: response.signer,
        signature: response.signature
      });

      // Acknowledge message
      await this.signerClient.ackMessage(message);
    } catch (error) {
      logger.error("Error processing signature response:", error);
      // Reject message without requeue as we can't process it
      await this.signerClient.nackMessage(message, false);
    }
  }
}