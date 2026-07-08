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

export function correlationId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('X-Correlation-ID');
  req.correlationId = incoming && incoming.trim() !== '' ? incoming : randomUUID();
  res.setHeader('X-Correlation-ID', req.correlationId);
  next();
}
