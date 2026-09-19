// The client store: cached views, plus a durable queue of optimistic mutations.
//
// The rule the whole UI is built on: a user action changes what is on screen
// immediately and unconditionally. The network confirms afterwards. If the
// server disagrees, we say so and put things back.

import { cache } from './cache.js';
import { ApiError, OfflineError, get, api } from './api.js';

const QUEUE_KEY = 'hsh.queue.v1';

const listeners = new Set();
const inflight = new Map(); // path -> promise, so N renders cause 1 request
const errors = new Map(); // path -> Error
const loading = new Set();
const active = new Set(); // paths the current screen depends on

let queue = loadQueue();
let idMap = {}; // temp id -> real id, for mutations queued before their parent saved
let flushing = false;
let retryTimer = null;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) fn();
}

function loadQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveQueue() {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

// ---------------------------------------------------------------- views ----

// peek returns whatever we already know about a path without touching the
// network — cached data, in-flight state, last error.
export function peek(path) {
  return {
    data: cache.get(path),
    loading: loading.has(path),
    error: errors.get(path),
    cached: cache.has(path),
  };
}

// load renders from cache first and revalidates in the background
// (stale-while-revalidate). `maxAge` decides when a background refresh is
// worth making; force skips the check entirely.
export function load(path, { force = false, maxAge = 30_000 } = {}) {
  active.add(path);
  if (!force && cache.has(path) && cache.ageOf(path) < maxAge) return Promise.resolve(cache.get(path));
  if (inflight.has(path)) return inflight.get(path);

  loading.add(path);
  if (!cache.has(path)) emit(); // no cached data: let the screen show skeletons

  const p = get(path)
    .then((data) => {
      cache.set(path, data);
      applyOverlays();
      errors.delete(path);
      return data;
    })
    .catch((err) => {
      // Offline with cached data is not an error state; it is just old data.
      if (!(err instanceof OfflineError) || !cache.has(path)) errors.set(path, err);
      throw err;
    })
    .finally(() => {
      loading.delete(path);
      inflight.delete(path);
      emit();
    });

  inflight.set(path, p);
  return p;
}

export function setActive(paths) {
  active.clear();
  for (const p of paths) active.add(p);
}

// revalidate refetches everything the current screen is showing. Called after a
// mutation lands, so server-computed fields (location paths, counts, ordering)
// replace our optimistic guesses.
export function revalidate() {
  for (const path of active) load(path, { force: true }).catch(() => {});
}

// ------------------------------------------------------------ mutations ----

export function pendingCount() {
  return queue.length;
}

export function failedMutations() {
  return queue.filter((m) => m.failed);
}

let seq = 0;
export function tempId() {
  seq += 1;
  return `tmp-${Date.now().toString(36)}-${seq}`;
}

export function isTemp(id) {
  return typeof id === 'string' && id.startsWith('tmp-');
}

// mutate applies the optimistic change now, queues the request, and returns
// immediately. Nothing in the UI ever awaits this.
export function mutate(m) {
  const entry = { id: tempId(), tries: 0, failed: false, ...m };
  applyOptimistic(entry);
  queue.push(entry);
  saveQueue();
  emit();
  flush();
  return entry;
}

export function retryFailed() {
  for (const m of queue) {
    if (m.failed) {
      m.failed = false;
      m.tries = 0;
    }
  }
  saveQueue();
  emit();
  flush();
}

export function discardFailed() {
  queue = queue.filter((m) => !m.failed);
  saveQueue();
  revalidate();
  emit();
}

function resolveId(id) {
  return idMap[id] || id;
}

// patchItem lets other modules (photo uploads) apply the same optimistic edits
// the mutation queue uses, without going through the queue itself.
export function patchItem(id, patch) {
  updateItemEverywhere(id, patch);
  emit();
}

// Overlays are client-only facts the server does not know yet — a photo picked
// two seconds ago that is still uploading. A plain patch would be wiped by the
// next revalidation, so overlays are re-applied to every response until the
// thing they describe actually exists server-side.
const overlays = new Map();

export function setItemOverlay(id, patch) {
  overlays.set(id, { ...(overlays.get(id) || {}), ...patch });
  updateItemEverywhere(id, patch);
  emit();
}

export function clearItemOverlay(id) {
  overlays.delete(id);
}

function applyOverlays() {
  for (const [id, patch] of overlays) updateItemEverywhere(id, patch);
}

// whenSaved resolves with an item's real id. For something created moments ago
// this waits for its POST to land, so a photo can be picked before the item
// itself exists on the server.
export function whenSaved(id) {
  if (!isTemp(id)) return Promise.resolve(id);
  if (idMap[id]) return Promise.resolve(idMap[id]);
  return new Promise((resolve, reject) => {
    const stop = subscribe(() => {
      if (idMap[id]) {
        stop();
        resolve(idMap[id]);
      } else if (!queue.some((m) => m.temp === id)) {
        stop();
        reject(new Error('the item itself was not saved'));
      }
    });
  });
}

// Rewrites any temp ids captured when the mutation was queued — e.g. adding an
// item to a storage unit that itself has not been saved yet.
function materialise(m) {
  const path = m.path.replace(/tmp-[a-z0-9-]+/g, (t) => resolveId(t));
  let body = m.body;
  if (body) {
    body = JSON.parse(
      JSON.stringify(body).replace(/tmp-[a-z0-9-]+/g, (t) => resolveId(t)),
    );
  }
  const blocked = /tmp-/.test(path) || (body && /tmp-/.test(JSON.stringify(body)));
  return { path, body, blocked };
}

async function flush() {
  if (flushing) return;
  flushing = true;
  try {
    while (queue.length) {
      const m = queue[0];
      if (m.failed) break; // a failed head blocks the queue: order matters

      const { path, body, blocked } = materialise(m);
      if (blocked) {
        // Its dependency failed and was discarded; this can never succeed.
        m.failed = true;
        m.error = 'the thing this belongs to was not saved';
        saveQueue();
        emit();
        break;
      }

      try {
        const result = await api(m.method, path, body);
        if (m.temp && result?.id) {
          idMap[m.temp] = result.id;
          adoptServerRecord(m, result);
        }
        queue.shift();
        saveQueue();
        emit();
      } catch (err) {
        m.tries += 1;
        if (err instanceof ApiError && err.permanent) {
          m.failed = true;
          m.error = err.detail || err.message;
          rollback(m);
          saveQueue();
          emit();
          break;
        }
        // Offline or a 5xx: keep the queue intact and try again later.
        scheduleRetry(m.tries);
        break;
      }
    }
  } finally {
    flushing = false;
    if (!queue.length) revalidate();
  }
}

function scheduleRetry(tries) {
  if (retryTimer) return;
  const delay = Math.min(30_000, 1000 * 2 ** Math.min(tries, 5));
  retryTimer = setTimeout(() => {
    retryTimer = null;
    flush();
  }, delay);
}

addEventListener('online', () => {
  clearTimeout(retryTimer);
  retryTimer = null;
  flush();
});

// Kick off anything left over from a previous visit.
if (queue.length) flush();

// ------------------------------------------------- optimistic cache edits ---

// Walk helpers: a mutation should be reflected in every cached screen that
// happens to show the affected record, not just the one in front of the user.

function eachItemList(data, fn) {
  if (!data || typeof data !== 'object') return;
  if (Array.isArray(data.items)) fn(data.items, 'items', data);
  if (Array.isArray(data.unplaced_items)) fn(data.unplaced_items, 'unplaced_items', data);
  if (Array.isArray(data.results)) fn(data.results, 'results', data);
}

function eachUnit(units, fn) {
  if (!Array.isArray(units)) return;
  for (const u of units) {
    fn(u);
    eachUnit(u.children, fn);
  }
}

function eachCachedView(fn) {
  for (const path of cache.keys()) {
    cache.patch(path, (data) => {
      fn(data, path);
      return data;
    });
  }
}

// Search results wrap the item; normalise so one code path handles both.
const itemOf = (row) => (row && row.item ? row.item : row);

function updateItemEverywhere(id, patch) {
  eachCachedView((data) => {
    eachItemList(data, (list) => {
      for (const row of list) {
        const it = itemOf(row);
        if (it?.id === id) {
          Object.assign(it, patch);
          if (row !== it) {
            row.name = it.name;
            row.quantity = it.quantity;
            row.tags = it.tags;
            row.location = it.location?.path_string || row.location;
          }
        }
      }
    });
  });
}

function removeItemEverywhere(id) {
  eachCachedView((data) => {
    eachItemList(data, (list, key, parent) => {
      const next = list.filter((row) => itemOf(row)?.id !== id);
      if (next.length !== list.length) parent[key] = next;
    });
  });
}

function bumpCounts(item, delta) {
  eachCachedView((data, path) => {
    if (path === '/rooms' && Array.isArray(data.rooms)) {
      for (const r of data.rooms) if (r.id === item.room_id) r.item_count += delta;
    }
    if (data.room?.id === item.room_id) data.room.item_count += delta;
    if (item.storage_unit_id) {
      eachUnit(data.storage_units, (u) => {
        if (u.id === item.storage_unit_id) u.item_count += delta;
      });
      eachUnit(data.children, (u) => {
        if (u.id === item.storage_unit_id) u.item_count += delta;
      });
      if (data.storage_unit?.id === item.storage_unit_id) data.storage_unit.item_count += delta;
    }
  });
}

function insertItem(item) {
  const target = item.storage_unit_id
    ? `/storage-units/${item.storage_unit_id}/contents`
    : `/rooms/${item.room_id}/tree`;
  const key = item.storage_unit_id ? 'items' : 'unplaced_items';
  cache.patch(target, (data) => {
    if (Array.isArray(data[key])) data[key] = [item, ...data[key]];
    return data;
  });
  // Deep views of ancestors also contain this item.
  cache.patch(`/rooms/${item.room_id}/items`, (data) => {
    if (Array.isArray(data.items)) data.items = [item, ...data.items];
    return data;
  });
  bumpCounts(item, 1);
}

function insertUnit(unit) {
  cache.patch(`/rooms/${unit.room_id}/tree`, (data) => {
    if (!unit.parent_id) {
      data.storage_units = [...(data.storage_units || []), unit];
    } else {
      eachUnit(data.storage_units, (u) => {
        if (u.id === unit.parent_id) u.children = [...(u.children || []), unit];
      });
    }
    return data;
  });
  if (unit.parent_id) {
    cache.patch(`/storage-units/${unit.parent_id}/contents`, (data) => {
      data.children = [...(data.children || []), unit];
      return data;
    });
  }
  cache.patch('/rooms', (data) => {
    for (const r of data.rooms || []) if (r.id === unit.room_id) r.storage_unit_count += 1;
    return data;
  });
}

function removeUnitEverywhere(id) {
  eachCachedView((data) => {
    const prune = (units) =>
      (units || []).filter((u) => u.id !== id).map((u) => ({ ...u, children: prune(u.children) }));
    if (Array.isArray(data.storage_units)) data.storage_units = prune(data.storage_units);
    if (Array.isArray(data.children)) data.children = prune(data.children);
    if (Array.isArray(data.storage_units_flat)) {
      data.storage_units_flat = data.storage_units_flat.filter((u) => u.id !== id);
    }
  });
  cache.drop(`/storage-units/${id}`);
}

function applyOptimistic(m) {
  switch (m.kind) {
    case 'room.create':
      cache.patch('/rooms', (data) => {
        data.rooms = [...(data.rooms || []), m.record];
        return data;
      });
      break;
    case 'room.update': {
      // record carries derived fields (floor_label) the request body has no
      // reason to include.
      const patch = m.record || m.body;
      cache.patch('/rooms', (data) => {
        for (const r of data.rooms || []) if (r.id === m.targetId) Object.assign(r, patch);
        return data;
      });
      cache.patch(`/rooms/${m.targetId}/tree`, (data) => {
        Object.assign(data.room, patch);
        return data;
      });
      break;
    }
    case 'room.delete':
      cache.patch('/rooms', (data) => {
        data.rooms = (data.rooms || []).filter((r) => r.id !== m.targetId);
        return data;
      });
      cache.drop(`/rooms/${m.targetId}`);
      break;
    case 'unit.create':
      insertUnit(m.record);
      break;
    case 'unit.update':
      eachCachedView((data) => {
        eachUnit(data.storage_units, (u) => {
          if (u.id === m.targetId) Object.assign(u, m.body);
        });
        eachUnit(data.children, (u) => {
          if (u.id === m.targetId) Object.assign(u, m.body);
        });
        if (data.storage_unit?.id === m.targetId) Object.assign(data.storage_unit, m.body);
      });
      break;
    case 'unit.delete':
      removeUnitEverywhere(m.targetId);
      break;
    case 'item.create':
      insertItem(m.record);
      break;
    case 'item.update':
      updateItemEverywhere(m.targetId, m.record);
      break;
    case 'item.move':
      removeItemEverywhere(m.targetId);
      insertItem(m.record);
      break;
    case 'item.delete':
      removeItemEverywhere(m.targetId);
      if (m.record) bumpCounts(m.record, -1);
      break;
  }
}

// The server's version of a record replaces our optimistic stand-in: real id,
// real location path, real timestamps.
function adoptServerRecord(m, result) {
  if (m.kind === 'item.create' || m.kind === 'item.move') {
    updateItemEverywhere(m.temp, result);
    return;
  }
  eachCachedView((data) => {
    for (const r of data.rooms || []) if (r.id === m.temp) Object.assign(r, result);
    eachUnit(data.storage_units, (u) => {
      if (u.id === m.temp) Object.assign(u, result);
    });
    eachUnit(data.children, (u) => {
      if (u.id === m.temp) Object.assign(u, result);
    });
  });
}

// A rejected mutation: take the optimistic record back out. The subsequent
// revalidate makes the server authoritative again.
function rollback(m) {
  switch (m.kind) {
    case 'item.create':
    case 'item.move':
      removeItemEverywhere(m.temp || m.targetId);
      break;
    case 'unit.create':
      removeUnitEverywhere(m.temp);
      break;
    case 'room.create':
      cache.patch('/rooms', (data) => {
        data.rooms = (data.rooms || []).filter((r) => r.id !== m.temp);
        return data;
      });
      break;
    default:
      break;
  }
  revalidate();
}
