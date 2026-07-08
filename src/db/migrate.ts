import { db } from './index';
import { config } from '../config';

/**
 * Schema initialization / migration. Runs on startup and is idempotent
 * (CREATE TABLE / INDEX IF NOT EXISTS), so `npm run dev` works out of the box.
 *
 * Design notes:
 * - price is stored as REAL. For a "simple" catalog this is fine; a production
 *   money model would use integer minor units (cents) to avoid float rounding.
 * - Text search uses case-insensitive LIKE with COLLATE NOCASE indexes on
 *   title/description. This keeps the schema simple and dependency-free while
 *   still being index-assisted for prefix matches. (See README for the FTS5
 *   trade-off.)
 * - updated_at is maintained in application code (the repository) on every
 *   UPDATE, which is explicit and portable.
 */
export function migrate(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT    NOT NULL,
      price       REAL    NOT NULL CHECK (price >= 0),
      quantity    INTEGER NOT NULL CHECK (quantity >= 0),
      description TEXT,
      image       TEXT,
      created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    -- Case-insensitive indexes to support LIKE-based text search and sorting.
    CREATE INDEX IF NOT EXISTS idx_items_title_nocase
      ON items (title COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_items_description_nocase
      ON items (description COLLATE NOCASE);
    -- Supports default "newest first" listing and keyset-style ordering.
    CREATE INDEX IF NOT EXISTS idx_items_created_at
      ON items (created_at);
  `);

  if (config.seedOnInit) {
    seedIfEmpty();
  }
}

function seedIfEmpty(): void {
  const row = db.prepare('SELECT COUNT(*) AS n FROM items').get() as { n: number };
  if (row.n > 0) return;

  const insert = db.prepare(
    `INSERT INTO items (title, price, quantity, description, image)
     VALUES (@title, @price, @quantity, @description, @image)`
  );

  const samples = [
    {
      title: 'Wireless Noise-Cancelling Headphones',
      price: 199.99,
      quantity: 42,
      description: 'Over-ear Bluetooth headphones with 30-hour battery life.',
      image: 'https://picsum.photos/seed/headphones/600/600',
    },
    {
      title: 'Stainless Steel Water Bottle',
      price: 24.5,
      quantity: 150,
      description: 'Insulated 750ml bottle that keeps drinks cold for 24 hours.',
      image: 'https://picsum.photos/seed/bottle/600/600',
    },
  ];

  const seedAll = db.transaction((rows: typeof samples) => {
    for (const r of rows) insert.run(r);
  });
  seedAll(samples);

  // eslint-disable-next-line no-console
  console.log(`[migrate] Seeded ${samples.length} sample items.`);
}
