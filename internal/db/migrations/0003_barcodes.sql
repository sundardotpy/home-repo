-- Manufactured goods already carry a code on the box. Storing it means those
-- items need no printed QR label at all — the scanner reads whichever it sees.
--
-- Deliberately not unique: owning two identical tins is normal. A scan that
-- matches several items shows the list.
ALTER TABLE items ADD COLUMN barcode text NOT NULL DEFAULT '';

CREATE INDEX items_barcode_idx ON items (barcode) WHERE barcode <> '';
