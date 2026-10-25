// Model Context Protocol endpoint: a stateless JSON-RPC surface at /mcp that
// lets an external AI of the user's choice read and write the same inventory
// the app sees. Every tool goes through the store layer, so an AI's changes
// are the app's changes — the UI picks them up on its next read.
//
// Enabled only when MCP_TOKEN is set; the bearer token is the whole auth model.
// Disabled, the route does not exist.

import { timingSafeEqual } from 'node:crypto';

import { readBody, storeErrMessage, writeErr, writeJSON } from './http.js';
import { log } from './log.js';
import * as store from './store/index.js';

const PROTOCOL_VERSION = '2025-06-18';
const MAX_BODY = 1 << 20;

// ------------------------------------------------------------------- tools

const uuidSchema = { type: 'string', description: 'UUID' };

const TOOLS = [
  {
    name: 'list_rooms',
    description: 'List every room with its storage-unit and item counts.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async run(s) {
      return { rooms: await store.listRooms(s.store) };
    },
  },
  {
    name: 'list_units',
    description: 'List storage units (boxes, shelves), with their full paths. Optionally scoped to one room.',
    inputSchema: {
      type: 'object',
      properties: { room_id: uuidSchema },
      additionalProperties: false,
    },
    async run(s, a) {
      return { storage_units: await store.listStorageUnits(s.store, { roomID: a.room_id ?? null }) };
    },
  },
  {
    name: 'list_items',
    description: 'List items, paged. Defaults to the active inventory (decluttered things excluded).',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Substring match on name, description, tags and fields' },
        room_id: uuidSchema,
        status: { type: 'string', enum: ['active', 'decluttered', 'all'] },
        limit: { type: 'integer', minimum: 1, maximum: 200 },
        offset: { type: 'integer', minimum: 0 },
      },
      additionalProperties: false,
    },
    async run(s, a) {
      const { items, total } = await store.listItems(s.store, {
        query: a.query ?? '',
        roomID: a.room_id ?? null,
        status: a.status ?? 'active',
        limit: a.limit ?? 50,
        offset: a.offset ?? 0,
      });
      return { items, total };
    },
  },
  {
    name: 'search_items',
    description: 'Search the inventory the way the app does: name, description, tags, barcode, custom fields. Ranked by name similarity.',
    inputSchema: {
      type: 'object',
      properties: { q: { type: 'string' } },
      required: ['q'],
      additionalProperties: false,
    },
    async run(s, a) {
      const { items, total } = await store.listItems(s.store, { query: String(a.q), limit: 20 });
      return {
        query: a.q,
        total,
        results: items.map((it) => ({ id: it.id, name: it.name, location: it.location.path_string })),
      };
    },
  },
  {
    name: 'get_item',
    description: 'One item in full: location, tags, price, value, and where it has been.',
    inputSchema: {
      type: 'object',
      properties: { id: uuidSchema },
      required: ['id'],
      additionalProperties: false,
    },
    async run(s, a) {
      return {
        item: await store.getItem(s.store, a.id),
        history: await store.itemHistory(s.store, a.id),
      };
    },
  },
  {
    name: 'add_item',
    description: 'Add (buy) an item. Exactly one of room_id, storage_unit_id or parent_item_id is required.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        room_id: uuidSchema,
        storage_unit_id: uuidSchema,
        parent_item_id: uuidSchema,
        description: { type: 'string' },
        quantity: { type: 'integer', minimum: 0 },
        tags: { type: 'array', items: { type: 'string' } },
        barcode: { type: 'string' },
        purchase_price: { type: 'number', minimum: 0 },
        purchased_on: { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['name'],
      additionalProperties: false,
    },
    async run(s, a) {
      const name = String(a.name ?? '').trim();
      if (name === '') throw new Error('name is required');
      if (!a.room_id && !a.storage_unit_id && !a.parent_item_id) {
        throw new Error('one of room_id, storage_unit_id or parent_item_id is required');
      }
      const item = await store.createItem(s.store, {
        name,
        description: a.description ?? '',
        quantity: a.quantity ?? 1,
        tags: a.tags ?? [],
        barcode: a.barcode ?? '',
        roomID: a.room_id ?? null,
        storageUnitID: a.storage_unit_id ?? null,
        parentItemID: a.parent_item_id ?? null,
        purchasePrice: a.purchase_price ?? null,
        purchasedOn: a.purchased_on ?? null,
        actorID: await actorOrNull(s),
      });
      await store.ensureTags(s.store, a.tags ?? []).catch(() => {});
      return item;
    },
  },
  {
    name: 'move_item',
    description: 'Move an item to a room, into a storage unit, or inside another item.',
    inputSchema: {
      type: 'object',
      properties: {
        id: uuidSchema,
        room_id: uuidSchema,
        storage_unit_id: uuidSchema,
        parent_item_id: uuidSchema,
      },
      required: ['id'],
      additionalProperties: false,
    },
    async run(s, a) {
      return store.updateItem(s.store, a.id, {
        setLocation: Boolean(a.room_id || a.storage_unit_id),
        setParentItem: a.parent_item_id !== undefined,
        roomID: a.room_id ?? null,
        storageUnitID: a.storage_unit_id ?? null,
        parentItemID: a.parent_item_id ?? null,
        actorID: await actorOrNull(s),
      });
    },
  },
  {
    name: 'declutter_item',
    description: 'Mark an item decluttered (given away, sold, tossed). It stays in the record but leaves the active inventory.',
    inputSchema: {
      type: 'object',
      properties: {
        id: uuidSchema,
        note: { type: 'string' },
        cascade: { type: 'boolean', description: 'Also declutter everything inside this item' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    async run(s, a) {
      return store.declutterItem(s.store, a.id, a.note ?? null, Boolean(a.cascade), await actorOrNull(s));
    },
  },
  {
    name: 'delete_item',
    description: 'Delete an item for good. Anything nested inside it is promoted one level up.',
    inputSchema: {
      type: 'object',
      properties: { id: uuidSchema },
      required: ['id'],
      additionalProperties: false,
    },
    async run(s, a) {
      await store.deleteItem(s.store, a.id);
      return { deleted: a.id };
    },
  },
  {
    name: 'add_room',
    description: 'Create a room.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        floor: { type: 'integer', description: '0 = ground, negative = basement' },
        floor_name: { type: 'string', description: 'For floors a number cannot describe, e.g. "Attic"' },
      },
      required: ['name'],
      additionalProperties: false,
    },
    async run(s, a) {
      const name = String(a.name ?? '').trim();
      if (name === '') throw new Error('name is required');
      return store.createRoom(s.store, {
        name,
        description: a.description ?? '',
        sortOrder: a.sort_order ?? 0,
        floor: a.floor ?? 0,
        floorName: a.floor_name ?? '',
      });
    },
  },
];

