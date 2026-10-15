// The Vercel entrypoint.
//
// Vercel's Node runtime calls the default export with the raw Node request and
// response. The app is built once per instance — connecting and migrating on
// every invocation would add a round trip to every request — and the promise is
// cached so concurrent cold starts do not race each other.

import { build } from '../lib/app.js';
import { log } from '../lib/log.js';

let appPromise = null;

function getApp() {
  if (appPromise === null) {
    appPromise = build().catch((err) => {
      // Do not cache the failure: a later request may succeed once the
      // database wakes up.
      appPromise = null;
      throw err;
    });
  }
  return appPromise;
}

// Close the cached application cleanly when the host is shutting down. This is
// also used by the entrypoint integration test to release its database pool.
export async function close() {
  const pending = appPromise;
  appPromise = null;
  if (pending === null) return;

  let app;
  try {
    app = await pending;
  } catch {
    return;
  }
  await app.pool.end();
}

export default async function handler(req, res) {
  let app;
  try {
    app = await getApp();
  } catch (err) {
    // Surface the reason rather than a bare 500 — on a fresh deployment this is
    // nearly always a missing or wrong DATABASE_URL.
    log.error('startup failed', { err });
    res.statusCode = 503;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('service unavailable: ' + (err?.message ?? String(err)));
    return;
  }

  await app.router.handle(req, res);
}
