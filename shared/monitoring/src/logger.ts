import { logs } from '@opentelemetry/api-logs';
import { trace } from '@opentelemetry/api';


export class OTelLogger {
  private otelLogger: any;
  private readonly serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.otelLogger = logs.getLogger(this.serviceName, '1.0.0');
  }

  debug(message: string, attributes?: Record<string, any>): void {
    this.emit('DEBUG', 5, message, attributes);
  }

  info(message: string, attributes?: Record<string, any>): void {
    this.emit('INFO', 9, message, attributes);
  }

  warn(message: string, attributes?: Record<string, any>): void {
    this.emit('WARN', 13, message, attributes);
  }

  error(message: string, error?: unknown, attributes?: Record<string, any>): void {
    const errorAttributes = {
      ...(attributes || {}),
      ...(error ? {
        error: error instanceof Error
          ? error.message
          : typeof error === 'object'
            ? JSON.stringify(error)
            : String(error),
        ...(error instanceof Error && {
          errorName: error.name,
          errorStack: error.stack,
        })
      } : {}),
    };
    this.emit('ERROR', 17, message, errorAttributes);
  }

  private emit(severityText: string, severityNumber: number, message: string, attributes?: Record<string, any>): void {
    const span = trace.getActiveSpan();
    const logRecord = {
      severityText,
      severityNumber,
      body: message,
      attributes: {
        service: this.serviceName,
        ...attributes,
        ...(span && {
          traceId: span.spanContext().traceId,
          spanId: span.spanContext().spanId,
        }),
      },
    };
    
    this.otelLogger.emit(logRecord);
  }
}
console.log(JSON.stringify(process.env, null, 4))
export const logger = new OTelLogger(process.env.SERVICE_NAME || "unknown-service3");