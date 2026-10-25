# Repo structure — what every file is for

Home Repo is a household inventory app with **one Postgres database and two
clients**: a Node backend serving a vanilla-JS single-page web app, and a native
Android app that talks straight to the same database (no sync layer — last
write wins). This file maps every part of the repo to its responsibility.

Deletions and additions should keep this map true; if you move or add
something, move or add its line here.

## Root

| File | Responsibility |
|---|---|
| `README.md` | Project overview, run/deploy instructions, schema summary |
| `structure.md` | This file — the map of the repo |
| `package.json` / `package-lock.json` | Node deps and scripts: `dev`, `start`, `css`, `css:watch`, `test` |
| `Dockerfile` | Two-stage image: `dev` target (full repo, runs `npm run dev`) and `prod` (app + `lib` + static assets only) |
| `docker-compose.yml` | Local stack: `app` service, optional `localdb` Postgres profile, on-demand `css` Tailwind watcher |
| `vercel.json` | Vercel serverless config — routes everything through `api/index.js` and bundles `internal/` into the function |
| `.env.example` | Template for the environment variables `lib/config.js` reads |
| `.gitignore` / `.dockerignore` / `.vercelignore` | Ignore rules per tool |
| `.claude/launch.json` | Claude Code launch config (opens localhost:8080) |

## Serverless entry

| File | Responsibility |
|---|---|
| `api/index.js` | The Vercel entrypoint — adapts Vercel's request/response objects to the shared app build in `lib/app.js` |

## Backend — `lib/`

The core server. Every module here is plain Node (ESM), no framework.

