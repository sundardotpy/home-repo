package store

import (
	"context"
	"encoding/json"
	"log/slog"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/sundar/home_repo/internal/model"
)

const itemCols = `i.id, i.name, i.description, i.quantity, i.tags, i.icon, i.barcode,
	i.properties, i.room_id, i.storage_unit_id,
	i.photo_path, i.created_by, i.updated_by, i.created_at, i.updated_at,
	i.purchase_price::float8, to_char(i.purchased_on, 'YYYY-MM-DD'),
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
		&it.CreatedAt, &it.UpdatedAt, &it.PurchasePrice, &it.PurchasedOn,
		&roomName, &floor, &floorName, &unitPath)
	if err != nil {
		return nil, mapErr(err)
	}
	it.Value = model.NewValue(it.PurchasePrice, it.PurchasedOn, time.Now())
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
	HasPrice      bool // only items with a price and a purchase date (the Value screen)
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
	if f.HasPrice {
		where = append(where, `i.purchase_price IS NOT NULL AND i.purchased_on IS NOT NULL`)
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
	PurchasePrice *float64
	PurchasedOn   *string // YYYY-MM-DD
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
		                   room_id, storage_unit_id, photo_path, created_by, updated_by,
		                   purchase_price, purchased_on)
		VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $11,
		        $12::numeric, $13::date) RETURNING id`,
		in.Name, in.Description, in.Quantity, in.Tags, in.Icon, in.Barcode, props,
		roomID, in.StorageUnitID, in.PhotoPath, in.ActorID,
		in.PurchasePrice, in.PurchasedOn).Scan(&id)
	if err != nil {
		return nil, mapErr(err)
	}
	item, err := s.GetItem(ctx, id)
	if err != nil {
		return nil, err
	}
	s.recordMove(ctx, item.ID, "added", nil, item.Location, in.ActorID)
	return item, nil
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

	// Price and date use the same absent-vs-null handling as the location: the
	// Set flag says the key was sent, and a nil value then clears the field.
	SetPrice       bool
	PurchasePrice  *float64
	SetPurchasedOn bool
	PurchasedOn    *string

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
			purchase_price  = CASE WHEN $13::boolean THEN $14::numeric ELSE purchase_price END,
			purchased_on    = CASE WHEN $15::boolean THEN $16::date ELSE purchased_on END,
			updated_at      = now()
		WHERE id = $1`,
		id, p.Name, p.Description, p.Quantity, p.Tags, p.Icon, p.Barcode, props,
		p.PhotoPath, roomID, unitID, p.ActorID,
		p.SetPrice, p.PurchasePrice, p.SetPurchasedOn, p.PurchasedOn)
	if err != nil {
		return nil, mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	next, err := s.GetItem(ctx, id)
	if err != nil {
		return nil, err
	}
	// Only a real change of place is history; saving the form unchanged is not.
	if cur.RoomID != next.RoomID || !sameUnit(cur.StorageUnitID, next.StorageUnitID) {
		s.recordMove(ctx, next.ID, "moved", cur.Location, next.Location, p.ActorID)
	}
	return next, nil
}

func sameUnit(a, b *uuid.UUID) bool {
	if a == nil || b == nil {
		return a == b
	}
	return *a == *b
}

// recordMove appends to an item's history. A failure here is logged, not
// returned: losing one history line is better than refusing the move itself.
func (s *Store) recordMove(ctx context.Context, itemID uuid.UUID, kind string, from, to *model.Location, actor *uuid.UUID) {
	if to == nil {
		return
	}
	var (
		fromRoom *uuid.UUID
		fromUnit *uuid.UUID
		fromPath []string
	)
	if from != nil {
		fromRoom, fromUnit, fromPath = &from.RoomID, from.StorageUnitID, from.Path
	}
	_, err := s.pool.Exec(ctx, `
		INSERT INTO item_moves (item_id, kind, from_room_id, from_unit_id, to_room_id, to_unit_id,
		                        from_path, to_path, moved_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		itemID, kind, fromRoom, fromUnit, to.RoomID, to.StorageUnitID, fromPath, to.Path, actor)
	if err != nil {
		slog.Warn("record move", "item", itemID, "err", err)
	}
}

// ItemHistory lists where an item has been, newest first.
func (s *Store) ItemHistory(ctx context.Context, itemID uuid.UUID) ([]model.Move, error) {
	return s.moves(ctx, `WHERE m.item_id = $1`, 200, itemID)
}

// RecentMoves is the "last put away" feed across every item.
func (s *Store) RecentMoves(ctx context.Context, limit int) ([]model.Move, error) {
	if limit <= 0 || limit > 100 {
		limit = 10
	}
	return s.moves(ctx, `WHERE true`, limit)
}

func (s *Store) moves(ctx context.Context, where string, limit int, args ...any) ([]model.Move, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT m.id, m.item_id, i.name, i.icon, m.kind, m.from_path, m.to_path,
		       m.to_room_id, m.to_unit_id, m.moved_at
		  FROM item_moves m
		  JOIN items i ON i.id = m.item_id
		  `+where+`
		 ORDER BY m.moved_at DESC
		 LIMIT `+strconv.Itoa(limit), args...)
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()

	out := []model.Move{}
	for rows.Next() {
		var m model.Move
		if err := rows.Scan(&m.ID, &m.ItemID, &m.ItemName, &m.ItemIcon, &m.Kind,
			&m.FromPath, &m.ToPath, &m.ToRoomID, &m.ToUnitID, &m.MovedAt); err != nil {
			return nil, mapErr(err)
		}
		if m.FromPath == nil {
			m.FromPath = []string{}
		}
		out = append(out, m)
	}
	return out, mapErr(rows.Err())
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
