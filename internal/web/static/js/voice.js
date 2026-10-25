// Voice-to-action: "Helmet is in living room" → parse → match against the
// household → confirm → move. Speech is captured by the browser's own
// recogniser where it exists; everywhere else the same flow accepts typed
// text, which is also how it is tested.

import { get, post } from './api.js';
import { isRepo, t } from './look.js';
import { esc, icon, ghostButton, primaryButton, openSheet, toast } from './ui.js';
import { revalidate } from './store.js';

// ---------------------------------------------------------------- parsing

const PREP = /\s+(?:in|into|inside|at|to)\s+/gi;

/** "please put the helmet in the living room" → {kind:'move', item, place}. */
export function parseUtterance(text) {
  let s = String(text ?? '').trim().replace(/\s+/g, ' ');
  if (s === '') return { kind: 'empty' };

  s = s.replace(/^(?:please|can you|could you)\s+/i, '')
       .replace(/^(?:put|move|place|keep|drop|shelve|file)\s+/i, '');

  const is = s.match(/^(.+?)\s+(?:is|are|was|goes|went)\s+(?:in|inside|at|into)\s+(.+)$/i);
  if (is) return finished(is[1], is[2]);

  // Split on the LAST preposition, so "tool box in drawer" keeps the item whole.
  const preps = [...s.matchAll(PREP)];
  if (preps.length === 0) return { kind: 'ambiguous', text: s };
  const last = preps[preps.length - 1];
  return finished(s.slice(0, last.index), s.slice(last.index + last[0].length));

  function finished(a, b) {
    const item = clean(a);
    const place = clean(b);
    if (item === '' || place === '') return { kind: 'ambiguous', text: s };
    return { kind: 'move', item, place, raw: String(text ?? '') };
  }
}

function clean(s) {
  return s
    .replace(/^(?:the|a|an|my|our)\s+/i, '')
    .replace(/[.!?,;]+$/, '')
    .trim();
}

// --------------------------------------------------------------- matching

/**
 * Resolves both halves of a parsed utterance against live data. Answers one
 * of: confirm / item-choices / place-choices / create-item / create-place /
 * create-both. The caller only ever confirms or cancels — nothing moves
 * without an explicit yes.
 */
export async function resolveAction(parsed) {
  if (parsed.kind !== 'move') return parsed;

  const [itemHits, place] = await Promise.all([
    findItems(parsed.item),
    findPlace(parsed.place),
  ]);

  if (itemHits.status === 'choices') return { status: 'item-choices', choices: itemHits.choices, parsed };
  if (place.status === 'choices') return { status: 'place-choices', choices: place.choices, parsed };

  if (itemHits.status === 'missing' && place.status === 'missing') {
    return { status: 'create-both', parsed };
  }
  if (itemHits.status === 'missing') {
    return { status: 'create-item', place, parsed };
  }
  if (place.status === 'missing') {
    return { status: 'create-place', item: itemHits.item, parsed };
  }
  return { status: 'confirm', item: itemHits.item, place, parsed };
}

async function findItems(q) {
  const needle = q.toLowerCase();
  const { items } = await get(`/items?q=${encodeURIComponent(q)}&limit=8`);
  const exact = items.filter((i) => i.name.toLowerCase() === needle);
  const hits = exact.length ? exact : items;

  if (hits.length === 0) return { status: 'missing' };
  if (hits.length === 1) return { status: 'found', item: hits[0] };
  return { status: 'choices', choices: hits };
}

/**
 * A place may be a room ("living room"), a storage unit ("blue box") or
 * another item ("helmet box") — tried in that order, exact before contains.
 */
