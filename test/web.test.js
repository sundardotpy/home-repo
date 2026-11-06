// The static handler: compression negotiation and ETag revalidation.

import test from 'node:test';
import assert from 'node:assert/strict';
import { brotliDecompressSync } from 'node:zlib';

import { createWebHandler } from '../lib/web.js';

async function get(web, path, headers = {}) {
  const res = {
    statusCode: 0,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(b) { this.body = b ?? null; },
  };
  await web({ method: 'GET', pathname: path, headers }, res);
  return res;
}

test('text assets are brotli-compressed when accepted, plain otherwise', async () => {
  const web = createWebHandler();
  const br = await get(web, '/static/js/app.js', { 'accept-encoding': 'gzip, deflate, br' });
  assert.equal(br.statusCode, 200);
  assert.equal(br.headers['content-encoding'], 'br');
  assert.match(brotliDecompressSync(br.body).toString(), /import/);

  const plain = await get(web, '/static/js/app.js');
  assert.equal(plain.headers['content-encoding'], undefined);
  assert.ok(plain.body.length > br.body.length * 3, 'compression pays for itself');
});

test('a matching ETag answers 304 with no body', async () => {
  const web = createWebHandler();
  const first = await get(web, '/');
  assert.ok(first.headers.etag);
  const again = await get(web, '/', { 'if-none-match': first.headers.etag });
  assert.equal(again.statusCode, 304);
  assert.equal(again.body, null);
});

test('a locked-out visitor gets the shell marked locked, with its own ETag', async () => {
  let authed = false;
  const web = createWebHandler({ locked: () => !authed });

  const out = await get(web, '/');
  assert.match(out.body.toString(), /<html lang="en" data-locked>/);
  assert.match(out.headers.vary, /Cookie/);

  authed = true;
  const inside = await get(web, '/', { 'if-none-match': out.headers.etag });
  assert.equal(inside.statusCode, 200, "the locked shell's ETag must not validate the unlocked one");
  assert.doesNotMatch(inside.body.toString(), /data-locked/);
});

test('without a passcode the shell is never marked', async () => {
  const out = await get(createWebHandler(), '/');
  assert.doesNotMatch(out.body.toString(), /data-locked/);
});
