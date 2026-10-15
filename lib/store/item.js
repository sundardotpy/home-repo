// Item persistence and location history.

import { invalid, notFound, roomCross } from '../errors.js';
import { log } from '../log.js';
import { isNil } from '../uuid.js';
import { newLocation, newValue, photoURLs } from '../model.js';
import { mapErr, one } from './sql.js';

// Joined columns are aliased: `i.name` and `r.name` would otherwise collide in
// the row objects node-postgres builds.
const ITEM_COLS = `i.id AS id, i.name AS name, i.description AS description,
  i.quantity AS quantity, i.tags AS tags, i.icon AS icon, i.barcode AS barcode,
  i.properties AS properties, i.room_id AS room_id, i.storage_unit_id AS storage_unit_id,
  i.photo_path AS photo_path, i.created_by AS created_by, i.updated_by AS updated_by,
  i.created_at AS created_at, i.updated_at AS updated_at,
  i.purchase_price::float8 AS purchase_price,
  to_char(i.purchased_on, 'YYYY-MM-DD') AS purchased_on,
  r.name AS room_name, r.floor AS floor, r.floor_name AS floor_name, p.path AS unit_path`;

const ITEM_FROM = `FROM items i
  JOIN rooms r ON r.id = i.room_id
  LEFT JOIN storage_unit_paths p ON p.id = i.storage_unit_id`;

function toItem(row) {
  const purchasePrice = row.purchase_price ?? null;
  const purchasedOn = row.purchased_on ?? null;
  const photoPath = row.photo_path ?? null;
  const urls = photoURLs(photoPath);

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    quantity: row.quantity,
    tags: row.tags ?? [],
    icon: row.icon ?? '',
    barcode: row.barcode ?? '',
    // Properties are user-defined fields: any key, any value.
    properties: row.properties ?? {},
    room_id: row.room_id,
    storage_unit_id: row.storage_unit_id ?? null,
    photo_path: photoPath,
    photo_url: urls.full || undefined,
    photo_thumb_url: urls.thumb || undefined,
    created_by: row.created_by ?? null,
    updated_by: row.updated_by ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    purchase_price: purchasePrice,
    purchased_on: purchasedOn,
    value: newValue(purchasePrice, purchasedOn) ?? undefined,
    location: newLocation(
      row.room_id, row.room_name, row.floor, row.floor_name,
      row.storage_unit_id ?? null, row.unit_path ?? []
    ),
  };
}

/**
 * Accumulates placeholders so filters can be composed in any order.
 */
class Args {
  vals = [];
  add(v) {
    this.vals.push(v);
    return `$${this.vals.length}`;
  }
}

/**
 * jsonbArg encodes a property set for a jsonb parameter, as a string.
 *
 * A string is sent as text, so `$n::jsonb` parses it in every mode. A null
 * returns null, which the COALESCE in the update reads as "leave it alone".
 */
function jsonbArg(m) {
  if (m === null || m === undefined) return null;
  return JSON.stringify(m);
}

