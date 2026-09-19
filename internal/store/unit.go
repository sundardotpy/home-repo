package store

import (
	"context"
	"errors"
	"strconv"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/sundar/home_sweet_home/internal/model"
)

// Every unit read joins the recursive path view so callers always get the human
// readable location, not just a parent pointer.
const unitCols = `su.id, su.room_id, su.parent_id, su.name, su.kind, su.description, su.qr_slug,
	su.created_at, su.updated_at, r.name, p.path, p.depth,
	(SELECT count(*) FROM items i WHERE i.storage_unit_id = su.id)`

const unitFrom = `FROM storage_units su
	JOIN rooms r ON r.id = su.room_id
	JOIN storage_unit_paths p ON p.id = su.id`

func scanUnit(row interface{ Scan(...any) error }) (*model.StorageUnit, error) {
	var u model.StorageUnit
	err := row.Scan(&u.ID, &u.RoomID, &u.ParentID, &u.Name, &u.Kind, &u.Description, &u.QRSlug,
		&u.CreatedAt, &u.UpdatedAt, &u.RoomName, &u.Path, &u.Depth, &u.ItemCount)
	if err != nil {
		return nil, mapErr(err)
	}
	return &u, nil
}

func (s *Store) queryUnits(ctx context.Context, where string, args ...any) ([]*model.StorageUnit, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT `+unitCols+` `+unitFrom+` `+where+` ORDER BY p.path`, args...)
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()

	out := []*model.StorageUnit{}
	for rows.Next() {
		u, err := scanUnit(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, mapErr(rows.Err())
}

type UnitFilter struct {
	RoomID   *uuid.UUID
	ParentID *uuid.UUID
	RootOnly bool // only units sitting directly in the room
}

func (s *Store) ListStorageUnits(ctx context.Context, f UnitFilter) ([]*model.StorageUnit, error) {
	where := `WHERE true`
	args := []any{}
	if f.RoomID != nil {
		args = append(args, *f.RoomID)
		where += ` AND su.room_id = $1`
	}
	switch {
	case f.ParentID != nil:
		args = append(args, *f.ParentID)
		where += ` AND su.parent_id = $` + strconv.Itoa(len(args))
	case f.RootOnly:
		where += ` AND su.parent_id IS NULL`
	}
	return s.queryUnits(ctx, where, args...)
}

func (s *Store) GetStorageUnit(ctx context.Context, id uuid.UUID) (*model.StorageUnit, error) {
	return scanUnit(s.pool.QueryRow(ctx, `SELECT `+unitCols+` `+unitFrom+` WHERE su.id = $1`, id))
}

// GetStorageUnitBySlug backs the phase 4 QR scan endpoint.
func (s *Store) GetStorageUnitBySlug(ctx context.Context, slug string) (*model.StorageUnit, error) {
	return scanUnit(s.pool.QueryRow(ctx, `SELECT `+unitCols+` `+unitFrom+` WHERE su.qr_slug = $1`, slug))
}

// RoomTree returns the room's units nested as an actual tree, for the browse UI.
func (s *Store) RoomTree(ctx context.Context, roomID uuid.UUID) ([]*model.StorageUnit, error) {
	flat, err := s.ListStorageUnits(ctx, UnitFilter{RoomID: &roomID})
	if err != nil {
		return nil, err
	}
	byID := make(map[uuid.UUID]*model.StorageUnit, len(flat))
	for _, u := range flat {
		byID[u.ID] = u
	}
	roots := []*model.StorageUnit{}
	for _, u := range flat {
		if u.ParentID == nil {
			roots = append(roots, u)
			continue
		}
		if parent, ok := byID[*u.ParentID]; ok {
			parent.Children = append(parent.Children, u)
		} else {
			roots = append(roots, u) // orphan guard; shouldn't happen
		}
	}
	return roots, nil
}

type UnitInput struct {
	RoomID      uuid.UUID
	ParentID    *uuid.UUID
	Name        string
	Kind        string
	Description string
}

func (s *Store) CreateStorageUnit(ctx context.Context, in UnitInput) (*model.StorageUnit, error) {
	// A child always lives in its parent's room; trust the parent over the payload.
	if in.ParentID != nil {
		var parentRoom uuid.UUID
		err := s.pool.QueryRow(ctx,
			`SELECT room_id FROM storage_units WHERE id = $1`, *in.ParentID).Scan(&parentRoom)
		if err != nil {
			return nil, mapErr(err)
		}
		if in.RoomID != uuid.Nil && in.RoomID != parentRoom {
			return nil, ErrRoomCross
		}
		in.RoomID = parentRoom
	}

	var id uuid.UUID
	err := s.pool.QueryRow(ctx, `
		INSERT INTO storage_units (room_id, parent_id, name, kind, description, qr_slug)
		VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
		in.RoomID, in.ParentID, in.Name, in.Kind, in.Description, qrSlug()).Scan(&id)
	if err != nil {
		return nil, mapErr(err)
	}
	return s.GetStorageUnit(ctx, id)
}

type UnitPatch struct {
	Name        *string
	Kind        *string
	Description *string
	QRSlug      *string // an override; must stay unique across all units

	// Reparenting. SetParent distinguishes "parent_id": null (move to room root)
	// from the field being absent entirely.
	SetParent bool
	ParentID  *uuid.UUID
	RoomID    *uuid.UUID
}

