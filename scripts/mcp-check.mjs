// One-off MCP round-trip check against a running dev server:
//   MCP_TOKEN=... scripts/mcp-check.mjs [baseUrl]
// Exercises initialize → add_room → add_item → REST cross-check → move →
// declutter → REST exclusion → delete → cleanup. Everything is removed at the
// end, so it is safe against a real database.
const BASE = process.argv[2] ?? 'http://localhost:8080';
const TOK = process.env.MCP_TOKEN;
if (!TOK) {
  console.error('set MCP_TOKEN to the value the server was started with');
  process.exit(2);
}

let id = 0;
async function rpc(method, params) {
  const res = await fetch(`${BASE}/mcp`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
  });
  if (res.status === 401) throw new Error('401 — token mismatch');
  const body = await res.json();
  if (body.error) throw new Error(`${body.error.code}: ${body.error.message}`);
  return body.result;
}
async function tool(name, args) {
  const r = await rpc('tools/call', { name, arguments: args });
  if (r.isError) throw new Error(r.content[0].text);
  return JSON.parse(r.content[0].text);
}

const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } };

const init = await rpc('initialize', {});
assert(init.serverInfo.name === 'home-repo', 'initialize');

const room = await tool('add_room', { name: `MCP check ${Date.now() % 100000}` });
const item = await tool('add_item', {
  name: 'MCP Gadget', room_id: room.id, tags: ['test'],
  purchase_price: 42, purchased_on: '2026-01-01',
});
assert(item.location.path_string.includes(room.name), 'item placed in room');
assert(item.value && item.value.per_day > 0, 'value derived');

const rest = await (await fetch(`${BASE}/api/items?q=${encodeURIComponent(item.name)}`)).json();
assert(rest.total === 1, `REST sees the MCP write (total=${rest.total})`);

const moved = await tool('move_item', { id: item.id, room_id: room.id });
assert(moved.location.room_id === room.id, 'move keeps the room');

const dec = await tool('declutter_item', { id: item.id, note: 'mcp check' });
assert(dec.status === 'decluttered', 'decluttered');

const active = await (await fetch(`${BASE}/api/items?q=${encodeURIComponent(item.name)}`)).json();
assert(active.total === 0, 'REST active list excludes decluttered');

await tool('delete_item', { id: item.id });

const del = await fetch(`${BASE}/api/rooms/${room.id}?cascade=true`, { method: 'DELETE' });
assert(del.status === 204, `room cleanup (${del.status})`);

console.log('MCP round-trip: all checks passed');
