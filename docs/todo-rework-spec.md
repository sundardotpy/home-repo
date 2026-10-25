# Rework spec — the seven features in todo-rework.md

Status: living spec. Defaults are chosen and stated (per todo-rework.md: "choose
the most reasonable default and state it explicitly"); anything still open for
the user is flagged **[INPUT]**. Built in the order in §8.

The client decision is locked in from the user: **the Android app connects
directly to Postgres. No REST-sync layer, no client-side conflict protocol** —
both clients share one database, so there is nothing to reconcile beyond
row-level last-write-wins, which Postgres already gives us.

---

## §1 Feature 2 — Move anything, anywhere (items nest inside items)

*Built first: every later feature (voice, home, MCP, House Shift, Android)
sits on this placement model.*

### Data model (migration `0007_item_nesting.sql`)

```sql
ALTER TABLE items ADD COLUMN parent_item_id uuid REFERENCES items (id);
CREATE INDEX items_parent_idx ON items (parent_item_id);
CREATE UNIQUE INDEX items_not_self_parent ... -- enforced as CHECK instead:
ALTER TABLE items ADD CONSTRAINT items_not_self_parent
    CHECK (parent_item_id IS NULL OR parent_item_id <> id);

-- Recursive view, mirrors storage_unit_paths: ancestor ITEM names only.
CREATE VIEW item_paths AS
WITH RECURSIVE t(id, root, id_path, path, depth) AS (
    SELECT id, id, ARRAY[id], ARRAY[name], 0 FROM items
  UNION ALL
    SELECT i.id, t.root, t.id_path || i.id, t.path || i.name, t.depth + 1
      FROM items i JOIN t ON i.parent_item_id = t.root
)
SELECT root AS id, id_path, path, depth FROM t;
```

`item_paths` keys each item by its **root**: one row per item, `path` holding
its ancestor item names ordered outside-in. Rooms and units keep their existing
tables/views untouched.

### Placement rules

An item's physical placement is `room_id` + `storage_unit_id` (both already
denormalised); `parent_item_id` adds *logical containment inside another item*.
Invariants, enforced by the store:

1. A nested item's `room_id` equals its container's `room_id`, and its
   `storage_unit_id` equals the container's nearest unit ancestor (or NULL).
   Both are retagged down the subtree on every relocation — same pattern as
   `retagSubtreeRoom` for units.
2. Containers are not required to be "box" kinds; any item can hold items.
3. Depth is unbounded.
4. **An explicit move to a room or unit takes the item out of its container** —
   the two placements cannot disagree about where the thing is. Moving into a
   container is its own operation (`parent_item_id` on move); sending both a
   unit and a container in one request is accepted only when they agree
   (otherwise 400).

### Core logic

- **Place inside**: `POST /items` and `PATCH /items/{id}` accept
  `parent_item_id`. The store resolves the container, copies its
  room/unit onto the item, and rejects a container that is the item itself or
  one of its descendants (`$id = ANY(item_paths.id_path)` check → `ErrCycle`,
  HTTP 400).
- **Move a container**: moving item X to another room/unit retags X and every
  item below it (recursive CTE over `parent_item_id`), writing one `moved`
  history row per relocated item with each item's own full path.
- **Delete a container**: children are **promoted one level** (to X's
  `parent_item_id`, else to X's unit, else loose in the room) — identical
  semantics to unit deletion today. `?cascade=true` deletes the subtree.

### API changes

- `POST /items`, `PATCH /items/{id}`: accept `parent_item_id` (explicit `null`
  = take the item out of its container).
- Every item response's `location` gains the item ancestors:
  `path_string: "Bedroom > Wardrobe > Blue Box > Helmet box > Helmet"`, and a
  new `container_id`/`container_name` pair.
- `GET /items?container_id=<uuid>&deep=true` lists everything nested below.
- 400 `would create a cycle` on self/descendant containers.

### Edge cases and failure modes

| Case | Behaviour |
| --- | --- |
| Container in another room | 400 `room mismatch` unless `room_id` sent matches the container's room (store copies the container's room over any explicit value — parent wins, like units). |
| Nesting inside own descendant | 400 cycle. |
| Deleting mid-tree item | children promoted; history rows keep old paths (names snapshot). |
| Photo/QR on containers | unchanged — items already carry both. |
| Container marked decluttered (F5) | blocked with 409 while it holds active items; `?cascade=true` declutters the subtree too. |

