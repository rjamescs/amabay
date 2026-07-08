/**
 * Application error taxonomy and the standardized JSON error envelope.
 *
 * Every error response has the shape:
 * {
 *   "error": {
 *     "code": "NOT_FOUND",
 *     "message": "Item not found",
 *     "details": [ ... optional ... ],
 *     "correlationId": "..."
 *   }
 * }
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'BAD_REQUEST'
  | 'INTERNAL_ERROR';

export interface ErrorDetail {
  path?: string;
  message: string;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: ErrorCode;
  public readonly details?: ErrorDetail[];

  constructor(status: number, code: ErrorCode, message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static notFound(message = 'Resource not found'): ApiError {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static badRequest(message = 'Bad request'): ApiError {
    return new ApiError(400, 'BAD_REQUEST', message);
  }

  static validation(message: string, details?: ErrorDetail[]): ApiError {
    return new ApiError(400, 'VALIDATION_ERROR', message, details);
  }
}
