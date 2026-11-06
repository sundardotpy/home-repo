import { esc, icon, openSheet, toast } from './ui.js';

const KEY = 'hsh.accent';
const MODE_KEY = 'hsh.theme';

// The same seven as the Android app, by the same names, so a household sees
// one product on both. Sea glass is the default.
export const ACCENTS = [
  { name: 'Sea glass', hex: '#0e5e58' },
  { name: 'Moonstone', hex: '#4a5462' },
  { name: 'Tangerine', hex: '#d68401' },
  { name: 'Kale', hex: '#4b7a45' },
  { name: 'Blueberry', hex: '#3569ba' },
  { name: 'Lavender', hex: '#756bbd' },
  { name: 'Raspberry', hex: '#ca4f71' },
];
export const DEFAULT_ACCENT = ACCENTS[0].hex;

const MODES = [
  { value: 'system', label: 'System', icon: 'monitor' },
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
];

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const lum = (c) => {
  const [r, g, b] = c.map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** White or near-black, whichever reads better on the fill (as on Android). */
export function onAccent(fill) {
  const c = rgb(fill);
  return contrast(c, [255, 255, 255]) >= contrast(c, [26, 28, 30]) ? '#ffffff' : '#1a1c1e';
}

/** Dark mode lifts the same hue 35% toward white, so accent text stays legible. */
const lifted = (fill) => hex(rgb(fill).map((v) => v + (255 - v) * 0.35));

export function currentAccent() {
  try {
    const stored = localStorage.getItem(KEY);
    // An accent from the old palette is not one of the seven any more.
    return ACCENTS.some((a) => a.hex === stored) ? stored : DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
}

// The containers derived from the accent live in CSS (color-mix); only the
// fill and the ink on it are worked out here.
function paintAccent(base) {
  const dark = document.documentElement.classList.contains('dark');
  const fill = dark ? lifted(base) : base;
  const root = document.documentElement.style;
  root.setProperty('--accent', fill);
  root.setProperty('--on-accent', onAccent(fill));
  root.setProperty('--accent-ink', inkFor(fill, dark));
  // The snackbar's action sits on the inverse surface: the other mode's fill.
  root.setProperty('--accent-inverse', dark ? base : lifted(base));
  syncThemeColor();
}

// The accent as text on the ground: the fill itself when it reads (4.5:1), or
// stepped toward the ink until it does — Tangerine on sea glass needs this.
function inkFor(fill, dark) {
  const ground = dark ? [16, 22, 21] : [244, 247, 246];
  const ink = dark ? [255, 255, 255] : [0, 0, 0];
  let c = rgb(fill);
  for (let i = 0; i < 20 && contrast(c, ground) < 4.5; i++) c = c.map((v, k) => v + (ink[k] - v) * 0.1);
  return hex(c);
}

// The status bar on a phone takes the app's ground, so the two read as one.
export function syncThemeColor() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--ground').trim();
  if (bg) document.querySelectorAll('meta[name=theme-color]').forEach((m) => m.setAttribute('content', bg));
}

export function applyAccent(value) {
  try {
    if (value === DEFAULT_ACCENT) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, value);
  } catch {}
  paintAccent(value);
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

export function initTheme() {
  applyMode(currentMode());
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (currentMode() === 'system') applyMode('system');
  });
}

// ------------------------------------------------------ settings controls ---

// Settings offers each choice as a card: a miniature of the app drawn from the
// real scheme it stands for (rail, an item with its drawer tabs, the accent on
// Add), then its name. Announced as radio choices.
const SCHEMES = {
  light: { ground: '#f4f7f6', slip: '#ffffff', bar: '#e8eeed', line: '#c3ccca', ink: '#1c2326', tint: '#cdebe1' },
  dark: { ground: '#101615', slip: '#0b100f', bar: '#1c2221', line: '#3f4947', ink: '#dee4e2', tint: '#24453c' },
};

function mini(scheme, accentBase) {
  const c = SCHEMES[scheme];
  const fill = scheme === 'dark' ? lifted(accentBase) : accentBase;
  return `<span class="mini" style="background:${c.ground}">
    <span class="mini-rail" style="background:${c.bar}">
      <span style="background:${fill}"></span>
    </span>
    <span class="mini-body">
      <span class="mini-name" style="background:${c.ink}"></span>
      <span class="mini-path" style="border-color:${c.line}">
        <span style="background:${c.tint};border-color:${c.line}"></span>
        <span style="background:${c.slip};border-color:${c.line}"></span>
      </span>
      <span class="mini-add" style="background:${fill}"></span>
    </span>
  </span>`;
}

const card = (attrs, chosen, picture, label) => `
  <button type="button" role="radio" ${attrs} aria-checked="${chosen}" class="choice">
    <span class="relative block">${picture}${
      chosen ? `<span class="choice-check">${icon('check', 'w-3.5 h-3.5')}</span>` : ''
    }</span>
    <span class="choice-name">${esc(label)}</span>
  </button>`;

export function appearanceMarkup() {
  const accent = currentAccent();
  const mode = currentMode();
  const scheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  const modePicture = (m) =>
    m === 'system'
      ? `<span class="mini-split" aria-hidden="true"><span>${mini('light', accent)}</span><span>${mini('dark', accent)}</span></span>`
      : `<span aria-hidden="true">${mini(m, accent)}</span>`;
  return `
    <h3 class="section-title mb-2">Theme</h3>
    <div class="grid-choices" role="radiogroup" aria-label="Theme">
      ${MODES.map((m) => card(`data-mode="${m.value}"`, m.value === mode, modePicture(m.value), m.label)).join('')}
    </div>
    <h3 class="section-title mt-6 mb-2">Accent</h3>
    <div class="grid-choices" role="radiogroup" aria-label="Accent">
      ${ACCENTS.map((a) =>
        card(`data-accent="${esc(a.hex)}"`, a.hex === accent, `<span aria-hidden="true">${mini(scheme, a.hex)}</span>`, a.name),
      ).join('')}
    </div>`;
}

// A choice repaints every miniature (the theme changes all of them), so the
// block is drawn again rather than patched.
export function wireAppearance(root) {
  const redraw = () => {
    root.innerHTML = appearanceMarkup();
    wireAppearance(root);
  };
  root.querySelectorAll('[data-accent]').forEach((b) =>
    b.addEventListener('click', () => {
      applyAccent(b.dataset.accent);
      redraw();
      root.querySelector(`[data-accent="${b.dataset.accent}"]`)?.focus();
    }),
  );
  root.querySelectorAll('[data-mode]').forEach((b) =>
    b.addEventListener('click', () => {
      applyMode(b.dataset.mode);
      redraw();
      root.querySelector(`[data-mode="${b.dataset.mode}"]`)?.focus();
    }),
  );
}

export function appearanceSheet() {
  openSheet({
    title: 'Appearance',
    body: `
      ${appearanceMarkup()}
      <button type="button" data-reset class="btn btn-text w-full mt-5">Reset to default</button>`,
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
