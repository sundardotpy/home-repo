import { currentUI, isRepo, storeUI } from './look.js';
import { esc, icon, openSheet, toast } from './ui.js';

const KEY = 'hsh.accent';
const MODE_KEY = 'hsh.theme';
export const DEFAULT_ACCENT = '#efe34a';

export const ACCENTS = [
  { name: 'Yellow', hex: '#efe34a' },
  { name: 'Lavender', hex: '#b9a8f2' },
  { name: 'Coral', hex: '#f28b72' },
  { name: 'Green', hex: '#6ccb9a' },
  { name: 'Blue', hex: '#6d9bf5' },
  { name: 'Pink', hex: '#f283b6' },
  { name: 'Orange', hex: '#f5a623' },
  { name: 'Graphite', hex: '#5b6470' },
];

const MODES = [
  { value: 'system', label: 'System', icon: 'monitor' },
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
];

// Dark text on a light accent, white on a dark one: the accent is user-chosen,
// so the colour of what sits on it has to be worked out, not assumed.
export function onAccent(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.4 ? '#14121f' : '#ffffff';
}

export function currentAccent() {
  try {
    return localStorage.getItem(KEY) || DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
}

// The Repo interface has its own accent (blue), set in CSS, so the user's
// chosen colour is kept but not applied while Repo is on.
function paintAccent(hex) {
  const root = document.documentElement.style;
  if (isRepo()) {
    root.removeProperty('--color-accent');
    root.removeProperty('--on-accent');
  } else {
    root.setProperty('--color-accent', hex);
    root.setProperty('--on-accent', onAccent(hex));
  }
  const shown = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() || hex;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', shown);
}

export function applyAccent(hex) {
  paintAccent(hex);
  try {
    if (hex === DEFAULT_ACCENT) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, hex);
  } catch {}
}

function currentMode() {
  try {
    return localStorage.getItem(MODE_KEY) || 'system';
  } catch {
    return 'system';
  }
}

