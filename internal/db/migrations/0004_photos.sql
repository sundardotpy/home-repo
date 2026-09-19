-- Photos move into the database.
--
-- The app has to run where the filesystem is read-only and nothing survives
-- between requests (Vercel, Cloud Run, Fly machines that scale to zero), so
-- "write two JPEGs to a volume" is not available. At household scale the sizes
-- involved are tiny — a display image lands around 40KB and a thumbnail around
-- 4KB — so the database is a better home than another service to operate.
CREATE TABLE photos (
    key        text NOT NULL,
    variant    text NOT NULL CHECK (variant IN ('display', 'thumb')),
    bytes      bytea NOT NULL,
    byte_size  integer NOT NULL,
    width      integer NOT NULL,
    height     integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (key, variant)
);

-- Photo bytes are never part of a listing query, and TOAST already stores them
-- out of line; this only keeps them from being read back by accident.
ALTER TABLE photos ALTER COLUMN bytes SET STORAGE EXTERNAL;
