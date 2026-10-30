// Authentication behavior tests.

import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';

import {
  Auth, MAX_FAILURES, SESSION_COOKIE, SESSION_TTL_SECONDS, clientIP,
} from '../lib/auth.js';

const gated = (pass) => new Auth(pass);

/** A minimal stand-in for an IncomingMessage/ServerResponse pair. */
function fakeExchange({ method = 'GET', path = '/api/items', headers = {}, body = '' } = {}) {
  const req = new PassThrough();
  req.method = method;
  req.url = path;
  req.pathname = path; // the gate reads this, normally set by requestContext
  req.headers = { host: 'example.test', ...headers };
  req.socket = {};

  const chunks = [];
  req.on('data', (c) => chunks.push(c));

  const res = {
    statusCode: 200,
    headers: {},
    cookies: [],
    body: null,
    writableEnded: false,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(payload) {
      if (this.headers['set-cookie']) this.cookies = this.headers['set-cookie'].split(/, (?=[^;]+?=)/);
      this.body = payload ?? null;
      this.writableEnded = true;
    },
  };

  // Make the body readable on next tick, like a real socket would.
  process.nextTick(() => {
    req.end(body ? Buffer.from(body) : undefined);
  });

  return { req, res };
}

test('token round trip', () => {
  const auth = gated('correct horse battery');
  const now = new Date(1_800_000_000 * 1000);
  const exp = Math.floor(now.getTime() / 1000) + 3600;
  const tok = auth.sign(exp);

  assert.equal(auth.validToken(tok, now), true, 'a fresh token should be valid');
  assert.equal(auth.validToken(tok, new Date(now.getTime() + 7_200_000)), false,
    'an expired token should be refused');
  assert.equal(auth.validToken(tok + '0', now), false);
  assert.equal(auth.validToken('v1.99999999999.deadbeef', now), false);
  assert.equal(auth.validToken('', now), false);
  assert.equal(auth.validToken(undefined, now), false);
  assert.equal(gated('another passcode').validToken(tok, now), false,
    'a token must not survive a passcode change');
});

test('everything is open when no passcode is set', () => {
  const auth = gated('');
  const { req } = fakeExchange();
  assert.equal(auth.authed(req), true);
  assert.equal(auth.enabled, false);
});

test('data routes demand a session, the door stays reachable', async () => {
  const auth = gated('correct horse battery');
  const open = async (req, res) => { res.end('ok'); };
  const gatedOpen = auth.apiGate(open);

  for (const path of ['/api/healthz', '/api/session', '/api/login']) {
    const { req, res } = fakeExchange({ path });
    await gatedOpen(req, res);
    assert.notEqual(res.statusCode, 401, `${path} should stay reachable`);
  }

  const denied = fakeExchange({ path: '/api/items' });
  await gatedOpen(denied.req, denied.res);
  assert.equal(denied.res.statusCode, 401);

  // And the same path opens up with a valid cookie.
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const cookie = `${SESSION_COOKIE}=${encodeURIComponent(auth.sign(exp))}`;
  const allowed = fakeExchange({ path: '/api/items', headers: { cookie } });
  await gatedOpen(allowed.req, allowed.res);
  assert.notEqual(allowed.res.statusCode, 401);
});

test('login rejects the wrong passcode and sets an HttpOnly cookie for the right one', async () => {
  const auth = gated('correct horse battery');

  const wrong = fakeExchange({ method: 'POST', path: '/api/login', body: '{"passcode":"nope"}' });
  await auth.login(wrong.req, wrong.res);
  assert.equal(wrong.res.statusCode, 401);

  const right = fakeExchange({
    method: 'POST', path: '/api/login', body: '{"passcode":"correct horse battery"}',
  });
  await auth.login(right.req, right.res);
  assert.equal(right.res.statusCode, 200);

  const setCookie = right.res.headers['set-cookie'];
  assert.ok(setCookie.includes(SESSION_COOKIE), 'a session cookie is set');
  assert.ok(setCookie.includes('HttpOnly'), 'and it is HttpOnly');
  assert.ok(setCookie.includes(`Max-Age=${SESSION_TTL_SECONDS}`));
});

test('logout clears the cookie', async () => {
  const auth = gated('correct horse battery');
  const { req, res } = fakeExchange({ method: 'POST', path: '/api/logout' });
  await auth.logout(req, res);
  assert.equal(res.statusCode, 200);
  assert.ok(res.headers['set-cookie'].includes('Max-Age=-1'));
});

test('lockout after repeated failures', () => {
  const auth = gated('correct horse battery');
  const ip = '203.0.113.7:5555';
  for (let i = 0; i < MAX_FAILURES; i++) auth.noteFailure(ip);
  assert.equal(auth.tooManyFailures(ip), true);
  assert.equal(auth.tooManyFailures('198.51.100.1:1'), false);
});

test('clientIP prefers the forwarded address', () => {
  assert.equal(
    clientIP({ headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }, socket: {} }),
    '203.0.113.7');
  assert.equal(clientIP({ headers: {}, socket: { remoteAddress: '10.0.0.1' } }), '10.0.0.1');
});

test('session reports required and authed', () => {
  const auth = gated('correct horse battery');
  assert.equal(auth.enabled, true);
  const open = gated('');
  assert.equal(open.enabled, false);
});

test('login refuses an oversized body instead of buffering it', async () => {
  const auth = new Auth('correct horse battery');
  const big = fakeExchange({ method: 'POST', path: '/api/login', body: `{"passcode":"${'x'.repeat(10_000)}"}` });
  await auth.login(big.req, big.res);
  assert.equal(big.res.statusCode, 400);
});
