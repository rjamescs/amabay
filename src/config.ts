import path from 'path';

/**
 * Centralized runtime configuration. Values are read from the environment with
 * sensible local-dev defaults so `npm run dev` works with zero setup.
 */
export const config = {
  port: Number(process.env.PORT ?? 3000),
  // SQLite database file location. Stored under ./data which is gitignored.
  dbFile: process.env.DB_FILE ?? path.join(process.cwd(), 'data', 'amabay.sqlite'),
  // Pagination guardrails for search/list endpoints.
  defaultPageSize: 20,
  maxPageSize: 100,
  // Seed sample data on first run (only when the items table is empty).
  seedOnInit: (process.env.SEED ?? 'true').toLowerCase() !== 'false',
} as const;
