import { logger } from './monitoring.plugin';
import { AppError } from '@shared/errors/app-errors';

export interface WithLogOptions {
  name: string;
  args?: string[];
}

export function withLog<T extends (...args: any[]) => any>(options: WithLogOptions, fn: T): T {
  return ((...args: Parameters<T>): ReturnType<T> => {
    const logArgs: Record<string, any> = {};
    if (options.args) {
      options.args.forEach((name, i) => {
        logArgs[name] = args[i];
      });
    }

    logger.debug(`${options.name} — called`, Object.keys(logArgs).length ? logArgs : undefined);

    try {
      const result = fn(...args);

      if (result && typeof result.then === 'function') {
        return result
          .then((value: any) => {
            logger.debug(`${options.name} — ok`);
            return value;
          })
          .catch((error: any) => {
            if (error instanceof AppError) {
              logger.warn(`${options.name} — failed`, {
                error: error.message,
                code: error.code,
                statusCode: error.statusCode,
              });
            } else {
              logger.error(`${options.name} — system_error`, {
                error: error.message,
                stack: error.stack,
              });
            }
            throw error;
          }) as any;
      }

      logger.debug(`${options.name} — ok`);
      return result;
    } catch (error: any) {
      if (error instanceof AppError) {
        logger.warn(`${options.name} — failed`, {
          error: error.message,
          code: error.code,
          statusCode: error.statusCode,
        });
      } else {
        logger.error(`${options.name} — system_error`, {
          error: error.message,
          stack: error.stack,
        });
      }
      throw error;
    }
  }) as T;
}
