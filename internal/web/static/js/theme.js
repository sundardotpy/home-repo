import { esc, icon, openSheet, toast } from './ui.js';

const KEY = 'hsh.accent';
const MODE_KEY = 'hsh.theme';
export const DEFAULT_ACCENT = '#dc4c3e';

export const ACCENTS = [
  { name: 'Tomato', hex: '#dc4c3e' },
  { name: 'Amber', hex: '#d98324' },
  { name: 'Forest', hex: '#2e9e5b' },
  { name: 'Teal', hex: '#0e9f9f' },
  { name: 'Ocean', hex: '#2f7fed' },
  { name: 'Grape', hex: '#8b5cf6' },
  { name: 'Rose', hex: '#e0447c' },
  { name: 'Graphite', hex: '#5b6470' },
];

const MODES = [
  { value: 'system', label: 'System', icon: 'monitor' },
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
];

export function currentAccent() {
  try {
    return localStorage.getItem(KEY) || DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
}

export function applyAccent(hex) {
  document.documentElement.style.setProperty('--color-accent', hex);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', hex);
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

  if (shouldBeDark(mode)) document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
}

let _mediaQuery;

export function initTheme() {
  applyAccent(currentAccent());
  applyMode(currentMode());

  _mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  _mediaQuery.addEventListener('change', () => {
    if (currentMode() === 'system') applyMode('system');
  });
}

const swatch = (hex, name, selected) => `
  <button type="button" data-accent="${esc(hex)}" title="${esc(name)}" aria-label="${esc(name)}"
    class="group relative h-11 rounded-lg flex items-center justify-center transition-transform active:scale-95"
    style="background:${esc(hex)}">
    ${selected ? `<span class="text-white">${icon('check', 'w-5 h-5')}</span>` : ''}
  </button>`;

export function appearanceSheet() {
  const active = currentAccent();
  const isPreset = ACCENTS.some((a) => a.hex.toLowerCase() === active.toLowerCase());
  const mode = currentMode();

  openSheet({
    title: 'Appearance',
    body: `
      <p class="text-[13px] text-[var(--ink-soft)] mb-3">
        Accent colour. Everything else is derived from it.
      </p>
      <div class="grid grid-cols-4 gap-2" data-swatches>
        ${ACCENTS.map((a) => swatch(a.hex, a.name, a.hex.toLowerCase() === active.toLowerCase())).join('')}
      </div>

      <div class="mt-5">
        <span class="block text-[13px] font-medium text-[var(--ink-soft)] mb-1.5">Custom</span>
        <div class="flex items-center gap-3">
          <input type="color" data-custom value="${esc(active)}"
            class="w-12 h-11 rounded-lg bg-transparent border border-[var(--line)] cursor-pointer p-1">
          <input type="text" data-hex value="${esc(active)}" spellcheck="false"
            class="flex-1 h-11 px-3 rounded-lg bg-[var(--paper)] border border-[var(--line)] font-mono
                   outline-none focus:border-[var(--color-accent)] transition-colors">
        </div>
        ${isPreset ? '' : '<p class="mt-2 text-[12px] text-[var(--ink-faint)]">Using a custom colour.</p>'}
      </div>

      <div class="mt-5">
        <span class="block text-[13px] font-medium text-[var(--ink-soft)] mb-2">Theme</span>
        <div class="grid grid-cols-3 gap-2 p-1 bg-[var(--sunken)] rounded-xl" data-mode-group>
          ${MODES.map(
            (m) => `
            <button type="button" data-mode="${m.value}"
              class="flex items-center justify-center gap-1.5 h-10 rounded-lg text-[13px] font-medium transition-all
                     ${m.value === mode ? 'bg-[var(--paper)] text-[var(--ink)] shadow-sm' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'}">
              ${icon(m.icon, 'w-4 h-4')}
              ${m.label}
            </button>`,
          ).join('')}
        </div>
      </div>

      <button type="button" data-reset
        class="mt-4 w-full h-11 rounded-lg border border-[var(--line)] font-medium active:bg-[var(--sunken)] transition-colors">
        Reset to default
      </button>`,
    onMount(body) {
      const custom = body.querySelector('[data-custom]');
      const hex = body.querySelector('[data-hex]');

      const repaint = (value) => {
        applyAccent(value);
        custom.value = value;
        hex.value = value;
        body.querySelectorAll('[data-accent]').forEach((b) => {
          const on = b.dataset.accent.toLowerCase() === value.toLowerCase();
          b.innerHTML = on ? `<span class="text-white">${icon('check', 'w-5 h-5')}</span>` : '';
        });
      };

      const setMode = (value) => {
        applyMode(value);
        body.querySelectorAll('[data-mode]').forEach((b) => {
          const on = b.dataset.mode === value;
          b.className = b.className
            .replace(/bg-\[var\(--paper\)\]\s*text-\[var\(--ink\)\]\s*shadow-sm/g, '')
            .replace(/text-\[var\(--ink-soft\)\]\s*hover:text-\[var\(--ink\)\]/g, '')
            .trim();
          b.classList.add(
            ...(on
              ? ['bg-[var(--paper)]', 'text-[var(--ink)]', 'shadow-sm']
              : ['text-[var(--ink-soft)]', 'hover:text-[var(--ink)]']),
          );
        });
      };

      body.querySelectorAll('[data-accent]').forEach((b) =>
        b.addEventListener('click', () => repaint(b.dataset.accent)),
      );
      custom.addEventListener('input', () => repaint(custom.value));
      hex.addEventListener('input', () => {
        const v = hex.value.trim();
        if (/^#[0-9a-f]{6}$/i.test(v)) repaint(v);
      });
      body.querySelectorAll('[data-mode]').forEach((b) =>
        b.addEventListener('click', () => setMode(b.dataset.mode)),
      );
      body.querySelector('[data-reset]').addEventListener('click', () => {
        repaint(DEFAULT_ACCENT);
        setMode('system');
        toast('Back to defaults');
      });
    },
  });
}
