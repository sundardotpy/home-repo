package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func newGated(pass string) *Server {
	s := &Server{}
	s.SetPasscode(pass)
	return s
}

func TestTokenRoundTrip(t *testing.T) {
	s := newGated("correct horse battery")
	now := time.Unix(1_800_000_000, 0)
	tok := s.sign(now.Add(time.Hour).Unix())

	if !s.validToken(tok, now) {
		t.Fatal("a fresh token should be valid")
	}
	if s.validToken(tok, now.Add(2*time.Hour)) {
		t.Fatal("an expired token should be refused")
	}
	if s.validToken(tok+"0", now) || s.validToken("v1.99999999999.deadbeef", now) || s.validToken("", now) {
		t.Fatal("forged or malformed tokens should be refused")
	}
	if newGated("another passcode").validToken(tok, now) {
		t.Fatal("a token must not survive a passcode change")
	}
}

func TestGateAndLogin(t *testing.T) {
	s := newGated("correct horse battery")
	open := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	gated := s.apiGate(open)

	get := func(path string, h http.Handler, cookie *http.Cookie) int {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		if cookie != nil {
			req.AddCookie(cookie)
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec.Code
	}

	if code := get("/api/items", gated, nil); code != http.StatusUnauthorized {
		t.Fatalf("data without a session: got %d, want 401", code)
	}
	for _, p := range []string{"/api/healthz", "/api/session", "/api/login"} {
		if code := get(p, gated, nil); code != http.StatusOK {
			t.Fatalf("%s should stay reachable, got %d", p, code)
		}
	}

	wrong := httptest.NewRecorder()
	s.login(wrong, httptest.NewRequest(http.MethodPost, "/api/login", strings.NewReader(`{"passcode":"nope"}`)))
	if wrong.Code != http.StatusUnauthorized {
		t.Fatalf("wrong passcode: got %d, want 401", wrong.Code)
	}

	right := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/login", strings.NewReader(`{"passcode":"correct horse battery"}`))
	req.RemoteAddr = "10.0.0.9:1234"
	s.login(right, req)
	if right.Code != http.StatusOK {
		t.Fatalf("right passcode: got %d, want 200", right.Code)
	}
	cookies := right.Result().Cookies()
	if len(cookies) != 1 || !cookies[0].HttpOnly || cookies[0].Name != sessionCookie {
		t.Fatalf("expected one HttpOnly session cookie, got %+v", cookies)
	}
	if code := get("/api/items", gated, cookies[0]); code != http.StatusOK {
		t.Fatalf("data with a session: got %d, want 200", code)
	}
}

func TestOpenWhenNoPasscode(t *testing.T) {
	s := newGated("")
	if !s.authed(httptest.NewRequest(http.MethodGet, "/api/items", nil)) {
		t.Fatal("with no passcode set, everything is open")
	}
}

func TestLockoutAfterRepeatedFailures(t *testing.T) {
	s := newGated("correct horse battery")
	ip := "203.0.113.7:5555"
	for i := 0; i < maxFailures; i++ {
		s.noteFailure(ip)
	}
	if !s.tooManyFailures(ip) {
		t.Fatal("should be locked out after repeated failures")
	}
	if s.tooManyFailures("198.51.100.1:1") {
		t.Fatal("another address should be unaffected")
	}
}
