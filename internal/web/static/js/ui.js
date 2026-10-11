// Presentation helpers: escaping, icons, skeletons, rows, toasts, sheets.

import { itemIconSVG } from './item-icons.js';
import { ago, pathText, rupeesPerDay, valueLine } from './look.js';

export const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const ICONS = {
  back: '<path d="M15 18l-6-6 6-6"/>',
  chevron: '<path d="M9 18l6-6-6-6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  home: '<path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  box: '<path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5L12 12l9-4.5M12 12v9"/>',
  door: '<path d="M4 21V4a1 1 0 011-1h10a1 1 0 011 1v17"/><path d="M2 21h20"/><circle cx="13" cy="12" r="1"/>',
  trash: '<path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13"/>',
  pencil: '<path d="M4 20h4L19 9a2 2 0 00-3-3L5 17v3z"/>',
  move: '<path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>',
  tag: '<path d="M3 3h7l11 11-7 7L3 10V3z"/><circle cx="7" cy="7" r="1.5"/>',
  cloud: '<path d="M7 18a4 4 0 010-8 5 5 0 019.6-1.5A3.5 3.5 0 0117 18H7z"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M4 12.5l5 5L20 7"/>',
  palette:
    '<path d="M12 3a9 9 0 100 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a4 4 0 004-4c0-4.4-4-8-9-8z"/><circle cx="8.5" cy="10.5" r="1"/><circle cx="12" cy="8" r="1"/><circle cx="15.5" cy="10" r="1"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 11-4 0v-.1A1.6 1.6 0 007.9 19l-.1.1A2 2 0 115 16.3l.1-.1a1.6 1.6 0 00-1.1-2.7H3a2 2 0 110-4h.1A1.6 1.6 0 005 7.9l-.1-.1A2 2 0 117.7 5l.1.1a1.6 1.6 0 002.7-1.1V3a2 2 0 114 0v.1A1.6 1.6 0 0016.1 5l.1-.1A2 2 0 1119 7.7l-.1.1a1.6 1.6 0 001.1 2.7H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z"/>',
  barcode:
    '<path d="M4 6v12M7 6v12M10 6v9M13 6v12M16 6v9M20 6v12"/>',
  camera:
    '<path d="M3 8a2 2 0 012-2h2l1.5-2h7L17 6h2a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/><circle cx="12" cy="12.5" r="3.5"/>',
  qr: '<path d="M4 4h5v5H4zM15 4h5v5h-5zM4 15h5v5H4z"/><path d="M15 15h2v2h-2zM19 15h1M15 19h2M19 19h1"/>',
  print:
    '<path d="M7 9V3h10v6"/><path d="M7 19H5a2 2 0 01-2-2v-4a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2h-2"/><path d="M7 15h10v6H7z"/>',
  scan: '<path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3"/><path d="M4 12h16"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  upload: '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 5 17 10"/><line x1="12" y1="5" x2="12" y2="15"/>',
  minus: '<path d="M5 12h14"/>',
  chart: '<path d="M5 20v-6M12 20V6M19 20v-9"/>',
  folder: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin: '<path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  file: '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
};

