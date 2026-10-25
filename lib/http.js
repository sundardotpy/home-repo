// Request and response helpers.

import { parseUUID } from './uuid.js';
import { log } from './log.js';
import {
  ErrConflict, ErrCycle, ErrInvalid, ErrNotEmpty, ErrNotFound, ErrRoomCross,
  isKind,
} from './errors.js';

// ---------------------------------------------------------------- responses

export function writeJSON(res, status, value) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (value === null || value === undefined) {
    res.end();
    return;
  }
  const body = JSON.stringify(value);
  res.setHeader('Content-Length', Buffer.byteLength(body));
  res.end(body);
}

export function writeErr(res, status, message, detail) {
  const body = { error: message };
  if (detail) body.detail = detail;
  writeJSON(res, status, body);
}

export function noContent(res) {
  res.statusCode = 204;
  res.end();
}

/** Maps store sentinels onto status codes so handlers stay short. */
export function writeStoreErr(res, err) {
  if (isKind(err, ErrNotFound)) writeErr(res, 404, 'not found', err.detail);
  else if (isKind(err, ErrConflict)) writeErr(res, 409, 'already exists', conflictDetail(err.detail));
  else if (isKind(err, ErrNotEmpty)) {
    writeErr(res, 409, 'not empty',
      'it still holds storage units or items; pass ?cascade=true to delete everything inside');
  } else if (isKind(err, ErrCycle)) {
    writeErr(res, 400, 'invalid move', 'a storage unit cannot be moved inside itself');
  } else if (isKind(err, ErrRoomCross)) writeErr(res, 400, 'room mismatch', err.detail);
  else if (isKind(err, ErrInvalid)) writeErr(res, 400, 'invalid', err.detail);
  else {
    log.error('unhandled store error', { err });
    writeErr(res, 500, 'internal error');
  }
}

/**
 * A human-readable message for a store sentinel, shared with the MCP tools
 * where a model reads the text instead of the status code.
 */
export function storeErrMessage(err) {
  if (isKind(err, ErrNotFound)) return err.detail ? `not found: ${err.detail}` : 'not found';
  if (isKind(err, ErrConflict)) {
    const detail = conflictDetail(err.detail);
    return detail ? `already exists: ${detail}` : 'already exists';
  }
  if (isKind(err, ErrNotEmpty)) {
    return 'not empty: it still holds items; declutter them first or pass cascade';
  }
  if (isKind(err, ErrCycle)) return 'invalid move: a storage unit cannot be moved inside itself';
  if (isKind(err, ErrRoomCross)) return `room mismatch: ${err.detail}`;
  if (isKind(err, ErrInvalid)) return `invalid: ${err.detail}`;
  return err.message ?? 'internal error';
}

/**
 * Turns a constraint name into something a person can act on; the raw name
 * still ships in the log, not in the UI.
 */
function conflictDetail(raw) {
  if (!raw) return undefined;
  if (raw.includes('rooms_floor_name_key') || raw.includes('rooms_name_key')) {
    return 'a room with that name already exists on that floor';
  }
  if (raw.includes('storage_units_sibling_name_key')) {
    return 'there is already a storage unit with that name in the same place';
  }
  if (raw.includes('storage_units_qr_slug')) {
    return 'could not allocate a QR code; try again';
  }
  return raw;
}

// ------------------------------------------------------------------ decoding

/**
 * Field schemas. An absent key is `undefined`, an explicit null is `null`.
 * That distinction is
 * load-bearing — `"parent_id": null` moves a unit to the room root, while
 * omitting the key leaves it where it is.
 */
const TYPES = {
  str: (v, k) => {
    if (v === null) return null;
    if (typeof v !== 'string') throw typeErr(k, 'a string');
    return v;
  },
  int: (v, k) => {
    if (v === null) return null;
    if (typeof v !== 'number' || !Number.isInteger(v)) throw typeErr(k, 'a whole number');
    return v;
  },
  num: (v, k) => {
    if (v === null) return null;
    if (typeof v !== 'number' || !Number.isFinite(v)) throw typeErr(k, 'a number');
    return v;
  },
  bool: (v, k) => {
    if (v === null) return null;
    if (typeof v !== 'boolean') throw typeErr(k, 'a boolean');
    return v;
  },
  uuid: (v, k) => {
    if (v === null) return null;
    if (typeof v !== 'string') throw typeErr(k, 'a UUID string');
    const id = parseUUID(v);
    if (!id) throw typeErr(k, 'a UUID');
    return id;
  },
  strArray: (v, k) => {
    if (v === null) return null;
    if (!Array.isArray(v)) throw typeErr(k, 'an array of strings');
    for (const el of v) {
      if (typeof el !== 'string') throw typeErr(k, 'an array of strings');
    }
    return v;
  },
  strMap: (v, k) => {
    if (v === null) return null;
    if (typeof v !== 'object' || Array.isArray(v)) throw typeErr(k, 'an object');
    const out = {};
    for (const [key, val] of Object.entries(v)) {
      if (val === null) continue;
      if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
        out[key] = String(val);
      } else {
        throw typeErr(`${k}.${key}`, 'a string');
      }
    }
    return out;
  },
};

