// Tests for the small application router.

import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';

import { Router } from '../lib/router.js';

function req(method, path) {
  const r = new PassThrough();
  r.method = method;
  r.url = path;
  r.pathname = path;
  r.headers = {};
  r.end();
  return r;
}

function res() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    writableEnded: false,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(b) { this.body = b ?? null; this.writableEnded = true; },
  };
}

test('params, wildcards and trailing slashes', async () => {
  const r = new Router();
  const seen = [];

  r.get('/api/rooms/{roomID}', (req, res) => { seen.push(req.params); res.end('room'); });
  r.get('/api/rooms/{roomID}/tree', (req, res) => { seen.push(req.params); res.end('tree'); });
  r.get('/media/*', (req, res) => { seen.push(req.params); res.end('media'); });
  r.get('/api/rooms', (req, res) => { res.end('list'); });

  const out = res();
  await r.handle(req('GET', '/api/rooms/abc-123'), out);
  assert.equal(out.body, 'room');
  assert.equal(seen[0].roomID, 'abc-123');

  const tree = res();
  await r.handle(req('GET', '/api/rooms/abc-123/tree'), tree);
  assert.equal(tree.body, 'tree', 'a longer path must not be swallowed by a shorter pattern');

  const list = res();
  await r.handle(req('GET', '/api/rooms'), list);
  assert.equal(list.body, 'list');

  const slash = res();
  await r.handle(req('GET', '/api/rooms/'), slash);
  assert.equal(slash.body, 'list', 'the router accepts both /rooms and /rooms/');

  const media = res();
  await r.handle(req('GET', '/media/items/ab/id_t.jpg'), media);
  assert.equal(media.body, 'media');
  assert.equal(seen[2]['*'], 'items/ab/id_t.jpg');
});

test('dispatch parses the raw request URL before matching routes', async () => {
  const r = new Router();
  r.get('/api/items', (req, res) => res.end(req.query.get('q')));

  const raw = new PassThrough();
  raw.method = 'GET';
  raw.url = '/api/items?q=drill';
  raw.headers = { host: 'localhost' };
  raw.end();

  const out = res();
  await r.handle(raw, out);
  assert.equal(out.body, 'drill');
});

test('middleware that calls next without returning it still awaits async handlers', async () => {
  const r = new Router();
  r.use((req, res, next) => { next(); });
  r.get('/wait', async (_req, res) => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    res.end('done');
  });

  const out = res();
  await r.handle(req('GET', '/wait'), out);
  assert.equal(out.body, 'done');
});

test('percent-encoded params are decoded', async () => {
  const r = new Router();
  let got;
  r.get('/api/tags/{tag}', (req, res) => { got = req.params.tag; res.end(); });
  await r.handle(req('GET', '/api/tags/spare%20parts'), res());
  assert.equal(got, 'spare parts');
});

test('405 when the path exists but the method does not', async () => {
  const r = new Router();
  r.get('/api/items', (req, res) => res.end('ok'));
  r.delete('/api/items', (req, res) => res.end('ok'));

  const out = res();
  await r.handle(req('POST', '/api/items'), out);
  assert.equal(out.statusCode, 405);
  assert.equal(out.headers.allow, 'GET, DELETE');
});

test('HEAD falls back to GET', async () => {
  const r = new Router();
  r.get('/healthz', (req, res) => res.end('ok'));
  const out = res();
  await r.handle(req('HEAD', '/healthz'), out);
  assert.equal(out.body, 'ok');
});

test('notFound runs when nothing matches', async () => {
  const r = new Router();
  r.get('/a', (req, res) => res.end('a'));
  r.notFound((req, res) => { res.statusCode = 404; res.end('nope'); });

  const out = res();
  await r.handle(req('GET', '/zzz'), out);
  assert.equal(out.statusCode, 404);
  assert.equal(out.body, 'nope');
});

test('global and group middleware both run, in order', async () => {
  const order = [];
  const r = new Router();

  r.use((req, res, next) => { order.push('global'); next(); });
  r.get('/open', (req, res) => res.end('open'));

  r.group((req, res, next) => {
    order.push('gate');
    if (!req.headers.token) { res.statusCode = 401; res.end(); return; }
    next();
  }, (g) => {
    g.get('/locked', (req, res) => res.end('locked'));
  });

  await r.handle(req('GET', '/open'), res());
  assert.deepEqual(order, ['global']);

  order.length = 0;
  const denied = res();
  await r.handle(req('GET', '/locked'), denied);
  assert.deepEqual(order, ['global', 'gate']);
  assert.equal(denied.statusCode, 401);

  order.length = 0;
  const r2 = req('GET', '/locked');
  r2.headers.token = 'yes';
  const allowed = res();
  await r.handle(r2, allowed);
  assert.deepEqual(order, ['global', 'gate']);
  assert.equal(allowed.body, 'locked');
});

test('a throwing middleware produces a 500 rather than a hang', async () => {
  const r = new Router();
  r.use(() => { throw new Error('boom'); });
  r.get('/x', (req, res) => res.end('x'));

  const out = res();
  await assert.rejects(() => r.handle(req('GET', '/x'), out));
  assert.equal(out.statusCode, 500);
});
