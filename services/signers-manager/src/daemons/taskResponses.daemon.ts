import { SignerClient } from "../clients/signer.client";
import { SignaturesService } from "../services/signatures.service";
import type { ConsumeMessage } from "amqplib";
import { TraceDecorator } from "@shared/monitoring/src/traceDecorator";
import { MetricsDecorator } from "@shared/monitoring/src/metricsDecorator";
import { LogDecorator } from "@shared/monitoring/src/logDecorator";
import { AppError } from "@shared/errors/app-errors";

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
  constructor(
    private readonly signerClient: SignerClient,
    private readonly signaturesService: SignaturesService
  ) {}

  /**
   * Initialize daemon and start consuming messages
   */
  @TraceDecorator()
  async initialize(): Promise<void> {
    try {
      // Start consuming messages
      await this.signerClient.consumeResponses(this.handleResponse.bind(this));

      // initialized
    } catch (error) {
      throw error;
    }
  }

  /**
   * Handle signature response
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ["message?.fields?.routingKey"] })
  private async handleResponse(message: ConsumeMessage | null): Promise<void> {
    if (!message) return;

    try {
      const response = JSON.parse(message.content.toString()) as SignatureResponse;

      // Validate response
      if (!response.signer || !response.hash || !response.signature || !response.taskId) {
        throw new AppError({ message: "Invalid signature response format", statusCode: 400, code: "VALIDATION_ERROR" });
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
      // Reject message without requeue as we can't process it
      await this.signerClient.nackMessage(message, false);
    }
  }
}
