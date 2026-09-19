// Tags and custom properties — the two ways to describe a thing that the fixed
// fields cannot.

import { del, get, patch, post } from './api.js';
import * as store from './store.js';
import {
  esc,
  field,
  ghostButton,
  icon,
  inputCls,
  openSheet,
  primaryButton,
  roomHue,
  toast,
} from './ui.js';

// ------------------------------------------------------------------ tags ----

// Tags get a colour from their name, same trick as rooms: it makes a wall of
// pills scannable instead of uniform grey.
export const tagChip = (name, { removable = false } = {}) => `
  <span class="tag-chip inline-flex items-center gap-1 pl-2 ${removable ? 'pr-1' : 'pr-2'} py-0.5 rounded-full text-[12px] font-medium"
        style="--room-h:${roomHue(name)}">
    ${esc(name)}
    ${
      removable
        ? `<button type="button" data-untag="${esc(name)}" aria-label="Remove ${esc(name)}"
             class="w-4 h-4 grid place-items-center rounded-full hover:bg-black/10">
             ${icon('close', 'w-3 h-3')}
           </button>`
        : ''
    }
  </span>`;

export const tagChips = (tags, opts) => (tags || []).map((t) => tagChip(t, opts)).join('');

const normaliseTag = (s) => s.trim().toLowerCase().replace(/\s+/g, ' ');

// tagPickerSheet edits a selection against the whole vocabulary. Anything typed
// that does not exist yet can be created inline — a picker that only offers
// what already exists would be a cage.
export function tagPickerSheet(selected, onDone) {
  let chosen = new Set(selected || []);

  openSheet({
    title: 'Tags',
    body: `
      <input data-filter class="${inputCls} mb-3" placeholder="Filter or add a tag" autocomplete="off">
      <div data-chosen class="flex flex-wrap gap-1.5 mb-3"></div>
      <div data-list class="max-h-[45dvh] overflow-y-auto -mx-1 px-1"></div>
      ${primaryButton('Done', 'data-done class="w-full mt-4"')}`,
    onMount(body, close) {
      const filterEl = body.querySelector('[data-filter]');
      const listEl = body.querySelector('[data-list]');
      const chosenEl = body.querySelector('[data-chosen]');

      const vocabulary = () => store.peek('/tags').data?.tags || [];

      const paintChosen = () => {
        chosenEl.innerHTML = chosen.size
          ? tagChips([...chosen].sort(), { removable: true })
          : `<span class="text-[13px] text-[var(--ink-faint)]">No tags yet</span>`;
        chosenEl.querySelectorAll('[data-untag]').forEach((b) =>
          b.addEventListener('click', () => {
            chosen.delete(b.dataset.untag);
            paintChosen();
            paintList();
          }),
        );
      };

      const paintList = () => {
        const q = normaliseTag(filterEl.value);
        const all = vocabulary();
        const matches = q ? all.filter((t) => t.name.includes(q)) : all;
        const exact = all.some((t) => t.name === q);

        listEl.innerHTML = `
          ${
            q && !exact
              ? `<button type="button" data-create
                   class="w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2 text-[var(--color-accent)] font-medium hover:bg-[var(--sunken)]">
                   ${icon('plus', 'w-4 h-4')} Add “${esc(q)}”
                 </button>`
              : ''
          }
          ${
            matches.length
              ? matches
                  .map(
                    (t) => `
                <button type="button" data-toggle="${esc(t.name)}"
                  class="w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2.5 hover:bg-[var(--sunken)]">
                  <span class="w-4 h-4 shrink-0 rounded border ${
                    chosen.has(t.name)
                      ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white grid place-items-center'
                      : 'border-[var(--line)]'
                  }">${chosen.has(t.name) ? icon('check', 'w-3 h-3') : ''}</span>
                  <span class="flex-1 truncate">${esc(t.name)}</span>
                  <span class="text-[12px] text-[var(--ink-faint)]">${t.count || 0}</span>
                </button>`,
                  )
                  .join('')
              : q
                ? ''
                : `<p class="text-[13px] text-[var(--ink-soft)] px-3 py-4">No tags yet.</p>`
          }`;

        listEl.querySelectorAll('[data-toggle]').forEach((b) =>
          b.addEventListener('click', () => {
            const name = b.dataset.toggle;
            chosen.has(name) ? chosen.delete(name) : chosen.add(name);
            paintChosen();
            paintList();
          }),
        );
        listEl.querySelector('[data-create]')?.addEventListener('click', async () => {
          const name = normaliseTag(filterEl.value);
          chosen.add(name);
          filterEl.value = '';
          paintChosen();
          // Create it in the catalogue so it is offered next time. The item save
          // would do this too, but only if the item is actually saved.
          try {
            await post('/tags', { name });
            store.load('/tags', { force: true }).then(paintList);
          } catch {
            paintList();
          }
        });
      };

      paintChosen();
      paintList();
      store.load('/tags').then(paintList).catch(() => {});
      filterEl.addEventListener('input', paintList);
      filterEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          listEl.querySelector('[data-create]')?.click();
        }
      });

      body.querySelector('[data-done]').addEventListener('click', () => {
        close();
        onDone([...chosen].sort());
      });
    },
  });
}

