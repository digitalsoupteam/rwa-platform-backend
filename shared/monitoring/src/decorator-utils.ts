import type { Span } from '@opentelemetry/api';

export function camelToSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

// Per the OTel spec, span.recordException() records only
// exception.type / exception.message / exception.stacktrace and does NOT
// traverse error.cause automatically. So we walk the cause chain manually and
// write each level as a separate prefixed attribute, so the root error is
// visible in the trace UI (e.g. the real fetch error under an AppError wrapper).
export function recordExceptionWithCause(span: Span, error: unknown): void {
  span.recordException(error as Error);

  let current: unknown = (error as Error | undefined)?.cause;
  let depth = 0;
  while (current && depth < 5) {
    const prefix = 'exception.cause' + (depth > 0 ? `.${depth}` : '');
    const err = current as Error;
    span.setAttribute(`${prefix}.type`, err.name ?? 'unknown');
    span.setAttribute(`${prefix}.message`, err.message ?? '');
    if (err.stack) span.setAttribute(`${prefix}.stacktrace`, err.stack);
    current = err.cause;
    depth++;
  }
}

export function getAllMethods(
  prototype: any,
  deep: number = 0,
  privateEnabled: boolean = false,
  exclude: string[] = [],
): string[] {
  const methods = new Set<string>();
  let currentPrototype = prototype;
  let currentDepth = 0;

  while (currentPrototype && currentPrototype !== Object.prototype) {
    if (deep !== -1 && currentDepth > deep) {
      break;
    }

    Object.getOwnPropertyNames(currentPrototype).forEach((name) => {
      if (name === 'constructor') return;
      if (!privateEnabled && name.startsWith('_')) return;
      if (exclude.includes(name)) return;

      const descriptor = Object.getOwnPropertyDescriptor(currentPrototype, name);
      if (descriptor && typeof descriptor.value === 'function') {
        methods.add(name);
      }
    });

    currentPrototype = Object.getPrototypeOf(currentPrototype);
    currentDepth++;
  }

  return Array.from(methods);
}
