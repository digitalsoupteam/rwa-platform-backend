
export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 500,
    public readonly code: string = "INTERNAL_ERROR",
    public readonly details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}


export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}


export class AuthenticationError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(message, 401, "AUTHENTICATION_ERROR");
  }
}


export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super(message, 403, "FORBIDDEN_ERROR");
  }
}


export class NotFoundError extends AppError {
  constructor(entity: string, id?: string) {
    const message = id
      ? `${entity} with id ${id} not found`
      : `${entity} not found`;
    super(message, 404, "NOT_FOUND_ERROR");
  }
}


export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT_ERROR");
  }
}


export class RateLimitError extends AppError {
  constructor(message: string, timeRemaining?: number) {
    const details = timeRemaining ? { timeRemaining } : undefined;
    super(message, 429, "RATE_LIMIT_ERROR", details);
  }
}


export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, details?: any) {
    super(
      `${service} service error: ${message}`,
      502,
      "EXTERNAL_SERVICE_ERROR",
      details
    );
  }
}


export class BlockchainError extends AppError {
  constructor(message: string, details?: any) {
    super(`Blockchain error: ${message}`, 502, "BLOCKCHAIN_ERROR", details);
  }
}


export class RabbitMQError extends AppError {
  constructor(message: string, details?: any) {
    super(`RabbitMQ error: ${message}`, 502, "RABBITMQ_ERROR", details);
  }
}


export class InvalidSignatureError extends AppError {
  constructor(wallet: string) {
    super(
      `Invalid signature for wallet ${wallet}`,
      401,
      "INVALID_SIGNATURE_ERROR"
    );
  }
}


export class InvalidTokenError extends AppError {
  constructor(message: string = "Invalid token") {
    super(message, 401, "INVALID_TOKEN_ERROR");
  }
}


export class InsufficientBalanceError extends AppError {
  constructor(required: number, available: number) {
    super(
      `Insufficient balance: required $${required.toFixed(
        2
      )}, available $${available.toFixed(2)}`,
      402,
      "INSUFFICIENT_BALANCE_ERROR",
      { required, available }
    );
  }
}


export class InsufficientFundsError extends AppError {
  constructor(message: string = "Insufficient funds") {
    super(message, 400, "INSUFFICIENT_FUNDS_ERROR");
  }
}


export class FileNotFoundError extends AppError {
  constructor(fileId: string) {
    super(`File with ID ${fileId} not found`, 404, "FILE_NOT_FOUND");
  }
}


export class FileAccessDeniedError extends AppError {
  constructor(fileId: string) {
    super(`Access to file with ID ${fileId} denied`, 403, "FILE_ACCESS_DENIED");
  }
}


export class FileUploadError extends AppError {
  constructor(message: string = "Error uploading file") {
    super(message, 400, "FILE_UPLOAD_ERROR");
  }
}


export class FileDeleteError extends AppError {
  constructor(fileId: string, message: string = "Error deleting file") {
    super(`${message}: ${fileId}`, 500, "FILE_DELETE_ERROR");
  }
}


export class FileSizeExceededError extends AppError {
  constructor(size: number, maxSize: number) {
    super(
      `File size (${size} MB) exceeds maximum allowed size (${maxSize} MB)`,
      400,
      "FILE_SIZE_EXCEEDED"
    );
  }
}


export class UnsupportedFileTypeError extends AppError {
  constructor(mimeType: string) {
    super(
      `Unsupported file type: ${mimeType}`,
      400,
      "UNSUPPORTED_FILE_TYPE"
    );
  }
}


export class NoFileProvidedError extends AppError {
  constructor() {
    super("No file provided in request", 400, "NO_FILE_PROVIDED");
  }
}


export class UserIdRequiredError extends AppError {
  constructor() {
    super(
      "User ID (userId) is required",
      400,
      "USER_ID_REQUIRED"
    );
  }
}


export class NotAllowedError extends AppError {
  constructor(message: string) {
    super(message, 403, "NOT_ALLOWED_ERROR");
  }
}
