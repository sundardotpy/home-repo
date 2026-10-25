-- A scoped Postgres role for the Android client. Run this ONCE against the
-- production database (Neon SQL editor or psql), then put these credentials
-- into the app's connection screen instead of the owner's.
--
-- The phone can read everything, write items and their history, and delete
-- items only. It cannot touch rooms, units, users, or the schema.

CREATE ROLE android_app LOGIN PASSWORD 'CHANGE-ME-to-something-long';

GRANT USAGE ON SCHEMA public TO android_app;

GRANT SELECT ON rooms, storage_units, users, photos TO android_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON items TO android_app;
GRANT SELECT, INSERT ON item_moves TO android_app;
GRANT SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO android_app;

-- The path views are read like tables.
GRANT SELECT ON storage_unit_paths, item_paths TO android_app;

-- House Shift lives in its own schema and stays server-side; the phone has no
-- business there.
REVOKE ALL ON SCHEMA shift FROM android_app;
