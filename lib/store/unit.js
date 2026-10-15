// Storage units — the boxes, drawers and shelves things live in.

import { randomInt } from 'node:crypto';

import { cycle, notFound, roomCross } from '../errors.js';
import { withTransaction } from '../db.js';
import { mapErr, one } from './sql.js';

// Crockford-ish alphabet: no I/L/O/U, so a code read aloud or retyped by hand
// cannot be misread.
const SLUG_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** A short, unambiguous label code for a storage unit. */
export function qrSlug() {
  let out = '';
  for (let i = 0; i < 10; i++) out += SLUG_ALPHABET[randomInt(SLUG_ALPHABET.length)];
  return out;
}

// Every unit read joins the recursive path view so callers always get the human
// readable location, not just a parent pointer. Aliases keep the joined columns
// distinct — node-postgres keys rows by column name.
const UNIT_COLS = `su.id AS id, su.room_id AS room_id, su.parent_id AS parent_id,
  su.name AS name, su.kind AS kind, su.description AS description, su.qr_slug AS qr_slug,
  su.created_at AS created_at, su.updated_at AS updated_at,
  r.name AS room_name, p.path AS path, p.depth AS depth,
  (SELECT count(*) FROM items i WHERE i.storage_unit_id = su.id) AS item_count`;

const UNIT_FROM = `FROM storage_units su
  JOIN rooms r ON r.id = su.room_id
  JOIN storage_unit_paths p ON p.id = su.id`;

function toUnit(row) {
  return {
    id: row.id,
    room_id: row.room_id,
    parent_id: row.parent_id ?? null,
    name: row.name,
    kind: row.kind ?? '',
    description: row.description ?? '',
    qr_slug: row.qr_slug,
    created_at: row.created_at,
    updated_at: row.updated_at,
    room_name: row.room_name,
    path: row.path ?? [],
    depth: row.depth,
    item_count: Number(row.item_count),
  };
}

async function queryUnits(store, where, params) {
  const { rows } = await store.pool.query(
    `SELECT ${UNIT_COLS} ${UNIT_FROM} ${where} ORDER BY p.path`, params);
  return rows.map(toUnit);
}

/**
 * roomID/parentID are null when not filtering. rootOnly keeps only units
 * sitting directly in the room.
 */
export async function listStorageUnits(store, { roomID = null, parentID = null, rootOnly = false } = {}) {
  const params = [];
  let where = 'WHERE true';

  if (roomID) {
    params.push(roomID);
    where += ` AND su.room_id = $${params.length}`;
  }
  if (parentID) {
    params.push(parentID);
    where += ` AND su.parent_id = $${params.length}`;
  } else if (rootOnly) {
    where += ` AND su.parent_id IS NULL`;
  }

  return queryUnits(store, where, params);
}

export async function getStorageUnit(store, id) {
  const result = await store.pool.query(
    `SELECT ${UNIT_COLS} ${UNIT_FROM} WHERE su.id = $1`, [id]);
  return toUnit(one(result));
}

/** Backs the QR scan endpoint. */
export async function getStorageUnitBySlug(store, slug) {
  const result = await store.pool.query(
    `SELECT ${UNIT_COLS} ${UNIT_FROM} WHERE su.qr_slug = $1`, [slug]);
  return toUnit(one(result));
}

/** The room's units nested as an actual tree, for the browse UI. */
export async function roomTree(store, roomID) {
  const flat = await listStorageUnits(store, { roomID });
  const byID = new Map(flat.map((u) => [u.id, u]));

  const roots = [];
  for (const u of flat) {
    if (u.parent_id === null) {
      roots.push(u);
      continue;
    }
    const parent = byID.get(u.parent_id);
    if (parent) {
      (parent.children ??= []).push(u);
    } else {
      roots.push(u); // orphan guard; shouldn't happen
    }
  }
  return roots;
}

