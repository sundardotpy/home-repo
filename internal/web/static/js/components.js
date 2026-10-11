// App-native controls, replacing the ones the OS draws.
//
// A native <select> renders as a system widget: iOS shows a wheel, Android a
// dialog, desktop a grey list — none of which can be styled, animated, or made
// to show an icon and a hint per row. These are the same controls drawn by the
// app, keyboard included.

import { esc, icon, openSheet } from './ui.js';

let openPopup = null;

export function closeAnyPopup() {
  openPopup?.();
}

// Phones get a bottom sheet instead of an anchored popup. A menu pinned to a
// trigger near the bottom of a scrolling sheet fights the on-screen keyboard,
// the address bar and momentum scrolling; a sheet has none of those problems
// and is what a native app would do anyway.
const isPhone = () => matchMedia('(max-width: 639px)').matches;

/**
 * createSelect renders a dropdown into `host`.
 * options: [{ value, label, hint, prefix, depth }]
 */
export function createSelect(host, { options = [], value = '', placeholder = 'Select…', onChange } = {}) {
  let current = value;
  let opts = options;

  const paint = () => {
    const chosen = opts.find((o) => o.value === current);
    host.innerHTML = `
      <button type="button" data-trigger aria-haspopup="listbox" aria-expanded="false"
        class="w-full h-11 px-3 rounded-lg bg-[var(--paper)] border border-[var(--line)]
               flex items-center gap-2 text-left transition-colors
               hover:border-[var(--ink-faint)] focus:border-[var(--ink)] focus:outline-none">
        ${chosen?.prefix || ''}
        <span class="flex-1 truncate ${chosen ? '' : 'text-[var(--ink-faint)]'}">
          ${esc(chosen ? chosen.label : placeholder)}
        </span>
        <span class="text-[var(--ink-faint)] transition-transform duration-200" data-chevron>
          ${icon('down', 'w-4 h-4')}
        </span>
      </button>`;
    host.querySelector('[data-trigger]').addEventListener('click', open);
  };

  const optionRow = (o, i) => `
    <button type="button" role="option" data-value="${esc(o.value)}" data-i="${i}"
      aria-selected="${o.value === current}"
      class="w-full text-left px-3 py-3 sm:py-2.5 flex items-center gap-2.5 transition-colors
             hover:bg-[var(--sunken)] ${o.value === current ? 'text-[var(--accent-ink)]' : ''}"
      style="padding-left:${12 + (o.depth || 0) * 16}px">
      ${o.prefix || ''}
      <span class="flex-1 min-w-0">
        <span class="block truncate">${esc(o.label)}</span>
        ${o.hint ? `<span class="block text-[12px] text-[var(--ink-faint)] truncate">${esc(o.hint)}</span>` : ''}
      </span>
      ${o.value === current ? icon('check', 'w-4 h-4') : ''}
    </button>`;

  function choose(v, done) {
    current = v;
    done?.();
    paint();
    onChange?.(v);
  }

  function openAsSheet(title) {
    openSheet({
      title,
      body: `<div role="listbox" class="-mx-4 -mb-4 divide-y divide-[var(--line)]">
               ${opts.map(optionRow).join('')}
             </div>`,
      onMount(body, close) {
        body.querySelectorAll('[role=option]').forEach((b) =>
          b.addEventListener('click', () => choose(b.dataset.value, close)),
        );
        // Bring the current choice into view inside the sheet's own scroller.
        const sel = body.querySelector('[aria-selected=true]');
        if (sel) sel.closest('[data-body]').parentElement.scrollTop = Math.max(0, sel.offsetTop - 120);
      },
    });
  }

  function open() {
    closeAnyPopup();
    if (isPhone()) return openAsSheet(placeholder === 'Select…' ? 'Choose' : placeholder);

    const trigger = host.querySelector('[data-trigger]');
    trigger.setAttribute('aria-expanded', 'true');
    host.querySelector('[data-chevron]').style.transform = 'rotate(180deg)';

    const rect = trigger.getBoundingClientRect();
    // The popup is portalled to <body> with fixed positioning: inside a
    // scrolling sheet an absolutely positioned menu would be clipped.
    const pop = document.createElement('div');
    pop.className = 'fixed z-[60] popup-in';
    pop.innerHTML = `
      <div role="listbox" tabindex="-1"
        class="surface overflow-y-auto overscroll-contain py-1 shadow-xl"
        style="max-height:min(18rem, 50dvh)">
        ${opts.map(optionRow).join('')}
      </div>`;
    document.body.appendChild(pop);

    // Prefer below the trigger; flip above when there is not enough room.
    const menu = pop.firstElementChild;
    const width = rect.width;
    const spaceBelow = innerHeight - rect.bottom - 8;
    const height = Math.min(menu.scrollHeight + 8, innerHeight * 0.5, 288);
    const below = spaceBelow >= height || spaceBelow >= rect.top;
    pop.style.width = `${width}px`;
    pop.style.left = `${rect.left}px`;
    pop.style.top = below ? `${rect.bottom + 6}px` : `${Math.max(8, rect.top - height - 6)}px`;
    pop.style.transformOrigin = below ? 'top center' : 'bottom center';

    const buttons = [...pop.querySelectorAll('[role=option]')];
    let active = Math.max(0, opts.findIndex((o) => o.value === current));
    const highlight = () => {
      buttons.forEach((b, i) => b.classList.toggle('bg-[var(--sunken)]', i === active));
      // Scroll the list by hand rather than with scrollIntoView: that scrolls
      // every scrollable ancestor too, and the resulting scroll event used to
      // trip the close-on-scroll handler and shut the menu the instant it
      // opened.
      const el = buttons[active];
      if (!el) return;
      const top = el.offsetTop;
      const bottom = top + el.offsetHeight;
      if (top < menu.scrollTop) menu.scrollTop = top;
      else if (bottom > menu.scrollTop + menu.clientHeight) menu.scrollTop = bottom - menu.clientHeight;
    };
    highlight();

    buttons.forEach((b) => b.addEventListener('click', () => choose(b.dataset.value, close)));

    const onKey = (e) => {
      if (e.key === 'Escape') return close();
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
        highlight();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        choose(buttons[active].dataset.value, close);
      }
    };
    const onDown = (e) => {
      if (!pop.contains(e.target) && !host.contains(e.target)) close();
    };

    // A fixed popup would be left stranded by a scroll, so it follows its
    // trigger instead of closing — and only gives up once the trigger has
    // actually left the viewport.
    const reposition = () => {
      const r = trigger.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return close();
      pop.style.left = `${r.left}px`;
      pop.style.width = `${r.width}px`;
      const h = pop.getBoundingClientRect().height;
      pop.style.top = innerHeight - r.bottom - 8 >= h ? `${r.bottom + 6}px` : `${Math.max(8, r.top - h - 6)}px`;
    };

    function close() {
      pop.remove();
      removeEventListener('keydown', onKey, true);
      removeEventListener('pointerdown', onDown, true);
      removeEventListener('resize', reposition);
      removeEventListener('scroll', reposition, true);
      openPopup = null;
      trigger.setAttribute('aria-expanded', 'false');
      const chevron = host.querySelector('[data-chevron]');
      if (chevron) chevron.style.transform = '';
      trigger.focus?.();
    }

    addEventListener('keydown', onKey, true);
    addEventListener('pointerdown', onDown, true);
    addEventListener('resize', reposition);
    addEventListener('scroll', reposition, true);
    openPopup = close;
  }

  paint();

  return {
    get value() {
      return current;
    },
    set value(v) {
      current = v;
      paint();
    },
    setOptions(next, keepValue = true) {
      opts = next;
      if (!keepValue || !next.some((o) => o.value === current)) current = next[0]?.value ?? '';
      paint();
    },
  };
}

// --------------------------------------------------------------- accordion ---

// Collapsible sections animate on grid-template-rows, which — unlike max-height
// — transitions smoothly to the content's real height without guessing it.
// Callers render `.acc` / `[data-acc-toggle]` / `.acc-panel` markup themselves
// (the tree needs a caret and a link side by side, not one big button) and then
// hand the container here to be wired up.
export function wireAccordions(root, { onToggle } = {}) {
  root.querySelectorAll('[data-acc-toggle]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const acc = btn.closest('[data-acc]');
      const panel = acc.querySelector('.acc-panel');
      const nowOpen = !panel.classList.contains('is-open');
      panel.classList.toggle('is-open', nowOpen);
      btn.setAttribute('aria-expanded', String(nowOpen));
      const caret = btn.querySelector('[data-caret]');
      if (caret) caret.style.transform = nowOpen ? 'rotate(90deg)' : '';
      onToggle?.(acc.dataset.key, nowOpen);
    });
  });
}
