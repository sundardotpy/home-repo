package store

import (
	"context"

	"github.com/google/uuid"
	"github.com/sundar/home_repo/internal/model"
)

const roomCols = `r.id, r.name, r.description, r.sort_order, r.floor, r.floor_name,
	r.created_at, r.updated_at,
	(SELECT count(*) FROM storage_units su WHERE su.room_id = r.id),
	(SELECT count(*) FROM items i WHERE i.room_id = r.id)`

func scanRoom(row interface{ Scan(...any) error }) (*model.Room, error) {
	var r model.Room
	err := row.Scan(&r.ID, &r.Name, &r.Description, &r.SortOrder, &r.Floor, &r.FloorName,
		&r.CreatedAt, &r.UpdatedAt, &r.StorageUnitCount, &r.ItemCount)
	if err != nil {
		return nil, mapErr(err)
	}
	r.FloorLabel = model.FloorLabel(r.Floor, r.FloorName)
	return &r, nil
}

// Rooms come back bottom-up: basement first, then ground, then upstairs.
func (s *Store) ListRooms(ctx context.Context) ([]*model.Room, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT `+roomCols+` FROM rooms r ORDER BY r.floor, r.sort_order, lower(r.name)`)
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()

	out := []*model.Room{}
	for rows.Next() {
		r, err := scanRoom(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, mapErr(rows.Err())
}

func (s *Store) GetRoom(ctx context.Context, id uuid.UUID) (*model.Room, error) {
	return scanRoom(s.pool.QueryRow(ctx, `SELECT `+roomCols+` FROM rooms r WHERE r.id = $1`, id))
}

type RoomInput struct {
	Name        string
	Description string
	SortOrder   int
	Floor       int
	FloorName   string
}

func (s *Store) CreateRoom(ctx context.Context, in RoomInput) (*model.Room, error) {
	var id uuid.UUID
	err := s.pool.QueryRow(ctx,
		`INSERT INTO rooms (name, description, sort_order, floor, floor_name)
		 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		in.Name, in.Description, in.SortOrder, in.Floor, in.FloorName).Scan(&id)
	if err != nil {
		return nil, mapErr(err)
	}
	return s.GetRoom(ctx, id)
}

// RoomPatch carries only the fields the caller actually sent.
type RoomPatch struct {
	Name        *string
	Description *string
	SortOrder   *int
	Floor       *int
	FloorName   *string
}

func (s *Store) UpdateRoom(ctx context.Context, id uuid.UUID, p RoomPatch) (*model.Room, error) {
	tag, err := s.pool.Exec(ctx, `
		UPDATE rooms SET
			name        = COALESCE($2, name),
			description = COALESCE($3, description),
			sort_order  = COALESCE($4, sort_order),
			floor       = COALESCE($5, floor),
			floor_name  = COALESCE($6, floor_name),
			updated_at  = now()
		WHERE id = $1`, id, p.Name, p.Description, p.SortOrder, p.Floor, p.FloorName)
	if err != nil {
		return nil, mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	return s.GetRoom(ctx, id)
}

// DeleteRoom refuses to delete a room that still holds anything unless cascade
// is set, in which case its items and its whole unit tree go with it.
func (s *Store) DeleteRoom(ctx context.Context, id uuid.UUID, cascade bool) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return mapErr(err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op after commit

	var units, items int
	err = tx.QueryRow(ctx, `
		SELECT (SELECT count(*) FROM storage_units WHERE room_id = $1),
		       (SELECT count(*) FROM items WHERE room_id = $1)`, id).Scan(&units, &items)
	if err != nil {
		return mapErr(err)
	}
	if (units > 0 || items > 0) && !cascade {
		return ErrNotEmpty
	}
	if cascade {
		if _, err := tx.Exec(ctx, `DELETE FROM items WHERE room_id = $1`, id); err != nil {
			return mapErr(err)
		}
		// Deleting roots cascades down parent_id.
		if _, err := tx.Exec(ctx,
			`DELETE FROM storage_units WHERE room_id = $1 AND parent_id IS NULL`, id); err != nil {
			return mapErr(err)
		}
	}
	tag, err := tx.Exec(ctx, `DELETE FROM rooms WHERE id = $1`, id)
	if err != nil {
		return mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return mapErr(tx.Commit(ctx))
}
