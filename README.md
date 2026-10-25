# Home Repo

Know what you own and where it is. Rooms hold storage units, storage units nest
arbitrarily deep, items live inside them — and every lookup answers with the full
location path: `Bedroom > Wardrobe > Top Shelf > Blue Box`.

**All four phases done:** schema + JSON API, the app, photos, QR labels.

## Stack

Node.js 20+ · Postgres (`pg`) · Tailwind v4 · Docker Compose. The app runs as a
long-lived Node.js container or as a single Vercel Function; the database is
Neon (or any Postgres).

The frontend is a dependency-free ES-module client served by the same Node.js
app. No framework or bundler is needed; only Tailwind compiles, and its output
is committed.

## Run it

Copy `.env.example` to `.env` and put your `DATABASE_URL` in it (Neon's **pooled**
endpoint — the host with `-pooler` in it; renaming a Neon *project* does not change
the database name or host, so an existing URL keeps working), then:

```bash
docker compose up -d --build
```

The app is on `http://localhost:8080`. Migrations apply automatically at
startup. The development container runs the Node server with the project files
mounted into it.

To work offline against a local Postgres instead, drop `DATABASE_URL` from
`.env` and start the bundled database:

```bash
docker compose --profile localdb up -d
```

Editing Tailwind classes needs the CSS rebuilt. `app.css` is committed, so this
is only for when you change styles:

```bash
docker compose --profile css up css
```

Exercise every route end to end:

```bash
./scripts/smoke.sh
```

Unit tests:

```bash
docker compose run --rm --no-deps app npm test
```

Useful:

```bash
docker compose logs -f app
```

```bash
docker compose exec app sh -c 'psql "$DATABASE_URL"'
```

## Deploying to Vercel

The whole app is one Node.js function. [api/index.js](api/index.js) builds the
same handler the container runs once per instance;
[vercel.json](vercel.json) rewrites every path to it and includes the static
assets and SQL migrations that the app reads at runtime.

```bash
vercel env add DATABASE_URL      # Neon's pooled connection string
vercel env add PUBLIC_BASE_URL   # e.g. https://your-app.vercel.app
vercel deploy --prod
```

Three things had to change to make this work, and they are worth knowing about:

**Photos live in Postgres.** Vercel's filesystem is read-only and nothing
survives between invocations, so writing JPEGs to a volume is not an option.
`MEDIA_BACKEND=db` (the default) stores the rendered bytes in the `photos`
table; at household scale that is ~45KB per photo plus a ~4KB thumbnail, and it
makes a database backup a complete backup. `MEDIA_BACKEND=disk` still exists for
hosts with a real volume.

**Connections go through the pooler.** Each function instance opens a small
Postgres pool, so the connection count is a function of traffic, not of servers.
Use Neon's pooled connection string to keep serverless traffic within the
database's connection limit.

**Migrations take an advisory lock.** Several cold starts can race on the first
request after a deploy; the losers wait and then find nothing to do.

Vercel installs the dependencies from `package-lock.json`. Tailwind does not
need to run during deployment because `app.css` is committed.

## The frontend

Mobile-first, three destinations: **Find** (one question and what you put away
lately), **Places** (rooms and the boxes inside them) and **Value** (what things
cost per day). On a phone they sit in a floating bottom bar with the add button
beside it; from `lg` up the same three live in a top bar. Scan is a button in the
search box and Settings is behind the gear. 44px tap targets, safe-area padding,
light and dark follow the system.

**Two interfaces over one set of markup.** *Classic* is the rounded, light look.
*Repo* borrows from a code host: monospace names, hairline borders, a green
primary action, rooms and boxes written as paths (`office/desk/small-container/`),
"commit" and "git mv" for save and move. Choose in Settings; it is stored on the
device. The skin is almost entirely CSS (`html.ui-repo` swaps the tokens in
`input.css`); `look.js` holds the few words and the path format that differ.

