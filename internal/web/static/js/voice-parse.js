// The voice parser on its own, with no browser imports, so Node tests run it
// against test/voice-cases.tsv — the same table the Android port is checked on.

const PREP = /\s+(?:in|into|inside|at|to)\s+/gi;
const VERB = /^(?:is|are|was|goes|went)$/i;

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
    // "is in the kitchen" has no item: a bare verb is not a name.
    if (item === '' || place === '' || VERB.test(item)) return { kind: 'ambiguous', text: s };
    return { kind: 'move', item, place, raw: String(text ?? '') };
  }
}

function clean(s) {
  return s
    .replace(/^(?:the|a|an|my|our)\s+/i, '')
    .replace(/[.!?,;]+$/, '')
    .trim();
}
