import { logger } from "@shared/monitoring/src/logger";
import { AppError } from "@shared/errors/app-errors";
import { FaucetRequestRepository } from "../repositories/faucetRequest.repository";
import { BlockchainClient } from "../clients/blockchain.client";
import { TracingDecorator } from "@shared/monitoring/src/tracingDecorator";

@TracingDecorator()
export class FaucetService {
  constructor(
    private readonly faucetRequestRepository: FaucetRequestRepository,
    private readonly blockchainClient: BlockchainClient,
    private readonly holdTokenAddress: string,
    private readonly platformTokenAddress: string,
    private readonly gasTokenAmount: number,
    private readonly holdTokenAmount: number,
    private readonly platformTokenAmount: number,
    private readonly requestGasDelay: number,
    private readonly requestHoldDelay: number,
    private readonly requestPlatformDelay: number
  ) {}

  /**
   * Gets request history for a user with pagination
   */
  async getRequestHistory(data: {
    userId: string;
    limit?: number;
    offset?: number;
  }) {
    logger.debug("Getting request history", { userId: data.userId });

    const { userId, limit = 50, offset = 0 } = data;

    if (limit > 100) {
      throw new AppError("Limit cannot exceed 100");
    }

    if (offset < 0) {
      throw new AppError("Offset cannot be negative");
    }

    const results = await this.faucetRequestRepository.findAll(
      { userId },
      { limit, offset, sort: { createdAt: 'asc' } }
    );

    return results.map((result) => ({
      id: result._id.toString(),
      userId: result.userId,
      wallet: result.wallet,
      tokenType: result.tokenType,
      amount: result.amount,
      transactionHash: result.transactionHash,
      createdAt: (result as any).createdAt as number,
    }));
  }

  /**
   * Gets unlock time for next token requests
   */
  async getTokenUnlockTime(data: { userId: string }) {
    logger.debug("Getting token unlock time", { userId: data.userId });

    const [lastGasRequest, lastHoldRequest, lastPlatformRequest] = await Promise.all([
      this.faucetRequestRepository.findAll(
        { userId: data.userId, tokenType: "gas" },
        { limit: 1, sort: { createdAt: 'asc' } }
      ),
      this.faucetRequestRepository.findAll(
        { userId: data.userId, tokenType: "hold" },
        { limit: 1, sort: { createdAt: 'asc' } }
      ),
      this.faucetRequestRepository.findAll(
        { userId: data.userId, tokenType: "platform" },
        { limit: 1, sort: { createdAt: 'asc' } }
      ),
    ]);

    const currentTime = Math.floor(Date.now() / 1000);

    return {
      gasUnlockTime: lastGasRequest[0] ? currentTime + this.requestGasDelay : 0,
      holdUnlockTime: lastHoldRequest[0]
        ? currentTime + this.requestHoldDelay
        : 0,
      platformUnlockTime: lastPlatformRequest[0]
        ? currentTime + this.requestPlatformDelay
        : 0,
    };
  }

  /**
   * Requests gas tokens to be sent to a wallet
   */
  async requestGasToken(data: {
    userId: string;
    wallet: string;
    amount: number;
  }) {
    logger.debug("Processing gas request", data);

    const transferAmount =
      data.amount > this.gasTokenAmount ? this.gasTokenAmount : data.amount;

    // Use configured gas amount
    const txHash = await this.blockchainClient.transferToken(
      data.wallet,
      `${transferAmount}`
    );

    const result = await this.faucetRequestRepository.create({
      userId: data.userId,
      wallet: data.wallet,
      tokenType: "gas",
      amount: transferAmount,
      transactionHash: txHash,
    });

    return {
      id: result._id.toString(),
      userId: result.userId,
      wallet: result.wallet,
      tokenType: result.tokenType,
      amount: result.amount,
      transactionHash: result.transactionHash,
      createdAt: (result as any).createdAt as number,
    };
  }

  /**
   * Requests HOLD tokens to be sent to a wallet
   */
  async requestHoldToken(data: {
    userId: string;
    wallet: string;
    amount: number;
  }) {
    logger.debug("Processing HOLD token request", data);

    const transferAmount =
      data.amount > this.holdTokenAmount ? this.holdTokenAmount : data.amount;

    // Use configured hold token address and amount
    const txHash = await this.blockchainClient.transferERC20Token(
      this.holdTokenAddress,
      data.wallet,
      `${transferAmount}`
    );

    const result = await this.faucetRequestRepository.create({
      userId: data.userId,
      wallet: data.wallet,
      tokenType: "hold",
      amount: transferAmount,
      transactionHash: txHash,
    });

    return {
      id: result._id.toString(),
      userId: result.userId,
      wallet: result.wallet,
      tokenType: result.tokenType,
      amount: result.amount,
      transactionHash: result.transactionHash,
      createdAt: (result as any).createdAt as number,
    };
  }

  /**
   * Requests PLATFORM tokens to be sent to a wallet
   */
  async requestPlatformToken(data: {
    userId: string;
    wallet: string;
    amount: number;
  }) {
    logger.debug("Processing PLATFORM token request", data);

    const transferAmount =
      data.amount > this.platformTokenAmount ? this.platformTokenAmount : data.amount;

    // Use configured platform token address and amount
    const txHash = await this.blockchainClient.transferERC20Token(
      this.platformTokenAddress,
      data.wallet,
      `${transferAmount}`
    );

    const result = await this.faucetRequestRepository.create({
      userId: data.userId,
      wallet: data.wallet,
      tokenType: "platform",
      amount: transferAmount,
      transactionHash: txHash,
    });

    return {
      id: result._id.toString(),
      userId: result.userId,
      wallet: result.wallet,
      tokenType: result.tokenType,
      amount: result.amount,
      transactionHash: result.transactionHash,
      createdAt: (result as any).createdAt as number,
    };
  }
}
