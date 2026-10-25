// The MCP JSON-RPC surface: framing, the tool catalogue, and how store
// sentinels surface as tool errors. Store-free — the tool bodies run against
// the database in the integration tests.

import test from 'node:test';
import assert from 'node:assert/strict';

import { handleRpc } from '../lib/mcp.js';
import { ErrConflict, StoreError } from '../lib/errors.js';

const s = { store: {}, config: { mcpToken: 'test-token-0123456789' } };

test('initialize answers the protocol version and tool capability', async () => {
  const r = await handleRpc(s, {
    jsonrpc: '2.0', id: 1, method: 'initialize', params: {},
  });
  assert.equal(r.jsonrpc, '2.0');
  assert.equal(r.id, 1);
  assert.match(r.result.protocolVersion, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(r.result.capabilities, { tools: {} });
  assert.equal(r.result.serverInfo.name, 'home-repo');
});

test('tools/list exposes the catalogue with JSON schemas', async () => {
  const r = await handleRpc(s, { jsonrpc: '2.0', id: 2, method: 'tools/list' });
  const names = r.result.tools.map((t) => t.name);
  assert.ok(names.includes('search_items'));
  assert.ok(names.includes('add_item'));
  assert.ok(names.includes('move_item'));
  assert.ok(names.includes('declutter_item'));
  for (const t of r.result.tools) {
    assert.equal(t.inputSchema.type, 'object', `${t.name} schema must be an object`);
  }
  // add_item needs a name; the one-of-three location rule is checked at runtime.
  const add = r.result.tools.find((t) => t.name === 'add_item');
  assert.deepEqual(add.inputSchema.required, ['name']);
});

test('notifications answer nothing at all', async () => {
  const r = await handleRpc(s, {
    jsonrpc: '2.0', method: 'notifications/initialized',
  });
  assert.equal(r, undefined);
});

test('unknown methods and tools are -32601', async () => {
  const badMethod = await handleRpc(s, { jsonrpc: '2.0', id: 3, method: 'resources/list' });
  assert.equal(badMethod.error.code, -32601);
  const badTool = await handleRpc(s, {
    jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'nope', arguments: {} },
  });
  assert.equal(badTool.error.code, -32601);
});

test('garbage in, structured error out', async () => {
  const r = await handleRpc(s, 'not a message');
  assert.equal(r.error.code, -32602);
});

test('a store failure becomes a tool error, not a crash', async () => {
  // The tool bodies call the real store functions, so the fake only needs a
  // pool whose queries fail with a conflict.
  const failing = {
    store: {
      pool: {
        async query() {
          throw new StoreError(ErrConflict, 'rooms_floor_name_key');
        },
      },
    },
    config: s.config,
  };
  const r = await handleRpc(failing, {
    jsonrpc: '2.0', id: 5, method: 'tools/call',
    params: { name: 'list_rooms', arguments: {} },
  });
  assert.equal(r.result.isError, true);
  assert.match(r.result.content[0].text, /already exists/);
});

test('ping answers an empty result', async () => {
  const r = await handleRpc(s, { jsonrpc: '2.0', id: 6, method: 'ping' });
  assert.deepEqual(r.result, {});
});