func (s *Store) UpdateStorageUnit(ctx context.Context, id uuid.UUID, p UnitPatch) (*model.StorageUnit, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, mapErr(err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var curRoom uuid.UUID
	if err := tx.QueryRow(ctx, `SELECT room_id FROM storage_units WHERE id = $1`, id).Scan(&curRoom); err != nil {
		return nil, mapErr(err)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE storage_units SET
			name        = COALESCE($2, name),
			kind        = COALESCE($3, kind),
			description = COALESCE($4, description),
			qr_slug     = COALESCE($5, qr_slug),
			updated_at  = now()
		WHERE id = $1`, id, p.Name, p.Kind, p.Description, p.QRSlug); err != nil {
		return nil, mapErr(err)
	}

	if p.SetParent || p.RoomID != nil {
		newRoom := curRoom
		if p.RoomID != nil {
			newRoom = *p.RoomID
		}
		if p.SetParent && p.ParentID != nil {
			if *p.ParentID == id {
				return nil, ErrCycle
			}
			// Moving a unit under its own descendant would orphan the subtree.
			var isDescendant bool
			err := tx.QueryRow(ctx,
				`SELECT $1 = ANY(id_path) FROM storage_unit_paths WHERE id = $2`,
				id, *p.ParentID).Scan(&isDescendant)
			if err != nil && !errors.Is(err, pgx.ErrNoRows) {
				return nil, mapErr(err)
			}
			if isDescendant {
				return nil, ErrCycle
			}
			var parentRoom uuid.UUID
			if err := tx.QueryRow(ctx,
				`SELECT room_id FROM storage_units WHERE id = $1`, *p.ParentID).Scan(&parentRoom); err != nil {
				return nil, mapErr(err)
			}
			if p.RoomID != nil && *p.RoomID != parentRoom {
				return nil, ErrRoomCross
			}
			newRoom = parentRoom
		}

		if p.SetParent {
			if _, err := tx.Exec(ctx,
				`UPDATE storage_units SET parent_id = $2, updated_at = now() WHERE id = $1`,
				id, p.ParentID); err != nil {
				return nil, mapErr(err)
			}
		}
		if newRoom != curRoom {
			// The whole subtree — and every item in it — follows the unit.
			if err := retagSubtreeRoom(ctx, tx, id, newRoom); err != nil {
				return nil, err
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, mapErr(err)
	}
	return s.GetStorageUnit(ctx, id)
}

// retagSubtreeRoom rewrites room_id on a unit, its descendants and their items.
func retagSubtreeRoom(ctx context.Context, tx pgx.Tx, rootID, roomID uuid.UUID) error {
	const subtree = `
		WITH RECURSIVE sub AS (
			SELECT id FROM storage_units WHERE id = $1
			UNION ALL
			SELECT su.id FROM storage_units su JOIN sub ON su.parent_id = sub.id
		)`
	if _, err := tx.Exec(ctx, subtree+`
		UPDATE items SET room_id = $2, updated_at = now()
		WHERE storage_unit_id IN (SELECT id FROM sub)`, rootID, roomID); err != nil {
		return mapErr(err)
	}
	if _, err := tx.Exec(ctx, subtree+`
		UPDATE storage_units SET room_id = $2, updated_at = now()
		WHERE id IN (SELECT id FROM sub)`, rootID, roomID); err != nil {
		return mapErr(err)
	}
	return nil
}

// RegenerateSlug issues a fresh code, retiring whatever is printed on the old
// label. Retried on the astronomically unlikely collision.
func (s *Store) RegenerateSlug(ctx context.Context, id uuid.UUID) (*model.StorageUnit, error) {
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		tag, err := s.pool.Exec(ctx,
			`UPDATE storage_units SET qr_slug = $2, updated_at = now() WHERE id = $1`, id, qrSlug())
		if err == nil {
			if tag.RowsAffected() == 0 {
				return nil, ErrNotFound
			}
			return s.GetStorageUnit(ctx, id)
		}
		lastErr = mapErr(err)
		if !errors.Is(lastErr, ErrConflict) {
			return nil, lastErr
		}
	}
	return nil, lastErr
}

// DeleteStorageUnit removes a unit. By default its children and contents are
// promoted one level up (to the parent unit, or loose in the room) so nothing
// silently loses its location. With cascade, the whole subtree and every item
// inside it is deleted.
func (s *Store) DeleteStorageUnit(ctx context.Context, id uuid.UUID, cascade bool) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return mapErr(err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var parentID *uuid.UUID
	if err := tx.QueryRow(ctx,
		`SELECT parent_id FROM storage_units WHERE id = $1`, id).Scan(&parentID); err != nil {
		return mapErr(err)
	}

	if cascade {
		const sub = `
			WITH RECURSIVE sub AS (
				SELECT id FROM storage_units WHERE id = $1
				UNION ALL
				SELECT su.id FROM storage_units su JOIN sub ON su.parent_id = sub.id
			)`
		if _, err := tx.Exec(ctx, sub+`
			DELETE FROM items WHERE storage_unit_id IN (SELECT id FROM sub)`, id); err != nil {
			return mapErr(err)
		}
	} else {
		if _, err := tx.Exec(ctx,
			`UPDATE storage_units SET parent_id = $2, updated_at = now() WHERE parent_id = $1`,
			id, parentID); err != nil {
			return mapErr(err)
		}
		if _, err := tx.Exec(ctx,
			`UPDATE items SET storage_unit_id = $2, updated_at = now() WHERE storage_unit_id = $1`,
			id, parentID); err != nil {
			return mapErr(err)
		}
	}

	tag, err := tx.Exec(ctx, `DELETE FROM storage_units WHERE id = $1`, id)
	if err != nil {
		return mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return mapErr(tx.Commit(ctx))
}
