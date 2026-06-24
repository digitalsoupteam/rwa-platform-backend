import { logger } from './monitoring.plugin';
import { camelToSnakeCase } from './decorator-utils';
import { AppError } from '@shared/errors/app-errors';

export interface LogOptions {
	args?: string[];
}

/**
 * Extract nested value from object using dot-separated path.
 * Supports both "data.wallet" and "message?.fields?.routingKey" syntax.
 * Skips the first segment (parameter label), extracts the rest from args[i].
 */
function extractNestedValue(obj: any, path: string): any {
	const cleanPath = path.replace(/\?\./g, '.');
	const parts = cleanPath.split('.');
	if (parts.length <= 1) return obj; // no nesting — return as-is

	let value = obj;
	for (let j = 1; j < parts.length; j++) {
		if (value == null) return undefined;
		value = value[parts[j]];
	}
	return value;
}

export function LogDecorator(options?: LogOptions) {
	return function (originalMethod: any, context: ClassMethodDecoratorContext) {
		const methodName = String(context.name);

		return function replacementMethod(this: any, ...args: any[]) {
			const className = camelToSnakeCase(this.constructor.name);
			const fullName = `${className}.${camelToSnakeCase(methodName)}`;
			const logArgs: Record<string, any> = {};
			if (Array.isArray(options?.args) && options.args.length > 0) {
				options.args.forEach((name, i) => {
					if (name.includes('.') || name.includes('?.')) {
						logArgs[name] = extractNestedValue(args[i], name);
					} else {
						logArgs[name] = args[i];
					}
				});
			}

			logger.debug(`${fullName} — called`, Object.keys(logArgs).length ? logArgs : undefined);

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
