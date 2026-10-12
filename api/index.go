// Package handler is the Vercel entrypoint. Vercel's Go runtime compiles each
// file under api/ into its own serverless function and calls the exported
// Handler, generating the main package itself — which is why this is a library
// package and not main.
package handler

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"sync"

	"github.com/sundar/home_repo/app"
)

var (
	once    sync.Once
	handler http.Handler
	buildEr error
)

// build runs on the first request an instance sees, and never again: connecting
// and migrating on every invocation would add a round trip to every request.
func build() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})))

	a, err := app.Build(context.Background())
	if err != nil {
		buildEr = err
		return
	}
	handler = a.Server.Routes()
}

func Handler(w http.ResponseWriter, r *http.Request) {
	once.Do(build)
	if buildEr != nil {
		// Surface the reason rather than a bare 500 — on a fresh deployment
		// this is nearly always a missing or wrong DATABASE_URL.
		slog.Error("startup failed", "err", buildEr)
		http.Error(w, "service unavailable: "+buildEr.Error(), http.StatusServiceUnavailable)
		return
	}
	handler.ServeHTTP(w, r)
}
