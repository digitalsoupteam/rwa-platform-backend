import type { Span } from '@opentelemetry/api';

export function camelToSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

// OTel span.recordException() по спецификации записывает только
// exception.type / exception.message / exception.stacktrace и НЕ обходит
// error.cause автоматически. Поэтому обходим cause вручную и пишем каждый
// уровень как отдельные атрибуты с префиксом, чтобы в UI трейса был виден
// корневой error (например реальная ошибка fetch под AppError-обёрткой).
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
