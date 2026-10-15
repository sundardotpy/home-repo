// QR labels and scan resolution.

import { writeErr, writeJSON, writeStoreErr } from '../http.js';
import { log } from '../log.js';
import { png, svg } from '../qr.js';
import { getStorageUnitBySlug } from '../store/unit.js';
import { listItems } from '../store/item.js';

export function normaliseSlug(s) {
  return String(s ?? '').trim().toUpperCase();
}

/** A label code is 4 to 24 uppercase alphanumerics — nothing else. */
export function validSlug(s) {
  return /^[A-Z0-9]{4,24}$/.test(s);
}

/**
 * What gets encoded into the label. It has to be absolute — a phone camera app
 * opens it directly, with no app context to resolve a relative path.
 */
function scanURL(s, req, slug) {
  if (s.baseURL) return `${s.baseURL.replace(/\/+$/, '')}/q/${slug}`;

  // Not configured: mirror however the client reached us. Good enough for a
  // home LAN, where the host is a machine name or an IP.
  let scheme = 'http';
  const proto = req.headers['x-forwarded-proto'];
  if (proto) scheme = proto;
  else if (req.socket?.encrypted) scheme = 'https';

  let host = req.headers.host ?? '';
  const fwd = req.headers['x-forwarded-host'];
  if (fwd) host = fwd;

  return `${scheme}://${host}/q/${slug}`;
}

export function registerQRCodes(router, s) {
  /**
   * The one endpoint the scanner talks to. It does not care whether the camera
   * saw one of our QR labels or a manufacturer's barcode.
   */
  router.get('/api/scan', async (req, res) => {
    const raw = (req.query.get('code') ?? '').trim();
    if (raw === '') {
      writeErr(res, 400, 'code is required');
      return;
    }

    // A scanned label gives a whole URL; keep the last path segment.
    let candidate = raw;
    const marker = candidate.lastIndexOf('/q/');
    if (marker >= 0) candidate = candidate.slice(marker + 3);
    const q = candidate.indexOf('?');
    if (q >= 0) candidate = candidate.slice(0, q);
    const hash = candidate.indexOf('#');
    if (hash >= 0) candidate = candidate.slice(0, hash);

    const slug = normaliseSlug(candidate);
    if (validSlug(slug)) {
      try {
        const unit = await getStorageUnitBySlug(s.store, slug);
        writeJSON(res, 200, {
          kind: 'storage_unit',
          storage_unit: unit,
          app_url: `/#/unit/${unit.id}`,
        });
        return;
      } catch {
        // Not a unit we know; fall through and try it as a barcode.
      }
    }

    const code = raw.trim().replace(/[ -]/g, '');
    const { items } = await listItems(s.store, { barcode: code, limit: 50 });

    if (items.length === 1) {
      writeJSON(res, 200, {
        kind: 'item',
        item: items[0],
        items,
        barcode: code,
        app_url: `/#/item/${items[0].id}`,
      });
      return;
    }
    if (items.length > 1) {
      // Several of the same product: let the user pick which one they mean.
      writeJSON(res, 200, { kind: 'items', items, barcode: code });
      return;
    }

    // Nothing knows this code yet — the caller can offer to attach it.
    writeJSON(res, 404, {
      kind: 'unknown', barcode: code, error: 'no item or storage unit has that code',
    });
  });

  /**
   * Serves the label artwork for a slug. The slug is validated against the
   * database so a printed label always corresponds to a real unit.
   */
  const qrImage = async (req, res) => {
    const slug = normaliseSlug(req.params.slug);
    let unit;
    try {
      unit = await getStorageUnitBySlug(s.store, slug);
    } catch (err) {
      writeStoreErr(res, err);
      return;
    }

    const target = scanURL(s, req, unit.qr_slug);
    const wantsPng = req.pathname.endsWith('/png');

    try {
      const body = wantsPng ? await png(target) : await svg(target);
      res.statusCode = 200;
      res.setHeader('Content-Type', wantsPng ? 'image/png' : 'image/svg+xml');
      // The slug never changes for a unit, but the encoded host can, so this is
      // cached for a while rather than forever.
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Content-Length', body.length);
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch (err) {
      log.error('render qr', { err, slug });
      writeErr(res, 500, 'could not render the QR code');
    }
  };

  router.get('/api/qr/{slug}/target', async (req, res) => {
    const slug = normaliseSlug(req.params.slug);
    try {
      const unit = await getStorageUnitBySlug(s.store, slug);
      writeJSON(res, 200, {
        storage_unit: unit,
        scan_url: scanURL(s, req, unit.qr_slug),
        app_url: `/#/unit/${unit.id}`,
      });
    } catch (err) {
      writeStoreErr(res, err);
    }
  });

  router.get('/api/qr/{slug}/svg', qrImage);
  router.get('/api/qr/{slug}/png', qrImage);

  /**
   * Handles the URL printed on the label: a phone camera opens it and lands
   * inside the app, on the unit it belongs to.
   */
  router.get('/q/{slug}', async (req, res) => {
    const slug = normaliseSlug(req.params.slug);
    try {
      const unit = await getStorageUnitBySlug(s.store, slug);
      res.statusCode = 303;
      res.setHeader('Location', `/#/unit/${unit.id}`);
      res.end();
    } catch {
      // An unknown code should still land somewhere useful, not on a 404.
      res.statusCode = 303;
      res.setHeader('Location', `/#/?unknown_code=${slug}`);
      res.end();
    }
  });
}