// Tag admin, for the settings screen.
export function manageTagSheet(tag, { onChanged } = {}) {
  openSheet({
    title: `Tag “${tag.name}”`,
    body: `
      <form data-form>
        ${field('Name', `<input name="name" class="${inputCls}" value="${esc(tag.name)}" autocomplete="off">`,
          tag.count
            ? `Renaming updates the ${tag.count} item${tag.count === 1 ? '' : 's'} using it.`
            : 'Not used by anything yet.')}
        <div class="flex gap-2">
          ${primaryButton('Save', 'data-ok class="flex-1"')}
          ${ghostButton(icon('trash', 'w-5 h-5'), 'data-delete aria-label="Delete tag"')}
        </div>
      </form>`,
    onMount(body, close) {
      const form = body.querySelector('[data-form]');
      body.querySelector('[data-ok]').addEventListener('click', async () => {
        const name = normaliseTag(form.name.value);
        if (!name) return form.name.focus();
        close();
        if (name === tag.name) return;
        try {
          await patch(`/tags/${encodeURIComponent(tag.name)}`, { name });
          toast(`Renamed to ${name}`);
          onChanged?.();
        } catch (err) {
          toast(err.message || 'Could not rename that tag', { tone: 'error' });
        }
      });
      body.querySelector('[data-delete]').addEventListener('click', async () => {
        close();
        try {
          await del(`/tags/${encodeURIComponent(tag.name)}`);
          toast(`Deleted ${tag.name}`);
          onChanged?.();
        } catch (err) {
          toast(err.message || 'Could not delete that tag', { tone: 'error' });
        }
      });
    },
  });
}

// ------------------------------------------------------------ properties ----

// Starting points per tag, so an electronics item suggests the fields you would
// actually want on one. Merged with whatever keys are already in use.
const SUGGESTED_KEYS = {
  electronics: ['Brand', 'Model', 'Serial', 'Part of', 'Purchased', 'Warranty until', 'Cost'],
  appliances: ['Brand', 'Model', 'Purchased', 'Warranty until', 'Cost'],
  furniture: ['Material', 'Colour', 'Dimensions', 'Purchased', 'Cost'],
  cables: ['Type', 'Length', 'Part of'],
  batteries: ['Type', 'Capacity'],
  clothes: ['Size', 'Colour', 'Season'],
  shoes: ['Size', 'Colour'],
  documents: ['Reference', 'Issued', 'Expires'],
  paperwork: ['Reference', 'Issued', 'Expires'],
  medicine: ['Dose', 'Expires'],
  food: ['Expires'],
  tools: ['Brand', 'Part of'],
  car: ['Registration', 'Last serviced'],
  valuables: ['Value', 'Insured'],
};

