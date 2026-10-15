// QR rendering and scan-target helpers.

import test from 'node:test';
import assert from 'node:assert/strict';

import { png, svg } from '../lib/qr.js';
import { normaliseSlug, validSlug } from '../lib/api/qrcodes.js';
import { normaliseBarcode } from '../lib/api/items.js';

const TARGET = 'https://home-repo.example.com/q/4F2K9XQZ3M';

test('SVG is self-contained and scalable', async () => {
  const markup = await svg(TARGET);

  assert.match(markup, /^<svg /);
  assert.match(markup, /viewBox="/, 'it sizes with CSS, not fixed pixels');
  assert.match(markup, /shape-rendering="crispEdges"/);
  assert.match(markup, /<\/svg>$/);
  assert.ok(!markup.includes(TARGET), 'the payload is encoded in the modules, not the markup');
  assert.ok(markup.length > 100);
});

test('PNG is a real PNG', async () => {
  const buf = await png(TARGET);
  assert.ok(Buffer.isBuffer(buf));
  assert.equal(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'PNG magic');
  assert.ok(buf.length > 100);
});

test('a longer payload still renders', async () => {
  const long = 'https://a-very-long-deployment-name.vercel.app/q/' + 'X'.repeat(24);
  assert.ok((await svg(long)).length > 0);
  assert.ok((await png(long)).length > 0);
});

test('slug normalisation and validation', () => {
  assert.equal(normaliseSlug(' 4f2k9xqz3m '), '4F2K9XQZ3M');
  assert.equal(validSlug('4F2K9XQZ3M'), true);
  assert.equal(validSlug('ABC1'), true);          // 4 is the minimum
  assert.equal(validSlug('A1B2C3D4E5F6G7H8I9J0KL'), true); // 24 is the maximum
  assert.equal(validSlug('ABC'), false);          // too short
  assert.equal(validSlug('A1B2C3D4E5F6G7H8I9J0KLMNO'), false); // 25 is too long
  assert.equal(validSlug('4F2K-9XQ'), false);    // no punctuation
  assert.equal(validSlug(''), false);
  assert.equal(validSlug('4F2K 9X'), false);
});

test('barcode normalisation matches the scanner handlers', () => {
  assert.equal(normaliseBarcode(' 400638323 '), '400638323');
  assert.equal(normaliseBarcode('4-006-38323'), '400638323');
  assert.equal(normaliseBarcode(''), '');
});
