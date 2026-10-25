-- Splitting "put away" into Add (buy), Decluttered and Move. A thing that has
-- left the household is not deleted — its history and value stay — it just
-- stops appearing in the active inventory.

ALTER TABLE items ADD COLUMN status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'decluttered'));
ALTER TABLE items ADD COLUMN decluttered_at timestamptz;
ALTER TABLE items ADD COLUMN declutter_note text;

-- A decluttered item's contents leave with it; the store enforces the
-- non-empty-container rule, the CHECK only documents the states.
CREATE INDEX items_status_idx ON items (status);

-- Decluttering is recorded in the same history as moves, and Add on an
-- existing thing (buying another one) carries how many arrived.
ALTER TABLE item_moves DROP CONSTRAINT item_moves_kind_check;
ALTER TABLE item_moves ADD CONSTRAINT item_moves_kind_check
    CHECK (kind IN ('added', 'moved', 'decluttered'));
ALTER TABLE item_moves ADD COLUMN quantity integer;