| File | Responsibility |
|---|---|
| `lib/app.js` | Wiring shared by the dev server and the serverless entry: db pool, media stores, auth, router, routes |
| `lib/config.js` | All configuration, read from the environment (one place) |
| `lib/db.js` | Postgres connection pooling and `withTransaction` |
| `lib/errors.js` | Sentinel errors the API layer maps onto HTTP status codes |
| `lib/http.js` | Request/response helpers: body decoding, `writeJSON`, query parsing, UUID params |
| `lib/log.js` | Structured JSON-per-line logging (for Vercel's log viewer) |
| `lib/router.js` | The small router: `{param}` placeholders, `*` wildcards, middleware, 405s |
| `lib/uuid.js` | Strict UUID parsing/normalising |
| `lib/model.js` | Derived display values (floor labels and friends) shared by UI concerns |
| `lib/auth.js` | The single shared passcode: when `APP_PASSCODE` is set, data routes demand a session cookie |
| `lib/web.js` | Serves the SPA shell and static assets from `internal/web/static` |
| `lib/migrate.js` | Applies the SQL migrations in `internal/db/migrations` on boot |
| `lib/qr.js` | Renders storage-unit QR label codes as SVG (print) and PNG |
| `lib/mcp.js` | Model Context Protocol endpoint: stateless JSON-RPC at `/mcp` so an external AI can read/write the inventory through the store layer |

### HTTP API — `lib/api/`

| File | Responsibility |
|---|---|
| `lib/api/server.js` | The route table and request plumbing; mounts every module below |
| `lib/api/rooms.js` | Room routes |
| `lib/api/units.js` | Storage unit (box/drawer/shelf) routes |
| `lib/api/items.js` | Item routes — add, move, nest, declutter, search |
| `lib/api/tags.js` | Tag and custom-property autocomplete routes |
| `lib/api/photos.js` | Photo upload and delivery |
| `lib/api/qrcodes.js` | QR label sheets and scan resolution |
| `lib/api/history.js` | Item location history and the recent-moves feed |
| `lib/api/shift.js` | House Shift routes: enter the copy, work inside it, commit or discard |

### Data layer — `lib/store/`

| File | Responsibility |
|---|---|
| `lib/store/index.js` | The store façade: maps Postgres vocabulary onto the sentinel errors, so HTTP never sees a SQLSTATE |
| `lib/store/sql.js` | Shared SQL plumbing: error mapping, "no rows" handling |
| `lib/store/room.js` | Room persistence |
| `lib/store/unit.js` | Storage unit persistence (incl. label-code generation) |
| `lib/store/item.js` | Item persistence, nesting/cycle checks, location history |
| `lib/store/tag.js` | Tag vocabulary and normalisation |
| `lib/store/shift.js` | House Shift mode: copy the inventory into a `shift` schema, journal changes, replay on commit |

### Photos — `lib/media/`

| File | Responsibility |
|---|---|
| `lib/media/index.js` | The sharp pipeline: EXIF-rotate, strip GPS, produce display + thumbnail JPEGs |
| `lib/media/diskstore.js` | Photo bytes on disk under `UPLOAD_DIR` (containers/volumes) |
| `lib/media/pgstore.js` | Photo bytes in Postgres — the default, works on serverless hosts |

## Database schema — `internal/db/migrations/`

Numbered SQL files, the single source of truth for every deployment; applied
by `lib/migrate.js` in order.

| Migration | Adds |
|---|---|
| `0001_init.sql` | Rooms, units, items, users — the base schema |
| `0002_floors_and_icons.sql` | Floor names, per-unit icons |
| `0003_barcodes.sql` | Barcode scanning fields |
| `0004_photos.sql` | Photo tables |
| `0005_tags_and_properties.sql` | Tags and custom properties |
| `0006_value_and_history.sql` | Item value and location history |
| `0007_item_nesting.sql` | Items inside items (`parent_item_id`, recursive `item_paths` view) |
| `0008_actions_and_status.sql` | The three put-away actions (Add/Decluttered/Move) and item status |
| `0009_house_shift.sql` | The `shift` schema and journal for House Shift mode |

## Frontend — `internal/web/`

A single-page app in vanilla JS; `index.html` is the only HTML entry.

| File / dir | Responsibility |
|---|---|
| `internal/web/css/input.css` | Tailwind v4 source for the stylesheet |
| `internal/web/static/css/app.css` | **Generated** by `npm run css` — committed so the app runs without the build |
| `internal/web/static/index.html` | The app shell; loads `/static/js/app.js` and the manifest |
| `internal/web/static/manifest.json` | PWA manifest |
| `internal/web/static/brand.html` | Dev gallery page for the brand assets |
| `internal/web/static/icons.html` | Dev gallery page for the icon set |
| `internal/web/static/fonts/` | Self-hosted variable fonts (SIL OFL; see the README there) |
| `internal/web/static/brand/` | Wordmark, mark, app icons, favicons (SVG sources + rendered PNGs) |
| `internal/web/static/icons/brands/*.svg` | **Generated** — brand marks vendored from Simple Icons |
| `internal/web/static/icons/home/*.svg` | **Generated** — every line icon as a standalone file, for design tools |

### Frontend modules — `internal/web/static/js/`

| File | Responsibility |
|---|---|
| `app.js` | Entry module: screens, client-side routing, every action that drives a mutation |
| `api.js` | Thin `fetch` wrapper over the JSON API |
| `store.js` | The client store: cached views plus the durable queue of optimistic mutations |
| `cache.js` | Local cache of every API GET, so a returning visitor sees their home instantly |
| `ui.js` | Presentation helpers: escaping, icons, skeletons, rows, toasts, sheets |
| `components.js` | App-native controls replacing OS-drawn widgets (selects, sheets) |
| `look.js` | Everything that differs between the Classic and Repo interfaces, plus shared formatters |
| `theme.js` | Appearance settings: dark mode and the accent colour |
| `photos.js` | Photo uploads with the same optimistic promise as other actions |
| `labels.js` | QR labels: view one, print a sheet, scan one back |
| `lock.js` | The passcode screen shown when the server answers 401 |
| `taxonomy.js` | Tags and custom properties UI |
| `voice.js` | Voice-to-action sheet: "Helmet is in living room" → parse → confirm → move |
| `item-icons.js` | The icon registry — source of truth for what an item can be drawn as |
| `icon-set.js` | Hand-drawn household line icons feeding the registry |
| `brand-icons.js` | **Generated** — name index over the vendored brand marks |
| `brand-monograms.js` | Monogram badges for brands that have no shippable mark |

## Android client — `android/`

Talks directly to Postgres with the credentials from `docs/android-role.sql`;
mirrors the web home screen.

| File / dir | Responsibility |
|---|---|
| `android/settings.gradle.kts`, `android/build.gradle.kts`, `android/gradle.properties` | Gradle build config |
| `android/app/build.gradle.kts` | App module config (AGP, Compose, pgjdbc) |
| `android/app/src/main/AndroidManifest.xml` | Permissions (internet, camera) and the single activity |
| `android/app/src/main/java/app/homerepo/MainActivity.kt` | The whole app UI: hero search, Transactions grid, filters, put-away feed |
| `android/app/src/main/java/app/homerepo/Db.kt` | The database layer: one persistent JDBC connection, health-checked, same invariants as the server's store |
| `android/app/src/main/java/app/homerepo/ItemIcons.kt` | **Generated** by `scripts/export-android-icons.mjs` — icon keys → bundled drawables |
| `android/app/src/main/java/java/lang/management/*.java` | Stubs satisfying pgjdbc's one `java.lang.management` reference (Android has none) |
| `android/app/src/main/res/drawable/ic_*.xml` | **Generated** — item line icons and brand marks as VectorDrawables |
| `android/app/src/main/res/values/themes.xml` | App theme |

## Scripts — `scripts/`

| File | Responsibility |
|---|---|
| `scripts/dev.js` | The long-running server for local dev and the container |
| `scripts/smoke.sh` | End-to-end API smoke test against a live stack (self-cleaning) |
| `scripts/mcp-check.mjs` | MCP round-trip check against a running dev server (needs `MCP_TOKEN`) |
| `scripts/gen-brand-icons.mjs` | Vendor Simple Icons marks into `static/icons/brands/` and regenerate `brand-icons.js` |
| `scripts/export-icons.mjs` | Export every line icon to `static/icons/home/` as standalone SVGs |
| `scripts/render-app-icons.mjs` | Render the brand PNGs (app icons, touch icon) from their SVGs |
| `scripts/export-android-icons.mjs` | Export the web icon set to Android drawables + regenerate `ItemIcons.kt` |

## Tests — `test/`

Run with `npm test` (`node --test`). DB-gated suites skip without a local
database and refuse a remote one unless `ALLOW_REMOTE_TEST_DB=1`.

| File | Covers |
|---|---|
| `test/router.test.js` | The router: params, wildcards, middleware, 405s |
| `test/http.test.js` | Body decoding and request helpers |
| `test/model.test.js` | Derived display values |
| `test/qr.test.js` | QR rendering and scan targets |
| `test/media.test.js` | Photo processing and storage |
| `test/auth.test.js` | Passcode/session behaviour |
| `test/server.test.js` | Raw API requests are gated, including photo and QR handlers |
| `test/store.test.js` | Store SQL details (parameter ordering) |
| `test/handler.test.js` | The serverless entrypoint incl. the cached app build (DB-gated) |
| `test/mcp.test.js` | The MCP surface: framing, tool catalogue, error mapping |

## Docs — `docs/`

| File | Responsibility |
|---|---|
| `docs/todo-rework.md` | The original seven-feature rework request (Oct 2026), kept as the source prompt |
| `docs/todo-rework-spec.md` | The living spec and implementation record for that rework |
| `docs/android-role.sql` | The scoped Postgres role the Android app connects as (run once on prod) |
| `docs/House Move Planner Webapp Brainstorm.md` | The brainstorm that became House Shift mode |
| `docs/inspirations/` | Design reference images |

## Generated files — do not edit by hand

| Output | Regenerated by |
|---|---|
| `internal/web/static/css/app.css` | `npm run css` (from `internal/web/css/input.css`) |
| `internal/web/static/icons/home/*.svg` | `scripts/export-icons.mjs` (from `item-icons.js`) |
| `internal/web/static/icons/brands/*.svg`, `static/js/brand-icons.js` | `scripts/gen-brand-icons.mjs` |
| `internal/web/static/brand/*.png` | `scripts/render-app-icons.mjs` |
| `android/.../ItemIcons.kt`, `android/.../res/drawable/ic_*.xml` | `scripts/export-android-icons.mjs` |
| `package-lock.json` | `npm install` |

## Runtime directories (gitignored, created on demand)

- `uploads/` — photo bytes when `MEDIA_BACKEND=disk`; created by `lib/media/diskstore.js`
- `tmp/` — scratch space for the icon/font generation docker runs
- `node_modules/`, `android/.gradle/`, `android/build/`, `android/.kotlin/` — dependencies and build caches
