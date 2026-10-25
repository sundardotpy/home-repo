// The derived values the UI leans on.

/**
 * FloorLabel turns a floor number into something readable. An explicit name
 * always wins, for the floors a number cannot describe.
 */
export function floorLabel(floor, name) {
  const n = (name ?? '').trim();
  if (n !== '') return n;
  if (floor === 0) return 'Ground floor';
  if (floor === -1) return 'Basement';
  if (floor < -1) return `Basement ${-floor}`;
  return `${ordinal(floor)} floor`;
}

function ordinal(n) {
  let suffix = 'th';
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 13) {
    // 11th, 12th, 13th
  } else if (mod10 === 1) suffix = 'st';
  else if (mod10 === 2) suffix = 'nd';
  else if (mod10 === 3) suffix = 'rd';
  return `${n}${suffix}`;
}

/**
 * newLocation is the "where is it" answer the search bar returns.
 * `unitPath` is null when the item sits loose in the room. `itemPath` holds
 * the ancestor item names when the item sits inside other items; `containerId`
 * names the item directly holding it.
 */
export function newLocation(roomId, roomName, floor, floorName, unitId, unitPath,
  containerId = null, itemPath = []) {
  const path = [roomName, ...(unitPath ?? []), ...(itemPath ?? [])];
  return {
    room_id: roomId,
    room_name: roomName,
    floor,
    floor_label: floorLabel(floor, floorName),
    storage_unit_id: unitId ?? null,
    container_id: containerId ?? null,
    path,
    // The floor stays out of the path string: it is only worth showing when a
    // home actually has more than one, which the UI decides.
    path_string: path.join(' > '),
  };
}

/**
 * photoURLs derives the public URLs from a stored photo key. Only the key lives
 * in the database, so the layout on disk can change without a migration.
 */
export function photoURLs(key) {
  if (!key) return { full: '', thumb: '' };
  return { full: `/media/${key}.jpg`, thumb: `/media/${key}_t.jpg` };
}

/**
 * newValue returns null unless the item has both a price and a purchase date.
 * A thing bought today counts as one day, so the figure is never a division by
 * zero and never claims a free item.
 */
export function newValue(price, purchasedOn, now = new Date()) {
  if (price === null || price === undefined) return null;
  if (purchasedOn === null || purchasedOn === undefined) return null;

  const bought = parseDateUTC(purchasedOn);
  if (!bought) return null;

  // Compare against today's UTC midnight, exactly as time.Date(...UTC) did.
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  let days = Math.floor((today - bought) / 86_400_000);
  if (days < 1) days = 1;

  // Go: float64(int64(price/days*100+0.5)) / 100 — round half away from zero.
  const perDay = Math.trunc((price / days) * 100 + 0.5) / 100;
  return { days, per_day: perDay };
}

/**
 * Strict YYYY-MM-DD parse to a UTC epoch, returning null when the string is not
 * a real calendar date. Values such as "2025-13-01" and "03/01/2025" are rejected;
 * Date.parse is far too forgiving, so the shape is checked by hand first.
 */
export function parseDateUTC(s) {
  if (typeof s !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const [, y, mo, d] = m.map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;

  const ms = Date.UTC(y, mo - 1, d);
  const back = new Date(ms);
  // Rejects overflow like 2025-02-30, which Date.UTC would roll into March.
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) {
    return null;
  }
  return ms;
}