function typeErr(key, want) {
  return new Error(`field "${key}" must be ${want}`);
}

/**
 * Decode a JSON body against a schema, rejecting unknown fields. Returns
 * `{ raw, body }` where `raw` records which
 * keys were actually present.
 */
export function decodeJSON(buffer, schema) {
  const text = buffer.toString('utf8').trim();
  if (text === '') throw new Error('unexpected end of JSON input');

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(err.message);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('expected a JSON object');
  }

  const raw = {};
  const out = {};
  for (const [key, value] of Object.entries(parsed)) {
    const coerce = TYPES[schema[key]];
    if (!coerce) throw new Error(`unknown field "${key}"`);
    raw[key] = value;
    out[key] = coerce(value, key);
  }
  return { raw, body: out };
}

// ------------------------------------------------------------- request pieces

export const MAX_JSON_BODY = 1 << 20;

export function readBody(req, maxBytes = MAX_JSON_BODY) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
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
        resolve(Buffer.concat(chunks));
      }
    });
    req.on('error', reject);
  });
}

/** Decode a JSON request body, answering 400 itself on failure. */
export async function decode(req, res, schema) {
  let buffer;
  try {
    buffer = await readBody(req);
  } catch (err) {
    writeErr(res, err.tooLarge ? 413 : 400,
      err.tooLarge ? 'request body too large' : 'could not read body', err.message);
    return null;
  }
  try {
    const { body } = decodeJSON(buffer, schema);
    return body;
  } catch (err) {
    writeErr(res, 400, 'invalid JSON body', err.message);
    return null;
  }
}

/**
 * Like decode, but an empty body is an empty object and the set of keys that
 * were present is returned alongside — that is what tells handlers apart
 * between "field omitted" and "field set to null".
 */
export async function decodeWithKeys(req, res, schema) {
  let buffer;
  try {
    buffer = await readBody(req);
  } catch (err) {
    writeErr(res, err.tooLarge ? 413 : 400,
      err.tooLarge ? 'request body too large' : 'could not read body', err.message);
    return null;
  }
  if (buffer.toString('utf8').trim() === '') buffer = Buffer.from('{}');

  try {
    return decodeJSON(buffer, schema);
  } catch (err) {
    writeErr(res, 400, 'invalid JSON body', err.message);
    return null;
  }
}

export function urlID(req, res, key) {
  const id = parseUUID(req.params[key]);
  if (!id) {
    writeErr(res, 400, 'invalid id', req.params[key]);
    return null;
  }
  return id;
}

/** A UUID query parameter: absent yields null, malformed is an error. */
export function queryUUID(req, key) {
  const raw = req.query.get(key);
  if (raw === '' || raw === null || raw === undefined) return { value: null };
  const id = parseUUID(raw);
  if (!id) return { error: true };
  return { value: id };
}

export function queryBool(req, key) {
  const v = (req.query.get(key) ?? '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export function queryInt(req, key, fallback) {
  const raw = req.query.get(key);
  if (raw === '' || raw === null || raw === undefined) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isNaN(n) ? fallback : n;
}

/**
 * Trims, lowercases and de-duplicates so "Tools" and " tools " do not become
 * two different tags. Returns null when the caller passed nothing at all, which
 * the store reads as "leave the tag list alone".
 */
export function normaliseTags(input) {
  if (input === null || input === undefined) return null;
  const seen = new Set();
  const out = [];
  for (const t of input) {
    const v = t.toLowerCase().trim();
    if (v === '' || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

// ------------------------------------------------------------------- cookies

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    if (name === '') continue;
    out[name] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

export function serializeCookie(name, value, opts = {}) {
  const bits = [`${name}=${encodeURIComponent(value)}`];
  bits.push(`Path=${opts.path ?? '/'}`);
  if (opts.maxAge !== undefined) bits.push(`Max-Age=${Math.floor(opts.maxAge)}`);
  if (opts.expires) bits.push(`Expires=${opts.expires.toUTCString()}`);
  if (opts.httpOnly !== false) bits.push('HttpOnly');
  if (opts.secure) bits.push('Secure');
  bits.push('SameSite=Lax');
  return bits.join('; ');
}
