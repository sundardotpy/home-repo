// A single shared passcode, for a household app with no accounts. When
// APP_PASSCODE is set every data route (the API and the photos) demands a
// session cookie; when it is not, nothing changes. The app shell itself is
// public: it holds no data.
//
// The cookie is stateless — an expiry signed with a key derived from the
// passcode — because a serverless deployment has no memory between requests.
// Changing the passcode therefore signs everyone out.

import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

import { parseCookies, serializeCookie, writeErr } from './http.js';

export const SESSION_COOKIE = 'hr_session';
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export const MAX_FAILURES = 5;
export const FAILURE_WINDOW_MS = 15 * 60 * 1000;

// Routes that must stay reachable so a locked-out visitor can get back in.
const OPEN_PATHS = new Set(['/api/healthz', '/api/session', '/api/login', '/api/logout']);

export class Auth {
  #passcode;
  #key;

  // Failed attempts per address, in memory. On a serverless host each instance
  // counts for itself, so this slows guessing rather than stopping it: the real
  // defence is a long passcode, which is why a short one is refused at startup.
  #failures = new Map();

  constructor(passcode = '') {
    this.#passcode = passcode;
    this.#key = createHash('sha256').update(`home-repo-session|${passcode}`).digest();
  }

  get enabled() {
    return this.#passcode !== '';
  }

  get passcode() {
    return this.#passcode;
  }

  sign(expSeconds) {
    const msg = `v1.${expSeconds}`;
    const mac = createHmac('sha256', this.#key).update(msg).digest('hex');
    return `${msg}.${mac}`;
  }

  validToken(token, now = new Date()) {
    if (typeof token !== 'string') return false;
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== 'v1') return false;

    const exp = Number.parseInt(parts[1], 10);
    if (!Number.isSafeInteger(exp) || Math.floor(now.getTime() / 1000) > exp) return false;

    const expected = this.sign(exp);
    const a = Buffer.from(expected);
    const b = Buffer.from(token);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  authed(req) {
    if (!this.enabled) return true;
    const cookies = parseCookies(req.headers.cookie);
    return this.validToken(cookies[SESSION_COOKIE]);
  }

  /** Guards photos, which are plain <img> loads with no header to check. */
  requireAuth = (next) => async (req, res) => {
    if (!this.authed(req)) {
      writeErr(res, 401, 'passcode required');
      return;
    }
    await next(req, res);
  };

  /** Guards everything under /api except the routes needed to get in. */
  apiGate = (next) => async (req, res) => {
    if (OPEN_PATHS.has(req.pathname)) {
      await next(req, res);
      return;
    }
    await this.requireAuth(next)(req, res);
  };

  session(req, res) {
    writeJSON(res, 200, { required: this.enabled, authed: this.authed(req) });
  }

  async login(req, res) {
    if (!this.enabled) {
      writeJSON(res, 200, { ok: true });
      return;
    }

    let body;
    try {
      body = JSON.parse((await readAll(req)).toString('utf8'));
    } catch {
      writeErr(res, 400, 'invalid JSON body');
      return;
    }
    if (typeof body !== 'object' || body === null || typeof body.passcode !== 'string') {
      writeErr(res, 400, 'invalid JSON body', 'field "passcode" must be a string');
      return;
    }

    const ip = clientIP(req);
    if (this.tooManyFailures(ip)) {
      writeErr(res, 429, 'too many wrong attempts, try again in a few minutes');
      return;
    }

    // Digests, so the comparison does not depend on the passcode's length.
    const got = createHash('sha256').update(body.passcode).digest();
    const want = createHash('sha256').update(this.#passcode).digest();
    if (!timingSafeEqual(got, want)) {
      this.noteFailure(ip);
      await sleep(700); // a wrong guess is never quick
      writeErr(res, 401, 'that is not the passcode');
      return;
    }

    const secure = isHTTPS(req);
    const maxAge = SESSION_TTL_SECONDS;
    res.setHeader('Set-Cookie',
      serializeCookie(SESSION_COOKIE, this.sign(Math.floor(Date.now() / 1000) + maxAge), {
        maxAge, secure, httpOnly: true,
      }));
    writeJSON(res, 200, { ok: true });
  }

  logout(req, res) {
    res.setHeader('Set-Cookie',
      serializeCookie(SESSION_COOKIE, '', { maxAge: -1, secure: isHTTPS(req), httpOnly: true }));
    writeJSON(res, 200, { ok: true });
  }

  #recent(times, now) {
    return times.filter((t) => now - t < FAILURE_WINDOW_MS);
  }

  tooManyFailures(ip) {
    const now = Date.now();
    const kept = this.#recent(this.#failures.get(ip) ?? [], now);
    this.#failures.set(ip, kept);
    return kept.length >= MAX_FAILURES;
  }

  noteFailure(ip) {
    const now = Date.now();
    const kept = this.#recent(this.#failures.get(ip) ?? [], now);
    kept.push(now);
    this.#failures.set(ip, kept);
  }
}

// Small local copies so this module does not pull the whole HTTP surface in.
function writeJSON(res, status, value) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(value));
}

function readAll(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function isHTTPS(req) {
  return req.socket?.encrypted === true || req.headers['x-forwarded-proto'] === 'https';
}

/** The address to rate-limit on. */
export function clientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
}