export class APIError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
    public errors?: any[]
  ) {
    super(message);
    this.name = 'APIError';
  }

  static BadRequest(message: string, code?: string, errors?: any[]) {
    return new APIError(400, message, code, errors);
  }

  static NotFound(message: string, code?: string) {
    return new APIError(404, message, code);
  }

  static Internal(message: string = 'Internal Server Error', code?: string) {
    return new APIError(500, message, code);
  }

  static Unauthorized(message: string, code?: string) {
    return new APIError(401, message, code);
  }
}
