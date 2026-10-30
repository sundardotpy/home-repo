// Serves the single-page app shell and its assets.
//
// Static assets stay in their source directory and are read on demand. Vercel
// includes them in the function bundle through the includeFiles configuration.

import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export const STATIC_ROOT = resolve(here, '..', 'internal', 'web', 'static');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

export function contentType(path) {
  return MIME[extname(path).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Handler serves the app shell and everything under /static/. Anything that is
 * not a static file falls through to index.html; routing happens client side.
 */
export function createWebHandler({ dev = false } = {}) {
  let indexCache = null;

  async function index() {
    if (indexCache === null) indexCache = await readFile(join(STATIC_ROOT, 'index.html'));
    return indexCache;
  }

  return async function web(req, res) {
    const path = req.pathname;

    if (path === '/api' || path === '/api/' || path.startsWith('/api/')) {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }

    if (path.startsWith('/static/')) {
      // The router has already decoded the path; decoding again would turn
      // "%25" into a bare "%" and throw.
      const rel = normalize(path.slice('/static/'.length));
      // normalize() collapses "..", so a traversal that survives it is still
      // re-checked against the root before anything is opened.
      const file = resolve(STATIC_ROOT, rel);
      if (file !== STATIC_ROOT && !file.startsWith(STATIC_ROOT + sep)) {
        res.statusCode = 404;
        res.end('Not Found');
        return;
      }
      try {
        const info = await stat(file);
        if (!info.isFile()) throw Object.assign(new Error('not a file'), { code: 'ENOENT' });

        const body = await readFile(file);
        res.statusCode = 200;
        res.setHeader('Content-Type', contentType(file));
        res.setHeader('Content-Length', body.length);
        // Never serve stale assets while developing.
        res.setHeader('Cache-Control', dev ? 'no-store' : 'public, max-age=3600');
        res.end(req.method === 'HEAD' ? undefined : body);
      } catch {
        res.statusCode = 404;
        res.end('Not Found');
      }
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    const body = await index();
    res.end(req.method === 'HEAD' ? undefined : body);
  };
}
