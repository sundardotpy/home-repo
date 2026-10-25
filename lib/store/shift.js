// House Shift mode: a throwaway copy of the active inventory in a `shift`
// schema, so the household can be reorganised without touching live data.
// Entering creates the copy and a journal; every change made inside the mode
// is journalled, and committing replays those journal entries against the live
// tables. Discarding drops the schema — the copy is disposable by design.

import { cycle, invalid, notFound } from '../errors.js';
import { createItem, declutterItem, updateItem } from './item.js';
import { mapErr, one } from './sql.js';

const PACK_TYPES = ['Tech', 'Fragile', 'Wet', 'Soft', 'Small', 'Unsure'];

export async function shiftActive(store) {
  const { rows } = await store.pool.query(
    `SELECT value FROM app_settings WHERE key = 'house_shift'`);
  return rows[0]?.value === 'on';
}

/**
 * Creates the working copy. Idempotent: an active shift is returned as-is so a
 * second browser (or a reload after a crash) resumes the same copy.
 */
export async function enterShift(store) {
  if (await shiftActive(store)) return shiftSummary(store);

  try {
    await store.pool.query(`
      CREATE SCHEMA shift;
      CREATE TABLE shift.items (LIKE items INCLUDING ALL);
      ALTER TABLE shift.items ADD COLUMN pack_type text NOT NULL DEFAULT 'Unsure';
      ALTER TABLE shift.items ADD COLUMN pack_room_id uuid;
      CREATE VIEW shift.item_paths AS
        WITH RECURSIVE up(id, root, id_path, path, depth) AS (
            SELECT id, id, ARRAY[]::uuid[], ARRAY[]::text[], 0 FROM shift.items
          UNION ALL
            SELECT up.id, p.id, p.id || up.id_path, p.name || up.path, up.depth + 1
              FROM up
              JOIN shift.items me ON me.id = up.root
              JOIN shift.items p ON p.id = me.parent_item_id
        )
        SELECT DISTINCT ON (id) id, id_path, path, depth
          FROM up
         ORDER BY id, depth DESC;
      CREATE TABLE shift.journal (
        id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        seq      bigserial,
        op       text NOT NULL,
        item_id  uuid,
        payload  jsonb NOT NULL,
        at       timestamptz NOT NULL DEFAULT now()
      );
      INSERT INTO shift.items
        SELECT i.*, 'Unsure', NULL FROM items i WHERE i.status = 'active';
      INSERT INTO app_settings (key, value) VALUES ('house_shift', 'on')
        ON CONFLICT (key) DO UPDATE SET value = 'on';
    `);
  } catch (err) {
    // A half-created copy is worse than none; sweep it up and re-raise.
    await store.pool.query(`DROP SCHEMA IF EXISTS shift CASCADE`).catch(() => {});
    throw mapErr(err);
  }
  return shiftSummary(store);
}

export async function shiftSummary(store) {
  const { rows } = await store.pool.query(`
    SELECT count(*) AS item_count,
           count(*) FILTER (WHERE pack_type = 'Unsure') AS unsure,
           (SELECT count(*) FROM shift.journal) AS changes
      FROM shift.items`);
  return {
    active: true,
    item_count: Number(rows[0].item_count),
    unsure: Number(rows[0].unsure),
    changes: Number(rows[0].changes),
  };
}

/**
 * Ends the mode. With commit, the journal replays against the live tables in
 * order — moves through the normal move path so history rows are written,
 * additions re-created (their shift ids are remapped onto the live ids), and
 * declutters through the declutter path. Then the schema goes.
 */
export async function exitShift(store, commit) {
  if (!(await shiftActive(store))) return { active: false, committed: false };

  if (commit) {
    const { rows } = await store.pool.query(
      `SELECT op, item_id, payload FROM shift.journal ORDER BY seq`);
    const idMap = new Map(); // shift id → live id for items added inside the shift
    const live = (x) => idMap.get(x) ?? x;
    for (const row of rows) {
      const p = row.payload;
      try {
        if (row.op === 'move') {
          await updateItem(store, live(row.item_id), {
            setLocation: Boolean(p.room_id || p.storage_unit_id),
            setParentItem: p.parent_item_id !== undefined && p.parent_item_id !== null,
            roomID: p.room_id ?? null,
            storageUnitID: p.storage_unit_id ?? null,
            parentItemID: p.parent_item_id ?? null,
          });
        } else if (row.op === 'add') {
          const created = await createItem(store, {
            name: p.name, description: p.description ?? '', quantity: p.quantity ?? 1,
            tags: p.tags ?? [], roomID: p.room_id ?? null,
            storageUnitID: p.storage_unit_id ?? null,
            parentItemID: p.parent_item_id ?? null,
            purchasePrice: p.purchase_price ?? null, purchasedOn: p.purchased_on ?? null,
          });
          idMap.set(row.item_id, created.id);
        } else if (row.op === 'declutter') {
          await declutterItem(store, live(p.id), p.note ?? null, false);
        }
      } catch (err) {
        // The live database may have moved on since the shift started (an item
        // deleted, a room gone). Skip what no longer applies; committing is
        // best-effort by design and the journal stays readable in the logs.
        continue;
      }
    }
  }

  await store.pool.query(`
    DROP SCHEMA IF EXISTS shift CASCADE;
    UPDATE app_settings SET value = 'off' WHERE key = 'house_shift';
  `);
  return { active: false, committed: Boolean(commit) };
}

