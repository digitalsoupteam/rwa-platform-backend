import { logger } from "@shared/monitoring/src/logger";
import { SignersManagerClient } from "../clients/signersManager.client";
import { SignatureService } from "../services/signature.service";

/**
 * Daemon for handling signature requests
 */
export class SignatureDaemon {
  private isRunning: boolean = false;

  constructor(
    private readonly signersManagerClient: SignersManagerClient,
    private readonly signatureService: SignatureService
  ) {}

  /**
   * Initialize daemon
   */
  async initialize(): Promise<void> {
    try {
      logger.info("Initializing Signature Daemon");

      // Start consuming signature requests
      await this.signersManagerClient.consumeRequests(this.handleSignatureRequest.bind(this));

      logger.info("Signature Daemon initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize Signature Daemon:", error);
      throw error;
    }
  }

  /**
   * Handle signature request
   */
  private async handleSignatureRequest(message: any): Promise<void> {
    if (!message) return;

    try {
      const request = JSON.parse(message.content.toString());

      // Validate request
      if (!request.hash || !request.taskId || !request.expired) {
        throw new Error("Invalid signature request format: missing required fields");
      }

      // Validate hash format
      if (!/^0x[0-9a-f]{64}$/i.test(request.hash)) {
        throw new Error("Invalid hash format: must be 32-byte hex string with 0x prefix");
      }

      // Process signature request
      await this.signatureService.signHash(
        request.hash,
        request.taskId,
        request.expired
      );

      // Acknowledge message
      await this.signersManagerClient.ackMessage(message);
      
      logger.info("Successfully processed signature request", {
        taskId: request.taskId
      });
    } catch (error) {
      logger.error("Error processing signature request:", error);
      // Reject message and requeue
      await this.signersManagerClient.nackMessage(message, true);
    }
  }

  /**
   * Start daemon
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("Signature Daemon is already running");
      return;
    }

    this.isRunning = true;
    logger.info("Starting Signature Daemon");
  }

  /**
   * Stop daemon
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn("Signature Daemon is not running");
      return;
    }

    this.isRunning = false;
    logger.info("Stopping Signature Daemon");
  }
}