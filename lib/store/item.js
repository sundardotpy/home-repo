// Item persistence and location history.

import { cycle, invalid, notEmpty, notFound, roomCross } from '../errors.js';
import { withTransaction } from '../db.js';
import { log } from '../log.js';
import { isNil } from '../uuid.js';
import { newLocation, newValue, photoURLs } from '../model.js';
import { mapErr, one } from './sql.js';

// Joined columns are aliased: `i.name` and `r.name` would otherwise collide in
// the row objects node-postgres builds.
const ITEM_COLS = `i.id AS id, i.name AS name, i.description AS description,
  i.quantity AS quantity, i.tags AS tags, i.icon AS icon, i.barcode AS barcode,
  i.properties AS properties, i.room_id AS room_id, i.storage_unit_id AS storage_unit_id,
  i.parent_item_id AS parent_item_id, i.status AS status,
  i.decluttered_at AS decluttered_at, i.declutter_note AS declutter_note,
  i.photo_path AS photo_path, i.created_by AS created_by, i.updated_by AS updated_by,
  i.created_at AS created_at, i.updated_at AS updated_at,
  i.purchase_price::float8 AS purchase_price,
  to_char(i.purchased_on, 'YYYY-MM-DD') AS purchased_on,
  r.name AS room_name, r.floor AS floor, r.floor_name AS floor_name,
  p.path AS unit_path, ip.path AS item_path`;

