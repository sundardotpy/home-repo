-- Items can live inside other items: a box inside a box, a case inside a bag.
-- Placement stays denormalised (room_id / storage_unit_id always name the
-- nearest physical home, so every existing query keeps working); the new
-- parent_item_id adds the logical containment on top.

ALTER TABLE items ADD COLUMN parent_item_id uuid REFERENCES items (id);

ALTER TABLE items ADD CONSTRAINT items_not_self_parent
    CHECK (parent_item_id IS NULL OR parent_item_id <> id);

CREATE INDEX items_parent_idx ON items (parent_item_id);

-- Every item's ancestor chain, mirroring storage_unit_paths but walking up:
-- one row per item, `path` holding the ancestor ITEM names outside-in and
-- excluding the item itself (its own name is already on the row). depth is the
-- number of ancestors, so a loose item has depth 0 and an empty path. The
-- recursion seeds one row per item and then one per ancestor; only the deepest
-- row per item (the complete chain) is kept.
CREATE VIEW item_paths AS
WITH RECURSIVE up(id, root, id_path, path, depth) AS (
    SELECT id, id, ARRAY[]::uuid[], ARRAY[]::text[], 0 FROM items
  UNION ALL
    SELECT up.id, p.id, p.id || up.id_path, p.name || up.path, up.depth + 1
      FROM up
      JOIN items me ON me.id = up.root
      JOIN items p ON p.id = me.parent_item_id
)
SELECT DISTINCT ON (id) id, id_path, path, depth
  FROM up
 ORDER BY id, depth DESC;
