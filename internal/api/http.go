package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/sundar/home_sweet_home/internal/store"
)

type errorBody struct {
	Error  string `json:"error"`
	Detail string `json:"detail,omitempty"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if v == nil {
		return
	}
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("write response", "err", err)
	}
}

func writeErr(w http.ResponseWriter, status int, msg string, detail ...string) {
	b := errorBody{Error: msg}
	if len(detail) > 0 {
		b.Detail = detail[0]
	}
	writeJSON(w, status, b)
}

// writeStoreErr maps store sentinels onto status codes so handlers stay short.
func writeStoreErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, store.ErrNotFound):
		writeErr(w, http.StatusNotFound, "not found", err.Error())
	case errors.Is(err, store.ErrConflict):
		writeErr(w, http.StatusConflict, "already exists", conflictDetail(err.Error()))
	case errors.Is(err, store.ErrNotEmpty):
		writeErr(w, http.StatusConflict, "not empty",
			"it still holds storage units or items; pass ?cascade=true to delete everything inside")
	case errors.Is(err, store.ErrCycle):
		writeErr(w, http.StatusBadRequest, "invalid move", "a storage unit cannot be moved inside itself")
	case errors.Is(err, store.ErrRoomCross):
		writeErr(w, http.StatusBadRequest, "room mismatch", err.Error())
	case errors.Is(err, store.ErrInvalid):
		writeErr(w, http.StatusBadRequest, "invalid", err.Error())
	default:
		slog.Error("unhandled store error", "err", err)
		writeErr(w, http.StatusInternalServerError, "internal error")
	}
}

// conflictDetail turns a constraint name into something a person can act on;
// the raw name still ships in the log, not in the UI.
func conflictDetail(raw string) string {
	switch {
	case strings.Contains(raw, "rooms_floor_name_key"), strings.Contains(raw, "rooms_name_key"):
		return "a room with that name already exists on that floor"
	case strings.Contains(raw, "storage_units_sibling_name_key"):
		return "there is already a storage unit with that name in the same place"
	case strings.Contains(raw, "storage_units_qr_slug"):
		return "could not allocate a QR code; try again"
	default:
		return raw
	}
}

func decode(w http.ResponseWriter, r *http.Request, dst any) bool {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body", err.Error())
		return false
	}
	return true
}

// decodeWithKeys decodes the body twice: once into a map so handlers can tell
// `"parent_id": null` (move to the root) from an omitted key (leave it alone),
// and once into the typed struct.
func decodeWithKeys[T any](w http.ResponseWriter, r *http.Request) (map[string]json.RawMessage, T, bool) {
	var typed T
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "could not read body", err.Error())
		return nil, typed, false
	}
	if len(body) == 0 {
		body = []byte("{}")
	}
	raw := map[string]json.RawMessage{}
	if err := json.Unmarshal(body, &raw); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body", err.Error())
		return nil, typed, false
	}
	dec := json.NewDecoder(bytes.NewReader(body))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&typed); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body", err.Error())
		return nil, typed, false
	}
	return raw, typed, true
}

func urlID(w http.ResponseWriter, r *http.Request, key string) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, key))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid id", chi.URLParam(r, key))
		return uuid.Nil, false
	}
	return id, true
}

func queryUUID(r *http.Request, key string) (*uuid.UUID, error) {
	raw := r.URL.Query().Get(key)
	if raw == "" {
		return nil, nil
	}
	id, err := uuid.Parse(raw)
	if err != nil {
		return nil, err
	}
	return &id, nil
}

func queryBool(r *http.Request, key string) bool {
	v := strings.ToLower(r.URL.Query().Get(key))
	return v == "1" || v == "true" || v == "yes"
}

func queryInt(r *http.Request, key string, fallback int) int {
	raw := r.URL.Query().Get(key)
	if raw == "" {
		return fallback
	}
	n, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return n
}

// normaliseTags trims, lowercases and de-duplicates so "Tools" and " tools "
// don't become two different tags.
func normaliseTags(in []string) []string {
	if in == nil {
		return nil
	}
	seen := map[string]bool{}
	out := []string{}
	for _, t := range in {
		t = strings.ToLower(strings.TrimSpace(t))
		if t == "" || seen[t] {
			continue
		}
		seen[t] = true
		out = append(out, t)
	}
	return out
}
