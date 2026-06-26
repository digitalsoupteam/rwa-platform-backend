import { SignatureRepository } from '../repositories/signature.repository';
import { SignatureTaskRepository } from '../repositories/signatureTask.repository';
import { SignerClient } from '../clients/signer.client';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';
import { MetricsDecorator } from '@shared/monitoring/src/metricsDecorator';
import { LogDecorator } from '@shared/monitoring/src/logDecorator';
import { setSpanAttributes } from '@shared/monitoring/src/tracing';
import { AppError } from '@shared/errors/app-errors';

export class SignaturesService {
  constructor(
    private readonly signatureRepository: SignatureRepository,
    private readonly signatureTaskRepository: SignatureTaskRepository,
    private readonly signerClient: SignerClient,
  ) {}

  /**
   * Creates a new signatures task
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['data'] })
  async createTask(data: {
    ownerId: string;
    ownerType: string;
    hash: string;
    requiredSignatures: number;
    expired: number;
  }) {
    setSpanAttributes({
      entityId: data.ownerId,
      entityType: data.ownerType,
      hash: data.hash,
    });
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
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['data.taskId', 'data.signer'] })
  async addSignature(data: { taskId: string; signer: string; signature: string }) {
    setSpanAttributes({
      taskId: data.taskId,
      signer: data.signer,
    });
    // Verify task exists and not completed
    const task = await this.signatureTaskRepository.findById(data.taskId);
    if (task.completed) {
      throw new AppError({ message: 'Task already completed', statusCode: 409, code: 'CONFLICT' });
    }
    if (task.expired && task.expired < Math.floor(Date.now() / 1000)) {
      throw new AppError({ message: 'Task expired', statusCode: 410, code: 'EXPIRED' });
    }

    // Add signature
    const signature = await this.signatureRepository.create({
      taskId: data.taskId,
      signer: data.signer,
      signature: data.signature,
    });

    // Check if we have enough signatures
    const signaturesCount = await this.signatureRepository.countByTaskId(data.taskId);
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
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['taskId'] })
  async getSignatureTask(taskId: string) {
    setSpanAttributes({
      taskId: taskId,
    });
    const task = await this.signatureTaskRepository.findById(taskId);

    let signatures = task.completed ? await this.signatureRepository.findByTaskId(taskId) : undefined;

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
