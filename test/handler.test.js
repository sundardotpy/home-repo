// Exercise the serverless entrypoint, including its cached app build.
// Skipped without a database, since that is all this can meaningfully test.

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

import handler, { close } from '../api/index.js';

const DB = process.env.DATABASE_URL;
// These tests write and delete real rows, so a DATABASE_URL that points at a
// hosted database must be an explicit choice, not an accident of the shell.
const host = DB ? new URL(DB).hostname : '';
const isLocal = ['localhost', '127.0.0.1', '::1', 'db'].includes(host);
const skip = !DB
  ? 'DATABASE_URL not set'
  : !isLocal && !process.env.ALLOW_REMOTE_TEST_DB
    ? `DATABASE_URL is remote (${host}); set ALLOW_REMOTE_TEST_DB=1 to allow`
    : false;

after(close);

function invoke(method, url, headers = {}, body) {
  const req = new PassThrough();
  req.method = method;
  req.url = url;
  req.headers = { host: 'localhost', ...headers };
  req.socket = {};
  if (body !== undefined) req.write(body);
  req.end();

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

  return handler(req, res).then(() => ({
    status: res.statusCode,
    text: Buffer.isBuffer(res.body) ? res.body.toString('utf8') : String(res.body ?? ''),
    headers: res.headers,
  }));
}

test('the entrypoint serves the app', { skip }, async () => {
  const cases = [
      { path: '/healthz', status: 200, want: '"status":"ok"' },
      { path: '/api/healthz', status: 200, want: '"status":"ok"' },
      { path: '/api/rooms', status: 200, want: '"rooms"' },
      { path: '/', status: 200, want: '<title>Home Repo</title>' },
      { path: '/static/js/app.js', status: 200, want: 'import' },
      { path: '/static/css/app.css', status: 200 },
      { path: '/api/nope', status: 404 },
      { path: '/api/tags', status: 200, want: '"tags"' },
      { path: '/api/properties', status: 200, want: '"properties"' },
      { path: '/api/activity', status: 200, want: '"moves"' },
  ];

  for (const c of cases) {
    const got = await invoke('GET', c.path);
    assert.equal(got.status, c.status,
      `GET ${c.path}: got ${got.status}, want ${c.status} (${got.text.slice(0, 120)})`);
    if (c.want) assert.ok(got.text.includes(c.want), `GET ${c.path}: body lacks ${c.want}`);
  }

  // The API router accepts trailing slashes and still returns JSON.
  const trailingSlash = await invoke('GET', '/api/rooms/');
  assert.equal(trailingSlash.status, 200);
  assert.ok(trailingSlash.text.includes('"rooms"'));

  // An unknown static asset is a 404, not the app shell.
  assert.equal((await invoke('GET', '/static/js/nope.js')).status, 404);

  // URL normalization leaves this outside /static/, so it gets the SPA shell;
  // it must never expose the requested filesystem path.
  const traversal = await invoke('GET', '/static/../../../../etc/passwd');
  assert.equal(traversal.status, 200);
  assert.ok(traversal.text.includes('<title>Home Repo</title>'));
  assert.ok(!traversal.text.includes('root:'), 'no file contents leaked');
});

test('the entrypoint reports a startup failure instead of a bare 500', { skip: false }, async () => {
  // The handler is already built (or failed) by the test above; this only
  // asserts the shape of the failure path when no database is configured.
  if (DB) return;

  const res = await invoke('GET', '/healthz');
  assert.equal(res.status, 503);
  assert.match(res.text, /service unavailable: DATABASE_URL is required/);
});

test('duplicates answer 409, not 500', { skip }, async () => {
  // Unique-violation errors from Postgres must reach the API as conflict
  // sentinels; unmapped they leak as 500s.
  const json = { 'content-type': 'application/json' };
  const run = randomUUID().slice(0, 8);
  const post = (path, payload) => invoke('POST', path, json, JSON.stringify(payload));
  const patch = (path, payload) => invoke('PATCH', path, json, JSON.stringify(payload));

  const room = await post('/api/rooms', { name: `Conflict ${run}` });
  assert.equal(room.status, 201);
  const roomId = JSON.parse(room.text).id;

  const other = await post('/api/rooms', { name: `Other ${run}` });
  assert.equal(other.status, 201);
  const otherId = JSON.parse(other.text).id;

  try {
    // Room names are unique per floor, case-insensitively.
    const dupRoom = await post('/api/rooms', { name: `conflict ${run}` });
    assert.equal(dupRoom.status, 409);
    assert.match(dupRoom.text, /already exists/);

    // Renaming into a taken name hits the same index via UPDATE.
    const rename = await patch(`/api/rooms/${otherId}`, { name: `Conflict ${run}` });
    assert.equal(rename.status, 409);

    // Sibling unit names are unique within a parent.
    const unit = await post('/api/storage-units', { room_id: roomId, name: 'Box' });
    assert.equal(unit.status, 201);
    const unitId = JSON.parse(unit.text).id;
    const dupUnit = await post('/api/storage-units', { room_id: roomId, name: 'box' });
    assert.equal(dupUnit.status, 409);

    // A code override that re-points a label already in use.
    const second = await post('/api/storage-units', { room_id: roomId, name: 'Second' });
    assert.equal(second.status, 201);
    const secondId = JSON.parse(second.text).id;
    const slug = `dup${run}`;
    assert.equal((await patch(`/api/storage-units/${unitId}`, { qr_slug: slug })).status, 200);
    const dupSlug = await patch(`/api/storage-units/${secondId}`, { qr_slug: slug });
    assert.equal(dupSlug.status, 409);
  } finally {
    await invoke('DELETE', `/api/rooms/${roomId}?cascade=true`);
    await invoke('DELETE', `/api/rooms/${otherId}?cascade=true`);
  }
});
