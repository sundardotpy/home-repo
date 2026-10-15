// Schema migrations.
//
// SQL files remain the single source of truth for every deployment.

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { log } from './log.js';
import { withTransaction } from './db.js';

const here = dirname(fileURLToPath(import.meta.url));

export const MIGRATIONS_DIR = resolve(here, '..', 'internal', 'db', 'migrations');

// An arbitrary but fixed key: any two processes calling migrate must pick the
// same one.
const MIGRATION_LOCK = 8172531;

/**
 * Apply every migration that has not run yet, each in its own transaction, in
 * filename order.
 *
 * Serverless changes the rules here: several cold starts can call this at the
 * same moment, so the whole run is wrapped in a Postgres advisory lock. Losers
 * wait, then find there is nothing left to do.
 */
export async function migrate(pool) {
  // The lock must be held by one dedicated connection for the whole run.
  const lockClient = await pool.connect();
  try {
    await lockClient.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK]);

    await lockClient.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);

    const { rows } = await lockClient.query('SELECT version FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.version));

    const names = (await readdir(MIGRATIONS_DIR))
      .filter((n) => n.endsWith('.sql'))
      .sort();

    for (const name of names) {
      if (applied.has(name)) continue;

      const body = await readFile(join(MIGRATIONS_DIR, name), 'utf8');
      try {
        await withTransaction(pool, async (tx) => {
          await tx.query(body);
          await tx.query('INSERT INTO schema_migrations (version) VALUES ($1)', [name]);
        });
      } catch (err) {
        throw new Error(`migration ${name}: ${err.message}`, { cause: err });
      }
      log.info('migration applied', { version: name });
    }
  } finally {
    await lockClient.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK]).catch(() => {});
    lockClient.release();
  }
}