// ------------------------------------------------------- shift-side writes

async function journal(store, op, itemID, payload) {
  await store.pool.query(
    `INSERT INTO shift.journal (op, item_id, payload) VALUES ($1, $2, $3::jsonb)`,
    [op, itemID, JSON.stringify(payload)]);
}

const SHIFT_COLS = `s.id AS id, s.name AS name, s.description AS description,
  s.quantity AS quantity, s.tags AS tags, s.icon AS icon,
  s.room_id AS room_id, s.storage_unit_id AS storage_unit_id,
  s.parent_item_id AS parent_item_id, s.status AS status,
  s.pack_type AS pack_type, s.pack_room_id AS pack_room_id,
  r.name AS room_name, p.path AS unit_path, ip.path AS item_path,
  pr.name AS pack_room_name`;

function toShiftItem(row) {
  const path = [row.room_name, ...(row.unit_path ?? []), ...(row.item_path ?? [])];
  return {
    id: row.id,
    name: row.name,
    icon: row.icon ?? '',
    quantity: row.quantity,
    status: row.status,
    room_id: row.room_id,
    storage_unit_id: row.storage_unit_id ?? null,
    parent_item_id: row.parent_item_id ?? null,
    pack_type: row.pack_type,
    pack_room_id: row.pack_room_id ?? null,
    pack_room_name: row.pack_room_name ?? null,
    location: { path, path_string: path.join(' > ') },
  };
}

/** Every item in the working copy, with its live location names attached. */
export async function listShiftItems(store) {
  const { rows } = await store.pool.query(`
    SELECT ${SHIFT_COLS}
      FROM shift.items s
      JOIN rooms r ON r.id = s.room_id
      LEFT JOIN storage_unit_paths p ON p.id = s.storage_unit_id
      LEFT JOIN item_paths ip ON ip.id = s.id
      LEFT JOIN rooms pr ON pr.id = s.pack_room_id
     ORDER BY s.pack_type, lower(s.name)`);
  return rows.map(toShiftItem);
}

export async function getShiftItem(store, id) {
  const { rows } = await store.pool.query(`
    SELECT ${SHIFT_COLS}
      FROM shift.items s
      JOIN rooms r ON r.id = s.room_id
      LEFT JOIN storage_unit_paths p ON p.id = s.storage_unit_id
      LEFT JOIN item_paths ip ON ip.id = s.id
      LEFT JOIN rooms pr ON pr.id = s.pack_room_id
     WHERE s.id = $1`, [id]);
  if (rows.length === 0) throw notFound('shift item');
  return toShiftItem(rows[0]);
}

/**
 * Relocates an item inside the copy — same rules as the live store (the
 * container decides the room, cycles rejected, subtree follows) and the move
 * is what gets journaled for the commit.
 */
