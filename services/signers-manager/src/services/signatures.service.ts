import { logger } from "@shared/monitoring/src/logger";
import { SignatureRepository } from "../repositories/signature.repository";
import { SignatureTaskRepository } from "../repositories/signatureTask.repository";
import { SignerClient } from "../clients/signer.client";

export class SignaturesService {
  constructor(
    private readonly signatureRepository: SignatureRepository,
    private readonly signatureTaskRepository: SignatureTaskRepository,
    private readonly signerClient: SignerClient
  ) {}

  /**
   * Creates a new signatures task
   */
  async createTask(data: {
    ownerId: string;
    ownerType: string;
    hash: string;
    requiredSignatures: number;
    expired: number;
  }) {
    logger.debug("Creating new signatures task", { hash: data.hash });

    const task = await this.signatureTaskRepository.create(data);

    // Send signature request to signers
    await this.signerClient.sendSignatureTask({
      hash: data.hash,
      taskId: task._id.toString(),
      expired: data.expired,
    });

    return {
      id: task._id.toString(),
      ownerId: task.ownerId,
      ownerType: task.ownerType,
      hash: task.hash,
      requiredSignatures: task.requiredSignatures,
      expired: task.expired,
      completed: task.completed,
    };
  }

  /**
   * Adds a signature to the task
   */
  async addSignature(data: {
    taskId: string;
    signer: string;
    signature: string;
  }) {
    logger.debug("Adding signature", {
      taskId: data.taskId,
      signer: data.signer,
    });

    // Verify task exists and not completed
    const task = await this.signatureTaskRepository.findById(data.taskId);
    if (task.completed) {
      throw new Error("Task already completed");
    }
    if (task.expired && task.expired < Math.floor(Date.now() / 1000)) {
      throw new Error("Task expired");
    }

    // Add signature
    const signature = await this.signatureRepository.create({
      taskId: data.taskId,
      signer: data.signer,
      signature: data.signature,
    });

    // Check if we have enough signatures
    const signaturesCount = await this.signatureRepository.countByTaskId(
      data.taskId
    );
    const isCompleted = signaturesCount >= task.requiredSignatures;

    // Update task status if completed
    if (isCompleted) {
      await this.signatureTaskRepository.update(data.taskId, {
        completed: true,
      });
    }

    return {
      signature: {
        id: signature._id.toString(),
        taskId: signature.taskId,
        signer: signature.signer,
        signature: signature.signature,
      },
      isCompleted,
    };
  }

  /**
   * Gets task with its signatures
   */
  async getSignatureTask(taskId: string) {
    logger.debug("Getting task with signatures", { taskId });

    const task = await this.signatureTaskRepository.findById(taskId);

    let signatures = task.completed
      ? await this.signatureRepository.findByTaskId(taskId)
      : undefined;

    return {
      id: task._id.toString(),
      ownerId: task.ownerId,
      ownerType: task.ownerType,
      hash: task.hash,
      requiredSignatures: task.requiredSignatures,
      expired: task.expired,
      completed: task.completed,
      signatures: signatures?.map((sig) => ({
        signer: sig.signer,
        signature: sig.signature,
      })),
    };
  }
}
