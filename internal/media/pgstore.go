package media

import (
	"context"
	"errors"
	"fmt"
	"io"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PGStore keeps photo bytes in Postgres. It is the default because it works
// identically on a long-lived container and on a read-only serverless
// filesystem, and because it makes a database backup a complete backup.
type PGStore struct {
	pool *pgxpool.Pool
}

func NewPGStore(pool *pgxpool.Pool) *PGStore { return &PGStore{pool: pool} }

func (s *PGStore) Save(ctx context.Context, r io.Reader) (string, error) {
	out, err := Process(r)
	if err != nil {
		return "", err
	}
	key := NewKey()

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op once committed

	for variant, ren := range map[string]Rendition{Display: out.Display, Thumb: out.Thumb} {
		_, err := tx.Exec(ctx, `
			INSERT INTO photos (key, variant, bytes, byte_size, width, height)
			VALUES ($1, $2, $3, $4, $5, $6)`,
			key, variant, ren.Bytes, len(ren.Bytes), ren.Width, ren.Height)
		if err != nil {
			return "", fmt.Errorf("store %s: %w", variant, err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return "", err
	}
	return key, nil
}

func (s *PGStore) Open(ctx context.Context, key, variant string) ([]byte, error) {
	var b []byte
	err := s.pool.QueryRow(ctx,
		`SELECT bytes FROM photos WHERE key = $1 AND variant = $2`, key, variant).Scan(&b)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return b, err
}

func (s *PGStore) Delete(ctx context.Context, key string) error {
	if key == "" {
		return nil
	}
	_, err := s.pool.Exec(ctx, `DELETE FROM photos WHERE key = $1`, key)
	return err
}
