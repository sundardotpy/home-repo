// Room persistence.

import { notEmpty, notFound } from '../errors.js';
import { withTransaction } from '../db.js';
import { floorLabel } from '../model.js';
import { mapErr, one } from './sql.js';

// Aliases matter here: `i.name` and `r.name` would otherwise share a column
// name, and node-postgres returns rows as objects keyed by column name.
const ROOM_COLS = `r.id AS id, r.name AS name, r.description AS description,
  r.sort_order AS sort_order, r.floor AS floor, r.floor_name AS floor_name,
  r.created_at AS created_at, r.updated_at AS updated_at,
  (SELECT count(*) FROM storage_units su WHERE su.room_id = r.id) AS storage_unit_count,
  (SELECT count(*) FROM items i WHERE i.room_id = r.id) AS item_count`;

function toRoom(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    sort_order: row.sort_order,
    floor: row.floor,
    floor_name: row.floor_name ?? '',
    floor_label: floorLabel(row.floor, row.floor_name),
    created_at: row.created_at,
    updated_at: row.updated_at,
    storage_unit_count: Number(row.storage_unit_count),
    item_count: Number(row.item_count),
  };
}

/** Rooms come back bottom-up: basement first, then ground, then upstairs. */
export async function listRooms(store) {
  const { rows } = await store.pool.query(
    `SELECT ${ROOM_COLS} FROM rooms r ORDER BY r.floor, r.sort_order, lower(r.name)`
  );
  return rows.map(toRoom);
}

export async function getRoom(store, id) {
  const result = await store.pool.query(`SELECT ${ROOM_COLS} FROM rooms r WHERE r.id = $1`, [id]);
  return toRoom(one(result));
}

export async function createRoom(store, input) {
  try {
    const result = await store.pool.query(
      `INSERT INTO rooms (name, description, sort_order, floor, floor_name)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [input.name, input.description, input.sortOrder, input.floor, input.floorName]
    );
    return getRoom(store, result.rows[0].id);
  } catch (err) {
    throw mapErr(err);
  }
}

/**
 * Patch carries only the fields the caller actually sent; everything else is
 * passed as NULL so the COALESCE in the query keeps the stored value.
 */
export async function updateRoom(store, id, patch) {
  try {
    const result = await store.pool.query(
      `UPDATE rooms SET
         name        = COALESCE($2, name),
         description = COALESCE($3, description),
         sort_order  = COALESCE($4, sort_order),
         floor       = COALESCE($5, floor),
         floor_name  = COALESCE($6, floor_name),
         updated_at  = now()
       WHERE id = $1`,
      [id,
        patch.name ?? null, patch.description ?? null, patch.sortOrder ?? null,
        patch.floor ?? null, patch.floorName ?? null]
    );
    if (result.rowCount === 0) throw notFound('room');
    return await getRoom(store, id);
  } catch (err) {
    throw mapErr(err);
  }
}

/**
 * Refuses to delete a room that still holds anything unless cascade is set, in
 * which case its items and its whole unit tree go with it.
 */
export async function deleteRoom(store, id, cascade) {
  return withTransaction(store.pool, async (tx) => {
    const counts = one(await tx.query(
      `SELECT (SELECT count(*) FROM storage_units WHERE room_id = $1) AS units,
              (SELECT count(*) FROM items WHERE room_id = $1) AS items`, [id]
    ));

    if ((counts.units > 0 || counts.items > 0) && !cascade) {
      throw notEmpty('room still holds storage units or items');
    }

    if (cascade) {
      await tx.query(`DELETE FROM items WHERE room_id = $1`, [id]);
      // Deleting roots cascades down parent_id.
      await tx.query(
        `DELETE FROM storage_units WHERE room_id = $1 AND parent_id IS NULL`, [id]);
    }

    const del = await tx.query(`DELETE FROM rooms WHERE id = $1`, [id]);
    if (del.rowCount === 0) throw notFound('room');
  });
}
