package api

import (
	"log/slog"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/sundar/home_repo/internal/store"
)

func (s *Server) listItems(w http.ResponseWriter, r *http.Request) {
	f, ok := s.itemFilterFromQuery(w, r)
	if !ok {
		return
	}
	items, total, err := s.store.ListItems(r.Context(), f)
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"items":  items,
		"total":  total,
		"limit":  f.Limit,
		"offset": f.Offset,
	})
}

func (s *Server) itemFilterFromQuery(w http.ResponseWriter, r *http.Request) (store.ItemFilter, bool) {
	roomID, err := queryUUID(r, "room_id")
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid room_id")
		return store.ItemFilter{}, false
	}
	unitID, err := queryUUID(r, "storage_unit_id")
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid storage_unit_id")
		return store.ItemFilter{}, false
	}
	var tags []string
	if raw := r.URL.Query().Get("tags"); raw != "" {
		tags = normaliseTags(strings.Split(raw, ","))
	}
	propKey, propValue := "", ""
	if raw := r.URL.Query().Get("prop"); raw != "" {
		propKey, propValue, _ = strings.Cut(raw, ":")
	}

	return store.ItemFilter{
		Query:         r.URL.Query().Get("q"),
		PropKey:       propKey,
		PropValue:     propValue,
		Barcode:       normaliseBarcode(r.URL.Query().Get("barcode")),
		HasBarcode:    queryBool(r, "has_barcode"),
		RoomID:        roomID,
		StorageUnitID: unitID,
		Deep:          queryBool(r, "deep"),
		Tags:          tags,
		Limit:         queryInt(r, "limit", 50),
		Offset:        queryInt(r, "offset", 0),
	}, true
}

func (s *Server) getItem(w http.ResponseWriter, r *http.Request) {
	id, ok := urlID(w, r, "itemID")
	if !ok {
		return
	}
	item, err := s.store.GetItem(r.Context(), id)
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, item)
}

type itemBody struct {
	Name          *string           `json:"name"`
	Description   *string           `json:"description"`
	Quantity      *int              `json:"quantity"`
	Tags          []string          `json:"tags"`
	Icon          *string           `json:"icon"`
	Barcode       *string           `json:"barcode"`
	Properties    map[string]string `json:"properties"`
	RoomID        *uuid.UUID        `json:"room_id"`
	StorageUnitID *uuid.UUID        `json:"storage_unit_id"`
	PhotoPath     *string           `json:"photo_path"`
}

func (s *Server) createItem(w http.ResponseWriter, r *http.Request) {
	var b itemBody
	if !decode(w, r, &b) {
		return
	}
	if b.Name == nil || strings.TrimSpace(*b.Name) == "" {
		writeErr(w, http.StatusBadRequest, "name is required")
		return
	}
	if b.RoomID == nil && b.StorageUnitID == nil {
		writeErr(w, http.StatusBadRequest, "room_id or storage_unit_id is required")
		return
	}

	in := store.ItemInput{
		Name:          strings.TrimSpace(*b.Name),
		Quantity:      1,
		Tags:          normaliseTags(b.Tags),
		StorageUnitID: b.StorageUnitID,
		PhotoPath:     b.PhotoPath,
	}
	if b.RoomID != nil {
		in.RoomID = *b.RoomID
	}
	if b.Description != nil {
		in.Description = strings.TrimSpace(*b.Description)
	}
	if b.Icon != nil {
		in.Icon = strings.TrimSpace(*b.Icon)
	}
	if b.Barcode != nil {
		in.Barcode = normaliseBarcode(*b.Barcode)
	}
	in.Properties = normaliseProperties(b.Properties)
	if b.Quantity != nil {
		if *b.Quantity < 0 {
			writeErr(w, http.StatusBadRequest, "quantity cannot be negative")
			return
		}
		in.Quantity = *b.Quantity
	}
	if actor, err := s.store.DefaultUserID(r.Context()); err == nil {
		in.ActorID = &actor
	}

	item, err := s.store.CreateItem(r.Context(), in)
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	// Anything typed into the tag field joins the vocabulary.
	if err := s.store.EnsureTags(r.Context(), in.Tags); err != nil {
		slog.Warn("record tags", "err", err)
	}
	writeJSON(w, http.StatusCreated, item)
}

