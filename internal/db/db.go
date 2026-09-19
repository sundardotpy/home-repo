package db

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Options tune the pool for where it is running. A long-lived container wants a
// warm pool; a serverless function wants almost none, because every instance
// holds its own and they are created and discarded constantly.
type Options struct {
	Serverless bool
}

// Connect dials Postgres, retrying until the server accepts queries.
func Connect(ctx context.Context, url string, opts Options) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, fmt.Errorf("parse DATABASE_URL: %w", err)
	}

	// Connection poolers (Neon's `-pooler` endpoint, PgBouncer, RDS Proxy) hand
	// a different backend to each transaction, so a prepared statement cached
	// against one connection may not exist on the next. Exec mode sends
	// parameters inline and never caches, which is the supported way through.
	if pooled(cfg.ConnConfig.Host) {
		cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeExec
		cfg.ConnConfig.StatementCacheCapacity = 0
		cfg.ConnConfig.DescriptionCacheCapacity = 0
	}

	if opts.Serverless {
		cfg.MaxConns = 2
		cfg.MinConns = 0
		cfg.MaxConnIdleTime = 30 * time.Second
		cfg.MaxConnLifetime = 5 * time.Minute
		cfg.HealthCheckPeriod = time.Minute
	} else {
		cfg.MaxConns = 10
		cfg.MaxConnLifetime = time.Hour
	}

	// A managed database may be asleep; the first connection is what wakes it.
	cfg.ConnConfig.ConnectTimeout = 15 * time.Second

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}

	attempts := 15
	if opts.Serverless {
		attempts = 3 // fail fast: the platform will retry the request itself
	}
	var lastErr error
	for attempt := 1; attempt <= attempts; attempt++ {
		pingCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
		lastErr = pool.Ping(pingCtx)
		cancel()
		if lastErr == nil {
			slog.Info("database connected",
				"host", cfg.ConnConfig.Host, "pooled", pooled(cfg.ConnConfig.Host),
				"max_conns", cfg.MaxConns)
			return pool, nil
		}
		slog.Warn("waiting for postgres", "attempt", attempt, "err", lastErr)
		select {
		case <-ctx.Done():
			pool.Close()
			return nil, ctx.Err()
		case <-time.After(time.Second):
		}
	}
	pool.Close()
	return nil, fmt.Errorf("database unreachable: %w", lastErr)
}

func pooled(host string) bool {
	return strings.Contains(host, "-pooler.") || strings.Contains(host, "pgbouncer")
}
