-- Custom properties: whatever a person wants to record about a thing that the
-- fixed columns do not cover — "Part of: Homelab", "Warranty until: 2027-03",
-- "Serial: C02X1234". A jsonb object keeps it one column and one write, and the
-- GIN index makes "everything in the Homelab" a real query rather than a scan.
ALTER TABLE items ADD COLUMN properties jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE items ADD CONSTRAINT items_properties_is_object
    CHECK (jsonb_typeof(properties) = 'object');

CREATE INDEX items_properties_idx ON items USING gin (properties);

-- The tag vocabulary. items.tags stays a text[] — denormalised on purpose, it
-- is what makes tag search a single index lookup — and this table is the
-- catalogue behind it: it lets a tag exist before anything uses it, and gives
-- somewhere to rename or retire one from.
CREATE TABLE tags (
    name       text PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- A starting vocabulary, so the first item is not typed into a void. Anything
-- typed later joins the list automatically.
INSERT INTO tags (name) VALUES
    ('electronics'), ('appliances'), ('furniture'), ('cleaning'),
    ('tools'), ('hardware'), ('cables'), ('batteries'),
    ('clothes'), ('shoes'), ('linen'), ('documents'),
    ('kitchen'), ('food'), ('medicine'), ('toiletries'),
    ('toys'), ('games'), ('books'), ('stationery'),
    ('sports'), ('camping'), ('garden'), ('car'),
    ('pet'), ('baby'), ('seasonal'), ('decorations'),
    ('spare parts'), ('valuables'), ('keepsakes'), ('paperwork');

-- Backfill the catalogue from tags already in use.
INSERT INTO tags (name)
SELECT DISTINCT unnest(tags) FROM items
ON CONFLICT (name) DO NOTHING;
