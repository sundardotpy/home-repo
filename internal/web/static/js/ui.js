// Presentation helpers: escaping, icons, skeletons, rows, toasts, sheets.

import { itemIconSVG } from './item-icons.js';
import { ago, rupeesPerDay, valueLine } from './look.js';

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
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
  pin: '<path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  file: '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
};

export const icon = (name, cls = 'w-5 h-5') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
     stroke-linecap="round" stroke-linejoin="round" class="${cls}" aria-hidden="true">${ICONS[name] || ''}</svg>`;

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// One of six room tints (.tint-0 … .tint-5), picked exactly as the Android app
// picks it — Java's String.hashCode of the trimmed, lowercased name, floor-mod
// six — so a room is the same colour on both clients. ponytail: two rooms can
// share a tint; store one per room if households outgrow six.
export function roomTint(name = '') {
  const s = String(name).trim().toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return `tint-${((h % 6) + 6) % 6}`;
}

export function initials(name = '') {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// A room's drawer front: a 40px, 10px-radius square in its tint, holding its
// icon or its initial.
export const roomBadge = (room, cls = 'w-10 h-10 text-[16px]') => `
  <span class="room-badge ${roomTint(room.name)} ${cls} rounded-[10px] grid place-items-center shrink-0 font-medium"
        aria-hidden="true">${
          room.icon && itemIconSVG(room.icon) ? itemIconSVG(room.icon, 'w-[55%] h-[55%]') : esc(initials(room.name).slice(0, 1))
        }</span>`;

// The small top app bar every screen shares: back on pushed screens, a
// title-large title, icon actions trailing. `back` is an href, or true for
// history.back().
export const topBar = ({ title, back = '', sub = '', actions = '' }) => `
  <div class="flex items-center gap-1 h-16 px-1 md:pt-3 md:h-[4.75rem]">
    ${
      back === true
        ? `<button type="button" data-back class="topround" aria-label="Back">${icon('back', 'w-6 h-6')}</button>`
        : back
          ? `<a href="${esc(back)}" class="topround" aria-label="Back">${icon('back', 'w-6 h-6')}</a>`
          : '<span class="w-3"></span>'
    }
    <div class="flex-1 min-w-0 pl-1">
      <h1 class="text-[22px] leading-7 truncate">${title}</h1>
      ${sub}
    </div>
    ${actions}
  </div>`;

export const barAction = (iconName, label, attrs) =>
  `<button type="button" ${attrs} class="topround" aria-label="${esc(label)}">${icon(iconName, 'w-6 h-6')}</button>`;

// ------------------------------------------------------------ skeletons ----

// Shapes deliberately match the real rows below, so nothing shifts when the
// data lands.
export const skeletonRows = (n = 4) =>
  Array.from({ length: n })
    .map(
      () => `
      <div class="flex items-center gap-3.5 px-2 py-3">
        <div class="skeleton w-10 h-10 rounded-[14px] shrink-0"></div>
        <div class="flex-1 space-y-2">
          <div class="skeleton h-3.5" style="width:${45 + Math.random() * 35}%"></div>
          <div class="skeleton h-2.5" style="width:${25 + Math.random() * 25}%"></div>
        </div>
      </div>`,
    )
    .join('');

export const skeletonList = (n = 4) => `<div class="list -mx-2">${skeletonRows(n)}</div>`;

// ----------------------------------------------------------------- rows ----

// Sentence case at title-small in muted ink: 20px above, 4px below.
export const sectionTitle = (text, action = '') => `
  <div class="flex items-center justify-between min-h-12 mt-3 mb-0.5">
    <h2 class="section-title">${esc(text)}</h2>
    ${action}
  </div>`;

// A notice: a 40px outline icon, a title, the copy, an optional action.
export const emptyState = (title, body, action = '') => `
  <div class="px-8 py-10 text-center fade-in">
    <span class="text-[var(--outline)] inline-block">${icon('box', 'w-10 h-10')}</span>
    <p class="mt-3 text-[16px] leading-6 font-medium">${esc(title)}</p>
    <p class="mt-1 text-sm text-[var(--ink-soft)] text-pretty">${esc(body)}</p>
    ${action ? `<div class="mt-4">${action}</div>` : ''}
  </div>`;

const pendingDot = `
  <span class="inline-flex items-center gap-1 text-[11px] text-[var(--ink-faint)]">
    <span class="w-1.5 h-1.5 rounded-full bg-[var(--ink-faint)] animate-pulse"></span>saving
  </span>`;

export const roomRow = (room, pending, { showFloor = false } = {}) => `
  <a href="#/room/${esc(room.id)}"
     class="row-press flex items-center gap-3.5 px-2 py-3 ${pending ? 'is-pending' : ''}">
    ${roomBadge(room)}
    <span class="flex-1 min-w-0">
      <span class="block text-[16px] leading-6 font-medium truncate">${esc(room.name)}</span>
      <span class="block text-sm text-[var(--ink-soft)] truncate">
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
     class="row-press flex items-center gap-3.5 py-3 pr-2 ${pending ? 'is-pending' : ''}"
     style="padding-left:${8 + Math.min(depth, 3) * 10}px">
    <span class="w-10 h-10 rounded-[10px] bg-[var(--paper)] border border-[var(--line)] text-[var(--ink-soft)] grid place-items-center shrink-0">
      ${icon('box', 'w-5 h-5')}
    </span>
    <span class="flex-1 min-w-0">
      <span class="block text-[16px] leading-6 font-medium truncate">${esc(unit.name)}</span>
      <span class="block text-sm text-[var(--ink-soft)] truncate">
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
        `<span class="pill pill-quiet">${esc(t)}</span>`,
    )
    .join('');