**Value.** An item can carry a price and a purchase date (both optional). The API
derives cost per day from them, a thing bought today counts as one day, and the
Value screen shows which items are under your line (default ₹10/day, changed in
Settings). **History.** Every placement is logged, so an item's card shows where it
has been and Move offers the places things went lately as one-tap choices.

**No OS controls.** Dropdowns are drawn by the app, not the platform: a native
`<select>` renders as an iOS wheel or an Android dialog, and cannot show the
floor beside a room name or indent a unit under its parent. `components.js`
draws them instead. On phones they open as a bottom sheet — an anchored menu
near the bottom of a scrolling sheet fights the keyboard and the address bar —
and from `sm` up as a popup portalled to `<body>` so a sheet cannot clip it,
flipped above the trigger when space is short, repositioned (not closed) on
scroll, and driven by arrow keys, Enter and Escape. Nested storage units are
accordions animating on `grid-template-rows`, which transitions to the real
content height without hard-coding a guess; which branches are open survives
background refreshes.

**Motion** is capped at 260ms and a few pixels: screens fade up on entry, list
rows arrive in a short stagger, dropdowns scale from their trigger, carets
rotate, sheets and the drawer slide. Everything is switched off under
`prefers-reduced-motion`. Layout properties are never animated — the sidebar's
width changes instantly and only its labels fade, because a throttled
`width` transition (backgrounded tab, low-power mode) holds its start value and
leaves the rail stuck half-collapsed.

**Accent colour** — eight presets plus any custom hex, in Settings. One CSS
variable drives the app; hover and tint shades are derived with `color-mix`, and
`theme.js` works out whether text on the accent should be dark or light, so a pale
yellow and a deep blue both stay readable. The choice is stored in `localStorage`
and applied by a tiny inline script before first paint. Repo has its own accent,
so the chosen one is kept but not applied while Repo is on.

**Fonts** are self-hosted (`static/fonts`, OFL): DM Sans, Bricolage Grotesque for
headings, JetBrains Mono for the Repo interface, which only downloads when used.

**Icons** — nothing here is a photo you have to take. 235 line icons
(`item-icons.js` holds the original 49, `icon-set.js` the rest, grouped by room
and purpose: electronics, kitchen, tools, bathroom, clothing, stationery and so on)
and 74 product-brand marks (`brand-icons.js` is the name index; the marks are SVG
files in `static/icons/brands/`, drawn through a CSS mask so they follow the text
colour), plus 101 monogram badges for Indian household and FMCG brands whose logos
there is no licence-clean source for (`brand-monograms.js`; a tile with the brand's
initials, labelled as such in the picker, never passed off as the logo). The picker
has Things and Brands tabs and is filterable by name or keyword;
until you choose one the icon follows what you type: "Winter jacket" suggests
*Coats & jackets*. A brand is stored as `brand:<slug>`. An item shows its photo if
it has one, then its icon, then the quantity badge.

