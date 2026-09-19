package store

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Sentinel errors the API layer maps onto HTTP status codes.
var (
	ErrNotFound  = errors.New("not found")
	ErrConflict  = errors.New("conflict")
	ErrNotEmpty  = errors.New("not empty")
	ErrCycle     = errors.New("would create a cycle")
	ErrInvalid   = errors.New("invalid")
	ErrRoomCross = errors.New("storage unit belongs to a different room")
)

type Store struct {
	pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Store { return &Store{pool: pool} }

// DefaultUserID returns the seeded household member. Phase 1 has no auth, so
// every write is attributed to this user; later phases swap in the session user.
func (s *Store) DefaultUserID(ctx context.Context) (uuid.UUID, error) {
	var id uuid.UUID
	err := s.pool.QueryRow(ctx,
		`SELECT id FROM users WHERE is_default ORDER BY created_at LIMIT 1`).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, ErrNotFound
	}
	return id, err
}

// mapErr translates Postgres constraint violations into sentinel errors.
func mapErr(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505": // unique_violation
			return fmt.Errorf("%w: %s", ErrConflict, pgErr.ConstraintName)
		case "23503": // foreign_key_violation
			return fmt.Errorf("%w: %s", ErrNotFound, pgErr.ConstraintName)
		case "23514": // check_violation
			return fmt.Errorf("%w: %s", ErrInvalid, pgErr.ConstraintName)
		}
	}
	return err
}

// qrSlug produces a short, unambiguous label code for a storage unit. Phase 4
// encodes it into the printed QR; generating it up front costs nothing.
const slugAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ" // Crockford-ish, no I/L/O/U

func qrSlug() string {
	b := make([]byte, 10)
	if _, err := rand.Read(b); err != nil {
		panic(err) // crypto/rand failing means the process is unusable
	}
	var sb strings.Builder
	for _, c := range b {
		sb.WriteByte(slugAlphabet[int(c)%len(slugAlphabet)])
	}
	return sb.String()
}
