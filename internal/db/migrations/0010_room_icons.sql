-- A picked icon for a room, like items have. Empty means "show the room's
-- initial on its tint"; the icon set itself lives in the clients.
ALTER TABLE rooms ADD COLUMN icon text NOT NULL DEFAULT '';
