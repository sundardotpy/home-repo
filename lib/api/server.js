// Route table and request plumbing.

import { randomUUID } from 'node:crypto';

import { clientIP } from '../auth.js';
import { log } from '../log.js';
import { writeErr, writeJSON } from '../http.js';
import { registerMCP } from '../mcp.js';
import { Router } from '../router.js';
import { registerHistory } from './history.js';
import { registerItems } from './items.js';
import { registerPhotos } from './photos.js';
import { registerQRCodes } from './qrcodes.js';
import { registerRooms } from './rooms.js';
import { registerShift } from './shift.js';
import { registerTags } from './tags.js';
import { registerUnits } from './units.js';

const REQUEST_TIMEOUT_MS = 30_000;

export function buildRouter(s) {
  const router = new Router();

  router.use(requestContext);
  router.use(accessLog);
  router.use(recoverer);
  router.use(timeout);
  // Apply the API gate at the namespace boundary so handlers registered by
  // separate modules (photos and QR codes included) cannot accidentally miss it.
  router.use((req, res, next) => {
    if (req.pathname === '/api' || req.pathname.startsWith('/api/')) {
      return s.auth.apiGate(next)(req, res);
    }
    return next();
  });

  router.get('/healthz', health(s));

  // Photos are plain <img> loads with no header to check, so they carry the
  // session guard directly rather than going through the /api gate.
  registerPhotos(router, s, s.auth.requireAuth);

  registerQRCodes(router, s);

  router.get('/api/healthz', health(s));
  router.get('/api/session', (req, res) => s.auth.session(req, res));
  router.post('/api/login', (req, res) => s.auth.login(req, res));
  router.post('/api/logout', (req, res) => s.auth.logout(req, res));

  registerRooms(router, s);
  registerUnits(router, s);
  registerItems(router, s);
  registerTags(router, s);
  registerHistory(router, s);
  registerShift(router, s);

  // The MCP surface for external AIs exists only when a token is configured.
  if (s.config.mcpToken) registerMCP(router, s);

  // Anything not matched above is the frontend: the app shell and its assets.
  router.notFound(s.web);

  return router;
}

/** Normalises the parts of an IncomingMessage the handlers expect. */
function requestContext(req, res, next) {
  req.requestId = req.headers['x-vercel-id'] ?? randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}

function accessLog(req, res, next) {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const level = res.statusCode >= 500 ? 'error' : 'info';
    log[level]('request', {
      method: req.method,
      path: req.pathname,
      status: res.statusCode,
      ms: Math.round(ms),
      ip: clientIP(req),
      request_id: req.requestId,
    });
  });
  next();
}

async function recoverer(req, res, next) {
  try {
    await next();
  } catch (err) {
    log.error('panic', { err, path: req.pathname });
    if (!res.writableEnded) writeErr(res, 500, 'internal error');
  }
}

function timeout(req, res, next) {
  const timer = setTimeout(() => {
    if (!res.writableEnded) {
      log.error('request timed out', { path: req.pathname });
      writeErr(res, 503, 'request timed out');
    }
  }, REQUEST_TIMEOUT_MS);
  timer.unref?.(); // do not hold the event loop open for an idle timer
  res.on('finish', () => clearTimeout(timer));
  next();
}

function health(s) {
  return async (req, res) => {
    try {
      await s.store.defaultUserID();
    } catch (err) {
      writeErr(res, 503, 'database not ready', err.detail ?? err.message);
      return;
    }
    writeJSON(res, 200, { status: 'ok' });
  };
}
