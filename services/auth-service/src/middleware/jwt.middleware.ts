import { Elysia } from 'elysia';
import jwt from 'jsonwebtoken';
import { logger, metrics } from '@rwa-platform/shared/src';


const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const jwtMiddleware = new Elysia()
  .derive(({ request }) => {
    return {
      auth: async () => {
        try {
          const token = request.headers.get('authorization')?.split(' ')[1];
          
          if (!token) {
            throw new Error('No token provided');
          }

          const decoded = jwt.verify(token, JWT_SECRET);
          metrics.increment('auth.jwt.success');
          return decoded;
        } catch (error: any) {
          logger.error(`JWT verification failed: ${error.message}`);
          metrics.increment('auth.jwt.failure');
          throw new Error('Invalid token');
        }
      }
    };
  });

export const generateToken = (address: string): string => {
  return jwt.sign({ address }, JWT_SECRET, { expiresIn: '24h' });
};
