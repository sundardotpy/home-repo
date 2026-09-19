// Package app wires the pieces together, so the long-running server and the
// serverless entrypoint cannot drift apart.
package app

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sundar/home_sweet_home/internal/api"
	"github.com/sundar/home_sweet_home/internal/config"
	"github.com/sundar/home_sweet_home/internal/db"
	"github.com/sundar/home_sweet_home/internal/media"
	"github.com/sundar/home_sweet_home/internal/store"
	"github.com/sundar/home_sweet_home/internal/web"
)

type App struct {
	Config config.Config
	Pool   *pgxpool.Pool
	Server *api.Server
}

// Build connects, migrates and returns a ready handler.
func Build(ctx context.Context) (*App, error) {
	cfg, err := config.Load()
	if err != nil {
		return nil, err
	}

	pool, err := db.Connect(ctx, cfg.DatabaseURL, db.Options{Serverless: cfg.Serverless})
	if err != nil {
		return nil, err
	}

	if err := db.Migrate(ctx, pool); err != nil {
		pool.Close()
		return nil, err
	}

	photos, err := newMediaStore(cfg, pool)
	if err != nil {
		pool.Close()
		return nil, err
	}

	srv := api.NewServer(
		store.New(pool),
		photos,
		web.Handler(cfg.Env == "dev"),
		cfg.PublicBaseURL,
	)
	return &App{Config: cfg, Pool: pool, Server: srv}, nil
}

func newMediaStore(cfg config.Config, pool *pgxpool.Pool) (media.Store, error) {
	switch cfg.MediaBackend {
	case "disk":
		return media.NewDiskStore(cfg.UploadDir)
	case "db":
		return media.NewPGStore(pool), nil
	default:
		return nil, fmt.Errorf("unknown media backend %q", cfg.MediaBackend)
	}
}
