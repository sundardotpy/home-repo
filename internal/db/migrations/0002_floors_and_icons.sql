-- Floors. A house with two bedrooms needs to tell them apart, which also means
-- room names can no longer be unique on their own — only unique per floor.
ALTER TABLE rooms ADD COLUMN floor smallint NOT NULL DEFAULT 0;

-- Optional override for places a number cannot describe: "Attic", "Loft".
ALTER TABLE rooms ADD COLUMN floor_name text NOT NULL DEFAULT '';

DROP INDEX rooms_name_key;
CREATE UNIQUE INDEX rooms_floor_name_key ON rooms (floor, lower(name));
CREATE INDEX rooms_floor_idx ON rooms (floor);

-- A picked icon for items with no photo. Empty means "fall back to the
-- quantity badge"; the icon set itself lives in the frontend.
ALTER TABLE items ADD COLUMN icon text NOT NULL DEFAULT '';
