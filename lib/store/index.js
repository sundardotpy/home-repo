// Store — the data layer.
//
// Every function here maps Postgres' own vocabulary onto the sentinels in
// lib/errors.js, so the HTTP layer never has to know what a SQLSTATE is.

import { notFound } from '../errors.js';

export class Store {
  #pool;

  constructor(pool) {
    this.#pool = pool;
  }

  get pool() {
    return this.#pool;
  }

  /**
   * The seeded household member. Phase 1 has no auth, so every write is
   * attributed to this user; later phases swap in the session user.
   */
  async defaultUserID() {
    const { rows } = await this.#pool.query(
      `SELECT id FROM users WHERE is_default ORDER BY created_at LIMIT 1`
    );
    if (rows.length === 0) throw notFound('no default user');
    return rows[0].id;
  }
}

export { mapErr, one, oneOr } from './sql.js';
export {
  normaliseTag, listTags, ensureTags, createTag, renameTag, deleteTag, listPropertyKeys,
} from './tag.js';
export { listRooms, getRoom, createRoom, updateRoom, deleteRoom } from './room.js';
export {
  qrSlug, listStorageUnits, getStorageUnit, getStorageUnitBySlug, roomTree,
  createStorageUnit, updateStorageUnit, regenerateSlug, deleteStorageUnit,
} from './unit.js';
export {
  listItems, getItem, createItem, updateItem, itemHistory, recentMoves,
  setItemPhoto, photoKeyOf, deleteItem, declutterItem, restoreItem,
} from './item.js';
export {
  packTypes, shiftActive, enterShift, exitShift, shiftSummary, listShiftItems,
  getShiftItem, moveShiftItem, addShiftItem, declutterShiftItem, setPack,
} from './shift.js';