export async function listItems(store, f) {
  const a = new Args();
  const where = ['true'];
  const query = (f.query ?? '').trim();

  if (query !== '') {
    const p = a.add(`%${query}%`);
    // A barcode typed into the search box should find its item, so the
    // exact-code match rides along with the fuzzy ones.
    where.push(
      `(i.name ILIKE ${p} OR i.description ILIKE ${p} OR i.barcode = ${a.add(query)}` +
      ` OR EXISTS (SELECT 1 FROM unnest(i.tags) tg WHERE tg ILIKE ${p})` +
      ` OR EXISTS (SELECT 1 FROM jsonb_each_text(i.properties) pr` +
      ` WHERE pr.key ILIKE ${p} OR pr.value ILIKE ${p}))`
    );
  }
  const code = (f.barcode ?? '').trim();
  if (code !== '') where.push(`i.barcode = ${a.add(code)}`);
  if (f.hasBarcode) where.push(`i.barcode <> ''`);
  if (f.hasPrice) where.push(`i.purchase_price IS NOT NULL AND i.purchased_on IS NOT NULL`);

  const propKey = (f.propKey ?? '').trim();
  if (propKey !== '') {
    const propValue = (f.propValue ?? '').trim();
    if (propValue !== '') {
      where.push(`i.properties @> ${a.add(jsonbArg({ [propKey]: propValue }))}::jsonb`);
    } else {
      where.push(`i.properties ? ${a.add(propKey)}`);
    }
  }
  if (f.roomID) where.push(`i.room_id = ${a.add(f.roomID)}`);
  if (f.storageUnitID) {
    if (f.deep) {
      where.push(
        `i.storage_unit_id IN (SELECT sp.id FROM storage_unit_paths sp ` +
        `WHERE ${a.add(f.storageUnitID)} = ANY(sp.id_path))`);
    } else {
      where.push(`i.storage_unit_id = ${a.add(f.storageUnitID)}`);
    }
  }
  if (f.tags && f.tags.length > 0) where.push(`i.tags @> ${a.add(f.tags)}`);

  const clause = where.join(' AND ');

  const countResult = await store.pool.query(
    `SELECT count(*) AS total FROM items i WHERE ${clause}`, a.vals);
  const total = Number(countResult.rows[0].total);

  let order = 'ORDER BY lower(i.name)';
  if (query !== '') {
    // Closest name match first, so "drill" beats "drill bit case".
    order = `ORDER BY similarity(i.name, ${a.add(query)}) DESC, lower(i.name)`;
  }
  let limit = f.limit ?? 0;
  if (limit <= 0 || limit > 200) limit = 50;

  const sql = `SELECT ${ITEM_COLS} ${ITEM_FROM} WHERE ${clause} ${order}` +
    ` LIMIT ${a.add(limit)} OFFSET ${a.add(Math.max(f.offset ?? 0, 0))}`;

  const { rows } = await store.pool.query(sql, a.vals);
  return { items: rows.map(toItem), total };
}

export async function getItem(store, id) {
  const result = await store.pool.query(
    `SELECT ${ITEM_COLS} ${ITEM_FROM} WHERE i.id = $1`, [id]);
  return toItem(one(result));
}

export async function createItem(store, input) {
  const roomID = await resolveRoom(store, input.roomID ?? null, input.storageUnitID ?? null);

  const result = await store.pool.query(
    `INSERT INTO items (name, description, quantity, tags, icon, barcode, properties,
                        room_id, storage_unit_id, photo_path, created_by, updated_by,
                        purchase_price, purchased_on)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $11,
             $12::numeric, $13::date) RETURNING id`,
    [input.name, input.description ?? '', input.quantity ?? 1,
      input.tags ?? [], input.icon ?? '', input.barcode ?? '',
      jsonbArg(input.properties ?? {}), roomID, input.storageUnitID ?? null,
      input.photoPath ?? null, input.actorID ?? null,
      input.purchasePrice ?? null, input.purchasedOn ?? null]
  );

  const item = await getItem(store, result.rows[0].id);
  await recordMove(store, item.id, 'added', null, item.location, input.actorID ?? null);
  return item;
}

/**
 * Keeps items.room_id honest: when an item is placed inside a unit, the unit's
 * room always wins.
 */
async function resolveRoom(store, roomID, unitID) {
  if (!unitID) {
    if (isNil(roomID)) throw invalid('room_id or storage_unit_id is required');
    return roomID;
  }
  const unit = one(await store.pool.query(
    `SELECT room_id FROM storage_units WHERE id = $1`, [unitID]));
  if (!isNil(roomID) && roomID !== unit.room_id) throw roomCross(unit.room_id);
  return unit.room_id;
}

