import { ethers } from 'ethers';
import { randomBytes } from 'crypto';
import { User } from '../models/user.model';
import { logger, metrics, CircuitBreaker, jwtService } from '@rwa-platform/shared/src';

const circuitBreaker = new CircuitBreaker();

const EIP712_DOMAIN = {
  name: 'Trading Platform',
  version: '1',
  chainId: 1,
} as const;

const EIP712_TYPES = {
  EIP712Domain: [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' },
  ],
  Message: [
    { name: 'wallet', type: 'address' },
    { name: 'nonce', type: 'string' },
    { name: 'message', type: 'string' },
  ],
} as const;

export const authController = {
  async getNonce(address: string) {
    try {
      const nonce = randomBytes(32).toString('hex');
      await User.findOneAndUpdate({ address: address.toLowerCase() }, { nonce }, { upsert: true });

      return {
        nonce,
        typedData: {
          domain: EIP712_DOMAIN,
          primaryType: 'Message',
          types: EIP712_TYPES,
          message: {
            wallet: address,
            nonce: nonce,
            message: `Welcome to Trading Platform! Please sign this message to authenticate.\n\nNonce: ${nonce}`,
          },
        },
      };
    } catch (error: any) {
      logger.error(`Failed to generate nonce: ${error.message}`);
      metrics.increment('auth.nonce.error');
      throw error;
    }
  },

  async verifySignature(address: string, signature: string): Promise<string> {
    return await circuitBreaker.execute(async () => {
      try {
        const user = await User.findOne({ address: address.toLowerCase() });
        if (!user) {
          throw new Error('User not found');
        }

        const message = {
          domain: EIP712_DOMAIN,
          types: {
            Message: [
              // Измените Authentication на Message
              { name: 'wallet', type: 'address' },
              { name: 'nonce', type: 'string' },
              { name: 'message', type: 'string' },
            ],
          },
          value: {
            wallet: address,
            nonce: user.nonce,
            message: `Welcome to Trading Platform! Please sign this message to authenticate.\n\nNonce: ${user.nonce}`,
          },
        };

        const recoveredAddress = ethers.verifyTypedData(
          message.domain,
          message.types,
          message.value,
          signature
        );

        if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
          throw new Error('Invalid signature');
        }

        user.nonce = randomBytes(32).toString('hex');
        user.lastLogin = new Date();
        await user.save();

        const token = jwtService.generate(address);
        return token; // Убедимся что токен возвращается
      } catch (error: any) {
        logger.error(`Authentication failed: ${error.message}`);
        metrics.increment('auth.login.failure');
        throw error;
      }
    });
  },
};
