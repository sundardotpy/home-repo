package api

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/sundar/home_repo/internal/media"
	"github.com/sundar/home_repo/internal/store"
)

type Server struct {
	store   *store.Store
	media   media.Store
	web     http.Handler // app shell + assets; everything that is not /api
	baseURL string       // absolute URL printed onto QR labels; may be empty
}

func NewServer(st *store.Store, ms media.Store, web http.Handler, baseURL string) *Server {
	return &Server{store: st, media: ms, web: web, baseURL: baseURL}
}

func (s *Server) Routes() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))
	// JSON and the JS/CSS bundles compress to a fraction of their size, which
	// is the single biggest win on a phone connection. JPEGs are already
	// compressed, so they are left alone.
	r.Use(middleware.Compress(5,
		"application/json", "text/html", "text/css", "application/javascript",
		"text/javascript", "image/svg+xml"))

	r.Get("/healthz", s.health)

	// Uploaded photos, served from whichever backend is configured.
	r.Get("/media/*", s.servePhoto)
	r.Head("/media/*", s.servePhoto)

	// The short URL printed on every label. Kept out of /api so it stays
	// typeable, and so a camera app lands somewhere sensible.
	r.Get("/q/{slug}", s.scanRedirect)

	r.Route("/api", func(r chi.Router) {
		r.Get("/healthz", s.health)

		r.Route("/rooms", func(r chi.Router) {
			r.Get("/", s.listRooms)
			r.Post("/", s.createRoom)
			r.Get("/{roomID}", s.getRoom)
			r.Patch("/{roomID}", s.updateRoom)
			r.Delete("/{roomID}", s.deleteRoom)
			r.Get("/{roomID}/tree", s.roomTree)
			r.Get("/{roomID}/items", s.roomItems)
		})

		r.Route("/storage-units", func(r chi.Router) {
			r.Get("/", s.listUnits)
			r.Post("/", s.createUnit)
			r.Get("/{unitID}", s.getUnit)
			r.Patch("/{unitID}", s.updateUnit)
			r.Delete("/{unitID}", s.deleteUnit)
			r.Get("/{unitID}/contents", s.unitContents)
			r.Post("/{unitID}/qr/regenerate", s.regenerateUnitCode)
		})

		// Scans land here; the slug is printed on the label.
		r.Get("/qr/{slug}", s.unitBySlug)
		r.Get("/qr/{slug}/target", s.qrTarget)
		r.Get("/qr/{slug}/svg", s.qrImage)
		r.Get("/qr/{slug}/png", s.qrImage)

		r.Route("/items", func(r chi.Router) {
			r.Get("/", s.listItems)
			r.Post("/", s.createItem)
			r.Get("/{itemID}", s.getItem)
			r.Patch("/{itemID}", s.updateItem)
			r.Delete("/{itemID}", s.deleteItem)
			r.Post("/{itemID}/move", s.moveItem)
			r.Post("/{itemID}/photo", s.uploadItemPhoto)
			r.Delete("/{itemID}/photo", s.deleteItemPhoto)
		})

		r.Route("/tags", func(r chi.Router) {
			r.Get("/", s.listTags)
			r.Post("/", s.createTag)
			r.Patch("/{tag}", s.renameTag)
			r.Delete("/{tag}", s.deleteTag)
		})

		r.Get("/properties", s.listProperties)

		r.Get("/search", s.search)

		// One endpoint for anything a camera saw: our QR labels or a
		// manufacturer's barcode.
		r.Get("/scan", s.resolveScan)
	})

	// Anything not matched above is the frontend: the app shell and its assets.
	if s.web != nil {
		r.NotFound(s.web.ServeHTTP)
	}

	return r
}

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	if _, err := s.store.DefaultUserID(r.Context()); err != nil {
		writeErr(w, http.StatusServiceUnavailable, "database not ready", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
