// Serves the single-page app shell and its assets.
//
// Static assets stay in their source directory and are read on demand. Vercel
// includes them in the function bundle through the includeFiles configuration.

import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { agreedEncoding, encodeContent, MIN_COMPRESS_BYTES } from './compress.js';

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

// Text formats whose compressed form is worth remembering. Images and woff2
// fonts arrive compressed already; brotli on those wastes cycles for nothing.
const COMPRESSIBLE = new Set(['.js', '.mjs', '.css', '.json', '.webmanifest', '.svg', '.txt', '.map']);

// file-path -> { mtimeMs, gzip, br } — each static asset's compressed bytes,
// computed on first request and reused until the file changes on disk. The
// whole module graph is ~350 kB raw and ~90 kB compressed, and this app ships
// no bundler to precompute them, so the server does that job instead.
const compressedCache = new Map();

/**
 * The compressed form of `raw` in `encoding`, from the cache when the file has
 * not changed since it was written.
 */
function compressedBody(file, mtimeMs, encoding, raw) {
  let entry = compressedCache.get(file);
  if (!entry || entry.mtimeMs !== mtimeMs) {
    entry = { mtimeMs, gzip: null, br: null };
    compressedCache.set(file, entry);
  }
  entry[encoding] ??= encodeContent(encoding, raw);
  return entry[encoding];
}

export function contentType(path) {
  return MIME[extname(path).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Handler serves the app shell and everything under /static/. Anything that is
 * not a static file falls through to index.html; routing happens client side.
 */
export function createWebHandler({ dev = false } = {}) {
  let indexCache = null;
  // The shell is one file forever, so its compressed bytes are remembered too.
  const indexCompressed = new Map();

  async function index() {
    if (indexCache === null) indexCache = await readFile(join(STATIC_ROOT, 'index.html'));
    return indexCache;
  }

  function compressedIndex(encoding) {
    if (!indexCompressed.has(encoding)) {
      indexCompressed.set(encoding, encodeContent(encoding, indexCache));
    }
    return indexCompressed.get(encoding);
  }

  return async function web(req, res) {
    const path = req.pathname;

    if (path === '/api' || path === '/api/' || path.startsWith('/api/')) {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }

    if (path.startsWith('/static/')) {
      const rel = normalize(decodeURIComponent(path.slice('/static/'.length)));
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
        const encoding =
          COMPRESSIBLE.has(extname(file).toLowerCase()) && body.length >= MIN_COMPRESS_BYTES
            ? agreedEncoding(req, { prefer: 'br' }) // statics are cached: brotli's size win is free
            : '';

        res.statusCode = 200;
        res.setHeader('Content-Type', contentType(file));
        // Never serve stale assets while developing.
        res.setHeader('Cache-Control', dev ? 'no-store' : 'public, max-age=3600');
        if (encoding) {
          const payload = compressedBody(file, info.mtimeMs, encoding, body);
          res.setHeader('Content-Encoding', encoding);
          res.setHeader('Vary', 'Accept-Encoding');
          res.setHeader('Content-Length', payload.length);
          res.end(req.method === 'HEAD' ? undefined : payload);
        } else {
          res.setHeader('Content-Length', body.length);
          res.end(req.method === 'HEAD' ? undefined : body);
        }
      } catch {
        res.statusCode = 404;
        res.end(req.method === 'HEAD' ? undefined : 'Not Found');
      }
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    const body = await index();
    const encoding =
      indexCache.length >= MIN_COMPRESS_BYTES ? agreedEncoding(req, { prefer: 'br' }) : '';
    if (encoding) {
      const payload = compressedIndex(encoding);
      res.setHeader('Content-Encoding', encoding);
      res.setHeader('Vary', 'Accept-Encoding');
      res.setHeader('Content-Length', payload.length);
      res.end(req.method === 'HEAD' ? undefined : payload);
      return;
    }
    res.end(req.method === 'HEAD' ? undefined : body);
  };
}
