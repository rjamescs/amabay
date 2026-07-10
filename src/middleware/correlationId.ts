import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

/**
 * Attaches a correlation id to every request for traceable, structured logs
 * and error envelopes. Honors an inbound X-Correlation-ID header if present.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

// Inbound ids are echoed into logs and response headers, so they're
// restricted to a safe, bounded charset (typical UUID/opaque-token shape)
// rather than trusted verbatim — anything else is replaced with a fresh id.
const VALID_CORRELATION_ID = /^[A-Za-z0-9_-]{1,100}$/;

export function correlationId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('X-Correlation-ID');
  req.correlationId = incoming && VALID_CORRELATION_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Correlation-ID', req.correlationId);
  next();
}
