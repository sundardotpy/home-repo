import test from 'node:test';
import assert from 'node:assert/strict';

import { recordMove } from '../lib/store/item.js';

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
