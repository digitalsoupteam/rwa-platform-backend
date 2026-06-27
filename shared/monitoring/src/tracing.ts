import { trace, SpanStatusCode } from '@opentelemetry/api';
import type { Span } from '@opentelemetry/api';
import { AppError } from '@shared/errors/app-errors';
import { recordExceptionWithCause } from './decorator-utils';

export const tracer = trace.getTracer(String(process.env.SERVICE_NAME), '1.0.0');

/** Находит активный span (если есть) и устанавливает на него атрибуты. Ничего не делает если span нет. */
export function setSpanAttributes(attributes: Record<string, string | number | boolean>): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttributes(attributes);
  }
}

export interface SpanContext {
  span: Span;
  setAttributes: (attributes: Record<string, string | number | boolean>) => void;
  setStatus: (status: { code: SpanStatusCode; message?: string }) => void;
  addEvent: (name: string, attributes?: Record<string, string | number | boolean>) => void;
  end: () => void;
}

export function withTraceSync<T>(spanName: string, fn: (ctx: SpanContext) => T): T;
export function withTraceSync<T>(
  spanName: string,
  attributes: Record<string, string | number | boolean>,
  fn: (ctx: SpanContext) => T,
): T;
export function withTraceSync<T>(
  spanName: string,
  attributesOrFn: Record<string, string | number | boolean> | ((ctx: SpanContext) => T),
  fn?: (ctx: SpanContext) => T,
): T {
  const actualFn = typeof attributesOrFn === 'function' ? attributesOrFn : fn!;
  const attributes = typeof attributesOrFn === 'object' ? attributesOrFn : undefined;

  return tracer.startActiveSpan(spanName, (span) => {
    let spanEnded = false;

    if (attributes) {
      span.setAttributes(attributes);
    }

    const spanContext: SpanContext = {
      span,
      setAttributes: (attrs) => span.setAttributes(attrs),
      setStatus: (status) => span.setStatus(status),
      addEvent: (name, attrs) => span.addEvent(name, attrs),
      end: () => {
        if (!spanEnded) {
          spanEnded = true;
          span.end();
        } else {
          throw new AppError({
            message: 'Span already ended',
            statusCode: 500,
            code: 'INTERNAL_ERROR',
          });
        }
      },
    };

    try {
      const result = actualFn(spanContext);
      if (!spanEnded) {
        span.setStatus({ code: SpanStatusCode.OK });
      }
      return result;
    } catch (error) {
      if (!spanEnded) {
        recordExceptionWithCause(span, error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        if (error instanceof AppError) {
          span.setAttribute('error.code', error.code);
        }
      }
      throw error;
    } finally {
      if (!spanEnded) {
        span.end();
      }
    }
  });
}

export function withTraceAsync<T>(spanName: string, fn: (ctx: SpanContext) => Promise<T>): Promise<T>;
export function withTraceAsync<T>(
  spanName: string,
  attributes: Record<string, string | number | boolean>,
  fn: (ctx: SpanContext) => Promise<T>,
): Promise<T>;
export async function withTraceAsync<T>(
  spanName: string,
  attributesOrFn: Record<string, string | number | boolean> | ((ctx: SpanContext) => Promise<T>),
  fn?: (ctx: SpanContext) => Promise<T>,
): Promise<T> {
  const actualFn = typeof attributesOrFn === 'function' ? attributesOrFn : fn!;
  const attributes = typeof attributesOrFn === 'object' ? attributesOrFn : undefined;

  return tracer.startActiveSpan(spanName, async (span) => {
    let spanEnded = false;

    if (attributes) {
      span.setAttributes(attributes);
    }

    const spanContext: SpanContext = {
      span,
      setAttributes: (attrs) => span.setAttributes(attrs),
      setStatus: (status) => span.setStatus(status),
      addEvent: (name, attrs) => span.addEvent(name, attrs),
      end: () => {
        if (!spanEnded) {
          spanEnded = true;
          span.end();
        } else {
          throw new AppError({
            message: 'Span already ended',
            statusCode: 500,
            code: 'INTERNAL_ERROR',
          });
        }
      },
    };

    try {
      const result = await actualFn(spanContext);
      if (!spanEnded) {
        span.setStatus({ code: SpanStatusCode.OK });
      }
      return result;
    } catch (error) {
      if (!spanEnded) {
        recordExceptionWithCause(span, error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        if (error instanceof AppError) {
          span.setAttribute('error.code', error.code);
        }
      }
      throw error;
    } finally {
      if (!spanEnded) {
        span.end();
      }
    }
  });
}
