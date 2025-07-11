import winston from "winston";
import 'winston-daily-rotate-file';

export class Logger {
  private logger: winston.Logger;
  private readonly serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;

    // Common format for all transports
    const commonFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    );

    this.logger = winston.createLogger({
      level: "debug",
      defaultMeta: {
        service: this.serviceName,
      },
      format: commonFormat,
      transports: [
        // Console transport with colorization
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
        // Rotating file transport for all logs
        new winston.transports.DailyRotateFile({
          dirname: `/var/log/${this.serviceName}`,
          filename: 'combined-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '14d',
          format: commonFormat,
        }),
        // Rotating file transport for error logs
        new winston.transports.DailyRotateFile({
          dirname: `/var/log/${this.serviceName}`,
          filename: 'error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '14d',
          level: 'error',
          format: commonFormat,
        }),
      ],
    });
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.logger.debug(message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.logger.info(message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.logger.warn(message, metadata);
  }

  error(message: string, error?: unknown, metadata?: Record<string, unknown>): void {
    if (error) {
      this.logger.error(message, { ...(metadata || {}), error });
    } else {
      this.logger.error(message, metadata);
    }
  }
}

export const logger = new Logger(process.env.SERVICE_NAME || "unknown-service");
