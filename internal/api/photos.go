package api

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/sundar/home_sweet_home/internal/media"
)

// uploadItemPhoto accepts a multipart form with a single `photo` file, writes a
// display image and a thumbnail, and points the item at them.
func (s *Server) uploadItemPhoto(w http.ResponseWriter, r *http.Request) {
	if s.media == nil {
		writeErr(w, http.StatusNotImplemented, "photo storage is not configured")
		return
	}
	id, ok := urlID(w, r, "itemID")
	if !ok {
		return
	}

	// Fail fast on an oversized body rather than buffering it first.
	r.Body = http.MaxBytesReader(w, r.Body, media.MaxUpload+1024)
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		writeErr(w, http.StatusRequestEntityTooLarge, "photo too large",
			"the limit is 15MB")
		return
	}
	defer r.MultipartForm.RemoveAll() //nolint:errcheck

	file, header, err := r.FormFile("photo")
	if err != nil {
		writeErr(w, http.StatusBadRequest, "no photo in request", "expected a file field named 'photo'")
		return
	}
	defer file.Close()

	// The item must exist before we write anything to disk.
	previous, err := s.store.PhotoKeyOf(r.Context(), id)
	if err != nil {
		writeStoreErr(w, err)
		return
	}

	key, err := s.media.Save(r.Context(), file)
	if err != nil {
		switch {
		case errors.Is(err, media.ErrUnsupported):
			writeErr(w, http.StatusUnsupportedMediaType, "unsupported image",
				"JPEG, PNG, GIF and WebP are supported; HEIC is not")
		case errors.Is(err, media.ErrTooLarge):
			writeErr(w, http.StatusRequestEntityTooLarge, "photo too large", "the limit is 15MB")
		default:
			slog.Error("save photo", "err", err, "filename", header.Filename)
			writeErr(w, http.StatusInternalServerError, "could not process image")
		}
		return
	}

	actor, _ := s.store.DefaultUserID(r.Context())
	item, err := s.store.SetItemPhoto(r.Context(), id, &key, &actor)
	if err != nil {
		_ = s.media.Delete(r.Context(), key) // never leave bytes no row points at
		writeStoreErr(w, err)
		return
	}
	if previous != "" {
		_ = s.media.Delete(r.Context(), previous)
	}
	writeJSON(w, http.StatusOK, item)
}

// servePhoto streams one variant of a stored photo. Keys are UUID-based and
// never rewritten, so the response can be cached indefinitely.
func (s *Server) servePhoto(w http.ResponseWriter, r *http.Request) {
	if s.media == nil {
		http.NotFound(w, r)
		return
	}
	key, variant, ok := media.VariantFromPath(strings.TrimPrefix(r.URL.Path, "/media/"))
	if !ok || strings.Contains(key, "..") {
		http.NotFound(w, r)
		return
	}

	body, err := s.media.Open(r.Context(), key, variant)
	if err != nil {
		if errors.Is(err, media.ErrNotFound) {
			http.NotFound(w, r)
			return
		}
		slog.Error("read photo", "err", err, "key", key)
		http.Error(w, "could not read photo", http.StatusInternalServerError)
		return
	}

	etag := `"` + key + "-" + variant + `"`
	if match := r.Header.Get("If-None-Match"); match == etag {
		w.WriteHeader(http.StatusNotModified)
		return
	}
	w.Header().Set("Content-Type", "image/jpeg")
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	w.Header().Set("ETag", etag)
	w.Header().Set("Content-Length", strconv.Itoa(len(body)))
	if r.Method == http.MethodHead {
		return
	}
	_, _ = w.Write(body)
}

func (s *Server) deleteItemPhoto(w http.ResponseWriter, r *http.Request) {
	if s.media == nil {
		writeErr(w, http.StatusNotImplemented, "photo storage is not configured")
		return
	}
	id, ok := urlID(w, r, "itemID")
	if !ok {
		return
	}
	previous, err := s.store.PhotoKeyOf(r.Context(), id)
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	actor, _ := s.store.DefaultUserID(r.Context())
	item, err := s.store.SetItemPhoto(r.Context(), id, nil, &actor)
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	if previous != "" {
		_ = s.media.Delete(r.Context(), previous)
	}
	writeJSON(w, http.StatusOK, item)
}
