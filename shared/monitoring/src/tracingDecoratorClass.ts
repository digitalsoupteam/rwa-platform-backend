import { getAllMethods } from "./decorator-utils";
import { tracer } from "./tracing";
import { AppError } from "@shared/errors/app-errors";


function camelToSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

interface TracingDecoratorOptions {
  prefix?: string;
  deep?: number;
  privateEnabled?: boolean;
  exclude?: string[];
}


export function TracingDecoratorClass(options?: string | TracingDecoratorOptions) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    return class extends constructor {
      constructor(...args: any[]) {
        super(...args);
        
        let prefix: string | undefined;
        let deep: number = 0;
        let privateEnabled: boolean = false;
        let exclude: string[] = [];

        if (typeof options === 'string') {
          prefix = options;
        } else if (options) {
          prefix = options.prefix;
          deep = options.deep ?? 0;
          privateEnabled = options.privateEnabled ?? false;
          exclude = options.exclude ?? [];
        }

        const spanPrefix = prefix || camelToSnakeCase(constructor.name);
        
        const methodNames = getAllMethods(constructor.prototype, deep, privateEnabled, exclude);

        console.log(`Methods (deep: ${deep}, private: ${privateEnabled}, excluded: ${exclude.join(', ')}):`, methodNames)
        methodNames.forEach(methodName => {
          const originalMethod = (this as any)[methodName];
          
          if (typeof originalMethod === 'function') {
            (this as any)[methodName] = function (...args: any[]) {
              const spanName = `${spanPrefix}.${methodName}`;
              
              return tracer.startActiveSpan(spanName, (span) => {
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
          }
        });
      }
    };
  };
}