export const icon = (name, cls = 'w-5 h-5') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
     stroke-linecap="round" stroke-linejoin="round" class="${cls}" aria-hidden="true">${ICONS[name] || ''}</svg>`;

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Rooms need to be told apart at a glance — six identical door glyphs in a
// sidebar are decoration, not information. Each room gets a hue derived from
// its name (stable, no storage) and its initials.
const ROOM_HUES = [4, 22, 40, 92, 150, 174, 196, 220, 262, 320];

export function roomHue(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 100000;
  return ROOM_HUES[h % ROOM_HUES.length];
}

export function initials(name = '') {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export const roomBadge = (room, cls = 'w-9 h-9 text-[13px]') => `
  <span class="room-badge ${cls} rounded-lg grid place-items-center shrink-0 font-semibold tracking-tight"
        style="--room-h:${roomHue(room.name)}">${esc(initials(room.name))}</span>`;

// ------------------------------------------------------------ skeletons ----

// Shapes deliberately match the real rows below, so nothing shifts when the
// data lands.
export const skeletonRows = (n = 4) =>
  Array.from({ length: n })
    .map(
      () => `
      <div class="flex items-center gap-3 px-4 py-3.5">
        <div class="skeleton w-9 h-9 rounded-lg shrink-0"></div>
        <div class="flex-1 space-y-2">
          <div class="skeleton h-3.5" style="width:${45 + Math.random() * 35}%"></div>
          <div class="skeleton h-2.5" style="width:${25 + Math.random() * 25}%"></div>
        </div>
      </div>`,
    )
    .join('');

export const skeletonList = (n = 4) =>
  `<div class="surface divide-y divide-[var(--line)] overflow-hidden">${skeletonRows(n)}</div>`;

// ----------------------------------------------------------------- rows ----

export const sectionTitle = (text, action = '') => `
  <div class="flex items-center justify-between px-1 mt-6 mb-2">
    <h2 class="text-xs font-semibold uppercase tracking-wider text-[var(--ink-faint)]">${esc(text)}</h2>
    ${action}
  </div>`;

export const emptyState = (title, body, action = '') => `
  <div class="surface px-6 py-10 text-center fade-in">
    <div class="mx-auto w-11 h-11 rounded-full bg-[var(--sunken)] grid place-items-center text-[var(--ink-faint)]">
      ${icon('box', 'w-5 h-5')}
    </div>
    <p class="mt-3 font-medium">${esc(title)}</p>
    <p class="mt-1 text-sm text-[var(--ink-soft)]">${esc(body)}</p>
    ${action ? `<div class="mt-4">${action}</div>` : ''}
  </div>`;

const pendingDot = `
  <span class="inline-flex items-center gap-1 text-[11px] text-[var(--ink-faint)]">
    <span class="w-1.5 h-1.5 rounded-full bg-[var(--ink-faint)] animate-pulse"></span>saving
  </span>`;

export const roomRow = (room, pending, { showFloor = false } = {}) => `
  <a href="#/room/${esc(room.id)}"
     class="row-press flex items-center gap-3 px-4 py-3.5 ${pending ? 'is-pending' : ''}">
    ${roomBadge(room)}
    <span class="flex-1 min-w-0">
      <span class="block font-medium truncate">${esc(room.name)}</span>
      <span class="block text-[13px] text-[var(--ink-soft)] truncate">
        ${
          pending
            ? 'saving…'
            : [
                showFloor ? esc(room.floor_label) : '',
                `${plural(room.storage_unit_count || 0, 'unit', 'units')}`,
                `${plural(room.item_count || 0, 'item', 'items')}`,
              ]
                .filter(Boolean)
                .join(' · ')
        }
      </span>
    </span>
    <span class="text-[var(--ink-faint)]">${icon('chevron', 'w-4 h-4')}</span>
  </a>`;

export const unitRow = (unit, { pending = false, depth = 0 } = {}) => `
  <a href="#/unit/${esc(unit.id)}"
     class="row-press flex items-center gap-3 py-3 pr-4 ${pending ? 'is-pending' : ''}"
     style="padding-left:${16 + depth * 18}px">
    <span class="w-9 h-9 rounded-lg bg-[var(--sunken)] text-[var(--ink-soft)] grid place-items-center shrink-0">
      ${icon('box', 'w-4.5 h-4.5')}
    </span>
    <span class="flex-1 min-w-0">
      <span class="block font-medium truncate">${esc(unit.name)}</span>
      <span class="block text-[13px] text-[var(--ink-soft)] truncate">
        ${pending ? 'saving…' : [unit.kind, plural(unit.item_count || 0, 'item', 'items')].filter(Boolean).join(' · ')}
      </span>
    </span>
    <span class="text-[var(--ink-faint)]">${icon('chevron', 'w-4 h-4')}</span>
  </a>`;

const tagPills = (tags) =>
  (tags || [])
    .slice(0, 3)
    .map(
      (t) =>
        `<span class="px-1.5 py-0.5 rounded bg-[var(--sunken)] text-[11px] text-[var(--ink-soft)]">${esc(t)}</span>`,
    )
    .join('');

// Three ways to picture an item, in order of how much the user told us:
// a photo, a chosen icon, or the quantity badge.
export const itemAvatar = (item, cls = 'w-11 h-11') => {
  if (item.photo_thumb_url) {
    return `<span class="avatar ${cls} overflow-hidden bg-[var(--sunken)] shrink-0 relative">
      <img src="${esc(item.photo_thumb_url)}" alt="" loading="lazy" decoding="async"
           class="w-full h-full object-cover ${item._photo_uploading ? 'opacity-50' : ''}">
      ${
        item._photo_uploading
          ? `<span class="absolute inset-0 grid place-items-center">
               <span class="w-3 h-3 rounded-full bg-white/90 animate-pulse"></span>
             </span>`
          : ''
      }
    </span>`;
  }
  if (item.icon && itemIconSVG(item.icon)) {
    return `<span class="avatar ${cls} bg-[var(--color-accent-soft)] text-[var(--ink)] grid place-items-center shrink-0">
      ${itemIconSVG(item.icon, 'w-5 h-5')}
    </span>`;
  }
  return `<span class="avatar ${cls} bg-[var(--sunken)] grid place-items-center shrink-0 text-[var(--ink-soft)] text-[13px] font-medium">
    ${item.quantity > 1 ? `×${esc(item.quantity)}` : icon('tag', 'w-4 h-4')}
  </span>`;
};

export const itemRow = (item, { pending = false, showLocation = false } = {}) => `
  <button type="button" data-item="${esc(item.id)}"
     class="row-press w-full text-left flex items-start gap-3 px-4 py-3.5 ${pending ? 'is-pending' : ''}">
    ${itemAvatar(item)}
    <span class="flex-1 min-w-0">
      <span class="flex items-center gap-2">
        <span class="font-semibold truncate t-name">${esc(item.name)}</span>
        ${pending ? pendingDot : ''}
      </span>
      ${
        showLocation && item.location
          ? `<span class="block text-[13px] text-[var(--ink-soft)] truncate t-path">${esc(pathText(item.location.path))}</span>`
          : item.description
            ? `<span class="block text-[13px] text-[var(--ink-soft)] truncate">${esc(item.description)}</span>`
            : ''
      }
      ${item.tags?.length ? `<span class="flex gap-1 mt-1.5 flex-wrap">${tagPills(item.tags)}</span>` : ''}
    </span>
  </button>`;

export const listCard = (inner) =>
  `<div class="surface divide-y divide-[var(--line)] overflow-hidden">${inner}</div>`;

// Callers pass extra classes inside the attrs string (`data-save class="flex-1"`).
// Emitting that verbatim next to the component's own class= would produce two
// class attributes, and the browser keeps only the first — silently dropping
// the styling. So pull any caller class out and merge it into one attribute.
function mergeAttrs(attrs, base) {
  const m = attrs.match(/class="([^"]*)"/);
  const rest = m ? attrs.replace(m[0], '') : attrs;
  return `${rest} class="${base}${m ? ' ' + m[1] : ''}"`;
}

export const primaryButton = (label, attrs = '') =>
  `<button type="button" ${mergeAttrs(attrs, 'btn btn-primary')}>${label}</button>`;

export const ghostButton = (label, attrs = '') =>
  `<button type="button" ${mergeAttrs(attrs, 'btn btn-ghost')}>${label}</button>`;

export const addRow = (label, attrs = '') => `
  <button type="button" ${mergeAttrs(
    attrs,
    'row-press w-full flex items-center gap-3 px-4 py-3.5 text-[var(--ink)] font-semibold',
  )}>
    <span class="w-9 h-9 grid place-items-center shrink-0">${icon('plus', 'w-5 h-5')}</span>
    <span>${esc(label)}</span>
  </button>`;

export const breadcrumb = (parts) =>
  `<nav class="text-[13px] text-[var(--ink-soft)] truncate">${parts
    .map((p) =>
      p.href
        ? `<a class="hover:text-[var(--ink)]" href="${esc(p.href)}">${esc(p.label)}</a>`
        : esc(p.label),
    )
    .join('<span class="mx-1 text-[var(--ink-faint)]">›</span>')}</nav>`;

// --------------------------------------------------------------- toasts ----

const toastRoot = () => document.getElementById('toast-root');

export function toast(message, { action, onAction, tone = 'neutral', timeout = 4500 } = {}) {
  const el = document.createElement('div');
  el.className = `pointer-events-auto surface pop-in flex items-center gap-3 px-4 py-3 mb-2 text-sm ${
    tone === 'error' ? 'border-[var(--color-accent)]' : ''
  }`;
  el.innerHTML = `
    <span class="flex-1">${esc(message)}</span>
    ${action ? `<button type="button" class="font-medium text-[var(--accent-ink)] shrink-0">${esc(action)}</button>` : ''}`;
  if (action) {
    el.querySelector('button').addEventListener('click', () => {
      onAction?.();
      el.remove();
    });
  }
  toastRoot().appendChild(el);
  const kill = setTimeout(() => el.remove(), timeout);
  el.addEventListener('remove', () => clearTimeout(kill));
  return el;
}

// --------------------------------------------------------------- sheets ----

// Sheets stack. The tag picker, the icon grid and the barcode scanner are all
// opened from inside the item form, so a second sheet must sit on top of the
// first — closing the parent would throw away everything typed into it.
const sheets = [];

// A bottom sheet on phones, a centred dialog from `md` up.
export function openSheet({ title, body, onMount, onClose }) {
  const depth = sheets.length;
  const root = document.getElementById('sheet-root');
  const wrap = document.createElement('div');
  wrap.className = 'fixed inset-0 flex items-end md:items-center md:justify-center';
  wrap.style.zIndex = String(50 + depth * 2);
  wrap.innerHTML = `
    <div data-backdrop class="absolute inset-0 bg-black/35 fade-in"></div>
    <div role="dialog" aria-modal="true" aria-label="${esc(title)}"
         class="relative w-full md:max-w-lg bg-[var(--paper)] rounded-t-2xl md:rounded-2xl sheet-up
                max-h-[90dvh] overflow-y-auto"
         style="padding-bottom:env(safe-area-inset-bottom)">
      <div class="sticky top-0 bg-[var(--paper)] px-4 pt-3 pb-2 border-b border-[var(--line)] z-10">
        <div class="md:hidden mx-auto mb-2 h-1 w-9 rounded-full bg-[var(--line)]"></div>
        <div class="flex items-center gap-2">
          <h2 class="flex-1 font-semibold">${esc(title)}</h2>
          <button type="button" data-close class="w-9 h-9 grid place-items-center rounded-lg text-[var(--ink-soft)] active:bg-[var(--sunken)]">
            ${icon('close', 'w-5 h-5')}
          </button>
        </div>
      </div>
      <div data-body class="p-4">${body}</div>
    </div>`;
  root.appendChild(wrap);
  document.body.style.overflow = 'hidden';

  const close = () => {
    const at = sheets.indexOf(close);
    if (at < 0) return; // already closed
    sheets.splice(at, 1);
    wrap.remove();
    removeEventListener('keydown', onKey);
    if (!sheets.length) document.body.style.overflow = '';
    onClose?.(); // e.g. release the camera
  };
  const onKey = (e) => {
    // Only the topmost sheet answers Escape.
    if (e.key === 'Escape' && sheets[sheets.length - 1] === close) close();
  };
  sheets.push(close);

  wrap.querySelector('[data-backdrop]').addEventListener('click', close);
  wrap.querySelector('[data-close]').addEventListener('click', close);
  addEventListener('keydown', onKey);

  onMount?.(wrap.querySelector('[data-body]'), close);
  return close;
}

// Closes the topmost sheet only.
export function closeSheet() {
  sheets[sheets.length - 1]?.();
}

export function closeAllSheets() {
  while (sheets.length) sheets[sheets.length - 1]();
}

export const field = (label, inner, hint = '') => `
  <label class="block mb-4">
    <span class="block text-[13px] font-medium text-[var(--ink-soft)] mb-1.5">${esc(label)}</span>
    ${inner}
    ${hint ? `<span class="block text-xs text-[var(--ink-faint)] mt-1">${esc(hint)}</span>` : ''}
  </label>`;

export const inputCls =
  'w-full h-12 px-3.5 rounded-lg bg-[var(--sunken)] border border-transparent outline-none focus:border-[var(--ink)] focus:bg-[var(--paper)] transition-colors';

// ----------------------------------------------------------------- value ----

// What an item has cost per day, as a pill that is green under the user's line
// and amber over it. Nothing when the item has no price and date.
export function valuePill(item) {
  if (!item.value) return '';
  const good = item.value.per_day < valueLine();
  return `<span class="pill ${good ? 'pill-good' : 'pill-warn'}">${rupeesPerDay(item.value.per_day)}/day</span>`;
}

// One line of the "last put away" feed: what, where it went, and how long ago.
export const moveRow = (m) => `
  <button type="button" data-move-item="${esc(m.item_id)}"
     class="row-press w-full text-left flex items-center gap-3 px-4 py-3.5">
    ${itemAvatar({ icon: m.item_icon })}
    <span class="flex-1 min-w-0">
      <span class="block font-semibold truncate t-name">${esc(m.item_name)}</span>
      <span class="block text-[13px] text-[var(--ink-soft)] truncate t-path">${esc(pathText(m.to_path))}</span>
    </span>
    <span class="pill pill-quiet">${ago(m.moved_at)}</span>
  </button>`;
