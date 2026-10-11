-- What a thing cost and when it was bought, so the app can say what it costs
-- per day. Both are optional: most things never get a price, and that is fine.
ALTER TABLE items ADD COLUMN purchase_price numeric(12,2);
ALTER TABLE items ADD COLUMN purchased_on   date;

ALTER TABLE items ADD CONSTRAINT items_purchase_price_nonneg
    CHECK (purchase_price IS NULL OR purchase_price >= 0);

-- Where every item has been. One row per placement: the first is 'added', each
-- relocation after that is 'moved'.
--
-- The room and unit ids are plain columns, not foreign keys, and the paths are
-- stored as names: a box can be renamed or deleted years later and the history
-- should still read the way it did when the move happened. Only the item itself
-- owns its history, so deleting the item deletes its moves.
CREATE TABLE item_moves (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id      uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    kind         text NOT NULL CHECK (kind IN ('added', 'moved')),
    from_room_id uuid,
    from_unit_id uuid,
    to_room_id   uuid NOT NULL,
    to_unit_id   uuid,
    from_path    text[],
    to_path      text[] NOT NULL,
    moved_at     timestamptz NOT NULL DEFAULT now(),
    moved_by     uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX item_moves_item_idx   ON item_moves (item_id, moved_at DESC);
CREATE INDEX item_moves_recent_idx ON item_moves (moved_at DESC);

-- Existing items get a starting entry, dated when they were created.
INSERT INTO item_moves (item_id, kind, to_room_id, to_unit_id, to_path, moved_at, moved_by)
SELECT i.id, 'added', i.room_id, i.storage_unit_id,
       ARRAY[r.name] || COALESCE(p.path, ARRAY[]::text[]),
       i.created_at, i.created_by
  FROM items i
  JOIN rooms r ON r.id = i.room_id
  LEFT JOIN storage_unit_paths p ON p.id = i.storage_unit_id;