func (s *Server) updateItem(w http.ResponseWriter, r *http.Request) {
	id, ok := urlID(w, r, "itemID")
	if !ok {
		return
	}
	raw, b, ok := decodeWithKeys[itemBody](w, r)
	if !ok {
		return
	}

	p := store.ItemPatch{
		Description: b.Description,
		Quantity:    b.Quantity,
		Tags:        normaliseTags(b.Tags),
		Icon:        b.Icon,
		Properties:  normaliseProperties(b.Properties),
		PhotoPath:   b.PhotoPath,
	}
	if b.Barcode != nil {
		code := normaliseBarcode(*b.Barcode)
		p.Barcode = &code
	}
	if b.Name != nil {
		trimmed := strings.TrimSpace(*b.Name)
		if trimmed == "" {
			writeErr(w, http.StatusBadRequest, "name cannot be empty")
			return
		}
		p.Name = &trimmed
	}
	if b.Quantity != nil && *b.Quantity < 0 {
		writeErr(w, http.StatusBadRequest, "quantity cannot be negative")
		return
	}
	_, unitPresent := raw["storage_unit_id"]
	_, roomPresent := raw["room_id"]
	if unitPresent || roomPresent {
		p.SetLocation = true
		p.StorageUnitID = b.StorageUnitID
		p.RoomID = b.RoomID
	}
	if actor, err := s.store.DefaultUserID(r.Context()); err == nil {
		p.ActorID = &actor
	}

	item, err := s.store.UpdateItem(r.Context(), id, p)
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	if len(p.Tags) > 0 {
		if err := s.store.EnsureTags(r.Context(), p.Tags); err != nil {
			slog.Warn("record tags", "err", err)
		}
	}
	writeJSON(w, http.StatusOK, item)
}

// moveItem is the "I just put this somewhere else" shortcut the UI will use;
// it is a relocation-only PATCH and the natural hook for the phase-5 move log.
func (s *Server) moveItem(w http.ResponseWriter, r *http.Request) {
	id, ok := urlID(w, r, "itemID")
	if !ok {
		return
	}
	var b struct {
		RoomID        *uuid.UUID `json:"room_id"`
		StorageUnitID *uuid.UUID `json:"storage_unit_id"`
	}
	if !decode(w, r, &b) {
		return
	}
	if b.RoomID == nil && b.StorageUnitID == nil {
		writeErr(w, http.StatusBadRequest, "room_id or storage_unit_id is required")
		return
	}
	p := store.ItemPatch{SetLocation: true, RoomID: b.RoomID, StorageUnitID: b.StorageUnitID}
	if actor, err := s.store.DefaultUserID(r.Context()); err == nil {
		p.ActorID = &actor
	}
	item, err := s.store.UpdateItem(r.Context(), id, p)
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) deleteItem(w http.ResponseWriter, r *http.Request) {
	id, ok := urlID(w, r, "itemID")
	if !ok {
		return
	}
	// Read the photo key before the row goes, so its files can go too.
	key := ""
	if s.media != nil {
		key, _ = s.store.PhotoKeyOf(r.Context(), id)
	}
	if err := s.store.DeleteItem(r.Context(), id); err != nil {
		writeStoreErr(w, err)
		return
	}
	if key != "" {
		_ = s.media.Delete(r.Context(), key)
	}
	w.WriteHeader(http.StatusNoContent)
}

// search is the headline feature: name or tag in, full location path out.
func (s *Server) search(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		writeErr(w, http.StatusBadRequest, "q is required")
		return
	}
	f, ok := s.itemFilterFromQuery(w, r)
	if !ok {
		return
	}
	f.Query = q
	items, total, err := s.store.ListItems(r.Context(), f)
	if err != nil {
		writeStoreErr(w, err)
		return
	}

	type hit struct {
		ID       uuid.UUID `json:"id"`
		Name     string    `json:"name"`
		Quantity int       `json:"quantity"`
		Tags     []string  `json:"tags"`
		Location string    `json:"location"`
		Item     any       `json:"item"`
	}
	hits := make([]hit, 0, len(items))
	for _, it := range items {
		hits = append(hits, hit{
			ID: it.ID, Name: it.Name, Quantity: it.Quantity, Tags: it.Tags,
			Location: it.Location.PathString, Item: it,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"query": q, "total": total, "results": hits})
}
