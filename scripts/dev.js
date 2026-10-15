// The long-running server used by local development and the container.

import { createServer } from 'node:http';

import { build } from '../lib/app.js';
import { log } from '../lib/log.js';

async function main() {
  const app = await build();

  const server = createServer((req, res) => {
    app.router.handle(req, res).catch((err) => {
      log.error('unhandled', { err, path: req.url });
      if (!res.writableEnded) {
        res.statusCode = 500;
        res.end('internal error');
      }
    });
  });

  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 70_000;

  await new Promise((resolve) => server.listen(app.config.port, resolve));
  log.info('listening', {
    addr: `:${app.config.port}`,
    env: app.config.env,
    media: app.config.mediaBackend,
    passcode: app.auth.enabled,
  });

  const shutdown = () => {
    log.info('shutting down');
    server.close(() => {
      app.pool.end().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  log.error('fatal', { err });
  process.exit(1);
});
