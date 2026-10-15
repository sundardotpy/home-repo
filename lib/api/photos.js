// Photo upload and delivery.

import { urlID, writeErr, writeJSON, writeStoreErr } from '../http.js';
import { log } from '../log.js';
import {
  ErrNotFound, ErrTooLarge, ErrUnsupported, MAX_UPLOAD, MediaError, variantFromPath,
} from '../media/index.js';
import { photoKeyOf, setItemPhoto } from '../store/item.js';

/**
 * Parses the multipart upload. Node has no built-in multipart reader, but the
 * WHATWG Response does — feeding it a buffered body keeps the size cap exact and
 * avoids pulling in a streaming dependency.
 */
async function readForm(req, maxBytes) {
  const chunks = [];
  let size = 0;
  let tooLarge = false;

  await new Promise((resolve, reject) => {
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        tooLarge = true;
      }
      if (!tooLarge) {
        chunks.push(chunk);
      }
    });
    req.on('end', () => {
      if (tooLarge) {
        const err = new Error('body too large');
        err.tooLarge = true;
        reject(err);
      } else {
        resolve();
      }
    });
    req.on('error', reject);
  });

  const contentType = req.headers['content-type'] ?? '';
  if (!contentType.startsWith('multipart/form-data')) {
    const err = new Error('expected multipart/form-data');
    err.notMultipart = true;
    throw err;
  }

  const body = Buffer.concat(chunks);
  try {
    return await new Response(body, { headers: { 'content-type': contentType } }).formData();
  } catch (err) {
    err.notMultipart = true;
    throw err;
  }
}

/**
 * Accepts a multipart form with a single `photo` file, writes a display image
 * and a thumbnail, and points the item at them.
 */
export function registerPhotos(router, s, requireAuth) {
  router.post('/api/items/{itemID}/photo', async (req, res) => {
    if (!s.media) {
      writeErr(res, 501, 'photo storage is not configured');
      return;
    }
    const id = urlID(req, res, 'itemID');
    if (!id) return;

    let form;
    try {
      form = await readForm(req, MAX_UPLOAD + 1024);
    } catch (err) {
      // Oversized or malformed multipart bodies cannot provide a usable photo.
      writeErr(res, 413, 'photo too large', 'the limit is 15MB');
      return;
    }

    const file = form.get('photo');
    if (!file || typeof file === 'string' || !file.arrayBuffer) {
      writeErr(res, 400, 'no photo in request', "expected a file field named 'photo'");
      return;
    }

    // The item must exist before we write anything to disk.
    let previous;
    try {
      previous = await photoKeyOf(s.store, id);
    } catch (err) {
      writeStoreErr(res, err);
      return;
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    let key;
    try {
      key = await s.media.save(bytes);
    } catch (err) {
      if (err instanceof MediaError && err.kind === ErrUnsupported) {
        writeErr(res, 415, 'unsupported image',
          'JPEG, PNG, GIF and WebP are supported; HEIC is not');
      } else if (err instanceof MediaError && err.kind === ErrTooLarge) {
        writeErr(res, 413, 'photo too large', 'the limit is 15MB');
      } else {
        log.error('save photo', { err, filename: file.name });
        writeErr(res, 500, 'could not process image');
      }
      return;
    }

    let actor = null;
    try {
      actor = await s.store.defaultUserID();
    } catch {
      actor = null;
    }

    let item;
    try {
      item = await setItemPhoto(s.store, id, key, actor);
    } catch (err) {
      await s.media.delete(key).catch(() => {}); // never leave bytes no row points at
      writeStoreErr(res, err);
      return;
    }
    if (previous) await s.media.delete(previous).catch(() => {});

    writeJSON(res, 200, item);
  });

  router.delete('/api/items/{itemID}/photo', async (req, res) => {
    if (!s.media) {
      writeErr(res, 501, 'photo storage is not configured');
      return;
    }
    const id = urlID(req, res, 'itemID');
    if (!id) return;

    let previous;
    try {
      previous = await photoKeyOf(s.store, id);
    } catch (err) {
      writeStoreErr(res, err);
      return;
    }

    let actor = null;
    try {
      actor = await s.store.defaultUserID();
    } catch {
      actor = null;
    }

    let item;
    try {
      item = await setItemPhoto(s.store, id, null, actor);
    } catch (err) {
      writeStoreErr(res, err);
      return;
    }
    if (previous) await s.media.delete(previous).catch(() => {});

    writeJSON(res, 200, item);
  });

  /**
   * Streams one variant of a stored photo. Keys are UUID-based and never
   * rewritten, so the response can be cached indefinitely.
   */
  const servePhoto = async (req, res) => {
    if (!s.media) {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }

    const { key, variant, ok } = variantFromPath(req.pathname.slice('/media/'.length));
    if (!ok || key.includes('..')) {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }

    let body;
    try {
      body = await s.media.open(key, variant);
    } catch (err) {
      if (err instanceof MediaError && err.kind === ErrNotFound) {
        res.statusCode = 404;
        res.end('Not Found');
        return;
      }
      log.error('read photo', { err, key });
      res.statusCode = 500;
      res.end('could not read photo');
      return;
    }

    const etag = `"${key}-${variant}"`;
    if (req.headers['if-none-match'] === etag) {
      res.statusCode = 304;
      res.end();
      return;
    }

    res.setHeader('Content-Type', 'image/jpeg');
    // Behind a passcode, a shared cache must not hand a photo to someone else.
    const cache = s.auth.enabled ? 'private' : 'public';
    res.setHeader('Cache-Control', `${cache}, max-age=31536000, immutable`);
    res.setHeader('ETag', etag);
    res.setHeader('Content-Length', body.length);
    res.statusCode = 200;
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    res.end(body);
  };

  const authed = requireAuth ? requireAuth(servePhoto) : servePhoto;
  router.get('/media/*', authed);
  router.head('/media/*', authed);
}
