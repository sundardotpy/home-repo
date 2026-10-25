-- A scoped Postgres role for the Android client. Run this ONCE against the
-- production database (Neon SQL editor or psql), then put these credentials
-- into the app's connection screen instead of the owner's.
--
-- Exactly what the app does (android/app/src/main/java/app/homerepo/Db.kt):
-- it manages rooms, storage units and items, writes their history, and reads
-- users for the "moved by" stamp and app_settings for the House Shift banner.
-- It cannot change the schema, users, photos or settings, or reach House
-- Shift's working copy. History cleanup on delete runs through the foreign
-- keys, which act as the table owner, so no DELETE on item_moves is needed.

CREATE ROLE android_app LOGIN PASSWORD 'CHANGE-ME-to-something-long';

GRANT USAGE ON SCHEMA public TO android_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON rooms, storage_units, items TO android_app;
GRANT SELECT, INSERT ON item_moves TO android_app;
GRANT SELECT ON users, app_settings TO android_app;

-- The path views are read like tables.
GRANT SELECT ON storage_unit_paths, item_paths TO android_app;
