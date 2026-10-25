import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

import { Auth } from '../lib/auth.js';
import { buildRouter } from '../lib/api/server.js';

function request(method, url, headers = {}) {
  const req = new PassThrough();
  req.method = method;
  req.url = url;
  req.headers = { host: 'localhost', ...headers };
  req.end();
  return req;
}

function response() {
  const res = new EventEmitter();
  res.statusCode = 200;
  res.headers = {};
  res.writableEnded = false;
  res.setHeader = (name, value) => { res.headers[name.toLowerCase()] = value; };
  res.end = (body) => {
    res.body = body;
    res.writableEnded = true;
    res.emit('finish');
  };
  return res;
}

test('raw API requests are gated, including photo and QR handlers', async () => {
  const auth = new Auth('a sufficiently long passcode');
  const router = buildRouter({
    auth, store: {}, media: {}, config: { mcpToken: '' },
    web: async (_req, res) => res.end(),
  });

  for (const [method, path] of [
    ['GET', '/api/scan?code=1234'],
    ['GET', '/api/qr/ABCD/target'],
    ['POST', '/api/items/00000000-0000-0000-0000-000000000001/photo'],
    ['DELETE', '/api/items/00000000-0000-0000-0000-000000000001/photo'],
  ]) {
    const res = response();
    await router.handle(request(method, path), res);
    assert.equal(res.statusCode, 401, `${method} ${path} must require a session`);
  }

  const session = response();
  await router.handle(request('GET', '/api/session'), session);
  assert.equal(session.statusCode, 200, 'login/session routes stay reachable');
  assert.deepEqual(JSON.parse(session.body), { required: true, authed: false });
});
