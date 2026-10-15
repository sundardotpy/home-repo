// Tests for body decoding and the small request helpers.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  decodeJSON, normaliseTags, parseCookies, serializeCookie,
} from '../lib/http.js';
import {
  normaliseBarcode, normaliseProperties, validPurchase,
} from '../lib/api/items.js';

const ITEM = {
  name: 'str', quantity: 'int', tags: 'strArray', properties: 'strMap',
  room_id: 'uuid', purchase_price: 'num',
};

const decode = (obj) => decodeJSON(Buffer.from(JSON.stringify(obj)), ITEM);

test('absent, null and present are three different things', () => {
  // This distinction is what lets the handlers tell "leave it alone" from
  // "clear it" — absent and explicit null have different meanings.
  const { body } = decode({ name: 'Drill' });
  assert.equal('quantity' in body, false, 'absent stays absent');
  assert.equal(body.quantity, undefined);

  const cleared = decode({ quantity: null }).body;
  assert.equal(cleared.quantity, null);
  assert.equal('quantity' in cleared, true, 'an explicit null is still present');
});

test('unknown fields are rejected, as DisallowUnknownFields did', () => {
  assert.throws(() => decode({ name: 'Drill', colour: 'red' }), /unknown field "colour"/);
});

test('type errors are reported with the field name', () => {
  assert.throws(() => decode({ quantity: 'three' }), /"quantity" must be a whole number/);
  assert.throws(() => decode({ quantity: 1.5 }), /whole number/);
  assert.throws(() => decode({ tags: 'a,b' }), /"tags" must be an array of strings/);
  assert.throws(() => decode({ tags: [1] }), /array of strings/);
  assert.throws(() => decode({ room_id: 'not-a-uuid' }), /"room_id" must be a UUID/);
  assert.throws(() => decode({ name: 42 }), /"name" must be a string/);
  assert.throws(() => decode({ purchase_price: 'free' }), /"purchase_price" must be a number/);
});

test('malformed and non-object bodies are refused', () => {
  assert.throws(() => decodeJSON(Buffer.from(''), ITEM), /unexpected end of JSON/);
  assert.throws(() => decodeJSON(Buffer.from('{'), ITEM));
  assert.throws(() => decodeJSON(Buffer.from('[1,2]'), ITEM), /expected a JSON object/);
  assert.throws(() => decodeJSON(Buffer.from('null'), ITEM), /expected a JSON object/);
});

test('raw records which keys were present', () => {
  const { raw } = decode({ purchase_price: null });
  assert.equal('purchase_price' in raw, true);
  assert.equal('purchased_on' in raw, false);
});

test('uuids are canonicalised', () => {
  // 8-4-4-4-12, the only shape Postgres and the Go parser both accept.
  const upper = 'A1B2C3D4-E5F6-4A7B-8C9D-0E1F2A3B4C5D';
  const lower = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

  assert.equal(decode({ room_id: upper }).body.room_id, lower);
  assert.equal(decode({ room_id: `{${lower}}` }).body.room_id, lower);
  assert.equal(decode({ room_id: `urn:uuid:${upper}` }).body.room_id, lower);
  assert.equal(decode({ room_id: lower.replace(/-/g, '') }).body.room_id, lower);
  assert.equal(decode({ room_id: '00000000000000000000000000000000' }).body.room_id, '0'.repeat(8) + '-0000-0000-0000-' + '0'.repeat(12));
  // A malformed id is refused at the door rather than reaching Postgres as a
  // 22P02 error.
  assert.throws(() => decode({ room_id: 'not-a-uuid' }), /"room_id" must be a UUID/);
  assert.throws(() => decode({ room_id: 'a1b2c3d4-e5f6-4a7b-8c9d' }), /must be a UUID/);
});

test('properties are decoded verbatim; trimming is the handler\'s job', () => {
  // strMap stays literal. normaliseProperties() in the item handler is what
  // collapses key whitespace and trims values.
  const { body } = decode({ properties: { '  Serial   Number ': ' AB-12 ' } });
  assert.deepEqual(body.properties, { '  Serial   Number ': ' AB-12 ' });

  assert.equal(normaliseProperties({ '  Serial   Number ': ' AB-12 ' })['Serial Number'], 'AB-12');
  assert.deepEqual(normaliseProperties({ '  ': 'x' }), {}, 'an empty key is dropped');
  assert.equal(normaliseProperties(null), null);
});

test('normaliseBarcode strips spaces and hyphens', () => {
  assert.equal(normaliseBarcode(' 400-638 323 '), '400638323');
  assert.equal(normaliseBarcode(''), '');
});

test('validPurchase bounds the price and the date', () => {
  assert.equal(validPurchase(null, null), '');
  assert.equal(validPurchase(0, '2025-01-03'), '');
  assert.equal(validPurchase(1e9, '2025-01-03'), '');
  assert.match(validPurchase(-1, null), /between 0 and 1,000,000,000/);
  assert.match(validPurchase(1e9 + 1, null), /between 0 and 1,000,000,000/);
  assert.match(validPurchase(null, '03/01/2025'), /must be a date like 2025-01-03/);
});

test('normaliseTags lowercases, trims and de-duplicates', () => {
  assert.deepEqual(normaliseTags(['Tools', ' tools ', 'SPARE Parts']), ['tools', 'spare parts']);
  assert.deepEqual(normaliseTags([]), []);
  assert.equal(normaliseTags(null), null, 'absent must stay distinguishable from empty');
  assert.equal(normaliseTags(undefined), null);
});

test('cookie round trip', () => {
  assert.deepEqual(parseCookies('hr_session=abc.def; other=1'), {
    hr_session: 'abc.def', other: '1',
  });
  assert.deepEqual(parseCookies(''), {});
  assert.equal(serializeCookie('hr_session', 'a b', { maxAge: 60, secure: true }),
    'hr_session=a%20b; Path=/; Max-Age=60; HttpOnly; Secure; SameSite=Lax');
  assert.ok(serializeCookie('hr_session', '', { maxAge: -1 }).includes('Max-Age=-1'));
});
