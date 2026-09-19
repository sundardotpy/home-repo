CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Schema-ready for multi-user; no auth in phase 1. Everything is attributed to
-- the seeded default household member below.
CREATE TABLE users (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL,
    email       text UNIQUE,
    is_default  boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rooms (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL,
    description text NOT NULL DEFAULT '',
    sort_order  integer NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX rooms_name_key ON rooms (lower(name));

-- Arbitrary nesting: Bedroom > Wardrobe > Top Shelf > Blue Box > ...
-- Every unit carries its room_id denormalised so path building and room-scoped
-- queries never need to walk to the root.
CREATE TABLE storage_units (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id     uuid NOT NULL REFERENCES rooms (id) ON DELETE RESTRICT,
    parent_id   uuid REFERENCES storage_units (id) ON DELETE CASCADE,
    name        text NOT NULL,
    kind        text NOT NULL DEFAULT '',
    description text NOT NULL DEFAULT '',
    qr_slug     text NOT NULL UNIQUE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT storage_units_not_self_parent CHECK (parent_id IS NULL OR parent_id <> id)
);
CREATE INDEX storage_units_room_idx ON storage_units (room_id);
CREATE INDEX storage_units_parent_idx ON storage_units (parent_id);
CREATE UNIQUE INDEX storage_units_sibling_name_key
    ON storage_units (room_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

-- An item lives either loose in a room (storage_unit_id NULL) or inside a unit.
-- room_id is always populated and kept in sync with the unit's room.
CREATE TABLE items (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            text NOT NULL,
    description     text NOT NULL DEFAULT '',
    quantity        integer NOT NULL DEFAULT 1 CHECK (quantity >= 0),
    tags            text[] NOT NULL DEFAULT '{}',
    room_id         uuid NOT NULL REFERENCES rooms (id) ON DELETE RESTRICT,
    storage_unit_id uuid REFERENCES storage_units (id) ON DELETE SET NULL,
    photo_path      text,
    created_by      uuid REFERENCES users (id) ON DELETE SET NULL,
    updated_by      uuid REFERENCES users (id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX items_room_idx ON items (room_id);
CREATE INDEX items_unit_idx ON items (storage_unit_id);
CREATE INDEX items_tags_idx ON items USING gin (tags);
CREATE INDEX items_name_trgm_idx ON items USING gin (name gin_trgm_ops);
CREATE INDEX items_description_trgm_idx ON items USING gin (description gin_trgm_ops);

-- Full ancestor chain of every storage unit as a text[], root-first.
-- Item location path = room name prepended to this.
CREATE VIEW storage_unit_paths AS
WITH RECURSIVE tree AS (
    SELECT su.id, su.room_id, su.parent_id,
           ARRAY[su.name]::text[] AS path,
           ARRAY[su.id]::uuid[]   AS id_path,
           1 AS depth
      FROM storage_units su
     WHERE su.parent_id IS NULL
    UNION ALL
    SELECT su.id, su.room_id, su.parent_id,
           t.path || su.name,
           t.id_path || su.id,
           t.depth + 1
      FROM storage_units su
      JOIN tree t ON su.parent_id = t.id
)
SELECT id, room_id, parent_id, path, id_path, depth FROM tree;

INSERT INTO users (name, email, is_default) VALUES ('Home', NULL, true);
