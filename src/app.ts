import express, { Request, Response } from 'express';
import { correlationId } from './middleware/correlationId';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { itemsRouter } from './routes/items';

/**
 * Builds the Express application. Kept separate from server bootstrap so it can
 * be imported by tests without binding a port.
 */
export function createApp() {
  const app = express();

  app.use(express.json({ limit: '1mb' }));
  app.use(correlationId);

  // Liveness/health probe.
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', time: new Date().toISOString() });
  });

  app.use('/api/items', itemsRouter);

  // 404 for anything unmatched, then the terminal error handler.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
