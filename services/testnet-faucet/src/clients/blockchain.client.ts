import { ethers } from 'ethers';
import { AppError } from '@shared/errors/app-errors';
import { TracingDecoratorClass } from '@shared/monitoring/src/tracingDecoratorClass';
import { LogDecorator } from '@shared/monitoring/src/logDecorator';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function transfer(address to, uint amount) returns (bool)',
  'function transferFrom(address from, address to, uint amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint amount)',
];

/**
 * Client for blockchain interaction
 */
@TracingDecoratorClass()
export class BlockchainClient {
  #provider: ethers.JsonRpcProvider;
  #wallet: ethers.Wallet;
  private initialized: boolean = false;
  private currentNonce: number = 0;

  constructor(providerUrl: string, walletPrivateKey: string) {
    this.#provider = new ethers.JsonRpcProvider(providerUrl);
    this.#wallet = new ethers.Wallet(walletPrivateKey, this.#provider);
  }

  /**
   * Initialize client and verify blockchain connection
   */
  async initialize(): Promise<void> {
    try {
      const network = await this.#provider.getNetwork();
      logger.info(`Connected to blockchain network: chainId ${network.chainId}`);

      const balance = await this.#provider.getBalance(this.#wallet.address);
      const balanceEth = ethers.formatEther(balance);

      logger.info(`Faucet wallet ${this.#wallet.address} balance: ${balanceEth} ETH`);

      this.currentNonce = await this.#provider.getTransactionCount(this.#wallet.address);
      logger.info(`Initial nonce: ${this.currentNonce}`);

      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize blockchain client', error);
      this.initialized = false;
      throw new AppError({
        message: 'Failed to initialize blockchain client',
        statusCode: 502,
        code: 'BLOCKCHAIN_ERROR',
        cause: error,
      });
    }
  }

  /**
   * Send native tokens (ETH/MATIC) to recipient
   */
  @LogDecorator({ args: ['recipientAddress', 'amount'] })
  async transferToken(recipientAddress: string, amount: string): Promise<string> {
    if (!this.initialized) {
      throw new AppError({
        message: 'Blockchain client is not initialized',
        statusCode: 502,
        code: 'BLOCKCHAIN_ERROR',
      });
    }

    try {
      if (!ethers.isAddress(recipientAddress)) {
        throw new AppError({
          message: `Invalid recipient address: ${recipientAddress}`,
          statusCode: 400,
          code: 'VALIDATION_ERROR',
        });
      }

      const amountInWei = ethers.parseEther(amount);

      const balance = await this.#provider.getBalance(this.#wallet.address);
      if (balance < amountInWei) {
        throw new AppError({
          message: 'Insufficient funds in faucet wallet',
          statusCode: 502,
          code: 'BLOCKCHAIN_ERROR',
        });
      }

      const nonce = this.currentNonce++;

      const tx = await this.#wallet.sendTransaction({
        to: recipientAddress,
        value: amountInWei,
        nonce: nonce,
      });

      const receipt = await tx.wait();

      if (receipt && receipt.status === 0) {
        throw new AppError({
          message: 'Transaction failed',
          statusCode: 502,
          code: 'BLOCKCHAIN_ERROR',
        });
      }

      return tx.hash;
    } catch (error) {
      logger.error(`Error sending native tokens to ${recipientAddress}:`, error);

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError({
        message: 'Error sending native tokens',
        statusCode: 502,
        code: 'BLOCKCHAIN_ERROR',
        cause: error,
      });
    }
  }

  /**
   * Send ERC20 tokens to recipient
   */
  @LogDecorator({ args: ['tokenAddress', 'recipientAddress', 'amount'] })
  async transferERC20Token(tokenAddress: string, recipientAddress: string, amount: string): Promise<string> {
    if (!this.initialized) {
      throw new AppError({
        message: 'Blockchain client is not initialized',
        statusCode: 502,
        code: 'BLOCKCHAIN_ERROR',
      });
    }

    try {
      if (!ethers.isAddress(recipientAddress)) {
        throw new AppError({
          message: `Invalid recipient address: ${recipientAddress}`,
          statusCode: 400,
          code: 'VALIDATION_ERROR',
        });
      }

      if (!ethers.isAddress(tokenAddress)) {
        throw new AppError({
          message: `Invalid token address: ${tokenAddress}`,
          statusCode: 400,
          code: 'VALIDATION_ERROR',
        });
      }

      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.#wallet);

      const decimals = await tokenContract.decimals();
      const tokenAmount = ethers.parseUnits(amount, decimals);

      const balance = await tokenContract.balanceOf(this.#wallet.address);
      if (balance < tokenAmount) {
        throw new AppError({
          message: 'Insufficient token balance in faucet wallet',
          statusCode: 502,
          code: 'BLOCKCHAIN_ERROR',
        });
      }

      const nonce = this.currentNonce++;

      const tx = await tokenContract.transfer(recipientAddress, tokenAmount, {
        gasLimit: 300000,
        nonce: nonce,
      });

      const receipt = await tx.wait();

      if (receipt && receipt.status === 0) {
        throw new AppError({
          message: 'Transaction failed',
          statusCode: 502,
          code: 'BLOCKCHAIN_ERROR',
        });
      }

      return tx.hash;
    } catch (error) {
      logger.error(`Error sending tokens to ${recipientAddress}:`, error);

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError({
        message: 'Error sending tokens',
        statusCode: 502,
        code: 'BLOCKCHAIN_ERROR',
        cause: error,
      });
    }
  }

  /**
   * Properly shutdown the client
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down blockchain client');
    this.initialized = false;
  }
}
