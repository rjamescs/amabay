import { migrate } from './db/migrate';
import { config } from './config';

/**
 * Bootstrap: run schema init/migration BEFORE the app (and its repository
 * layer) is loaded. The repository compiles prepared statements at import time
 * for performance, and SQLite validates table existence when a statement is
 * prepared — so the schema must exist first. We therefore migrate, then
 * dynamically import the app.
 */
async function main(): Promise<void> {
  migrate();

  const { createApp } = await import('./app');
  const app = createApp();

  const server = app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[amabay] listening on http://localhost:${config.port}`);
    // eslint-disable-next-line no-console
    console.log(`[amabay] database: ${config.dbFile}`);
  });

  const shutdown = (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`[amabay] ${signal} received, shutting down...`);
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[amabay] fatal startup error:', err);
  process.exit(1);
});
