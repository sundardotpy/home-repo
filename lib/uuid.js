// UUID handling.
//
// The Go code used github.com/google/uuid, whose Parse is strict: a bare
// 36-character canonical UUID, or one of the accepted urn/braced/undashed
// spellings. Postgres itself is happy with any hex string, so this validation
// is what stops a typo in a URL from reaching the database as a 22P02 error.

const CANONICAL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNDASHED = /^[0-9a-f]{32}$/i;

/** Parse a UUID into canonical lowercase form, or null when it is not one. */
export function parseUUID(raw) {
  if (typeof raw !== 'string') return null;
  let s = raw.trim();

  if (s.toLowerCase().startsWith('urn:uuid:')) s = s.slice(9);
  else if (s.startsWith('{') && s.endsWith('}')) s = s.slice(1, -1);

  if (CANONICAL.test(s)) return s.toLowerCase();
  if (UNDASHED.test(s)) {
    const h = s.toLowerCase();
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  return null;
}

export const NIL_UUID = '00000000-0000-0000-0000-000000000000';

export function isNil(id) {
  return !id || id === NIL_UUID;
}

/** A fresh random UUID v4. */
export function newUUID() {
  return globalThis.crypto.randomUUID();
}