async function findPlace(q) {
  const needle = q.toLowerCase();
  const [rooms, units] = await Promise.all([get('/rooms'), get('/storage-units')]);

  const roomList = rooms.rooms ?? [];
  const unitList = units.storage_units ?? [];

  const room = oneExact(roomList, needle) ?? oneContains(roomList, needle);
  if (room) return { status: 'found', kind: 'room', id: room.id, name: room.name };

  const unit = oneExact(unitList, needle) ?? oneContains(unitList, needle);
  if (unit) return { status: 'found', kind: 'unit', id: unit.id, name: unit.name };

  const { items } = await get(`/items?q=${encodeURIComponent(q)}&limit=8`);
  const containers = items.filter((i) => i.name.toLowerCase().includes(needle));
  if (containers.length === 1) {
    return { status: 'found', kind: 'container', id: containers[0].id, name: containers[0].name };
  }
  if (containers.length > 1) {
    return {
      status: 'choices',
      choices: containers.map((i) => ({
        kind: 'container',
        id: i.id,
        name: i.name,
        label: `${i.name} — ${i.location?.path_string ?? ''}`,
      })),
    };
  }
  return { status: 'missing' };
}

function oneExact(list, needle) {
  const hits = list.filter((x) => x.name.toLowerCase() === needle);
  return hits.length === 1 ? hits[0] : null;
}
function oneContains(list, needle) {
  const hits = list.filter((x) => x.name.toLowerCase().includes(needle));
  return hits.length === 1 ? hits[0] : null;
}

// ----------------------------------------------------------------- acting

/** Applies the confirmed action. Every path ends in a toast. */
export async function applyAction(a) {
  switch (a.status) {
    case 'confirm':
      return moveItem(a.item, a.place);
    case 'item-choices':
    case 'place-choices':
      return moveItem(a.item, a.place);
    case 'create-item':
      return createInto(a.parsed.item, a.place);
    case 'create-place': {
      const room = await post('/rooms', { name: a.parsed.place });
      return moveItem(a.item, { kind: 'room', id: room.id, name: room.name });
    }
    case 'create-both': {
      const room = await post('/rooms', { name: a.parsed.place });
      return createInto(a.parsed.item, { kind: 'room', id: room.id, name: room.name });
    }
    default:
      throw new Error(`unknown action ${a.status}`);
  }
}

async function moveItem(item, place) {
  const body =
    place.kind === 'room' ? { room_id: place.id }
      : place.kind === 'unit' ? { storage_unit_id: place.id }
        : { parent_item_id: place.id };
  await post(`/items/${item.id}/move`, body);
  revalidate();
  toast(t(`Moved ${item.name} to ${place.name}`, `git mv ${item.name} ${place.name}`));
}

async function createInto(name, place) {
  const body =
    place.kind === 'room' ? { name, room_id: place.id }
      : place.kind === 'unit' ? { name, storage_unit_id: place.id }
        : { name, parent_item_id: place.id };
  await post('/items', body);
  revalidate();
  toast(t(`Added ${name} to ${place.name}`, `add ${name} → ${place.name}`));
}

// ------------------------------------------------------------------ speech

export function speechSupported() {
  return typeof window !== 'undefined' &&
    ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
}

/** Starts one-shot recognition; answers the final transcript. Gives up after
 * a few seconds — a hung recogniser must not eat the whole sheet. */
export function listenOnce(timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new Ctor();
    rec.lang = navigator.language || 'en-IN';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    const timer = setTimeout(() => {
      try { rec.stop(); } catch { /* already dead */ }
      reject(new Error('timeout'));
    }, timeoutMs);
    rec.onresult = (e) => {
      clearTimeout(timer);
      resolve(e.results[0][0].transcript);
    };
    rec.onerror = (e) => {
      clearTimeout(timer);
      reject(new Error(e.error));
    };
    rec.onend = () => clearTimeout(timer);
    rec.start();
  });
}

// -------------------------------------------------------------------- UI

const INPUT_CLS =
  'w-full h-11 px-4 bg-[var(--sunken)] rounded-[var(--btn-radius)] text-[15px] outline-none ' +
  'border border-transparent focus:border-[var(--line)]';

const shell = (inner) => `
  <div data-voice>
    <p class="text-[13px] text-[var(--ink-soft)] mb-3">
      ${esc(t('Try: “Helmet is in living room”', 'try: helmet is in living room'))}
    </p>
    ${inner}
  </div>`;

