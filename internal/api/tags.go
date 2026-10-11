package api

import (
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/sundar/home_repo/internal/store"
)

func (s *Server) listTags(w http.ResponseWriter, r *http.Request) {
	tags, err := s.store.ListTags(r.Context())
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"tags": tags})
}

func (s *Server) createTag(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Name *string `json:"name"`
	}
	if !decode(w, r, &b) {
		return
	}
	if b.Name == nil || store.NormaliseTag(*b.Name) == "" {
		writeErr(w, http.StatusBadRequest, "name is required")
		return
	}
	tag, err := s.store.CreateTag(r.Context(), *b.Name)
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, tag)
}

// renameTag rewrites the tag on every item that carries it.
func (s *Server) renameTag(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Name *string `json:"name"`
	}
	if !decode(w, r, &b) {
		return
	}
	if b.Name == nil || store.NormaliseTag(*b.Name) == "" {
		writeErr(w, http.StatusBadRequest, "name is required")
		return
	}
	tag, err := s.store.RenameTag(r.Context(), chi.URLParam(r, "tag"), *b.Name)
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, tag)
}

// deleteTag retires a tag and strips it from every item that used it.
func (s *Server) deleteTag(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeleteTag(r.Context(), chi.URLParam(r, "tag")); err != nil {
		writeStoreErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// listProperties powers autocomplete for custom fields: which keys exist, how
// often, and which values they have been given.
func (s *Server) listProperties(w http.ResponseWriter, r *http.Request) {
	keys, err := s.store.ListPropertyKeys(r.Context())
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"properties": keys})
}

// normaliseProperties trims both halves and drops entries with an empty key.
// Values are kept verbatim otherwise: a serial number's case matters.
func normaliseProperties(in map[string]string) map[string]string {
	if in == nil {
		return nil
	}
	out := make(map[string]string, len(in))
	for k, v := range in {
		k = strings.Join(strings.Fields(k), " ")
		if k == "" {
			continue
		}
		out[k] = strings.TrimSpace(v)
	}
	return out
}
