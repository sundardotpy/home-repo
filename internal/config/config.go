package config

import (
	"fmt"
	"os"
	"strings"
)

type Config struct {
	DatabaseURL string
	Port        string
	Env         string

	// MediaBackend is "db" (default, works anywhere) or "disk".
	MediaBackend string
	UploadDir    string

	// PublicBaseURL is what gets encoded into printed QR labels. Left empty,
	// each label mirrors the host the browser used to request it — fine on a
	// home network, wrong once the app is reachable at a stable address.
	PublicBaseURL string

	// Serverless trims the connection pool and shortens startup retries.
	// Detected from the platform's own environment variables so a deployment
	// needs no extra configuration.
	Serverless bool
}

func Load() (Config, error) {
	c := Config{
		DatabaseURL:   os.Getenv("DATABASE_URL"),
		Port:          envOr("PORT", "8080"),
		Env:           envOr("APP_ENV", "dev"),
		MediaBackend:  strings.ToLower(envOr("MEDIA_BACKEND", "db")),
		UploadDir:     envOr("UPLOAD_DIR", "./uploads"),
		PublicBaseURL: os.Getenv("PUBLIC_BASE_URL"),
		Serverless:    detectServerless(),
	}
	if c.DatabaseURL == "" {
		return c, fmt.Errorf("DATABASE_URL is required")
	}
	if c.MediaBackend != "db" && c.MediaBackend != "disk" {
		return c, fmt.Errorf("MEDIA_BACKEND must be db or disk, got %q", c.MediaBackend)
	}
	// Vercel gives every deployment its URL but no scheme.
	if c.PublicBaseURL == "" {
		if host := os.Getenv("VERCEL_PROJECT_PRODUCTION_URL"); host != "" {
			c.PublicBaseURL = "https://" + host
		}
	}
	return c, nil
}

func detectServerless() bool {
	for _, key := range []string{"VERCEL", "AWS_LAMBDA_FUNCTION_NAME", "FUNCTION_TARGET"} {
		if os.Getenv(key) != "" {
			return true
		}
	}
	return false
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