### Test plan

Store tests (fake pool) for SQL shape; handler tests against the local db:
nest 3 deep, cycle rejected, container move retags room/unit/paths, delete
promotes, cascade deletes, `location.path_string` shows full chain, mismatched
room rejected.

---

## §2 Feature 5 — Split "Put away" into Add / Decluttered / Move

### Data model (migration `0008_actions_and_status.sql`)

```sql
ALTER TABLE items ADD COLUMN status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'decluttered'));
ALTER TABLE items ADD COLUMN decluttered_at timestamptz;
ALTER TABLE items ADD COLUMN declutter_note text;

ALTER TABLE item_moves DROP CONSTRAINT item_moves_kind_check;
ALTER TABLE item_moves ADD CONSTRAINT item_moves_kind_check
    CHECK (kind IN ('added', 'moved', 'decluttered'));
ALTER TABLE item_moves ADD COLUMN quantity integer;
```

### Semantics (defaults chosen)

| Action | UI | What it records |
| --- | --- | --- |
| **Add (buy)** | Add sheet — same form as today, headed "Add (bought)" | New item → row + `added` event. Existing item → `quantity += n` + `added` event carrying `quantity` (an acquisition, not a move). |
| **Decluttered** | Item card / list swipe | `status='decluttered'`, `decluttered_at=now()`, optional note; `decluttered` history row with the from-path. Item vanishes from active lists and search (they filter `status='active'`); Value excludes it. Restore = PATCH `status:'active'` (no extra event). |
| **Move item** | Existing move flow | unchanged (`moved` events). |

The old "Put away" button meant "this thing now lives here" — that maps onto
**Add** for new things and **Move** for existing ones, so the two-sheet split
replaces it without any change to what history rows mean. Existing history
needs **no data migration**: `added` rows stay `added` and are now *labelled*
"Bought" in the UI; `moved` rows stay.

### API changes

- `POST /items/{id}/declutter` `{note?}` → 200 item (decluttered). 409 when the
  item still contains active items without `?cascade=true`.
- `PATCH /items/{id}` accepts `status` (`'active'` restores) and
  `quantity_delta` (add/buy more of the same; logs an `added` event with
  `quantity`).
- `GET /items?status=decluttered` lists the decluttered (default filters to
  active). `GET /items/{id}/history` unchanged; entries carry `kind`.

### Edge cases

Declutter a container → 409 unless cascade. Declutter twice → idempotent 200.
Restore after restore → no-op. Quantity floor at 0 (existing CHECK). Decluttered
item scanned by QR/barcode → found, card shows "decluttered" badge with
Restore.

### Test plan

Handler tests: declutter → hidden from default list, present with
`status=decluttered`, history row written, restore works, container block,
quantity_delta events.

---

## §3 Feature 1 — Voice-to-action

### Capture (default: browser-native, no server round trip)

`webkitSpeechRecognition` (Chrome/Edge/Android Chrome). Mic button inside the
hero search (F7). Unsupported browsers → the same sheet accepts typed text
(this is also the test seam). Transcribed text goes through the parser below;
nothing is uploaded anywhere by us.

### Parsing

Patterns on the transcript, case/stopword-tolerant:
`"<item> is in <place>"`, `"put <item> in <place>"`,
`"move <item> to <place>"`, `"<item> is inside <place>"`.
The right-most `in/into/to/inside` splits item vs place; everything before is
the item name (trimmed of "the/a/my"), after is the place. If no preposition
is found → ambiguous: the sheet shows two editable fields pre-filled with the
best-guess split (first/last word boundary) and asks.