export async function createStorageUnit(store, input) {
  let roomID = input.roomID ?? null;
  const parentID = input.parentID ?? null;

  // A child always lives in its parent's room; trust the parent over the payload.
  if (parentID) {
    const parent = one(await store.pool.query(
      `SELECT room_id FROM storage_units WHERE id = $1`, [parentID]));
    if (roomID && roomID !== parent.room_id) throw roomCross(parent.room_id);
    roomID = parent.room_id;
  }

  const result = await store.pool.query(
    `INSERT INTO storage_units (room_id, parent_id, name, kind, description, qr_slug)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [roomID, parentID, input.name, input.kind ?? '', input.description ?? '', qrSlug()]
  );
  return getStorageUnit(store, result.rows[0].id);
}

export async function updateStorageUnit(store, id, patch) {
  await withTransaction(store.pool, async (tx) => {
    const current = one(await tx.query(
      `SELECT room_id FROM storage_units WHERE id = $1`, [id]));
    const curRoom = current.room_id;

    await tx.query(`
      UPDATE storage_units SET
        name        = COALESCE($2, name),
        kind        = COALESCE($3, kind),
        description = COALESCE($4, description),
        qr_slug     = COALESCE($5, qr_slug),
        updated_at  = now()
      WHERE id = $1`,
      [id,
        patch.name ?? null, patch.kind ?? null,
        patch.description ?? null, patch.qrSlug ?? null]
    );

    // setParent distinguishes "parent_id": null (move to room root) from the
    // field being absent entirely.
    if (patch.setParent || patch.roomID) {
      let newRoom = curRoom;
      if (patch.roomID) newRoom = patch.roomID;

      if (patch.setParent && patch.parentID) {
        if (patch.parentID === id) throw cycle();

        // Moving a unit under its own descendant would orphan the subtree.
        const desc = await tx.query(
          `SELECT $1 = ANY(id_path) AS hit FROM storage_unit_paths WHERE id = $2`,
          [id, patch.parentID]);
        if (desc.rows.length > 0 && desc.rows[0].hit) throw cycle();

        const parent = one(await tx.query(
          `SELECT room_id FROM storage_units WHERE id = $1`, [patch.parentID]));
        if (patch.roomID && patch.roomID !== parent.room_id) {
          throw roomCross(parent.room_id);
        }
        newRoom = parent.room_id;
      }

      if (patch.setParent) {
        await tx.query(
          `UPDATE storage_units SET parent_id = $2, updated_at = now() WHERE id = $1`,
          [id, patch.parentID ?? null]);
      }
      if (newRoom !== curRoom) {
        // The whole subtree — and every item in it — follows the unit.
        await retagSubtreeRoom(tx, id, newRoom);
      }
    }
  });

  return getStorageUnit(store, id);
}

/** Rewrites room_id on a unit, its descendants and their items. */
async function retagSubtreeRoom(tx, rootID, roomID) {
  const subtree = `
    WITH RECURSIVE sub AS (
      SELECT id FROM storage_units WHERE id = $1
      UNION ALL
      SELECT su.id FROM storage_units su JOIN sub ON su.parent_id = sub.id
    )`;
  await tx.query(subtree + `
    UPDATE items SET room_id = $2, updated_at = now()
    WHERE storage_unit_id IN (SELECT id FROM sub)`, [rootID, roomID]);
  await tx.query(subtree + `
    UPDATE storage_units SET room_id = $2, updated_at = now()
    WHERE id IN (SELECT id FROM sub)`, [rootID, roomID]);
}

/**
 * Issues a fresh code, retiring whatever is printed on the old label. Retried
 * on the astronomically unlikely collision.
 */
export async function regenerateSlug(store, id) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await store.pool.query(
        `UPDATE storage_units SET qr_slug = $2, updated_at = now() WHERE id = $1`,
        [id, qrSlug()]);
      if (result.rowCount === 0) throw notFound('storage unit');
      return getStorageUnit(store, id);
    } catch (err) {
      lastErr = mapErr(err);
      if (lastErr.kind !== 'conflict') throw lastErr;
    }
  }
  throw lastErr;
}

/**
 * Removes a unit. By default its children and contents are promoted one level
 * up (to the parent unit, or loose in the room) so nothing silently loses its
 * location. With cascade, the whole subtree and every item inside it is deleted.
 */
export async function deleteStorageUnit(store, id, cascade) {
  return withTransaction(store.pool, async (tx) => {
    const current = one(await tx.query(
      `SELECT parent_id FROM storage_units WHERE id = $1`, [id]));
    const parentID = current.parent_id ?? null;

    if (cascade) {
      const sub = `
        WITH RECURSIVE sub AS (
          SELECT id FROM storage_units WHERE id = $1
          UNION ALL
          SELECT su.id FROM storage_units su JOIN sub ON su.parent_id = sub.id
        )`;
      await tx.query(sub + `
        DELETE FROM items WHERE storage_unit_id IN (SELECT id FROM sub)`, [id]);
    } else {
      await tx.query(
        `UPDATE storage_units SET parent_id = $2, updated_at = now() WHERE parent_id = $1`,
        [id, parentID]);
      await tx.query(
        `UPDATE items SET storage_unit_id = $2, updated_at = now() WHERE storage_unit_id = $1`,
        [id, parentID]);
    }

    const del = await tx.query(`DELETE FROM storage_units WHERE id = $1`, [id]);
    if (del.rowCount === 0) throw notFound('storage unit');
  });
}
