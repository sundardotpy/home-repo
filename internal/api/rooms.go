package api

import (
	"net/http"
	"strings"

	"github.com/sundar/home_repo/internal/store"
)

func (s *Server) listRooms(w http.ResponseWriter, r *http.Request) {
	rooms, err := s.store.ListRooms(r.Context())
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"rooms": rooms})
}

func (s *Server) getRoom(w http.ResponseWriter, r *http.Request) {
	id, ok := urlID(w, r, "roomID")
	if !ok {
		return
	}
	room, err := s.store.GetRoom(r.Context(), id)
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, room)
}

type roomBody struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	SortOrder   *int    `json:"sort_order"`
	Floor       *int    `json:"floor"`
	FloorName   *string `json:"floor_name"`
}

func (s *Server) createRoom(w http.ResponseWriter, r *http.Request) {
	var b roomBody
	if !decode(w, r, &b) {
		return
	}
	if b.Name == nil || strings.TrimSpace(*b.Name) == "" {
		writeErr(w, http.StatusBadRequest, "name is required")
		return
	}
	in := store.RoomInput{Name: strings.TrimSpace(*b.Name)}
	if b.Description != nil {
		in.Description = strings.TrimSpace(*b.Description)
	}
	if b.SortOrder != nil {
		in.SortOrder = *b.SortOrder
	}
	if b.Floor != nil {
		in.Floor = *b.Floor
	}
	if b.FloorName != nil {
		in.FloorName = strings.TrimSpace(*b.FloorName)
	}
	room, err := s.store.CreateRoom(r.Context(), in)
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, room)
}

func (s *Server) updateRoom(w http.ResponseWriter, r *http.Request) {
	id, ok := urlID(w, r, "roomID")
	if !ok {
		return
	}
	var b roomBody
	if !decode(w, r, &b) {
		return
	}
	if b.Name != nil {
		trimmed := strings.TrimSpace(*b.Name)
		if trimmed == "" {
			writeErr(w, http.StatusBadRequest, "name cannot be empty")
			return
		}
		b.Name = &trimmed
	}
	room, err := s.store.UpdateRoom(r.Context(), id, store.RoomPatch{
		Name:        b.Name,
		Description: b.Description,
		SortOrder:   b.SortOrder,
		Floor:       b.Floor,
		FloorName:   b.FloorName,
	})
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, room)
}

func (s *Server) deleteRoom(w http.ResponseWriter, r *http.Request) {
	id, ok := urlID(w, r, "roomID")
	if !ok {
		return
	}
	if err := s.store.DeleteRoom(r.Context(), id, queryBool(r, "cascade")); err != nil {
		writeStoreErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) roomTree(w http.ResponseWriter, r *http.Request) {
	id, ok := urlID(w, r, "roomID")
	if !ok {
		return
	}
	room, err := s.store.GetRoom(r.Context(), id)
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	tree, err := s.store.RoomTree(r.Context(), id)
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	// Items sitting loose in the room, not inside any unit.
	loose, _, err := s.store.ListItems(r.Context(),
		store.ItemFilter{RoomID: &id, Limit: 200})
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	unplaced := []any{}
	for _, it := range loose {
		if it.StorageUnitID == nil {
			unplaced = append(unplaced, it)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"room":           room,
		"storage_units":  tree,
		"unplaced_items": unplaced,
	})
}

func (s *Server) roomItems(w http.ResponseWriter, r *http.Request) {
	id, ok := urlID(w, r, "roomID")
	if !ok {
		return
	}
	items, total, err := s.store.ListItems(r.Context(), store.ItemFilter{
		RoomID: &id,
		Query:  r.URL.Query().Get("q"),
		Limit:  queryInt(r, "limit", 50),
		Offset: queryInt(r, "offset", 0),
	})
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": total})
}
