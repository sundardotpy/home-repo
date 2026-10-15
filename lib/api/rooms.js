// Room routes.

import {
  noContent, queryBool, queryInt, urlID, writeErr, writeJSON, writeStoreErr, decode,
} from '../http.js';
import { listRooms, createRoom, getRoom, updateRoom, deleteRoom } from '../store/room.js';
import { roomTree } from '../store/unit.js';
import { listItems } from '../store/item.js';

const ROOM_SCHEMA = {
  name: 'str',
  description: 'str',
  sort_order: 'int',
  floor: 'int',
  floor_name: 'str',
};

export function registerRooms(router, s) {
  router.get('/api/rooms', async (req, res) => {
    try {
      writeJSON(res, 200, { rooms: await listRooms(s.store) });
    } catch (err) {
      writeStoreErr(res, err);
    }
  });

  router.post('/api/rooms', async (req, res) => {
    const b = await decode(req, res, ROOM_SCHEMA);
    if (b === null) return;

    if (b.name === undefined || b.name === null || b.name.trim() === '') {
      writeErr(res, 400, 'name is required');
      return;
    }

    try {
      const room = await createRoom(s.store, {
        name: b.name.trim(),
        description: b.description?.trim() ?? '',
        sortOrder: b.sort_order ?? 0,
        floor: b.floor ?? 0,
        floorName: b.floor_name?.trim() ?? '',
      });
      writeJSON(res, 201, room);
    } catch (err) {
      writeStoreErr(res, err);
    }
  });

  router.get('/api/rooms/{roomID}', async (req, res) => {
    const id = urlID(req, res, 'roomID');
    if (!id) return;
    try {
      writeJSON(res, 200, await getRoom(s.store, id));
    } catch (err) {
      writeStoreErr(res, err);
    }
  });

  router.patch('/api/rooms/{roomID}', async (req, res) => {
    const id = urlID(req, res, 'roomID');
    if (!id) return;

    const b = await decode(req, res, ROOM_SCHEMA);
    if (b === null) return;

    if (b.name !== undefined && b.name !== null) {
      const trimmed = b.name.trim();
      if (trimmed === '') {
        writeErr(res, 400, 'name cannot be empty');
        return;
      }
      b.name = trimmed;
    }

    try {
      writeJSON(res, 200, await updateRoom(s.store, id, {
        name: b.name ?? undefined,
        description: b.description ?? undefined,
        sortOrder: b.sort_order ?? undefined,
        floor: b.floor ?? undefined,
        floorName: b.floor_name === null ? undefined : b.floor_name?.trim(),
      }));
    } catch (err) {
      writeStoreErr(res, err);
    }
  });

  router.delete('/api/rooms/{roomID}', async (req, res) => {
    const id = urlID(req, res, 'roomID');
    if (!id) return;
    try {
      await deleteRoom(s.store, id, queryBool(req, 'cascade'));
      noContent(res);
    } catch (err) {
      writeStoreErr(res, err);
    }
  });

  router.get('/api/rooms/{roomID}/tree', async (req, res) => {
    const id = urlID(req, res, 'roomID');
    if (!id) return;
    try {
      const room = await getRoom(s.store, id);
      const tree = await roomTree(s.store, id);
      // Items sitting loose in the room, not inside any unit.
      const { items } = await listItems(s.store, { roomID: id, limit: 200 });
      writeJSON(res, 200, {
        room,
        storage_units: tree,
        unplaced_items: items.filter((it) => it.storage_unit_id === null),
      });
    } catch (err) {
      writeStoreErr(res, err);
    }
  });

  router.get('/api/rooms/{roomID}/items', async (req, res) => {
    const id = urlID(req, res, 'roomID');
    if (!id) return;
    try {
      const { items, total } = await listItems(s.store, {
        roomID: id,
        query: req.query.get('q') ?? '',
        limit: queryInt(req, 'limit', 50),
        offset: queryInt(req, 'offset', 0),
      });
      writeJSON(res, 200, { items, total });
    } catch (err) {
      writeStoreErr(res, err);
    }
  });
}
