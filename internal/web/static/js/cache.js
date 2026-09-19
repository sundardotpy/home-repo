// Local cache. Every API GET response is stored under its own path, so a
// returning visitor sees their home instantly and the network only ever
// confirms what is already on screen.

const KEY = 'hsh.cache.v1';
const MAX_AGE = 1000 * 60 * 60 * 24 * 7; // a week; beyond that, start clean

let mem = {};
let writeTimer = null;

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const now = Date.now();
    for (const [k, v] of Object.entries(parsed)) {
      if (!v || typeof v.at !== 'number' || now - v.at > MAX_AGE) delete parsed[k];
    }
    return parsed;
  } catch {
    return {}; // corrupt or unavailable storage is not worth crashing over
  }
}

mem = read();

// Writes are debounced: a burst of optimistic edits should not hit localStorage
// (which is synchronous, on the main thread) once per keystroke.
function flush() {
  writeTimer = null;
  try {
    localStorage.setItem(KEY, JSON.stringify(mem));
  } catch {
    // Quota exceeded: drop the cache rather than wedge the app.
    mem = {};
    try {
      localStorage.removeItem(KEY);
    } catch {}
  }
}

function scheduleFlush() {
  if (writeTimer) return;
  writeTimer = setTimeout(flush, 400);
}

export const cache = {
  get(path) {
    return mem[path]?.data;
  },
  ageOf(path) {
    const at = mem[path]?.at;
    return at ? Date.now() - at : Infinity;
  },
  has(path) {
    return path in mem;
  },
  set(path, data) {
    mem[path] = { data, at: Date.now() };
    scheduleFlush();
  },
  // Patch cached data in place without resetting its age — used by optimistic
  // updates, which must not make stale data look fresh.
  patch(path, fn) {
    const entry = mem[path];
    if (!entry) return false;
    const next = fn(entry.data);
    if (next === undefined) return false;
    entry.data = next;
    scheduleFlush();
    return true;
  },
  drop(prefix) {
    for (const k of Object.keys(mem)) {
      if (k.startsWith(prefix)) delete mem[k];
    }
    scheduleFlush();
  },
  keys(prefix = '') {
    return Object.keys(mem).filter((k) => k.startsWith(prefix));
  },
  clear() {
    mem = {};
    scheduleFlush();
  },
};

// Persist immediately when the tab goes away; the debounce may not have fired.
addEventListener('pagehide', flush);
addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flush();
});
