// Small formatters shared by every screen.

// A place as one line of text, for toasts and hints: Office › Desk › Box.
export const pathText = (parts = []) => parts.filter(Boolean).join(' › ');

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