export async function updateItem(store, id, patch) {
  const cur = await getItem(store, id);

  let roomID = cur.room_id;
  let unitID = cur.storage_unit_id;

  // Relocation uses the same absent-vs-null handling as the unit patch.
  if (patch.setLocation) {
    unitID = patch.storageUnitID ?? null;
    let want = null;
    if (patch.roomID) want = patch.roomID;
    else if (!unitID) want = cur.room_id;
    roomID = await resolveRoom(store, want, unitID);
  }

  const result = await store.pool.query(
    `UPDATE items SET
       name            = COALESCE($2, name),
       description     = COALESCE($3, description),
       quantity        = COALESCE($4, quantity),
       tags            = COALESCE($5, tags),
       icon            = COALESCE($6, icon),
       barcode         = COALESCE($7, barcode),
       properties      = COALESCE($8::jsonb, properties),
       photo_path      = COALESCE($9, photo_path),
       room_id         = $10,
       storage_unit_id = $11,
       updated_by      = COALESCE($12, updated_by),
       purchase_price  = CASE WHEN $13::boolean THEN $14::numeric ELSE purchase_price END,
       purchased_on    = CASE WHEN $15::boolean THEN $16::date ELSE purchased_on END,
       updated_at      = now()
     WHERE id = $1`,
    [id,
      patch.name ?? null, patch.description ?? null, patch.quantity ?? null,
      patch.tags ?? null, patch.icon ?? null, patch.barcode ?? null,
      jsonbArg(patch.properties ?? null), patch.photoPath ?? null,
      roomID, unitID, patch.actorID ?? null,
      patch.setPrice ?? false, patch.purchasePrice ?? null,
      patch.setPurchasedOn ?? false, patch.purchasedOn ?? null]
  );
  if (result.rowCount === 0) throw notFound('item');

  const next = await getItem(store, id);

  // Only a real change of place is history; saving the form unchanged is not.
  if (cur.room_id !== next.room_id || !sameUnit(cur.storage_unit_id, next.storage_unit_id)) {
    await recordMove(store, next.id, 'moved', cur.location, next.location, patch.actorID ?? null);
  }
  return next;
}

function sameUnit(a, b) {
  return (a ?? null) === (b ?? null);
}

/**
 * Appends to an item's history. A failure here is logged, not thrown: losing one
 * history line is better than refusing the move itself.
 */
export async function recordMove(store, itemID, kind, from, to, actor) {
  if (!to) return;
  try {
    await store.pool.query(
      `INSERT INTO item_moves (item_id, kind, from_room_id, from_unit_id, to_room_id, to_unit_id,
                               from_path, to_path, moved_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [itemID, kind,
        from?.room_id ?? null, from?.storage_unit_id ?? null,
        to.room_id, to.storage_unit_id ?? null,
        from?.path ?? [], to.path ?? [], actor ?? null]
    );
  } catch (err) {
    log.warn('record move', { item: itemID, err });
  }
}

async function moves(store, where, limit, params) {
  const { rows } = await store.pool.query(
    `SELECT m.id AS id, m.item_id AS item_id, i.name AS item_name, i.icon AS item_icon,
            m.kind AS kind, m.from_path AS from_path, m.to_path AS to_path,
            m.to_room_id AS to_room_id, m.to_unit_id AS to_unit_id, m.moved_at AS moved_at
       FROM item_moves m
       JOIN items i ON i.id = m.item_id
       ${where}
      ORDER BY m.moved_at DESC
      LIMIT ${limit}`, params);

  return rows.map((m) => ({
    id: m.id,
    item_id: m.item_id,
    item_name: m.item_name,
    item_icon: m.item_icon ?? '',
    kind: m.kind,
    from_path: m.from_path ?? [],
    to_path: m.to_path ?? [],
    to_room_id: m.to_room_id,
    to_unit_id: m.to_unit_id ?? null,
    moved_at: m.moved_at,
  }));
}

/** Where an item has been, newest first. */
export async function itemHistory(store, itemID) {
  return moves(store, 'WHERE m.item_id = $1', 200, [itemID]);
}

/** The "last put away" feed across every item. */
export async function recentMoves(store, limit) {
  let n = limit ?? 0;
  if (n <= 0 || n > 100) n = 10;
  return moves(store, 'WHERE true', n, []);
}

/**
 * Attaches or clears an item's photo key. Callers read the previous key with
 * photoKeyOf first so they can delete the orphaned files.
 */
export async function setItemPhoto(store, id, key, actor) {
  const result = await store.pool.query(
    `UPDATE items
       SET photo_path = $2, updated_by = COALESCE($3, updated_by), updated_at = now()
     WHERE id = $1`, [id, key ?? null, actor ?? null]);
  if (result.rowCount === 0) throw notFound('item');
  return getItem(store, id);
}

/** The photo attached to an item, if any. */
export async function photoKeyOf(store, id) {
  const row = one(await store.pool.query(
    `SELECT photo_path FROM items WHERE id = $1`, [id]));
  return row.photo_path ?? '';
}

export async function deleteItem(store, id) {
  const result = await store.pool.query(`DELETE FROM items WHERE id = $1`, [id]);
  if (result.rowCount === 0) throw notFound('item');
}
