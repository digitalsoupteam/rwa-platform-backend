export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(params: {
    message: string;
    statusCode?: number;
    code?: string;
    cause?: unknown;
  }) {
    super(params.message, params.cause !== undefined ? { cause: params.cause } : undefined);
    this.name = this.constructor.name;
    this.statusCode = params.statusCode ?? 500;
    this.code = params.code ?? "INTERNAL_ERROR";
    Error.captureStackTrace(this, this.constructor);
  }
}
