// House Shift routes: enter, work inside the copy, and leave it by committing
// or discarding. All of /api is behind the household passcode already; the
// shift is just another thing a household member can do.

import {
  decode, decodeWithKeys, normaliseTags, queryBool, urlID, writeErr, writeJSON, writeStoreErr,
} from '../http.js';
import { parseDateUTC } from '../model.js';
import {
  addShiftItem, declutterShiftItem, enterShift, exitShift, getShiftItem,
  listShiftItems, moveShiftItem, packTypes, setPack, shiftActive, shiftSummary,
} from '../store/shift.js';

const SHIFT_ITEM_SCHEMA = {
  name: 'str',
  description: 'str',
  quantity: 'int',
  tags: 'strArray',
  icon: 'str',
  room_id: 'uuid',
  storage_unit_id: 'uuid',
  parent_item_id: 'uuid',
  pack_type: 'str',
  pack_room_id: 'uuid',
  purchase_price: 'num',
  purchased_on: 'str',
};

export function registerShift(router, s) {
  router.get('/api/shift', async (req, res) => {
    try {
      if (!(await shiftActive(s.store))) {
        writeJSON(res, 200, { active: false });
        return;
      }
      writeJSON(res, 200, { ...(await shiftSummary(s.store)), items: await listShiftItems(s.store) });
    } catch (err) {
      writeStoreErr(res, err);
    }
  });

  router.post('/api/shift/enter', async (req, res) => {
    try {
      writeJSON(res, 200, await enterShift(s.store));
    } catch (err) {
      writeStoreErr(res, err);
    }
  });

  router.post('/api/shift/exit', async (req, res) => {
    const b = await decode(req, res, { commit: 'bool' });
    if (b === null) return;
    try {
      writeJSON(res, 200, await exitShift(s.store, Boolean(b.commit)));
    } catch (err) {
      writeStoreErr(res, err);
    }
  });

  router.post('/api/shift/items', async (req, res) => {
    const b = await decode(req, res, SHIFT_ITEM_SCHEMA);
    if (b === null) return;
    if (!b.name || b.name.trim() === '') {
      writeErr(res, 400, 'name is required');
      return;
    }
    if (b.purchased_on !== undefined && b.purchased_on !== null
        && parseDateUTC(b.purchased_on) === null) {
      writeErr(res, 400, 'purchased_on must be a date like 2025-01-03');
      return;
    }
    try {
      writeJSON(res, 201, await addShiftItem(s.store, {
        name: b.name.trim(),
        description: b.description?.trim() ?? '',
        quantity: b.quantity ?? 1,
        tags: normaliseTags(b.tags ?? []) ?? [],
        icon: b.icon?.trim() ?? '',
        roomID: b.room_id ?? null,
        storageUnitID: b.storage_unit_id ?? null,
        parentItemID: b.parent_item_id ?? null,
        purchasePrice: b.purchase_price ?? null,
        purchasedOn: b.purchased_on ?? null,
      }));
    } catch (err) {
      writeStoreErr(res, err);
    }
  });

  router.patch('/api/shift/items/{itemID}', async (req, res) => {
    const id = urlID(req, res, 'itemID');
    if (!id) return;
    const decoded = await decodeWithKeys(req, res, SHIFT_ITEM_SCHEMA);
    if (decoded === null) return;
    const { raw, body: b } = decoded;

    try {
      let item;
      const wantsMove = 'room_id' in raw || 'storage_unit_id' in raw || 'parent_item_id' in raw;
      if (wantsMove) {
        item = await moveShiftItem(s.store, id, {
          roomID: b.room_id ?? null,
          storageUnitID: b.storage_unit_id ?? null,
          parentItemID: 'parent_item_id' in raw ? b.parent_item_id ?? null : undefined,
        });
      }
      if ('pack_type' in raw || 'pack_room_id' in raw) {
        item = await setPack(s.store, id, {
          packType: 'pack_type' in raw ? b.pack_type ?? null : undefined,
          packRoomID: 'pack_room_id' in raw ? b.pack_room_id ?? null : undefined,
        });
      }
      if (!wantsMove && !('pack_type' in raw) && !('pack_room_id' in raw)) {
        writeErr(res, 400, 'nothing to change');
        return;
      }
      writeJSON(res, 200, item);
    } catch (err) {
      writeStoreErr(res, err);
    }
  });

  router.post('/api/shift/items/{itemID}/declutter', async (req, res) => {
    const id = urlID(req, res, 'itemID');
    if (!id) return;
    const b = await decode(req, res, { note: 'str' });
    if (b === null) return;
    try {
      writeJSON(res, 200, await declutterShiftItem(s.store, id, (b.note ?? '').trim() || null));
    } catch (err) {
      writeStoreErr(res, err);
    }
  });

  // The fixed L2 vocabulary, for the picker.
  router.get('/api/shift/pack-types', (req, res) => writeJSON(res, 200, { types: packTypes() }));

  router.get('/api/shift/items/{itemID}', async (req, res) => {
    const id = urlID(req, res, 'itemID');
    if (!id) return;
    try {
      writeJSON(res, 200, await getShiftItem(s.store, id));
    } catch (err) {
      writeStoreErr(res, err);
    }
  });
}
