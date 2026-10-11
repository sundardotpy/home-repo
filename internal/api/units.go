package api

import (
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/sundar/home_repo/internal/model"
	"github.com/sundar/home_repo/internal/store"
)

func (s *Server) listUnits(w http.ResponseWriter, r *http.Request) {
	roomID, err := queryUUID(r, "room_id")
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid room_id")
		return
	}
	parentID, err := queryUUID(r, "parent_id")
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid parent_id")
		return
	}
	units, err := s.store.ListStorageUnits(r.Context(), store.UnitFilter{
		RoomID:   roomID,
		ParentID: parentID,
		RootOnly: queryBool(r, "root_only"),
	})
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"storage_units": units})
}

func (s *Server) getUnit(w http.ResponseWriter, r *http.Request) {
	id, ok := urlID(w, r, "unitID")
	if !ok {
		return
	}
	unit, err := s.store.GetStorageUnit(r.Context(), id)
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, unit)
}

func (s *Server) unitBySlug(w http.ResponseWriter, r *http.Request) {
	unit, err := s.store.GetStorageUnitBySlug(r.Context(), strings.ToUpper(chi.URLParam(r, "slug")))
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	s.writeUnitContents(w, r, unit)
}

// unitContents answers "what is inside this box", including nested boxes.
func (s *Server) unitContents(w http.ResponseWriter, r *http.Request) {
	id, ok := urlID(w, r, "unitID")
	if !ok {
		return
	}
	unit, err := s.store.GetStorageUnit(r.Context(), id)
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	s.writeUnitContents(w, r, unit)
}

func (s *Server) writeUnitContents(w http.ResponseWriter, r *http.Request, unit *model.StorageUnit) {
	children, err := s.store.ListStorageUnits(r.Context(), store.UnitFilter{ParentID: &unit.ID})
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	deep := queryBool(r, "deep")
	items, total, err := s.store.ListItems(r.Context(), store.ItemFilter{
		StorageUnitID: &unit.ID,
		Deep:          deep,
		Limit:         queryInt(r, "limit", 200),
	})
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"storage_unit": unit,
		"children":     children,
		"items":        items,
		"item_total":   total,
		"deep":         deep,
	})
}

type unitBody struct {
	RoomID      *uuid.UUID `json:"room_id"`
	ParentID    *uuid.UUID `json:"parent_id"`
	Name        *string    `json:"name"`
	Kind        *string    `json:"kind"`
	Description *string    `json:"description"`
	QRSlug      *string    `json:"qr_slug"`
}

func (s *Server) createUnit(w http.ResponseWriter, r *http.Request) {
	var b unitBody
	if !decode(w, r, &b) {
		return
	}
	if b.Name == nil || strings.TrimSpace(*b.Name) == "" {
		writeErr(w, http.StatusBadRequest, "name is required")
		return
	}
	if b.RoomID == nil && b.ParentID == nil {
		writeErr(w, http.StatusBadRequest, "room_id or parent_id is required")
		return
	}
	in := store.UnitInput{Name: strings.TrimSpace(*b.Name), ParentID: b.ParentID}
	if b.RoomID != nil {
		in.RoomID = *b.RoomID
	}
	if b.Kind != nil {
		in.Kind = strings.TrimSpace(*b.Kind)
	}
	if b.Description != nil {
		in.Description = strings.TrimSpace(*b.Description)
	}
	unit, err := s.store.CreateStorageUnit(r.Context(), in)
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, unit)
}

func (s *Server) updateUnit(w http.ResponseWriter, r *http.Request) {
	id, ok := urlID(w, r, "unitID")
	if !ok {
		return
	}
	// Decode into a raw map first so an explicit "parent_id": null is
	// distinguishable from the key being omitted.
	raw, b, ok := decodeWithKeys[unitBody](w, r)
	if !ok {
		return
	}
	p := store.UnitPatch{Kind: b.Kind, Description: b.Description, RoomID: b.RoomID}
	if b.Name != nil {
		trimmed := strings.TrimSpace(*b.Name)
		if trimmed == "" {
			writeErr(w, http.StatusBadRequest, "name cannot be empty")
			return
		}
		p.Name = &trimmed
	}
	if _, present := raw["parent_id"]; present {
		p.SetParent = true
		p.ParentID = b.ParentID
	}
	// Overriding the code re-points every label already printed with the old
	// one, so it is validated strictly rather than trimmed into shape.
	if b.QRSlug != nil {
		slug := normaliseSlug(*b.QRSlug)
		if !validSlug.MatchString(slug) {
			writeErr(w, http.StatusBadRequest, "invalid code",
				"use 4 to 24 characters, letters A-Z and digits only")
			return
		}
		p.QRSlug = &slug
	}
	unit, err := s.store.UpdateStorageUnit(r.Context(), id, p)
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, unit)
}

// regenerateUnitCode retires the printed label and issues a new code.
func (s *Server) regenerateUnitCode(w http.ResponseWriter, r *http.Request) {
	id, ok := urlID(w, r, "unitID")
	if !ok {
		return
	}
	unit, err := s.store.RegenerateSlug(r.Context(), id)
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, unit)
}

func (s *Server) deleteUnit(w http.ResponseWriter, r *http.Request) {
	id, ok := urlID(w, r, "unitID")
	if !ok {
		return
	}
	if err := s.store.DeleteStorageUnit(r.Context(), id, queryBool(r, "cascade")); err != nil {
		writeStoreErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
