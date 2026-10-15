// A small router with `{param}` placeholders, a trailing `*` wildcard,
// middleware — globally and per group —
// and a 405 when the path exists but the method does not.
//
// Patterns compile to anchored regexes, so ordering between routes never
// matters and `/api/rooms/{roomID}` can never swallow `/api/rooms/{roomID}/tree`.

const PARAM = /^\{([A-Za-z_][A-Za-z0-9_]*)\}$/;

function compile(pattern) {
  const keys = [];
  const wildcard = pattern.endsWith('/*');
  const body = wildcard ? pattern.slice(0, -2) : pattern;

  const parts = body.split('/').map((seg) => {
    const m = PARAM.exec(seg);
    if (m) {
      keys.push(m[1]);
      return '([^/]+)';
    }
    return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });

  let source = `^${parts.join('/')}`;
  if (wildcard) {
    keys.push('*');
    source += '/(.*)';
  }
  source += '/?$'; // Accept both /rooms and /rooms/.
  return { regex: new RegExp(source), keys };
}

export class Router {
  #routes = [];
  #middleware = [];
  #group = [];
  #notFound = null;

  /** Middleware applied to every route, in registration order. */
  use(fn) {
    this.#middleware.push(fn);
    return this;
  }

  /**
   * Registers every route added inside `fn` behind `mw`, without creating a
   * separate router.
   */
  group(mw, fn) {
    const outer = this.#group;
    this.#group = [...outer, mw];
    try {
      fn(this);
    } finally {
      this.#group = outer;
    }
    return this;
  }

  add(method, pattern, handler) {
    this.#routes.push({
      method: method.toUpperCase(),
      pattern,
      ...compile(pattern),
      handler,
      middleware: [...this.#group],
    });
    return this;
  }

  get(p, h) { return this.add('GET', p, h); }
  post(p, h) { return this.add('POST', p, h); }
  patch(p, h) { return this.add('PATCH', p, h); }
  put(p, h) { return this.add('PUT', p, h); }
  delete(p, h) { return this.add('DELETE', p, h); }
  head(p, h) { return this.add('HEAD', p, h); }

  /** HEAD falls back to GET, following standard HTTP server behavior. */
  #lookup(method, pathname) {
    const want = method === 'HEAD' ? 'GET' : method;
    const allowed = new Set();
    for (const route of this.#routes) {
      const m = route.regex.exec(pathname);
      if (!m) continue;
      if (route.method !== want) {
        allowed.add(route.method);
        continue;
      }
      const params = {};
      route.keys.forEach((k, i) => {
        params[k] = decodeURIComponent(m[i + 1] ?? '');
      });
      return { route, params, allowed: null };
    }
    return allowed.size ? { route: null, params: null, allowed } : null;
  }

  notFound(handler) {
    this.#notFound = handler;
    return this;
  }

  /**
   * Dispatch one request. Global middleware runs first, then any middleware
   * the route's group added; when nothing matches, the notFound handler runs
   * inside the global middleware instead.
   */
  async handle(req, res) {
    // IncomingMessage (including Vercel's Node request) exposes `url`, not a
    // parsed pathname. Routing must use that before middleware dispatch begins.
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    req.pathname = decodeURI(url.pathname);
    req.query = url.searchParams;
    const hit = this.#lookup(req.method, req.pathname);

    const done = async () => {
      if (hit && hit.route) {
        req.params = hit.params;
        await hit.route.handler(req, res);
      } else if (hit && hit.allowed) {
        res.statusCode = 405;
        res.setHeader('Allow', [...hit.allowed].join(', '));
        res.end();
      } else {
        await this.#notFound?.(req, res);
      }
    };

    const chain = hit?.route
      ? [...this.#middleware, ...hit.route.middleware]
      : this.#middleware;

    try {
      await runMiddleware(chain, req, res, done);
    } catch (err) {
      if (!res.writableEnded && !res.headersSent) {
        res.statusCode = 500;
        res.end('internal error');
      }
      throw err;
    }
  }
}

function runMiddleware(mws, req, res, done) {
  let last = -1;

  function dispatch(i) {
    if (i <= last) return Promise.reject(new Error('next() called multiple times'));
    last = i;
    if (i === mws.length) return done();

    let next;
    let downstream;
    try {
      next = mws[i](req, res, () => {
        downstream = dispatch(i + 1);
        return downstream;
      });
    } catch (err) {
      return Promise.reject(err);
    }
    return Promise.resolve(next).then(() => downstream);
  }

  return dispatch(0);
}
