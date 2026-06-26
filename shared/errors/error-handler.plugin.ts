import { AppError } from './app-errors';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const ErrorHandlerPlugin = ({ error, set, request }) => {
  if (error instanceof AppError) {
    set.status = error.statusCode;

    logger.warn(`[${error.code}] ${error.message}`, {
      statusCode: error.statusCode,
      path: request.url,
      stack: error.stack,
    });

    return {
      error: {
        code: error.code,
        message: error.message,
      },
    };
  }

  set.status = 500;

  logger.error('Unexpected error:', {
    path: request.url,
    error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
  });

  return {
    error: {
      code: 'INTERNAL_ERROR',
      message: `${error}`,
    },
  };
};