`/static/icons.html` is a gallery of every icon. `scripts/export-icons.mjs` writes
the line icons out as standalone `.svg` files (`static/icons/home/`), and
`scripts/gen-brand-icons.mjs` re-vendors the brand marks from
[Simple Icons](https://simpleicons.org) (CC0; it has dropped some brands such as
Philips, Canon and Microsoft at their owners' request, so those are absent). The
app's own `h/` mark, favicon, app icons and wordmark are plain-stroke SVGs in
`static/brand/`.

Three behaviours do the heavy lifting:

**Local cache.** Every GET response is stored in `localStorage` under its own
path. A returning visitor sees their rooms painted from cache on the first
frame; the network only confirms it afterwards (stale-while-revalidate). With no
network at all, browsing still works from the cache.

**Skeleton screens.** `index.html` ships the shape of the home screen as static
markup, so the first paint is never a blank page. Every list falls back to
skeleton rows shaped like the real rows, which is why nothing jumps when data
lands. Search shows skeletons on the keystroke, not after the round trip.

**Optimistic updates.** Nothing in the UI awaits the server. `store.mutate()`
edits the cached views immediately, then queues the request:

- The new row appears at once, dimmed, with a "saving" dot; the add button grows
  a pip while anything is in flight.
- On success the server's record replaces the stand-in — real id, real location
  path, real counts.
- On a 4xx the change is rolled back and a banner offers Retry or Discard.
- On a network failure the mutation stays queued (it survives a reload) and
  retries with backoff, and immediately when the browser fires `online`.
- The queue is ordered, and temporary ids are rewritten once their record
  saves — so "add a box, then add an item to it" works even fully offline.

Deletes are optimistic too, with an Undo toast.

### Client layout

```
internal/web/static/js/cache.js       localStorage cache, debounced writes
internal/web/static/js/api.js         fetch wrapper, permanent vs transient errors
internal/web/static/js/store.js       views, revalidation, mutation queue, overlays
internal/web/static/js/photos.js      photo uploads with instant local preview
internal/web/static/js/labels.js      QR label sheet, print layout, scanner
internal/web/static/js/components.js  app-drawn dropdowns and accordions
internal/web/static/js/item-icons.js  the original icons, grouping, brand-aware renderer
internal/web/static/js/icon-set.js    the larger set of line icons
internal/web/static/js/brand-icons.js brand name index (marks live in static/icons/brands)
internal/web/static/js/look.js        Classic vs Repo wording, path format, dates, ₹
internal/web/static/js/theme.js       accent, theme mode, interface switch
internal/web/static/js/taxonomy.js    tag picker, custom-field editor
internal/web/static/js/ui.js          escaping, icons, skeletons, rows, sheets, toasts
internal/web/static/js/app.js         screens, hash router, actions
internal/web/css/input.css            Tailwind source and both skins -> static/css/app.css
```

Screens are `#/` (Find), `#/places`, `#/value`, `#/room/<id>`, `#/unit/<id>`,
`#/search?q=`, `#/labels/<roomId>` and `#/settings`. Each one declares the API paths
it depends on, which is what the store revalidates after a write. `#/item/<id>` has
no screen of its own: it sends you to wherever the item lives and opens its card on
top, which is where a scanned barcode lands.

## Photos

Upload one photo per item. The server re-encodes everything to two JPEGs — a
1600px display image and a 400px thumbnail — under
`items/<xx>/<uuid>{,_t}.jpg` in the uploads volume.

Re-encoding is the point, not a side effect:

- **Rotation is baked into the pixels.** A phone held sideways records the
  rotation as an EXIF flag rather than rotating the image; re-encoding drops
  that flag, so without this every second photo would appear on its side.
  `sharp` reads the orientation tag and applies it before resizing.
- **Metadata is stripped**, including the GPS coordinates phones attach — your
  home address does not need to be in a file you might later share.
- **Size collapses.** A 134KB test photo became 44KB display + 4KB thumbnail.

Photos are stored in Postgres by default (`MEDIA_BACKEND=db`), which is what
lets the app run on a host with no writable disk; `disk` writes to
`UPLOAD_DIR` instead. Either way the URLs and behaviour are identical.

Accepted: JPEG, PNG, GIF, WebP, up to 15MB. HEIC is not supported — iOS Safari
converts to JPEG when uploading through a file input, so this rarely bites, but
a HEIC that does arrive gets a clear 415 rather than a silent failure.

Keys are UUIDs and are never rewritten, so `/media/*` is served `immutable`
with a one-year cache and an ETag, and a revalidating browser gets a 304. Replacing or deleting a photo, or deleting
the item, removes the old files; a failed database write deletes the file it
just wrote, so no orphans accumulate in either direction.

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/items/{id}/photo` | multipart, field `photo`. Returns the updated item. |
| DELETE | `/api/items/{id}/photo` | Removes the photo and its files. |
| GET | `/media/...` | The images themselves. |

In the UI, the picked photo appears **immediately** — as a local `blob:` preview
in the sheet and in the item row, dimmed with a pulse while it uploads. Two
details matter here:

- The preview is registered as a store *overlay*, not a plain patch. Saving the
  item's other fields triggers a revalidation, and the server does not know
  about this photo yet — a plain patch would be wiped mid-upload.
- The swap to the server thumbnail waits until that image has decoded, so the
  row never flashes empty.

Photo uploads are the one thing not queued across reloads — a `File` cannot go
into localStorage. A failed upload offers Retry while the page is open.

## Codes: QR labels and barcodes

Two kinds of code lead back to the same place, and the scanner does not care
which it sees.

**Barcodes** — a shop-bought product already has a code printed on it, so it
needs no label of its own. Store that code on the item (`items.barcode`) and
scanning the box finds it. Barcodes are deliberately **not** unique: owning two
identical tins is normal, and a scan matching several items opens the search
results instead of guessing. Spaces and hyphens are stripped, so
`5000 157-024671` and `5000157024671` are the same code.

**QR labels** are for everything else — the boxes, drawers and shelves that
have no code of their own.

`GET /api/scan?code=…` resolves either kind: one of our label codes (bare, or
as a full `…/q/CODE` URL) or a product barcode. It answers with `kind`:
`storage_unit`, `item`, `items` (several of the same product) or `unknown` —
and the UI turns `unknown` into an offer to file the code against a new item.

## QR labels

Every storage unit gets a ten-character code when it is created (`8H90AQ6BRX` —
Crockford-style alphabet, no I/L/O/U, so nothing is ambiguous when read aloud or
typed). That code is the link between the box on the shelf and the app.

**Print** from a room's *QR labels* link, or from the label button on any unit.
Labels are laid out in millimetres so the screen matches the paper: 62×30mm,
four-up on A4, dashed cut lines, and the code printed in text under the name in
case the QR gets scuffed. Printing hides all app chrome.

**Scan** with any phone camera — the QR encodes an absolute URL,
`https://your-host/q/8H90AQ6BRX`, which 303s straight to that unit inside the
app. No app install, no scanner needed. The in-app scanner (the button beside
the search bar) uses the browser's `BarcodeDetector` where available and always
offers manual code entry as a fallback; codes are case-insensitive, and pasting
the whole URL works too.

An unknown or retired code still lands in the app, on the home screen with an
explanation, rather than on a 404.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/q/{slug}` | The printed link. 303 to the unit in the app. |
| GET | `/api/qr/{slug}/svg` | Label artwork. SVG stays sharp at any label size. |
| GET | `/api/qr/{slug}/png` | Raster fallback. |
| GET | `/api/qr/{slug}/target` | Resolves a code without redirecting, for the scanner. |
| GET | `/api/qr/{slug}` | The unit and its contents. |
| GET | `/api/scan?code=` | Resolves a QR code **or** a product barcode. |
| PATCH | `/api/storage-units/{id}` | Accepts `qr_slug` to override a printed code (4–24 chars, A–Z0–9, unique). |
| POST | `/api/storage-units/{id}/qr/regenerate` | Issues a fresh code, retiring the printed one. |

**Settings** (`#/settings`) lists every storage-unit code and every item
barcode in one editable place — override a code, issue a new one when a label
is lost or reused, or open an item to edit it. Overriding is deliberately its
own screen rather than a field on the unit form: it re-points every label
already stuck to a box.

Set `PUBLIC_BASE_URL` before printing anything. Without it each label encodes
whichever host the browser used to reach the app — fine on a home network,
wrong the moment the app moves to a stable address, and labels are expensive to
reprint. `X-Forwarded-Proto` / `X-Forwarded-Host` are honoured behind a proxy.

## Tags and custom fields

**Tags** come from a vocabulary, not thin air. `tags` is a catalogue table
seeded with ~32 useful ones (electronics, cleaning, furniture, tools, documents,
spare parts…), and anything typed into an item joins it automatically. The
picker shows the whole list with usage counts, filters as you type, and creates
what is missing — a picker that only offered what already existed would be a
cage. Names are normalised (trimmed, lowercased, inner spaces collapsed), so
"Spare  Parts" and "spare parts" are one tag.

Settings manages them: **renaming a tag rewrites it on every item that carries
it**, in one transaction, and deleting one strips it from them. `items.tags`
stays a denormalised `text[]` — that is what makes tag search a single index
lookup — with the catalogue as the thing you administer.

**Custom fields** are anything else you want to record: `Part of: Homelab`,
`Warranty until: 2027-03`, `Serial: C02X1234`. Stored as `items.properties`
jsonb with a GIN index, so they are queryable rather than just displayed:

| Query | Meaning |
| --- | --- |
| `/api/items?prop=Part of:Homelab` | everything in the Homelab |
| `/api/items?prop=Serial` | everything that has a serial recorded |
| `/api/search?q=homelab` | field keys and values are searchable too |
| `/api/properties` | every field name in use, with its values — powers autocomplete |

The editor suggests fields based on the item's tags — an `electronics` item
offers Brand, Model, Serial, Part of, Purchased, Warranty until, Cost — merged
with whatever fields already exist elsewhere in your home. A `PATCH` with
`properties` replaces the whole set; omitting the key leaves it untouched.

Values are tappable everywhere they appear: seeing "Homelab" and wanting the
rest of the Homelab is the obvious next thought.

## Data model

| Table | Notes |
| --- | --- |
| `users` | Seeded with one default household member. No auth yet; `items.created_by` / `updated_by` already point here so multi-user and the move log are additive later. |
| `rooms` | `floor` (integer, negative for basements) plus optional `floor_name` for places a number cannot describe ("Attic"). Names are unique **per floor**, so two "Bedroom"s can coexist upstairs and down. Rooms sort bottom-up. |
| `storage_units` | `room_id` + nullable `parent_id` = arbitrary nesting. Each carries a unique `qr_slug` for phase 4. Sibling names are unique within a parent. |
| `photos` | Rendered JPEG bytes, keyed by `(key, variant)` where variant is `display` or `thumb`. `bytes` is `STORAGE EXTERNAL` so it never gets read back by a listing query. |
| `items` | Always has a `room_id`; `storage_unit_id` is null for things sitting loose in a room. `tags text[]`, trigram indexes on name/description for fuzzy search. `icon` holds a key from the frontend's icon set (or `brand:<slug>`). `barcode` holds a manufacturer's code, indexed but not unique. `purchase_price` (numeric) and `purchased_on` (date) are optional and feed the cost-per-day figure. |
| `item_moves` | Where every item has been: one `added` row, then one `moved` row per relocation. Paths are stored as names and ids are plain columns, so history survives a renamed or deleted box; deleting the item deletes its moves. |
| `storage_unit_paths` | Recursive view giving every unit its ancestor `path` (`text[]`), `id_path` (`uuid[]`) and depth. Every read joins it, so the API never returns a bare parent pointer. |

Two invariants the store enforces, not the caller:

- An item's `room_id` always matches its storage unit's room. Send a mismatched
  pair and you get a 400.
- Moving a unit between rooms retags its whole subtree and every item inside it.

## API

All routes are under `/api`. IDs are UUIDs.

### Rooms

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/rooms` | Each room includes `storage_unit_count` and `item_count`. |
| POST | `/rooms` | `{name, floor?, floor_name?, description?, sort_order?}` |
| GET | `/rooms/{id}` | |
| PATCH | `/rooms/{id}` | Partial; omitted fields are untouched. |
| DELETE | `/rooms/{id}` | 409 if non-empty. `?cascade=true` deletes its units and items. |
| GET | `/rooms/{id}/tree` | Nested unit tree plus `unplaced_items` (loose in the room). |
| GET | `/rooms/{id}/items` | `?q=&limit=&offset=` |

### Storage units

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/storage-units` | `?room_id=&parent_id=&root_only=true` |
| POST | `/storage-units` | `{name, room_id? , parent_id?, kind?, description?}` — one of `room_id`/`parent_id` required; a child inherits its parent's room. |
| GET | `/storage-units/{id}` | Includes `path`, `depth`, `room_name`, `item_count`. |
| PATCH | `/storage-units/{id}` | Reparent with `parent_id` (explicit `null` moves it to the room root). Cycles are rejected with 400. |
| DELETE | `/storage-units/{id}` | Children and contents are **promoted one level up** so nothing loses its location. `?cascade=true` deletes the whole subtree and its items. |
| GET | `/storage-units/{id}/contents` | Children + items. `?deep=true` includes everything nested below. |
| GET | `/qr/{slug}` | Same payload, looked up by the printed label code. |

### Items

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/items` | `?q=&room_id=&storage_unit_id=&deep=true&tags=a,b&prop=key:value&barcode=&has_barcode=true&has_price=true&limit=&offset=` |
| POST | `/items` | `{name, room_id?, storage_unit_id?, description?, quantity?, tags?, icon?, barcode?}` — one of `room_id`/`storage_unit_id` required. |
| GET | `/items/{id}` | |
| PATCH | `/items/{id}` | Sending `room_id` or `storage_unit_id` relocates it. `purchase_price` and `purchased_on` (`YYYY-MM-DD`) can be set, or cleared with `null`. |
| GET | `/items/{id}/history` | Its moves, newest first. |
| GET | `/activity` | `?limit=` The latest moves across every item: the "last put away" feed. |
| POST | `/items/{id}/move` | Relocation-only shortcut — the hook for the future move log. |
| POST | `/items/{id}/photo` | multipart upload; see [Photos](#photos). |
| DELETE | `/items/{id}/photo` | |
| DELETE | `/items/{id}` | Deletes its photo files too. |
| GET | `/search?q=` | Matches name, description, tags, barcode and custom field keys/values; ranked by name similarity. |
| GET | `/tags` | The vocabulary with usage counts. |
| POST | `/tags` | `{name}` |
| PATCH | `/tags/{tag}` | Rename, rewriting every item that uses it. |
| DELETE | `/tags/{tag}` | Retire, stripping it from every item. |
| GET | `/properties` | Field names in use, with their values. |

Every item response carries a `location` object, and a `value` object (`days`, `per_day`) when it has both a price and a purchase date:

```json
{
  "room_id": "…",
  "room_name": "Bedroom",
  "floor": 1,
  "floor_label": "1st floor",
  "storage_unit_id": "…",
  "path": ["Bedroom", "Wardrobe", "Top Shelf", "Blue Box"],
  "path_string": "Bedroom > Wardrobe > Top Shelf > Blue Box"
}
```

The floor stays out of `path_string` and travels beside it, because it is only
worth showing in a home that has more than one — which the UI decides.

Tags are lowercased, trimmed and de-duplicated on write.

Errors are `{"error": "...", "detail": "..."}` with 400 (bad input), 404, 409
(duplicate name, or non-empty delete) and 500.

## Layout

```
api/index.js         Vercel entrypoint (same handler, built once per instance)
scripts/dev.js       local Node.js server entrypoint
lib                  config, database, migrations, API, storage and app wiring
internal/db/migrations  ordered SQL migrations shared by every runtime
internal/web/static  frontend assets served from disk
internal/web/css     Tailwind source; generated CSS is committed in static/css
lib/media            image processing and disk/Postgres photo storage
lib/qr.js            QR rendering (SVG for print, PNG fallback)
scripts/smoke.sh    end-to-end API test
scripts/export-icons.mjs     writes every line icon as a standalone .svg
scripts/gen-brand-icons.mjs  re-vendors the brand marks from Simple Icons
```

The complete file-by-file map of the repo lives in
[structure.md](structure.md).

Migrations are plain `.sql` files in `internal/db/migrations`, applied in
filename order inside a transaction and recorded in `schema_migrations`. Add
`0002_*.sql` and restart.
