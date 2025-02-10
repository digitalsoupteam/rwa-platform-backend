import { ethers } from 'ethers';
import { randomBytes } from 'crypto';
import { User } from '../models/user.model';
import { generateToken } from '../middleware/jwt.middleware';
import { logger, metrics, CircuitBreaker } from '@rwa-platform/shared/src';


const circuitBreaker = new CircuitBreaker();

const EIP712_DOMAIN = {
  name: 'Trading Platform',
  version: '1',
  chainId: 1,
};

export const authController = {
  async getNonce(address: string): Promise<string> {
    try {
      const nonce = randomBytes(32).toString('hex');
      await User.findOneAndUpdate(
        { address: address.toLowerCase() },
        { nonce },
        { upsert: true }
      );
      
      metrics.increment('auth.nonce.generated');
      return nonce;
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
            Authentication: [
              { name: 'address', type: 'address' },
              { name: 'nonce', type: 'string' }
            ]
          },
          value: {
            address: address,
            nonce: user.nonce
          }
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

        // Generate new nonce for next login
        user.nonce = randomBytes(32).toString('hex');
        user.lastLogin = new Date();
        await user.save();

        metrics.increment('auth.login.success');
        return generateToken(address);
      } catch (error: any) {
        logger.error(`Authentication failed: ${error.message}`);
        metrics.increment('auth.login.failure');
        throw error;
      }
    });
  }
};
