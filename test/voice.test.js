import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseUtterance } from '../internal/web/static/js/voice-parse.js';

// The same table checks the Android port (VoiceParseTest.kt).
const cases = readFileSync(new URL('./voice-cases.tsv', import.meta.url), 'utf8')
  .split('\n')
  .filter((line) => line !== '' && !line.startsWith('#'))
  .map((line) => line.split('\t'));

test('voice parser matches the shared case table', () => {
  assert.ok(cases.length > 10);
  for (const [transcript, kind, item, place] of cases) {
    const got = parseUtterance(transcript);
    assert.equal(got.kind, kind, transcript);
    if (kind === 'move') assert.deepEqual([got.item, got.place], [item, place], transcript);
  }
});
