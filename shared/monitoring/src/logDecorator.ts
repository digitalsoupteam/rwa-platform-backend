import { logger } from './monitoring.plugin';
import { camelToSnakeCase } from './decorator-utils';
import { AppError } from '@shared/errors/app-errors';

export interface LogOptions {
	args?: (args: any[]) => Record<string, any>;
}

export function LogDecorator(options?: LogOptions) {
	return function (originalMethod: any, context: ClassMethodDecoratorContext) {
		const methodName = String(context.name);

		return function replacementMethod(this: any, ...args: any[]) {
			const className = camelToSnakeCase(this.constructor.name);
			const fullName = `${className}.${camelToSnakeCase(methodName)}`;
			const logArgs = options?.args ? options.args(args) : undefined;

			logger.debug(`${fullName} — called`, logArgs);

			try {
				const result = originalMethod.apply(this, args);

				if (result && typeof result.then === 'function') {
					return result
						.then((value: any) => {
							logger.debug(`${fullName} — ok`);
							return value;
						})
						.catch((error: any) => {
							if (error instanceof AppError) {
								logger.warn(`${fullName} — failed`, {
									error: error.message,
									code: error.code,
									statusCode: error.statusCode,
								});
							} else {
								logger.error(`${fullName} — system_error`, {
									error: error.message,
									stack: error.stack,
								});
							}
							throw error;
						});
				}

				logger.debug(`${fullName} — ok`);
				return result;
			} catch (error: any) {
				if (error instanceof AppError) {
					logger.warn(`${fullName} — failed`, {
						error: error.message,
						code: error.code,
						statusCode: error.statusCode,
					});
				} else {
					logger.error(`${fullName} — system_error`, {
						error: error.message,
						stack: error.stack,
					});
				}
				throw error;
			}
		};
	};
}