const micButton = (listening) => `
  <button type="button" data-voice-mic ${speechSupported() ? '' : 'hidden'}
          class="w-full h-12 rounded-[var(--btn-radius)] border border-[var(--line)]
                 flex items-center justify-center gap-2 text-sm font-medium
                 ${listening ? 'bg-[var(--sunken)] animate-pulse' : 'bg-[var(--paper)]'}">
    ${icon(listening ? 'close' : 'mic', 'w-5 h-5')}
    ${esc(listening ? t('Listening… tap to stop', 'recording…') : t('Speak now', 'speak'))}
  </button>`;

const typeBox = (value = '') => `
  <div class="mt-3 flex items-center gap-2">
    <input data-voice-text type="text" value="${esc(value)}" class="${INPUT_CLS} flex-1 min-w-0"
           placeholder="${esc(t('or type it here', 'or type it'))}" />
    <button type="button" data-voice-parse
            class="h-11 px-4 rounded-[var(--btn-radius)] bg-[var(--ink)] text-[var(--paper)] text-sm font-medium shrink-0">
      ${esc(t('Go', 'run'))}
    </button>
  </div>`;

const failLine = (msg) => `<p class="mt-3 text-sm text-red-600">${esc(msg)}</p>`;
const spinner = '<div class="skeleton h-11 rounded-[var(--btn-radius)]"></div>';

/**
 * Opens the voice sheet and drives the whole flow: listen → parse → resolve →
 * confirm. Nothing applies without the Yes button.
 */
