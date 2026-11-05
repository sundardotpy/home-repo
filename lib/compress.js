// Content negotiation and compression helpers.
//
// Everything this app sends is text — the SPA bundle, the JSON API — and none
// of it is precompressed by a build step, so until this module the browser
// received hundreds of kilobytes raw where a third of that would do.
//
// gzip is compressed once per response or served from a static cache; brotli
// is reserved for the big static files, whose compressed form is worth
// remembering across requests.

import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

// Below this the zlib frame overhead rivals what it saves.
export const MIN_COMPRESS_BYTES = 1 << 11;

/**
 * The best encoding both sides agree on.
 *
 * `prefer` picks which one wins when the client accepts both: brotli is
 * smaller, gzip is cheaper to produce. For per-request work (JSON) gzip wins;
 * for static assets, whose compressed bytes are cached and reused, brotli wins.
 */
export function agreedEncoding(req, { prefer = 'gzip' } = {}) {
  const accept = String(req?.headers?.['accept-encoding'] ?? '');
  const gzip = /gzip/i.test(accept);
  const br = /\bbr\b/i.test(accept);
  if (prefer === 'br') {
    if (br) return 'br';
    if (gzip) return 'gzip';
  } else {
    if (gzip) return 'gzip';
    if (br) return 'br';
  }
  return '';
}

/** One-shot compression of a response body in the negotiated encoding. */
export function encodeContent(encoding, buffer) {
  if (encoding === 'gzip') return gzipSync(buffer);
  return brotliCompressSync(buffer, {
    params: { [constants.BROTLI_PARAM_QUALITY]: 5 }, // 5: smaller output, written once and reused
  });
}