// A location as drawer tabs down one spine. Past four levels the middle folds
// to an ellipsis tab. `from` is the place being shown (a room or box name):
// inside it, only the drawers below it are drawn, all slips.
export function drawerPath(parts = [], { from = '' } = {}) {
  let list = parts.filter(Boolean);
  const room = list[0];
  let relative = false;
  if (from) {
    const at = list.lastIndexOf(from);
    if (at >= 0) {
      list = list.slice(at + 1);
      relative = true;
    }
  }
  if (!list.length) return '';
  const shown = list.length > 4 ? [list[0], '…', ...list.slice(-2)] : list;
  const label = `In ${list.join(', ')}`;
  return `<span class="drawers" role="img" aria-label="${esc(label)}"><span>${shown
    .map((p, i) => {
      const isRoom = i === 0 && !relative;
      return `<span class="drawer-tab ${isRoom ? `is-room ${roomTint(room)}` : ''}"
        style="--indent:${Math.min(i, 3) * 10}px" title="${esc(p)}">${esc(p)}</span>`;
    })
    .join('')}</span></span>`;
}

// How an item is pictured, in order of what the user told us: a photo, a
// chosen icon, a brand monogram, then its initial. Always on its room's tint.
export const itemAvatar = (item, cls = 'w-10 h-10') => {
  const tint = roomTint(item.location?.path?.[0] ?? item.room_name ?? '');
  if (item.photo_thumb_url) {
    return `<span class="avatar ${tint} ${cls} overflow-hidden shrink-0 relative">
      <img src="${esc(item.photo_thumb_url)}" alt="" loading="lazy" decoding="async" width="40" height="40"
           class="w-full h-full object-cover ${item._photo_uploading ? 'opacity-50' : ''}">
      ${
        item._photo_uploading
          ? `<span class="absolute inset-0 grid place-items-center text-[11px] font-medium text-white bg-black/30">Saving</span>`
          : ''
      }
    </span>`;
  }
  const art = item.icon && itemIconSVG(item.icon, 'w-[55%] h-[55%]');
  return `<span class="avatar ${tint} ${cls} grid place-items-center shrink-0 text-[16px] font-medium" aria-hidden="true">
    ${art || esc(initials(item.name || '').slice(0, 1) || '·')}
  </span>`;
};

// One item per row: the avatar, the name with its quantity and status, then
// where it is as a drawer path (or its description when the place is obvious).
export const itemRow = (item, { pending = false, showLocation = false, from = '' } = {}) => `
  <button type="button" data-item="${esc(item.id)}"
     class="row-press w-full text-left flex items-start gap-3.5 px-2 py-3 ${pending ? 'is-pending' : ''}">
    ${itemAvatar(item)}
    <span class="flex-1 min-w-0">
      <span class="flex items-center gap-2 min-h-6">
        <span class="text-[16px] leading-6 font-medium truncate t-name">${esc(item.name)}</span>
        ${item.quantity > 1 ? `<span class="text-sm font-medium text-[var(--ink-soft)] shrink-0">×${esc(item.quantity)}</span>` : ''}
        ${item.status === 'decluttered' ? '<span class="pill pill-quiet shrink-0">Decluttered</span>' : ''}
        ${pending ? pendingDot : ''}
      </span>
      ${
        (showLocation || from) && item.location
          ? drawerPath(item.location.path, { from })
          : item.description
            ? `<span class="block text-sm text-[var(--ink-soft)] truncate">${esc(item.description)}</span>`
            : ''
      }
      ${item.tags?.length ? `<span class="flex gap-1 mt-1.5 flex-wrap">${tagPills(item.tags)}</span>` : ''}
    </span>
  </button>`;

