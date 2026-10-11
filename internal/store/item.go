package store

import (
	"context"
	"encoding/json"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/sundar/home_repo/internal/model"
)

const itemCols = `i.id, i.name, i.description, i.quantity, i.tags, i.icon, i.barcode,
	i.properties, i.room_id, i.storage_unit_id,
	i.photo_path, i.created_by, i.updated_by, i.created_at, i.updated_at,
	r.name, r.floor, r.floor_name, p.path`

const itemFrom = `FROM items i
	JOIN rooms r ON r.id = i.room_id
	LEFT JOIN storage_unit_paths p ON p.id = i.storage_unit_id`

func scanItem(row interface{ Scan(...any) error }) (*model.Item, error) {
	var (
		it        model.Item
		roomName  string
		floor     int
		floorName string
		unitPath  []string
	)
	err := row.Scan(&it.ID, &it.Name, &it.Description, &it.Quantity, &it.Tags, &it.Icon, &it.Barcode,
		&it.Properties, &it.RoomID, &it.StorageUnitID, &it.PhotoPath, &it.CreatedBy, &it.UpdatedBy,
		&it.CreatedAt, &it.UpdatedAt, &roomName, &floor, &floorName, &unitPath)
	if err != nil {
		return nil, mapErr(err)
	}
	loc := model.NewLocation(it.RoomID, roomName, floor, floorName, it.StorageUnitID, unitPath)
	it.Location = &loc
	it.PhotoURL, it.PhotoThumbURL = model.PhotoURLs(it.PhotoPath)
	if it.Tags == nil {
		it.Tags = []string{}
	}
	if it.Properties == nil {
		it.Properties = map[string]string{}
	}
	return &it, nil
}

// jsonbArg encodes a property set for a jsonb parameter, as a string.
//
// Two pooling-mode traps in a row here. pgx infers parameter types from the
// server's statement description, but a pooled connection runs in exec mode
// where there is no description: a Go map fails with "unknown type (OID 0):
// cannot find encode plan", and []byte is sent as a bytea hex literal, which
// Postgres then rejects as invalid JSON. A string is sent as text, so
// `$n::jsonb` parses it in every mode.
//
// A nil map returns nil, which the COALESCE in the update reads as "leave it
// alone".
func jsonbArg(m map[string]string) (*string, error) {
	if m == nil {
		return nil, nil
	}
	b, err := json.Marshal(m)
	if err != nil {
		return nil, err
	}
	s := string(b)
	return &s, nil
}

// args accumulates placeholders so filters can be composed in any order.
type args struct{ vals []any }

func (a *args) add(v any) string {
	a.vals = append(a.vals, v)
	return "$" + strconv.Itoa(len(a.vals))
}

type ItemFilter struct {
	Query   string
	Barcode string
	// PropKey alone matches items that have the field at all; with PropValue it
	// matches the pair — "everything that is part of the Homelab".
	PropKey       string
	PropValue     string
	HasBarcode    bool // only items that carry a manufacturer's code
	RoomID        *uuid.UUID
	StorageUnitID *uuid.UUID
	// Deep includes items in every descendant of StorageUnitID, not just the
	// unit itself — "what's in this wardrobe" usually means the whole wardrobe.
	Deep   bool
	Tags   []string
	Limit  int
	Offset int
}

