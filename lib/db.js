// Postgres connection pooling.

import pg from 'pg';
import { log } from './log.js';

const { Pool, types } = pg;

// int8 (OID 20) arrives as a string so values above 2^53 survive. Counts in
// this app fit comfortably in a double, so expose them as numbers.
types.setTypeParser(20, (v) => Number.parseInt(v, 10));

// numeric (OID 1700) stays a string; the queries that matter cast to float8
// explicitly, and keeping the default avoids silently rounding money elsewhere.

export function pooledHost(url) {
  try {
    const host = new URL(url).hostname;
    return host.includes('-pooler.') || host.includes('pgbouncer');
  } catch {
    return false;
  }
}

/**
 * Pool sizes are tuned for where this is running. A long-lived server wants a
 * warm pool; a serverless function wants almost none, because every instance
 * holds its own and they are created and discarded constantly.
 */
function poolConfig(url, { serverless }) {
  return {
    connectionString: url,
    max: serverless ? 2 : 10,
    min: 0,
    // Managed poolers can close idle client sockets while the app is quiet.
    // Retire our side before that happens instead of reusing stale sockets.
    idleTimeoutMillis: serverless ? 30_000 : 60_000,
    connectionTimeoutMillis: 15_000,
    // A managed database may be asleep; the first connection is what wakes it.
    keepAlive: true,
  };
}

/**
 * Dial Postgres, retrying until the server accepts queries. Resolves with a
 * ready-to-use Pool.
 */
export async function connect(url, opts = {}) {
  const serverless = Boolean(opts.serverless);
  const cfg = poolConfig(url, { serverless });
  const pool = new Pool(cfg);

  // pg-pool emits `error` when an idle client is closed unexpectedly. Without
  // a listener EventEmitter treats it as fatal and terminates the whole app.
  // The pool discards that client and can create a replacement on demand.
  pool.on('error', (err) => {
    log.warn('idle database connection closed', { err: err.message });
  });

  const attempts = serverless ? 3 : 15; // fail fast: the platform retries itself
  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const client = await pool.connect();
      client.release();
      log.info('database connected', {
        host: safeHost(url),
        pooled: pooledHost(url),
        max: cfg.max,
      });
      return pool;
    } catch (err) {
      lastErr = err;
      log.warn('waiting for postgres', { attempt, err });
      await sleep(1000);
    }
  }

  await pool.end().catch(() => {});
  throw new Error(`database unreachable: ${lastErr?.message ?? 'unknown error'}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function safeHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '(unparseable)';
  }
}

/**
 * Run `fn` inside a transaction, committing on success and rolling back on any
 * throw. The callback receives a client with the same `query` surface as the
 * pool, so the store code is written once and works either way.
 */
export async function withTransaction(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
