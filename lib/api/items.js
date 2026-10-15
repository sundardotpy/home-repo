// Item routes.

import {
  decode, decodeWithKeys, noContent, normaliseTags, queryBool, queryInt, queryUUID,
  urlID, writeErr, writeJSON, writeStoreErr,
} from '../http.js';
import { log } from '../log.js';
import { parseDateUTC } from '../model.js';
import { ensureTags } from '../store/tag.js';
import {
  createItem, deleteItem, getItem, listItems, photoKeyOf, updateItem,
} from '../store/item.js';

const ITEM_SCHEMA = {
  name: 'str',
  description: 'str',
  quantity: 'int',
  tags: 'strArray',
  icon: 'str',
  barcode: 'str',
  properties: 'strMap',
  room_id: 'uuid',
  storage_unit_id: 'uuid',
  photo_path: 'str',
  purchase_price: 'num',
  purchased_on: 'str',
};

const MOVE_SCHEMA = { room_id: 'uuid', storage_unit_id: 'uuid' };

/** Builds the store filter from the query string, answering 400 on bad input. */
function itemFilterFromQuery(req, res) {
  const roomID = queryUUID(req, 'room_id');
  if (roomID.error) {
    writeErr(res, 400, 'invalid room_id');
    return null;
  }
  const unitID = queryUUID(req, 'storage_unit_id');
  if (unitID.error) {
    writeErr(res, 400, 'invalid storage_unit_id');
    return null;
  }

  let tags = null;
  const rawTags = req.query.get('tags');
  if (rawTags) tags = normaliseTags(rawTags.split(','));

  let propKey = '';
  let propValue = '';
  const rawProp = req.query.get('prop');
  if (rawProp) {
    const cut = rawProp.indexOf(':');
    if (cut >= 0) {
      propKey = rawProp.slice(0, cut);
      propValue = rawProp.slice(cut + 1);
    } else {
      propKey = rawProp;
    }
  }

  return {
    query: req.query.get('q') ?? '',
    propKey,
    propValue,
    barcode: normaliseBarcode(req.query.get('barcode') ?? ''),
    hasBarcode: queryBool(req, 'has_barcode'),
    hasPrice: queryBool(req, 'has_price'),
    roomID: roomID.value,
    storageUnitID: unitID.value,
    deep: queryBool(req, 'deep'),
    tags,
    limit: queryInt(req, 'limit', 50),
    offset: queryInt(req, 'offset', 0),
  };
}

/**
 * Barcodes are printed with spaces and hyphens in them often enough that
 * scanners and people both produce variations; keep only the payload.
 */
function normaliseBarcode(s) {
  return s.trim().replace(/[ -]/g, '');
}

/**
 * Checks the optional price and date a client sent. Either may be absent or
 * null; a present value has to make sense.
 */
function validPurchase(price, on) {
  if (price !== null && price !== undefined && (price < 0 || price > 1e9)) {
    return 'purchase_price must be between 0 and 1,000,000,000';
  }
  if (on !== null && on !== undefined && parseDateUTC(on) === null) {
    return 'purchased_on must be a date like 2025-01-03';
  }
  return '';
}

/**
 * Trims both halves and drops entries with an empty key. Values are kept
 * verbatim otherwise: a serial number's case matters.
 */
function normaliseProperties(input) {
  if (input === null || input === undefined) return null;
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    const k = key.trim().split(/\s+/).filter(Boolean).join(' ');
    if (k === '') continue;
    out[k] = value.trim();
  }
  return out;
}