func (s *Store) ListItems(ctx context.Context, f ItemFilter) ([]*model.Item, int, error) {
	var a args
	where := []string{"true"}

	if q := strings.TrimSpace(f.Query); q != "" {
		p := a.add("%" + q + "%")
		// A barcode typed into the search box should find its item, so the
		// exact-code match rides along with the fuzzy ones.
		where = append(where, `(i.name ILIKE `+p+`
			OR i.description ILIKE `+p+`
			OR i.barcode = `+a.add(q)+`
			OR EXISTS (SELECT 1 FROM unnest(i.tags) tg WHERE tg ILIKE `+p+`)
			OR EXISTS (SELECT 1 FROM jsonb_each_text(i.properties) pr
			            WHERE pr.key ILIKE `+p+` OR pr.value ILIKE `+p+`))`)
	}
	if code := strings.TrimSpace(f.Barcode); code != "" {
		where = append(where, `i.barcode = `+a.add(code))
	}
	if f.HasBarcode {
		where = append(where, `i.barcode <> ''`)
	}
	if key := strings.TrimSpace(f.PropKey); key != "" {
		if v := strings.TrimSpace(f.PropValue); v != "" {
			pair, err := jsonbArg(map[string]string{key: v})
			if err != nil {
				return nil, 0, err
			}
			where = append(where, `i.properties @> `+a.add(*pair)+`::jsonb`)
		} else {
			where = append(where, `i.properties ? `+a.add(key))
		}
	}
	if f.RoomID != nil {
		where = append(where, `i.room_id = `+a.add(*f.RoomID))
	}
	if f.StorageUnitID != nil {
		if f.Deep {
			where = append(where, `i.storage_unit_id IN (
				SELECT sp.id FROM storage_unit_paths sp WHERE `+a.add(*f.StorageUnitID)+` = ANY(sp.id_path))`)
		} else {
			where = append(where, `i.storage_unit_id = `+a.add(*f.StorageUnitID))
		}
	}
	if len(f.Tags) > 0 {
		where = append(where, `i.tags @> `+a.add(f.Tags))
	}

	clause := strings.Join(where, " AND ")

	var total int
	if err := s.pool.QueryRow(ctx,
		`SELECT count(*) FROM items i WHERE `+strings.ReplaceAll(clause, "\n\t\t\t", " "),
		a.vals...).Scan(&total); err != nil {
		return nil, 0, mapErr(err)
	}

	order := `ORDER BY lower(i.name)`
	if q := strings.TrimSpace(f.Query); q != "" {
		// Closest name match first, so "drill" beats "drill bit case".
		order = `ORDER BY similarity(i.name, ` + a.add(q) + `) DESC, lower(i.name)`
	}
	limit := f.Limit
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	sql := `SELECT ` + itemCols + ` ` + itemFrom + ` WHERE ` + clause + ` ` + order +
		` LIMIT ` + a.add(limit) + ` OFFSET ` + a.add(max(f.Offset, 0))

	rows, err := s.pool.Query(ctx, sql, a.vals...)
	if err != nil {
		return nil, 0, mapErr(err)
	}
	defer rows.Close()

	out := []*model.Item{}
	for rows.Next() {
		it, err := scanItem(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, it)
	}
	return out, total, mapErr(rows.Err())
}

func (s *Store) GetItem(ctx context.Context, id uuid.UUID) (*model.Item, error) {
	return scanItem(s.pool.QueryRow(ctx, `SELECT `+itemCols+` `+itemFrom+` WHERE i.id = $1`, id))
}

type ItemInput struct {
	Name          string
	Description   string
	Quantity      int
	Tags          []string
	Icon          string
	Barcode       string
	Properties    map[string]string
	RoomID        uuid.UUID
	StorageUnitID *uuid.UUID
	PhotoPath     *string
	ActorID       *uuid.UUID
}

func (s *Store) CreateItem(ctx context.Context, in ItemInput) (*model.Item, error) {
	roomID, err := s.resolveRoom(ctx, in.RoomID, in.StorageUnitID)
	if err != nil {
		return nil, err
	}
	if in.Tags == nil {
		in.Tags = []string{}
	}
	if in.Properties == nil {
		in.Properties = map[string]string{}
	}
	props, err := jsonbArg(in.Properties)
	if err != nil {
		return nil, err
	}

	var id uuid.UUID
	err = s.pool.QueryRow(ctx, `
		INSERT INTO items (name, description, quantity, tags, icon, barcode, properties,
		                   room_id, storage_unit_id, photo_path, created_by, updated_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $11) RETURNING id`,
		in.Name, in.Description, in.Quantity, in.Tags, in.Icon, in.Barcode, props,
		roomID, in.StorageUnitID, in.PhotoPath, in.ActorID).Scan(&id)
	if err != nil {
		return nil, mapErr(err)
	}
	return s.GetItem(ctx, id)
}

