import { ethers } from 'ethers';
import { logger } from '@shared/monitoring/src/logger';
import { BlockchainError, AppError } from '@shared/errors/app-errors';
import { TracingDecorator } from '@shared/monitoring/src/tracingDecorator';

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function transfer(address to, uint amount) returns (bool)",
  "function transferFrom(address from, address to, uint amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint amount)"
];

/**
 * Client for blockchain interaction
 */
@TracingDecorator()
export class BlockchainClient {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private initialized: boolean = false;
  private currentNonce: number = 0;

  constructor(
    providerUrl: string,
    walletPrivateKey: string,
  ) {
    this.provider = new ethers.JsonRpcProvider(providerUrl);
    this.wallet = new ethers.Wallet(walletPrivateKey, this.provider);
  }

  /**
   * Initialize client and verify blockchain connection
   */
  async initialize(): Promise<void> {
    try {
      const network = await this.provider.getNetwork();
      logger.info(`Connected to blockchain network: chainId ${network.chainId}`);
      
      const balance = await this.provider.getBalance(this.wallet.address);
      const balanceEth = ethers.formatEther(balance);
      
      logger.info(`Faucet wallet ${this.wallet.address} balance: ${balanceEth} ETH`);
      
      
      this.currentNonce = await this.provider.getTransactionCount(this.wallet.address);
      logger.info(`Initial nonce: ${this.currentNonce}`);
      
      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize blockchain client', error);
      this.initialized = false;
      throw new BlockchainError(
        'Failed to initialize blockchain client',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Send native tokens (ETH/MATIC) to recipient
   */
  async transferToken(recipientAddress: string, amount: string): Promise<string> {
    if (!this.initialized) {
      throw new BlockchainError('Blockchain client is not initialized');
    }
    
    try {
      if (!ethers.isAddress(recipientAddress)) {
        throw new AppError(`Invalid recipient address: ${recipientAddress}`);
      }
      
      const amountInWei = ethers.parseEther(amount);
      
      const balance = await this.provider.getBalance(this.wallet.address);
      if (balance < amountInWei) {
        throw new BlockchainError('Insufficient funds in faucet wallet');
      }
      
      
      const nonce = this.currentNonce++;
      
      const tx = await this.wallet.sendTransaction({
        to: recipientAddress,
        value: amountInWei,
        nonce: nonce
      });
      
      logger.info(`Sent ${amount} native tokens to ${recipientAddress}, txHash: ${tx.hash}`);
      
      const receipt = await tx.wait();
      
      if (receipt && receipt.status === 0) {
        throw new BlockchainError('Transaction failed');
      }
      
      return tx.hash;
    } catch (error) {
      logger.error(`Error sending native tokens to ${recipientAddress}:`, error);
      
      if (error instanceof AppError || error instanceof BlockchainError) {
        throw error;
      }
      
      throw new BlockchainError(
        `Error sending native tokens: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Send ERC20 tokens to recipient
   */
  async transferERC20Token(tokenAddress: string, recipientAddress: string, amount: string): Promise<string> {
    if (!this.initialized) {
      throw new BlockchainError('Blockchain client is not initialized');
    }
    
    try {
      if (!ethers.isAddress(recipientAddress)) {
        throw new AppError(`Invalid recipient address: ${recipientAddress}`);
      }
      
      if (!ethers.isAddress(tokenAddress)) {
        throw new AppError(`Invalid token address: ${tokenAddress}`);
      }
      
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ERC20_ABI,
        this.wallet
      );
      
      const decimals = await tokenContract.decimals();
      const tokenAmount = ethers.parseUnits(amount, decimals);
      
      const balance = await tokenContract.balanceOf(this.wallet.address);
      if (balance < tokenAmount) {
        throw new BlockchainError('Insufficient token balance in faucet wallet');
      }
      
      
      const nonce = this.currentNonce++;
      
      const tx = await tokenContract.transfer(recipientAddress, tokenAmount, {
        gasLimit: 300000,
        nonce: nonce
      });
      
      logger.info(`Sent ${amount} tokens to ${recipientAddress}, txHash: ${tx.hash}`);
      
      const receipt = await tx.wait();
      
      if (receipt && receipt.status === 0) {
        throw new BlockchainError('Transaction failed');
      }
      
      return tx.hash;
    } catch (error) {
      logger.error(`Error sending tokens to ${recipientAddress}:`, error);
      
      if (error instanceof AppError || error instanceof BlockchainError) {
        throw error;
      }
      
      throw new BlockchainError(
        `Error sending tokens: ${error instanceof Error ? error.message : String(error)}`
      );
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