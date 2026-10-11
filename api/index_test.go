package handler

import (
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

// The serverless entrypoint has its own build path — a sync.Once around
// app.Build — so it needs exercising, not just compiling. Skipped without a
// database, since that is all this can meaningfully test.
func TestHandlerServesTheApp(t *testing.T) {
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("DATABASE_URL not set")
	}

	cases := []struct {
		path       string
		wantStatus int
		wantIn     string
	}{
		{"/healthz", http.StatusOK, `"status":"ok"`},
		{"/api/rooms", http.StatusOK, `"rooms"`},
		{"/", http.StatusOK, "<title>Home Repo</title>"},
		{"/static/js/app.js", http.StatusOK, "import"},
		{"/api/nope", http.StatusNotFound, ""},
	}

	for _, c := range cases {
		req := httptest.NewRequest(http.MethodGet, c.path, nil)
		rec := httptest.NewRecorder()
		Handler(rec, req)

		if rec.Code != c.wantStatus {
			t.Errorf("GET %s: got %d, want %d (%s)", c.path, rec.Code, c.wantStatus,
				strings.TrimSpace(rec.Body.String())[:min(120, rec.Body.Len())])
			continue
		}
		if c.wantIn != "" && !strings.Contains(rec.Body.String(), c.wantIn) {
			t.Errorf("GET %s: body does not contain %q", c.path, c.wantIn)
		}
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