export function registerItems(router, s) {
  router.get('/api/items', async (req, res) => {
    const f = itemFilterFromQuery(req, res);
    if (f === null) return;
    try {
      const { items, total } = await listItems(s.store, f);
      writeJSON(res, 200, { items, total, limit: f.limit, offset: f.offset });
    } catch (err) {
      writeStoreErr(res, err);
    }
  });

  router.get('/api/items/{itemID}', async (req, res) => {
    const id = urlID(req, res, 'itemID');
    if (!id) return;
    try {
      writeJSON(res, 200, await getItem(s.store, id));
    } catch (err) {
      writeStoreErr(res, err);
    }
  });

  router.post('/api/items', async (req, res) => {
    const b = await decode(req, res, ITEM_SCHEMA);
    if (b === null) return;

    if (b.name === undefined || b.name === null || b.name.trim() === '') {
      writeErr(res, 400, 'name is required');
      return;
    }
    if (!b.room_id && !b.storage_unit_id) {
      writeErr(res, 400, 'room_id or storage_unit_id is required');
      return;
    }
    const msg = validPurchase(b.purchase_price, b.purchased_on);
    if (msg) {
      writeErr(res, 400, msg);
      return;
    }
    if (b.quantity !== undefined && b.quantity !== null && b.quantity < 0) {
      writeErr(res, 400, 'quantity cannot be negative');
      return;
    }

    const input = {
      name: b.name.trim(),
      description: b.description?.trim() ?? '',
      quantity: b.quantity ?? 1,
      tags: normaliseTags(b.tags ?? []) ?? [],
      icon: b.icon?.trim() ?? '',
      barcode: b.barcode === undefined || b.barcode === null ? '' : normaliseBarcode(b.barcode),
      properties: normaliseProperties(b.properties) ?? {},
      roomID: b.room_id ?? null,
      storageUnitID: b.storage_unit_id ?? null,
      photoPath: b.photo_path ?? null,
      purchasePrice: b.purchase_price ?? null,
      purchasedOn: b.purchased_on ?? null,
    };
    input.actorID = await actorOrNull(s);

    try {
      const item = await createItem(s.store, input);
      // Anything typed into the tag field joins the vocabulary.
      await ensureTags(s.store, input.tags).catch((err) => log.warn('record tags', { err }));
      writeJSON(res, 201, item);
    } catch (err) {
      writeStoreErr(res, err);
    }
  });

  router.patch('/api/items/{itemID}', async (req, res) => {
    const id = urlID(req, res, 'itemID');
    if (!id) return;

    const decoded = await decodeWithKeys(req, res, ITEM_SCHEMA);
    if (decoded === null) return;
    const { raw, body: b } = decoded;

    if (b.name !== undefined && b.name !== null) {
      const trimmed = b.name.trim();
      if (trimmed === '') {
        writeErr(res, 400, 'name cannot be empty');
        return;
      }
      b.name = trimmed;
    }
    if (b.quantity !== undefined && b.quantity !== null && b.quantity < 0) {
      writeErr(res, 400, 'quantity cannot be negative');
      return;
    }
    const msg = validPurchase(b.purchase_price, b.purchased_on);
    if (msg) {
      writeErr(res, 400, msg);
      return;
    }

    const patch = {
      name: b.name ?? undefined,
      description: b.description ?? undefined,
      quantity: b.quantity ?? undefined,
      tags: normaliseTags(b.tags) ?? undefined,
      icon: b.icon ?? undefined,
      barcode: b.barcode === undefined ? undefined
        : b.barcode === null ? null : normaliseBarcode(b.barcode),
      properties: b.properties === undefined ? undefined : normaliseProperties(b.properties),
      photoPath: b.photo_path ?? undefined,
      actorID: await actorOrNull(s),
    };

    // An absent key leaves the field alone; a present null clears it.
    if ('purchase_price' in raw) {
      patch.setPrice = true;
      patch.purchasePrice = b.purchase_price ?? null;
    }
    if ('purchased_on' in raw) {
      patch.setPurchasedOn = true;
      patch.purchasedOn = b.purchased_on ?? null;
    }
    if ('storage_unit_id' in raw || 'room_id' in raw) {
      patch.setLocation = true;
      patch.storageUnitID = b.storage_unit_id ?? null;
      patch.roomID = b.room_id ?? null;
    }

    try {
      const item = await updateItem(s.store, id, patch);
      if (patch.tags && patch.tags.length > 0) {
        await ensureTags(s.store, patch.tags).catch((err) => log.warn('record tags', { err }));
      }
      writeJSON(res, 200, item);
    } catch (err) {
      writeStoreErr(res, err);
    }
  });

  /**
   * The "I just put this somewhere else" shortcut: a relocation-only PATCH and
   * the natural hook for the move log.
   */
  router.post('/api/items/{itemID}/move', async (req, res) => {
    const id = urlID(req, res, 'itemID');
    if (!id) return;

    const b = await decode(req, res, MOVE_SCHEMA);
    if (b === null) return;
    if (!b.room_id && !b.storage_unit_id) {
      writeErr(res, 400, 'room_id or storage_unit_id is required');
      return;
    }

    try {
      writeJSON(res, 200, await updateItem(s.store, id, {
        setLocation: true,
        roomID: b.room_id ?? null,
        storageUnitID: b.storage_unit_id ?? null,
        actorID: await actorOrNull(s),
      }));
    } catch (err) {
      writeStoreErr(res, err);
    }
  });

  router.delete('/api/items/{itemID}', async (req, res) => {
    const id = urlID(req, res, 'itemID');
    if (!id) return;

    // Read the photo key before the row goes, so its files can go too.
    let key = '';
    if (s.media) {
      try {
        key = await photoKeyOf(s.store, id);
      } catch {
        key = '';
      }
    }
    try {
      await deleteItem(s.store, id);
    } catch (err) {
      writeStoreErr(res, err);
      return;
    }
    if (key) await s.media.delete(key).catch(() => {});
    noContent(res);
  });

  /** The headline feature: name or tag in, full location path out. */
  router.get('/api/search', async (req, res) => {
    const q = (req.query.get('q') ?? '').trim();
    if (q === '') {
      writeErr(res, 400, 'q is required');
      return;
    }
    const f = itemFilterFromQuery(req, res);
    if (f === null) return;
    f.query = q;

    try {
      const { items, total } = await listItems(s.store, f);
      const results = items.map((it) => ({
        id: it.id,
        name: it.name,
        quantity: it.quantity,
        tags: it.tags,
        location: it.location.path_string,
        item: it,
      }));
      writeJSON(res, 200, { query: q, total, results });
    } catch (err) {
      writeStoreErr(res, err);
    }
  });
}

/** The seeded user, or null when the database has not been seeded yet. */
async function actorOrNull(s) {
  try {
    return await s.store.defaultUserID();
  } catch {
    return null;
  }
}

export { normaliseBarcode, normaliseProperties, validPurchase };
