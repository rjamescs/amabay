import os from 'os';
import path from 'path';

/**
 * Test harness bootstrap.
 *
 * The app uses a module-level SQLite connection whose file path is read from
 * config at import time, and the repository compiles prepared statements at
 * import time (which requires the schema to already exist). So we must:
 *   1. Point DB_FILE at an ephemeral temp file and disable seeding, BEFORE
 *      importing any app module.
 *   2. Run migrate() to create the schema.
 *   3. Only then dynamically import the app + db.
 *
 * Everything is memoized so all tests in the process share one isolated
 * ephemeral database (never the dev data file). Per-test isolation is achieved
 * by truncating the items table in beforeEach — no test depends on seeded data
 * or on another test's rows.
 */

interface TestContext {
  app: import('express').Express;
  db: { exec(sql: string): void };
  dbFile: string;
}

let ctx: TestContext | undefined;

export async function getTestContext(): Promise<TestContext> {
  if (ctx) return ctx;

  const dbFile = path.join(
    os.tmpdir(),
    `amabay-test-${process.pid}-${Date.now()}.sqlite`
  );
  process.env.DB_FILE = dbFile;
  process.env.SEED = 'false';

  const { migrate } = await import('../src/db/migrate');
  migrate();

  const { createApp } = await import('../src/app');
  const { db } = await import('../src/db');

  ctx = { app: createApp(), db, dbFile };
  return ctx;
}

/** Wipe all rows + reset the autoincrement counter for a clean slate. */
export function resetDb(db: { exec(sql: string): void }): void {
  db.exec('DELETE FROM items');
  try {
    db.exec("DELETE FROM sqlite_sequence WHERE name = 'items'");
  } catch {
    // sqlite_sequence only exists after the first AUTOINCREMENT insert.
  }
}