async function actorOrNull(s) {
  try {
    return await s.store.defaultUserID();
  } catch {
    return null;
  }
}

// ------------------------------------------------------------- json-rpc

const rpcResult = (id, result) => ({ jsonrpc: '2.0', id, result });
const rpcError = (id, code, message, data) => ({
  jsonrpc: '2.0', id, error: { code, message, ...(data ? { data } : {}) },
});

const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

/**
 * Runs one JSON-RPC message. Answers undefined for notifications (nothing to
 * send back), otherwise a result or error envelope.
 */
export async function handleRpc(s, msg) {
  if (msg === null || typeof msg !== 'object' || Array.isArray(msg)) {
    return rpcError(null, INVALID_PARAMS, 'expected a JSON-RPC message object');
  }
  if (typeof msg.method === 'string' && msg.method.startsWith('notifications/')) {
    return undefined;
  }
  const id = msg.id ?? null;

  if (msg.method === 'initialize') {
    return rpcResult(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: 'home-repo', version: '1.0.0' },
    });
  }
  if (msg.method === 'tools/list') {
    return rpcResult(id, {
      tools: TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    });
  }
  if (msg.method === 'tools/call') {
    const p = msg.params ?? {};
    const tool = TOOLS.find((t) => t.name === p.name);
    if (!tool) {
      return rpcError(id, METHOD_NOT_FOUND, `unknown tool: ${p.name ?? '(none)'}`);
    }
    try {
      const value = await tool.run(s, p.arguments ?? {});
      return rpcResult(id, {
        content: [{ type: 'text', text: JSON.stringify(value) }],
      });
    } catch (err) {
      // Store sentinels become tool errors a person (or model) can act on;
      // anything else is a genuine server fault.
      log.error('mcp tool failed', { tool: p.name, err });
      return rpcResult(id, {
        content: [{ type: 'text', text: storeErrMessage(err) }],
        isError: true,
      });
    }
  }
  if (msg.method === 'ping') return rpcResult(id, {});
  return rpcError(id, METHOD_NOT_FOUND, `method not found: ${msg.method}`);
}

// ------------------------------------------------------------------ http

function tokenOK(s, req) {
  const header = req.headers.authorization ?? '';
  const m = /^Bearer\s+(.+)$/.exec(header);
  if (!m) return false;
  const given = Buffer.from(m[1]);
  const want = Buffer.from(s.config.mcpToken);
  return given.length === want.length && timingSafeEqual(given, want);
}

export function registerMCP(router, s) {
  router.post('/mcp', async (req, res) => {
    if (!tokenOK(s, req)) {
      writeErr(res, 401, 'unauthorized');
      return;
    }
    let buffer;
    try {
      buffer = await readBody(req, MAX_BODY);
    } catch {
      writeErr(res, 413, 'request body too large');
      return;
    }
    let msg;
    try {
      msg = JSON.parse(buffer.toString('utf8'));
    } catch {
      writeJSON(res, 400, rpcError(null, -32700, 'parse error'));
      return;
    }
    const answer = await handleRpc(s, msg);
    if (answer === undefined) {
      // A notification: accepted, nothing to say.
      res.statusCode = 202;
      res.end();
      return;
    }
    writeJSON(res, 200, answer);
  });
  // GET /mcp is answered 405 by the router; this path only ever takes POSTs.
}
