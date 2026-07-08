import fs from 'fs';
import path from 'path';
import { DatabaseSync, StatementSync } from 'node:sqlite';
import { config } from '../config';

/**
 * Database driver.
 *
 * DESIGN / FORCED DECISION:
 * The locked stack specified `better-sqlite3`. On this machine (Node 26, no
 * Python / MSVC build tools) better-sqlite3 has no prebuilt binary and cannot
 * compile from source. Node 26 ships a *stable, built-in* SQLite module
 * (`node:sqlite`) that provides the same file-based, synchronous,
 * prepared-statement model. We use it here behind a thin adapter whose surface
 * (`prepare` / `exec` / `pragma` / `transaction`) matches the subset of the
 * better-sqlite3 API the rest of the app relies on. Swapping back to
 * better-sqlite3 is a single-file change: replace this module's internals and
 * re-add the dependency. No other source file references the driver directly.
 */

export interface RunResult {
  changes: number | bigint;
  lastInsertRowid: number | bigint;
}

/** Minimal statement interface matching how the app uses prepared statements. */
export interface PreparedStatement {
  run(params?: unknown): RunResult;
  get(params?: unknown): unknown;
  all(params?: unknown): unknown[];
}

class Db {
  private readonly raw: DatabaseSync;

  constructor(file: string) {
    this.raw = new DatabaseSync(file);
  }

  exec(sql: string): void {
    this.raw.exec(sql);
  }

  /** better-sqlite3-style pragma helper implemented via exec. */
  pragma(directive: string): void {
    this.raw.exec(`PRAGMA ${directive}`);
  }

  prepare(sql: string): PreparedStatement {
    const stmt: StatementSync = this.raw.prepare(sql);
    return {
      run: (params?: unknown) =>
        (params === undefined
          ? stmt.run()
          : stmt.run(params as never)) as RunResult,
      get: (params?: unknown) =>
        params === undefined ? stmt.get() : stmt.get(params as never),
      all: (params?: unknown) =>
        params === undefined ? stmt.all() : stmt.all(params as never),
    };
  }

  /**
   * better-sqlite3-style transaction wrapper: returns a function that runs
   * `fn` inside BEGIN/COMMIT, rolling back on error.
   */
  transaction<A, R>(fn: (arg: A) => R): (arg: A) => R {
    return (arg: A): R => {
      this.raw.exec('BEGIN');
      try {
        const result = fn(arg);
        this.raw.exec('COMMIT');
        return result;
      } catch (err) {
        this.raw.exec('ROLLBACK');
        throw err;
      }
    };
  }
}

function openDatabase(): Db {
  const dir = path.dirname(config.dbFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const database = new Db(config.dbFile);
  // WAL improves read/write concurrency for a local file DB.
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  return database;
}

export const db = openDatabase();