function shouldBeDark(mode) {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyMode(mode) {
  try {
    if (mode === 'system') localStorage.removeItem(MODE_KEY);
    else localStorage.setItem(MODE_KEY, mode);
  } catch {}

  document.documentElement.classList.toggle('dark', shouldBeDark(mode));
  paintAccent(currentAccent());
}

// Switching interface restyles at once (it is a class on <html>), but wording
// and path formats are written into the markup, so listeners re-render.
const uiListeners = new Set();
export const onUIChange = (fn) => uiListeners.add(fn);

export function applyUI(mode) {
  storeUI(mode);
  document.documentElement.classList.toggle('ui-repo', mode === 'repo');
  paintAccent(currentAccent());
  uiListeners.forEach((fn) => fn(mode));
}

let _mediaQuery;

export function initTheme() {
  document.documentElement.classList.toggle('ui-repo', currentUI() === 'repo');
  paintAccent(currentAccent());
  applyMode(currentMode());

  _mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  _mediaQuery.addEventListener('change', () => {
    if (currentMode() === 'system') applyMode('system');
  });
}

// ------------------------------------------------------ settings controls ---

const segment = (on, label, attrs, extra = '') => `
  <button type="button" ${attrs}
    class="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-[calc(var(--radius-lg)-2px)] text-[13px] transition-all ${extra}
           ${on ? 'bg-[var(--ink)] text-[var(--paper)] font-bold' : 'text-[var(--ink-soft)] font-medium hover:text-[var(--ink)]'}">
    ${label}
  </button>`;

// Interface: the same data in two looks.
export function interfaceMarkup() {
  const ui = currentUI();
  const tile = (value, label, blurb, preview) => `
    <button type="button" data-ui="${value}" aria-pressed="${ui === value}"
      class="text-left rounded-[var(--radius-xl)] border p-3 transition-colors
             ${ui === value ? 'border-[var(--ink)] bg-[var(--paper)]' : 'border-[var(--line)] hover:border-[var(--ink-faint)]'}">
      ${preview}
      <span class="mt-2.5 flex items-center gap-2 font-semibold text-[14px]">
        <span class="w-4 h-4 rounded-full border-2 ${ui === value ? 'border-[5px] border-[var(--ink)]' : 'border-[var(--ink-faint)]'}"></span>${label}
      </span>
      <span class="block text-[12px] text-[var(--ink-soft)] mt-0.5 pl-6">${blurb}</span>
    </button>`;
  return `
    <div class="grid grid-cols-2 gap-3" data-ui-group>
      ${tile(
        'classic',
        'Classic',
        'Rounded and light',
        `<span class="block h-14 rounded-xl p-2" style="background:#f2f0fa">
           <span class="block h-2 w-2/5 rounded-full" style="background:#14121f"></span>
           <span class="block h-5 mt-1.5 rounded-full bg-white"></span></span>`,
      )}
      ${tile(
        'repo',
        'Repo',
        'Folders, files, history',
        `<span class="block h-14 rounded-lg p-2 border" style="background:#0f1117;border-color:#2a2f3d">
           <span class="block font-mono text-[8px]" style="color:#7f93f5">home / office</span>
           <span class="block h-1.5 w-4/5 mt-1.5 rounded-sm" style="background:#2a2f3d"></span>
           <span class="block h-1.5 w-3/5 mt-1 rounded-sm" style="background:#1c3a2d"></span></span>`,
      )}
    </div>`;
}

export function wireInterface(root, { after } = {}) {
  root.querySelectorAll('[data-ui]').forEach((b) =>
    b.addEventListener('click', () => {
      if (b.dataset.ui === currentUI()) return;
      applyUI(b.dataset.ui);
      after?.();
    }),
  );
}

// Theme mode and accent colour, as inline controls (Settings) or in a sheet.
export function appearanceMarkup() {
  const active = currentAccent();
  const mode = currentMode();
  return `
    <div class="flex gap-1 p-1 bg-[var(--sunken)] rounded-[var(--radius-xl)]" data-mode-group>
      ${MODES.map((m) =>
        segment(m.value === mode, `${icon(m.icon, 'w-4 h-4')}${m.label}`, `data-mode="${m.value}"`),
      ).join('')}
    </div>
    <div data-accent-block class="${isRepo() ? 'hidden' : ''}">
      <p class="mt-4 mb-2 text-[13px] text-[var(--ink-soft)]">Accent colour</p>
      <div class="flex flex-wrap items-center gap-3" data-swatches>
        ${ACCENTS.map((a) => swatch(a.hex, a.name, a.hex.toLowerCase() === active.toLowerCase())).join('')}
        <label class="w-9 h-9 rounded-full border-2 border-dashed border-[var(--ink-faint)] grid place-items-center cursor-pointer text-[var(--ink-soft)]" title="Custom colour">
          ${icon('plus', 'w-4 h-4')}
          <input type="color" data-custom value="${esc(active)}" class="sr-only" aria-label="Custom colour">
        </label>
      </div>
    </div>
    ${isRepo() ? '<p class="mt-3 text-[12px] text-[var(--ink-soft)]">The Repo interface has its own colours. Your accent comes back with Classic.</p>' : ''}`;
}

const swatch = (hex, name, selected) => `
  <button type="button" data-accent="${esc(hex)}" title="${esc(name)}" aria-label="${esc(name)}${selected ? ', selected' : ''}"
    class="w-9 h-9 rounded-full grid place-items-center transition-transform active:scale-95
           ${selected ? 'ring-2 ring-offset-2 ring-[var(--ink)] ring-offset-[var(--paper)]' : ''}"
    style="background:${esc(hex)};color:${onAccent(hex)}">
    ${selected ? icon('check', 'w-4 h-4') : ''}
  </button>`;

export function wireAppearance(root) {
  const repaint = (value) => {
    applyAccent(value);
    root.querySelectorAll('[data-accent]').forEach((b) => {
      const on = b.dataset.accent.toLowerCase() === value.toLowerCase();
      b.innerHTML = on ? icon('check', 'w-4 h-4') : '';
      b.classList.toggle('ring-2', on);
      b.classList.toggle('ring-offset-2', on);
      b.classList.toggle('ring-[var(--ink)]', on);
      b.classList.toggle('ring-offset-[var(--paper)]', on);
    });
    const custom = root.querySelector('[data-custom]');
    if (custom) custom.value = value;
  };

  root.querySelectorAll('[data-accent]').forEach((b) =>
    b.addEventListener('click', () => repaint(b.dataset.accent)),
  );
  root.querySelector('[data-custom]')?.addEventListener('input', (e) => repaint(e.target.value));
  root.querySelectorAll('[data-mode]').forEach((b) =>
    b.addEventListener('click', () => {
      applyMode(b.dataset.mode);
      root.querySelectorAll('[data-mode]').forEach((x) => {
        const on = x.dataset.mode === b.dataset.mode;
        x.classList.toggle('bg-[var(--ink)]', on);
        x.classList.toggle('text-[var(--paper)]', on);
        x.classList.toggle('font-bold', on);
        x.classList.toggle('text-[var(--ink-soft)]', !on);
        x.classList.toggle('font-medium', !on);
      });
    }),
  );
}

export function appearanceSheet() {
  openSheet({
    title: 'Appearance',
    body: `
      ${appearanceMarkup()}
      <button type="button" data-reset class="btn btn-ghost w-full mt-5">Reset to default</button>`,
    onMount(body) {
      wireAppearance(body);
      body.querySelector('[data-reset]').addEventListener('click', () => {
        applyAccent(DEFAULT_ACCENT);
        applyMode('system');
        toast('Back to defaults');
      });
    },
  });
}
