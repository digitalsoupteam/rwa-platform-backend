import { metrics } from './monitoring';

interface LogMetadata {
  [key: string]: any;
}

class StructuredLogger {
  private service: string;

  constructor(service: string) {
    this.service = service;
  }

  private formatMessage(level: string, message: string, metadata?: LogMetadata) {
    const timestamp = new Date().toISOString();
    return {
      timestamp,
      service: this.service,
      level,
      message,
      ...metadata,
    };
  }

  info(message: string, metadata?: LogMetadata) {
    console.log(JSON.stringify(this.formatMessage('info', message, metadata)));
    // Track info messages in metrics
    metrics.increment('log_messages_total', { level: 'info', service: this.service });
  }

  error(message: string, metadata?: LogMetadata) {
    console.error(JSON.stringify(this.formatMessage('error', message, metadata)));
    // Track errors in metrics
    metrics.increment('log_messages_total', { level: 'error', service: this.service });
    metrics.increment('error_total', { service: this.service, ...metadata });
  }

  debug(message: string, metadata?: LogMetadata) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(JSON.stringify(this.formatMessage('debug', message, metadata)));
      metrics.increment('log_messages_total', { level: 'debug', service: this.service });
    }
  }
}

// Export a singleton instance
export const logger = new StructuredLogger(process.env.SERVICE_NAME || 'unknown');