export function openVoiceSheet() {
  let el = null;
  let close = null;
  let session = 0; // bumps on every run; late mic errors must not clobber it

  const draw = (inner) => { if (el) el.innerHTML = shell(inner); };

  const wireType = () => {
    el?.querySelector('[data-voice-parse]')?.addEventListener('click', () => {
      run(el.querySelector('[data-voice-text]').value);
    });
    el?.querySelector('[data-voice-text]')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') run(el.querySelector('[data-voice-text]').value);
    });
    el?.querySelector('[data-voice-mic]')?.addEventListener('click', listen);
  };

  const home = (note = '', transcript = '') => {
    const mine = ++session;
    draw(`${micButton(false)}${note ? failLine(note) : ''}${typeBox(transcript)}`);
    wireType();
    return mine;
  };

  const listen = async () => {
    if (!speechSupported()) return;
    const mine = ++session;
    // The typed fallback stays visible while listening — a recogniser that
    // hangs or a denied prompt must never take the sheet hostage.
    draw(`${micButton(true)}${typeBox()}`);
    wireType();
    el.querySelector('[data-voice-mic]').addEventListener('click', () => close());
    try {
      const transcript = await listenOnce();
      if (mine === session) await run(transcript, mine);
    } catch (err) {
      if (mine === session) {
        home(err.message === 'not-allowed'
          ? t('Microphone permission is off — type it instead', 'mic denied — type it')
          : t('Could not hear that — try again or type it', 'nothing heard'));
      }
    }
  };

  async function run(transcript, mine = ++session) {
    const parsed = parseUtterance(transcript);
    draw(`${spinner}${typeBox(transcript)}`);
    wireType();
    let a;
    try {
      a = await resolveAction(parsed);
    } catch {
      if (mine === session) home(t('Could not reach the database — try again', 'unreachable'), transcript);
      return;
    }
    if (mine !== session) return;
    try {
      render(a, transcript);
    } catch (err) {
      home(`${t('Could not work that out', 'parse failed')} — ${err.message}`, transcript);
    }
  }

  const runAction = async (a) => {
    draw(spinner);
    try {
      await applyAction(a);
      close();
    } catch {
      home(t('That did not go through — try again', 'failed'));
    }
  };

  function render(a, transcript) {
    const typed = typeBox(transcript);

    if (a.status === 'item-choices' || a.status === 'place-choices') {
      const which = a.status === 'item-choices' ? a.parsed.item : a.parsed.place;
      const choices = a.choices.map((c) => ({
        ...c,
        label: c.label ?? `${c.name} — ${c.location?.path_string ?? ''}`,
      }));
      draw(`
        <p class="text-[15px] font-medium">${esc(t(`Which “${which}”?`, `which ${which}?`))}</p>
        <div class="mt-2 surface divide-y divide-[var(--line)] overflow-hidden">
          ${choices.map((c, i) => `
            <button type="button" data-choice="${i}"
                    class="w-full text-left px-4 py-3 text-sm hover:bg-[var(--sunken)]">${esc(c.label)}</button>`).join('')}
        </div>
        ${typed}`);
      el.querySelectorAll('[data-choice]').forEach((b) => {
        b.addEventListener('click', () => {
          const c = choices[Number(b.dataset.choice)];
          runAction(a.status === 'item-choices'
            ? { ...a, item: c }
            : { ...a, place: c });
        });
      });
      wireType();
      return;
    }

    if (a.status === 'empty' || a.status === 'ambiguous') {
      draw(`
        <p class="text-[15px]">${esc(t('I heard something like:', 'parsed:'))}
           <span class="font-medium">${esc(a.text ?? a.raw ?? '')}</span></p>
        <p class="text-[13px] text-[var(--ink-soft)] mt-1">${esc(t('Split it into the thing and the place:', 'item and place:'))}</p>
        <div class="mt-2 space-y-2">
          <input data-amb-item type="text" class="${INPUT_CLS}" placeholder="${esc(t('the thing', 'item'))}"
                 value="${esc(a.item ?? '')}" />
          <input data-amb-place type="text" class="${INPUT_CLS}" placeholder="${esc(t('the place', 'place'))}"
                 value="${esc(a.place ?? '')}" />
        </div>
        <div class="mt-3">${primaryButton(t('Look it up', 'resolve'), 'data-amb-go')}</div>
        ${typeBox(transcript)}`);
      el.querySelector('[data-amb-go]').addEventListener('click', () => {
        const item = el.querySelector('[data-amb-item]').value.trim();
        const place = el.querySelector('[data-amb-place]').value.trim();
        if (item !== '' && place !== '') run(`${item} in ${place}`);
      });
      wireType();
      return;
    }

    // Built lazily per status: an object literal would evaluate every branch's
    // accesses, and each status leaves different fields undefined.
    let headline;
    if (a.status === 'confirm') {
      headline = t(`Move <b>${esc(a.item.name)}</b> to <b>${esc(a.place.name)}</b>?`,
        `git mv <b>${esc(a.item.name)}</b> <b>${esc(a.place.name)}</b>?`);
    } else if (a.status === 'create-item') {
      headline = t(`Nothing called “${esc(a.parsed.item)}” — add it to <b>${esc(a.place.name)}</b>?`,
        `no file ${esc(a.parsed.item)} — create in <b>${esc(a.place.name)}</b>?`);
    } else if (a.status === 'create-place') {
      headline = t(`No place called “${esc(a.parsed.place)}” — create it and move <b>${esc(a.item.name)}</b> there?`,
        `no folder ${esc(a.parsed.place)} — create and move?`);
    } else {
      headline = t(`Add “${esc(a.parsed.item)}” in a new <b>${esc(a.parsed.place)}</b>?`,
        `create <b>${esc(a.parsed.place)}</b> and add ${esc(a.parsed.item)}?`);
    }

    draw(`
      <div class="text-[15px] leading-relaxed">${headline}</div>
      <div class="mt-4 flex gap-2 items-stretch">
        <div class="flex-1">${primaryButton(t('Yes', 'yes'), 'data-voice-yes')}</div>
        <div class="flex-1">${ghostButton(t('No', 'no'), 'data-voice-no')}</div>
      </div>
      ${typed}`);
    el.querySelector('[data-voice-yes]').addEventListener('click', () => runAction(a));
    el.querySelector('[data-voice-no]').addEventListener('click', () => close());
    wireType();
  }

  close = openSheet({
    title: t('Where did it go?', 'where did it go?'),
    body: shell(spinner),
    onMount(bodyEl) {
      el = bodyEl;
      home();
      if (speechSupported()) listen();
    },
    // Anything still in flight answers to a dead session after the sheet goes.
    onClose() {
      session += 1;
      el = null;
    },
  });

  return close;
}