// resolveRoom keeps items.room_id honest: when an item is placed inside a unit,
// the unit's room always wins.
func (s *Store) resolveRoom(ctx context.Context, roomID uuid.UUID, unitID *uuid.UUID) (uuid.UUID, error) {
	if unitID == nil {
		if roomID == uuid.Nil {
			return uuid.Nil, ErrInvalid
		}
		return roomID, nil
	}
	var unitRoom uuid.UUID
	if err := s.pool.QueryRow(ctx,
		`SELECT room_id FROM storage_units WHERE id = $1`, *unitID).Scan(&unitRoom); err != nil {
		return uuid.Nil, mapErr(err)
	}
	if roomID != uuid.Nil && roomID != unitRoom {
		return uuid.Nil, ErrRoomCross
	}
	return unitRoom, nil
}

type ItemPatch struct {
	Name        *string
	Description *string
	Quantity    *int
	Tags        []string
	Icon        *string
	Barcode     *string
	Properties  map[string]string // non-nil replaces the whole set
	PhotoPath   *string
	ActorID     *uuid.UUID

	// Relocation, same absent-vs-null handling as UnitPatch.
	SetLocation   bool
	RoomID        *uuid.UUID
	StorageUnitID *uuid.UUID
}

func (s *Store) UpdateItem(ctx context.Context, id uuid.UUID, p ItemPatch) (*model.Item, error) {
	cur, err := s.GetItem(ctx, id)
	if err != nil {
		return nil, err
	}

	roomID, unitID := cur.RoomID, cur.StorageUnitID
	if p.SetLocation {
		unitID = p.StorageUnitID
		want := uuid.Nil
		if p.RoomID != nil {
			want = *p.RoomID
		} else if unitID == nil {
			want = cur.RoomID
		}
		if roomID, err = s.resolveRoom(ctx, want, unitID); err != nil {
			return nil, err
		}
	}

	props, err := jsonbArg(p.Properties)
	if err != nil {
		return nil, err
	}

	tag, err := s.pool.Exec(ctx, `
		UPDATE items SET
			name            = COALESCE($2, name),
			description     = COALESCE($3, description),
			quantity        = COALESCE($4, quantity),
			tags            = COALESCE($5, tags),
			icon            = COALESCE($6, icon),
			barcode         = COALESCE($7, barcode),
			properties      = COALESCE($8::jsonb, properties),
			photo_path      = COALESCE($9, photo_path),
			room_id         = $10,
			storage_unit_id = $11,
			updated_by      = COALESCE($12, updated_by),
			updated_at      = now()
		WHERE id = $1`,
		id, p.Name, p.Description, p.Quantity, p.Tags, p.Icon, p.Barcode, props,
		p.PhotoPath, roomID, unitID, p.ActorID)
	if err != nil {
		return nil, mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	return s.GetItem(ctx, id)
}

// SetItemPhoto attaches or clears an item's photo key. Callers read the
// previous key with PhotoKeyOf first so they can delete the orphaned files.
func (s *Store) SetItemPhoto(ctx context.Context, id uuid.UUID, key *string, actor *uuid.UUID) (*model.Item, error) {
	tag, err := s.pool.Exec(ctx, `
		UPDATE items
		   SET photo_path = $2, updated_by = COALESCE($3, updated_by), updated_at = now()
		 WHERE id = $1`, id, key, actor)
	if err != nil {
		return nil, mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	return s.GetItem(ctx, id)
}

// PhotoKeyOf reports the photo attached to an item, if any.
func (s *Store) PhotoKeyOf(ctx context.Context, id uuid.UUID) (string, error) {
	var key *string
	if err := s.pool.QueryRow(ctx, `SELECT photo_path FROM items WHERE id = $1`, id).Scan(&key); err != nil {
		return "", mapErr(err)
	}
	if key == nil {
		return "", nil
	}
	return *key, nil
}

func (s *Store) DeleteItem(ctx context.Context, id uuid.UUID) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM items WHERE id = $1`, id)
	if err != nil {
		return mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