export async function moveShiftItem(store, id, patch) {
  const cur = one(await store.pool.query(
    `SELECT room_id, storage_unit_id, parent_item_id FROM shift.items WHERE id = $1`, [id]));

  let roomID = cur.room_id;
  let unitID = cur.storage_unit_id;
  let parentID = cur.parent_item_id;

  if (patch.parentItemID !== undefined) {
    if (patch.parentItemID) {
      if (patch.parentItemID === id) throw cycle();
      const desc = await store.pool.query(
        `SELECT $1 = ANY(id_path) AS hit FROM shift.item_paths WHERE id = $2`,
        [id, patch.parentItemID]);
      if (desc.rows.length === 0) throw notFound('container item');
      if (desc.rows[0].hit) throw cycle();
      const parent = one(await store.pool.query(
        `SELECT room_id, storage_unit_id FROM shift.items WHERE id = $1`, [patch.parentItemID]));
      roomID = parent.room_id;
      unitID = parent.storage_unit_id;
    }
    parentID = patch.parentItemID ?? null;
  } else if (patch.roomID || patch.storageUnitID) {
    unitID = patch.storageUnitID ?? null;
    parentID = null;
    if (unitID) {
      const unit = one(await store.pool.query(
        `SELECT room_id FROM storage_units WHERE id = $1`, [unitID]));
      if (patch.roomID && patch.roomID !== unit.room_id) throw invalid('room mismatch');
      roomID = unit.room_id;
    } else {
      roomID = patch.roomID ?? cur.room_id;
    }
  }

  try {
    await store.pool.query(`
      WITH RECURSIVE sub AS (
        SELECT id FROM shift.items WHERE id = $1
        UNION ALL
        SELECT c.id FROM shift.items c JOIN sub ON c.parent_item_id = sub.id
      )
      UPDATE shift.items s SET room_id = $2, storage_unit_id = $3,
             parent_item_id = $4, updated_at = now()
       WHERE s.id IN (SELECT id FROM sub)`,
      [id, roomID, unitID, parentID]);
  } catch (err) {
    throw mapErr(err);
  }

  await journal(store, 'move', id, {
    room_id: roomID, storage_unit_id: unitID, parent_item_id: parentID,
  });
  return getShiftItem(store, id);
}

/** Adds an item inside the copy only; the journal is how it reaches live data. */
export async function addShiftItem(store, input) {
  let roomID = input.roomID ?? null;
  let unitID = input.storageUnitID ?? null;
  let parentID = input.parentItemID ?? null;

  if (parentID) {
    const parent = one(await store.pool.query(
      `SELECT room_id, storage_unit_id FROM shift.items WHERE id = $1`, [parentID]));
    roomID = parent.room_id;
    unitID = parent.storage_unit_id;
  } else if (unitID) {
    const unit = one(await store.pool.query(
      `SELECT room_id FROM storage_units WHERE id = $1`, [unitID]));
    roomID = unit.room_id;
  }
  if (!roomID) throw invalid('room_id, storage_unit_id or parent_item_id is required');

  let id;
  try {
    const result = await store.pool.query(
      `INSERT INTO shift.items (name, description, quantity, tags, icon, room_id,
                                storage_unit_id, parent_item_id, purchase_price, purchased_on)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::numeric, $10::date)
       RETURNING id`,
      [input.name, input.description ?? '', input.quantity ?? 1, input.tags ?? [],
        input.icon ?? '', roomID, unitID, parentID,
        input.purchasePrice ?? null, input.purchasedOn ?? null]);
    id = result.rows[0].id;
  } catch (err) {
    throw mapErr(err);
  }

  await journal(store, 'add', id, {
    name: input.name, description: input.description ?? '', quantity: input.quantity ?? 1,
    tags: input.tags ?? [], room_id: roomID, storage_unit_id: unitID,
    parent_item_id: parentID, purchase_price: input.purchasePrice ?? null,
    purchased_on: input.purchasedOn ?? null,
  });
  return getShiftItem(store, id);
}

/** Declutters inside the copy, journaled like every other change. */
export async function declutterShiftItem(store, id, note) {
  const result = await store.pool.query(
    `UPDATE shift.items SET status = 'decluttered', decluttered_at = now(),
            declutter_note = $2, updated_at = now()
      WHERE id = $1`, [id, note ?? null]);
  if (result.rowCount === 0) throw notFound('shift item');
  await journal(store, 'declutter', id, { id, note: note ?? null });
  return getShiftItem(store, id);
}

/** Packing labels are planning-only: they never reach the live tables. */
export async function setPack(store, id, { packType, packRoomID }) {
  if (packType !== undefined && !PACK_TYPES.includes(packType)) {
    throw invalid(`pack_type must be one of ${PACK_TYPES.join(', ')}`);
  }
  const result = await store.pool.query(
    `UPDATE shift.items SET
       pack_type = CASE WHEN $2::text IS NOT NULL THEN $2 ELSE pack_type END,
       pack_room_id = CASE WHEN $3::boolean THEN $4::uuid ELSE pack_room_id END,
       updated_at = now()
     WHERE id = $1`,
    [id, packType ?? null, packRoomID !== undefined, packRoomID ?? null]);
  if (result.rowCount === 0) throw notFound('shift item');
  return getShiftItem(store, id);
}
