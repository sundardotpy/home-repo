// Storage unit routes.

import {
  decode, decodeWithKeys, noContent, queryBool, queryInt, queryUUID, urlID,
  writeErr, writeJSON, writeStoreErr,
} from '../http.js';
import {
  createStorageUnit, deleteStorageUnit, getStorageUnit, getStorageUnitBySlug,
  listStorageUnits, regenerateSlug, updateStorageUnit,
} from '../store/unit.js';
import { listItems } from '../store/item.js';
import { normaliseSlug, validSlug } from './qrcodes.js';

const UNIT_SCHEMA = {
  room_id: 'uuid',
  parent_id: 'uuid',
  name: 'str',
  kind: 'str',
  description: 'str',
  qr_slug: 'str',
};

/** "what is inside this box", including nested boxes. */
async function writeUnitContents(s, req, res, unit) {
  try {
    const children = await listStorageUnits(s.store, { parentID: unit.id });
    const deep = queryBool(req, 'deep');
    const { items, total } = await listItems(s.store, {
      storageUnitID: unit.id,
      deep,
      limit: queryInt(req, 'limit', 200),
    });
    writeJSON(res, 200, {
      storage_unit: unit,
      children,
      items,
      item_total: total,
      deep,
    });
  } catch (err) {
    writeStoreErr(res, err);
  }
}

export function registerUnits(router, s) {
  router.get('/api/storage-units', async (req, res) => {
    const roomID = queryUUID(req, 'room_id');
    if (roomID.error) {
      writeErr(res, 400, 'invalid room_id');
      return;
    }
    const parentID = queryUUID(req, 'parent_id');
    if (parentID.error) {
      writeErr(res, 400, 'invalid parent_id');
      return;
    }
    try {
      const units = await listStorageUnits(s.store, {
        roomID: roomID.value,
        parentID: parentID.value,
        rootOnly: queryBool(req, 'root_only'),
      });
      writeJSON(res, 200, { storage_units: units });
    } catch (err) {
      writeStoreErr(res, err);
    }
  });

  router.post('/api/storage-units', async (req, res) => {
    const b = await decode(req, res, UNIT_SCHEMA);
    if (b === null) return;

    if (b.name === undefined || b.name === null || b.name.trim() === '') {
      writeErr(res, 400, 'name is required');
      return;
    }
    if (!b.room_id && !b.parent_id) {
      writeErr(res, 400, 'room_id or parent_id is required');
      return;
    }

    try {
      writeJSON(res, 201, await createStorageUnit(s.store, {
        roomID: b.room_id ?? null,
        parentID: b.parent_id ?? null,
        name: b.name.trim(),
        kind: b.kind?.trim() ?? '',
        description: b.description?.trim() ?? '',
      }));
    } catch (err) {
      writeStoreErr(res, err);
    }
  });

  router.get('/api/storage-units/{unitID}', async (req, res) => {
    const id = urlID(req, res, 'unitID');
    if (!id) return;
    try {
      writeJSON(res, 200, await getStorageUnit(s.store, id));
    } catch (err) {
      writeStoreErr(res, err);
    }
  });

  router.patch('/api/storage-units/{unitID}', async (req, res) => {
    const id = urlID(req, res, 'unitID');
    if (!id) return;

    // Decode into the raw key set too, so an explicit "parent_id": null is
    // distinguishable from the key being omitted.
    const decoded = await decodeWithKeys(req, res, UNIT_SCHEMA);
    if (decoded === null) return;
    const { raw, body: b } = decoded;

    let name;
    if (b.name !== undefined && b.name !== null) {
      const trimmed = b.name.trim();
      if (trimmed === '') {
        writeErr(res, 400, 'name cannot be empty');
        return;
      }
      name = trimmed;
    }

    let qrSlugValue;
    // Overriding the code re-points every label already printed with the old
    // one, so it is validated strictly rather than trimmed into shape.
    if (b.qr_slug !== undefined && b.qr_slug !== null) {
      const slug = normaliseSlug(b.qr_slug);
      if (!validSlug(slug)) {
        writeErr(res, 400, 'invalid code', 'use 4 to 24 characters, letters A-Z and digits only');
        return;
      }
      qrSlugValue = slug;
    }

    const patch = {
      name,
      kind: b.kind ?? undefined,
      description: b.description ?? undefined,
      qrSlug: qrSlugValue,
      roomID: b.room_id ?? undefined,
    };
    if ('parent_id' in raw) {
      patch.setParent = true;
      patch.parentID = b.parent_id ?? null;
    }

    try {
      writeJSON(res, 200, await updateStorageUnit(s.store, id, patch));
    } catch (err) {
      writeStoreErr(res, err);
    }
  });

  router.get('/api/storage-units/{unitID}/contents', async (req, res) => {
    const id = urlID(req, res, 'unitID');
    if (!id) return;
    try {
      await writeUnitContents(s, req, res, await getStorageUnit(s.store, id));
    } catch (err) {
      writeStoreErr(res, err);
    }
  });

  /** Retires the printed label and issues a new code. */
  router.post('/api/storage-units/{unitID}/qr/regenerate', async (req, res) => {
    const id = urlID(req, res, 'unitID');
    if (!id) return;
    try {
      writeJSON(res, 200, await regenerateSlug(s.store, id));
    } catch (err) {
      writeStoreErr(res, err);
    }
  });

  router.delete('/api/storage-units/{unitID}', async (req, res) => {
    const id = urlID(req, res, 'unitID');
    if (!id) return;
    try {
      await deleteStorageUnit(s.store, id, queryBool(req, 'cascade'));
      noContent(res);
    } catch (err) {
      writeStoreErr(res, err);
    }
  });

  /** Scans land here; the slug is printed on the label. */
  router.get('/api/qr/{slug}', async (req, res) => {
    try {
      const unit = await getStorageUnitBySlug(s.store, normaliseSlug(req.params.slug));
      await writeUnitContents(s, req, res, unit);
    } catch (err) {
      writeStoreErr(res, err);
    }
  });
}
