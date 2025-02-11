import { Elysia } from 'elysia';
import { logger, metrics, jwtService } from '@rwa-platform/shared/src';

const PUBLIC_PATHS = ['/auth/nonce', '/auth/verify', '/health', '/metrics'];

export const createAuthHandler = (request: Request) => {
  return async () => {
    try {
      const token = request.headers.get('authorization')?.split(' ')[1];

      if (!token) {
        throw new Error('No token provided');
      }

      const decoded = jwtService.verify(token);
      metrics.increment('gateway.auth.success');
      return decoded;
    } catch (error: any) {
      logger.error(`Gateway authentication failed: ${error.message}`);
      metrics.increment('gateway.auth.failure');
      throw new Error('Unauthorized');
    }
  };
};

export const authMiddleware = new Elysia().derive(({ request }) => {
  const path = new URL(request.url).pathname;

  if (PUBLIC_PATHS.includes(path)) {
    return {};
  }

  return {
    auth: createAuthHandler(request),
  };
});