const ITEM_FROM = `FROM items i
  JOIN rooms r ON r.id = i.room_id
  LEFT JOIN storage_unit_paths p ON p.id = i.storage_unit_id
  LEFT JOIN item_paths ip ON ip.id = i.id`;

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
    parent_item_id: row.parent_item_id ?? null,
    status: row.status ?? 'active',
    decluttered_at: row.decluttered_at ?? null,
    declutter_note: row.declutter_note ?? '',
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
      row.storage_unit_id ?? null, row.unit_path ?? [],
      row.parent_item_id ?? null, row.item_path ?? [],
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
  // The active inventory is the default view; the decluttered and everything
  // are reachable explicitly.
  if (f.status === 'decluttered') where.push(`i.status = 'decluttered'`);
  else if (f.status === 'all') where.push(`true`);
  else where.push(`i.status = 'active'`);
  if (f.containerID) {
    if (f.deep) {
      // The container itself plus everything nested below it.
      where.push(`(i.id = ${a.add(f.containerID)} OR ${a.add(f.containerID)} = ANY(ip.id_path))`);
    } else {
      where.push(`i.parent_item_id = ${a.add(f.containerID)}`);
    }
  }
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

  // The count rides on the same joins, so filters that reach into item_paths
  // (deep container lists) count what they filter.
  const countResult = await store.pool.query(
    `SELECT count(*) AS total FROM items i
     LEFT JOIN item_paths ip ON ip.id = i.id
     WHERE ${clause}`, a.vals);
  const total = Number(countResult.rows[0].total);

  let order = f.sort === 'recent'
    ? 'ORDER BY i.created_at DESC, lower(i.name)'
    : 'ORDER BY lower(i.name)';
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
  let roomID = input.roomID ?? null;
  let unitID = input.storageUnitID ?? null;

  if (!isNil(input.parentItemID)) {
    // Inside another item: the container decides the physical placement, the
    // same way a unit's room wins over the payload for units.
    const parent = one(await store.pool.query(
      `SELECT room_id, storage_unit_id FROM items WHERE id = $1`, [input.parentItemID]));
    roomID = parent.room_id;
    unitID = parent.storage_unit_id;
  } else {
    roomID = await resolveRoom(store, roomID, unitID);
  }

  const result = await store.pool.query(
    `INSERT INTO items (name, description, quantity, tags, icon, barcode, properties,
                        room_id, storage_unit_id, parent_item_id, photo_path,
                        created_by, updated_by, purchase_price, purchased_on)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $12,
             $13::numeric, $14::date) RETURNING id`,
    [input.name, input.description ?? '', input.quantity ?? 1,
      input.tags ?? [], input.icon ?? '', input.barcode ?? '',
      jsonbArg(input.properties ?? {}), roomID, unitID,
      input.parentItemID ?? null, input.photoPath ?? null, input.actorID ?? null,
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
  let parentID = cur.parent_item_id;

  // Buying more of the same thing: adjust the count and, when positive, log an
  // acquisition. quantity and quantity_delta are alternative routes to the same
  // field.
  let quantity = patch.quantity ?? null;
  let acquisition = 0;
  if (patch.quantityDelta !== undefined && patch.quantityDelta !== null) {
    if (patch.quantity !== undefined && patch.quantity !== null) {
      throw invalid('send quantity or quantity_delta, not both');
    }
    acquisition = patch.quantityDelta;
    const want = cur.quantity + acquisition;
    if (want < 0) throw invalid('quantity cannot go below zero');
    quantity = want;
  }

  // Placing the item inside another item (or taking it out with an explicit
  // null): the container decides the physical placement.
  if (patch.setParentItem) {
    if (patch.parentItemID) {
      if (patch.parentItemID === id) throw cycle();
      // Placing a box inside its own contents would orphan the subtree.
      const desc = await store.pool.query(
        `SELECT $1 = ANY(id_path) AS hit FROM item_paths WHERE id = $2`,
        [id, patch.parentItemID]);
      if (desc.rows.length === 0) throw notFound('container item');
      if (desc.rows[0].hit) throw cycle();
      const parent = one(await store.pool.query(
        `SELECT room_id, storage_unit_id FROM items WHERE id = $1`, [patch.parentItemID]));
      if (patch.setLocation) {
        // An explicit room/unit in the same patch must agree with the container.
        if (patch.storageUnitID && patch.storageUnitID !== parent.storage_unit_id) {
          throw roomCross(parent.room_id);
        }
        if (patch.roomID && patch.roomID !== parent.room_id) throw roomCross(parent.room_id);
      }
      roomID = parent.room_id;
      unitID = parent.storage_unit_id;
    }
    parentID = patch.parentItemID ?? null;
  } else if (patch.setLocation) {
    // A move to a room or unit takes the item out of its container: the two
    // placements cannot disagree about where the thing is.
    unitID = patch.storageUnitID ?? null;
    parentID = null;
    let want = null;
    if (patch.roomID) want = patch.roomID;
    else if (!unitID) want = cur.room_id;
    roomID = await resolveRoom(store, want, unitID);
  }

  const run = async (tx) => {
    const result = await tx.query(
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
         parent_item_id  = $12,
         updated_by      = COALESCE($13, updated_by),
         purchase_price  = CASE WHEN $14::boolean THEN $15::numeric ELSE purchase_price END,
         purchased_on    = CASE WHEN $16::boolean THEN $17::date ELSE purchased_on END,
         updated_at      = now()
       WHERE id = $1`,
      [id,
        patch.name ?? null, patch.description ?? null, quantity,
        patch.tags ?? null, patch.icon ?? null, patch.barcode ?? null,
        jsonbArg(patch.properties ?? null), patch.photoPath ?? null,
      roomID, unitID, parentID, patch.actorID ?? null,
      patch.setPrice ?? false, patch.purchasePrice ?? null,
      patch.setPurchasedOn ?? false, patch.purchasedOn ?? null]
    );
    if (result.rowCount === 0) throw notFound('item');

    // Everything nested inside this item follows it: same room, same nearest unit.
    if (patch.setLocation || patch.setParentItem) {
      await retagItemSubtree(tx, id, roomID, unitID);
    }
  };

  if (patch.setLocation || patch.setParentItem) {
    await withTransaction(store.pool, run);
  } else {
    await run(store.pool);
  }

  const next = await getItem(store, id);

  // Only a real change of place is history; saving the form unchanged is not.
  if (cur.room_id !== next.room_id ||
      !sameUnit(cur.storage_unit_id, next.storage_unit_id) ||
      (cur.parent_item_id ?? null) !== (next.parent_item_id ?? null)) {
    await recordMove(store, next.id, 'moved', cur.location, next.location, patch.actorID ?? null);
  }

  // A positive delta is an acquisition: more of the thing arrived.
  if (acquisition > 0) {
    await recordMove(store, next.id, 'added', null, next.location,
      patch.actorID ?? null, acquisition);
  }
  return next;
}

/** Rewrites room_id and storage_unit_id on an item and everything inside it. */
async function retagItemSubtree(db, rootID, roomID, unitID) {
  const subtree = `
    WITH RECURSIVE sub AS (
      SELECT id FROM items WHERE id = $1
      UNION ALL
      SELECT c.id FROM items c JOIN sub ON c.parent_item_id = sub.id
    )`;
  await db.query(subtree + `
    UPDATE items SET room_id = $2, storage_unit_id = $3, updated_at = now()
    WHERE id IN (SELECT id FROM sub)`, [rootID, roomID, unitID]);
}

/**
 * Marks an item decluttered — given away, sold, tossed. It keeps its record,
 * history and value, but leaves the active inventory. A container still holding
 * active items refuses unless cascade is set, in which case everything below it
 * is decluttered too. Decluttering twice is a no-op.
 */
export async function declutterItem(store, id, note, cascade, actor) {
  const cur = await getItem(store, id);
  if (cur.status === 'decluttered') return cur;

  let childIDs = [];
  await withTransaction(store.pool, async (tx) => {
    if (!cascade) {
      const held = await tx.query(
        `SELECT count(*) AS n FROM items
          WHERE parent_item_id = $1 AND status = 'active'`, [id]);
      if (Number(held.rows[0].n) > 0) {
        throw notEmpty('it still holds items; declutter them first or pass ?cascade=true');
      }
    }

    if (cascade) {
      const kids = await tx.query(`
        WITH RECURSIVE sub AS (
          SELECT id FROM items WHERE id = $1
          UNION ALL
          SELECT c.id FROM items c JOIN sub ON c.parent_item_id = sub.id
        )
        SELECT id FROM sub WHERE id <> $1`, [id]);
      childIDs = kids.rows.map((r) => r.id);
    }

    await tx.query(`
      WITH RECURSIVE sub AS (
        SELECT id FROM items WHERE id = $1
        UNION ALL
        SELECT c.id FROM items c JOIN sub ON c.parent_item_id = sub.id
      )
      UPDATE items SET status = 'decluttered', decluttered_at = now(),
             declutter_note = $2, updated_by = $3, updated_at = now()
       WHERE id IN (SELECT id FROM sub)`, [id, note ?? null, actor ?? null]);
  });

  await recordMove(store, cur.id, 'decluttered', cur.location, cur.location, actor);
  for (const childID of childIDs) {
    const child = await getItem(store, childID);
    await recordMove(store, child.id, 'decluttered', child.location, child.location, actor);
  }
  return getItem(store, id);
}

/** Undoes a declutter: back into the active inventory, where it was. */
export async function restoreItem(store, id, actor) {
  const cur = await getItem(store, id);
  if (cur.status === 'active') return cur;

  await store.pool.query(
    `UPDATE items SET status = 'active', decluttered_at = NULL,
            declutter_note = NULL, updated_by = $2, updated_at = now()
      WHERE id = $1`, [id, actor ?? null]);
  return getItem(store, id);
}

function sameUnit(a, b) {
  return (a ?? null) === (b ?? null);
}

/**
 * Appends to an item's history. A failure here is logged, not thrown: losing one
 * history line is better than refusing the move itself.
 */
export async function recordMove(store, itemID, kind, from, to, actor, quantity = null) {
  if (!to) return;
  try {
    await store.pool.query(
      `INSERT INTO item_moves (item_id, kind, from_room_id, from_unit_id, to_room_id, to_unit_id,
                               from_path, to_path, moved_by, quantity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [itemID, kind,
        from?.room_id ?? null, from?.storage_unit_id ?? null,
        to.room_id, to.storage_unit_id ?? null,
        from?.path ?? [], to.path ?? [], actor ?? null, quantity]
    );
  } catch (err) {
    log.warn('record move', { item: itemID, err });
  }
}

async function moves(store, where, limit, params) {
  const { rows } = await store.pool.query(
    `SELECT m.id AS id, m.item_id AS item_id, i.name AS item_name, i.icon AS item_icon,
            m.kind AS kind, m.from_path AS from_path, m.to_path AS to_path,
            m.to_room_id AS to_room_id, m.to_unit_id AS to_unit_id,
            m.quantity AS quantity, m.moved_at AS moved_at
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
    quantity: m.quantity ?? undefined,
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
  // Children are promoted one level up — to the container's container, or loose
  // wherever this item sits — so nothing silently loses its location. The
  // denormalised room/unit stay valid through the promotion.
  await withTransaction(store.pool, async (tx) => {
    await tx.query(
      `UPDATE items SET parent_item_id = (SELECT parent_item_id FROM items WHERE id = $1)
        WHERE parent_item_id = $1`, [id]);
    const result = await tx.query(`DELETE FROM items WHERE id = $1`, [id]);
    if (result.rowCount === 0) throw notFound('item');
  });
}