### Matching (both halves fuzzy, cheapest first)

1. Exact (case-insensitive) on active items, then rooms.
2. `ILIKE '%x%'` unique hit.
3. Multiple hits → ranked by similarity (`similarity()` not needed; order by
   `lower(name) = q`, prefix, then contains) and the sheet lists them as
   one-tap choices.
4. No item hit → "Nothing called '<x>' — add it to <place>?" [Add] [No] —
   creation is always an explicit yes.
5. No room hit → "No room called '<y>' — create it and move <x> there?"
   [Yes] [No].

`<place>` may also match a storage unit or nested item ("Helmet is in the blue
box") — same ladder over units and items; a hit resolves to that
unit's/container's room + id.

### Confirm and apply

The sheet never applies silently: "Move **Helmet** to **Living room**?" with
[Yes] [No]. Yes → `POST /items/{id}/move` (or create flow), toast confirms,
history row written. No → closes, no change. Ambiguous item+place pairs are
resolved by the editable-fields step before the confirm card.

### Edge cases

Mic permission denied → typed fallback with a hint. Empty/garbage transcript →
"Didn't catch that" with retry. Item already there → confirm card says so and
Yes is a no-op toast. Offline → the optimistic mutation queue carries the move
(existing store behaviour).

### Test plan

Parser unit tests (table of transcripts → {item, place, ambiguous?}); matcher
tests against the db (exact, fuzzy, multi, none); UI flow in the browser with
typed input; Android mirrors the parser in Kotlin (same table).

---

## §4 Feature 7 — Home screen redesign

Search becomes the hero; Items listed below. Reuses the existing Classic/Repo
tokens, fonts, motion budget (≤260ms), 44px targets — no new design language
(oil-ui: new features in an existing project follow the existing visual
system).

### Layout (top → bottom)

1. **Hero search** — full-width, taller than today's pill, autofocus on entry,
   magnifier + **mic** (F1) + scan buttons inside it. Typing anywhere on the
   screen routes keystrokes into it. Repo skin renders it as
   `grep "~/home"`.
2. **Voice confirm card** (when a transcript parsed) — slides up under the
   hero, per §3.
3. **Items** — every active item, newest first (`GET /items?limit=` with
   pagination), full-width rows (icon, name, path, value chip) reusing the
   existing row component; pull-to-refresh; the old "Last put away" strip
   stays as a horizontally scrollable shelf **above Items only when there was
   activity in the last 7 days**.
4. Skeleton rows while loading (existing pattern).

### Behaviours

- Search input → live `#/search?q=` results (existing screen, restyled
  header) — zero new search logic.
- Item rows open the existing item card (move/declutter actions live there —
  F5 buttons).
- Voice confirm card Yes/No wired to F1's actions.
- Empty home (no items): hero + "Put something away" quick actions (Add /
  Speak) unchanged in spirit.

### Motion (three, per the app's existing budget)

Hero gains focus ring scale-in; Items rows keep the existing stagger; confirm
card reuses the bottom-sheet slide. Nothing else animates.

### Test plan

Browser pass: type-to-search from home, mic fallback typed parse → confirm →
move reflected in Items; Classic **and** Repo skins screenshot; phone viewport
(390×844) and `lg` desktop.

---

## §5 Feature 3 — MCP server

### Transport and auth (defaults)

- **Streamable HTTP** at `POST /mcp` on the same Node server (stateless
  JSON-RPC; no session state — each request carries
  `initialize`/`tools/list`/`tools/call` semantics).
- **Auth**: `Authorization: Bearer <MCP_TOKEN>` (new env var, ≥16 chars).
  `/mcp` is 404 when `MCP_TOKEN` is unset — the surface simply does not exist.
  The token is independent of the household passcode: it exists precisely for
  non-browser clients.
- The tools call the **same store layer** as the REST API, so what an AI adds
  or removes is exactly what the app shows; the UI's stale-while-revalidate
  picks external writes up on next read.

### Tools (JSON-Schema input, store-typed output)

| Tool | Purpose |
| --- | --- |
| `list_rooms()` | rooms with counts |
| `list_units(room_id?)` | units with paths |
| `list_items(query?, room_id?, status?, limit?, offset?)` | paged items |
| `search_items(q)` | ranked search |
| `get_item(id)` | full record incl. location + history |
| `add_item(name, room_id?/storage_unit_id?/parent_item_id?, tags?, quantity?, purchase_price?, purchased_on?)` | create (one location required — same rule as the API) |
| `move_item(id, room_id?/storage_unit_id?/parent_item_id?)` | relocate, history written |
| `declutter_item(id, note?)` | F5 semantics |
| `delete_item(id)` | with promote-children semantics |
| `add_room(name, floor?, floor_name?)` | create a room |

Errors map through `writeStoreErr`'s sentinels → JSON-RPC `tool errors`
(400→`invalid params`, 404/409→`tool execution error` with detail).

### Edge cases

Oversized batch calls rejected by the 1MB body cap; unknown tool →
`method not found`; writes honour every store invariant (room/unit match,
cycle guard, duplicate names → 409); delete of non-empty room → 409 tool
error with the same message the UI shows.

### Test plan

Integration script: initialize → tools/list → add_item → search from the API
side → move → declutter → delete, asserting both sides see the same rows; 401
without token; 404 when disabled.

---

## §6 Feature 6 — House Shift mode

### Model

A dedicated Postgres **schema** `shift` created on entry, dropped on exit —
live tables are never touched while the mode is on.

```sql
CREATE SCHEMA shift;
CREATE TABLE shift.items (LIKE items INCLUDING ALL); -- copied rows, ids preserved
ALTER TABLE shift.items ADD COLUMN pack_type text      -- L2: Tech|Fragile|Wet|Soft|Small|Unsure
                       ADD COLUMN pack_room_id uuid;   -- L1: target room for the move
CREATE TABLE shift.journal (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    seq serial,
    op text NOT NULL,        -- 'move' | 'pack_type' | 'pack_room' | 'add' | 'declutter'
    item_id uuid NOT NULL,
    payload jsonb NOT NULL,  -- enough to replay the op against live data
    at timestamptz NOT NULL DEFAULT now()
);
```

Rooms/units are **read-only** in shift mode (reorganising means re-homing
items; the live rooms stay the frame). Photos are shared read-only (paths
unchanged).

### Entry / exit (defaults)

- **Enter**: Settings or home banner → "Start House Shift". Server copies
  active items into `shift.items` (`pack_room_id` = current room). Mode is
  server state (`house_shift.mode` key/value row); every request the UI makes
  is stamped `X-Shift: on` and the store routes item reads/writes to the shift
  schema while journaling each change. A fixed amber banner ("Shift mode —
  changes live in a copy") sits above every screen.
- **Exit**: banner → **Commit** or **Discard**.
  - *Commit*: replays the journal in `seq` order against live tables — moves
    via the normal move path (history rows written), declutters via F5,
    pack_type/tag edits via PATCH. Idempotent per item (replay sets absolute
    state, so a re-run cannot double-apply). Then `DROP SCHEMA shift CASCADE`,
    mode off, toast "Shift committed".
  - *Discard*: drop schema, mode off, toast "Shift discarded".
  - Leaving with unjournaled rows is impossible — exit **is** the choice.
- Crash mid-shift: mode flag persists, shift schema persists; next boot offers
  Resume / Discard (the copy is disposable by design).

### Packing levels

Shift UI = the Places tree plus two chips per item: **L1 room** (Office,
Living, Kitchen, Bedroom, Bathroom — pre-seeded from live rooms, editable) and
**L2 type** (the six fixed types). Group-by-L2 view answers "where is the
Fragile box for the kitchen?". "Unsure" is the default type, and the shift
summary counts unresolved Unsores as a checklist.

### Edge cases

Items added in live mode during a shift are invisible to it (documented);
commit only replays journaled ops, so a mid-shift live edit is never
clobbered by shift. Two browsers entering/exiting concurrently: mode flag is a
single row — second entry is a no-op returning the existing copy.

### Test plan

API tests: enter → copy exists; move in shift → live untouched; commit → live
item moved + history row; discard → live unchanged, schema gone; resume after
simulated restart.

---

## §7 Feature 4 — Android client (Kotlin + Compose, **direct Postgres**)

*User decision: no REST-sync layer — the app connects to the same Postgres the
server uses. One database, two clients.*

### Architecture

- **Kotlin + Jetpack Compose**, min SDK 29. JDBC via
  `org.postgresql:postgresql` (pure Java, runs on Android) on a small
  connection wrapper (single connection, TLS `sslmode=require`, retry with
  backoff).
- **Connection profile** set in-app on first run (host, port, database, user,
  password) and stored in EncryptedSharedPreferences — **no credentials in the
  repo or the APK**. Dev default: `127.0.0.1:5433` through
  `adb reverse tcp:5433 tcp:5433` to the Docker Postgres; prod: the Neon
  pooled host.
- Queries mirror the server's store SQL (rooms/units/items joins, the two
  path views, search `ILIKE`), reading the **same schema** the migrations
  produce. The app never runs DDL or migrations.
- Writes (`add_item`, `move`, `declutter`, `delete`, `quantity_delta`) reuse
  the same invariants as the store layer — room/unit match, cycle guard,
  status checks — and write the same `item_moves` rows so web history and
  Android history are one story.

### Conflict resolution (why there is none to build)

Both clients are ordinary Postgres clients on one database: the last committed
write wins per row (`updated_at` is informational), constraints reject illegal
states identically on both sides, and each client re-reads after writing.
The "same record edited in two places" case resolves to "the second write
is the state" — consistent with a household-scale single-user app.

### Offline behaviour (v1 scope, stated honestly)

Reads: last-loaded lists stay visible from an in-memory cache with a stale
badge; a retry banner appears on writes that fail for connectivity — the write
is re-applied by the user action, not queued (a queue would re-introduce the
sync layer we just decided against). This is the tradeoff of direct-DB: **the
app is online-first**, and at home/away scale that is acceptable. **[INPUT]**
if you want true offline writes later, the answer is the store's mutation
queue pattern ported to Android against a local SQLite mirror — deferred.

### Security tradeoff (stated)

DB credentials live on the device. Mitigations (defaults): dedicated Neon role
`android_app` (grants SELECT on all tables, INSERT/UPDATE on items +
item_moves, no DDL, no DELETE on rooms/units — deletes go through the app's
confirm flow, so we grant DELETE on items only), TLS mandatory. The SQL to
create the role ships in `docs/android-role.sql` for you to run once.
**[INPUT]** confirm you'll create that role (or accept using the owner role).

### Screens (v1, as built)

Connection (in-app profile, EncryptedSharedPreferences-lite via private prefs),
Home (search + items, newest first), Places (rooms with counts, read),
Add (buy) sheet with room/unit pickers, Item sheet (move to room, +1, declutter,
restore). Voice on Android is deferred to v1.1 — the parse table ports
directly; the recogniser is `android.speech.SpeechRecognizer`. Conflicts are
impossible by construction (one database); the tradeoff is online-first, as
stated above. Verified on device over `adb reverse` to the Docker database:
add on phone → visible to the REST API, and vice versa.

### Test plan

Instrumented tests against the Docker db via `adb reverse`; manual device run
over wireless debugging (device `adb-1270d513…` is already authorised):
add item on Android → appears in web after refresh; move on web → Android
re-read shows it; declutter on Android → hidden on web.

---

## §8 Implementation order and dependencies

| # | Feature | Because |
| --- | --- | --- |
| 1 | **F2** item nesting | placement model every other feature touches (voice targets, home paths, MCP tools, Android queries, House Shift) |
| 2 | **F5** Add/Decluttered/Move | adds `status` + event kinds the home list, MCP and Android must already know |
| 3 | **F1** voice-to-action | pure consumer of F2/F5 APIs; F7 hosts its UI |
| 4 | **F7** home redesign | hero search + Items list expose F1 and the F5 action buttons |
| 5 | **F3** MCP server | independent of UI, depends on settled schema |
| 6 | **F6** House Shift mode | overlays F2/F5 semantics; biggest UI surface, best done when the rest is stable |
| 7 | **F4** Android client | needs the final schema; device work runs parallel to polish |

Each step lands with migrations + tests + smoke coverage green before the next
starts.

## §9 Decisions flagged for the user (defaults in force until you say otherwise)

1. **Declutter a non-empty container** → blocked, needs cascade (default).
2. **Add on an existing item** → quantity increment + `added` event (default).
3. **MCP auth** → `MCP_TOKEN` bearer; endpoint disabled when unset (default).
4. **House Shift commit** → journal replay, explicit Commit/Discard (default).
5. **Android DB role** → create `android_app` role from `docs/android-role.sql`
   (default); using the owner role from the phone works but is broader than
   needed.
6. **Voice language** → English parse patterns (default); Hinglish patterns
   are additive later.

## §10 What is still not built (as of 2026-10-25)

Checked against the code after the nesting, home and Android-move commits.
Ordered by value for effort; each says what to build and what to skip.

| # | Gap | Plan | Size |
| --- | --- | --- | --- |
| 1 | ✅ **Done.** ~~Container moves write one history row, not one per item inside~~ (§1 says one per relocated item). Server and Android both skip the children, so they agree with each other. | Server: after `retagItemSubtree`, insert a `moved` row per descendant with its own old/new path (one `INSERT … SELECT` over the same recursive CTE). Android: same statement after `retagSubtree`. Test: move a box holding two items → three history rows. | S |
| 2 | ✅ **Done (option a).** ~~`android_app` role vs what the app does~~ (§9.5). `docs/android-role.sql` grants SELECT only on rooms/units, but the app creates, renames and deletes rooms and units; under that role those screens fail. The trailing `REVOKE … ON SCHEMA shift` also errors when no shift is running. | **[INPUT]** Pick one: (a) grant INSERT/UPDATE/DELETE on rooms + storage_units (keeps every screen), or (b) keep the narrow role and hide room/unit editing on Android. Default: (a). Drop the `shift` REVOKE line (no grant exists to revoke). | S |
| 3 | **Phone credentials stored in plain private prefs** (§7 said EncryptedSharedPreferences). | Skip the encryption library: `androidx.security:security-crypto` is deprecated and was removed as unused. App-private storage is already sandboxed per app; the real mitigation is #2 (a least-privilege role). Revisit only if the APK leaves this one device. | — |
| 4 | **House Shift on Android.** | Default: **don't port it.** Shift lives in `lib/store/shift.js` (copy schema, journal, replay on commit); a Kotlin copy over direct SQL would duplicate the replay logic. Build only a read-only banner: when `app_settings.house_shift = 'on'`, show "House Shift is on — pack on the web" so phone edits don't land in live data unnoticed. **[INPUT]** if you want packing on the phone, the cheapest real version is the two chips (pack type, pack room) writing `shift.items` + `shift.journal`, with commit/discard staying web-only. | S (banner) / M (chips) |
| 5 | **Voice on Android** (§3, deferred to v1.1). | Port `parseUtterance` from `voice.js` as a pure Kotlin function with the same transcript table as its test; recogniser is `android.speech.SpeechRecognizer`; matching reuses `Db.items(query)` and `Db.rooms()`; confirm card reuses `MoveSheet` targets. | M |
| 6 | **Home polish** (§4). | Skip pull-to-refresh (every screen already refetches when opened, after each save and on reconnect) and the hero-as-input (breaks the phone keyboard on navigation; type-anywhere covers desktop). Nothing to build. | — |

Suggested order: ~~1~~ → ~~2~~ → 4 (banner) → 5. 3 and 6 are decided as "no work".
