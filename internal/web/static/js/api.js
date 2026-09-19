// Thin fetch wrapper over the phase 1 JSON API.

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error || `request failed (${status})`);
    this.status = status;
    this.detail = body?.detail || '';
    // 4xx means the request itself is wrong — retrying it will never help.
    this.permanent = status >= 400 && status < 500;
  }
}

export class OfflineError extends Error {
  constructor() {
    super('offline');
    this.permanent = false;
  }
}

export async function api(method, path, body) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new OfflineError();
  }

  if (res.status === 204) return null;

  let payload = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!res.ok) throw new ApiError(res.status, payload);
  return payload;
}

export const get = (path) => api('GET', path);
export const post = (path, body) => api('POST', path, body);
export const patch = (path, body) => api('PATCH', path, body);
export const del = (path) => api('DELETE', path);

export const qs = (params) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
};