export function suggestedKeys(tags = []) {
  const known = (store.peek('/properties').data?.properties || []).map((p) => p.key);
  const fromTags = (tags || []).flatMap((t) => SUGGESTED_KEYS[t] || []);
  const seen = new Set();
  return [...fromTags, ...known].filter((k) => {
    const key = k.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * propertyEditor renders editable key/value rows into `host` and returns a
 * controller whose values() gives the current set.
 */
export function propertyEditor(host, initial = {}, getTags = () => []) {
  let rows = Object.entries(initial)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({ key, value }));

  const paint = () => {
    host.innerHTML = `
      ${
        rows.length
          ? `<div class="space-y-2 mb-2">
              ${rows
                .map(
                  (r, i) => `
                <div class="flex gap-2 items-start" data-row="${i}">
                  <input data-key class="${inputCls} flex-1 min-w-0" placeholder="Part of"
                         value="${esc(r.key)}" autocomplete="off" spellcheck="false">
                  <input data-value class="${inputCls} flex-1 min-w-0" placeholder="Homelab"
                         value="${esc(r.value)}" autocomplete="off">
                  <button type="button" data-remove aria-label="Remove property"
                    class="w-11 h-11 shrink-0 grid place-items-center rounded-lg text-[var(--ink-faint)] hover:bg-[var(--sunken)] transition-colors">
                    ${icon('close', 'w-4 h-4')}
                  </button>
                </div>`,
                )
                .join('')}
            </div>`
          : ''
      }
      <div data-suggest class="flex flex-wrap gap-1.5 mb-2"></div>
      <button type="button" data-add
        class="text-[13px] font-medium text-[var(--color-accent)] inline-flex items-center gap-1">
        ${icon('plus', 'w-4 h-4')} Add a field
      </button>`;

    host.querySelectorAll('[data-row]').forEach((row) => {
      const i = Number(row.dataset.row);
      row.querySelector('[data-key]').addEventListener('input', (e) => {
        rows[i].key = e.target.value;
      });
      row.querySelector('[data-value]').addEventListener('input', (e) => {
        rows[i].value = e.target.value;
      });
      row.querySelector('[data-remove]').addEventListener('click', () => {
        rows.splice(i, 1);
        paint();
      });
    });

    host.querySelector('[data-add]').addEventListener('click', () => {
      rows.push({ key: '', value: '' });
      paint();
      host.querySelector('[data-row]:last-of-type [data-key]')?.focus();
    });

    paintSuggestions();
  };

  // One tap adds the field, rather than making the user remember what a sensible
  // field even is for this kind of thing.
  const paintSuggestions = () => {
    const el = host.querySelector('[data-suggest]');
    const used = new Set(rows.map((r) => r.key.trim().toLowerCase()).filter(Boolean));
    const offer = suggestedKeys(getTags())
      .filter((k) => !used.has(k.toLowerCase()))
      .slice(0, 6);
    el.innerHTML = offer
      .map(
        (k) => `
        <button type="button" data-suggest-key="${esc(k)}"
          class="px-2 py-1 rounded-full border border-[var(--line)] text-[12px] text-[var(--ink-soft)] hover:border-[var(--ink-faint)] transition-colors">
          + ${esc(k)}
        </button>`,
      )
      .join('');
    el.querySelectorAll('[data-suggest-key]').forEach((b) =>
      b.addEventListener('click', () => {
        rows.push({ key: b.dataset.suggestKey, value: '' });
        paint();
        host.querySelector('[data-row]:last-of-type [data-value]')?.focus();
      }),
    );
  };

  paint();
  store.load('/properties').then(paintSuggestions).catch(() => {});

  return {
    values() {
      const out = {};
      for (const r of rows) {
        const key = r.key.trim().replace(/\s+/g, ' ');
        if (key) out[key] = r.value.trim();
      }
      return out;
    },
    refreshSuggestions: paintSuggestions,
  };
}

// A read-only view for the item card. Values are tappable: seeing "Homelab"
// and wanting everything else in the Homelab is the obvious next thought.
export const propertyList = (props) => {
  const entries = Object.entries(props || {}).sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) return '';
  return `
    <div class="surface divide-y divide-[var(--line)] overflow-hidden">
      ${entries
        .map(
          ([k, v]) => `
        <div class="flex items-baseline gap-3 px-3 py-2.5">
          <span class="text-[13px] text-[var(--ink-soft)] shrink-0 min-w-24">${esc(k)}</span>
          ${
            v
              ? `<a href="#/search?q=${encodeURIComponent(v)}"
                   class="flex-1 font-medium text-right truncate hover:text-[var(--color-accent)] transition-colors">${esc(v)}</a>`
              : `<span class="flex-1 text-right text-[var(--ink-faint)]">—</span>`
          }
        </div>`,
        )
        .join('')}
    </div>`;
};
