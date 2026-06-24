import { tracer } from "./tracing";
import { camelToSnakeCase } from "./decorator-utils";
import type { SpanOptions } from '@opentelemetry/api';
import { AppError } from '@shared/errors/app-errors';

export interface TraceOptions {
	name?: string;
	root?: boolean;
}

export function TraceDecorator(options?: TraceOptions) {
	return function (originalMethod: any, context: ClassMethodDecoratorContext) {
		const methodName = String(context.name);

		return function replacementMethod(this: any, ...args: any[]) {
			const className = camelToSnakeCase(this.constructor.name);
			const spanName = options?.name ?? `${className}.${camelToSnakeCase(methodName)}`;

			const spanOptions: SpanOptions = {};
			if (options?.root) spanOptions.root = true;

			return tracer.startActiveSpan(spanName, spanOptions, (span) => {
				try {
					const result = originalMethod.apply(this, args);

					if (result && typeof result.then === 'function') {
						return result
							.then((value: any) => {
								span.end();
								return value;
							})
							.catch((error: any) => {
								span.recordException(error);
								span.setStatus({ code: 2, message: error.message });
								if (error instanceof AppError) {
									span.setAttribute('error.code', error.code);
								}
								span.end();
								throw error;
							});
					}

					span.end();
					return result;
				} catch (error: any) {
					span.recordException(error);
					span.setStatus({ code: 2, message: error.message });
					if (error instanceof AppError) {
						span.setAttribute('error.code', error.code);
					}
					span.end();
					throw error;
				}
			});
		};
	};
}
