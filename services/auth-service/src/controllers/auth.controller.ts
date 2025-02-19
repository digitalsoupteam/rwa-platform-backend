import { TypedDataField, verifyTypedData } from 'ethers';
import { randomBytes } from 'crypto';
import { User } from '../models/user.model';
import { logger, metrics, CircuitBreaker, jwtService } from '@rwa-platform/shared/src';

const circuitBreaker = new CircuitBreaker();

const DOMAIN = {
  name: 'RWA Platform',
  version: '1',
  chainId: 1,
};

const TYPES: Record<string, TypedDataField[]> = {
  Auth: [
    { name: 'wallet', type: 'address' },
    { name: 'nonce', type: 'string' },
    { name: 'message', type: 'string' }
  ]
};

export const authController = {
  async getAuthMessage(address: string) {
    try {
      const nonce = randomBytes(32).toString('hex');
      await User.findOneAndUpdate(
        { address: address.toLowerCase() },
        { nonce },
        { upsert: true }
      );

      return {
        domain: DOMAIN,
        types: TYPES,
        primaryType: 'Auth',
        message: {
          wallet: address,
          nonce,
          message: `Welcome to RWA Platform!\n\nWe prioritize the security of your assets and personal data. To ensure secure access to your account, we kindly request you to verify ownership of your wallet by signing this message.\n\n`
        }
      };
    } catch (error: any) {
      logger.error(`Failed to generate auth message: ${error.message}`);
      metrics.increment('auth.message.error');
      throw error;
    }
  },

  async verifySignature(address: string, signature: string): Promise<{ token: string }> {
    return await circuitBreaker.execute(async () => {
      try {
        const user = await User.findOne({ address: address.toLowerCase() });
        if (!user) {
          throw new Error('User not found');
        }

        const typedData = {
          domain: DOMAIN,
          types: TYPES,
          message: {
            wallet: address,
            nonce: user.nonce,
            message: `Welcome to RWA Platform!\n\nWe prioritize the security of your assets and personal data. To ensure secure access to your account, we kindly request you to verify ownership of your wallet by signing this message.\n\n`
          }
        };

        try {
          const recoveredAddress = verifyTypedData(
            typedData.domain,
            typedData.types,
            typedData.message,
            signature
          );

          if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
            throw new Error('Invalid signature');
          }

          // Update nonce and last login after successful verification
          user.nonce = randomBytes(32).toString('hex');
          user.lastLogin = new Date();
          await user.save();

          const token = jwtService.generate(address);
          if (!token) {
            throw new Error('Failed to generate token');
          }

          return { token };
        } catch (error: any) {
          logger.error(`Signature verification failed: ${error.message}`);
          throw new Error('Invalid signature or failed to verify');
        }
      } catch (error: any) {
        logger.error(`Authentication failed: ${error.message}`);
        metrics.increment('auth.login.failure');
        throw error;
      }
    });
  },
};
