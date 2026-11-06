// Serves the single-page app shell and its assets.
//
// Static assets stay in their source directory and are read on demand. Vercel
// includes them in the function bundle through the includeFiles configuration.

import { readFile, stat } from 'node:fs/promises';
import { brotliCompressSync, constants as zlib, gzipSync } from 'node:zlib';
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
// Text compresses to a quarter of its size or less; images and fonts are
// already compressed.
const COMPRESSIBLE = /^(text\/|application\/(json|manifest\+json)|image\/svg)/;

/**
 * Reads a file once per change and keeps it with its compressed forms, so a
 * request costs a stat, not a read and a brotli pass. Keyed on mtime and size,
 * which also gives the ETag.
 */
async function loadAsset(cache, file) {
  const info = await stat(file);
  if (!info.isFile()) throw Object.assign(new Error('not a file'), { code: 'ENOENT' });
  const etag = `"${info.size.toString(36)}-${Math.floor(info.mtimeMs).toString(36)}"`;
  const hit = cache.get(file);
  if (hit?.etag === etag) return hit;

  const raw = await readFile(file);
  const type = contentType(file);
  const asset = { etag, type, raw };
  if (COMPRESSIBLE.test(type) && raw.length > 1024) {
    asset.br = brotliCompressSync(raw, {
      params: { [zlib.BROTLI_PARAM_QUALITY]: 11, [zlib.BROTLI_PARAM_SIZE_HINT]: raw.length },
    });
    asset.gzip = gzipSync(raw, { level: 9 });
  }
  cache.set(file, asset);
  return asset;
}

function send(req, res, asset, cacheControl) {
  res.setHeader('Content-Type', asset.type);
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('ETag', asset.etag);
  if (asset.br) res.setHeader('Vary', 'Accept-Encoding');

  if (req.headers['if-none-match'] === asset.etag) {
    res.statusCode = 304;
    res.end();
    return;
  }

  const accept = req.headers['accept-encoding'] ?? '';
  let body = asset.raw;
  if (asset.br && /\bbr\b/.test(accept)) {
    body = asset.br;
    res.setHeader('Content-Encoding', 'br');
  } else if (asset.gzip && /\bgzip\b/.test(accept)) {
    body = asset.gzip;
    res.setHeader('Content-Encoding', 'gzip');
  }
  res.statusCode = 200;
  res.setHeader('Content-Length', body.length);
  res.end(req.method === 'HEAD' ? undefined : body);
}

/**
 * Handler serves the app shell and everything under /static/. Anything that is
 * not a static file falls through to index.html; routing happens client side.
 */
export function createWebHandler({ dev = false } = {}) {
  const cache = new Map();

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
      let asset;
      try {
        asset = await loadAsset(cache, file);
      } catch {
        res.statusCode = 404;
        res.end('Not Found');
        return;
      }
      // Development revalidates every time (a 304 when nothing changed), so
      // an edit shows on the next reload.
      send(req, res, asset, dev ? 'no-cache' : 'public, max-age=3600');
      return;
    }

    send(req, res, await loadAsset(cache, join(STATIC_ROOT, 'index.html')), 'no-cache');
  };
}
