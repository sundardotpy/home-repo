package api

import (
	"log/slog"
	"net/http"
	"regexp"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/sundar/home_sweet_home/internal/qr"
	"github.com/sundar/home_sweet_home/internal/store"
)

// scanURL is what gets encoded into the label. It has to be absolute — a phone
// camera app opens it directly, with no app context to resolve a relative path.
func (s *Server) scanURL(r *http.Request, slug string) string {
	if s.baseURL != "" {
		return strings.TrimRight(s.baseURL, "/") + "/q/" + slug
	}
	// Not configured: mirror however the client reached us. Good enough for a
	// home LAN, where the host is a machine name or an IP.
	scheme := "http"
	if proto := r.Header.Get("X-Forwarded-Proto"); proto != "" {
		scheme = proto
	} else if r.TLS != nil {
		scheme = "https"
	}
	host := r.Host
	if fwd := r.Header.Get("X-Forwarded-Host"); fwd != "" {
		host = fwd
	}
	return scheme + "://" + host + "/q/" + slug
}

func normaliseSlug(s string) string {
	return strings.ToUpper(strings.TrimSpace(s))
}

// Barcodes are printed with spaces and hyphens in them often enough that
// scanners and people both produce variations; keep only the payload.
func normaliseBarcode(s string) string {
	return strings.Map(func(r rune) rune {
		if r == ' ' || r == '-' {
			return -1
		}
		return r
	}, strings.TrimSpace(s))
}

var validSlug = regexp.MustCompile(`^[A-Z0-9]{4,24}$`)

// resolveScan is the one endpoint the scanner talks to. It does not care
// whether the camera saw one of our QR labels or a manufacturer's barcode.
func (s *Server) resolveScan(w http.ResponseWriter, r *http.Request) {
	raw := strings.TrimSpace(r.URL.Query().Get("code"))
	if raw == "" {
		writeErr(w, http.StatusBadRequest, "code is required")
		return
	}

	// A scanned label gives a whole URL; keep the last path segment.
	candidate := raw
	if i := strings.LastIndex(candidate, "/q/"); i >= 0 {
		candidate = candidate[i+3:]
	}
	candidate, _, _ = strings.Cut(candidate, "?")
	candidate, _, _ = strings.Cut(candidate, "#")

	if slug := normaliseSlug(candidate); validSlug.MatchString(slug) {
		if unit, err := s.store.GetStorageUnitBySlug(r.Context(), slug); err == nil {
			writeJSON(w, http.StatusOK, map[string]any{
				"kind":         "storage_unit",
				"storage_unit": unit,
				"app_url":      "/#/unit/" + unit.ID.String(),
			})
			return
		}
	}

	code := normaliseBarcode(raw)
	items, _, err := s.store.ListItems(r.Context(), store.ItemFilter{Barcode: code, Limit: 50})
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	if len(items) == 1 {
		writeJSON(w, http.StatusOK, map[string]any{
			"kind":    "item",
			"item":    items[0],
			"items":   items,
			"barcode": code,
			"app_url": "/#/item/" + items[0].ID.String(),
		})
		return
	}
	if len(items) > 1 {
		// Several of the same product: let the user pick which one they mean.
		writeJSON(w, http.StatusOK, map[string]any{
			"kind": "items", "items": items, "barcode": code,
		})
		return
	}

	// Nothing knows this code yet — the caller can offer to attach it.
	writeJSON(w, http.StatusNotFound, map[string]any{
		"kind": "unknown", "barcode": code, "error": "no item or storage unit has that code",
	})
}

// qrImage serves the label artwork for a slug. The slug is validated against
// the database so a printed label always corresponds to a real unit.
func (s *Server) qrImage(w http.ResponseWriter, r *http.Request) {
	slug := normaliseSlug(chi.URLParam(r, "slug"))
	unit, err := s.store.GetStorageUnitBySlug(r.Context(), slug)
	if err != nil {
		writeStoreErr(w, err)
		return
	}

	target := s.scanURL(r, unit.QRSlug)
	png := strings.HasSuffix(r.URL.Path, "/png")

	var (
		body []byte
		ct   string
	)
	if png {
		body, err = qr.PNG(target)
		ct = "image/png"
	} else {
		body, err = qr.SVG(target)
		ct = "image/svg+xml"
	}
	if err != nil {
		slog.Error("render qr", "err", err, "slug", slug)
		writeErr(w, http.StatusInternalServerError, "could not render the QR code")
		return
	}

	w.Header().Set("Content-Type", ct)
	// The slug never changes for a unit, but the encoded host can, so this is
	// cached for a while rather than forever.
	w.Header().Set("Cache-Control", "public, max-age=3600")
	_, _ = w.Write(body)
}

// qrTarget reports where a slug points without redirecting, for the in-app
// scanner deciding whether a code is worth navigating to.
func (s *Server) qrTarget(w http.ResponseWriter, r *http.Request) {
	slug := normaliseSlug(chi.URLParam(r, "slug"))
	unit, err := s.store.GetStorageUnitBySlug(r.Context(), slug)
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"storage_unit": unit,
		"scan_url":     s.scanURL(r, unit.QRSlug),
		"app_url":      "/#/unit/" + unit.ID.String(),
	})
}

// scanRedirect handles the URL printed on the label: a phone camera opens it
// and lands inside the app, on the unit it belongs to.
func (s *Server) scanRedirect(w http.ResponseWriter, r *http.Request) {
	slug := normaliseSlug(chi.URLParam(r, "slug"))
	unit, err := s.store.GetStorageUnitBySlug(r.Context(), slug)
	if err != nil {
		// An unknown code should still land somewhere useful, not on a 404.
		http.Redirect(w, r, "/#/?unknown_code="+slug, http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, "/#/unit/"+unit.ID.String(), http.StatusSeeOther)
}
