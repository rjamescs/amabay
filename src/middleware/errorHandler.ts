import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiError, ErrorCode } from '../errors';

/**
 * Terminal error middleware. Produces the standardized error envelope and
 * logs a structured line including the correlation id.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  let status = 500;
  let code: ErrorCode = 'INTERNAL_ERROR';
  let message = 'Internal server error';
  let details: { path?: string; message: string }[] | undefined;

  if (err instanceof ZodError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Request validation failed';
    details = err.errors.map((e) => ({
      path: e.path.join('.') || undefined,
      message: e.message,
    }));
  } else if (err instanceof ApiError) {
    status = err.status;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof SyntaxError && 'body' in err) {
    // Body-parser JSON parse failure.
    status = 400;
    code = 'BAD_REQUEST';
    message = 'Malformed JSON in request body';
  }

  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        level: 'error',
        correlationId: req.correlationId,
        method: req.method,
        path: req.originalUrl,
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      })
    );
  }

  res.status(status).json({
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      correlationId: req.correlationId,
    },
  });
}

/** 404 handler for unmatched routes. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route not found: ${req.method} ${req.originalUrl}`,
      correlationId: req.correlationId,
    },
  });
}
