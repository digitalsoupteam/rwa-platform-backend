import { LogMessage } from '../interfaces';
import { SERVICES } from '../constants';

class Logger {
  private service: string;

  constructor(service: string) {
    this.service = service;
  }

  private formatMessage(
    level: LogMessage['level'],
    message: string,
    metadata?: Record<string, any>
  ): LogMessage {
    return {
      service: this.service,
      level,
      message,
      timestamp: new Date().toISOString(),
      metadata,
    };
  }

  info(message: string, metadata?: Record<string, any>) {
    const logMessage = this.formatMessage('info', message, metadata);
    console.log(JSON.stringify(logMessage));
  }

  error(message: string, metadata?: Record<string, any>) {
    const logMessage = this.formatMessage('error', message, metadata);
    console.error(JSON.stringify(logMessage));
  }

  debug(message: string, metadata?: Record<string, any>) {
    const logMessage = this.formatMessage('debug', message, metadata);
    console.debug(JSON.stringify(logMessage));
  }
}

export const logger = new Logger(process.env.SERVICE_NAME || 'unknown');
