// Everything that differs between the two interfaces, and the small formatters
// shared by both. The interfaces share all their markup; they differ in
// colours (CSS), in a handful of words, and in how a place is written down.

const KEY = 'hsh.ui';

export const isRepo = () => document.documentElement.classList.contains('ui-repo');

// t('Save', 'Commit'): the Classic wording, then the Repo wording.
export const t = (classic, repo) => (isRepo() ? repo : classic);

export function currentUI() {
  try {
    return localStorage.getItem(KEY) === 'repo' ? 'repo' : 'classic';
  } catch {
    return 'classic';
  }
}

// Applying is the caller's job (theme.js), because the accent depends on it.
export function storeUI(mode) {
  try {
    if (mode === 'repo') localStorage.setItem(KEY, 'repo');
    else localStorage.removeItem(KEY);
  } catch {}
}

// "Electronics & Gadgets" -> "electronics-and-gadgets"
export const slug = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'untitled';

// A place, written for the current interface:
//   Classic  Office › Desk › Small container
//   Repo     office/desk/small-container/
export function pathText(parts = [], { trailing = true } = {}) {
  const list = parts.filter(Boolean);
  if (isRepo()) return list.map(slug).join('/') + (trailing && list.length ? '/' : '');
  return list.join(' › ');
}

// "2d", "3w", "5mo": short enough for a pill. Long form reads "2 days ago".
export function ago(ts, { long = false } = {}) {
  const secs = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000);
  const units = [
    [60, 'm', 'minute'],
    [3600, 'h', 'hour'],
    [86400, 'd', 'day'],
    [604800, 'w', 'week'],
    [2592000, 'mo', 'month'],
    [31536000, 'y', 'year'],
  ];
  if (secs < 60) return long ? 'just now' : 'now';
  let pick = units[0];
  for (const u of units) if (secs >= u[0]) pick = u;
  const n = Math.floor(secs / pick[0]);
  if (!long) return `${n}${pick[1]}`;
  return `${n} ${pick[2]}${n === 1 ? '' : 's'} ago`;
}

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ₹1,499 for whole amounts, ₹56.41 when the paise matter (a per-day figure).
export const rupees = (n) => `₹${inr.format(n)}`;
export const rupeesPerDay = (n) => `₹${inr2.format(n)}`;

// The bar a thing has to clear to count as good value, in ₹ per day. Stored on
// this device: it is a personal rule, not shared data.
const LINE_KEY = 'hsh.valueLine';
export const DEFAULT_LINE = 10;

export function valueLine() {
  try {
    const n = Number(localStorage.getItem(LINE_KEY));
    return n > 0 ? n : DEFAULT_LINE;
  } catch {
    return DEFAULT_LINE;
  }
}

export function setValueLine(n) {
  try {
    if (n === DEFAULT_LINE) localStorage.removeItem(LINE_KEY);
    else localStorage.setItem(LINE_KEY, String(n));
  } catch {}
}