export const listCard = (inner) => `<div class="list -mx-2">${inner}</div>`;

// Callers pass extra classes inside the attrs string (`data-save class="flex-1"`).
// Emitting that verbatim next to the component's own class= would produce two
// class attributes, and the browser keeps only the first — silently dropping
// the styling. So pull any caller class out and merge it into one attribute.
function mergeAttrs(attrs, base) {
  const m = attrs.match(/class="([^"]*)"/);
  const rest = m ? attrs.replace(m[0], '') : attrs;
  return `${rest} class="${base}${m ? ' ' + m[1] : ''}"`;
}

// A label that is only an icon gets a square target of its own.
const iconOnly = (label) => /^\s*<svg[\s\S]*<\/svg>\s*$/.test(label);

export const primaryButton = (label, attrs = '') =>
  `<button type="button" ${mergeAttrs(attrs, `btn btn-primary${iconOnly(label) ? ' btn-icon' : ''}`)}>${label}</button>`;

// Secondary but useful: what an empty state offers on a screen whose FAB is
// already the accent action.
export const tonalButton = (label, attrs = '') =>
  `<button type="button" ${mergeAttrs(attrs, `btn btn-tonal${iconOnly(label) ? ' btn-icon' : ''}`)}>${label}</button>`;

export const ghostButton = (label, attrs = '') =>
  `<button type="button" ${mergeAttrs(attrs, `btn btn-ghost${iconOnly(label) ? ' btn-icon' : ''}`)}>${label}</button>`;

export const addRow = (label, attrs = '') => `
  <button type="button" ${mergeAttrs(
    attrs,
    'row-press w-full flex items-center gap-3.5 px-2 py-3 text-[var(--accent-ink)] font-medium',
  )}>
    <span class="w-10 h-10 grid place-items-center shrink-0">${icon('plus', 'w-5 h-5')}</span>
    <span>${esc(label)}</span>
  </button>`;

export const breadcrumb = (parts) =>
  `<nav class="text-sm text-[var(--ink-soft)] truncate">${parts
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
  el.className = 'pointer-events-auto snackbar pop-in flex items-center gap-2 pl-4 pr-2 min-h-12 mb-2 text-sm';
  el.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  el.innerHTML = `
    <span class="flex-1 py-3.5">${esc(message)}</span>
    ${action ? `<button type="button" class="h-10 px-3 rounded-full font-medium shrink-0">${esc(action)}</button>` : ''}`;
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
         class="relative w-full md:max-w-lg bg-[var(--sheet)] rounded-t-[28px] md:rounded-[28px] sheet-up
                max-h-[90dvh] overflow-y-auto overscroll-contain shadow-[var(--shadow-sheet)]"
         style="padding-bottom:env(safe-area-inset-bottom)">
      <div class="sticky top-0 bg-[var(--sheet)] px-4 pt-2 pb-1 z-10">
        <div class="md:hidden mx-auto my-2 h-1 w-8 rounded-full bg-[var(--outline)] opacity-40"></div>
        <div class="flex items-center gap-2">
          <h2 class="flex-1 text-[22px] leading-7">${esc(title)}</h2>
          <button type="button" data-close aria-label="Close" class="topround">
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
    <span class="block text-sm font-medium text-[var(--ink-soft)] mb-1.5">${esc(label)}</span>
    ${inner}
    ${hint ? `<span class="block text-xs text-[var(--ink-faint)] mt-1">${esc(hint)}</span>` : ''}
  </label>`;

// Material's outlined field: 56px, a 1px outline that thickens to the accent.
export const inputCls =
  'w-full h-14 px-4 rounded-[6px] bg-transparent border border-[var(--outline)] outline-none focus:border-[var(--accent-ink)] focus:shadow-[inset_0_0_0_1px_var(--accent-ink)] transition-colors';

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
     class="row-press w-full text-left flex items-start gap-3.5 px-2 py-3">
    ${itemAvatar({ icon: m.item_icon, name: m.item_name, location: { path: m.to_path } })}
    <span class="flex-1 min-w-0">
      <span class="flex items-center gap-2 min-h-6">
        <span class="text-[16px] leading-6 font-medium truncate t-name">${esc(m.item_name)}</span>
        <span class="ml-auto text-xs text-[var(--ink-soft)] shrink-0">${ago(m.moved_at)}</span>
      </span>
      ${drawerPath(m.to_path)}
    </span>
  </button>`;
