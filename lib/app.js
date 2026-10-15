// Wiring shared by the long-running server and the serverless entrypoint.

import { Auth } from './auth.js';
import { connect } from './db.js';
import { loadConfig } from './config.js';
import { migrate } from './migrate.js';
import { DiskStore } from './media/diskstore.js';
import { PGStore } from './media/pgstore.js';
import { Store } from './store/index.js';
import { createWebHandler } from './web.js';
import { buildRouter } from './api/server.js';

/** Connect, migrate and return a ready-to-handle application. */
export async function build() {
  const config = loadConfig();

  const pool = await connect(config.databaseUrl, { serverless: config.serverless });

  try {
    await migrate(pool);
  } catch (err) {
    await pool.end().catch(() => {});
    throw err;
  }

  let media;
  try {
    media = await newMediaStore(config, pool);
  } catch (err) {
    await pool.end().catch(() => {});
    throw err;
  }

  const auth = new Auth(config.passcode);
  const store = new Store(pool);
  const web = createWebHandler({ dev: config.env === 'dev' });

  const server = { store, media, web, baseURL: config.publicBaseURL, auth, config };
  const router = buildRouter(server);

  return { config, pool, media, auth, store, router };
}

async function newMediaStore(config, pool) {
  switch (config.mediaBackend) {
    case 'disk':
      return new DiskStore(config.uploadDir).init();
    case 'db':
      return new PGStore(pool);
    default:
      throw new Error(`unknown media backend "${config.mediaBackend}"`);
  }
}
