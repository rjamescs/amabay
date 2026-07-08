import { db } from '../db';
import { CreateItemInput, UpdateItemInput } from '../validation/item';

export interface Item {
  id: number;
  title: string;
  price: number;
  quantity: number;
  description: string | null;
  image: string | null;
  created_at: string;
  updated_at: string;
}

export interface SearchResult {
  items: Item[];
  total: number;
  page: number;
  pageSize: number;
}

const nowExpr = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

// Prepared statements are compiled once and reused for performance.
const insertStmt = db.prepare(
  `INSERT INTO items (title, price, quantity, description, image)
   VALUES (@title, @price, @quantity, @description, @image)`
);
const getByIdStmt = db.prepare('SELECT * FROM items WHERE id = ?');
const deleteStmt = db.prepare('DELETE FROM items WHERE id = ?');

export const itemRepository = {
  create(input: CreateItemInput): Item {
    const info = insertStmt.run({
      title: input.title,
      price: input.price,
      quantity: input.quantity,
      description: input.description ?? null,
      image: input.image ?? null,
    });
    return getByIdStmt.get(info.lastInsertRowid) as Item;
  },

  getById(id: number): Item | undefined {
    return getByIdStmt.get(id) as Item | undefined;
  },

  /**
   * Partial update. Only provided fields are written; updated_at is always
   * refreshed. Returns the updated row, or undefined if the id does not exist.
   */
  update(id: number, input: UpdateItemInput): Item | undefined {
    const existing = getByIdStmt.get(id) as Item | undefined;
    if (!existing) return undefined;

    const sets: string[] = [];
    const params: Record<string, unknown> = { id };

    for (const key of ['title', 'price', 'quantity', 'description', 'image'] as const) {
      if (key in input && input[key] !== undefined) {
        sets.push(`${key} = @${key}`);
        params[key] = input[key];
      }
    }

    // If validation guaranteed a non-empty body this is always > 0, but guard anyway.
    if (sets.length === 0) return existing;

    sets.push(`updated_at = ${nowExpr}`);
    db.prepare(`UPDATE items SET ${sets.join(', ')} WHERE id = @id`).run(params);
    return getByIdStmt.get(id) as Item;
  },

  delete(id: number): boolean {
    return deleteStmt.run(id).changes > 0;
  },

  /**
   * Text search across title + description with pagination.
   * When `q` is omitted this returns all items (newest first).
   */
  search(q: string | undefined, page: number, pageSize: number): SearchResult {
    const offset = (page - 1) * pageSize;

    let whereClause = '';
    const params: Record<string, unknown> = {};

    if (q) {
      whereClause =
        "WHERE title LIKE @like ESCAPE '\\' COLLATE NOCASE OR description LIKE @like ESCAPE '\\' COLLATE NOCASE";
      // Escape LIKE wildcards in user input, then wrap for substring match.
      const escaped = q.replace(/[\\%_]/g, (m) => `\\${m}`);
      params.like = `%${escaped}%`;
    }

    const totalRow = db
      .prepare(`SELECT COUNT(*) AS n FROM items ${whereClause}`)
      .get(params) as { n: number };

    const rows = db
      .prepare(
        `SELECT * FROM items ${whereClause}
         ORDER BY created_at DESC, id DESC
         LIMIT @limit OFFSET @offset`
      )
      .all({ ...params, limit: pageSize, offset }) as Item[];

    return { items: rows, total: totalRow.n, page, pageSize };
  },
};
