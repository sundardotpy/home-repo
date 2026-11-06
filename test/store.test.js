import test from 'node:test';
import assert from 'node:assert/strict';

import { recordMove, searchMatch } from '../lib/store/item.js';

test('search needs every word somewhere on the item, brand icon included', () => {
  const args = () => ({ vals: [], add(v) { this.vals.push(v); return `$${this.vals.length}`; } });

  const a = args();
  const sql = searchMatch(a, 'Xiaomi  Tablet');
  // One field group per word, joined by AND; the whole query still tries the barcode.
  assert.equal(sql.match(/i\.name ILIKE/g).length, 2);
  assert.match(sql, /\) AND \(/);
  assert.match(sql, /substr\(i\.icon, 7\) LIKE \$2/);
  assert.deepEqual(a.vals, ['%Xiaomi%', '%xiaomi%', '%Tablet%', '%tablet%', 'Xiaomi  Tablet']);

  // A word with no letters or digits gets no brand clause: it would match every brand.
  const b = args();
  assert.doesNotMatch(searchMatch(b, '&'), /i\.icon/);
  assert.deepEqual(b.vals, ['%&%', '&']);
});

test('move history writes columns in matching parameter order', async () => {
  let captured;
  const store = {
    pool: {
      async query(sql, values) { captured = { sql, values }; },
    },
  };
  const from = { room_id: 'from-room', storage_unit_id: 'from-unit', path: ['Home', 'Old'] };
  const to = { room_id: 'to-room', storage_unit_id: 'to-unit', path: ['Home', 'New'] };

  await recordMove(store, 'item-id', 'moved', from, to, 'actor-id');

  assert.match(captured.sql, /from_room_id, from_unit_id, to_room_id, to_unit_id,\s+from_path, to_path, moved_by, quantity/);
  assert.deepEqual(captured.values, [
    'item-id', 'moved', 'from-room', 'from-unit', 'to-room', 'to-unit',
    ['Home', 'Old'], ['Home', 'New'], 'actor-id', null,
  ]);
});
